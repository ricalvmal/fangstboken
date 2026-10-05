-- Fångstboken: kommentarer på fångster.
-- Kör i Supabase: SQL Editor -> New query -> klistra in -> Run. Går att köra flera gånger.
-- Kör den här INNAN nya app.js laddas upp.
--
-- Alla i gänget kan kommentera fångster de kan se. Privata fångster syns bara för ägaren,
-- så de kan inte heller kommenteras eller läsas av någon annan.
-- Var och en kan ta bort sina egna kommentarer. Ägaren till fångsten och admin kan ta bort alla kommentarer på den.

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
