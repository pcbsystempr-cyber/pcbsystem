import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const escapeHtml = (value: unknown) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

const labels: Record<string, string> = {
  low: 'Baja', medium: 'Media', high: 'Alta', critical: 'Crítica',
};

function getSecretKey() {
  const current = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (current) return JSON.parse(current).default;
  return Deno.env.get('SUPABASE_SECRET_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
}

function hasValidPublicKey(req: Request) {
  const supplied = req.headers.get('apikey');
  if (!supplied) return false;
  const current = Deno.env.get('SUPABASE_PUBLISHABLE_KEYS');
  if (current && Object.values(JSON.parse(current)).includes(supplied)) return true;
  return supplied === Deno.env.get('SUPABASE_ANON_KEY');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return Response.json({ error: 'Método no permitido.' }, { status: 405, headers: corsHeaders });

  try {
    if (!hasValidPublicKey(req)) return Response.json({ error: 'No autorizado.' }, { status: 401, headers: corsHeaders });

    const url = Deno.env.get('SUPABASE_URL');
    const secret = getSecretKey();
    const resendKey = Deno.env.get('RESEND_API_KEY');
    const notificationTo = Deno.env.get('NEW_TICKET_TO');
    const notificationFrom = Deno.env.get('NEW_TICKET_FROM') || Deno.env.get('REPORT_FROM');
    if (!url || !secret || !resendKey || !notificationTo || !notificationFrom) {
      throw new Error('Faltan secretos para enviar notificaciones.');
    }

    const { ticket_id, tracking_token } = await req.json();
    if (!ticket_id || !tracking_token) return Response.json({ error: 'Datos de boleta incompletos.' }, { status: 400, headers: corsHeaders });

    const db = createClient(url, secret, { auth: { persistSession: false } });
    const { data: ticket, error } = await db.from('tickets')
      .select('id,ticket_no,tracking_token,requester_name,requester_email,department,room,category,equipment_type,description,priority,impact,created_at')
      .eq('id', ticket_id)
      .eq('tracking_token', tracking_token)
      .single();
    if (error || !ticket) return Response.json({ error: 'Boleta no encontrada.' }, { status: 404, headers: corsHeaders });

    const recipients = notificationTo.split(',').map((email) => email.trim()).filter(Boolean);
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:680px;margin:auto;color:#172033">
        <div style="background:#112a46;color:white;padding:22px 26px;border-radius:12px 12px 0 0">
          <div style="font-size:13px;opacity:.8">PCB TechDesk</div>
          <h1 style="font-size:24px;margin:6px 0 0">Nueva boleta ${escapeHtml(ticket.ticket_no)}</h1>
        </div>
        <div style="border:1px solid #dce3ea;border-top:0;padding:24px 26px;border-radius:0 0 12px 12px">
          <p style="margin-top:0">Se recibió una nueva solicitud de servicio técnico.</p>
          <table style="width:100%;border-collapse:collapse" cellpadding="8">
            <tr><td><b>Solicitante</b></td><td>${escapeHtml(ticket.requester_name)}</td></tr>
            <tr><td><b>Email</b></td><td>${escapeHtml(ticket.requester_email || 'No indicado')}</td></tr>
            <tr><td><b>Departamento</b></td><td>${escapeHtml(ticket.department)}</td></tr>
            <tr><td><b>Ubicación</b></td><td>${escapeHtml(ticket.room || 'No indicada')}</td></tr>
            <tr><td><b>Categoría</b></td><td>${escapeHtml(ticket.category)}</td></tr>
            <tr><td><b>Equipo</b></td><td>${escapeHtml(ticket.equipment_type || 'No indicado')}</td></tr>
            <tr><td><b>Prioridad</b></td><td>${escapeHtml(labels[ticket.priority] || ticket.priority)}</td></tr>
          </table>
          <div style="background:#f4f7fa;padding:16px;border-radius:8px;margin-top:16px">
            <b>Descripción</b><br><span style="white-space:pre-wrap">${escapeHtml(ticket.description)}</span>
          </div>
        </div>
      </div>`;

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `new-ticket-${ticket.id}`,
      },
      body: JSON.stringify({
        from: notificationFrom,
        to: recipients,
        reply_to: ticket.requester_email || undefined,
        subject: `[${labels[ticket.priority] || ticket.priority}] Nueva boleta ${ticket.ticket_no}`,
        html,
      }),
    });
    if (!response.ok) throw new Error(`Resend respondió ${response.status}: ${await response.text()}`);

    const sent = await response.json();
    return Response.json({ ok: true, email_id: sent.id }, { headers: corsHeaders });
  } catch (error) {
    console.error(error);
    return Response.json({ ok: false, error: String(error) }, { status: 500, headers: corsHeaders });
  }
});
