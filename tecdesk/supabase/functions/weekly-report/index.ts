import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async () => {
  try {
    const url = Deno.env.get('SUPABASE_URL')!;
    const secret = Deno.env.get('SUPABASE_SECRET_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const resendKey = Deno.env.get('RESEND_API_KEY')!;
    const reportTo = Deno.env.get('REPORT_TO')!;
    const reportFrom = Deno.env.get('REPORT_FROM') || 'PCB TechDesk <noreply@example.com>';
    const db = createClient(url, secret, { auth: { persistSession: false } });

    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 6);
    const iso = (d: Date) => d.toISOString().slice(0, 10);

    const [{ data: summary, error: e1 }, { data: techs, error: e2 }] = await Promise.all([
      db.rpc('report_summary', { p_from: iso(start), p_to: iso(end) }),
      db.rpc('technician_stats', { p_from: iso(start), p_to: iso(end) })
    ]);
    if (e1 || e2) throw e1 || e2;

    const techRows = (techs || []).map((t: any) => `<tr><td>${t.technician_name}</td><td>${t.assigned}</td><td>${t.resolved}</td><td>${t.minutes_total}</td><td>${t.avg_rating ?? '—'}</td></tr>`).join('');
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:760px;margin:auto">
        <h1>PCB TechDesk · Informe semanal</h1>
        <p>Periodo: ${iso(start)} al ${iso(end)}</p>
        <table style="width:100%;border-collapse:collapse;margin:20px 0">
          <tr><td><b>Boletas</b><br>${summary?.total ?? 0}</td><td><b>Abiertas</b><br>${summary?.open ?? 0}</td><td><b>Resueltas</b><br>${summary?.resolved ?? 0}</td><td><b>Fuera SLA</b><br>${summary?.overdue ?? 0}</td></tr>
        </table>
        <h2>Rendimiento por técnico</h2>
        <table style="width:100%;border-collapse:collapse" border="1" cellpadding="8"><thead><tr><th>Técnico</th><th>Asignadas</th><th>Resueltas</th><th>Minutos</th><th>Rating</th></tr></thead><tbody>${techRows}</tbody></table>
      </div>`;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST', headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: reportFrom, to: [reportTo], subject: `PCB TechDesk · Informe semanal ${iso(end)}`, html })
    });
    if (!res.ok) throw new Error(`Email provider: ${res.status} ${await res.text()}`);
    return new Response(JSON.stringify({ ok: true }), { headers: { 'content-type':'application/json' } });
  } catch (error) {
    return new Response(JSON.stringify({ ok:false, error:String(error) }), { status:500, headers:{'content-type':'application/json'} });
  }
});
