-- Fångstboken: databasen i Supabase.
-- Återskapad 2026-09-30 från den körande databasen, plus "Senast aktiv" (4-senast-aktiv.sql) djup (5-djup.sql) dolda platser (6-dold-plats.sql) privata fångster (7-privat.sql) och kommentarer (8-kommentarer.sql) (tabeller, regler, funktioner, trigger, realtid, bildlagring).
--
-- Kör hela filen i Supabase: SQL Editor -> New query -> klistra in -> Run.
-- Filen går att köra flera gånger. Den skapar bara det som saknas och skriver om reglerna,
-- så befintliga fångster, turer och bilder påverkas inte.
--
-- Längst ned läggs första admin in. Byt e-post där om någon annan ska vara admin.

-- ---------- Tabeller ----------

create table if not exists public.members (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  email      text not null unique,
  color      integer not null default 0,
  active     boolean not null default true,
  is_admin   boolean not null default false,
  last_seen_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.members add column if not exists last_seen_at timestamptz;

-- Hjälpfunktioner som reglerna bygger på. Identifierar den inloggade via e-posten i inloggningen.
create or replace function public.is_member()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members m
                 where lower(m.email) = lower(auth.jwt() ->> 'email') and m.active);
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members m
                 where lower(m.email) = lower(auth.jwt() ->> 'email') and m.active and m.is_admin);
$$;

create or replace function public.my_member_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.members where lower(email) = lower(auth.jwt() ->> 'email') and active limit 1;
$$;

create table if not exists public.lakes (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  lat        double precision,
  lon        double precision,
  created_by uuid default public.my_member_id() references public.members(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.baits (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  type       text not null default 'Övrigt',
  color      text not null default '',
  size_cm    numeric,
  weight_g   numeric,
  brand      text not null default '',
  owner      uuid references public.members(id) on delete set null,
  note       text not null default '',
  photo      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.trips (
  id             uuid primary key default gen_random_uuid(),
  member_id      uuid references public.members(id) on delete set null,
  lake_id        uuid references public.lakes(id) on delete set null,
  lat            double precision,
  lon            double precision,
  started_at     timestamptz not null,
  ended_at       timestamptz,
  note           text not null default '',
  weather        jsonb,
  weather_status text not null default 'pending',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table if not exists public.catches (
  id             uuid primary key default gen_random_uuid(),
  member_id      uuid references public.members(id) on delete set null,
  created_by     uuid default public.my_member_id() references public.members(id) on delete set null,
  species        text not null,
  bait           text not null default '',
  bait_id        uuid references public.baits(id) on delete set null,
  technique      text not null default '',
  weight_kg      numeric,
  length_cm      numeric,
  water_temp_c   numeric,
  depth_m        numeric,
  fish_depth_m   numeric,
  released       boolean not null default false,
  is_private     boolean not null default false,
  note           text not null default '',
  time           timestamptz not null,
  lat            double precision,
  lon            double precision,
  pos_source     text,
  lake_id        uuid references public.lakes(id) on delete set null,
  lake_name      text,
  photo          text,
  trip_id        uuid references public.trips(id) on delete set null,
  light          text,
  moon           jsonb,
  weather        jsonb,
  weather_status text not null default 'pending',
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- Kolumner som lagts till efter att tabellerna skapades.
alter table public.catches add column if not exists depth_m numeric;
alter table public.catches add column if not exists fish_depth_m numeric;
alter table public.catches add column if not exists is_private boolean not null default false;

grant select, insert, update, delete on public.members, public.lakes, public.baits, public.trips, public.catches to authenticated;

-- ---------- Behörighet (Row Level Security) ----------
-- Bara aktiva fiskekompisar kommer åt något. Alla i gänget ser allt.

alter table public.members enable row level security;
alter table public.lakes   enable row level security;
alter table public.baits   enable row level security;
alter table public.trips   enable row level security;
alter table public.catches enable row level security;

-- Fiskekompisar: alla läser, admin ändrar, var och en får byta sitt eget namn.
drop policy if exists "members read" on public.members;
create policy "members read" on public.members for select using (public.is_member());
drop policy if exists "members admin write" on public.members;
create policy "members admin write" on public.members for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists "members own name" on public.members;
create policy "members own name" on public.members for update
  using (lower(email) = lower(auth.jwt() ->> 'email') and active)
  with check (lower(email) = lower(auth.jwt() ->> 'email') and active);

-- Vatten: gänget läser, lägger till och ändrar. Bara den som lade in (eller admin) tar bort.
drop policy if exists "gang read" on public.lakes;
create policy "gang read" on public.lakes for select using (public.is_member());
drop policy if exists "gang insert" on public.lakes;
create policy "gang insert" on public.lakes for insert with check (public.is_member());
drop policy if exists "gang update" on public.lakes;
create policy "gang update" on public.lakes for update using (public.is_member()) with check (public.is_member());
drop policy if exists "own delete" on public.lakes;
create policy "own delete" on public.lakes for delete
  using (public.is_admin() or (public.is_member() and created_by = public.my_member_id()));

-- Beten och turer: hela gänget får göra allt.
drop policy if exists "gang all" on public.baits;
create policy "gang all" on public.baits for all using (public.is_member()) with check (public.is_member());
drop policy if exists "gang all" on public.trips;
create policy "gang all" on public.trips for all using (public.is_member()) with check (public.is_member());

-- Fångster: gänget läser, lägger till och ändrar. Bara fiskaren, den som lade in, eller admin tar bort.
-- Privata fångster (is_private) ser och ändrar bara fiskaren och den som registrerade dem, inte heller admin.
drop policy if exists "gang read" on public.catches;
create policy "gang read" on public.catches for select
  using (public.is_member() and (not is_private or member_id = public.my_member_id() or created_by = public.my_member_id()));
drop policy if exists "gang insert" on public.catches;
create policy "gang insert" on public.catches for insert with check (public.is_member());
drop policy if exists "gang update" on public.catches;
create policy "gang update" on public.catches for update
  using (public.is_member() and (not is_private or member_id = public.my_member_id() or created_by = public.my_member_id()))
  with check (public.is_member());
drop policy if exists "own delete" on public.catches;
create policy "own delete" on public.catches for delete
  using (public.is_admin() or (public.is_member() and (member_id = public.my_member_id() or created_by = public.my_member_id())));

-- Bara admin får ändra admin, aktiv och e-post, även på sin egen rad.
create or replace function public.members_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() and (new.is_admin <> old.is_admin or new.active <> old.active or lower(new.email) <> lower(old.email)) then
    raise exception 'Bara admin kan ändra det här';
  end if;
  return new;
end $$;
drop trigger if exists members_guard on public.members;
create trigger members_guard before update on public.members for each row execute function public.members_guard();

-- ---------- Funktioner som appen anropar ----------

-- Den dagliga pingen från GitHub Actions, så att gratisprojektet inte pausas.
create or replace function public.keepalive()
returns integer language sql stable as $$ select 1 $$;

-- Appen sparar när var och en senast var aktiv, högst var tionde minut. Alla i gänget ser det.
create or replace function public.mark_seen()
returns void language sql volatile security definer set search_path = public as $$
  update public.members set last_seen_at = now()
  where id = public.my_member_id()
    and (last_seen_at is null or last_seen_at < now() - interval '10 minutes');
$$;
revoke execute on function public.mark_seen() from public, anon;
grant execute on function public.mark_seen() to authenticated;

-- Admin ser vilka i gänget som skapat konto och när de senast loggade in.
create or replace function public.member_status()
returns table(email text, signed_up_at timestamptz, last_sign_in_at timestamptz)
language sql stable security definer set search_path = public, auth as $$
  select lower(u.email)::text, u.created_at, u.last_sign_in_at
  from auth.users u
  where public.is_admin()
    and lower(u.email) in (select lower(m.email) from public.members m);
$$;

-- Admin sätter ett tillfälligt lösenord åt någon som glömt sitt.
create or replace function public.admin_set_password(target_email text, new_password text)
returns void language plpgsql security definer set search_path = public, auth, extensions as $$
begin
  if not public.is_admin() then
    raise exception 'Bara admin kan sätta lösenord åt andra';
  end if;
  if new_password is null or length(new_password) < 8 then
    raise exception 'Lösenordet måste ha minst 8 tecken';
  end if;
  if not exists (select 1 from public.members m where lower(m.email) = lower(target_email) and m.active) then
    raise exception 'Personen finns inte bland fiskekompisarna';
  end if;
  update auth.users
     set encrypted_password = extensions.crypt(new_password, extensions.gen_salt('bf')),
         updated_at = now()
   where lower(email) = lower(target_email);
  if not found then
    raise exception 'Personen har inte skapat konto än';
  end if;
end $$;

-- ---------- Realtid ----------
-- Gör att allas ändringar syns direkt i appen.
do $$
declare t text;
begin
  foreach t in array array['members','lakes','baits','trips','catches'] loop
    if not exists (select 1 from pg_publication_tables
                   where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ---------- Bilder ----------
-- Privat bucket. Bilderna visas via tillfälliga signerade länkar.
insert into storage.buckets (id, name, public) values ('photos', 'photos', false)
on conflict (id) do nothing;

-- Bilden till en privat fångst kan bara ägaren öppna. Funktionen ser privata fångster men svarar bara ja eller nej.
create or replace function public.photo_blocked(p text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.catches c
                 where c.photo = p and c.is_private
                   and c.member_id is distinct from public.my_member_id()
                   and c.created_by is distinct from public.my_member_id());
$$;
drop policy if exists "photos gang read" on storage.objects;
create policy "photos gang read" on storage.objects for select
  using (bucket_id = 'photos' and public.is_member() and not public.photo_blocked(name));
drop policy if exists "photos gang write" on storage.objects;
create policy "photos gang write" on storage.objects for insert
  with check (bucket_id = 'photos' and public.is_member());
drop policy if exists "photos own delete" on storage.objects;
create policy "photos own delete" on storage.objects for delete
  using (bucket_id = 'photos' and public.is_member() and (owner = auth.uid() or public.is_admin()));

-- ---------- Dolda platser ----------
-- En fångst eller tur med dold plats har varken vatten eller position i den delade tabellen.
-- Den riktiga platsen ligger i egna tabeller som bara fiskaren kan läsa, inte heller admin.
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

-- ---------- Kommentarer ----------
-- Gänget kommenterar fångster de kan se. Egna kommentarer, kommentarer på egna fångster och admin kan tas bort.
create table if not exists public.catch_comments (
  id         uuid primary key default gen_random_uuid(),
  catch_id   uuid not null references public.catches(id) on delete cascade,
  member_id  uuid default public.my_member_id() references public.members(id) on delete set null,
  body       text not null check (length(btrim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists catch_comments_catch_idx on public.catch_comments (catch_id, created_at);

grant select, insert, delete on public.catch_comments to authenticated;
alter table public.catch_comments enable row level security;

-- Läsa: bara kommentarer på fångster man själv får se (reglerna för catches gäller i underfrågan).
drop policy if exists "gang read" on public.catch_comments;
create policy "gang read" on public.catch_comments for select
  using (public.is_member() and exists (select 1 from public.catches c where c.id = catch_comments.catch_id));

-- Skriva: bara i eget namn, och bara på fångster man får se.
drop policy if exists "own insert" on public.catch_comments;
create policy "own insert" on public.catch_comments for insert
  with check (public.is_member() and member_id = public.my_member_id()
              and exists (select 1 from public.catches c where c.id = catch_comments.catch_id));

-- Ta bort: egna kommentarer, alla kommentarer på egna fångster, eller admin.
drop policy if exists "own delete" on public.catch_comments;
create policy "own delete" on public.catch_comments for delete
  using (public.is_member() and (
    member_id = public.my_member_id() or public.is_admin()
    or exists (select 1 from public.catches c where c.id = catch_comments.catch_id
               and (c.member_id = public.my_member_id() or c.created_by = public.my_member_id()))));

-- Realtid, så att nya kommentarer dyker upp direkt hos alla.
do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'catch_comments') then
    alter publication supabase_realtime add table public.catch_comments;
  end if;
end $$;

-- ---------- Första admin ----------
insert into public.members (name, email, is_admin)
values ('Rickard', 'rickard.alvemal@outlook.com', true)
on conflict (email) do nothing;
