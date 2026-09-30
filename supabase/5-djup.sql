-- Fångstboken: bottendjup och ungefärligt djup där fisken högg.
-- Kör i Supabase: SQL Editor -> New query -> klistra in -> Run. Går att köra flera gånger.
-- Kör den här INNAN nya app.js laddas upp, annars går det inte att spara fångster med djup.

alter table public.catches add column if not exists depth_m numeric;
alter table public.catches add column if not exists fish_depth_m numeric;
