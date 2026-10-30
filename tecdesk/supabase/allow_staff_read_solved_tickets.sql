-- PCB TechDesk · personal (técnicos y administradores) puede ver TODAS las
-- boletas RESUELTAS o CERRADAS en la página "Boletas resueltas", sin importar
-- a qué técnico estén asignadas.
--
-- Por qué hace falta: la política "tickets staff read" limita a cada técnico a
-- ver solo las boletas asignadas a él. Esta política ADDICIONAL es permisiva y
-- PostgreSQL combina las políticas SELECT permisivas con OR, por lo que el
-- personal podrá LEER cualquier boleta resuelta/cerrada, mientras las boletas
-- ABIERTAS de otros técnicos siguen ocultas (no se modifica "tickets staff read").
--
-- Cómo aplicarla (una sola vez sobre la base existente):
--   Supabase Dashboard → SQL Editor → New query → pega este contenido → Run.
-- Es seguro ejecutarla más de una vez.

drop policy if exists "tickets solved read (all staff)" on public.tickets;
create policy "tickets solved read (all staff)" on public.tickets
  for select
  to authenticated
  using (status in ('resolved','closed'));
