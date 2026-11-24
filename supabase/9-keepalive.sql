-- Fångstboken: starkare keepalive.
-- Kör i Supabase: SQL Editor -> New query -> klistra in -> Run. Går att köra flera gånger.
-- Kör den här INNAN den nya keepalive.yml läggs upp i GitHub.
--
-- Supabase pausar gratisprojekt som har för lite databasaktivitet under en vecka.
-- Tidigare svarade keepalive() bara "1" utan att röra någon tabell. Nu skriver den en rad
-- i en loggtabell och läser från den, vilket är riktig databasaktivitet.
-- Loggen håller sig liten: högst en rad i timmen sparas, och rader äldre än 60 dagar tas bort.

create table if not exists public.keepalive_log (
  id        bigint generated always as identity primary key,
  pinged_at timestamptz not null default now()
);
-- Ingen kommer åt tabellen direkt. Bara funktionen nedan skriver och läser.
alter table public.keepalive_log enable row level security;
revoke all on public.keepalive_log from anon, authenticated;

drop function if exists public.keepalive();
create function public.keepalive()
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare last timestamptz;
begin
  select max(pinged_at) into last from public.keepalive_log;
  if last is null or last < now() - interval '1 hour' then
    insert into public.keepalive_log default values;
  end if;
  delete from public.keepalive_log where pinged_at < now() - interval '60 days';
  return jsonb_build_object(
    'pinged_at', (select max(pinged_at) from public.keepalive_log),
    'pings_60d', (select count(*) from public.keepalive_log)
  );
end $$;
revoke all on function public.keepalive() from public;
grant execute on function public.keepalive() to anon, authenticated;
