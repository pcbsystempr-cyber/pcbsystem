import { CONFIG } from './config.js';
import { DEMO_MODE, getSession, signOut, listTickets, listSolvedTickets, listTechnicians, createTechnician, getTicket, signedAttachmentUrl, updateTicket, assignTicket, resolveTicket, closeTicket, saveTicketSignoff, addTicketNote, subscribeTickets } from './db.js';
import { qs, qsa, esc, fmtDate, statusPill, priorityPill, statusLabel, isOverdue, toast } from './utils.js';

let profile=null,tickets=[],technicians=[],currentId=null;

async function boot(){
  if(DEMO_MODE) qs('#demoBanner')?.classList.remove('hidden');
  profile=await getSession(); if(!profile){location.href='login.html';return}
  qs('#userName').textContent=profile.full_name||'Usuario';
  qs('#userRole').textContent=profile.role==='admin'?'Administrador':'Técnico';
  qs('#dashboardTitle').textContent=profile.role==='admin'?'Panel administrativo':'Panel del técnico';
  qs('#dashboardSubtitle').textContent=profile.role==='admin'?'Asigna boletas y supervisa todo el servicio técnico':'Consulta y resuelve las boletas que te fueron asignadas';
  qs('#ticketsTitle').textContent=profile.role==='admin'?'Todas las boletas':'Mis boletas asignadas';
  qs('#ticketsSubtitle').textContent=profile.role==='admin'?'Busca, filtra y asigna las solicitudes del servicio.':'Tus boletas asignadas y todas las boletas resueltas.';
  const initials=(profile.full_name||'PCB').split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase();
  qs('#userAvatar').textContent=initials||'PCB';
  if(profile.role!=='admin') qsa('[data-admin-only]').forEach(x=>x.classList.add('hidden'));
  technicians=profile.role==='admin'?await listTechnicians():[{id:profile.id,full_name:profile.full_name||'Técnico',role:'technician'}];
  setupHandlers(); await refresh(); subscribeTickets(()=>refresh());
}

function setupHandlers(){
  qs('#logoutBtn').onclick=async()=>{await signOut();location.href='login.html'};
  qs('#searchInput').addEventListener('input',debounce(refresh,250));
  qs('#statusFilter').onchange=refresh;
  qs('#priorityFilter').onchange=render;
  qs('#ticketBody').addEventListener('click',e=>{const tr=e.target.closest('tr[data-id]');if(tr)openTicket(tr.dataset.id)});
  qs('#criticalList')?.addEventListener('click',e=>{const row=e.target.closest('[data-ticket-id]');if(row)openTicket(row.dataset.ticketId)});
  qs('#recentList')?.addEventListener('click',e=>{const row=e.target.closest('[data-ticket-id]');if(row)openTicket(row.dataset.ticketId)});
  qs('#drawerBackdrop').onclick=closeDrawer;qs('#drawerClose').onclick=closeDrawer;
  qs('#drawerBody').addEventListener('click',drawerAction);
  qs('#drawerBody').addEventListener('change',drawerChange);
  qs('#addTechnicianBtn')?.addEventListener('click',()=>qs('#technicianDialog').showModal());
  qs('#cancelTechnician')?.addEventListener('click',()=>qs('#technicianDialog').close());
  qs('#technicianForm')?.addEventListener('submit',submitTechnician);
}

async function submitTechnician(e){
  e.preventDefault();const button=qs('#saveTechnician');const notice=qs('#technicianNotice');
  notice.classList.add('hidden');button.disabled=true;button.textContent='Creando…';
  try{
    await createTechnician({full_name:qs('#technicianName').value.trim(),email:qs('#technicianEmail').value.trim(),password:qs('#technicianPassword').value});
    technicians=await listTechnicians();e.target.reset();qs('#technicianDialog').close();render();toast('Técnico añadido al menú de asignación');
  }catch(err){notice.textContent=err.message||'No se pudo crear el técnico.';notice.classList.remove('hidden')}
  finally{button.disabled=false;button.textContent='Crear técnico'}
}

async function refresh(){
  const search=qs('#searchInput').value.trim();const status=qs('#statusFilter').value;
  if(profile.role==='technician'){
    const mine=await listTickets({search,status:status||undefined,assigned_to:profile.id});
    let solved=await listSolvedTickets({search}); if(status) solved=solved.filter(t=>t.status===status);
    const byId=new Map(mine.map(t=>[t.id,t])); solved.forEach(t=>byId.set(t.id,t));
    tickets=[...byId.values()];
  } else {
    tickets=await listTickets({search,status:status||undefined});
  }
  render(); if(currentId) openTicket(currentId,false);
}

function startOfToday(){const d=new Date();d.setHours(0,0,0,0);return d}
function endOfToday(){const d=new Date();d.setHours(23,59,59,999);return d}
function categoryBucket(category=''){
  const c=category.toLowerCase();
  if(c.includes('comput')||c.includes('laptop'))return'computer';
  if(c.includes('internet')||c.includes('red')||c.includes('wifi'))return'network';
  if(c.includes('impresora')||c.includes('escáner')||c.includes('escan'))return'printer';
  if(c.includes('proyector')||c.includes('pantalla')||c.includes('mimio'))return'display';
  return'other';
}
function setRing(id,count,total){const el=qs(id);if(!el)return;const pct=total?Math.max(8,Math.round(count/total*100)):0;el.style.setProperty('--pct',pct)}
function initials(name='T'){return name.split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase()||'T'}
function compactRow(t){
  const overdue=isOverdue(t);
  return `<div class="compact-row" data-ticket-id="${t.id}"><div><div class="compact-title">${esc(t.category||'Servicio técnico')}</div><div class="compact-sub">${esc(t.requester_name||'')} · ${esc(t.department||'')} · ${esc(t.room||'Sin ubicación')}</div></div><div class="compact-meta">${priorityPill(t.priority)}<span class="mini-sla ${overdue?'overdue':''}">${overdue?'Vencida':t.sla_due_at?fmtDate(t.sla_due_at):'—'}</span></div></div>`;
}

function renderDashboard(rows){
  const open=rows.filter(x=>!['resolved','closed','cancelled'].includes(x.status));
  const pending=open.filter(x=>['new','triage','assigned'].includes(x.status));
  const overdue=open.filter(isOverdue);
  const today0=startOfToday(),today1=endOfToday();
  const dueToday=open.filter(x=>x.sla_due_at&&new Date(x.sla_due_at)>=today0&&new Date(x.sla_due_at)<=today1&&!isOverdue(x));
  const critical=open.filter(x=>x.priority==='critical');
  const warnings=open.filter(x=>x.priority==='high');
  const resolved=rows.filter(x=>['resolved','closed'].includes(x.status));

  qs('#stripOpen').textContent=open.length;qs('#stripPending').textContent=pending.length;qs('#stripDueToday').textContent=dueToday.length;qs('#stripOverdue').textContent=overdue.length;
  qs('#stripWarning').textContent=warnings.length;qs('#stripCritical').textContent=critical.length;
  const rate=rows.length?Math.round(resolved.length/rows.length*100):0;
  qs('#serviceRate').textContent=`${rate}%`;qs('#serviceRateBar').style.width=`${rate}%`;qs('#serviceRateText').textContent=`${resolved.length} de ${rows.length} resueltas`;

  const buckets={computer:0,network:0,printer:0,display:0};
  open.forEach(t=>{const b=categoryBucket(t.category);if(buckets[b]!==undefined)buckets[b]++});
  qs('#ringComputerCount').textContent=buckets.computer;qs('#ringNetworkCount').textContent=buckets.network;qs('#ringPrinterCount').textContent=buckets.printer;qs('#ringDisplayCount').textContent=buckets.display;
  const totalBucket=Math.max(1,buckets.computer+buckets.network+buckets.printer+buckets.display);
  setRing('#ringComputer',buckets.computer,totalBucket);setRing('#ringNetwork',buckets.network,totalBucket);setRing('#ringPrinter',buckets.printer,totalBucket);setRing('#ringDisplay',buckets.display,totalBucket);

  const alertRows=[...rows].filter(t=>isOverdue(t)||t.priority==='critical').sort((a,b)=>Number(isOverdue(b))-Number(isOverdue(a))||new Date(a.sla_due_at||a.created_at)-new Date(b.sla_due_at||b.created_at)).slice(0,5);
  qs('#criticalList').innerHTML=alertRows.length?alertRows.map(compactRow).join(''):'<div class="empty" style="padding:18px">No hay boletas críticas o atrasadas.</div>';

  const recent=[...rows].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)).slice(0,5);
  qs('#recentList').innerHTML=recent.length?recent.map(t=>`<div class="compact-row" data-ticket-id="${t.id}"><div><div class="compact-title">${esc(t.ticket_no)} · ${esc(t.category||'Servicio técnico')}</div><div class="compact-sub">${esc(t.requester_name||'')} · ${fmtDate(t.created_at)}</div></div><div class="compact-meta">${statusPill(t.status)}</div></div>`).join(''):'<div class="empty" style="padding:18px">Sin solicitudes recientes.</div>';

  const techRows=technicians.map(tech=>{
    const load=open.filter(t=>t.assigned_to===tech.id).length;
    const cls=load>=5?'heavy':load>=3?'busy':'';
    return `<div class="tech-row"><div class="tech-avatar">${esc(initials(tech.full_name))}</div><div><div class="tech-name">${esc(tech.full_name)}</div><div class="tech-sub">${load?`${load} boleta${load===1?'':'s'} activa${load===1?'':'s'}`:'Disponible'}</div></div><span class="load-badge ${cls}">${load?load:'Libre'}</span></div>`;
  });
  qs('#technicianLoad').innerHTML=techRows.length?techRows.join(''):'<div class="empty" style="padding:18px">Sin técnicos disponibles.</div>';
}

function render(){
  let rows=[...tickets];const p=qs('#priorityFilter').value;if(p)rows=rows.filter(x=>x.priority===p);
  renderDashboard(rows);
  qs('#ticketBody').innerHTML=rows.length?rows.map(t=>`<tr data-id="${t.id}"><td><div class="ticket-title">${esc(t.ticket_no)}</div><div class="ticket-sub">${esc(t.category||'')}</div></td><td><div class="ticket-title">${esc(t.requester_name||'')}</div><div class="ticket-sub">${esc(t.department||'')} · ${esc(t.room||'Sin salón')}</div></td><td>${priorityPill(t.priority)}</td><td>${statusPill(t.status)}</td><td>${esc(t.assigned_name||'Sin asignar')}</td><td><div class="sla ${isOverdue(t)?'overdue':'ok'}">${t.sla_due_at?fmtDate(t.sla_due_at):'—'}</div></td><td>${fmtDate(t.created_at)}</td></tr>`).join(''):`<tr><td colspan="7"><div class="empty">No hay boletas que coincidan con los filtros.</div></td></tr>`;
}

async function openTicket(id,animate=true){
  currentId=id;const t=await getTicket(id);if(!t)return;
  const assignedName=t.assigned_name||t.assigned?.full_name||'Sin asignar';
  const techOptions=technicians.map(x=>`<option value="${x.id}" ${t.assigned_to===x.id?'selected':''}>${esc(x.full_name)}</option>`).join('');
  const notes=(t.notes||[]).slice().sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
  const worklogs=(t.worklogs||[]).slice().sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
  const attachmentLinks=await Promise.all((t.attachments||[]).map(async a=>({ ...a, url: await signedAttachmentUrl(a.storage_path).catch(()=>null) })));
  qs('#drawerBody').innerHTML=`
    <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap"><div><span class="eyebrow">${esc(t.ticket_no)}</span><h2 style="margin:12px 0 5px;font-size:22px">${esc(t.category||'Servicio técnico')}</h2><div style="font-size:11px;color:var(--muted)">${fmtDate(t.created_at)}</div></div><div style="display:flex;gap:7px;flex-wrap:wrap">${statusPill(t.status)}${priorityPill(t.priority)}</div></div>
    <div class="detail-grid" style="margin-top:18px"><div class="detail-box"><span>Solicitante</span><strong>${esc(t.requester_name)}</strong></div><div class="detail-box"><span>Departamento</span><strong>${esc(t.department)}</strong></div><div class="detail-box"><span>Ubicación</span><strong>${esc(t.room||'—')}</strong></div><div class="detail-box"><span>Técnico</span><strong>${esc(assignedName)}</strong></div><div class="detail-box"><span>Equipo</span><strong>${esc(t.equipment_type||'—')}</strong></div><div class="detail-box"><span>Marca / Modelo</span><strong>${esc(t.brand_model||'—')}</strong></div><div class="detail-box"><span>Inventario</span><strong>${esc(t.asset_tag||'—')}</strong></div><div class="detail-box"><span>Serie</span><strong>${esc(t.serial_number||'—')}</strong></div><div class="detail-box detail-full"><span>Problema reportado</span><strong>${esc(t.description||'—')}</strong></div></div>
    ${attachmentLinks.length?`<div class="drawer-section"><h3>Evidencia adjunta</h3><div class="action-grid">${attachmentLinks.map(a=>a.url?`<a class="btn btn-secondary btn-sm" href="${esc(a.url)}" target="_blank" rel="noopener">📎 ${esc(a.file_name)}</a>`:`<span class="file-chip">${esc(a.file_name)}</span>`).join('')}</div></div>`:''}
    <div class="drawer-section"><h3>Acciones</h3><div class="action-grid">
      ${profile.role==='admin'?`<select id="assignSelect" class="btn btn-secondary" style="appearance:auto"><option value="">Asignar técnico…</option>${techOptions}</select>`:''}
      ${!['resolved','closed','cancelled'].includes(t.status)?`<button class="btn btn-secondary btn-sm" data-action="status" data-status="in_progress">Iniciar trabajo</button><button class="btn btn-secondary btn-sm" data-action="status" data-status="awaiting_user">Esperando usuario</button><button class="btn btn-secondary btn-sm" data-action="status" data-status="awaiting_parts">Esperando pieza</button>`:''}
      ${profile.role==='admin'&&t.status==='resolved'?`<button class="btn btn-success btn-sm" data-action="close">Cerrar boleta</button>`:''}
    </div></div>
    ${!['resolved','closed','cancelled'].includes(t.status)?`<div class="drawer-section"><h3>Documentar solución</h3><form id="resolutionForm" class="resolution-form"><div class="field full"><label>Diagnóstico *</label><textarea id="diagnosis" required placeholder="Qué se encontró durante el diagnóstico">${esc(t.diagnosis||'')}</textarea></div><div class="field full"><label>Solución implementada *</label><textarea id="resolution" required placeholder="Qué se hizo para resolver el problema">${esc(t.resolution_summary||'')}</textarea></div><div class="field"><label>Causa raíz</label><input id="rootCause" value="${esc(t.root_cause||'')}" placeholder="Opcional"></div><div class="field"><label>Minutos invertidos</label><input id="minutes" type="number" min="0" value="${Number(t.minutes_spent||0)}"></div><div class="field full"><label>Piezas / materiales</label><input id="partsUsed" placeholder="Ej. cable HDMI, filamento, teclado…"></div><div class="field full"><button class="btn btn-primary" type="submit">Resolver boleta</button></div></form></div>`:''}
    ${['resolved','closed'].includes(t.status)?`<div class="drawer-section"><h3>Conformidad del servicio</h3>${t.requester_signoff_name?`<div class="notice success"><strong>Conformidad registrada por:</strong> ${esc(t.requester_signoff_name)}<br><span style="color:var(--muted)">${fmtDate(t.requester_signoff_at)}</span></div>`:t.status==='resolved'?`<div class="field"><label>Nombre del maestro / personal que recibe</label><input id="signoffName" placeholder="Nombre completo"></div><div style="margin-top:10px"><canvas id="signoffCanvas" width="560" height="150" style="width:100%;height:150px;background:#fff;border-radius:12px;touch-action:none"></canvas></div><div class="action-grid" style="margin-top:8px"><button class="btn btn-secondary btn-sm" type="button" id="clearSignoff">Borrar firma</button><button class="btn btn-success btn-sm" type="button" id="saveSignoff">Guardar conformidad</button></div>`:''}</div>`:''}
    ${t.resolution_summary?`<div class="drawer-section"><h3>Resolución registrada</h3><div class="notice success"><strong>Diagnóstico:</strong> ${esc(t.diagnosis||'—')}<br><br><strong>Solución:</strong> ${esc(t.resolution_summary)}${t.root_cause?`<br><br><strong>Causa raíz:</strong> ${esc(t.root_cause)}`:''}</div></div>`:''}
    <div class="drawer-section"><h3>Notas internas</h3><div class="field"><textarea id="noteBody" placeholder="Añadir seguimiento, llamada, observación o dato técnico…"></textarea></div><div class="form-actions"><button class="btn btn-secondary btn-sm" data-action="note">Guardar nota</button></div><div class="timeline" style="margin-top:10px">${notes.length?notes.map(n=>`<div class="timeline-item"><strong>Nota</strong><p>${esc(n.body)} · ${fmtDate(n.created_at)}</p></div>`).join(''):'<div class="hint">Aún no hay notas.</div>'}${worklogs.map(w=>`<div class="timeline-item"><strong>${esc(w.action_type||'Trabajo')}</strong><p>${esc(w.description||'')} ${w.minutes_spent?`· ${w.minutes_spent} min`:''}</p></div>`).join('')}</div></div>`;
  qs('#drawerTitle').textContent=t.ticket_no;qs('#drawerBackdrop').classList.add('show');qs('#ticketDrawer').classList.add('show');
  qs('#resolutionForm')?.addEventListener('submit',async e=>{e.preventDefault();try{await resolveTicket(t.id,{diagnosis:qs('#diagnosis').value,resolution_summary:qs('#resolution').value,root_cause:qs('#rootCause').value,minutes_spent:qs('#minutes').value,parts_used:qs('#partsUsed').value});toast('Boleta marcada como resuelta');await refresh()}catch(err){toast(err.message,'error')}})
  setupSignoffPad(t);
}

function setupSignoffPad(t){
  const canvas=qs('#signoffCanvas'); if(!canvas)return;
  const ctx=canvas.getContext('2d');ctx.lineWidth=2.2;ctx.lineCap='round';ctx.strokeStyle='#0b1727';let drawing=false,last=null,dirty=false;
  function point(e){const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)*(canvas.width/r.width),y:(e.clientY-r.top)*(canvas.height/r.height)}}
  canvas.addEventListener('pointerdown',e=>{drawing=true;last=point(e);canvas.setPointerCapture(e.pointerId)});
  canvas.addEventListener('pointermove',e=>{if(!drawing)return;const p=point(e);ctx.beginPath();ctx.moveTo(last.x,last.y);ctx.lineTo(p.x,p.y);ctx.stroke();last=p;dirty=true});
  canvas.addEventListener('pointerup',()=>drawing=false);canvas.addEventListener('pointercancel',()=>drawing=false);
  qs('#clearSignoff')?.addEventListener('click',()=>{ctx.clearRect(0,0,canvas.width,canvas.height);dirty=false});
  qs('#saveSignoff')?.addEventListener('click',async()=>{const name=qs('#signoffName').value.trim();if(name.length<2){toast('Escribe el nombre de quien recibe el servicio','error');return}try{await saveTicketSignoff(t.id,name,dirty?canvas.toDataURL('image/png'):null);toast('Conformidad guardada');await refresh()}catch(err){toast(err.message,'error')}});
}

function closeDrawer(){currentId=null;qs('#drawerBackdrop').classList.remove('show');qs('#ticketDrawer').classList.remove('show')}
async function drawerAction(e){
  const b=e.target.closest('[data-action]');if(!b||!currentId)return;try{
    if(b.dataset.action==='status'){await updateTicket(currentId,{status:b.dataset.status});toast(`Estado: ${statusLabel(b.dataset.status)}`)}
    if(b.dataset.action==='close'){await closeTicket(currentId);toast('Boleta cerrada')}
    if(b.dataset.action==='note'){const body=qs('#noteBody').value.trim();if(body){await addTicketNote(currentId,body,false);toast('Nota guardada')}}
    await refresh();
  }catch(err){toast(err.message||'No se pudo completar la acción','error')}
}
async function drawerChange(e){if(e.target.id==='assignSelect'&&e.target.value&&currentId){try{await assignTicket(currentId,e.target.value);toast('Técnico asignado');await refresh()}catch(err){toast(err.message,'error')}}}
function debounce(fn,wait){let t;return(...a)=>{clearTimeout(t);t=setTimeout(()=>fn(...a),wait)}}
boot().catch(err=>{console.error(err);toast(err.message||'Error cargando el panel','error')});
