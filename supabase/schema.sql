create table if not exists public.sessions (
  id uuid primary key,
  runner text not null check (char_length(runner) between 1 and 40),
  session_date date not null,
  distance_km numeric not null check (distance_km between 0.4 and 100),
  target_seconds integer not null check (target_seconds > 0),
  actual_seconds integer check (actual_seconds > 0),
  created_at timestamptz not null default now()
);

alter table public.sessions enable row level security;

create or replace function public.is_danz_admin()
returns boolean
language sql
stable
set search_path = ''
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) = 'asimango@gmail.com';
$$;

revoke all on function public.is_danz_admin() from public;
grant execute on function public.is_danz_admin() to authenticated;

drop policy if exists "Anyone can submit a session" on public.sessions;
create policy "Anyone can submit a session"
on public.sessions
for insert
to anon, authenticated
with check (
  char_length(runner) between 1 and 40
  and distance_km between 0.4 and 100
  and target_seconds > 0
  and actual_seconds is null
);

drop policy if exists "Admin can import sessions" on public.sessions;
create policy "Admin can import sessions"
on public.sessions
for insert
to authenticated
with check (public.is_danz_admin());

drop policy if exists "Admin can read sessions" on public.sessions;
create policy "Admin can read sessions"
on public.sessions
for select
to authenticated
using (public.is_danz_admin());

drop policy if exists "Admin can update sessions" on public.sessions;
create policy "Admin can update sessions"
on public.sessions
for update
to authenticated
using (public.is_danz_admin())
with check (public.is_danz_admin());

drop policy if exists "Admin can delete sessions" on public.sessions;
create policy "Admin can delete sessions"
on public.sessions
for delete
to authenticated
using (public.is_danz_admin());

grant insert on table public.sessions to anon;
grant select, insert, update, delete on table public.sessions to authenticated;
