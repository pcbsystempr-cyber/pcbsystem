import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: corsHeaders });
}

function getSecretKey() {
  const current = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (current) return JSON.parse(current).default;
  return Deno.env.get('SUPABASE_SECRET_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Método no permitido.' }, 405);

  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const secretKey = getSecretKey();
  const authorization = req.headers.get('Authorization');
  if (!url || !anonKey || !secretKey || !authorization) return json({ error: 'No autorizado.' }, 401);

  try {
    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false },
    });
    const token = authorization.replace(/^Bearer\s+/i, '');
    const { data: { user }, error: userError } = await userClient.auth.getUser(token);
    if (userError || !user) return json({ error: 'Sesión inválida.' }, 401);

    const adminClient = createClient(url, secretKey, { auth: { persistSession: false } });
    const { data: requester, error: profileError } = await adminClient.from('profiles')
      .select('id,role,active').eq('id', user.id).single();
    if (profileError || requester?.role !== 'admin' || requester.active !== true) {
      return json({ error: 'Solo administración puede añadir técnicos.' }, 403);
    }

    const body = await req.json();
    const fullName = String(body.full_name || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    if (fullName.length < 3) return json({ error: 'Escribe el nombre completo del técnico.' }, 400);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'Escribe un correo válido.' }, 400);
    if (password.length < 8) return json({ error: 'La contraseña debe tener al menos 8 caracteres.' }, 400);

    const { data: created, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (createError || !created.user) return json({ error: createError?.message || 'No se pudo crear la cuenta.' }, 400);

    const technician = { id: created.user.id, full_name: fullName, role: 'technician', active: true };
    const { error: saveError } = await adminClient.from('profiles').upsert(technician, { onConflict: 'id' });
    if (saveError) {
      await adminClient.auth.admin.deleteUser(created.user.id);
      throw saveError;
    }

    return json({ ok: true, technician: { id: technician.id, full_name: technician.full_name, role: technician.role } });
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : 'No se pudo crear el técnico.' }, 500);
  }
});
