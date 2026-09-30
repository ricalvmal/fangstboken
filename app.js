// Fångstboken: webbapp för gänget. Data i Supabase, väder från Open-Meteo.
import * as A from "./analysis.js";
const { H } = A;

// ---------- konstanter ----------
const SPECIES = ["Abborre","Gädda","Gös","Öring","Regnbåge","Sik","Harr","Röding","Lax","Braxen","Mört","Karp","Id","Lake"];
const TECH = ["Spinn","Jigg","Dropshot","Mete","Fluga","Trolling","Pimpel","Vertikal"];
const BAIT_TYPES = ["Jigg","Wobbler","Jerkbait","Glidebait","Skeddrag","Spinnare","Spinnerbait","Dropshot","Pilk","Fluga","Mask/mete","Levande bete","Övrigt"];
// Betskatalog: modeller med storlekar och färger enligt tillverkarens produktsida.
// Alla färger finns inte i alla storlekar. Lägg till fler modeller här.
const CATALOG = [
  { brand:"Westin", model:"Swim", type:"Glidebait", source:"westin-fishing.com/en/hard-lures/swim-glidebait",
    variants:[["6,5 cm","Suspending",6.5,9],["8 cm","Suspending",8,16],["8 cm","Sinking",8,19],["10 cm","Low Floating",10,31],["10 cm","Sinking",10,34],["12 cm","Suspending",12,53],["12 cm","Sinking",12,58],["13,5 cm","Suspending",13.5,null],["13,5 cm","Sinking",13.5,86],["15 cm","Suspending",15,107],["15 cm","Sinking",15,115]],
    colors:["Bling Perch","Firetiger","Blank","Natural Pike","Official Roach","Parrot Special","See Me","Blueback Herring","3D Headlight","3D Golden Perch","Fire","Real Perch","Real Roach","Real Rudd","Real Pike","Real Baltic Pike","3D Rocky Red","3D Amber Perch","Chartreuse Flow","3D Motoroil Blood","3D Magic Pike","3D Magic Roach","3D Magic Perch","Spain","Argentina","Germany","Netherlands","France","England","Brazil","Scotland","Ireland","Poland","Denmark","Sweden"] },
  { brand:"Westin", model:"Swim SW", type:"Glidebait", source:"westin-fishing.com/en/products/swim-sw",
    variants:[["10 cm","Sinking",10,35],["12 cm","Sinking",12,60],["15 cm","Sinking",15,125]],
    colors:["Coral Trout","Mahi Mahi","Atlantic Mackerel","Silver Shadow"] },
];
function openCatalog(){
  const C = { m:0, v:null, cols:new Set() };
  const draw = () => {
    const m = CATALOG[C.m], v = C.v!=null ? m.variants[C.v] : null;
    const nameFor = (col) => `${m.brand} ${m.model} ${v[0]} ${v[1]} · ${col}`;
    const have = new Set(S.baits.map(b=>b.name.toLowerCase()));
    $("#catBody").innerHTML = `
      <div class="field"><span class="label">Modell</span><div class="chips">${CATALOG.map((x,i)=>`<button type="button" class="chip" data-cm="${i}" aria-pressed="${i===C.m}">${esc(x.brand+" "+x.model)}</button>`).join("")}</div></div>
      <div class="field"><span class="label">Storlek</span><div class="chips">${m.variants.map((x,i)=>`<button type="button" class="chip small" data-cv="${i}" aria-pressed="${i===C.v}">${esc(x[0]+" "+x[1])}${x[3]?` · ${x[3]} g`:""}</button>`).join("")}</div></div>
      ${v?`<div class="field"><span class="label">Färger du har (${C.cols.size} valda)</span><div class="chips">${m.colors.map(col=>{ const dup=have.has(nameFor(col).toLowerCase()); return `<button type="button" class="chip small" data-cc="${esc(col)}" aria-pressed="${C.cols.has(col)}" ${dup?"disabled title='Finns redan i boxen'":""}>${esc(col)}${dup?" ✓":""}</button>`; }).join("")}</div>
        <span class="muted" style="font-size:13px">Alla färger finns inte i alla storlekar. ✓ betyder att betet redan ligger i boxen.</span></div>
        <div class="field"><label for="catOwner">Ägare</label><select class="inp" id="catOwner"><option value="">Gemensamt</option>${S.members.filter(x=>x.active).map(x=>`<option value="${esc(x.id)}" ${x.id===S.me.id?"selected":""}>${esc(x.name)}</option>`).join("")}</select></div>`
        :`<p class="muted" style="margin:0">Välj storlek för att se färgerna.</p>`}`;
    $("#catSave").disabled = !v || !C.cols.size;
    $("#catSave").textContent = C.cols.size ? `Lägg i boxen (${C.cols.size})` : "Lägg i boxen";
    $$("#catBody [data-cm]").forEach(b=>b.onclick=()=>{ C.m=+b.dataset.cm; C.v=null; C.cols.clear(); draw(); });
    $$("#catBody [data-cv]").forEach(b=>b.onclick=()=>{ C.v=+b.dataset.cv; C.cols.clear(); draw(); });
    $$("#catBody [data-cc]").forEach(b=>b.onclick=()=>{ const c=b.dataset.cc; C.cols.has(c)?C.cols.delete(c):C.cols.add(c); draw(); });
  };
  openOverlay(`<div class="sheet-head"><h2>Från katalogen</h2><button class="x" data-close aria-label="Stäng">${I.x}</button></div>
    <div class="form"><div id="catBody" style="display:grid;gap:18px"></div><div class="err" id="catErr" role="alert"></div>
    <div class="form-actions"><button type="button" class="btn ghost" data-close>Avbryt</button><button type="button" class="btn primary" id="catSave" disabled>Lägg i boxen</button></div></div>`);
  draw();
  $("#catSave").onclick = async () => {
    const m = CATALOG[C.m], v = m.variants[C.v], btn=$("#catSave"); btn.disabled=true; btn.innerHTML=`<span class="spin"></span> Sparar…`;
    const owner = $("#catOwner")?.value || null; let n=0;
    try{
      for (const col of C.cols){
        const name = `${m.brand} ${m.model} ${v[0]} ${v[1]} · ${col}`;
        if (findBaitByName(name)) continue;
        await dbInsert("baits", { name, type:m.type, color:col, size_cm:v[2], weight_g:v[3], brand:m.brand, owner, note:`${m.model}, ${v[1]}. Från katalogen.` }); n++;
      }
      closeOverlay(); render(); toast(`${n} ${n===1?"bete":"beten"} lagda i boxen`);
    }catch(ex){ $("#catErr").textContent=errText(ex); btn.disabled=false; btn.textContent="Lägg i boxen"; }
  };
}
const COLORS = ["Röd","Orange","Chartreuse","Vit","Svart","Guld","Silver","Firetiger","Motor oil","Naturfärg"];
const PCOLORS = ["var(--p1)","var(--p2)","var(--p3)","var(--p4)"];
const LAKE_RADIUS_KM = 2.5;
const TABLES = ["members","lakes","baits","trips","catches"];

const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const ls = { get(k){try{return localStorage.getItem(k)}catch(e){return null}}, set(k,v){try{localStorage.setItem(k,v)}catch(e){}} };
const num = (v) => v == null || v === "" ? null : Number(v);

// ---------- datalager ----------
async function makeSupabaseApi(cfg){
  const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");
  const sb = createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true } });
  const chk = ({ data, error }) => { if (error) throw error; return data; };
  return {
    async session(){ const { data } = await sb.auth.getSession(); return data.session ? { email: data.session.user.email } : null; },
    onAuth(cb){ sb.auth.onAuthStateChange((_e, s) => cb(s ? { email: s.user.email } : null)); },
    async signIn(email, password){ chk(await sb.auth.signInWithPassword({ email, password })); },
    async signUp(email, password){ const d = chk(await sb.auth.signUp({ email, password })); return !!d.session; },
    async signOut(){ await sb.auth.signOut(); },
    async load(table){
      let q = sb.from(table).select("*");
      if (table === "catches") q = q.order("time", { ascending: false }).limit(5000);
      if (table === "trips") q = q.order("started_at", { ascending: false }).limit(3000);
      return chk(await q);
    },
    async insert(table, row){ return chk(await sb.from(table).insert(row).select().single()); },
    async update(table, id, patch){ return chk(await sb.from(table).update(patch).eq("id", id).select().single()); },
    async remove(table, id){
      const d = chk(await sb.from(table).delete().eq("id", id).select("id"));
      if (!d || !d.length) throw new Error("NOT_ALLOWED");
    },
    subscribe(cb){ sb.channel("fangstboken").on("postgres_changes", { event: "*", schema: "public" }, p => cb(p.table)).subscribe(); },
    async upload(blob){
      const path = `${new Date().toISOString().slice(0,7)}/${crypto.randomUUID()}.jpg`;
      chk(await sb.storage.from("photos").upload(path, blob, { contentType: "image/jpeg", upsert: false }));
      return path;
    },
    async signedUrls(paths){
      const d = chk(await sb.storage.from("photos").createSignedUrls(paths, 3600)); const m = {};
      d.forEach(x => { if (x.signedUrl) m[x.path] = x.signedUrl; }); return m;
    },
    async removePhoto(path){ await sb.storage.from("photos").remove([path]); },
    async memberStatus(){ return chk(await sb.rpc("member_status")) || []; },
    async changePassword(email, current, next){
      const r = await sb.auth.signInWithPassword({ email, password: current });
      if (r.error) throw new Error("WRONG_PASSWORD");
      chk(await sb.auth.updateUser({ password: next }));
    },
    async adminSetPassword(email, pw){ chk(await sb.rpc("admin_set_password", { target_email: email, new_password: pw })); },
    async markSeen(){ chk(await sb.rpc("mark_seen")); },
    fetchWeather: openMeteo,
  };
}
// Timväder för en punkt och ett tidsintervall. Senaste dagarna från prognos-API:t, äldre från arkivet.
async function openMeteo(lat, lon, fromMs, toMs){
  const vars = "temperature_2m,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m,cloud_cover,precipitation";
  const d = ms => new Date(ms).toISOString().slice(0,10);
  const qs = `latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}&hourly=${vars}&wind_speed_unit=ms&timezone=GMT&timeformat=unixtime&start_date=${d(fromMs)}&end_date=${d(toMs)}`;
  const fc = `https://api.open-meteo.com/v1/forecast?${qs}`, ar = `https://archive-api.open-meteo.com/v1/archive?${qs}`;
  const urls = toMs > Date.now() - 6*864e5 ? [fc, ar] : [ar, fc];
  for (const u of urls){
    try{
      const r = await fetch(u); if (!r.ok) continue;
      const s = A.compactOpenMeteo(await r.json(), fromMs, toMs);
      const end = Math.min(toMs, Date.now());
      if (s && (A.seriesAt(s, end, "p") != null || A.seriesAt(s, end - H, "p") != null)) return s;
    }catch(e){}
  }
  return null;
}

// ---------- tillstånd ----------
const S = { api:null, session:null, me:null, members:[], lakes:[], baits:[], trips:[], catches:[], loaded:false,
  tab: ls.get("fb.tab") || "feed", who:"all", statSpecies:"all", feedWho:"all", factor:"trend3",
  baitType:"all", baitQ:"", baitSort:"catches", urls:{}, urlAt:0, authMode:"login", _hours:null, _feats:null };
const member = (id) => S.members.find(m => m.id === id);
const byId = (arr, id) => arr.find(x => x.id === id);
const pcolor = (m) => m ? PCOLORS[(m.color ?? 0) % 4] : "var(--muted)";
const initials = (n) => (n||"?").trim().split(/\s+/).map(w=>w[0]).join("").slice(0,2).toUpperCase();
const avatar = (m, cls="") => `<span class="avatar ${cls}" style="background:${pcolor(m)}">${esc(initials(m?.name))}</span>`;
const baitDoc = (c) => c.bait_id ? byId(S.baits, c.bait_id) : null;
const baitName = (c) => baitDoc(c)?.name || c.bait || "";
const baitDesc = (b) => [b.type, b.color, b.size_cm?b.size_cm+" cm":"", b.weight_g?b.weight_g+" g":""].filter(Boolean).join(" · ");
const findBaitByName = (n) => { n=(n||"").trim().toLowerCase(); return n ? S.baits.find(b=>b.name.trim().toLowerCase()===n) : null; };
const km = (a,b,c,d) => { const R=6371,r=Math.PI/180; const x=Math.sin((c-a)*r/2)**2+Math.cos(a*r)*Math.cos(c*r)*Math.sin((d-b)*r/2)**2; return 2*R*Math.asin(Math.sqrt(x)); };
const nearestLake = (lat, lon, max=LAKE_RADIUS_KM) => { let best=null; for (const l of S.lakes){ if(l.lat==null) continue; const d=km(lat,lon,l.lat,l.lon); if(d<=max && (!best||d<best.d)) best={lake:l,d}; } return best; };
const activeTrip = (memberId) => S.trips.find(t => t.member_id === memberId && !t.ended_at);
const invalidate = () => { S._hours = null; S._feats = null; };

// ---------- format ----------
const fmt1 = (n) => (Math.round(n*10)/10).toLocaleString("sv-SE",{maximumFractionDigits:1});
const fmtDelta = (n, unit) => n==null ? "–" : (n>0?"+":n<0?"−":"±")+fmt1(Math.abs(n))+" "+unit;
// Fiskvikt visas i gram (lagras som kg i databasen).
const fmtKg = (kg) => kg == null || kg === "" ? "" : Math.round(Number(kg)*1000).toLocaleString("sv-SE")+" g";
const fmtDate = (iso) => { const d = new Date(iso); return d.toLocaleDateString("sv-SE",{day:"numeric",month:"short"}) + " " + d.toLocaleTimeString("sv-SE",{hour:"2-digit",minute:"2-digit"}); };
const fmtTime = (ms) => new Date(ms).toLocaleTimeString("sv-SE",{hour:"2-digit",minute:"2-digit"});
const fmtDay = (ms) => new Date(ms).toLocaleDateString("sv-SE",{weekday:"short",day:"numeric",month:"short"});
const fmtDateLong = (iso) => new Date(iso).toLocaleString("sv-SE",{weekday:"long",day:"numeric",month:"long",year:"numeric",hour:"2-digit",minute:"2-digit"});
const fmtDur = (ms) => { const m=Math.round(ms/60000), h=Math.floor(m/60); return h ? `${h} h ${String(m%60).padStart(2,"0")} min` : `${m} min`; };
const toLocalInput = (d) => { const p=n=>String(n).padStart(2,"0"); return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
const windDirTxt = (deg) => deg==null ? "" : ["N","NO","O","SO","S","SV","V","NV"][Math.round(deg/45)%8];
function toast(msg){ const h=$("#toastHost"); h.innerHTML=`<div class="toast" role="status">${esc(msg)}</div>`; clearTimeout(toast.t); toast.t=setTimeout(()=>h.innerHTML="",2800); }
const errText = (e) => e?.message==="NOT_ALLOWED" ? "Du kan bara ta bort det du själv har lagt in." : /network|fetch/i.test(e?.message||"") ? "Ingen kontakt med servern. Kontrollera uppkopplingen." : (e?.message || "Något gick fel.");
// Samma regler som i databasen: egna saker, eller allt om man är admin.
const canDeleteCatch = (c) => S.me?.is_admin || c.member_id === S.me?.id || c.created_by === S.me?.id;
const canDeleteLake = (l) => S.me?.is_admin || l.created_by === S.me?.id;

// ---------- ikoner ----------
const I = {
  pin:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0112 2.5a7 7 0 017 7C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>`,
  clock:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>`,
  lure:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v4"/><ellipse cx="12" cy="11" rx="3.5" ry="5"/><path d="M12 16v3a2 2 0 01-4 0"/></svg>`,
  fish:`<svg viewBox="0 0 64 64" fill="currentColor"><path d="M6 32c8-11 19-15 29-11 4 1.7 7.5 4.6 10.3 7.8L55 21v22l-9.7-7.8C42.5 38.4 39 41.3 35 43 25 47 14 43 6 32z"/></svg>`,
  cam:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l2-3h6l2 3h3a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V9a1 1 0 011-1z"/><circle cx="12" cy="13.5" r="3.8"/></svg>`,
  x:`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>`,
  chev:`<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 6l6 6-6 6"/></svg>`,
};

// ---------- start ----------
async function boot(){
  try{
    if (window.__MOCK_API__) S.api = window.__MOCK_API__;
    else {
      const cfg = window.FANGSTBOKEN_CONFIG || {};
      if (!cfg.supabaseUrl || /DITT-PROJEKT/.test(cfg.supabaseUrl) || !cfg.supabaseAnonKey || /KLISTRA/.test(cfg.supabaseAnonKey)){
        $("#main").innerHTML = `<div class="view"><div class="banner warn"><div><b>Appen är inte kopplad till någon databas än.</b><br><span class="muted">Fyll i Supabase-adressen och nyckeln i filen config.js, enligt installationsguiden.</span></div></div></div>`; return;
      }
      S.api = await makeSupabaseApi(cfg);
    }
  }catch(e){ $("#main").innerHTML = `<div class="view"><div class="banner warn">Kunde inte starta: ${esc(errText(e))}</div></div>`; return; }
  S.session = await S.api.session();
  S.api.onAuth(async (s) => { const was = S.session?.email; S.session = s; if ((s?.email||null) !== (was||null)) await afterAuth(); });
  await afterAuth();
}
async function afterAuth(){
  S.loaded = false; S.me = null;
  if (!S.session){ renderAuth(); return; }
  try{ S.members = await S.api.load("members"); }catch(e){ S.members = []; }
  S.me = S.members.find(m => m.email.toLowerCase() === S.session.email.toLowerCase() && m.active) || null;
  if (!S.me){ renderNotMember(); return; }
  await loadAll();
  if (!S.subscribed){ S.subscribed = true; S.api.subscribe(onChange); }
  render();
  markSeen();
  backfillWeather();
}
async function loadAll(){
  const res = await Promise.all(TABLES.map(t => S.api.load(t).catch(() => null)));
  TABLES.forEach((t,i) => { if (res[i]) S[t] = res[i]; });
  S.me = S.members.find(m => m.id === S.me?.id) || S.me;
  S.loaded = true; invalidate();
}
const reloadT = {};
function onChange(table){
  if (!TABLES.includes(table)) return;
  clearTimeout(reloadT[table]);
  reloadT[table] = setTimeout(async () => {
    try{ S[table] = await S.api.load(table); invalidate();
      if (table === "members"){ S.me = S.members.find(m => m.id === S.me?.id && m.active) || null; if (!S.me){ renderNotMember(); return; } }
      render(); }catch(e){}
  }, 350);
}
// Uppdatera lokalt direkt efter egna ändringar, utan att vänta på realtid.
function upsertLocal(table, row){ const i = S[table].findIndex(x => x.id === row.id); if (i >= 0) S[table][i] = row; else S[table].unshift(row); invalidate(); }
function removeLocal(table, id){ S[table] = S[table].filter(x => x.id !== id); invalidate(); }
async function dbInsert(table, row){ const r = await S.api.insert(table, row); upsertLocal(table, r); return r; }
async function dbUpdate(table, id, patch){ const r = await S.api.update(table, id, { ...patch, ...(table!=="members"&&table!=="lakes" ? { updated_at: new Date().toISOString() } : {}) }); upsertLocal(table, r); return r; }
async function dbRemove(table, id){ await S.api.remove(table, id); removeLocal(table, id); }

// ---------- inloggning ----------
function renderAuth(){
  $("#nav").hidden = true; $("#meBtn").hidden = true;
  const login = S.authMode === "login";
  $("#main").innerHTML = `<div class="view auth">
    <h2>${login ? "Logga in" : "Skapa konto"}</h2>
    <p class="muted" style="margin:0">${login ? "Logga in med e-post och lösenord." : "Använd den e-postadress som finns med bland fiskekompisarna. Välj ett lösenord på minst 8 tecken."}</p>
    <form class="panel" id="authForm" novalidate>
      <div class="field"><label for="aEmail">E-post</label><input class="inp" id="aEmail" type="email" autocomplete="email" inputmode="email" required></div>
      <div class="field"><label for="aPw">Lösenord</label><input class="inp" id="aPw" type="password" autocomplete="${login?"current-password":"new-password"}" minlength="8" required></div>
      <div class="err" id="aErr" role="alert"></div>
      <button class="btn primary" type="submit" id="aBtn">${login ? "Logga in" : "Skapa konto"}</button>
    </form>
    <p class="muted" style="margin:0">${login ? `Första gången? <button class="linkbtn" id="aSwitch">Skapa konto</button>` : `Har du redan ett konto? <button class="linkbtn" id="aSwitch">Logga in</button>`}</p>
    ${login?`<p class="muted" style="margin:0">Glömt lösenordet? <button class="linkbtn" id="aForgot">Så gör du</button></p><div id="aForgotBox"></div>`:""}
  </div>`;
  $("#aSwitch").onclick = () => { S.authMode = login ? "signup" : "login"; renderAuth(); };
  if ($("#aForgot")) $("#aForgot").onclick = () => { $("#aForgotBox").innerHTML = `<div class="banner"><div>Be den som administrerar Fångstboken sätta ett <b>tillfälligt lösenord</b> åt dig under Fiskekompisar. Logga sedan in med det och byt till ett eget under <b>Fiskekompisar → Konto → Byt lösenord</b>.</div></div>`; };
  $("#authForm").onsubmit = async (e) => {
    e.preventDefault(); const err=$("#aErr"); err.textContent="";
    const email=$("#aEmail").value.trim(), pw=$("#aPw").value;
    if (!/^\S+@\S+\.\S+$/.test(email)){ err.textContent="Skriv en giltig e-postadress."; return; }
    if (pw.length < 8){ err.textContent="Lösenordet måste ha minst 8 tecken."; return; }
    const btn=$("#aBtn"); btn.disabled=true; btn.innerHTML=`<span class="spin"></span> Vänta…`;
    try{
      if (login) await S.api.signIn(email, pw);
      else { const ok = await S.api.signUp(email, pw); if (!ok){ err.textContent="Kontot är skapat men måste bekräftas via e-post. Be admin stänga av e-postbekräftelse i Supabase (se guiden)."; btn.disabled=false; btn.textContent="Skapa konto"; return; } }
      S.session = await S.api.session(); await afterAuth();
    }catch(ex){
      const m = ex?.message || "";
      err.textContent = /invalid login/i.test(m) ? "Fel e-post eller lösenord." : /already registered|already exists/i.test(m) ? "Det finns redan ett konto med den e-posten. Logga in i stället." : errText(ex);
      btn.disabled=false; btn.textContent= login ? "Logga in" : "Skapa konto";
    }
  };
}
function renderNotMember(){
  $("#nav").hidden = true; $("#meBtn").hidden = true;
  $("#main").innerHTML = `<div class="view auth"><h2>Inte med bland fiskekompisarna än</h2>
    <p style="margin:0">Du är inloggad som <b>${esc(S.session?.email)}</b>, men den adressen finns inte med i Fångstboken.</p>
    <p class="muted" style="margin:0">Be den som administrerar appen lägga till adressen under Fiskekompisar. Ladda sedan om sidan.</p>
    <div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn primary" id="nmReload">Försök igen</button><button class="btn" id="nmOut">Logga ut</button></div></div>`;
  $("#nmReload").onclick = () => afterAuth();
  $("#nmOut").onclick = async () => { await S.api.signOut(); S.session=null; renderAuth(); };
}

// ---------- render ----------
function render(){
  if (!S.me || !S.loaded) return;
  $("#nav").hidden = false;
  const b=$("#meBtn"); b.hidden=false; b.innerHTML = `${avatar(S.me)}<span style="font-weight:600">${esc(S.me.name)}</span>`;
  const moreTabs = ["more","baits","lakes","gang"];
  $$(".tab").forEach(t => t.setAttribute("aria-current", t.dataset.tab===S.tab || (t.dataset.tab==="more" && moreTabs.includes(S.tab)) ? "page" : "false"));
  const views = { feed:renderFeed, trips:renderTrips, stats:()=>`<div class="view" style="gap:32px">${renderTop()}${renderStats()}</div>`, more:renderMore, baits:renderBaits, lakes:renderLakes, gang:renderGang };
  $("#main").innerHTML = (views[S.tab] || renderFeed)() + `<p class="foot">Väderdata: <a href="https://open-meteo.com/" target="_blank" rel="noopener">Open-Meteo.com</a> (CC BY 4.0)</p>`;
  bindView(); hydratePhotos();
}
function go(tab){ S.tab=tab; ls.set("fb.tab",tab); render(); window.scrollTo(0,0); }

// ---------- bilder ----------
const photoImg = (path, alt="", cls="") => path ? `<img ${cls?`class="${cls}"`:""} data-photo="${esc(path)}" alt="${esc(alt)}" loading="lazy">` : "";
async function hydratePhotos(root=document){
  const imgs = $$("img[data-photo]:not([src])", root); if (!imgs.length) return;
  if (Date.now() - S.urlAt > 45*60000){ S.urls = {}; S.urlAt = Date.now(); }
  const missing = [...new Set(imgs.map(i => i.dataset.photo).filter(p => !S.urls[p]))];
  if (missing.length){ try{ Object.assign(S.urls, await S.api.signedUrls(missing)); }catch(e){} }
  imgs.forEach(i => { const u = S.urls[i.dataset.photo]; if (u){ i.src = u; i.onerror = () => i.remove(); } });
}
async function shrink(file){
  const url=URL.createObjectURL(file);
  try{
    const img=await new Promise((res,rej)=>{ const i=new Image(); i.onload=()=>res(i); i.onerror=rej; i.src=url; });
    const max=1600, s=Math.min(1, max/Math.max(img.naturalWidth,img.naturalHeight));
    const c=document.createElement("canvas"); c.width=Math.round(img.naturalWidth*s); c.height=Math.round(img.naturalHeight*s);
    c.getContext("2d").drawImage(img,0,0,c.width,c.height);
    return await new Promise(res=>c.toBlob(b=>res(b||file),"image/jpeg",0.84));
  }catch(e){ return file; } finally { URL.revokeObjectURL(url); }
}

// Bildväljare med två knappar: kameran direkt och galleriet (Android visar annars bara galleriet).
const GALLERY_ICON = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M3 15l5-4 4 3 3-2 6 4"/><circle cx="16" cy="9" r="1.6"/></svg>`;
function photoPicker(id, current, small=false){
  return `<div class="picker${small?" small":""}"><div class="pick-prev" id="${id}Prev">${current?photoImg(current):`<span class="muted">${small?"Ingen bild":"Ingen bild än"}</span>`}</div>
    <div class="photo-btns"><label class="btn" for="${id}Cam">${I.cam.replace("<svg","<svg width=18 height=18")} Ta bild</label><label class="btn" for="${id}Lib">${GALLERY_ICON} Välj bild</label></div>
    <input type="file" id="${id}Cam" accept="image/*" capture="environment" hidden><input type="file" id="${id}Lib" accept="image/*" hidden></div>`;
}
function bindPicker(id, onFile){
  const h=(e)=>{ const f=e.target.files?.[0]; if(!f) return; const p=$("#"+id+"Prev"); p.innerHTML=""; const img=document.createElement("img"); img.alt=""; img.src=URL.createObjectURL(f); p.appendChild(img); onFile(f); };
  $("#"+id+"Cam").onchange=h; $("#"+id+"Lib").onchange=h;
}

// ---------- väder ----------
function tripFor(memberId, ms){
  return S.trips.find(t => t.member_id === memberId && Date.parse(t.started_at) <= ms + 5*60000 && (t.ended_at ? Date.parse(t.ended_at) + 5*60000 : Date.now() + H) >= ms);
}
async function weatherForCatch(c){
  if (c.lat == null) return { weather:null, weather_status:"nopos" };
  const T = Date.parse(c.time);
  const tr = c.trip_id ? byId(S.trips, c.trip_id) : null;
  if (tr?.weather && A.seriesCovers(tr.weather, T - 24*H, Math.round(T/H)*H)){ const w = A.weatherAt(tr.weather, T); if (w) return { weather:w, weather_status:"done" }; }
  if (T > Date.now() + H) return { weather:null, weather_status:"pending" };
  const s = await S.api.fetchWeather(c.lat, c.lon, T - 25*H, T + H);
  const w = s && A.weatherAt(s, T);
  return w ? { weather:w, weather_status:"done" } : { weather:null, weather_status:"pending" };
}
async function weatherForTrip(t){
  if (!t.ended_at) return null;
  let lat=t.lat, lon=t.lon;
  if (lat == null){ const l = t.lake_id && byId(S.lakes, t.lake_id); if (l?.lat != null){ lat=l.lat; lon=l.lon; } }
  if (lat == null){ const c = S.catches.find(x => x.trip_id === t.id && x.lat != null); if (c){ lat=c.lat; lon=c.lon; } }
  if (lat == null) return { weather_status:"nopos" };
  const s0 = Date.parse(t.started_at), e0 = Math.min(Date.parse(t.ended_at), s0 + 7*24*H);
  const s = await S.api.fetchWeather(lat, lon, s0 - 25*H, e0 + H);
  return s ? { weather:s, weather_status:"done", lat, lon } : null;
}
let backfilling = false;
async function backfillWeather(){
  if (backfilling) return; backfilling = true;
  try{
    const trips = S.trips.filter(t => t.ended_at && t.weather_status === "pending").slice(0, 6);
    for (const t of trips){ const p = await weatherForTrip(t); if (p) await dbUpdate("trips", t.id, p).catch(()=>{}); }
    const cs = S.catches.filter(c => c.weather_status === "pending" && c.lat != null).slice(0, 12);
    for (const c of cs){ const p = await weatherForCatch(c); if (p.weather_status !== "pending") await dbUpdate("catches", c.id, p).catch(()=>{}); }
    if (trips.length || cs.length) render();
  } finally { backfilling = false; }
}

// ---------- analysunderlag ----------
function analysis(){
  if (S._hours) return S._hours;
  const feats = new Map(S.catches.map(c => [c.id, A.catchFeatures(c)]));
  const hoursAll = A.fishedHours(S.trips);
  const tripsDone = new Set(S.trips.filter(t => t.ended_at && t.weather).map(t => t.id));
  return (S._hours = { feats, hoursAll, tripsDone });
}

// ---------- fångstflödet ----------
function wxChips(c){
  const w=c.weather, out=[];
  if (c.depth_m!=null || c.fish_depth_m!=null) out.push(`<span>${esc(depthTxt(c))}</span>`);
  if (c.water_temp_c!=null) out.push(`<span>Vatten ${fmt1(c.water_temp_c)}°C</span>`);
  if (w){
    if (w.tempC!=null) out.push(`<span>${Math.round(w.tempC)}°C</span>`);
    if (w.pressure!=null) out.push(`<span>${Math.round(w.pressure)} hPa${w.pressureTrend?" "+({stigande:"↗",stabilt:"→",fallande:"↘"}[w.pressureTrend]||""):""}</span>`);
    if (w.windMs!=null) out.push(`<span>${windDirTxt(w.windDir)} ${Math.round(w.windMs)} m/s</span>`);
    if (w.cloudPct!=null) out.push(`<span>${w.cloudPct<25?"Klart":w.cloudPct<75?"Halvklart":"Mulet"}</span>`);
    if (w.precipMm>0.1) out.push(`<span>Regn ${fmt1(w.precipMm)} mm</span>`);
  } else if (c.weather_status==="pending") out.push(`<span class="pend">Väder hämtas</span>`);
  else if (c.weather_status==="nopos") out.push(`<span class="pend">Väder saknas, ingen position</span>`);
  if (c.light) out.push(`<span>${esc(c.light)}</span>`);
  if (c.moon) out.push(`<span>${esc(c.moon.phase)}</span>`);
  return out.join("");
}
// Djup: bottendjup och ungefärligt djup där fisken högg.
function depthTxt(c){
  const b=c.depth_m, f=c.fish_depth_m;
  if (b!=null && f!=null) return `Botten ${fmt1(b)} m · högg på ${fmt1(f)} m`;
  if (b!=null) return `Botten ${fmt1(b)} m`;
  return `Högg på ${fmt1(f)} m`;
}
const DEPTH_BUCKETS=[["0–2 m",0,2],["2–4 m",2,4],["4–6 m",4,6],["6–10 m",6,10],["10–15 m",10,15],["15 m och djupare",15,1e9]];
const depthBars=(vals)=>hbars(DEPTH_BUCKETS.map(([k,a,b])=>[k,vals.filter(v=>v>=a&&v<b).length]),6);
function card(c){
  const m=member(c.member_id);
  const size=[fmtKg(c.weight_kg), c.length_cm?`<small>${fmt1(c.length_cm)} cm</small>`:""].filter(Boolean).join(" ");
  return `<button class="card" data-open="${esc(c.id)}">
    <div class="ph"><div class="noimg">${I.fish}</div>${photoImg(c.photo, c.species)}${c.released?`<span class="tag cr">Återutsatt</span>`:""}</div>
    <div class="body">
      <div class="row1"><span class="species">${esc(c.species)}</span><span class="size num">${size}</span></div>
      <div class="meta"><span>${I.clock}${esc(fmtDate(c.time))}</span>${c.lake_name?`<span>${I.pin}${esc(c.lake_name)}</span>`:""}
        ${baitName(c)?`<span>${I.lure}${esc(baitName(c))}${c.technique?" · "+esc(c.technique):""}</span>`:""}</div>
      <div class="wx">${wxChips(c)}</div>
      <div class="who">${avatar(m,"sm")}${esc(m?.name||"Tidigare medlem")}</div>
    </div></button>`;
}
function whoFilter(key){
  return `<div class="seg" role="group" aria-label="Filtrera på fiskare"><button class="chip small" data-wf="${key}" data-id="all" aria-pressed="${S[key]==="all"}">Alla</button>
    ${S.members.filter(m=>m.active).map(m=>`<button class="chip small" data-wf="${key}" data-id="${esc(m.id)}" aria-pressed="${S[key]===m.id}" style="display:inline-flex;gap:6px;align-items:center"><span class="avatar sm" style="background:${pcolor(m)};width:16px;height:16px;font-size:0"></span>${esc(m.name)}</button>`).join("")}</div>`;
}
function tripBars(){
  const live = S.trips.filter(t => !t.ended_at);
  const mine = live.find(t => t.member_id === S.me.id);
  const others = live.filter(t => t.member_id !== S.me.id);
  const bar = (t, own) => { const m=member(t.member_id), l=byId(S.lakes,t.lake_id), n=S.catches.filter(c=>c.trip_id===t.id).length;
    return `<div class="tripbar live"><span class="dot"></span><div class="txt"><b>${own?"Du fiskar":esc(m?.name||"")+" fiskar"}${l?" på "+esc(l.name):""}</b><span>Sedan ${fmtTime(Date.parse(t.started_at))} · ${n} ${n===1?"fångst":"fångster"}</span></div>
      ${own?`<button class="btn" data-trip-end="${esc(t.id)}">Avsluta</button>`:`<button class="btn ghost" data-trip-open="${esc(t.id)}">Visa</button>`}</div>`; };
  return (mine ? bar(mine, true) : `<div class="tripbar"><div class="txt"><b>Ute och fiskar?</b><span>Starta en tur så räknas timmarna, även de utan napp.</span></div><button class="btn primary" data-trip-start>Starta tur</button></div>`)
    + others.map(t => bar(t, false)).join("");
}
function renderFeed(){
  const list = S.catches.filter(c => S.feedWho==="all" || c.member_id===S.feedWho);
  const pending = S.catches.filter(c=>c.weather_status==="pending").length;
  return `<div class="view">${tripBars()}
    <div class="section-head"><h2>Fångster</h2><span class="muted num">${list.length} st${pending?` · ${pending} väntar på väder`:""}</span></div>
    ${S.members.filter(m=>m.active).length>1?whoFilter("feedWho"):""}
    ${S.catches.length ? `<div class="feed">${list.map(card).join("") || `<p class="muted">Inga fångster för den här fiskaren än.</p>`}</div>`
      : `<div class="empty"><h3 style="font-size:22px">Inga fångster än</h3><p class="muted" style="margin:0">Tryck på plusknappen och börja med bilden. Tid och position läses från fotot, vattnet känns igen och vädret hämtas direkt.</p><div><button class="btn primary" data-new>Registrera första fångsten</button></div></div>`}
  </div>`;
}

// ---------- turer ----------
function tripStats(t){
  const cs = S.catches.filter(c => c.trip_id === t.id);
  const s = Date.parse(t.started_at), e = t.ended_at ? Date.parse(t.ended_at) : Date.now();
  return { cs, dur: e - s, rate: (e - s) > 0 ? cs.length / ((e - s) / H) : 0 };
}
function tripRow(t){
  const m=member(t.member_id), l=byId(S.lakes,t.lake_id), st=tripStats(t), s=Date.parse(t.started_at);
  return `<button class="trip" data-trip-open="${esc(t.id)}"><span class="nm">${esc(l?.name||"Okänt vatten")}${t.ended_at?"":` <span class="tag-unsure" style="color:var(--good);border-color:var(--good)">pågår</span>`}</span>
    <span class="c num">${st.cs.length}<small>${st.cs.length===1?"fångst":"fångster"}</small></span>
    <span class="sub">${avatar(m,"sm")} ${esc(m?.name||"")} · ${esc(fmtDay(s))} ${fmtTime(s)}–${t.ended_at?fmtTime(Date.parse(t.ended_at)):"nu"} · ${fmtDur(st.dur)}${t.ended_at&&st.dur>=30*60000?` · ${fmt1(st.rate)} per timme`:""}</span></button>`;
}
function renderTrips(){
  const list = S.trips.filter(t => S.feedWho==="all" || t.member_id===S.feedWho);
  const hours = analysis().hoursAll.reduce((a,h)=>a+h.w,0);
  return `<div class="view">${tripBars()}
    <div class="section-head"><h2>Fisketurer</h2><span class="muted num">${S.trips.length} turer · ${fmt1(hours)} fiskade timmar med väder</span></div>
    <div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn" data-trip-past>＋ Lägg in tur i efterhand</button></div>
    ${S.members.filter(m=>m.active).length>1?whoFilter("feedWho"):""}
    ${list.length?`<div class="trips">${list.map(tripRow).join("")}</div>`:`<div class="empty"><p class="muted" style="margin:0">Inga turer än. Tryck på Starta tur när du börjar fiska och Avsluta när du slutar. Fångster du registrerar under tiden kopplas till turen, och timmarna utan napp räknas också. Det är det som gör mönstren pålitliga.</p></div>`}
  </div>`;
}
async function startTrip(){
  const host = openOverlay(`<div class="sheet-head"><h2>Starta tur</h2><button class="x" data-close aria-label="Stäng">${I.x}</button></div>
    <form class="form" id="tsf" novalidate>
      <div class="field"><label for="tsLake">Vatten</label>${lakeSelect("tsLake","")}<input class="inp" id="tsLakeNew" placeholder="Namn på sjö eller plats" hidden maxlength="60"><span class="muted" id="tsHint" style="font-size:13px">Söker position…</span></div>
      <div class="err" id="tsErr" role="alert"></div>
      <div class="form-actions"><button type="button" class="btn ghost" data-close>Avbryt</button><button type="submit" class="btn primary" id="tsSave">Starta nu</button></div>
    </form>`);
  let pos = null;
  const sel=$("#tsLake"), nw=$("#tsLakeNew");
  sel.onchange = () => { nw.hidden = sel.value!=="__new"; if (!nw.hidden) nw.focus(); };
  getPosition().then(p => { pos = p; const h=$("#tsHint"); if (!h) return;
    if (!p){ h.textContent = "Ingen position från telefonen. Välj vatten själv."; return; }
    const m = nearestLake(p.lat, p.lon);
    if (m){ sel.value = m.lake.id; h.textContent = `Känns igen: ${m.lake.name} (${m.d<1?Math.round(m.d*1000)+" m":fmt1(m.d)+" km"} bort)`; }
    else { sel.value = "__new"; nw.hidden = false; h.textContent = "Nytt ställe. Skriv namnet så känns det igen nästa gång."; }
  });
  $("#tsf").onsubmit = async (e) => {
    e.preventDefault(); const err=$("#tsErr"); err.textContent="";
    if (sel.value==="__new" && !nw.value.trim()){ err.textContent="Skriv namnet på vattnet."; return; }
    const btn=$("#tsSave"); btn.disabled=true; btn.innerHTML=`<span class="spin"></span> Startar…`;
    try{
      const lake = await resolveLake(sel.value, nw.value.trim(), pos);
      let lat = pos?.lat ?? lake?.lat ?? null, lon = pos?.lon ?? lake?.lon ?? null;
      await dbInsert("trips", { member_id:S.me.id, lake_id:lake?.id||null, lat, lon, started_at:new Date().toISOString() });
      closeOverlay(); render(); toast("Turen är startad. Lycka till!");
    }catch(ex){ err.textContent=errText(ex); btn.disabled=false; btn.textContent="Starta nu"; }
  };
  return host;
}
function getPosition(){
  return new Promise(res => {
    if (!navigator.geolocation) return res(null);
    navigator.geolocation.getCurrentPosition(p => res({ lat:p.coords.latitude, lon:p.coords.longitude }), () => res(null), { enableHighAccuracy:true, timeout:8000, maximumAge:120000 });
  });
}
async function endTrip(id){
  const t = byId(S.trips, id); if (!t) return;
  try{
    let r = await dbUpdate("trips", id, { ended_at: new Date().toISOString() });
    toast("Turen är avslutad. Hämtar väder…");
    await linkCatches(r); render();
    const p = await weatherForTrip(r); if (p) r = await dbUpdate("trips", id, p);
    render(); openTrip(id);
  }catch(ex){ toast(errText(ex)); }
}
// Koppla medlemmens fångster inom turens tid till turen.
async function linkCatches(t){
  const s = Date.parse(t.started_at) - 5*60000, e = (t.ended_at ? Date.parse(t.ended_at) : Date.now()) + 5*60000;
  const cs = S.catches.filter(c => c.member_id === t.member_id && !c.trip_id && Date.parse(c.time) >= s && Date.parse(c.time) <= e);
  for (const c of cs) await dbUpdate("catches", c.id, { trip_id: t.id }).catch(()=>{});
}
function tripForm(edit=null){
  const now = new Date(), s0 = edit ? new Date(edit.started_at) : new Date(now.getTime()-3*H), e0 = edit?.ended_at ? new Date(edit.ended_at) : (edit ? null : now);
  openOverlay(`<div class="sheet-head"><h2>${edit?"Redigera tur":"Tur i efterhand"}</h2><button class="x" data-close aria-label="Stäng">${I.x}</button></div>
    <form class="form" id="tpf" novalidate>
      <div class="field"><label for="tpLake">Vatten</label>${lakeSelect("tpLake", edit?.lake_id||"")}<input class="inp" id="tpLakeNew" placeholder="Namn på sjö eller plats" hidden maxlength="60"></div>
      <div class="field"><label for="tpWho">Fiskare</label><select class="inp" id="tpWho">${S.members.filter(m=>m.active||m.id===edit?.member_id).map(m=>`<option value="${esc(m.id)}" ${m.id===(edit?.member_id||S.me.id)?"selected":""}>${esc(m.name)}</option>`).join("")}</select></div>
      <div class="row2"><div class="field"><label for="tpS">Start</label><input class="inp" type="datetime-local" id="tpS" value="${toLocalInput(s0)}"></div>
        <div class="field"><label for="tpE">Slut</label><input class="inp" type="datetime-local" id="tpE" value="${e0?toLocalInput(e0):""}"></div></div>
      <div class="field"><label for="tpNote">Anteckning</label><textarea class="inp" id="tpNote" rows="2" placeholder="Vilka som var med, var ni låg…">${esc(edit?.note||"")}</textarea></div>
      <div class="err" id="tpErr" role="alert"></div>
      <div class="form-actions"><button type="button" class="btn ghost" data-close>Avbryt</button><button type="submit" class="btn primary" id="tpSave">Spara tur</button></div>
    </form>`);
  const sel=$("#tpLake"), nw=$("#tpLakeNew"); sel.onchange=()=>{ nw.hidden = sel.value!=="__new"; };
  $("#tpf").onsubmit = async (e) => {
    e.preventDefault(); const err=$("#tpErr"); err.textContent="";
    const s=new Date($("#tpS").value), en=$("#tpE").value?new Date($("#tpE").value):null;
    if (isNaN(s)){ err.textContent="Ange starttid."; return; }
    if (en && !(en>s)){ err.textContent="Sluttiden måste vara efter starttiden."; return; }
    if (en && en - s > 7*24*H){ err.textContent="En tur kan vara högst en vecka."; return; }
    if (!en && !edit){ err.textContent="Ange när turen slutade."; return; }
    if (sel.value==="__new" && !nw.value.trim()){ err.textContent="Skriv namnet på vattnet."; return; }
    const btn=$("#tpSave"); btn.disabled=true; btn.innerHTML=`<span class="spin"></span> Sparar…`;
    try{
      const lake = await resolveLake(sel.value, nw.value.trim(), null);
      const changed = !edit || edit.started_at!==s.toISOString() || (edit.ended_at||null)!==(en?en.toISOString():null) || edit.lake_id!==(lake?.id||null);
      const row = { member_id:$("#tpWho").value, lake_id:lake?.id||null, started_at:s.toISOString(), ended_at:en?en.toISOString():null, note:$("#tpNote").value.trim(),
        ...(changed ? { weather:null, weather_status:"pending", lat: lake?.lat ?? edit?.lat ?? null, lon: lake?.lon ?? edit?.lon ?? null } : {}) };
      let t = edit ? await dbUpdate("trips", edit.id, row) : await dbInsert("trips", row);
      await linkCatches(t);
      if (t.ended_at && t.weather_status==="pending"){ const p = await weatherForTrip(t); if (p) t = await dbUpdate("trips", t.id, p); }
      closeOverlay(); render(); openTrip(t.id); toast(edit?"Turen är uppdaterad":"Turen är sparad");
    }catch(ex){ err.textContent=errText(ex); btn.disabled=false; btn.textContent="Spara tur"; }
  };
}
function openTrip(id){
  const t = byId(S.trips, id); if (!t) return;
  const m=member(t.member_id), l=byId(S.lakes,t.lake_id), st=tripStats(t), s=Date.parse(t.started_at);
  const periods = A.bitePeriods(st.cs, { min: 2, gapMin: 30 });
  const w = t.weather ? A.weatherAt(t.weather, s) : null;
  const host = openOverlay(`<div class="sheet-head"><h2>${esc(l?.name||"Tur")}</h2><button class="x" data-close aria-label="Stäng">${I.x}</button></div>
    <div style="display:grid;gap:16px">
      <div class="who">${avatar(m,"sm")}${esc(m?.name||"")} · ${esc(fmtDay(s))} ${fmtTime(s)}–${t.ended_at?fmtTime(Date.parse(t.ended_at)):"pågår"}</div>
      <div class="tiles" style="grid-template-columns:repeat(3,1fr)">
        <div class="tile"><span class="label">Tid</span><span class="v" style="font-size:22px">${fmtDur(st.dur)}</span></div>
        <div class="tile"><span class="label">Fångster</span><span class="v">${st.cs.length}</span></div>
        <div class="tile"><span class="label">Per timme</span><span class="v">${st.dur>=30*60000?fmt1(st.rate):"–"}</span></div>
      </div>
      ${t.note?`<p style="margin:0">${esc(t.note)}</p>`:""}
      ${t.weather ? `<section class="panel"><h3>Tidslinje</h3><p class="sub">Dygnet före och under turen. Grått fält är turen${periods.length?", orange fält är huggperioder":""}, prickarna är fångster.</p>${timeline(t, st.cs, periods)}
          ${w?`<div class="facts"><span>Vid start: ${w.tempC!=null?fmt1(w.tempC)+" °C":""}</span><span>${w.pressure!=null?Math.round(w.pressure)+" hPa":""}</span><span>Tryck 24 h: ${fmtDelta(w.pressureDelta24h,"hPa")}</span><span>Vind ${windDirTxt(w.windDir)} ${w.windMs!=null?fmt1(w.windMs)+" m/s":""}</span></div>`:""}</section>`
        : `<div class="banner">${t.ended_at ? (t.weather_status==="nopos" ? "Turen saknar position, så väder kan inte hämtas. Välj ett vatten med position eller registrera en fångst med GPS-bild." : `<span class="spin"></span> Vädret för turen hämtas.`) : "Tidslinjen visas när turen är avslutad."}</div>`}
      ${st.cs.length?`<section class="panel"><h3>Fångster på turen</h3><div class="list">${st.cs.slice().sort((a,b)=>Date.parse(a.time)-Date.parse(b.time)).map(c=>`<button class="row" data-open="${esc(c.id)}"><div class="grow"><b>${esc(c.species)}${c.weight_kg?" · "+esc(fmtKg(c.weight_kg)):""}</b><span>${fmtTime(Date.parse(c.time))} · ${esc(member(c.member_id)?.name||"")}${baitName(c)?" · "+esc(baitName(c)):""}</span></div><span class="chev">${I.chev}</span></button>`).join("")}</div></section>`:""}
      <div style="display:flex;gap:10px;flex-wrap:wrap">${t.ended_at?"":`<button class="btn primary" id="tEnd">Avsluta turen</button>`}<button class="btn" id="tEdit">Redigera</button><button class="btn danger ghost" id="tDel">Ta bort</button></div>
      <div id="tConfirm"></div>
    </div>`);
  bindTimeline(host);
  host.querySelectorAll("[data-open]").forEach(b=>b.onclick=()=>openDetail(b.dataset.open));
  if ($("#tEnd")) $("#tEnd").onclick=()=>{ closeOverlay(); endTrip(id); };
  $("#tEdit").onclick=()=>tripForm(t);
  $("#tDel").onclick=()=>{
    $("#tConfirm").innerHTML=`<div class="banner warn" style="display:grid;gap:10px"><span>Ta bort turen? Fångsterna finns kvar men kopplas loss från turen.</span><div style="display:flex;gap:10px"><button class="btn danger" id="tYes">Ta bort</button><button class="btn ghost" id="tNo">Avbryt</button></div></div>`;
    $("#tNo").onclick=()=>$("#tConfirm").innerHTML="";
    $("#tYes").onclick=async()=>{ try{ await dbRemove("trips", id); S.catches.forEach(c=>{ if(c.trip_id===id) c.trip_id=null; }); closeOverlay(); render(); toast("Turen är borttagen"); }catch(e){ toast(errText(e)); } };
  };
}

// ---------- tidslinje (två diagram med gemensam tidsaxel) ----------
const TL = new Map();
function timeline(t, cs, periods){
  const s = Date.parse(t.started_at), e = Date.parse(t.ended_at);
  const x0 = Math.max(t.weather.t0, s - 12*H), x1 = Math.min(t.weather.t0 + (t.weather.t.length-1)*H, e + H);
  const pts = []; for (let ms = Math.ceil(x0/H)*H; ms <= x1; ms += H) pts.push(ms);
  const id = "tl" + Math.random().toString(36).slice(2,8);
  TL.set(id, { t, cs, pts, x0, x1 });
  const W=600, PL=44, PR=10, HT=120, PT=10, PB=22;
  const X = ms => PL + (ms - x0) / (x1 - x0 || 1) * (W - PL - PR);
  const chart = (key, label, unit, digits) => {
    const vals = pts.map(ms => A.seriesAt(t.weather, ms, key)).filter(v=>v!=null);
    if (vals.length < 2) return "";
    const [lo, hi, pad] = yRange(vals, key);
    const Y = v => PT + (1 - (v - lo) / (hi - lo)) * (HT - PT - PB);
    const d = pts.map(ms => [ms, A.seriesAt(t.weather, ms, key)]).filter(p=>p[1]!=null).map((p,i)=>`${i?"L":"M"}${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join("");
    const ticks = [lo+pad, (lo+hi)/2, hi-pad];
    const xt = []; for (let ms = Math.ceil(x0/(3*H))*3*H; ms <= x1; ms += 3*H) xt.push(ms);
    return `<div class="tl" data-tl="${id}" data-key="${key}"><h4>${label}</h4>
      <svg viewBox="0 0 ${W} ${HT}" role="img" aria-label="${label} under turen">
        <rect class="span" x="${X(s).toFixed(1)}" y="${PT}" width="${Math.max(1,X(e)-X(s)).toFixed(1)}" height="${HT-PT-PB}"/>
        ${periods.map(p=>`<rect class="band" x="${X(p.start-10*60000).toFixed(1)}" y="${PT}" width="${Math.max(4,X(p.end+10*60000)-X(p.start-10*60000)).toFixed(1)}" height="${HT-PT-PB}"/>`).join("")}
        <g class="grid">${ticks.map(v=>`<line x1="${PL}" x2="${W-PR}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}"/>`).join("")}</g>
        ${ticks.map(v=>`<text class="ylab" x="${PL-6}" y="${(Y(v)+4).toFixed(1)}" text-anchor="end">${v.toLocaleString("sv-SE",{maximumFractionDigits:digits})}</text>`).join("")}
        <g class="axis">${key==="t"?xt.map(ms=>`<text x="${X(ms).toFixed(1)}" y="${HT-6}" text-anchor="middle">${fmtTime(ms)}</text>`).join(""):""}</g>
        <path class="line" d="${d}"/>
        ${cs.map(c=>{ const ms=Date.parse(c.time), v=interp(t.weather, ms, key); return v==null||ms<x0||ms>x1?"":`<circle class="mk" cx="${X(ms).toFixed(1)}" cy="${Y(v).toFixed(1)}" r="5"/>`; }).join("")}
        <line class="xh" y1="${PT}" y2="${HT-PB}" x1="-10" x2="-10" hidden/><circle class="hitdot" r="4" cx="-10" cy="-10" hidden/>
        <rect x="${PL}" y="0" width="${W-PL-PR}" height="${HT}" fill="transparent" data-hit/>
      </svg></div>`;
  };
  return `<div style="display:grid;gap:10px;position:relative" data-tlwrap="${id}">${chart("p","Lufttryck, hPa","hPa",0)}${chart("t","Lufttemperatur, °C","°C",1)}
    <div class="tl-legend"><span><i style="background:var(--surface2)"></i>Turen</span>${periods.length?`<span><i style="background:var(--accent-soft)"></i>Huggperiod</span>`:""}<span><i style="background:var(--accent);border-radius:50%;width:10px"></i>Fångst</span></div></div>`;
}
// Y-skala med minsta spann (4 hPa / 3 °C) så att en nästan platt kurva inte ser dramatisk ut.
function yRange(vals, key){
  let lo=Math.min(...vals), hi=Math.max(...vals); const minSpan = key==="p" ? 4 : 3;
  if (hi-lo < minSpan){ const m=(hi+lo)/2; lo=m-minSpan/2; hi=m+minSpan/2; }
  const pad=(hi-lo)*0.15; return [lo-pad, hi+pad, pad];
}
function interp(s, ms, key){ const a=Math.floor(ms/H)*H, va=A.seriesAt(s,a,key), vb=A.seriesAt(s,a+H,key); if(va==null) return vb; if(vb==null) return va; return va+(vb-va)*(ms-a)/H; }
function bindTimeline(root){
  root.querySelectorAll("[data-tlwrap]").forEach(wrap => {
    const info = TL.get(wrap.dataset.tlwrap); if (!info) return;
    const charts = [...wrap.querySelectorAll(".tl")];
    const W=600, PL=44, PR=10, HT=120, PT=10, PB=22;
    const X = ms => PL + (ms - info.x0) / (info.x1 - info.x0 || 1) * (W - PL - PR);
    const hide = () => { charts.forEach(c=>{ c.querySelector(".xh").setAttribute("hidden",""); c.querySelector(".hitdot").setAttribute("hidden",""); }); wrap.querySelector(".tl-tip")?.remove(); };
    const show = (evt, svg) => {
      const r = svg.getBoundingClientRect(), vx = (evt.clientX - r.left) / r.width * W;
      const ms = info.x0 + (vx - PL) / (W - PL - PR) * (info.x1 - info.x0);
      const hr = Math.round(ms / H) * H; if (hr < info.x0 || hr > info.x1){ hide(); return; }
      charts.forEach(c => {
        const key = c.dataset.key, v = A.seriesAt(info.t.weather, hr, key), sv = c.querySelector("svg");
        const vals = info.pts.map(p=>A.seriesAt(info.t.weather,p,key)).filter(x=>x!=null);
        const [lo, hi] = yRange(vals, key);
        const y = v==null?-10:PT + (1 - (v - lo) / (hi - lo)) * (HT - PT - PB);
        const xh = sv.querySelector(".xh"), dot = sv.querySelector(".hitdot");
        xh.setAttribute("x1", X(hr)); xh.setAttribute("x2", X(hr)); xh.removeAttribute("hidden");
        dot.setAttribute("cx", X(hr)); dot.setAttribute("cy", y); if (v!=null) dot.removeAttribute("hidden");
      });
      const w = A.weatherAt(info.t.weather, hr);
      const n = info.cs.filter(c => Math.abs(Date.parse(c.time) - hr) <= 30*60000).length;
      let tip = wrap.querySelector(".tl-tip"); if (!tip){ tip = document.createElement("div"); tip.className = "tl-tip"; wrap.appendChild(tip); }
      tip.innerHTML = `<b>${esc(fmtDay(hr))} ${fmtTime(hr)}</b><br>${w?.pressure!=null?Math.round(w.pressure)+" hPa ("+fmtDelta(w.pressureDelta3h,"på 3 h")+")":""}<br>${w?.tempC!=null?fmt1(w.tempC)+" °C":""} · ${w?.windMs!=null?windDirTxt(w.windDir)+" "+fmt1(w.windMs)+" m/s":""}${n?`<br>${n} ${n===1?"fångst":"fångster"}`:""}`;
      const wr = wrap.getBoundingClientRect();
      tip.style.left = Math.min(Math.max(evt.clientX - wr.left, 80), wr.width - 80) + "px"; tip.style.top = (r.top - wr.top + 4) + "px";
    };
    charts.forEach(c => { const svg=c.querySelector("svg"), hit=svg.querySelector("[data-hit]");
      hit.addEventListener("pointermove", e => show(e, svg)); hit.addEventListener("pointerdown", e => show(e, svg)); hit.addEventListener("pointerleave", hide); });
  });
}

// ---------- statistik ----------
const count = (arr, fn) => { const m=new Map(); for (const x of arr){ const k=fn(x); if(k==null||k==="") continue; m.set(k,(m.get(k)||0)+1);} return [...m.entries()].sort((a,b)=>b[1]-a[1]); };
function hbars(rows, max=8){
  if (!rows.length) return `<p class="muted" style="margin:0">Inga data än.</p>`;
  const top=rows.slice(0,max), m=Math.max(...top.map(r=>r[1]),1);
  return `<div class="hbars">${top.map(([k,v])=>`<div class="hbar"><span class="n" title="${esc(k)}">${esc(k)}</span><span class="t"><span class="f" style="width:${v?Math.max(3,v/m*100):0}%;display:block"></span></span><span class="c">${v}</span></div>`).join("")}</div>`;
}
function cols(values, labels, labelEvery=1, unit="fångster"){
  const m=Math.max(...values,0), n=values.length, gt=`grid-template-columns:repeat(${n},1fr)`, peak=values.indexOf(m);
  return `<div><div class="cols" style="${gt}">${values.map((v,i)=>`<div class="col" data-tip="${esc(labels[i])}: ${v} ${unit}">${v?`<i style="height:${v/m*100}%"></i>`:`<i class="zero"></i>`}${i===peak&&m>0?`<b style="bottom:calc(${v/m*100}% + 3px)">${v}</b>`:""}</div>`).join("")}</div>
    <div class="axis" style="${gt}">${labels.map((l,i)=>`<span>${i%labelEvery===0?esc(l):""}</span>`).join("")}</div></div>`;
}
const TREND_BUCKETS=[["Stigande",d=>d>1],["Stabilt",d=>d>=-1&&d<=1],["Fallande",d=>d<-1]];
const D24_BUCKETS=[["Stigit mer än 4",d=>d>4],["Stigit 1–4",d=>d>1&&d<=4],["Oförändrat ±1",d=>d>=-1&&d<=1],["Fallit 1–4",d=>d<-1&&d>=-4],["Fallit mer än 4",d=>d<-4]];
function compare(buckets, catchVals, baseVals, baseWeights){
  const cv=catchVals.filter(v=>v!=null);
  if (!cv.length) return `<p class="muted" style="margin:0">Visas när fångsterna har fått väderdata.</p>`;
  const bw = baseVals.map((v,i)=>[v, baseWeights?baseWeights[i]:1]).filter(x=>x[0]!=null), bTot = bw.reduce((a,x)=>a+x[1],0), showBase = bTot >= 6;
  const rows=buckets.map(([label,fn])=>{ const n=cv.filter(fn).length; return {label,n,cs:n/cv.length,bs:showBase?bw.filter(x=>fn(x[0])).reduce((a,x)=>a+x[1],0)/bTot:null}; });
  const max=Math.max(...rows.map(r=>Math.max(r.cs,r.bs||0)),0.01);
  return `<div class="cmp">${rows.map(r=>`<div class="cmp-row"><span class="n" title="${esc(r.label)}">${esc(r.label)}</span><span class="t"><span class="f" style="width:${r.cs/max*100}%"></span>${r.bs!=null?`<i class="b" style="left:${r.bs/max*100}%"></i>`:""}</span><span class="c">${Math.round(r.cs*100)}%<small>${r.n} st</small></span></div>`).join("")}</div>
    ${showBase?`<div class="legend"><span><i></i>Andel av fångsterna</span><span><i class="b"></i>Andel av er fiskade tid (${fmt1(bTot)} h)</span></div>`:`<div class="legend"><span>Jämförelse mot tiden ni fiskade visas när ni har minst 6 timmar loggade turer.</span></div>`}`;
}
function insight(list){
  if (list.length<5) return "";
  const hrs=count(list,c=>new Date(c.time).getHours()), baits=count(list,baitName), parts=[];
  if (hrs.length) parts.push(`flest hugg mellan <b>${String(hrs[0][0]).padStart(2,"0")}–${String((+hrs[0][0]+1)%24).padStart(2,"0")}</b>`);
  if (baits.length) parts.push(`<b>${esc(baits[0][0])}</b> har tagit mest fisk (${baits[0][1]})`);
  return parts.length ? `<p class="insight" style="margin:0">Hittills: ${parts.join(", ")}.</p>` : "";
}
function renderStats(){
  const an = analysis();
  const all=S.catches.filter(c=>S.who==="all"||c.member_id===S.who);
  const list=all.filter(c=>S.statSpecies==="all"||c.species===S.statSpecies);
  const speciesAvail=count(all,c=>c.species).map(x=>x[0]);
  const heaviest=list.filter(c=>c.weight_kg).sort((a,b)=>b.weight_kg-a.weight_kg)[0];
  const rel=list.length?Math.round(list.filter(c=>c.released).length/list.length*100):0;
  const hours=Array(24).fill(0); list.forEach(c=>hours[new Date(c.time).getHours()]++);
  const months=Array(12).fill(0); list.forEach(c=>months[new Date(c.time).getMonth()]++);
  const withWx=list.filter(c=>c.weather).length;
  const wt=list.filter(c=>c.water_temp_c!=null).map(c=>Number(c.water_temp_c));
  const bd=list.filter(c=>c.depth_m!=null).map(c=>Number(c.depth_m)), fd=list.filter(c=>c.fish_depth_m!=null).map(c=>Number(c.fish_depth_m));
  const avg=(a)=>fmt1(a.reduce((x,y)=>x+y,0)/a.length);
  const tripIds = new Set(S.trips.filter(t => S.who==="all" || t.member_id===S.who).map(t=>t.id));
  const fh = an.hoursAll.filter(h => tripIds.has(h.trip));
  const tc = list.filter(c => c.trip_id && an.tripsDone.has(c.trip_id) && tripIds.has(c.trip_id)).map(c => ({ ...c, feats: an.feats.get(c.id) }));
  return `<div class="view">
    <div class="section-head"><h2>Statistik</h2><span class="muted num">${list.length} fångster</span></div>
    ${S.members.filter(m=>m.active).length>1?whoFilter("who"):""}
    <div class="seg" role="group" aria-label="Filtrera på art"><button class="chip small" data-sp="all" aria-pressed="${S.statSpecies==="all"}">Alla arter</button>${speciesAvail.map(s=>`<button class="chip small" data-sp="${esc(s)}" aria-pressed="${S.statSpecies===s}">${esc(s)}</button>`).join("")}</div>
    <div class="tiles">
      <div class="tile"><span class="label">Fångster</span><span class="v">${list.length}</span><span class="s">${count(list,c=>c.lake_name).length} vatten</span></div>
      <div class="tile"><span class="label">Fiskad tid</span><span class="v">${fmt1(fh.reduce((a,h)=>a+h.w,0))} h</span><span class="s">${tc.length && fh.length ? fmt1(tc.length/fh.reduce((a,h)=>a+h.w,0))+" fångster per timme" : "från avslutade turer"}</span></div>
      <div class="tile"><span class="label">Största</span><span class="v">${heaviest?esc(fmtKg(heaviest.weight_kg)):"–"}</span><span class="s">${heaviest?esc(heaviest.species+", "+(member(heaviest.member_id)?.name||"")):"Ingen vägd fisk"}</span></div>
      <div class="tile"><span class="label">Återutsatt</span><span class="v">${rel}%</span><span class="s">catch &amp; release</span></div>
    </div>
    ${insight(list)}
    ${renderPatterns(list, fh, tc)}
    <div class="section-head" style="margin-top:8px"><h2>Översikt</h2></div>
    <div class="grid2">
      <section class="panel"><h3>Lufttryck, 3 timmar</h3><p class="sub">Tryckändring de tre timmarna före fångst · ${withWx} av ${list.length} med väder</p>${compare(TREND_BUCKETS, list.map(c=>c.weather?.pressureDelta3h ?? null), fh.map(h=>h.wx?.pressureDelta3h ?? null), fh.map(h=>h.w))}</section>
      <section class="panel"><h3>Lufttryck, ett dygn</h3><p class="sub">Tryckändring de 24 timmarna före fångst, i hPa</p>${compare(D24_BUCKETS, list.map(c=>c.weather?.pressureDelta24h ?? null), fh.map(h=>h.wx?.pressureDelta24h ?? null), fh.map(h=>h.w))}</section>
      <section class="panel"><h3>Bästa beten</h3><p class="sub">${S.statSpecies==="all"?"Alla arter":esc(S.statSpecies)}, antal fångster per bete</p>${hbars(count(list,baitName))}</section>
      <section class="panel"><h3>Betestyp</h3><p class="sub">Fångster per typ av bete</p>${hbars(count(list,c=>baitDoc(c)?.type))}</section>
      <section class="panel"><h3>${S.statSpecies==="all"?"Arter":"Teknik"}</h3><p class="sub">${S.statSpecies==="all"?"Antal fångster per art":"Antal fångster per teknik"}</p>${hbars(S.statSpecies==="all"?count(list,c=>c.species):count(list,c=>c.technique))}</section>
      <section class="panel"><h3>När hugger det?</h3><p class="sub">Fångster per klockslag</p>${cols(hours,hours.map((_,i)=>String(i).padStart(2,"0")),3)}</section>
      <section class="panel"><h3>Säsong</h3><p class="sub">Fångster per månad</p>${cols(months,["jan","feb","mar","apr","maj","jun","jul","aug","sep","okt","nov","dec"],1)}</section>
      <section class="panel"><h3>Vattentemperatur</h3><p class="sub">${wt.length} av ${list.length} fångster har vattentemp${wt.length?` · snitt ${fmt1(wt.reduce((a,b)=>a+b,0)/wt.length)} °C`:""}</p>${wt.length?hbars([["Under 8 °C",wt.filter(v=>v<8).length],["8–12 °C",wt.filter(v=>v>=8&&v<12).length],["12–16 °C",wt.filter(v=>v>=12&&v<16).length],["16–20 °C",wt.filter(v=>v>=16&&v<20).length],["20 °C och över",wt.filter(v=>v>=20).length]],5):`<p class="muted" style="margin:0">Fyll i vattentemp när du registrerar fångster så syns det här.</p>`}</section>
      <section class="panel"><h3>Bottendjup</h3><p class="sub">${S.statSpecies==="all"?"Alla arter":esc(S.statSpecies)} · ${bd.length} av ${list.length} fångster har bottendjup${bd.length?` · snitt ${avg(bd)} m`:""}</p>${bd.length?depthBars(bd):`<p class="muted" style="margin:0">Fyll i bottendjupet när du registrerar fångster så syns det här.</p>`}</section>
      <section class="panel"><h3>Djup där fisken högg</h3><p class="sub">${S.statSpecies==="all"?"Alla arter":esc(S.statSpecies)} · ${fd.length} av ${list.length} fångster${fd.length?` · snitt ${avg(fd)} m`:""}</p>${fd.length?depthBars(fd):`<p class="muted" style="margin:0">Fyll i ungefär hur djupt fisken högg så syns det här.</p>`}</section>
      <section class="panel"><h3>Vatten</h3><p class="sub">Fångster per sjö eller plats</p>${hbars(count(list,c=>c.lake_name))}</section>
      <section class="panel"><h3>Månfas</h3><p class="sub">Fångster per månfas</p>${hbars(count(list,c=>c.moon?.phase))}</section>
    </div>
  </div>`;
}
function renderPatterns(list, fh, tc){
  const H_ = fh.reduce((a,h)=>a+h.w,0);
  const small = H_ < 20 || tc.length < 15;
  const f = A.FACTORS.find(x=>x.key===S.factor) || A.FACTORS[0];
  const rb = A.rateByFactor(fh, tc, f.key);
  const maxRate = Math.max(...rb.rows.map(r=>r.rate), rb.overall, 0.01);
  const rateHtml = H_ ? `<div class="factor-tabs">${A.FACTORS.map(x=>`<button class="chip small" data-factor="${x.key}" aria-pressed="${x.key===f.key}">${esc(x.label)}</button>`).join("")}</div>
      <div class="cmp">${rb.rows.map(r=>`<div class="rate-row ${r.hours<3?"few":""}"><span class="n">${esc(r.value)}</span><span class="t"><span class="f" style="width:${r.rate/maxRate*100}%"></span><i class="b" style="left:${rb.overall/maxRate*100}%"></i></span><span class="c">${r.hours?fmt1(r.rate):"–"}<small>${r.n} st · ${fmt1(r.hours)} h</small></span></div>`).join("")}</div>
      <div class="legend"><span><i></i>Fångster per fiskad timme</span><span><i class="b"></i>Ert snitt, ${fmt1(rb.overall)} per timme</span><span>Blekt stapel: under 3 timmar underlag</span></div>`
    : `<p class="muted" style="margin:0">Starta en tur när ni fiskar, så räknas både timmarna med och utan napp. Då kan appen visa var det nappar oftare än vanligt.</p>`;
  const combos = A.topCombos(fh, tc);
  const periods = A.bitePeriods(list).map(p => { const c0 = p.catches[0]; return { ...p, feats: A.catchFeatures(c0), w: c0.weather, c0 }; });
  const summary = A.periodSummary(periods, fh);
  return `<div class="section-head" style="margin-top:8px"><h2>Mönster</h2><span class="muted">${fmt1(H_)} fiskade timmar · ${tc.length} fångster på turer</span></div>
    ${small ? `<div class="banner"><div><b>Underlaget är fortfarande litet.</b> <span class="muted">Mönstren blir pålitliga först runt ett femtiotal fångster och en säsongs turer. Se dem som ledtrådar tills dess.</span></div></div>` : ""}
    <div class="grid2">
      <section class="panel"><h3>Hugg per timme</h3><p class="sub">Fångster per fiskad timme under olika förhållanden</p>${rateHtml}</section>
      <section class="panel"><h3>Kombinationer som nappar</h3><p class="sub">Två förhållanden samtidigt, jämfört med ert snitt per timme</p>
        ${combos.length ? `<div>${combos.map(c=>`<div class="combo"><span class="what">${esc(c.a.text(c.va))} + ${esc(c.b.text(c.vb).toLowerCase())}${c.unsure?`<span class="tag-unsure">osäkert</span>`:""}</span><span class="lift">${fmt1(c.lift)}×<small>snittet</small></span><span class="why">${c.n} fångster på ${fmt1(c.hours)} timmar</span></div>`).join("")}</div>`
          : `<p class="muted" style="margin:0">${H_ ? "Inga kombinationer sticker ut än. Det krävs minst 3 fångster och 3 timmar för varje kombination." : "Visas när ni har loggat turer."}</p>`}</section>
      <section class="panel" style="grid-column:1/-1"><h3>Huggperioder</h3><p class="sub">Minst 3 fångster på samma vatten med högst 45 minuter emellan. Orange etiketter är förhållanden som är ovanliga under er fiskade tid.</p>
        ${summary.length?`<p class="insight" style="margin:0">I huggperioderna är det oftare ${summary.map(s=>`<b>${esc(s.f.text(s.v).toLowerCase())}</b> (${Math.round(s.pShare*100)} % mot ${Math.round(s.hShare*100)} % av er fiskade tid)`).join(", ")}.</p>`:""}
        ${periods.length ? `<div class="list">${periods.slice(0,8).map(p=>{ const un = A.unusualFeatures(p.feats, fh), w=p.w||{}; const lake=p.c0.lake_name||"Okänt vatten";
            const who=[...new Set(p.catches.map(c=>member(c.member_id)?.name).filter(Boolean))].join(", ");
            const fact=(k,txt)=>txt?`<span class="${un[k]!=null?"hi":""}">${esc(txt)}</span>`:"";
            return `<button class="period" ${p.c0.trip_id?`data-trip-open="${esc(p.c0.trip_id)}"`:`data-open="${esc(p.c0.id)}"`}><div class="hd"><b>${esc(lake)} · ${esc(fmtDay(p.start))} ${fmtTime(p.start)}–${fmtTime(p.end)}</b><span class="muted">${p.catches.length} fångster · ${esc(who)}</span></div>
              <div class="facts">${fact("trend3", w.pressureDelta3h!=null?`Tryck ${fmtDelta(w.pressureDelta3h,"hPa")} på 3 h`:"")}${fact("d24", w.pressureDelta24h!=null?`${fmtDelta(w.pressureDelta24h,"hPa")} på 24 h`:"")}${fact("temp24", w.tempDelta24h!=null?`Luft ${fmtDelta(w.tempDelta24h,"°")} mot i går`:"")}${fact("vind", w.windMs!=null?`Vind ${windDirTxt(w.windDir)} ${fmt1(w.windMs)} m/s${w.windShift3h!=null&&Math.abs(w.windShift3h)>=45?", vred "+Math.abs(w.windShift3h)+"°":""}`:"")}${fact("moln", p.feats.moln)}${fact("ljus", p.feats.ljus)}${fact("sol", p.feats.sol&&p.feats.sol!=="Övrig tid"?A.FACTORS.find(x=>x.key==="sol").text(p.feats.sol):"")}${p.c0.moon?`<span>${esc(p.c0.moon.phase)}</span>`:""}${(()=>{const v=p.catches.filter(c=>c.water_temp_c!=null).map(c=>Number(c.water_temp_c));return v.length?`<span>Vatten ${fmt1(v.reduce((a,b)=>a+b,0)/v.length)} °C</span>`:"";})()}</div></button>`; }).join("")}</div>`
          : `<p class="muted" style="margin:0">Inga huggperioder än.</p>`}</section>
    </div>`;
}
function renderTop(){
  const rows=S.members.filter(m=>m.active).map(m=>{ const cs=S.catches.filter(c=>c.member_id===m.id); const big=cs.filter(c=>c.weight_kg).sort((a,b)=>b.weight_kg-a.weight_kg)[0];
    return {m,n:cs.length,kg:cs.reduce((a,c)=>a+(+c.weight_kg||0),0),sp:new Set(cs.map(c=>c.species)).size,big}; }).sort((a,b)=>b.n-a.n||b.kg-a.kg);
  const bySp=new Map(); S.catches.forEach(c=>{ if(!c.weight_kg) return; const b=bySp.get(c.species); if(!b||+c.weight_kg>+b.weight_kg) bySp.set(c.species,c); });
  const pbs=[...bySp.values()].sort((a,b)=>b.weight_kg-a.weight_kg);
  const year=new Date().getFullYear(), yr=S.catches.filter(c=>new Date(c.time).getFullYear()===year).length;
  return `<div class="view">
    <div class="section-head"><h2>Fiskekompisar</h2><span class="muted num">${yr} fångster ${year}</span></div>
    <div class="lb">${rows.map((r,i)=>`<div class="lb-row"><span class="rank">${i+1}</span>${avatar(r.m,"lg")}<div><div class="name">${esc(r.m.name)}</div><div class="stats num">${r.sp} arter · ${r.kg.toLocaleString("sv-SE",{maximumFractionDigits:1})} kg totalt${r.big?` · största ${esc(r.big.species.toLowerCase())} ${esc(fmtKg(r.big.weight_kg))}`:""}</div></div><div class="big num">${r.n}<small>fångster</small></div></div>`).join("")}</div>
    <div class="section-head" style="margin-top:8px"><h2>Rekord per art</h2><span class="muted">Tyngsta fisken bland kompisarna</span></div>
    ${pbs.length?`<div class="pbs">${pbs.map(c=>{const m=member(c.member_id);return `<button class="pb" data-open="${esc(c.id)}"><div class="ph"><div class="noimg" style="position:absolute;inset:0;display:grid;place-items:center;color:var(--muted)">${I.fish}</div>${photoImg(c.photo)}</div><div class="b"><span class="sp">${esc(c.species)}</span><span class="w num">${esc(fmtKg(c.weight_kg))}${c.length_cm?` · ${fmt1(c.length_cm)} cm`:""}</span><span class="who">${avatar(m,"sm")}${esc(m?.name||"")}</span></div></button>`}).join("")}</div>`:`<p class="muted" style="margin:0">Rekorden visas när fångster har en vikt.</p>`}
  </div>`;
}

// ---------- mer, vatten, gänget ----------
function renderMore(){
  const row=(tab,title,sub)=>`<button class="row" data-go="${tab}"><div class="grow"><b>${title}</b><span>${sub}</span></div><span class="chev">${I.chev}</span></button>`;
  return `<div class="view" style="max-width:640px"><div class="section-head"><h2>Mer</h2></div><div class="list">
    ${row("baits","Betesboxen",`${S.baits.length} beten`)}${row("lakes","Vatten",`${S.lakes.length} sparade`)}${row("gang","Fiskekompisar och konto",`${S.members.filter(m=>m.active).length} fiskare · export · logga ut`)}</div></div>`;
}
function renderLakes(){
  const counts=new Map(); S.catches.forEach(c=>{ if(c.lake_id) counts.set(c.lake_id,(counts.get(c.lake_id)||0)+1); });
  const sorted=[...S.lakes].sort((a,b)=>(counts.get(b.id)||0)-(counts.get(a.id)||0));
  return `<div class="view" style="max-width:720px"><div class="section-head"><h2>Vatten</h2><span class="muted num">${S.lakes.length} sparade</span></div>
    <p class="muted" style="margin:0">När en bild eller telefonen har position väljs närmaste sparade vatten inom ${LAKE_RADIUS_KM} km automatiskt. Första gången du fiskar ett nytt vatten skriver du namnet, sedan känns det igen. Tryck på ett vatten för att byta namn, ändra position, slå ihop eller ta bort.</p>
    ${sorted.map(l=>{ const cs=S.catches.filter(c=>c.lake_id===l.id), sp=count(cs,c=>c.species)[0], bt=count(cs,baitName)[0], nt=S.trips.filter(t=>t.lake_id===l.id).length;
      return `<button class="lake" data-lake-open="${esc(l.id)}" style="text-align:left;width:100%;cursor:pointer"><span class="nm">${esc(l.name)}</span><span class="c num">${counts.get(l.id)||0}<small>fångster</small></span>
      <span class="muted" style="font-size:13px">${sp?`Mest ${esc(sp[0].toLowerCase())}`:"Inga fångster"}${bt?` · bäst på ${esc(bt[0])}`:""} · ${nt} ${nt===1?"tur":"turer"}${l.lat!=null?` · ${l.lat.toFixed(3)}, ${l.lon.toFixed(3)}`:" · ingen position"}</span></button>`; }).join("") || `<div class="empty"><p class="muted" style="margin:0">Inga vatten än. De skapas när du registrerar en fångst eller startar en tur.</p></div>`}
  </div>`;
}
// Redigera, slå ihop eller ta bort ett vatten. Fångster behåller vattnets namn även om vattnet tas bort.
function openLake(id){
  const l=byId(S.lakes,id); if(!l) return;
  const cs=S.catches.filter(c=>c.lake_id===id), ts=S.trips.filter(t=>t.lake_id===id);
  const others=S.lakes.filter(x=>x.id!==id).sort((a,b)=>a.name.localeCompare(b.name,"sv"));
  const host=openOverlay(`<div class="sheet-head"><h2>${esc(l.name)}</h2><button class="x" data-close aria-label="Stäng">${I.x}</button></div>
    <div style="display:grid;gap:16px">
      <p class="muted" style="margin:0">${cs.length} ${cs.length===1?"fångst":"fångster"} · ${ts.length} ${ts.length===1?"tur":"turer"}</p>
      <form class="panel" id="lkName" novalidate><h3>Namn</h3><div style="display:flex;gap:10px"><input class="inp" id="lkN" maxlength="60" value="${esc(l.name)}" style="flex:1"><button class="btn primary" type="submit">Spara</button></div><div class="err" id="lkErr" role="alert"></div></form>
      <section class="panel"><h3>Position</h3><p class="sub">Används för att känna igen vattnet och hämta väder när en fångst saknar egen position.</p>
        <p style="margin:0" id="lkPos">${l.lat!=null?`<a href="https://www.google.com/maps?q=${l.lat},${l.lon}" target="_blank" rel="noopener" style="color:var(--accent)">${Number(l.lat).toFixed(4)}, ${Number(l.lon).toFixed(4)}</a>`:"Ingen position sparad."}</p>
        <div><button class="btn" id="lkHere">Använd min position nu</button></div></section>
      ${others.length&&canDeleteLake(l)?`<section class="panel"><h3>Slå ihop</h3><p class="sub">Har samma vatten sparats två gånger? Flytta fångsterna och turerna härifrån till det andra vattnet och ta bort det här.</p>
        <div style="display:flex;gap:10px;flex-wrap:wrap"><select class="inp" id="lkTo" style="flex:1 1 180px"><option value="">Välj vatten</option>${others.map(o=>`<option value="${esc(o.id)}">${esc(o.name)}</option>`).join("")}</select><button class="btn" id="lkMerge">Slå ihop</button></div></section>`:""}
      ${canDeleteLake(l)?`<div><button class="btn danger ghost" id="lkDel">Ta bort vattnet</button></div>`:`<p class="muted" style="margin:0;font-size:13px">Bara ${esc(member(l.created_by)?.name||"den som lade till vattnet")} eller admin kan slå ihop eller ta bort det.</p>`}
      <div id="lkConfirm"></div>
    </div>`);
  const busy=(btn,on,txt)=>{ btn.disabled=on; if(on) btn.innerHTML=`<span class="spin"></span> Vänta…`; else btn.textContent=txt; };
  $("#lkName").onsubmit=async(e)=>{ e.preventDefault(); const n=$("#lkN").value.trim(), err=$("#lkErr"); err.textContent="";
    if(!n){ err.textContent="Skriv ett namn."; return; }
    if (S.lakes.some(x=>x.id!==id && x.name.toLowerCase()===n.toLowerCase())){ err.textContent="Det finns redan ett vatten med det namnet. Använd Slå ihop i stället."; return; }
    const btn=e.submitter||$("#lkName button"); busy(btn,true);
    try{ await dbUpdate("lakes", id, { name:n }); for (const c of cs) await dbUpdate("catches", c.id, { lake_name:n }).catch(()=>{});
      closeOverlay(); render(); toast("Namnet är ändrat"); }catch(ex){ err.textContent=errText(ex); busy(btn,false,"Spara"); } };
  $("#lkHere").onclick=async()=>{ const btn=$("#lkHere"); busy(btn,true); const p=await getPosition();
    if(!p){ busy(btn,false,"Använd min position nu"); toast("Fick ingen position från telefonen."); return; }
    try{ await dbUpdate("lakes", id, { lat:p.lat, lon:p.lon }); closeOverlay(); render(); openLake(id); toast("Positionen är uppdaterad"); }catch(ex){ busy(btn,false,"Använd min position nu"); toast(errText(ex)); } };
  if ($("#lkMerge")) $("#lkMerge").onclick=()=>{ const to=byId(S.lakes,$("#lkTo").value); if(!to){ toast("Välj vilket vatten det ska slås ihop med."); return; }
    $("#lkConfirm").innerHTML=`<div class="banner warn" style="display:grid;gap:10px"><span>Flytta ${cs.length} fångster och ${ts.length} turer till <b>${esc(to.name)}</b> och ta bort <b>${esc(l.name)}</b>?</span><div style="display:flex;gap:10px"><button class="btn danger" id="lkYes">Slå ihop</button><button class="btn ghost" id="lkNo">Avbryt</button></div></div>`;
    $("#lkNo").onclick=()=>$("#lkConfirm").innerHTML="";
    $("#lkYes").onclick=async()=>{ busy($("#lkYes"),true);
      try{ for (const c of cs) await dbUpdate("catches", c.id, { lake_id:to.id, lake_name:to.name });
        for (const t of ts) await dbUpdate("trips", t.id, { lake_id:to.id });
        if (to.lat==null && l.lat!=null) await dbUpdate("lakes", to.id, { lat:l.lat, lon:l.lon });
        await dbRemove("lakes", id); closeOverlay(); render(); toast(`Ihopslaget med ${to.name}`); }
      catch(ex){ toast(errText(ex)); busy($("#lkYes"),false,"Slå ihop"); } }; };
  if ($("#lkDel")) $("#lkDel").onclick=()=>{
    $("#lkConfirm").innerHTML=`<div class="banner warn" style="display:grid;gap:10px"><span>Ta bort <b>${esc(l.name)}</b>?${cs.length||ts.length?` ${cs.length} fångster och ${ts.length} turer finns kvar, men kopplas loss från vattnet. Fångsterna behåller namnet.`:""}</span><div style="display:flex;gap:10px"><button class="btn danger" id="lkYes">Ta bort</button><button class="btn ghost" id="lkNo">Avbryt</button></div></div>`;
    $("#lkNo").onclick=()=>$("#lkConfirm").innerHTML="";
    $("#lkYes").onclick=async()=>{ busy($("#lkYes"),true);
      try{ await dbRemove("lakes", id); S.catches.forEach(c=>{ if(c.lake_id===id) c.lake_id=null; }); S.trips.forEach(t=>{ if(t.lake_id===id) t.lake_id=null; }); invalidate();
        closeOverlay(); render(); toast("Vattnet är borttaget"); }
      catch(ex){ toast(errText(ex)); busy($("#lkYes"),false,"Ta bort"); } };
  };
}
// Inloggningsstatus (bara admin). Hämtas när sidan Fiskekompisar visas, högst en gång per minut.
function statusLine(m){
  if (S.statusErr) return `<span>Status kunde inte hämtas. Har SQL-filen 3-inloggningsstatus.sql körts?</span>`;
  if (!S.status) return `<span>Hämtar status…</span>`;
  const st = S.status[m.email.toLowerCase()];
  if (!st) return `<span style="color:var(--warn)">Har inte skapat konto än</span>`;
  return st.last_sign_in_at ? `<span style="color:var(--good)">Har konto · senast inloggad med lösenord ${esc(fmtDate(st.last_sign_in_at))}</span>` : `<span>Har konto men har inte loggat in</span>`;
}
// Senast aktiv (alla ser). Appen sparar en tidsstämpel när den öppnas eller kommer tillbaka i förgrunden.
const SEEN_EVERY = 10 * 60000;
function markSeen(){
  if (!S.me || !S.api?.markSeen) return;
  const key = "fb.seen." + S.me.id, last = Number(ls.get(key) || 0);
  if (Date.now() - last < SEEN_EVERY) return;
  ls.set(key, String(Date.now()));
  S.api.markSeen().catch(() => {});
}
function fmtSeen(iso){
  const d = new Date(iso), t = d.toLocaleTimeString("sv-SE",{hour:"2-digit",minute:"2-digit"});
  const day = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(new Date()) - day(d)) / 864e5);
  if (diff <= 0) return `i dag ${t}`;
  if (diff === 1) return `i går ${t}`;
  if (diff < 7) return `${d.toLocaleDateString("sv-SE",{weekday:"long"})} ${t}`;
  return d.toLocaleDateString("sv-SE",{day:"numeric",month:"short",...(d.getFullYear()!==new Date().getFullYear()?{year:"numeric"}:{})});
}
function seenLine(m){
  if (!("last_seen_at" in m) || !m.active) return "";
  return m.last_seen_at ? `<span>Senast aktiv ${esc(fmtSeen(m.last_seen_at))}</span>` : `<span class="muted">Ingen aktivitet registrerad än</span>`;
}
async function loadStatus(force=false){
  if (!S.me?.is_admin || !S.api.memberStatus) return;
  if (!force && S.statusAt && Date.now() - S.statusAt < 60000) return;
  S.statusAt = Date.now();
  try{ const rows = await S.api.memberStatus(); S.status = {}; rows.forEach(r => S.status[r.email.toLowerCase()] = r); S.statusErr = false; }
  catch(e){ S.statusErr = true; }
  if (S.tab === "gang") render();
}
function renderGang(){
  setTimeout(() => loadStatus(), 0);
  const admin = S.me.is_admin;
  return `<div class="view" style="max-width:720px"><div class="section-head"><h2>Fiskekompisar</h2><span class="muted num">${S.members.filter(m=>m.active).length} fiskare</span></div>
    <div class="list">${S.members.slice().sort((a,b)=>(b.active-a.active)||a.name.localeCompare(b.name,"sv")).map(m=>`<div class="row mrow" style="${m.active?"":"opacity:.55"}">${avatar(m)}<div class="grow"><b>${esc(m.name)}${m.is_admin?` <span class="tag-unsure">admin</span>`:""}${m.active?"":` <span class="tag-unsure">inaktiv</span>`}</b><span>${esc(m.email)}</span>${seenLine(m)}${admin?statusLine(m):""}</div>
      ${m.id===S.me.id?`<button class="btn ghost" data-rename>Byt namn</button>`:`<div class="mact">${m.active?`<button class="btn ghost" data-invite="${esc(m.id)}">Bjud in</button>`:""}${admin&&m.active&&S.status&&S.status[m.email.toLowerCase()]?`<button class="btn ghost" data-setpw="${esc(m.id)}">Nytt lösenord</button>`:""}${admin&&!m.is_admin?`<button class="btn ghost" data-toggle="${esc(m.id)}">${m.active?"Inaktivera":"Aktivera"}</button>`:""}</div>`}</div>`).join("")}</div>
    ${admin?`<form class="panel" id="addMember" novalidate><h3>Lägg till fiskare</h3><p class="sub">Personen skapar sedan ett konto i appen med samma e-postadress och ett eget lösenord.</p>
      <div class="row2"><div class="field"><label for="amName">Namn</label><input class="inp" id="amName" maxlength="30" autocomplete="off"></div><div class="field"><label for="amEmail">E-post</label><input class="inp" id="amEmail" type="email" autocomplete="off"></div></div>
      <div class="err" id="amErr" role="alert"></div><button class="btn primary" type="submit">Lägg till</button></form>`:""}
    <section class="panel"><h3>Säkerhetskopia</h3><p class="sub">Ladda ner alla fångster, turer, vatten och beten. Gör det någon gång per säsong.</p>
      <div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn" data-export="json">Allt som JSON</button><button class="btn" data-export="csv">Fångster som CSV (Excel)</button></div></section>
    <section class="panel"><h3>Konto</h3><p class="sub">Inloggad som ${esc(S.session.email)}</p>
      <form id="pwForm" style="display:grid;gap:12px" novalidate><h3 style="font-size:17px">Byt lösenord</h3>
        <div class="field"><label for="pwCur">Nuvarande lösenord</label><input class="inp" type="password" id="pwCur" autocomplete="current-password"></div>
        <div class="row2"><div class="field"><label for="pwNew">Nytt lösenord</label><input class="inp" type="password" id="pwNew" autocomplete="new-password" minlength="8"></div>
          <div class="field"><label for="pwNew2">Upprepa nytt</label><input class="inp" type="password" id="pwNew2" autocomplete="new-password"></div></div>
        <div class="err" id="pwErr" role="alert"></div>
        <div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn primary" type="submit" id="pwSave">Byt lösenord</button><button class="btn" type="button" data-logout>Logga ut</button></div>
      </form></section>
  </div>`;
}
async function addMember(){
  const err=$("#amErr"); err.textContent="";
  const name=$("#amName").value.trim(), email=$("#amEmail").value.trim().toLowerCase();
  if (!name){ err.textContent="Skriv ett namn."; return; }
  if (!/^\S+@\S+\.\S+$/.test(email)){ err.textContent="Skriv en giltig e-postadress."; return; }
  if (S.members.some(m=>m.email.toLowerCase()===email)){ err.textContent="Den adressen finns redan."; return; }
  const used=new Set(S.members.filter(m=>m.active).map(m=>m.color)); let color=0; while(used.has(color)&&color<3) color++;
  try{ const m = await dbInsert("members",{ name, email, color }); render(); openInvite(m, true); }
  catch(e){ err.textContent=errText(e); }
}
// Inbjudan: öppnar ditt eget mejlprogram med allt ifyllt, eller delar texten via SMS/WhatsApp.
function inviteText(m){
  const url = location.origin + location.pathname;
  return { subject: "Välkommen till Fångstboken",
    body: `Hej ${m.name}!\n\nJag har lagt till dig i Fångstboken, vår gemensamma loggbok för fångster, fisketurer och väder.\n\n1. Öppna ${url}\n2. Välj "Skapa konto" och använd den här e-postadressen: ${m.email}\n3. Välj ett eget lösenord (minst 8 tecken).\n4. Lägg appen på hemskärmen:\n   iPhone (Safari): Dela → Lägg till på hemskärmen\n   Android (Chrome): ⋮ → Lägg till på startskärmen\n\nVälkommen!\n${S.me.name}` };
}
function openInvite(m, justAdded=false){
  const t = inviteText(m);
  const mailto = `mailto:${encodeURIComponent(m.email)}?subject=${encodeURIComponent(t.subject)}&body=${encodeURIComponent(t.body)}`;
  openOverlay(`<div class="sheet-head"><h2>Bjud in ${esc(m.name)}</h2><button class="x" data-close aria-label="Stäng">${I.x}</button></div>
    <div style="display:grid;gap:14px">
      ${justAdded?`<div class="banner"><div><b>${esc(m.name)} är tillagd.</b> <span class="muted">Skicka en inbjudan så att hen vet hur man kommer igång.</span></div></div>`:""}
      <a class="btn primary" href="${esc(mailto)}" id="invMail">Skicka mejl till ${esc(m.email)}</a>
      ${navigator.share?`<button class="btn" id="invShare">Dela via SMS, WhatsApp …</button>`:""}
      <button class="btn" id="invCopy">Kopiera texten</button>
      <section class="panel"><h3>Så här står det</h3><p style="margin:0;white-space:pre-wrap;font-size:14px">${esc(t.body)}</p></section>
    </div>`);
  if ($("#invShare")) $("#invShare").onclick = async () => { try{ await navigator.share({ title: t.subject, text: t.body }); }catch(e){} };
  $("#invCopy").onclick = async () => { try{ await navigator.clipboard.writeText(t.subject + "\n\n" + t.body); toast("Texten är kopierad"); }catch(e){ toast("Kunde inte kopiera. Markera texten nedan i stället."); } };
}
// Byta eget lösenord: kontrollerar det nuvarande genom att logga in igen, sedan sätts det nya.
async function changeOwnPassword(){
  const err=$("#pwErr"); err.textContent="";
  const cur=$("#pwCur").value, n1=$("#pwNew").value, n2=$("#pwNew2").value;
  if (!cur){ err.textContent="Skriv ditt nuvarande lösenord."; return; }
  if (n1.length < 8){ err.textContent="Det nya lösenordet måste ha minst 8 tecken."; return; }
  if (n1 !== n2){ err.textContent="De nya lösenorden är inte likadana."; return; }
  if (n1 === cur){ err.textContent="Välj ett annat lösenord än det nuvarande."; return; }
  const btn=$("#pwSave"); btn.disabled=true; btn.innerHTML=`<span class="spin"></span> Byter…`;
  try{ await S.api.changePassword(S.session.email, cur, n1); $("#pwForm").reset(); toast("Lösenordet är bytt"); }
  catch(e){ err.textContent = e?.message==="WRONG_PASSWORD" ? "Det nuvarande lösenordet stämmer inte." : errText(e); }
  btn.disabled=false; btn.textContent="Byt lösenord";
}
// Admin: tillfälligt lösenord åt en kompis som glömt sitt.
function tempPassword(){
  const w=["Gadda","Abborre","Gos","Oring","Jigg","Wobbler","Drag","Spinn","Napp","Hugg","Sjo","Vass","Bete","Lina"];
  const r=(n)=>{ const a=new Uint32Array(1); crypto.getRandomValues(a); return a[0]%n; };
  return `${w[r(w.length)]}-${1000+r(9000)}-${w[r(w.length)]}`;
}
function openSetPassword(m){
  const pw=tempPassword();
  openOverlay(`<div class="sheet-head"><h2>Nytt lösenord åt ${esc(m.name)}</h2><button class="x" data-close aria-label="Stäng">${I.x}</button></div>
    <div class="form" id="spBox">
      <p class="muted" style="margin:0">Sätt ett tillfälligt lösenord och skicka det till ${esc(m.name)}. Hen loggar in med det och byter till ett eget under Konto. Det gamla lösenordet slutar fungera.</p>
      <div class="field"><label for="spPw">Tillfälligt lösenord</label><input class="inp" id="spPw" value="${esc(pw)}" autocomplete="off"></div>
      <div class="err" id="spErr" role="alert"></div>
      <div class="form-actions"><button type="button" class="btn ghost" data-close>Avbryt</button><button type="button" class="btn primary" id="spSave">Sätt lösenordet</button></div>
    </div>`);
  $("#spSave").onclick=async()=>{
    const v=$("#spPw").value.trim(), err=$("#spErr"); err.textContent="";
    if (v.length<8){ err.textContent="Minst 8 tecken."; return; }
    const btn=$("#spSave"); btn.disabled=true; btn.innerHTML=`<span class="spin"></span> Sätter…`;
    try{
      await S.api.adminSetPassword(m.email, v);
      const url=location.origin+location.pathname;
      const text=`Hej ${m.name}! Ditt tillfälliga lösenord till Fångstboken är: ${v}\n\nLogga in på ${url} med ${m.email} och byt sedan till ett eget lösenord under Fiskekompisar → Konto → Byt lösenord.`;
      const mailto=`mailto:${encodeURIComponent(m.email)}?subject=${encodeURIComponent("Nytt lösenord till Fångstboken")}&body=${encodeURIComponent(text)}`;
      $("#spBox").innerHTML=`<div class="banner"><div><b>Klart.</b> ${esc(m.name)} kan nu logga in med <b>${esc(v)}</b>.</div></div>
        <a class="btn primary" href="${esc(mailto)}">Skicka mejl till ${esc(m.email)}</a>
        ${navigator.share?`<button class="btn" id="spShare">Dela via SMS, WhatsApp …</button>`:""}
        <button class="btn" id="spCopy">Kopiera texten</button><button class="btn ghost" data-close>Stäng</button>`;
      $("#spBox").querySelectorAll("[data-close]").forEach(b=>b.onclick=closeOverlay);
      if ($("#spShare")) $("#spShare").onclick=async()=>{ try{ await navigator.share({ text }); }catch(e){} };
      $("#spCopy").onclick=async()=>{ try{ await navigator.clipboard.writeText(text); toast("Texten är kopierad"); }catch(e){ toast("Kunde inte kopiera."); } };
    }catch(e){ err.textContent = /does not exist|could not find/i.test(e?.message||"") ? "Funktionen saknas. Kör SQL-filen 4-losenord.sql i Supabase först." : errText(e); btn.disabled=false; btn.textContent="Sätt lösenordet"; }
  };
}
function download(name, text, type){
  const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([text],{type})); a.download=name; document.body.appendChild(a); a.click();
  setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
function exportData(kind){
  const day=new Date().toISOString().slice(0,10);
  if (kind==="json"){ download(`fangstboken-${day}.json`, JSON.stringify({ exportedAt:new Date().toISOString(), members:S.members, lakes:S.lakes, baits:S.baits, trips:S.trips, catches:S.catches }, null, 1), "application/json"); return; }
  const cols=[["Tid",c=>c.time],["Fiskare",c=>member(c.member_id)?.name],["Art",c=>c.species],["Vikt g",c=>c.weight_kg!=null?Math.round(c.weight_kg*1000):null],["Längd cm",c=>c.length_cm],["Bottendjup m",c=>c.depth_m],["Högg på m",c=>c.fish_depth_m],["Vatten",c=>c.lake_name],["Bete",c=>baitName(c)],["Teknik",c=>c.technique],["Återutsatt",c=>c.released?"ja":"nej"],["Vattentemp",c=>c.water_temp_c],
    ["Lufttemp",c=>c.weather?.tempC],["Lufttryck",c=>c.weather?.pressure],["Tryck 3h",c=>c.weather?.pressureDelta3h],["Tryck 24h",c=>c.weather?.pressureDelta24h],["Vind m/s",c=>c.weather?.windMs],["Vindriktning",c=>c.weather?.windDir],["Moln %",c=>c.weather?.cloudPct],["Nederbörd mm",c=>c.weather?.precipMm],["Ljus",c=>c.light],["Månfas",c=>c.moon?.phase],["Lat",c=>c.lat],["Lon",c=>c.lon],["Anteckning",c=>c.note]];
  const q=v=>{ if(v==null) return ""; const s=String(typeof v==="number"?String(v).replace(".",","):v); return /[;"\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s; };
  download(`fangster-${day}.csv`, "﻿"+[cols.map(c=>c[0]).join(";"), ...S.catches.map(c=>cols.map(([,f])=>q(f(c))).join(";"))].join("\n"), "text/csv;charset=utf-8");
}

// ---------- betesboxen ----------
function baitStats(b){ const cs=S.catches.filter(c=>c.bait_id===b.id); const big=cs.filter(c=>c.weight_kg).sort((a,x)=>x.weight_kg-a.weight_kg)[0]; return { cs, n:cs.length, species:count(cs,c=>c.species), big, last:cs[0]?.time||null }; }
function baitThumb(b, cls="bthumb"){ return `<div class="${cls}">${photoImg(b.photo)}<span class="bt-type">${esc((b.type||"Övrigt").slice(0,2))}</span></div>`; }
function baitListHtml(){
  const q=S.baitQ.trim().toLowerCase();
  let list=S.baits.filter(b=>(S.baitType==="all"||b.type===S.baitType) && (!q || [b.name,b.type,b.color,b.brand].join(" ").toLowerCase().includes(q)));
  const st=new Map(list.map(b=>[b.id,baitStats(b)]));
  if (S.baitSort==="catches") list.sort((a,b)=>st.get(b.id).n-st.get(a.id).n||a.name.localeCompare(b.name,"sv"));
  else if (S.baitSort==="recent") list.sort((a,b)=>(st.get(b.id).last||"").localeCompare(st.get(a.id).last||""));
  else list.sort((a,b)=>a.name.localeCompare(b.name,"sv"));
  if (!list.length) return `<p class="muted" style="margin:0">${S.baits.length?"Inga beten matchar.":"Betesboxen är tom. Lägg till dina beten, eller skriv ett nytt bete när du registrerar en fångst."}</p>`;
  return `<div class="baits">${list.map(b=>{ const s=st.get(b.id), o=member(b.owner);
    return `<button class="bait" data-bait-open="${esc(b.id)}">${baitThumb(b)}<div class="bi"><span class="bn">${esc(b.name)}</span><span class="bd">${esc(baitDesc(b)||"Ingen beskrivning")}</span>
      <span class="bs ${s.n?"":"zero"}">${s.n?`<b class="num">${s.n}</b> ${s.n===1?"fångst":"fångster"} · ${esc(s.species.slice(0,3).map(x=>x[0].toLowerCase()).join(", "))}`:"Inget napp än"}</span></div>${o?avatar(o,"sm"):`<span class="bshared">Alla</span>`}</button>`; }).join("")}</div>`;
}
function renderBaits(){
  const used=new Set(S.catches.map(c=>c.bait_id).filter(Boolean)), types=BAIT_TYPES.filter(t=>S.baits.some(b=>b.type===t));
  return `<div class="view"><div class="section-head"><h2>Betesboxen</h2><span class="muted num">${S.baits.length} beten · ${used.size} har tagit fisk</span></div>
    <div style="display:flex;gap:10px;flex-wrap:wrap"><input class="inp" id="bq" type="search" placeholder="Sök namn, färg, märke" value="${esc(S.baitQ)}" style="flex:1 1 200px">
      <select class="inp" id="bsort" style="flex:0 1 190px" aria-label="Sortera"><option value="catches" ${S.baitSort==="catches"?"selected":""}>Flest fångster</option><option value="recent" ${S.baitSort==="recent"?"selected":""}>Senast fiskat</option><option value="name" ${S.baitSort==="name"?"selected":""}>Namn</option></select>
      <button class="btn" data-catalog>＋ Från katalog</button><button class="btn primary" data-new-bait>＋ Nytt bete</button></div>
    ${types.length>1?`<div class="seg" role="group" aria-label="Filtrera på typ"><button class="chip small" data-bt="all" aria-pressed="${S.baitType==="all"}">Alla typer</button>${types.map(t=>`<button class="chip small" data-bt="${esc(t)}" aria-pressed="${S.baitType===t}">${esc(t)}</button>`).join("")}</div>`:""}
    <div id="baitListBox">${baitListHtml()}</div></div>`;
}
function bindBaitList(){ $$("#baitListBox [data-bait-open]").forEach(b=>b.onclick=()=>openBait(b.dataset.baitOpen)); hydratePhotos($("#baitListBox")||document); }
function openBait(id){
  const b=byId(S.baits,id); if(!b) return; const s=baitStats(b), o=member(b.owner);
  const lakes=count(s.cs,c=>c.lake_name), hrs=count(s.cs,c=>new Date(c.time).getHours());
  const host=openOverlay(`<div class="sheet-head"><h2>${esc(b.name)}</h2><button class="x" data-close aria-label="Stäng">${I.x}</button></div>
    <div style="display:grid;gap:16px">
      <div style="display:grid;grid-template-columns:96px 1fr;gap:14px;align-items:center">${baitThumb(b,"bthumb lg")}<div style="display:grid;gap:4px"><span>${esc(baitDesc(b)||"Ingen beskrivning")}</span>${b.brand?`<span class="muted">${esc(b.brand)}</span>`:""}<span class="who">${o?avatar(o,"sm")+esc(o.name)+"s bete":"Gemensamt bete"}</span></div></div>
      ${b.note?`<p style="margin:0">${esc(b.note)}</p>`:""}
      <div class="tiles" style="grid-template-columns:repeat(3,1fr)"><div class="tile"><span class="label">Fångster</span><span class="v">${s.n}</span></div>
        <div class="tile"><span class="label">Största</span><span class="v" style="font-size:24px">${s.big?esc(fmtKg(s.big.weight_kg)):"–"}</span><span class="s">${s.big?esc(s.big.species):""}</span></div>
        <div class="tile"><span class="label">Senast</span><span class="v" style="font-size:20px">${s.last?esc(new Date(s.last).toLocaleDateString("sv-SE",{day:"numeric",month:"short"})):"–"}</span><span class="s">${hrs[0]?`Bäst kl ${String(hrs[0][0]).padStart(2,"0")}`:""}</span></div></div>
      ${s.n?`<section class="panel"><h3>Arter</h3>${hbars(s.species)}</section><section class="panel"><h3>Vatten</h3>${hbars(lakes)}</section>`:`<div class="empty"><p class="muted" style="margin:0">Inget napp på det här betet än.</p></div>`}
      <div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn" id="bEdit">Redigera</button><button class="btn danger ghost" id="bDel">Ta bort</button></div><div id="bConfirm"></div>
    </div>`);
  hydratePhotos(host);
  $("#bEdit").onclick=()=>openBaitForm(b);
  $("#bDel").onclick=()=>{
    $("#bConfirm").innerHTML=`<div class="banner warn" style="display:grid;gap:10px"><span>Ta bort betet ur boxen?${s.n?` De ${s.n} fångsterna finns kvar med betets namn.`:""}</span><div style="display:flex;gap:10px"><button class="btn danger" id="bYes">Ta bort</button><button class="btn ghost" id="bNo">Avbryt</button></div></div>`;
    $("#bNo").onclick=()=>$("#bConfirm").innerHTML="";
    $("#bYes").onclick=async()=>{ try{ await dbRemove("baits", b.id); if (b.photo) S.api.removePhoto(b.photo).catch(()=>{}); closeOverlay(); render(); toast("Betet är borttaget"); }catch(e){ toast(errText(e)); } };
  };
}
function openBaitForm(edit=null){
  const F={ type:edit?.type||"", file:null, saving:false };
  openOverlay(`<div class="sheet-head"><h2>${edit?"Redigera bete":"Nytt bete"}</h2><button class="x" data-close aria-label="Stäng">${I.x}</button></div>
  <form class="form" id="bf" novalidate>
    <div class="field"><label for="bName">Namn</label><input class="inp" id="bName" maxlength="60" placeholder="t.ex. Kinetic Sandeel röd" value="${esc(edit?.name||"")}" autocomplete="off"></div>
    <div class="field"><span class="label">Typ</span><div class="chips" id="bType">${BAIT_TYPES.map(t=>`<button type="button" class="chip small" data-v="${esc(t)}" aria-pressed="${F.type===t}">${esc(t)}</button>`).join("")}</div></div>
    <div class="field"><label for="bColor">Färg</label><input class="inp" id="bColor" maxlength="40" value="${esc(edit?.color||"")}" placeholder="t.ex. Röd/guld"><div class="chips">${COLORS.map(c=>`<button type="button" class="chip small" data-col="${esc(c)}">${esc(c)}</button>`).join("")}</div></div>
    <div class="row2"><div class="field"><label for="bSize">Storlek (cm)</label><input class="inp num" id="bSize" inputmode="decimal" value="${edit?.size_cm??""}" placeholder="7"></div><div class="field"><label for="bW">Vikt (g)</label><input class="inp num" id="bW" inputmode="decimal" value="${edit?.weight_g??""}" placeholder="14"></div></div>
    <div class="field"><label for="bBrand">Märke</label><input class="inp" id="bBrand" maxlength="40" value="${esc(edit?.brand||"")}" placeholder="t.ex. Savage Gear"></div>
    <div class="field"><label for="bOwner">Ägare</label><select class="inp" id="bOwner"><option value="">Gemensamt</option>${S.members.filter(m=>m.active).map(m=>`<option value="${esc(m.id)}" ${m.id===(edit?edit.owner:S.me.id)?"selected":""}>${esc(m.name)}</option>`).join("")}</select></div>
    <div class="field"><span class="label">Bild</span>${photoPicker("bp", edit?.photo)}</div>
    <div class="field"><label for="bNote">Anteckning</label><textarea class="inp" id="bNote" rows="2" placeholder="Rigg, krokstorlek, hur den ska gå…">${esc(edit?.note||"")}</textarea></div>
    <div class="err" id="bErr" role="alert"></div>
    <div class="form-actions"><button type="button" class="btn ghost" data-close>Avbryt</button><button type="submit" class="btn primary" id="bSave">${edit?"Spara ändringar":"Lägg i boxen"}</button></div>
  </form>`);
  $("#bType").querySelectorAll("[data-v]").forEach(b=>b.onclick=()=>{ F.type=F.type===b.dataset.v?"":b.dataset.v; $("#bType").querySelectorAll("[data-v]").forEach(x=>x.setAttribute("aria-pressed",x.dataset.v===F.type)); });
  $$("[data-col]").forEach(b=>b.onclick=()=>{ $("#bColor").value=b.dataset.col; });
  bindPicker("bp", f=>{ F.file=f; }); hydratePhotos($("#overlayHost"));
  $("#bf").onsubmit=async(e)=>{
    e.preventDefault(); if(F.saving) return; const err=$("#bErr"); err.textContent="";
    const name=$("#bName").value.trim(); if (!name){ err.textContent="Ge betet ett namn."; return; }
    const dup=findBaitByName(name); if (dup && dup.id!==edit?.id){ err.textContent="Det finns redan ett bete med det namnet."; return; }
    const nm=(v)=>{ v=v.replace(",",".").trim(); if(!v) return null; const n=Number(v); return n>0&&n<2000?n:NaN; };
    const size_cm=nm($("#bSize").value), weight_g=nm($("#bW").value);
    if (Number.isNaN(size_cm)||Number.isNaN(weight_g)){ err.textContent="Storlek och vikt ska vara siffror."; return; }
    F.saving=true; const btn=$("#bSave"); btn.disabled=true; btn.innerHTML=`<span class="spin"></span> Sparar…`;
    try{
      let photo=edit?.photo||null; if (F.file){ photo=await S.api.upload(await shrink(F.file)); }
      const row={ name, type:F.type||"Övrigt", color:$("#bColor").value.trim(), size_cm, weight_g, brand:$("#bBrand").value.trim(), owner:$("#bOwner").value||null, note:$("#bNote").value.trim(), photo };
      if (edit) await dbUpdate("baits", edit.id, row); else await dbInsert("baits", row);
      if (edit?.photo && photo!==edit.photo) S.api.removePhoto(edit.photo).catch(()=>{});
      closeOverlay(); render(); toast(edit?"Betet är uppdaterat":`${name} ligger i boxen`);
    }catch(ex){ F.saving=false; btn.disabled=false; btn.textContent=edit?"Spara ändringar":"Lägg i boxen"; err.textContent=errText(ex); }
  };
}

// ---------- overlays ----------
function openOverlay(html){
  const host=$("#overlayHost");
  host.innerHTML=`<div class="overlay" id="ov"><div class="sheet" role="dialog" aria-modal="true">${html}</div></div>`;
  document.body.style.overflow="hidden";
  $("#ov").addEventListener("click",e=>{ if(e.target.id==="ov") closeOverlay(); });
  host.querySelectorAll("[data-close]").forEach(b=>b.onclick=closeOverlay);
  return host;
}
function closeOverlay(){ $("#overlayHost").innerHTML=""; document.body.style.overflow=""; }
document.addEventListener("keydown",e=>{ if(e.key==="Escape" && $("#ov")) closeOverlay(); });

function lakeSelect(id, selected){
  return `<select class="inp" id="${id}"><option value="">Välj vatten</option>${S.lakes.slice().sort((a,b)=>a.name.localeCompare(b.name,"sv")).map(l=>`<option value="${esc(l.id)}" ${l.id===selected?"selected":""}>${esc(l.name)}</option>`).join("")}<option value="__new">＋ Nytt vatten…</option></select>`;
}
// Välj befintligt vatten, eller skapa ett nytt med position om vi har en.
async function resolveLake(sel, newName, pos){
  if (sel==="__new"){
    const existing=S.lakes.find(l=>l.name.toLowerCase()===newName.toLowerCase());
    if (existing){ if (existing.lat==null && pos) return await dbUpdate("lakes", existing.id, { lat:pos.lat, lon:pos.lon }); return existing; }
    return await dbInsert("lakes", { name:newName, lat:pos?.lat??null, lon:pos?.lon??null, created_by:S.me.id });
  }
  const l = sel ? byId(S.lakes, sel) : null;
  if (l && l.lat==null && pos) return await dbUpdate("lakes", l.id, { lat:pos.lat, lon:pos.lon });
  return l;
}

function openDetail(id){
  const c=byId(S.catches,id); if(!c) return; const m=member(c.member_id), w=c.weather, tr=c.trip_id?byId(S.trips,c.trip_id):null;
  const sol = c.lat!=null ? A.solunar(Date.parse(c.time), c.lat, c.lon) : null;
  const rows=[
    ["Fiskare",esc(m?.name||"Tidigare medlem")],["Tid",esc(fmtDateLong(c.time))],["Vatten",esc(c.lake_name||"–")],
    ["Vikt",esc(fmtKg(c.weight_kg)||"–")],["Längd",c.length_cm?fmt1(c.length_cm)+" cm":"–"],["Bete",c.bait_id&&baitDoc(c)?`<button class="chip small" data-bait-open="${esc(c.bait_id)}">${esc(baitName(c))}</button>`:esc(baitName(c)||"–")],["Teknik",esc(c.technique||"–")],
    ["Återutsatt",c.released?"Ja":"Nej"],["Bottendjup",c.depth_m!=null?fmt1(c.depth_m)+" m":"–"],["Högg på",c.fish_depth_m!=null?"ca "+fmt1(c.fish_depth_m)+" m":"–"],["Vattentemp",c.water_temp_c!=null?fmt1(c.water_temp_c)+" °C":"–"],
    ...(tr?[["Tur",`<button class="chip small" data-trip-open="${esc(tr.id)}">${esc(byId(S.lakes,tr.lake_id)?.name||"Tur")} ${fmtTime(Date.parse(tr.started_at))}–${tr.ended_at?fmtTime(Date.parse(tr.ended_at)):"nu"}</button>`]]:[]),
    ...(w?[["Luft",w.tempC!=null?fmt1(w.tempC)+" °C"+(w.tempDelta24h!=null?` (${fmtDelta(w.tempDelta24h,"°")} på ett dygn)`:""):"–"],
      ["Lufttryck",w.pressure!=null?Math.round(w.pressure)+" hPa"+(w.pressureTrend?", "+esc(w.pressureTrend):""):"–"],
      ["Tryckändring",`${fmtDelta(w.pressureDelta3h,"hPa")} på 3 h · ${fmtDelta(w.pressureDelta24h,"hPa")} på 24 h`],
      ["Vind",w.windMs!=null?`${windDirTxt(w.windDir)} ${fmt1(w.windMs)} m/s${w.gustMs?` (byar ${Math.round(w.gustMs)})`:""}${w.windShift3h!=null&&Math.abs(w.windShift3h)>=45?`, vred ${Math.abs(w.windShift3h)}° på 3 h`:""}`:"–"],
      ["Moln",w.cloudPct!=null?w.cloudPct+" %":"–"],["Nederbörd",w.precipMm!=null?fmt1(w.precipMm)+" mm"+(w.precip24hMm!=null?` (${fmt1(w.precip24hMm)} mm senaste dygnet)`:""):"–"],["Källa","Open-Meteo, beräknat för platsen"]]
      :[["Väder",c.weather_status==="pending"?"Hämtas":c.weather_status==="nopos"?"Ingen position":"Saknas"]]),
    ["Ljus",esc(c.light||"–")],["Måne",c.moon?`${esc(c.moon.phase)}, ${c.moon.illum} % belyst${sol&&sol!=="Övrig tid"?" · "+esc(A.FACTORS.find(x=>x.key==="sol").text(sol).toLowerCase()):""}`:"–"],
    ...(c.lat!=null?[["Position",`<a href="https://www.google.com/maps?q=${c.lat},${c.lon}" target="_blank" rel="noopener" style="color:var(--accent)">${Number(c.lat).toFixed(4)}, ${Number(c.lon).toFixed(4)}</a>`]]:[]),
  ];
  const host=openOverlay(`<div class="sheet-head"><h2>${esc(c.species)}${c.weight_kg?` · ${esc(fmtKg(c.weight_kg))}`:""}</h2><button class="x" data-close aria-label="Stäng">${I.x}</button></div>
    <div style="display:grid;gap:16px">${photoImg(c.photo, c.species, "detail-img")}${c.note?`<p style="margin:0">${esc(c.note)}</p>`:""}
      <dl class="kv">${rows.map(([k,v])=>`<dt>${k}</dt><dd>${v}</dd>`).join("")}</dl>
      <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center"><button class="btn" id="dEdit">Redigera</button>${canDeleteCatch(c)?`<button class="btn danger ghost" id="dDel">Ta bort</button>`:`<span class="muted" style="font-size:13px">Bara ${esc(m?.name||"den som fångade den")} eller admin kan ta bort fångsten.</span>`}</div><div id="dConfirm"></div></div>`);
  hydratePhotos(host);
  $("#dEdit").onclick=()=>openForm(c);
  host.querySelectorAll("[data-bait-open]").forEach(b=>b.onclick=()=>openBait(b.dataset.baitOpen));
  host.querySelectorAll("[data-trip-open]").forEach(b=>b.onclick=()=>openTrip(b.dataset.tripOpen));
  if ($("#dDel")) $("#dDel").onclick=()=>{
    $("#dConfirm").innerHTML=`<div class="banner warn" style="display:grid;gap:10px"><span>Ta bort fångsten för alla fiskekompisar? Det går inte att ångra.</span><div style="display:flex;gap:10px"><button class="btn danger" id="dYes">Ta bort</button><button class="btn ghost" id="dNo">Avbryt</button></div></div>`;
    $("#dNo").onclick=()=>$("#dConfirm").innerHTML="";
    $("#dYes").onclick=async()=>{ try{ await dbRemove("catches", c.id); if (c.photo && !S.catches.some(x=>x.photo===c.photo)) S.api.removePhoto(c.photo).catch(()=>{}); closeOverlay(); render(); toast("Fångsten är borttagen"); }catch(e){ toast(errText(e)); } };
  };
}

// ---------- fångstformuläret ----------
function recentBaits(){ return count(S.catches.filter(c=>c.member_id===S.me.id).slice(0,60),baitName).slice(0,6).map(x=>x[0]); }
function topSpecies(){ return [...new Set([...count(S.catches,c=>c.species).map(x=>x[0]),...SPECIES])]; }
function openForm(edit=null){
  const F={ file:null, lat:edit?.lat??null, lon:edit?.lon??null, exifTime:false, exifGps:false, phone:null, phoneGps:false, lakeTouched:!!edit, species:edit?.species||"", technique:edit?.technique||"", saving:false, newBaitType:"" };
  const lastMine=S.catches.find(c=>c.member_id===S.me.id), baits=recentBaits(), sp=topSpecies();
  const host=openOverlay(`<div class="sheet-head"><h2>${edit?"Redigera fångst":"Ny fångst"}</h2><button class="x" data-close aria-label="Stäng">${I.x}</button></div>
  <form class="form" id="cf" novalidate>
    <div class="field"><label class="photo-drop" id="drop" for="photoCam">${edit?.photo?photoImg(edit.photo,"","pv"):`<span class="hint">${I.cam}<b>Ta en bild</b><span>Tid och plats läses från fotot när det går</span></span>`}</label>
      <div class="photo-btns"><label class="btn" for="photoCam">${I.cam.replace("<svg","<svg width=18 height=18")} Ta bild</label><label class="btn" for="photoLib"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M3 15l5-4 4 3 3-2 6 4"/><circle cx="16" cy="9" r="1.6"/></svg> Välj bild</label></div>
      <input type="file" id="photoCam" accept="image/*" capture="environment" hidden aria-label="Ta bild med kameran"><input type="file" id="photoLib" accept="image/*" hidden aria-label="Välj bild ur galleriet">
      <div class="auto" id="auto"></div></div>
    <div class="field"><span class="label">Art</span><div class="chips" id="spChips">${sp.slice(0,9).map(s=>`<button type="button" class="chip" data-v="${esc(s)}" aria-pressed="${F.species===s}">${esc(s)}</button>`).join("")}</div>
      <input class="inp" id="spOther" list="spList" placeholder="Annan art" value="${esc(sp.slice(0,9).includes(F.species)?"":F.species)}"><datalist id="spList">${sp.map(s=>`<option value="${esc(s)}">`).join("")}</datalist></div>
    <div class="row2"><div class="field"><label for="fKg">Vikt (g)</label><input class="inp num" id="fKg" inputmode="numeric" placeholder="850" value="${edit?.weight_kg!=null?Math.round(edit.weight_kg*1000):""}"></div>
      <div class="field"><label for="fCm">Längd (cm)</label><input class="inp num" id="fCm" inputmode="decimal" placeholder="42" value="${edit?.length_cm!=null?String(edit.length_cm).replace(".",","):""}"></div></div>
    <div class="field"><label for="fBait">Bete</label><input class="inp" id="fBait" list="baitList" placeholder="Sök i betesboxen eller skriv nytt" value="${esc(edit?baitName(edit):"")}" autocomplete="off">
      <datalist id="baitList">${S.baits.map(b=>`<option value="${esc(b.name)}" label="${esc(baitDesc(b))}">`).join("")}</datalist>
      ${baits.length?`<div class="chips">${lastMine&&baitName(lastMine)&&!edit?`<button type="button" class="chip small" data-bait="${esc(baitName(lastMine))}">Samma som sist: ${esc(baitName(lastMine))}</button>`:""}${baits.filter(b=>edit||b!==baitName(lastMine||{})).map(b=>`<button type="button" class="chip small" data-bait="${esc(b)}">${esc(b)}</button>`).join("")}</div>`:""}
      <div id="newBaitBox" hidden style="display:grid;gap:8px"><span class="muted" style="font-size:13px">Nytt bete. Det läggs till i betesboxen. Vilken typ?</span><div class="chips" id="nbType">${BAIT_TYPES.map(t=>`<button type="button" class="chip small" data-v="${esc(t)}" aria-pressed="false">${esc(t)}</button>`).join("")}</div>
        <span class="muted" style="font-size:13px">Bild på betet (valfritt)</span>${photoPicker("nbp", null, true)}</div>
      <span class="muted" id="baitHint" style="font-size:13px"></span></div>
    <div class="field"><span class="label">Teknik</span><div class="chips" id="teChips">${TECH.map(t=>`<button type="button" class="chip small" data-v="${esc(t)}" aria-pressed="${F.technique===t}">${esc(t)}</button>`).join("")}</div></div>
    <div class="row2"><div class="field"><label for="fWater">Vattentemp (°C)</label><input class="inp num" id="fWater" inputmode="decimal" placeholder="14,5" value="${edit?.water_temp_c!=null?String(edit.water_temp_c).replace(".",","):""}"></div>
      <span class="muted" style="font-size:13px;align-self:end;padding-bottom:12px">Från ekolodet eller termometern. Valfritt, men viktigt för mönstren.</span></div>
    <div class="row2"><div class="field"><label for="fDepth">Bottendjup (m)</label><input class="inp num" id="fDepth" inputmode="decimal" placeholder="8,5" value="${edit?.depth_m!=null?String(edit.depth_m).replace(".",","):""}"></div>
      <div class="field"><label for="fFishDepth">Fisken högg på (m)</label><input class="inp num" id="fFishDepth" inputmode="decimal" placeholder="ca 6" value="${edit?.fish_depth_m!=null?String(edit.fish_depth_m).replace(".",","):""}"></div></div>
    <span class="muted" style="font-size:13px;margin-top:-8px">Bottendjupet från ekolodet. Djupet fisken högg på räcker som en uppskattning. Båda är valfria.</span>
    <div class="field"><label for="fLake">Vatten</label>${lakeSelect("fLake", edit?.lake_id||activeTrip(S.me.id)?.lake_id||"")}<input class="inp" id="fLakeNew" placeholder="Namn på sjö eller plats" hidden maxlength="60"><span class="muted" id="lakeHint" style="font-size:13px"></span></div>
    <div class="field"><label for="fTime">Tid</label><input class="inp" type="datetime-local" id="fTime" value="${toLocalInput(edit?new Date(edit.time):new Date())}"></div>
    <div class="field"><label for="fAngler">Fiskare</label><select class="inp" id="fAngler">${S.members.filter(m=>m.active||m.id===edit?.member_id).map(m=>`<option value="${esc(m.id)}" ${m.id===(edit?.member_id||S.me.id)?"selected":""}>${esc(m.name)}</option>`).join("")}</select></div>
    <div class="toggle"><label for="fRel" style="font-weight:600">Återutsatt (catch &amp; release)</label><input type="checkbox" class="switch" id="fRel" ${edit?.released?"checked":""}></div>
    <div class="field"><label for="fNote">Anteckning</label><textarea class="inp" id="fNote" rows="2" placeholder="Djup, var på sjön, hur fisken stod…">${esc(edit?.note||"")}</textarea></div>
    <div class="err" id="fErr" role="alert"></div>
    <div class="form-actions"><button type="button" class="btn ghost" data-close>Avbryt</button><button type="submit" class="btn primary" id="fSave">${edit?"Spara ändringar":"Spara fångst"}</button></div>
  </form>`);
  hydratePhotos(host);
  const ic=(svg)=>svg.replace("<svg","<svg width=13 height=13");
  const auto=()=>{ const bits=[];
    if (F.file) bits.push(F.exifTime?`<span>${ic(I.clock)} Tid från bilden</span>`:`<span class="off">Ingen tid i bilden</span>`);
    if (F.exifGps) bits.push(`<span>${ic(I.pin)} Position från bilden</span>`);
    else if (F.phoneGps) bits.push(`<span>${ic(I.pin)} Position från telefonen</span>`);
    else if (F.file) bits.push(`<span class="off">Ingen GPS i bilden</span>`);
    $("#auto").innerHTML=bits.join(""); };
  // iPhone skickar oftast inte med bildens plats till webbsidor. Är fångsten från just nu används telefonens position i stället.
  const nearNow=()=>{ const v=$("#fTime").value; if(!v) return true; return Math.abs(new Date(v).getTime()-Date.now()) <= 45*60000; };
  const applyPhone=()=>{
    if (edit || F.exifGps) return;
    const use = !!F.phone && nearNow();
    if (use && !F.phoneGps){ F.lat=F.phone.lat; F.lon=F.phone.lon; F.phoneGps=true; auto(); if (!F.lakeTouched) matchLake(); }
    else if (!use && F.phoneGps){ F.lat=null; F.lon=null; F.phoneGps=false; auto(); if (!F.lakeTouched) matchLake(); }
  };
  const setLake=()=>{ const sel=$("#fLake"), nw=$("#fLakeNew"); nw.hidden = sel.value!=="__new"; };
  const matchLake=()=>{ const hint=$("#lakeHint");
    if (F.lat==null){ hint.textContent=F.file?"Ingen position. Välj vatten själv, så används vattnets position.":""; return; }
    const m=nearestLake(F.lat,F.lon);
    if (m){ $("#fLake").value=m.lake.id; hint.textContent=`Känns igen: ${m.lake.name} (${m.d<1?Math.round(m.d*1000)+" m":fmt1(m.d)+" km"} bort)`; }
    else { $("#fLake").value="__new"; hint.textContent="Nytt ställe. Skriv namnet en gång så känns det igen nästa gång."; }
    setLake(); };
  $("#fLake").onchange=()=>{ F.lakeTouched=true; setLake(); };
  $("#fTime").addEventListener("change", applyPhone);
  if (!edit) getPosition().then(p=>{ F.phone=p; if ($("#cf")) applyPhone(); });
  const chipGroup=(id,key)=>$(id).querySelectorAll("[data-v]").forEach(b=>b.onclick=()=>{ F[key]=F[key]===b.dataset.v?"":b.dataset.v; $(id).querySelectorAll("[data-v]").forEach(x=>x.setAttribute("aria-pressed",x.dataset.v===F[key])); if(key==="species") $("#spOther").value=""; });
  chipGroup("#spChips","species"); chipGroup("#teChips","technique");
  $("#spOther").oninput=(e)=>{ F.species=e.target.value.trim(); $("#spChips").querySelectorAll("[data-v]").forEach(x=>x.setAttribute("aria-pressed",x.dataset.v===F.species)); };
  const baitCheck=()=>{ const v=$("#fBait").value.trim(), b=findBaitByName(v); $("#newBaitBox").hidden = !v || !!b; $("#baitHint").textContent = b ? baitDesc(b) : ""; };
  $("#fBait").oninput=baitCheck;
  host.querySelectorAll("[data-bait]").forEach(b=>b.onclick=()=>{ $("#fBait").value=b.dataset.bait; baitCheck(); });
  $("#nbType").querySelectorAll("[data-v]").forEach(b=>b.onclick=()=>{ F.newBaitType=F.newBaitType===b.dataset.v?"":b.dataset.v; $("#nbType").querySelectorAll("[data-v]").forEach(x=>x.setAttribute("aria-pressed",x.dataset.v===F.newBaitType)); });
  baitCheck(); bindPicker("nbp", f=>{ F.baitFile=f; });
  if (edit) $("#lakeHint").textContent=edit.lat!=null?`Position ${Number(edit.lat).toFixed(3)}, ${Number(edit.lon).toFixed(3)}`:"";
  const onPhoto=async(e)=>{
    const file=e.target.files?.[0]; if(!file) return;
    F.file=file; F.exifTime=false; if (F.exifGps){ F.exifGps=false; F.lat=null; F.lon=null; }
    $("#drop").querySelector(".hint")?.remove(); $("#drop").querySelector("img")?.remove();
    const img=document.createElement("img"); img.alt=""; img.src=URL.createObjectURL(file); $("#drop").prepend(img);
    try{ if (window.exifr){
      const meta=await window.exifr.parse(file,{gps:true,pick:["DateTimeOriginal","CreateDate","latitude","longitude","GPSLatitude","GPSLongitude","GPSLatitudeRef","GPSLongitudeRef"]});
      const t=meta?.DateTimeOriginal||meta?.CreateDate;
      if (t instanceof Date && !isNaN(t)){ $("#fTime").value=toLocalInput(t); F.exifTime=true; }
      if (meta && typeof meta.latitude==="number" && typeof meta.longitude==="number"){ F.lat=meta.latitude; F.lon=meta.longitude; F.exifGps=true; F.phoneGps=false; }
    } }catch(err){}
    if (!F.exifGps){ F.phoneGps=false; if (!edit){ F.lat=null; F.lon=null; } applyPhone(); }
    auto(); if (F.exifGps || !F.lakeTouched) matchLake();
  };
  $("#photoCam").onchange=onPhoto; $("#photoLib").onchange=onPhoto;
  $("#cf").onsubmit=async(e)=>{
    e.preventDefault(); if(F.saving) return; const err=$("#fErr"); err.textContent="";
    const species=F.species || $("#spOther").value.trim(); if (!species){ err.textContent="Välj vilken art det är."; return; }
    const pn=(id)=>{ const v=$(id).value.replace(",",".").trim(); return v?Number(v):null; };
    const weight_g=pn("#fKg"), length_cm=pn("#fCm"), water_temp_c=pn("#fWater");
    const depth_m=pn("#fDepth"), fish_depth_m=pn("#fFishDepth");
    const weight_kg = weight_g==null ? null : Math.round(weight_g)/1000;
    if ((weight_kg!=null && !(weight_kg>0 && weight_kg<200)) || (length_cm!=null && !(length_cm>0 && length_cm<400))){ err.textContent="Kontrollera vikt och längd, använd bara siffror."; return; }
    if ((depth_m!=null && !(depth_m>0 && depth_m<=300)) || (fish_depth_m!=null && !(fish_depth_m>=0 && fish_depth_m<=300))){ err.textContent="Kontrollera djupet, använd bara siffror i meter."; return; }
    if (depth_m!=null && fish_depth_m!=null && fish_depth_m>depth_m+0.5){ err.textContent="Fisken kan inte ha huggit djupare än botten. Kontrollera djupen."; return; }
    if (water_temp_c!=null && !(water_temp_c>=-2 && water_temp_c<=35)){ err.textContent="Vattentemperaturen ska vara ett tal mellan −2 och 35 °C."; return; }
    const t=$("#fTime").value?new Date($("#fTime").value):new Date(); if (isNaN(t)){ err.textContent="Ange en giltig tid."; return; }
    const lakeSel=$("#fLake").value, newName=$("#fLakeNew").value.trim();
    if (lakeSel==="__new" && !newName){ err.textContent="Skriv namnet på vattnet eller välj ett sparat."; return; }
    F.saving=true; const btn=$("#fSave"); btn.disabled=true; btn.innerHTML=`<span class="spin"></span> Sparar…`;
    try{
      let photo=edit?.photo||null;
      if (F.file){ btn.innerHTML=`<span class="spin"></span> Laddar upp bild…`; photo=await S.api.upload(await shrink(F.file)); }
      const lake = await resolveLake(lakeSel, newName, (F.exifGps||F.phoneGps)?{lat:F.lat,lon:F.lon}:null);
      const baitText=$("#fBait").value.trim(); let bait_id=null, bait=baitText;
      if (baitText){ const b=findBaitByName(baitText);
        if (b){ bait_id=b.id; bait=b.name; } else {
          let bphoto=null; if (F.baitFile){ btn.innerHTML=`<span class="spin"></span> Laddar upp betesbild…`; bphoto=await S.api.upload(await shrink(F.baitFile)); }
          const nb=await dbInsert("baits",{ name:baitText, type:F.newBaitType||"Övrigt", owner:$("#fAngler").value, photo:bphoto }); bait_id=nb.id; } }
      let lat=F.lat, lon=F.lon, pos_source=F.exifGps?"photo":F.phoneGps?"phone":(edit?.pos_source||null);
      if (lat==null && lake?.lat!=null){ lat=lake.lat; lon=lake.lon; pos_source="lake"; }
      const member_id=$("#fAngler").value, timeISO=t.toISOString();
      const trip = tripFor(member_id, t.getTime());
      const moved = !edit || edit.time!==timeISO || edit.lat!==lat || edit.lon!==lon;
      const row={ member_id, species, bait, bait_id, technique:F.technique, weight_kg, length_cm, water_temp_c, depth_m, fish_depth_m, released:$("#fRel").checked, note:$("#fNote").value.trim(),
        time:timeISO, lat, lon, pos_source, lake_id:lake?.id||null, lake_name:lake?.name||null, photo, trip_id: trip?.id || null,
        light: A.light(t,lat,lon), moon: A.moonPhase(t) };
      if (moved){ btn.innerHTML=`<span class="spin"></span> Hämtar väder…`; Object.assign(row, await weatherForCatch(row).catch(()=>({ weather:null, weather_status: lat!=null?"pending":"nopos" }))); }
      if (edit) await dbUpdate("catches", edit.id, row); else await dbInsert("catches", { ...row, created_by: S.me.id });
      if (edit?.photo && photo!==edit.photo && !S.catches.some(x=>x.photo===edit.photo)) S.api.removePhoto(edit.photo).catch(()=>{});
      if (trip && trip.lat==null && lat!=null) dbUpdate("trips", trip.id, { lat, lon }).catch(()=>{});
      closeOverlay(); if (S.tab!=="trips") S.tab="feed"; render(); toast(edit?"Ändringarna är sparade":`${species} sparad`);
    }catch(ex){ F.saving=false; btn.disabled=false; btn.textContent=edit?"Spara ändringar":"Spara fångst"; err.textContent=errText(ex); }
  };
}

// ---------- kopplingar ----------
function bindView(){
  $$("#main [data-open]").forEach(b=>b.onclick=()=>openDetail(b.dataset.open));
  $$("#main [data-new]").forEach(b=>b.onclick=()=>openForm());
  $$("#main [data-new-bait]").forEach(b=>b.onclick=()=>openBaitForm());
  $$("#main [data-catalog]").forEach(b=>b.onclick=()=>openCatalog());
  $$("#main [data-trip-start]").forEach(b=>b.onclick=()=>startTrip());
  $$("#main [data-trip-end]").forEach(b=>b.onclick=()=>endTrip(b.dataset.tripEnd));
  $$("#main [data-trip-open]").forEach(b=>b.onclick=()=>openTrip(b.dataset.tripOpen));
  $$("#main [data-trip-past]").forEach(b=>b.onclick=()=>tripForm());
  $$("#main [data-lake-open]").forEach(b=>b.onclick=()=>openLake(b.dataset.lakeOpen));
  $$("#main [data-go]").forEach(b=>b.onclick=()=>go(b.dataset.go));
  $$("#main [data-factor]").forEach(b=>b.onclick=()=>{ S.factor=b.dataset.factor; render(); });
  $$("#main [data-export]").forEach(b=>b.onclick=()=>exportData(b.dataset.export));
  $$("#main [data-logout]").forEach(b=>b.onclick=async()=>{ await S.api.signOut(); S.session=null; S.me=null; renderAuth(); });
  $$("#main [data-rename]").forEach(b=>b.onclick=async()=>{ const n=prompt("Ditt namn i appen", S.me.name); if (n && n.trim()){ try{ await dbUpdate("members", S.me.id, { name:n.trim().slice(0,30) }); S.me=member(S.me.id); render(); }catch(e){ toast(errText(e)); } } });
  $$("#main [data-invite]").forEach(b=>b.onclick=()=>openInvite(member(b.dataset.invite)));
  $$("#main [data-setpw]").forEach(b=>b.onclick=()=>openSetPassword(member(b.dataset.setpw)));
  const pwf=$("#pwForm"); if (pwf) pwf.onsubmit=(e)=>{ e.preventDefault(); changeOwnPassword(); };
  $$("#main [data-toggle]").forEach(b=>b.onclick=async()=>{ const m=member(b.dataset.toggle); try{ await dbUpdate("members", m.id, { active:!m.active }); render(); }catch(e){ toast(errText(e)); } });
  const am=$("#addMember"); if (am) am.onsubmit=(e)=>{ e.preventDefault(); addMember(); };
  bindBaitList();
  $$("#main [data-bt]").forEach(b=>b.onclick=()=>{S.baitType=b.dataset.bt;render();});
  const bq=$("#bq"); if (bq) bq.oninput=()=>{ S.baitQ=bq.value; $("#baitListBox").innerHTML=baitListHtml(); bindBaitList(); };
  const bs=$("#bsort"); if (bs) bs.onchange=()=>{ S.baitSort=bs.value; $("#baitListBox").innerHTML=baitListHtml(); bindBaitList(); };
  $$("#main [data-wf]").forEach(b=>b.onclick=()=>{S[b.dataset.wf]=b.dataset.id;render();});
  $$("#main [data-sp]").forEach(b=>b.onclick=()=>{S.statSpecies=b.dataset.sp;render();});
  $$("#main .col[data-tip]").forEach(c=>{
    c.onmouseenter=()=>{ const r=c.getBoundingClientRect(); $("#tipHost").innerHTML=`<div class="tip" style="left:${r.left+r.width/2}px;top:${r.top}px">${esc(c.dataset.tip)}</div>`; };
    c.onmouseleave=()=>{$("#tipHost").innerHTML="";};
  });
}
// Menyn på datorn ska fastna precis under rubrikraden, vars höjd beror på typsnittet.
const setTopH=()=>{ const h=$(".top")?.offsetHeight; if (h) document.documentElement.style.setProperty("--top-h", h+"px"); };
setTopH(); window.addEventListener("resize", setTopH); document.fonts?.ready?.then(setTopH);
$$(".tab").forEach(t=>t.onclick=()=>go(t.dataset.tab));
$("#fab").onclick=()=>{ if (S.me) openForm(); };
$("#meBtn").onclick=()=>go("gang");
document.addEventListener("visibilitychange",()=>{ if (document.visibilityState==="visible" && S.me){ markSeen(); backfillWeather(); } });
boot();
