import { CONFIG } from './config.js';
import { DEMO_MODE, createPublicTicket, uploadPublicAttachment, trackPublicTicket, submitEvaluation } from './db.js';
import { qs, esc, fmtDate, statusPill, priorityPill, toast } from './utils.js';

qs('#schoolName').textContent=CONFIG.schoolName;
qs('#deptName').textContent=CONFIG.departmentName;
if(DEMO_MODE) qs('#demoBanner')?.classList.remove('hidden');

const form=qs('#ticketForm');
const fileInput=qs('#evidence');
const drop=qs('#dropzone');
const fileList=qs('#fileList');
const category=qs('#category');
const issue=qs('#issue');
const department=qs('#department');
const departmentOther=qs('#departmentOther');
const room=qs('#room');
const roomOther=qs('#roomOther');
const roomDetail=qs('#roomDetail');
const equipmentType=qs('#equipmentType');
const staffSelect=qs('#staffSelect');
const requesterName=qs('#requesterName');
const otherStaffName=qs('#otherStaffName');
let files=[];

const ISSUE_MAP={
  'Computadora / Laptop':['No enciende','Está lenta o se congela','No inicia Windows / sistema','No puedo iniciar sesión','Pantalla o imagen con problema','Teclado, mouse o USB no funciona','Se apaga o reinicia','Otro'],
  'Internet / Red':['No tengo internet','Wi‑Fi no conecta','Internet lento o intermitente','Cable de red no funciona','No puedo acceder a una página o recurso','Otro'],
  'Impresora / Escáner':['No imprime','Atasco de papel','No aparece en la computadora','Imprime con mala calidad','Problema de tóner o tinta','Escáner no funciona','Otro'],
  'Proyector / Pantalla':['No proyecta / sin señal','No conecta por Wi‑Fi','Imagen cortada o fuera de tamaño','Pantalla no enciende','Audio no funciona','Mimio no conecta','Otro'],
  'Cuenta / Software':['No puedo entrar a mi cuenta','Olvidé / problema de contraseña','Programa no abre','Error al instalar o actualizar','Problema de licencia','Microsoft Store / aplicación no funciona','Otro'],
  'Periférico / Cable':['Teclado no funciona','Mouse no funciona','USB no reconoce','Cable HDMI / video no funciona','Cargador / adaptador no funciona','Otro'],
  'Impresión 3D / Plotter':['Impresora 3D no imprime','Filamento / extrusión','Modelo se despega de la base','Error de archivo / slicer','Plotter no corta / imprime','Laminadora no funciona','Otro'],
  'Otro':['Necesito diagnóstico','Equipo no identificado','Otro problema técnico']
};

const EQUIPMENT_MAP={
  'Computadora / Laptop':'Desktop PC',
  'Internet / Red':'Router / Access Point',
  'Impresora / Escáner':'Impresora',
  'Proyector / Pantalla':'Proyector',
  'Cuenta / Software':'',
  'Periférico / Cable':'Otro',
  'Impresión 3D / Plotter':'Impresora 3D',
  'Otro':''
};

function toggleOther(select,field,input){
  const show=select.value==='__other';
  field.classList.toggle('hidden',!show);
  input.required=show;
  if(!show) input.value='';
}

department?.addEventListener('change',()=>toggleOther(department,qs('#departmentOtherField'),departmentOther));
room?.addEventListener('change',()=>toggleOther(room,qs('#roomOtherField'),roomOther));

category?.addEventListener('change',()=>{
  const options=ISSUE_MAP[category.value]||[];
  issue.innerHTML=options.length?`<option value="">Selecciona lo que ocurre</option>${options.map(x=>`<option>${esc(x)}</option>`).join('')}`:'<option value="">Primero selecciona el tipo</option>';
  issue.disabled=!options.length;
  const inferred=EQUIPMENT_MAP[category.value];
  if(inferred!==undefined) equipmentType.value=inferred;
});

function renderFiles(){
  fileList.innerHTML=files.map((f,i)=>`<span class="file-chip">${esc(f.name)} · ${(f.size/1024/1024).toFixed(1)}MB <button type="button" data-rm="${i}" style="background:none;border:0;color:#b33e4b;cursor:pointer">×</button></span>`).join('');
}
function addFiles(list){
  for(const f of list){
    if(!f.type.startsWith('image/')) continue;
    if(f.size>8*1024*1024){toast(`${f.name}: excede 8MB`,'error');continue}
    if(files.length<5) files.push(f);
  }
  renderFiles();
}
fileInput?.addEventListener('change',e=>addFiles(e.target.files));
fileList?.addEventListener('click',e=>{const i=e.target.dataset.rm;if(i!==undefined){files.splice(Number(i),1);renderFiles()}});
['dragenter','dragover'].forEach(ev=>drop?.addEventListener(ev,e=>{e.preventDefault();drop.classList.add('drag')}));
['dragleave','drop'].forEach(ev=>drop?.addEventListener(ev,e=>{e.preventDefault();drop.classList.remove('drag')}));
drop?.addEventListener('drop',e=>addFiles(e.dataTransfer.files));
drop?.addEventListener('click',()=>fileInput.click());

function finalValue(select,other){return select.value==='__other'?other.value.trim():select.value.trim()}
function buildDescription(){
  const issueText=issue.value.trim();
  const detail=qs('#details').value.trim();
  return detail?`${issueText}. ${detail}`:issueText;
}

form?.addEventListener('submit',async e=>{
  e.preventDefault();
  const submit=qs('#submitTicket');
  qs('#submitNotice').classList.add('hidden');
  toggleOther(department,qs('#departmentOtherField'),departmentOther);
  toggleOther(room,qs('#roomOtherField'),roomOther);
  if(staffSelect?.value==='__other_staff' && otherStaffName) requesterName.value=otherStaffName.value.trim();
  if(!requesterName.value.trim()){
    if(staffSelect?.value==='__other_staff' && otherStaffName){otherStaffName.setCustomValidity('Escribe tu nombre y apellido.');otherStaffName.reportValidity();otherStaffName.setCustomValidity('')}
    else if(staffSelect){staffSelect.setCustomValidity('Selecciona tu nombre o escoge Otro personal escolar.');staffSelect.reportValidity();staffSelect.setCustomValidity('')}
    return;
  }
  if(!form.checkValidity()){form.reportValidity();return}
  if(!issue.value){issue.setCustomValidity('Selecciona lo que ocurre.');issue.reportValidity();issue.setCustomValidity('');return}

  submit.disabled=true;submit.textContent='Enviando boleta…';
  const fd=new FormData(form);
  const payload=Object.fromEntries(fd.entries());
  payload.department=finalValue(department,departmentOther);
  const baseRoom=finalValue(room,roomOther);
  payload.room=room.value==='__other'?baseRoom:[baseRoom,roomDetail.value.trim()].filter(Boolean).join(' · ');
  payload.description=buildDescription();
  payload.category=category.value;
  payload.priority=qs('#priority').value;
  payload.impact=qs('#impact').value;

  try{
    const created=await createPublicTicket(payload);
    for(const f of files) await uploadPublicAttachment(created.ticket_id,created.tracking_token,f);
    qs('#successTicketNo').textContent=created.ticket_no;
    qs('#successTracking').value=created.ticket_no;
    qs('#successBox').classList.remove('hidden');
    form.reset();files=[];renderFiles();
    window.PCBStaffUI?.reset();
    issue.innerHTML='<option value="">Primero selecciona el tipo</option>';issue.disabled=true;
    qs('#departmentOtherField').classList.add('hidden');qs('#roomOtherField').classList.add('hidden');
    toast(created.email_warning || 'Boleta creada y notificación enviada', created.email_warning ? 'error' : undefined);
    qs('#successBox').scrollIntoView({behavior:'smooth',block:'center'});
  }catch(err){
    qs('#submitNotice').textContent=err.message||'No se pudo crear la boleta.';
    qs('#submitNotice').classList.remove('hidden');
  }finally{
    submit.disabled=false;submit.textContent='Enviar boleta de servicio';
  }
});

qs('#copyTracking')?.addEventListener('click',async()=>{
  const value=qs('#successTracking').value;
  const button=qs('#copyTracking');
  const confirmCopy=()=>{
    button.textContent='Copiado';
    toast('Copiado');
    setTimeout(()=>{button.textContent='Copiar código'},1800);
  };
  try{await navigator.clipboard.writeText(value);confirmCopy()}catch{qs('#successTracking').select();document.execCommand('copy');confirmCopy()}
});

async function doTrack(token){
  if(!token)return;
  const box=qs('#trackResult');
  box.innerHTML='<div class="notice info">Buscando boleta…</div>';
  try{
    const t=await trackPublicTicket(token);
    if(!t){box.innerHTML='<div class="notice error">No encontramos esa boleta. Verifica el código.</div>';return}
    box.innerHTML=`<div class="card tracking-result"><div style="display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap"><div><div class="eyebrow">${esc(t.ticket_no)}</div><h3 style="margin:12px 0 5px">${esc(t.category||'Servicio técnico')}</h3><div style="color:var(--muted);font-size:11px">Creada ${fmtDate(t.created_at)}</div></div><div style="display:flex;gap:7px;flex-wrap:wrap">${statusPill(t.status)}${priorityPill(t.priority)}</div></div><div class="detail-grid" style="margin-top:15px"><div class="detail-box"><span>Técnico asignado</span><strong>${esc(t.assigned_name||'Aún no asignado')}</strong></div><div class="detail-box"><span>Ubicación</span><strong>${esc(t.room||'No indicada')}</strong></div><div class="detail-box detail-full"><span>Última actualización</span><strong>${fmtDate(t.updated_at)}</strong></div>${t.resolution_summary?`<div class="detail-box detail-full"><span>Solución / cierre</span><strong>${esc(t.resolution_summary)}</strong></div>`:''}</div>${['resolved','closed'].includes(t.status)?`<div class="drawer-section"><h3>Evalúa el servicio</h3><div class="form-grid"><div class="field"><label>Calificación</label><select id="publicRating"><option value="5">★★★★★ Excelente</option><option value="4">★★★★ Muy bueno</option><option value="3">★★★ Bueno</option><option value="2">★★ Regular</option><option value="1">★ Necesita mejorar</option></select></div><div class="field"><label>Comentario</label><input id="publicComment" placeholder="Opcional"></div><div class="field full"><label>Sugerencia</label><input id="publicSuggestion" placeholder="Opcional"></div></div><div class="form-actions"><button class="btn btn-success" id="sendEvaluation">Enviar evaluación</button></div></div>`:''}</div>`;
    qs('#sendEvaluation')?.addEventListener('click',async()=>{try{await submitEvaluation(token,Number(qs('#publicRating').value),qs('#publicComment').value,qs('#publicSuggestion').value);toast('Gracias por evaluar el servicio')}catch(err){toast(err.message,'error')}});
  }catch(err){box.innerHTML=`<div class="notice error">${esc(err.message||'Error al buscar la boleta.')}</div>`}
}
qs('#trackBtn')?.addEventListener('click',()=>doTrack(qs('#trackInput').value.trim()));
qs('#trackInput')?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();qs('#trackBtn').click()}});
const urlToken=new URLSearchParams(location.search).get('track');if(urlToken){qs('#trackInput').value=urlToken;doTrack(urlToken)}
