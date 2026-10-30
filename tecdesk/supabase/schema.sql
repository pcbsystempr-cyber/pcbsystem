-- PCB TechDesk 2.2
-- Esquema nuevo e independiente para Supabase/PostgreSQL.
-- Ejecutar en un proyecto NUEVO de Supabase bajo control de la escuela/administrador.

create extension if not exists pgcrypto;

create sequence if not exists public.ticket_number_seq start 1;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default 'Usuario',
  role text not null default 'technician' check (role in ('admin','technician')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  ticket_no text not null unique,
  tracking_token uuid not null default gen_random_uuid() unique,
  requester_name text not null,
  requester_email text,
  department text not null,
  room text,
  category text not null,
  equipment_type text,
  brand_model text,
  asset_tag text,
  serial_number text,
  description text not null,
  priority text not null default 'medium' check (priority in ('low','medium','high','critical')),
  impact text default 'single_user' check (impact in ('single_user','classroom','department','school_wide')),
  status text not null default 'new' check (status in ('new','triage','assigned','in_progress','awaiting_user','awaiting_parts','resolved','closed','cancelled')),
  assigned_to uuid references public.profiles(id) on delete set null,
  diagnosis text,
  resolution_summary text,
  root_cause text,
  parts_used text,
  minutes_spent integer not null default 0 check (minutes_spent >= 0),
  requester_signoff_name text,
  requester_signoff_at timestamptz,
  closure_signature_path text,
  sla_due_at timestamptz,
  first_response_at timestamptz,
  resolved_at timestamptz,
  closed_at timestamptz,
  closed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ticket_attachments (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  storage_path text not null unique,
  file_name text not null,
  mime_type text,
  file_size bigint,
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.ticket_notes (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  body text not null,
  is_public boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists public.ticket_worklogs (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  action_type text not null default 'work',
  description text not null,
  minutes_spent integer not null default 0 check (minutes_spent >= 0),
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists public.ticket_status_history (
  id bigserial primary key,
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  old_status text,
  new_status text not null,
  changed_by uuid references public.profiles(id) on delete set null,
  changed_at timestamptz not null default now()
);

create table if not exists public.service_evaluations (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null unique references public.tickets(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comments text,
  suggestions text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.daily_report_snapshots (
  report_date date primary key,
  total_tickets integer not null default 0,
  open_tickets integer not null default 0,
  resolved_tickets integer not null default 0,
  overdue_tickets integer not null default 0,
  avg_resolution_minutes numeric(10,2),
  avg_rating numeric(4,2),
  generated_at timestamptz not null default now()
);

create index if not exists idx_tickets_status on public.tickets(status);
create index if not exists idx_tickets_priority on public.tickets(priority);
create index if not exists idx_tickets_assigned_to on public.tickets(assigned_to);
create index if not exists idx_tickets_created_at on public.tickets(created_at desc);
create index if not exists idx_tickets_sla_due_at on public.tickets(sla_due_at);
create index if not exists idx_ticket_notes_ticket on public.ticket_notes(ticket_id, created_at desc);
create index if not exists idx_worklogs_ticket on public.ticket_worklogs(ticket_id, created_at desc);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create or replace function public.new_ticket_number()
returns text language sql volatile as $$
  select 'PCB-' || extract(year from now())::int || '-' || lpad(nextval('public.ticket_number_seq')::text, 5, '0');
$$;

create or replace function public.compute_sla_due(p_priority text)
returns timestamptz language sql stable as $$
  select now() + case p_priority
    when 'critical' then interval '4 hours'
    when 'high' then interval '24 hours'
    when 'medium' then interval '72 hours'
    else interval '120 hours'
  end;
$$;

create or replace function public.set_ticket_defaults()
returns trigger language plpgsql as $$
begin
  if new.ticket_no is null or new.ticket_no = '' then new.ticket_no = public.new_ticket_number(); end if;
  if new.sla_due_at is null then new.sla_due_at = public.compute_sla_due(new.priority); end if;
  return new;
end; $$;

create or replace function public.log_ticket_status_change()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if old.status is distinct from new.status then
    insert into public.ticket_status_history(ticket_id,old_status,new_status,changed_by)
    values(new.id,old.status,new.status,auth.uid());
    if new.status in ('assigned','in_progress') and new.first_response_at is null then new.first_response_at = now(); end if;
    if new.status = 'resolved' and new.resolved_at is null then new.resolved_at = now(); end if;
    if new.status = 'closed' and new.closed_at is null then new.closed_at = now(); end if;
  end if;
  return new;
end; $$;

drop trigger if exists trg_ticket_defaults on public.tickets;
create trigger trg_ticket_defaults before insert on public.tickets for each row execute function public.set_ticket_defaults();
drop trigger if exists trg_ticket_status on public.tickets;
create trigger trg_ticket_status before update on public.tickets for each row execute function public.log_ticket_status_change();
drop trigger if exists trg_tickets_touch on public.tickets;
create trigger trg_tickets_touch before update on public.tickets for each row execute function public.touch_updated_at();
drop trigger if exists trg_profiles_touch on public.profiles;
create trigger trg_profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
drop trigger if exists trg_evaluations_touch on public.service_evaluations;
create trigger trg_evaluations_touch before update on public.service_evaluations for each row execute function public.touch_updated_at();

-- Crea el perfil automáticamente. El rol NO se toma de metadata para evitar auto-elevar permisos.
create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  insert into public.profiles(id,full_name,role)
  values(new.id,coalesce(new.raw_user_meta_data->>'full_name',split_part(new.email,'@',1)),'technician')
  on conflict(id) do nothing;
  return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_auth_user();

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin' and p.active=true);
$$;

create or replace function public.valid_public_evidence_path(p_name text)
returns boolean language sql stable security definer set search_path=public,storage,pg_temp as $$
  select exists(
    select 1 from public.tickets t
    where t.id::text=(storage.foldername(p_name))[1]
      and t.tracking_token::text=(storage.foldername(p_name))[2]
  );
$$;

-- API pública segura: crea la boleta sin dar INSERT directo a anon sobre la tabla.
create or replace function public.create_public_ticket(
  p_requester_name text,p_requester_email text,p_department text,p_room text,p_category text,
  p_equipment_type text,p_brand_model text,p_asset_tag text,p_serial_number text,
  p_description text,p_priority text,p_impact text
)
returns table(ticket_id uuid,ticket_no text,tracking_token uuid)
language plpgsql security definer set search_path=public,pg_temp as $$
declare v public.tickets;
begin
  if length(trim(coalesce(p_requester_name,'')))<2 or length(trim(coalesce(p_department,'')))<2 or length(trim(coalesce(p_description,'')))<8 then
    raise exception 'Faltan datos requeridos o la descripción es muy corta.';
  end if;
  if p_priority not in ('low','medium','high','critical') then p_priority:='medium'; end if;
  insert into public.tickets(requester_name,requester_email,department,room,category,equipment_type,brand_model,asset_tag,serial_number,description,priority,impact)
  values(trim(p_requester_name),nullif(trim(p_requester_email),''),trim(p_department),nullif(trim(p_room),''),trim(p_category),nullif(trim(p_equipment_type),''),nullif(trim(p_brand_model),''),nullif(trim(p_asset_tag),''),nullif(trim(p_serial_number),''),trim(p_description),p_priority,coalesce(nullif(p_impact,''),'single_user'))
  returning * into v;
  return query select v.id,v.ticket_no,v.tracking_token;
end; $$;

create or replace function public.track_public_ticket(p_tracking_token text)
returns table(ticket_no text,status text,priority text,category text,room text,created_at timestamptz,updated_at timestamptz,resolution_summary text,assigned_name text)
language sql security definer stable set search_path=public,pg_temp as $$
  select t.ticket_no,t.status,t.priority,t.category,t.room,t.created_at,t.updated_at,
         case when t.status in ('resolved','closed') then t.resolution_summary else null end,
         p.full_name
  from public.tickets t left join public.profiles p on p.id=t.assigned_to
  where t.tracking_token::text=p_tracking_token
     or lower(t.ticket_no)=lower(trim(p_tracking_token))
  limit 1;
$$;

create or replace function public.register_public_attachment(
  p_ticket_id uuid,p_tracking_token uuid,p_storage_path text,p_file_name text,p_mime_type text,p_file_size bigint
)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if not exists(select 1 from public.tickets where id=p_ticket_id and tracking_token=p_tracking_token) then raise exception 'Token inválido.'; end if;
  insert into public.ticket_attachments(ticket_id,storage_path,file_name,mime_type,file_size)
  values(p_ticket_id,p_storage_path,p_file_name,p_mime_type,p_file_size);
  return true;
end; $$;

create or replace function public.submit_public_evaluation(p_tracking_token text,p_rating int,p_comments text,p_suggestions text)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare tid uuid;
begin
  if p_rating<1 or p_rating>5 then raise exception 'Calificación inválida.'; end if;
  select id into tid from public.tickets
  where (tracking_token::text=p_tracking_token or lower(ticket_no)=lower(trim(p_tracking_token)))
    and status in ('resolved','closed');
  if tid is null then raise exception 'La boleta no existe o aún no puede evaluarse.'; end if;
  insert into public.service_evaluations(ticket_id,rating,comments,suggestions)
  values(tid,p_rating,nullif(trim(p_comments),''),nullif(trim(p_suggestions),''))
  on conflict(ticket_id) do update set rating=excluded.rating,comments=excluded.comments,suggestions=excluded.suggestions,updated_at=now();
  return true;
end; $$;

create or replace function public.assign_ticket(p_ticket_id uuid,p_technician_id uuid)
returns public.tickets language plpgsql security definer set search_path=public,pg_temp as $$
declare v public.tickets;
begin
  if not public.is_admin() then raise exception 'Solo administración puede asignar boletas.'; end if;
  if not exists(select 1 from public.profiles where id=p_technician_id and role='technician' and active=true) then raise exception 'Técnico inválido o inactivo.'; end if;
  update public.tickets set assigned_to=p_technician_id,status='assigned' where id=p_ticket_id returning * into v;
  if v.id is null then raise exception 'Boleta no encontrada.'; end if;
  return v;
end; $$;

create or replace function public.set_ticket_status(p_ticket_id uuid,p_status text)
returns public.tickets language plpgsql security definer set search_path=public,pg_temp as $$
declare v public.tickets;
begin
  if p_status not in ('new','triage','assigned','in_progress','awaiting_user','awaiting_parts','resolved','closed','cancelled') then raise exception 'Estado inválido.'; end if;
  if p_status in ('resolved','closed') then raise exception 'Usa las acciones de resolver/cerrar para esos estados.'; end if;
  if not (public.is_admin() or exists(
      select 1 from public.tickets t join public.profiles p on p.id=auth.uid()
      where t.id=p_ticket_id and t.assigned_to=auth.uid() and p.role='technician' and p.active=true
  )) then raise exception 'No autorizado.'; end if;
  update public.tickets set status=p_status where id=p_ticket_id returning * into v;
  if v.id is null then raise exception 'Boleta no encontrada.'; end if;
  return v;
end; $$;

drop function if exists public.claim_ticket(uuid);

create or replace function public.resolve_ticket(p_ticket_id uuid,p_diagnosis text,p_resolution_summary text,p_root_cause text,p_minutes_spent int,p_parts_used text)
returns public.tickets language plpgsql security definer set search_path=public,pg_temp as $$
declare v public.tickets;
begin
  if length(trim(coalesce(p_diagnosis,'')))<3 or length(trim(coalesce(p_resolution_summary,'')))<3 then raise exception 'Diagnóstico y solución son requeridos.'; end if;
  if not (public.is_admin() or exists(select 1 from public.tickets t join public.profiles p on p.id=auth.uid() where t.id=p_ticket_id and t.assigned_to=auth.uid() and p.role='technician' and p.active=true)) then raise exception 'No autorizado.'; end if;
  update public.tickets set diagnosis=trim(p_diagnosis),resolution_summary=trim(p_resolution_summary),root_cause=nullif(trim(p_root_cause),''),parts_used=nullif(trim(p_parts_used),''),minutes_spent=greatest(coalesce(p_minutes_spent,0),0),status='resolved',resolved_at=coalesce(resolved_at,now()) where id=p_ticket_id returning * into v;
  insert into public.ticket_worklogs(ticket_id,action_type,description,minutes_spent,created_by)
  values(p_ticket_id,'resolution',trim(p_resolution_summary),greatest(coalesce(p_minutes_spent,0),0),auth.uid());
  return v;
end; $$;

create or replace function public.set_ticket_signoff(p_ticket_id uuid,p_signer_name text,p_signature_path text)
returns public.tickets language plpgsql security definer set search_path=public,pg_temp as $$
declare v public.tickets;
begin
  if length(trim(coalesce(p_signer_name,'')))<2 then raise exception 'Nombre de conformidad requerido.'; end if;
  if not (public.is_admin() or exists(select 1 from public.tickets t join public.profiles p on p.id=auth.uid() where t.id=p_ticket_id and t.assigned_to=auth.uid() and p.role='technician' and p.active=true)) then raise exception 'No autorizado.'; end if;
  update public.tickets set requester_signoff_name=trim(p_signer_name),requester_signoff_at=now(),closure_signature_path=p_signature_path where id=p_ticket_id returning * into v;
  if v.id is null then raise exception 'Boleta no encontrada.'; end if;
  return v;
end; $$;

create or replace function public.close_ticket(p_ticket_id uuid)
returns public.tickets language plpgsql security definer set search_path=public,pg_temp as $$
declare v public.tickets;
begin
  if not public.is_admin() then raise exception 'Solo administración puede cerrar boletas.'; end if;
  update public.tickets set status='closed',closed_at=now(),closed_by=auth.uid() where id=p_ticket_id and status='resolved' returning * into v;
  if v.id is null then raise exception 'La boleta debe estar resuelta antes de cerrarse.'; end if;
  return v;
end; $$;

create or replace function public.report_summary(p_from date,p_to date)
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare result jsonb;
begin
  if not (public.is_admin() or auth.role()='service_role') then raise exception 'Solo administración puede generar reportes.'; end if;
  with base as (
    select t.*,e.rating from public.tickets t left join public.service_evaluations e on e.ticket_id=t.id
    where t.created_at >= p_from::timestamptz and t.created_at < (p_to+1)::timestamptz
  )
  select jsonb_build_object(
   'total',count(*),
   'open',count(*) filter(where status not in('resolved','closed','cancelled')),
   'resolved',count(*) filter(where status in('resolved','closed')),
   'overdue',count(*) filter(where sla_due_at<now() and status not in('resolved','closed','cancelled')),
   'avg_minutes',round(avg(minutes_spent) filter(where status in('resolved','closed')),0),
   'avg_rating',round(avg(rating),1)
  ) into result from base;
  return result;
end; $$;

create or replace function public.technician_stats(p_from date,p_to date)
returns table(technician_name text,assigned bigint,resolved bigint,minutes_total bigint,avg_rating numeric)
language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
  if not (public.is_admin() or auth.role()='service_role') then raise exception 'Solo administración puede generar reportes.'; end if;
  return query
  select p.full_name,
         count(t.id),
         count(t.id) filter(where t.status in('resolved','closed')),
         coalesce(sum(t.minutes_spent),0)::bigint,
         round(avg(e.rating),1)
  from public.profiles p
  left join public.tickets t on t.assigned_to=p.id and t.created_at>=p_from::timestamptz and t.created_at<(p_to+1)::timestamptz
  left join public.service_evaluations e on e.ticket_id=t.id
  where p.role='technician' and p.active=true
  group by p.id,p.full_name order by count(t.id) desc,p.full_name;
end; $$;

create or replace function public.snapshot_daily_metrics()
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare d date:=current_date; s jsonb;
begin
  with base as (
    select t.*,e.rating from public.tickets t left join public.service_evaluations e on e.ticket_id=t.id
    where t.created_at>=d::timestamptz and t.created_at<(d+1)::timestamptz
  )
  select jsonb_build_object(
    'total',count(*),
    'open',count(*) filter(where status not in('resolved','closed','cancelled')),
    'resolved',count(*) filter(where status in('resolved','closed')),
    'overdue',count(*) filter(where sla_due_at<now() and status not in('resolved','closed','cancelled')),
    'avg_minutes',round(avg(minutes_spent) filter(where status in('resolved','closed')),0),
    'avg_rating',round(avg(rating),1)
  ) into s from base;
  insert into public.daily_report_snapshots(report_date,total_tickets,open_tickets,resolved_tickets,overdue_tickets,avg_resolution_minutes,avg_rating,generated_at)
  values(d,(s->>'total')::int,(s->>'open')::int,(s->>'resolved')::int,(s->>'overdue')::int,nullif(s->>'avg_minutes','')::numeric,nullif(s->>'avg_rating','')::numeric,now())
  on conflict(report_date) do update set total_tickets=excluded.total_tickets,open_tickets=excluded.open_tickets,resolved_tickets=excluded.resolved_tickets,overdue_tickets=excluded.overdue_tickets,avg_resolution_minutes=excluded.avg_resolution_minutes,avg_rating=excluded.avg_rating,generated_at=now();
end; $$;

-- Row Level Security
alter table public.profiles enable row level security;
alter table public.tickets enable row level security;
alter table public.ticket_attachments enable row level security;
alter table public.ticket_notes enable row level security;
alter table public.ticket_worklogs enable row level security;
alter table public.ticket_status_history enable row level security;
alter table public.service_evaluations enable row level security;
alter table public.daily_report_snapshots enable row level security;

create policy "profiles authenticated read" on public.profiles for select to authenticated using(active=true or public.is_admin());
create policy "profiles admin update" on public.profiles for update to authenticated using(public.is_admin()) with check(public.is_admin());

create policy "tickets staff read" on public.tickets for select to authenticated using(public.is_admin() or assigned_to=(select auth.uid()));
create policy "tickets solved read (all staff)" on public.tickets for select to authenticated using(status in ('resolved','closed'));

create policy "attachments staff read" on public.ticket_attachments for select to authenticated using(public.is_admin() or exists(select 1 from public.tickets t where t.id=ticket_id and t.assigned_to=(select auth.uid())));
create policy "notes staff read" on public.ticket_notes for select to authenticated using(public.is_admin() or exists(select 1 from public.tickets t where t.id=ticket_id and t.assigned_to=(select auth.uid())));
create policy "notes staff insert" on public.ticket_notes for insert to authenticated with check(public.is_admin() or exists(select 1 from public.tickets t where t.id=ticket_id and t.assigned_to=(select auth.uid())));
create policy "worklogs staff read" on public.ticket_worklogs for select to authenticated using(public.is_admin() or exists(select 1 from public.tickets t where t.id=ticket_id and t.assigned_to=(select auth.uid())));
create policy "history staff read" on public.ticket_status_history for select to authenticated using(public.is_admin() or exists(select 1 from public.tickets t where t.id=ticket_id and t.assigned_to=(select auth.uid())));
create policy "evaluations admin read" on public.service_evaluations for select to authenticated using(public.is_admin() or exists(select 1 from public.tickets t where t.id=ticket_id and t.assigned_to=auth.uid()));
create policy "snapshots admin read" on public.daily_report_snapshots for select to authenticated using(public.is_admin());

-- Storage: evidencia privada. El usuario anónimo solo puede subir dentro de la carpeta
-- <ticket_id>/<tracking_token>/... cuando ambos coinciden con una boleta real.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('ticket-evidence','ticket-evidence',false,8388608,array['image/jpeg','image/png','image/webp','image/heic'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create policy "public evidence upload with token" on storage.objects for insert to anon
with check(bucket_id='ticket-evidence' and public.valid_public_evidence_path(name));
create policy "staff evidence read" on storage.objects for select to authenticated
using(bucket_id='ticket-evidence' and exists(
  select 1 from public.tickets t
  where t.id::text=(storage.foldername(name))[1]
    and (public.is_admin() or t.assigned_to=(select auth.uid()))
));
create policy "staff evidence upload" on storage.objects for insert to authenticated
with check(bucket_id='ticket-evidence' and exists(
  select 1 from public.tickets t
  where t.id::text=(storage.foldername(name))[1]
    and (public.is_admin() or t.assigned_to=auth.uid())
));

-- Privilegios mínimos
revoke all on public.tickets from anon;
revoke all on public.profiles from anon;
revoke all on public.ticket_notes from anon;
revoke all on public.ticket_worklogs from anon;
revoke all on public.service_evaluations from anon;

grant select on public.tickets to authenticated;
grant select on public.profiles to authenticated;
grant select,insert on public.ticket_notes to authenticated;
grant select on public.ticket_worklogs to authenticated;
grant select on public.ticket_attachments to authenticated;
grant select on public.ticket_status_history to authenticated;
grant select on public.service_evaluations to authenticated;
grant select on public.daily_report_snapshots to authenticated;

grant execute on function public.create_public_ticket(text,text,text,text,text,text,text,text,text,text,text,text) to anon,authenticated;
grant execute on function public.track_public_ticket(text) to anon,authenticated;
grant execute on function public.register_public_attachment(uuid,uuid,text,text,text,bigint) to anon,authenticated;
grant execute on function public.submit_public_evaluation(text,int,text,text) to anon,authenticated;
grant execute on function public.valid_public_evidence_path(text) to anon,authenticated;
grant execute on function public.assign_ticket(uuid,uuid) to authenticated;
grant execute on function public.set_ticket_status(uuid,text) to authenticated;
grant execute on function public.resolve_ticket(uuid,text,text,text,int,text) to authenticated;
grant execute on function public.set_ticket_signoff(uuid,text,text) to authenticated;
grant execute on function public.close_ticket(uuid) to authenticated;
grant execute on function public.report_summary(date,date) to authenticated;
grant execute on function public.technician_stats(date,date) to authenticated;

-- OPCIONAL: automatizar snapshot diario con Supabase Cron después de habilitarlo en Integrations > Cron.
-- select cron.schedule('pcb-techdesk-daily-snapshot','5 18 * * *',$$select public.snapshot_daily_metrics();$$);

-- PASO MANUAL PARA EL PRIMER ADMIN:
-- 1) Crea el usuario desde Authentication > Users.
-- 2) Ejecuta, sustituyendo el correo:
-- update public.profiles p set role='admin'
-- from auth.users u where p.id=u.id and u.email='TU-CORREO@ESCUELA.PR';
