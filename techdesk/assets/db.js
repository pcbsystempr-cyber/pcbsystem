import { CONFIG } from './config.js';

const configured = CONFIG.supabaseUrl.includes('.supabase.co') && !CONFIG.supabaseUrl.includes('YOUR-PROJECT') && !CONFIG.supabaseAnonKey.includes('YOUR_');

export const DEMO_MODE = CONFIG.demoMode || !configured;
let supabaseClient = null;
if (configured && !DEMO_MODE) {
  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
  supabaseClient = createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
}
export const supabase = supabaseClient;

const DEMO_TICKETS_KEY = 'pcb_techdesk_demo_tickets_v2';
const DEMO_SESSION_KEY = 'pcb_techdesk_demo_session_v2';
const DEMO_TECHNICIANS_KEY = 'pcb_techdesk_demo_technicians_v2';

function nowISO(){ return new Date().toISOString(); }
function uid(){ return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`; }
function demoTicketNo(){
  const year = new Date().getFullYear();
  const current = JSON.parse(localStorage.getItem(DEMO_TICKETS_KEY) || '[]');
  return `PCB-${year}-${String(current.length + 1).padStart(5,'0')}`;
}
function priorityDue(priority){
  const h = { critical:4, high:24, medium:72, low:120 }[priority] || 72;
  return new Date(Date.now()+h*3600000).toISOString();
}

export async function createPublicTicket(payload){
  if (DEMO_MODE) {
    const ticket = {
      id: uid(), ticket_no: demoTicketNo(), tracking_token: uid(), status:'new',
      created_at: nowISO(), updated_at: nowISO(), sla_due_at: priorityDue(payload.priority),
      ...payload, assigned_to:null, assigned_name:null, diagnosis:null, resolution_summary:null,
      root_cause:null, minutes_spent:0, resolved_at:null, closed_at:null, evaluation_rating:null
    };
    const rows = JSON.parse(localStorage.getItem(DEMO_TICKETS_KEY) || '[]');
    rows.unshift(ticket); localStorage.setItem(DEMO_TICKETS_KEY, JSON.stringify(rows));
    return { ticket_id: ticket.id, ticket_no: ticket.ticket_no, tracking_token: ticket.tracking_token };
  }
  const { data, error } = await supabase.rpc('create_public_ticket', {
    p_requester_name: payload.requester_name,
    p_requester_email: payload.requester_email || null,
    p_department: payload.department,
    p_room: payload.room || null,
    p_category: payload.category,
    p_equipment_type: payload.equipment_type || null,
    p_brand_model: payload.brand_model || null,
    p_asset_tag: payload.asset_tag || null,
    p_serial_number: payload.serial_number || null,
    p_description: payload.description,
    p_priority: payload.priority,
    p_impact: payload.impact || null
  });
  if (error) throw error;
  const created = Array.isArray(data) ? data[0] : data;
  const { error: notificationError } = await supabase.functions.invoke('new-ticket-email', {
    body: { ticket_id: created.ticket_id, tracking_token: created.tracking_token }
  });
  if (notificationError) {
    console.error('No se pudo enviar la notificación de la boleta.', notificationError);
    created.email_warning = 'La boleta se guardó, pero no se pudo enviar la notificación por email.';
  }
  return created;
}

export async function registerPublicAttachment(ticketId, token, meta){
  if (DEMO_MODE) return true;
  const { error } = await supabase.rpc('register_public_attachment', {
    p_ticket_id: ticketId, p_tracking_token: token, p_storage_path: meta.path,
    p_file_name: meta.name, p_mime_type: meta.type || null, p_file_size: meta.size || null
  });
  if (error) throw error;
  return true;
}

export async function uploadPublicAttachment(ticketId, token, file){
  if (DEMO_MODE) return { path: `demo/${file.name}` };
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g,'_');
  const path = `${ticketId}/${token}/${uid()}-${safeName}`;
  const { error } = await supabase.storage.from('ticket-evidence').upload(path, file, { upsert:false });
  if (error) throw error;
  await registerPublicAttachment(ticketId, token, { path, name:file.name, type:file.type, size:file.size });
  return { path };
}

export async function trackPublicTicket(token){
  if (DEMO_MODE) {
    const rows = JSON.parse(localStorage.getItem(DEMO_TICKETS_KEY) || '[]');
    const t = rows.find(x => x.tracking_token === token || x.ticket_no.toLowerCase() === String(token).toLowerCase());
    if (!t) return null;
    return {
      ticket_no:t.ticket_no,status:t.status,priority:t.priority,category:t.category,room:t.room,
      created_at:t.created_at,updated_at:t.updated_at,resolution_summary:t.resolution_summary,
      assigned_name:t.assigned_name
    };
  }
  const { data, error } = await supabase.rpc('track_public_ticket', { p_tracking_token: token });
  if (error) throw error;
  return Array.isArray(data) ? (data[0] || null) : data;
}

export async function submitEvaluation(token, rating, comments, suggestions){
  if (DEMO_MODE) {
    const rows = JSON.parse(localStorage.getItem(DEMO_TICKETS_KEY) || '[]');
    const i = rows.findIndex(x => x.tracking_token === token || x.ticket_no.toLowerCase() === String(token).toLowerCase());
    if (i < 0) throw new Error('Boleta no encontrada.');
    rows[i].evaluation_rating = rating; rows[i].evaluation_comments = comments; rows[i].evaluation_suggestions = suggestions;
    localStorage.setItem(DEMO_TICKETS_KEY, JSON.stringify(rows)); return true;
  }
  const { error } = await supabase.rpc('submit_public_evaluation', {
    p_tracking_token: token, p_rating: rating, p_comments: comments || null, p_suggestions: suggestions || null
  });
  if (error) throw error;
  return true;
}

export async function signIn(email,password,roleHint='technician'){
  if (DEMO_MODE) {
    const profile = roleHint === 'admin'
      ? { id:'demo-admin', full_name:'Administrador Demo', role:'admin' }
      : { id:'tech-1', full_name:'Alex Rivera', role:'technician' };
    localStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(profile)); return profile;
  }
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  const profile = await getProfile(data.user.id);
  if(profile.role!==roleHint){
    await supabase.auth.signOut();
    throw new Error(roleHint==='admin'?'Estas credenciales no pertenecen a un administrador.':'Estas credenciales no pertenecen a un técnico.');
  }
  return profile;
}
export async function signOut(){
  if (DEMO_MODE) { localStorage.removeItem(DEMO_SESSION_KEY); return; }
  await supabase.auth.signOut();
}
export async function getSession(){
  if (DEMO_MODE) return JSON.parse(localStorage.getItem(DEMO_SESSION_KEY) || 'null');
  const { data } = await supabase.auth.getSession();
  if (!data.session) return null;
  return getProfile(data.session.user.id);
}
export async function getProfile(id){
  const { data, error } = await supabase.from('profiles').select('*').eq('id',id).single();
  if (error) throw error; return data;
}
export async function listTechnicians(){
  if (DEMO_MODE) {
    const session=JSON.parse(localStorage.getItem(DEMO_SESSION_KEY)||'null');
    if(session?.role!=='admin') throw new Error('Solo administración puede consultar la lista de técnicos.');
    const defaults=[
      {id:'tech-1', full_name:'Alex Rivera', role:'technician'},
      {id:'tech-2', full_name:'Sofía Cruz', role:'technician'},
      {id:'tech-3', full_name:'Diego López', role:'technician'}
    ];
    const saved=JSON.parse(localStorage.getItem(DEMO_TECHNICIANS_KEY)||'null');
    if(saved) return saved;
    localStorage.setItem(DEMO_TECHNICIANS_KEY,JSON.stringify(defaults));
    return defaults;
  }
  const { data,error } = await supabase.from('profiles').select('id,full_name,role').eq('role','technician').order('full_name');
  if(error) throw error; return data || [];
}

export async function createTechnician(payload){
  if(DEMO_MODE){
    const session=JSON.parse(localStorage.getItem(DEMO_SESSION_KEY)||'null');
    if(session?.role!=='admin') throw new Error('Solo administración puede añadir técnicos.');
    const rows=await listTechnicians();
    if(rows.some(x=>x.email?.toLowerCase()===payload.email.toLowerCase())) throw new Error('Ya existe una cuenta con ese correo.');
    const technician={id:uid(),full_name:payload.full_name.trim(),email:payload.email.trim().toLowerCase(),role:'technician'};
    rows.push(technician);localStorage.setItem(DEMO_TECHNICIANS_KEY,JSON.stringify(rows));return technician;
  }
  const {data,error}=await supabase.functions.invoke('create-technician',{body:payload});
  if(error||data?.error) throw new Error(data?.error||error?.message||'No se pudo crear el técnico.');
  return data.technician;
}

function seedDemoTickets(){
  const existing=JSON.parse(localStorage.getItem(DEMO_TICKETS_KEY)||'[]');
  if(existing.length) return existing;
  const now=Date.now();
  const hours=h=>new Date(now+h*3600000).toISOString();
  const days=d=>new Date(now+d*86400000).toISOString();
  const samples=[
    {category:'Computadora / Laptop',requester_name:'María Rivera',department:'Matemáticas',room:'Salón de clases',description:'La computadora no enciende.',priority:'critical',impact:'classroom',status:'in_progress',assigned_to:'tech-1',assigned_name:'Alex Rivera',sla_due_at:hours(-2),created_at:hours(-7)},
    {category:'Internet / Red',requester_name:'José Santiago',department:'Enfermería',room:'Taller ocupacional',description:'El Wi‑Fi está intermitente.',priority:'high',impact:'classroom',status:'assigned',assigned_to:'tech-2',assigned_name:'Sofía Cruz',sla_due_at:hours(4),created_at:hours(-5)},
    {category:'Impresora / Escáner',requester_name:'Ana López',department:'Administración',room:'Oficina administrativa',description:'La impresora no responde.',priority:'medium',impact:'single_user',status:'new',assigned_to:null,assigned_name:null,sla_due_at:hours(30),created_at:hours(-2)},
    {category:'Proyector / Pantalla',requester_name:'Luis Ortiz',department:'Ciencias',room:'Laboratorio de Ciencias',description:'El proyector indica sin señal.',priority:'high',impact:'classroom',status:'triage',assigned_to:null,assigned_name:null,sla_due_at:hours(-1),created_at:hours(-8)},
    {category:'Cuenta / Software',requester_name:'Carmen Díaz',department:'Biblioteca / Centro de Recursos',room:'Biblioteca / Centro de Recursos',description:'No puede iniciar sesión en Microsoft 365.',priority:'low',impact:'single_user',status:'resolved',assigned_to:'tech-3',assigned_name:'Diego López',sla_due_at:days(2),created_at:days(-1),resolved_at:hours(-3),resolution_summary:'Se restableció la contraseña y se verificó acceso.'},
    {category:'Computadora / Laptop',requester_name:'Pedro Cruz',department:'Educación Especial',room:'Salón de Educación Especial',description:'La laptop se congela al abrir aplicaciones.',priority:'medium',impact:'single_user',status:'awaiting_user',assigned_to:'tech-1',assigned_name:'Alex Rivera',sla_due_at:hours(18),created_at:days(-1)},
    {category:'Impresión 3D / Plotter',requester_name:'Laura Méndez',department:'COMPUTEC / Tecnología',room:'Laboratorio de COMPUTEC',description:'El filamento no extruye correctamente.',priority:'medium',impact:'single_user',status:'closed',assigned_to:'tech-3',assigned_name:'Diego López',sla_due_at:days(1),created_at:days(-2),resolved_at:days(-1),closed_at:hours(-12),resolution_summary:'Se limpió el nozzle y se calibró la extrusión.'},
    {category:'Periférico / Cable',requester_name:'Miguel Torres',department:'Español',room:'Salón de clases',description:'Cable HDMI no ofrece imagen.',priority:'low',impact:'single_user',status:'assigned',assigned_to:'tech-2',assigned_name:'Sofía Cruz',sla_due_at:days(3),created_at:hours(-12)}
  ].map((t,i)=>({id:`demo-ticket-${i+1}`,ticket_no:`PCB-${new Date().getFullYear()}-${String(i+1).padStart(5,'0')}`,tracking_token:uid(),updated_at:t.resolved_at||t.created_at,brand_model:null,asset_tag:null,serial_number:null,equipment_type:null,diagnosis:null,root_cause:null,minutes_spent:0,evaluation_rating:null,...t}));
  localStorage.setItem(DEMO_TICKETS_KEY,JSON.stringify(samples));
  return samples;
}

export async function listTickets(filters={}){
  if (DEMO_MODE) {
    let rows = seedDemoTickets();
    const session=JSON.parse(localStorage.getItem(DEMO_SESSION_KEY)||'null');
    if(session?.role==='technician') rows=rows.filter(x=>x.assigned_to===session.id);
    if (filters.status) rows = rows.filter(x=>x.status===filters.status);
    if (filters.assigned_to) rows = rows.filter(x=>x.assigned_to===filters.assigned_to);
    if (filters.search) {
      const q=filters.search.toLowerCase(); rows=rows.filter(x=>[x.ticket_no,x.requester_name,x.department,x.category,x.description].some(v=>String(v||'').toLowerCase().includes(q)));
    }
    return rows;
  }
  let q = supabase.from('tickets').select('*, assigned:profiles!tickets_assigned_to_fkey(id,full_name)');
  if(filters.status) q=q.eq('status',filters.status);
  if(filters.assigned_to) q=q.eq('assigned_to',filters.assigned_to);
  if(filters.search) q=q.or(`ticket_no.ilike.%${filters.search}%,requester_name.ilike.%${filters.search}%,department.ilike.%${filters.search}%,category.ilike.%${filters.search}%`);
  q=q.order('created_at',{ascending:false});
  const {data,error}=await q; if(error) throw error;
  return (data||[]).map(x=>({...x,assigned_name:x.assigned?.full_name||null}));
}
export async function listSolvedTickets(filters={}){
  const solved=['resolved','closed'];
  if(DEMO_MODE){
    let rows=seedDemoTickets().filter(x=>solved.includes(x.status));
    if(filters.status) rows=rows.filter(x=>x.status===filters.status);
    if(filters.search){
      const s=filters.search.toLowerCase();
      rows=rows.filter(x=>[x.ticket_no,x.requester_name,x.department,x.category,x.description].some(v=>String(v||'').toLowerCase().includes(s)));
    }
    return rows;
  }
  let q=supabase.from('tickets').select('*, assigned:profiles!tickets_assigned_to_fkey(id,full_name)').in('status',solved);
  if(filters.status) q=q.eq('status',filters.status);
  if(filters.search) q=q.or(`ticket_no.ilike.%${filters.search}%,requester_name.ilike.%${filters.search}%,department.ilike.%${filters.search}%,category.ilike.%${filters.search}%`);
  q=q.order('created_at',{ascending:false});
  const {data,error}=await q; if(error) throw error;
  return (data||[]).map(x=>({...x,assigned_name:x.assigned?.full_name||null}));
}
export async function getTicket(id){
  if(DEMO_MODE){
    const rows=JSON.parse(localStorage.getItem(DEMO_TICKETS_KEY)||'[]');
    const session=JSON.parse(localStorage.getItem(DEMO_SESSION_KEY)||'null');
    const ticket=rows.find(x=>x.id===id)||null;
    return ticket&&(session?.role==='admin'||ticket.assigned_to===session?.id)?ticket:null;
  }
  const {data,error}=await supabase.from('tickets').select('*, assigned:profiles!tickets_assigned_to_fkey(id,full_name), attachments:ticket_attachments(*), notes:ticket_notes(*), worklogs:ticket_worklogs(*)').eq('id',id).single();
  if(error) throw error; return {...data,assigned_name:data.assigned?.full_name||null};
}

export async function signedAttachmentUrl(path, expiresIn=600){
  if(DEMO_MODE || !path) return null;
  const {data,error}=await supabase.storage.from('ticket-evidence').createSignedUrl(path,expiresIn);
  if(error) throw error; return data?.signedUrl||null;
}
export async function updateTicket(id, patch){
  if(DEMO_MODE){
    const rows=JSON.parse(localStorage.getItem(DEMO_TICKETS_KEY)||'[]'); const i=rows.findIndex(x=>x.id===id); if(i<0) throw new Error('Boleta no encontrada');
    const session=JSON.parse(localStorage.getItem(DEMO_SESSION_KEY)||'null');
    if('assigned_to' in patch&&session?.role!=='admin') throw new Error('Solo administración puede asignar boletas.');
    if(patch.status==='closed'&&session?.role!=='admin') throw new Error('Solo administración puede cerrar boletas.');
    if(session?.role!=='admin'&&rows[i].assigned_to!==session?.id) throw new Error('Esta boleta no está asignada a tu cuenta.');
    rows[i]={...rows[i],...patch,updated_at:nowISO()}; localStorage.setItem(DEMO_TICKETS_KEY,JSON.stringify(rows)); return rows[i];
  }
  if(Object.keys(patch).length===1 && patch.status){
    const {data,error}=await supabase.rpc('set_ticket_status',{p_ticket_id:id,p_status:patch.status}); if(error) throw error; return data;
  }
  throw new Error('Actualización no permitida directamente. Usa una acción segura del sistema.');
}
export async function assignTicket(id, technicianId){
  if(DEMO_MODE){const tech=(await listTechnicians()).find(x=>x.id===technicianId);if(!tech)throw new Error('Técnico inválido.');return updateTicket(id,{assigned_to:technicianId,assigned_name:tech.full_name,status:'assigned'})}
  const {data,error}=await supabase.rpc('assign_ticket',{p_ticket_id:id,p_technician_id:technicianId}); if(error) throw error; return data;
}
export async function resolveTicket(id, payload){
  if(DEMO_MODE) return updateTicket(id,{...payload,status:'resolved',resolved_at:nowISO()});
  const {data,error}=await supabase.rpc('resolve_ticket',{
    p_ticket_id:id,p_diagnosis:payload.diagnosis,p_resolution_summary:payload.resolution_summary,
    p_root_cause:payload.root_cause||null,p_minutes_spent:Number(payload.minutes_spent||0),p_parts_used:payload.parts_used||null
  }); if(error) throw error; return data;
}
export async function closeTicket(id){
  if(DEMO_MODE) return updateTicket(id,{status:'closed',closed_at:nowISO()});
  const {data,error}=await supabase.rpc('close_ticket',{p_ticket_id:id}); if(error) throw error; return data;
}

export async function saveTicketSignoff(id, signerName, dataUrl){
  if(DEMO_MODE) return updateTicket(id,{requester_signoff_name:signerName,requester_signoff_at:nowISO(),closure_signature_path:dataUrl?'demo-signature.png':null});
  let path=null;
  if(dataUrl){
    const blob=await fetch(dataUrl).then(r=>r.blob());
    path=`${id}/signoff/${uid()}.png`;
    const {error:uploadError}=await supabase.storage.from('ticket-evidence').upload(path,blob,{contentType:'image/png',upsert:false});
    if(uploadError) throw uploadError;
  }
  const {data,error}=await supabase.rpc('set_ticket_signoff',{p_ticket_id:id,p_signer_name:signerName,p_signature_path:path});
  if(error) throw error; return data;
}
export async function addTicketNote(id, body, isPublic=false){
  if(DEMO_MODE) return true;
  const {error}=await supabase.from('ticket_notes').insert({ticket_id:id,body,is_public:isPublic}); if(error) throw error; return true;
}
export async function reportSummary(from,to){
  if(DEMO_MODE){
    const rows=await listTickets(); const a=from?new Date(from):new Date(0), b=to?new Date(`${to}T23:59:59`):new Date();
    const set=rows.filter(x=>{const d=new Date(x.created_at);return d>=a&&d<=b});
    const closed=set.filter(x=>['resolved','closed'].includes(x.status));
    const avg=closed.length?Math.round(closed.reduce((s,x)=>s+Number(x.minutes_spent||0),0)/closed.length):0;
    const ratings=closed.map(x=>x.evaluation_rating).filter(Boolean);
    return { total:set.length, open:set.filter(x=>!['resolved','closed','cancelled'].includes(x.status)).length, resolved:closed.length, overdue:set.filter(x=>new Date(x.sla_due_at)<new Date()&&!['resolved','closed','cancelled'].includes(x.status)).length, avg_minutes:avg, avg_rating:ratings.length?(ratings.reduce((a,b)=>a+b,0)/ratings.length).toFixed(1):null };
  }
  const {data,error}=await supabase.rpc('report_summary',{p_from:from,p_to:to}); if(error) throw error; return data;
}
export async function technicianStats(from,to){
  if(DEMO_MODE) return [
    {technician_name:'Técnico Demo',assigned:5,resolved:3,minutes_total:145,avg_rating:4.7},
    {technician_name:'Alex Rivera',assigned:8,resolved:6,minutes_total:310,avg_rating:4.5}
  ];
  const {data,error}=await supabase.rpc('technician_stats',{p_from:from,p_to:to}); if(error) throw error; return data||[];
}
export async function listTicketsForReport(from,to){
  const rows=await listTickets(); const a=from?new Date(from):new Date(0), b=to?new Date(`${to}T23:59:59`):new Date();
  return rows.filter(x=>{const d=new Date(x.created_at);return d>=a&&d<=b});
}
export function subscribeTickets(handler){
  if(DEMO_MODE || !supabase) return ()=>{};
  const ch=supabase.channel('pcb-techdesk-tickets').on('postgres_changes',{event:'*',schema:'public',table:'tickets'},handler).subscribe();
  return ()=>supabase.removeChannel(ch);
}
