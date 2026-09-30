-- Fångstboken: dölj plats för fiskekompisarna.
-- Kör i Supabase: SQL Editor -> New query -> klistra in -> Run. Går att köra flera gånger.
-- Kör den här INNAN nya app.js laddas upp.
--
-- En fångst eller tur med dold plats sparar varken vatten eller position i den delade tabellen.
-- Den riktiga platsen ligger i en egen tabell som bara fiskaren (och den som registrerade fångsten) kan läsa.
-- Inte heller admin kan se den.

alter table public.catches add column if not exists hide_location boolean not null default false;
alter table public.trips   add column if not exists hide_location boolean not null default false;

create table if not exists public.catch_secrets (
  id         uuid primary key references public.catches(id) on delete cascade,
  lat        double precision,
  lon        double precision,
  pos_source text,
  lake_id    uuid references public.lakes(id) on delete set null,
  lake_name  text,
  updated_at timestamptz not null default now()
);

create table if not exists public.trip_secrets (
  id         uuid primary key references public.trips(id) on delete cascade,
  lat        double precision,
  lon        double precision,
  lake_id    uuid references public.lakes(id) on delete set null,
  lake_name  text,
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.catch_secrets, public.trip_secrets to authenticated;
alter table public.catch_secrets enable row level security;
alter table public.trip_secrets  enable row level security;

drop policy if exists "own secret" on public.catch_secrets;
create policy "own secret" on public.catch_secrets for all
  using (exists (select 1 from public.catches c where c.id = catch_secrets.id
                 and (c.member_id = public.my_member_id() or c.created_by = public.my_member_id())))
  with check (exists (select 1 from public.catches c where c.id = catch_secrets.id
                 and (c.member_id = public.my_member_id() or c.created_by = public.my_member_id())));

drop policy if exists "own secret" on public.trip_secrets;
create policy "own secret" on public.trip_secrets for all
  using (exists (select 1 from public.trips t where t.id = trip_secrets.id and t.member_id = public.my_member_id()))
  with check (exists (select 1 from public.trips t where t.id = trip_secrets.id and t.member_id = public.my_member_id()));

-- Realtid, så att den egna appen på andra enheter hänger med.
do $$
declare t text;
begin
  foreach t in array array['catch_secrets','trip_secrets'] loop
    if not exists (select 1 from pg_publication_tables
                   where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
