-- Fångstboken: privata fångster.
-- Kör i Supabase: SQL Editor -> New query -> klistra in -> Run. Går att köra flera gånger.
-- Kör den här EFTER 6-dold-plats.sql och INNAN nya app.js laddas upp.
--
-- En privat fångst syns bara för fiskaren och den som registrerade den. Inte heller admin ser den.
-- Kompisarna får den aldrig till sina telefoner, och de kan inte heller öppna bilden.

alter table public.catches add column if not exists is_private boolean not null default false;

-- Vem får se en fångst: alla i gänget, utom privata fångster som bara ägaren ser.
drop policy if exists "gang read" on public.catches;
create policy "gang read" on public.catches for select
  using (public.is_member() and (not is_private or member_id = public.my_member_id() or created_by = public.my_member_id()));

drop policy if exists "gang update" on public.catches;
create policy "gang update" on public.catches for update
  using (public.is_member() and (not is_private or member_id = public.my_member_id() or created_by = public.my_member_id()))
  with check (public.is_member());

-- Bilder: spärra bilden till en privat fångst för alla utom ägaren.
-- Funktionen körs med utökade rättigheter för att kunna se privata fångster, men svarar bara ja eller nej.
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
