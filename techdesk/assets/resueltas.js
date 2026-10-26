import { DEMO_MODE, getSession, signOut, listSolvedTickets } from './db.js';
import { qs, qsa, esc, fmtDate, statusPill, priorityPill, toast } from './utils.js';

let profile = null;
let tickets = [];

async function boot() {
  if (DEMO_MODE) qs('#demoBanner')?.classList.remove('hidden');
  profile = await getSession();
  if (!profile) { location.href = 'login.html'; return; }
  if (profile.role !== 'admin') qsa('[data-admin-only]').forEach(x => x.classList.add('hidden'));
  setupHandlers();
  await refresh();
}

function setupHandlers() {
  qs('#logoutBtn').onclick = async () => { await signOut(); location.href = 'login.html'; };
  qs('#searchInput').addEventListener('input', debounce(refresh, 250));
  qs('#statusFilter').onchange = refresh;
}

async function refresh() {
  const search = qs('#searchInput').value.trim();
  const status = qs('#statusFilter').value;
  try {
    tickets = await listSolvedTickets({ search: search || undefined, status: status || undefined });
  } catch (err) {
    toast(err.message || 'No se pudieron cargar las boletas resueltas.', 'error');
    tickets = [];
  }
  render();
}

function render() {
  qs('#resultCount').textContent = tickets.length;
  qs('#ticketBody').innerHTML = tickets.length
    ? tickets.map(t => `<tr><td><div class="ticket-title">${esc(t.ticket_no)}</div><div class="ticket-sub">${esc(t.category || '')}</div></td><td><div class="ticket-title">${esc(t.requester_name || '')}</div><div class="ticket-sub">${esc(t.department || '')} · ${esc(t.room || 'Sin salón')}</div></td><td>${priorityPill(t.priority)}</td><td>${statusPill(t.status)}</td><td>${esc(t.assigned_name || 'Sin asignar')}</td><td>${fmtDate(t.resolved_at || t.closed_at)}</td><td>${fmtDate(t.created_at)}</td></tr>`).join('')
    : `<tr><td colspan="7"><div class="empty">No hay boletas resueltas que coincidan.</div></td></tr>`;
}

function debounce(fn, wait) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), wait); }; }

boot().catch(err => { console.error(err); toast(err.message || 'Error cargando las boletas resueltas.', 'error'); });
