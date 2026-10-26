-- Ejecuta este archivo una vez en Supabase SQL Editor sobre la base existente.
-- Administración ve y asigna todas las boletas; cada técnico solo ve las suyas.

drop policy if exists "tickets staff read" on public.tickets;
create policy "tickets staff read" on public.tickets for select to authenticated
using (public.is_admin() or assigned_to=(select auth.uid()));

drop policy if exists "attachments staff read" on public.ticket_attachments;
create policy "attachments staff read" on public.ticket_attachments for select to authenticated
using (public.is_admin() or exists(
  select 1 from public.tickets t
  where t.id=ticket_id and t.assigned_to=(select auth.uid())
));

drop policy if exists "notes staff read" on public.ticket_notes;
create policy "notes staff read" on public.ticket_notes for select to authenticated
using (public.is_admin() or exists(
  select 1 from public.tickets t
  where t.id=ticket_id and t.assigned_to=(select auth.uid())
));

drop policy if exists "notes staff insert" on public.ticket_notes;
create policy "notes staff insert" on public.ticket_notes for insert to authenticated
with check (public.is_admin() or exists(
  select 1 from public.tickets t
  where t.id=ticket_id and t.assigned_to=(select auth.uid())
));

drop policy if exists "worklogs staff read" on public.ticket_worklogs;
create policy "worklogs staff read" on public.ticket_worklogs for select to authenticated
using (public.is_admin() or exists(
  select 1 from public.tickets t
  where t.id=ticket_id and t.assigned_to=(select auth.uid())
));

drop policy if exists "history staff read" on public.ticket_status_history;
create policy "history staff read" on public.ticket_status_history for select to authenticated
using (public.is_admin() or exists(
  select 1 from public.tickets t
  where t.id=ticket_id and t.assigned_to=(select auth.uid())
));

drop policy if exists "staff evidence read" on storage.objects;
create policy "staff evidence read" on storage.objects for select to authenticated
using(bucket_id='ticket-evidence' and exists(
  select 1 from public.tickets t
  where t.id::text=(storage.foldername(name))[1]
    and (public.is_admin() or t.assigned_to=(select auth.uid()))
));

-- Se elimina por completo la autoasignación de técnicos.
drop function if exists public.claim_ticket(uuid);

create or replace function public.close_ticket(p_ticket_id uuid)
returns public.tickets language plpgsql security definer set search_path=public,pg_temp as $$
declare v public.tickets;
begin
  if not public.is_admin() then
    raise exception 'Solo administración puede cerrar boletas.';
  end if;

  update public.tickets
  set status='closed',closed_at=now(),closed_by=auth.uid()
  where id=p_ticket_id and status='resolved'
  returning * into v;

  if v.id is null then
    raise exception 'La boleta debe estar resuelta antes de cerrarse.';
  end if;
  return v;
end; $$;

-- Las funciones privilegiadas no quedan disponibles para anon ni PUBLIC.
revoke execute on function public.assign_ticket(uuid,uuid) from public,anon;
grant execute on function public.assign_ticket(uuid,uuid) to authenticated;
revoke execute on function public.close_ticket(uuid) from public,anon;
grant execute on function public.close_ticket(uuid) to authenticated;
