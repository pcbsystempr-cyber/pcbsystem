export function qs(sel,root=document){return root.querySelector(sel)}
export function qsa(sel,root=document){return [...root.querySelectorAll(sel)]}
export function esc(v=''){return String(v).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
export function fmtDate(v){if(!v)return '—';return new Intl.DateTimeFormat('es-PR',{dateStyle:'medium',timeStyle:'short'}).format(new Date(v))}
export function fmtDateOnly(v){if(!v)return '—';return new Intl.DateTimeFormat('es-PR',{dateStyle:'medium'}).format(new Date(v))}
export function statusLabel(s){return ({new:'Nueva',triage:'Evaluación',assigned:'Asignada',in_progress:'En proceso',awaiting_user:'Esperando usuario',awaiting_parts:'Esperando pieza',resolved:'Resuelta',closed:'Cerrada',cancelled:'Cancelada'})[s]||s||'—'}
export function priorityLabel(s){return ({critical:'Crítica',high:'Alta',medium:'Media',low:'Baja'})[s]||s||'—'}
export function statusPill(s){return `<span class="status-pill status-${esc(s)}">${statusLabel(s)}</span>`}
export function priorityPill(s){return `<span class="priority-pill priority-${esc(s)}">${priorityLabel(s)}</span>`}
export function isOverdue(t){return t.sla_due_at && new Date(t.sla_due_at)<new Date()&&!['resolved','closed','cancelled'].includes(t.status)}
export function toast(message,type='success'){
  let wrap=qs('.toast-wrap'); if(!wrap){wrap=document.createElement('div');wrap.className='toast-wrap';document.body.appendChild(wrap)}
  const el=document.createElement('div');el.className=`toast ${type}`;el.textContent=message;wrap.appendChild(el);setTimeout(()=>el.remove(),3200)
}
export function csvDownload(filename,rows){
  if(!rows.length)return;
  const cols=Object.keys(rows[0]);
  const csv=[cols.join(','),...rows.map(r=>cols.map(c=>`"${String(r[c]??'').replaceAll('"','""')}"`).join(','))].join('\n');
  const blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}); const url=URL.createObjectURL(blob); const a=document.createElement('a');a.href=url;a.download=filename;a.click();URL.revokeObjectURL(url)
}
