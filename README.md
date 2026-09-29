# Fångstboken

Loggbok för fiskegänget: fångster med bild, fisketurer, väder från Open-Meteo, betesbox, statistik och mönster (hugg per timme, kombinationer och huggperioder).

Appen är en vanlig webbsida. Datan, inloggningen och bilderna ligger i **Supabase**, och sidan visas via **GitHub Pages**. Båda är gratis och kräver inget kort.

---

## Installera (ungefär 20 minuter, görs en gång)

### 1. Skapa databasen i Supabase

1. Logga in på [supabase.com](https://supabase.com) och skapa ett nytt projekt (**New project**).
   - Välj en region i Europa, helst Stockholm (eu-north-1) om den finns.
   - Spara databaslösenordet någonstans. Appen behöver det inte, men du kan behöva det senare.
2. När projektet är klart: öppna **SQL Editor** i vänstermenyn och välj **New query**.
3. Öppna filen `supabase/schema.sql`, kopiera **allt** och klistra in det.
   - Längst ned står din e-post som första admin (`rickard.alvemal@outlook.com`). Ändra den om du vill använda en annan adress.
4. Tryck på **Run**. Det ska sluta med "Success". Det går bra att köra filen igen om något blev fel.

### 2. Stäng av e-postbekräftelse

Supabase gratis-e-post skickar bara till dig själv, två mejl i timmen. Därför loggar gänget in med e-post och lösenord, utan bekräftelsemejl.

1. Gå till **Authentication → Sign In / Providers** (kan heta **Providers → Email**).
2. Se till att **Email** är påslaget och att **Allow new users to sign up** är på.
3. Stäng av **Confirm email** och spara.

Det är tryggt: bara e-postadresser som du har lagt till under *Fiskekompisar* i appen kommer åt något. Andra kan skapa ett konto men ser ingenting.

### 3. Hämta adress och nyckel

1. Gå till **Project Settings → API Keys** (eller tryck på **Connect** högst upp).
2. Kopiera **Project URL**, som ser ut ungefär som `https://abcdefgh.supabase.co`.
3. Kopiera den **publika** nyckeln. Den heter *publishable key* (börjar med `sb_publishable_`) eller *anon public* i äldre projekt.
   - Använd **aldrig** nyckeln som heter *secret* eller *service_role*.

### 4. Lägg upp appen på GitHub

1. Logga in på [github.com](https://github.com). Välj **New repository**, döp det till `fangstboken`, välj **Public** och skapa det.
2. Välj **uploading an existing file** och dra in **alla filer och mappar** från den här mappen. Tryck sedan på **Commit changes**.
   - Mappen `.github` är dold på Mac. Visa dolda filer i Finder med **Cmd + Shift + .** innan du drar in allt.
   - Kom mappen inte med ändå: välj **Add file → Create new file**, skriv namnet `.github/workflows/keepalive.yml` och klistra in innehållet från filen med samma namn.
3. Öppna filen `config.js` i repot och tryck på pennan (**Edit**). Klistra in adressen och nyckeln från steg 3 mellan citattecknen och tryck på **Commit changes**.
   ```js
   supabaseUrl: "https://abcdefgh.supabase.co",
   supabaseAnonKey: "sb_publishable_…",
   ```
4. Gå till **Settings → Pages**. Välj **Deploy from a branch**, branch `main` och mapp `/ (root)`, och spara.
   Efter någon minut står adressen där, till exempel `https://ditt-namn.github.io/fangstboken/`.

### 5. Starta pingen som håller databasen vaken

Supabase pausar gratisprojekt som inte används på en vecka, till exempel på vintern. En liten automatisk körning förhindrar det.

1. Gå till fliken **Actions** i repot och tryck på knappen för att aktivera workflows om GitHub frågar.
2. Välj **Håll Supabase vaken** och tryck på **Run workflow** en gång för att testa. Den ska bli grön.

Därefter körs den automatiskt varje morgon.

### 6. Logga in och bjud in gänget

1. Öppna adressen från steg 4.4. Välj **Skapa konto**, använd din e-post och välj ett lösenord.
2. Gå till **Fiskekompisar** (under *Mer* på mobilen) och lägg till kompisarna med namn och e-post.
3. Skicka adressen till dem. De väljer **Skapa konto** med samma e-post som du lade in och ett eget lösenord.
4. Lägg appen på hemskärmen:
   - **iPhone (Safari):** Dela → Lägg till på hemskärmen.
   - **Android (Chrome):** ⋮ → Lägg till på startskärmen.

---

## Använda appen

- **Starta tur** när du börjar fiska och **Avsluta** när du slutar. Fångster du registrerar under tiden kopplas till turen, och timmarna utan napp räknas också. Det gör mönstren pålitliga.
- **＋** registrerar en fångst. Tid och position läses från bilden, vattnet känns igen och vädret hämtas direkt.
- Glömde du starta turen? Välj **Turer → Lägg in tur i efterhand**, så kopplas fångsterna från den tiden till turen.
- Under **Statistik → Mönster** finns hugg per timme, kombinationer som nappar och huggperioder. Varje avslutad tur har en tidslinje med tryck och temperatur.
- **Fiskekompisar → Säkerhetskopia** laddar ner allt som JSON, eller fångsterna som CSV för Excel. Gör det någon gång per säsong.

## Glömt lösenord

Supabase kan inte skicka återställningsmejl med gratis-e-posten. Admin tar i stället bort personens inloggning under **Authentication → Users** i Supabase. Sedan skapar personen ett nytt konto i appen med samma e-post. Inga fångster försvinner, eftersom de är kopplade till gänglistan och inte till inloggningen.

## Uppdatera appen

Ändra eller ersätt filerna i GitHub-repot. Sidan uppdateras automatiskt inom en minut. Om en ny funktion behöver en ändring i databasen följer det med en SQL-rad att köra i Supabase SQL Editor.

## Filer

| Fil | Vad den gör |
|---|---|
| `index.html`, `styles.css` | Sidan och utseendet |
| `app.js` | Appen: inloggning, fångster, turer, beten, statistik |
| `analysis.js` | Beräkningar: sol, måne, väder, hugg per timme, kombinationer, huggperioder |
| `config.js` | Supabase-adress och publik nyckel |
| `supabase/schema.sql` | Databasen och behörighetsreglerna |
| `.github/workflows/keepalive.yml` | Daglig ping som hindrar Supabase från att pausa |
| `manifest.webmanifest`, `icon*` | Ikon och namn när appen läggs på hemskärmen |

Väderdata: [Open-Meteo.com](https://open-meteo.com/) (CC BY 4.0, gratis för icke-kommersiellt bruk).
