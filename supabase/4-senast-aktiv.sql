-- Fångstboken: "Senast aktiv" för fiskekompisarna.
-- Kör i Supabase: SQL Editor -> New query -> klistra in -> Run. Går att köra flera gånger.

alter table public.members add column if not exists last_seen_at timestamptz;

-- Appen anropar den här när den öppnas. Uppdaterar högst var tionde minut per person.
create or replace function public.mark_seen()
returns void language sql volatile security definer set search_path = public as $$
  update public.members set last_seen_at = now()
  where id = public.my_member_id()
    and (last_seen_at is null or last_seen_at < now() - interval '10 minutes');
$$;

revoke execute on function public.mark_seen() from public, anon;
grant execute on function public.mark_seen() to authenticated;
