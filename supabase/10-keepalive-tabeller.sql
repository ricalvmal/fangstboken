-- Fångstboken: keepalive som läser från appens riktiga tabeller.
-- Kör i Supabase: SQL Editor -> New query -> klistra in -> Run. Går att köra flera gånger.
-- Bygger på 9-keepalive.sql (tabellen keepalive_log måste finnas).
--
-- Varje anrop skriver högst en rad i timmen i keepalive_log, och läser från fiskekompisar,
-- vatten, beten, turer, fångster och kommentarer. Inget av det skickas tillbaka: svaret
-- innehåller bara tidpunkten för senaste pingen och hur många pingar som gjorts de senaste 60 dagarna.

create or replace function public.keepalive()
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare last timestamptz; touched bigint := 0; n bigint;
begin
  select max(pinged_at) into last from public.keepalive_log;
  if last is null or last < now() - interval '1 hour' then
    insert into public.keepalive_log default values;
  end if;
  delete from public.keepalive_log where pinged_at < now() - interval '60 days';

  -- Läs från appens tabeller, så att det blir vanlig databasaktivitet.
  select count(*) into n from public.members;        touched := touched + n;
  select count(*) into n from public.lakes;          touched := touched + n;
  select count(*) into n from public.baits;          touched := touched + n;
  select count(*) into n from (select id from public.trips   order by started_at desc limit 50) t; touched := touched + n;
  select count(*) into n from (select id from public.catches order by time desc limit 50) c;      touched := touched + n;
  select count(*) into n from (select id from public.catch_comments order by created_at desc limit 50) k; touched := touched + n;

  return jsonb_build_object(
    'pinged_at', (select max(pinged_at) from public.keepalive_log),
    'pings_60d', (select count(*) from public.keepalive_log)
  );
end $$;
revoke all on function public.keepalive() from public;
grant execute on function public.keepalive() to anon, authenticated;
