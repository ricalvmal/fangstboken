// Fångstboken: beräkningar utan beroenden (sol, måne, väder, mönster).
export const H = 3600000;
const rad = Math.PI / 180;

// ---------- Sol och måne ----------
export function moonPhase(date) {
  const syn = 29.530588853, ref = Date.UTC(2000, 0, 6, 18, 14);
  const age = ((((date.getTime() - ref) / 864e5) % syn) + syn) % syn;
  const illum = Math.round((1 - Math.cos(2 * Math.PI * age / syn)) / 2 * 100);
  const names = ["Nymåne", "Tilltagande skära", "Första kvarteret", "Tilltagande måne", "Fullmåne", "Avtagande måne", "Sista kvarteret", "Avtagande skära"];
  return { phase: names[Math.floor((age / syn) * 8 + 0.5) % 8], illum };
}
export function sunAlt(date, lat, lon) {
  const d = (date.getTime() / 864e5) + 2440587.5 - 2451545.0;
  const g = (357.529 + 0.98560028 * d) * rad, q = 280.459 + 0.98564736 * d;
  const L = (q + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * rad, e = (23.439 - 0.00000036 * d) * rad;
  const RA = Math.atan2(Math.cos(e) * Math.sin(L), Math.cos(L)), dec = Math.asin(Math.sin(e) * Math.sin(L));
  const gmst = (18.697374558 + 24.06570982441908 * d) % 24;
  const Hh = ((gmst * 15 + lon) * rad) - RA;
  return Math.asin(Math.sin(lat * rad) * Math.sin(dec) + Math.cos(lat * rad) * Math.cos(dec) * Math.cos(Hh)) / rad;
}
export function light(date, lat, lon) {
  if (lat == null) return null;
  const a = sunAlt(date, lat, lon);
  if (a > 6) return "Dagsljus";
  if (a < -6) return "Mörker";
  return sunAlt(new Date(date.getTime() + 12e5), lat, lon) > a ? "Gryning" : "Skymning";
}
// Månens höjd över horisonten i grader (förenklad modell, räcker för solunar-perioder).
export function moonAlt(ms, lat, lon) {
  const d = ms / 864e5 - 0.5 + 2440588 - 2451545, e = rad * 23.4397;
  const L = rad * (218.316 + 13.176396 * d), M = rad * (134.963 + 13.064993 * d), F = rad * (93.272 + 13.229350 * d);
  const l = L + rad * 6.289 * Math.sin(M), b = rad * 5.128 * Math.sin(F);
  const ra = Math.atan2(Math.sin(l) * Math.cos(e) - Math.tan(b) * Math.sin(e), Math.cos(l));
  const dec = Math.asin(Math.sin(b) * Math.cos(e) + Math.cos(b) * Math.sin(e) * Math.sin(l));
  const Hh = rad * (280.16 + 360.9856235 * d) - rad * -lon - ra, phi = rad * lat;
  return Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(Hh)) / rad;
}
// Storperiod: ±60 min kring månens högsta/lägsta läge. Lillperiod: ±45 min kring upp- eller nedgång.
export function solunar(ms, lat, lon) {
  if (lat == null || lon == null) return null;
  const step = 10 * 60000, pts = [];
  for (let t = ms - 14 * H; t <= ms + 14 * H; t += step) pts.push([t, moonAlt(t, lat, lon)]);
  let major = false, minor = false;
  for (let i = 1; i < pts.length - 1; i++) {
    const [t, a] = pts[i], p = pts[i - 1][1], n = pts[i + 1][1];
    if (((a >= p && a > n) || (a <= p && a < n)) && Math.abs(t - ms) <= 60 * 60000) major = true;
    if ((p < 0) !== (a < 0) && Math.abs(t - ms) <= 45 * 60000) minor = true;
  }
  return major ? "Storperiod" : minor ? "Lillperiod" : "Övrig tid";
}

// ---------- Väder ----------
// Timserie från Open-Meteo, lagrad kompakt: { t0, t:[], p:[], ws:[], wd:[], g:[], c:[], r:[] }.
export const WX_KEYS = ["t", "p", "ws", "wd", "g", "c", "r"];
export function seriesAt(s, ms, key) {
  if (!s || !s[key]) return null;
  const i = Math.round((ms - s.t0) / H);
  const v = s[key][i];
  return v == null || Number.isNaN(v) ? null : v;
}
export function seriesCovers(s, fromMs, toMs) {
  if (!s || !s.t) return false;
  const last = s.t0 + (s.t.length - 1) * H;
  return s.t0 <= fromMs && last >= toMs;
}
const r1 = (x) => x == null ? null : Math.round(x * 10) / 10;
const dlt = (a, b) => a == null || b == null ? null : r1(a - b);
export function angleDiff(a, b) { if (a == null || b == null) return null; let d = ((a - b) % 360 + 540) % 360 - 180; return Math.round(d); }
// Väder vid timmen närmast ms, med förändringar bakåt i tiden.
export function weatherAt(s, ms) {
  const T = Math.round(ms / H) * H, g = (back, k) => seriesAt(s, T - back * H, k);
  const t = g(0, "t"), p = g(0, "p");
  if (t == null && p == null && g(0, "ws") == null) return null;
  const d3 = dlt(p, g(3, "p"));
  const rain = []; for (let b = 0; b < 24; b++) rain.push(g(b, "r"));
  const hasRain = rain.some(x => x != null);
  return {
    tempC: r1(t), pressure: r1(p),
    pressureTrend: d3 == null ? null : d3 > 1 ? "stigande" : d3 < -1 ? "fallande" : "stabilt",
    pressureDelta3h: d3, pressureDelta24h: dlt(p, g(24, "p")), tempDelta24h: dlt(t, g(24, "t")),
    windMs: r1(g(0, "ws")), windDir: g(0, "wd") == null ? null : Math.round(g(0, "wd")),
    windShift3h: angleDiff(g(0, "wd"), g(3, "wd")), gustMs: r1(g(0, "g")),
    cloudPct: g(0, "c") == null ? null : Math.round(g(0, "c")), precipMm: r1(g(0, "r")),
    precip24hMm: hasRain ? r1(rain.reduce((a, x) => a + (x || 0), 0)) : null,
    source: "Open-Meteo", obsTime: new Date(T).toISOString(),
  };
}
// Gör om ett Open-Meteo-svar (timeformat=unixtime) till kompakt serie inom [fromMs, toMs].
export function compactOpenMeteo(json, fromMs, toMs) {
  const h = json && json.hourly; if (!h || !h.time) return null;
  const map = { t: "temperature_2m", p: "pressure_msl", ws: "wind_speed_10m", wd: "wind_direction_10m", g: "wind_gusts_10m", c: "cloud_cover", r: "precipitation" };
  const idx = [];
  h.time.forEach((sec, i) => { const ms = sec * 1000; if (ms >= fromMs - H && ms <= toMs + H) idx.push(i); });
  if (!idx.length) return null;
  const out = { t0: h.time[idx[0]] * 1000 };
  for (const [k, name] of Object.entries(map)) out[k] = idx.map(i => (h[name] && h[name][i] != null) ? h[name][i] : null);
  return out;
}

// ---------- Faktorer ----------
export const FACTORS = [
  { key: "trend3", label: "Lufttryck, 3 timmar", order: ["Stigande", "Stabilt", "Fallande"], text: v => ({ Stigande: "Stigande tryck", Stabilt: "Stabilt tryck", Fallande: "Fallande tryck" })[v] },
  { key: "d24", label: "Lufttryck, ett dygn", order: ["Stigande", "Stabilt", "Fallande"], text: v => ({ Stigande: "Trycket steg senaste dygnet", Stabilt: "Stabilt tryck senaste dygnet", Fallande: "Trycket föll senaste dygnet" })[v] },
  { key: "temp24", label: "Temperatur mot i går", order: ["Varmare", "Samma", "Kallare"], text: v => ({ Varmare: "Varmare än i går", Samma: "Lika varmt som i går", Kallare: "Kallare än i går" })[v] },
  { key: "moln", label: "Moln", order: ["Klart", "Halvklart", "Mulet"], text: v => v },
  { key: "vind", label: "Vind", order: ["Svag", "Måttlig", "Hård"], text: v => v + " vind" },
  { key: "regn", label: "Nederbörd", order: ["Uppehåll", "Regn"], text: v => v },
  { key: "ljus", label: "Ljus", order: ["Gryning", "Dagsljus", "Skymning", "Mörker"], text: v => v },
  { key: "sol", label: "Månens läge", order: ["Storperiod", "Lillperiod", "Övrig tid"], text: v => ({ Storperiod: "Månens storperiod", Lillperiod: "Månens lillperiod", "Övrig tid": "Utanför månperiod" })[v] },
];
export function features(w, ms, lat, lon) {
  const f = {};
  if (w) {
    const d3 = w.pressureDelta3h, d24 = w.pressureDelta24h, t24 = w.tempDelta24h;
    if (d3 != null) f.trend3 = d3 > 1 ? "Stigande" : d3 < -1 ? "Fallande" : "Stabilt";
    if (d24 != null) f.d24 = d24 > 3 ? "Stigande" : d24 < -3 ? "Fallande" : "Stabilt";
    if (t24 != null) f.temp24 = t24 > 2 ? "Varmare" : t24 < -2 ? "Kallare" : "Samma";
    if (w.cloudPct != null) f.moln = w.cloudPct < 25 ? "Klart" : w.cloudPct < 75 ? "Halvklart" : "Mulet";
    if (w.windMs != null) f.vind = w.windMs < 3 ? "Svag" : w.windMs <= 7 ? "Måttlig" : "Hård";
    if (w.precipMm != null) f.regn = w.precipMm > 0.1 ? "Regn" : "Uppehåll";
  }
  if (lat != null && lon != null) {
    f.ljus = light(new Date(ms), lat, lon);
    f.sol = solunar(ms, lat, lon);
  }
  return f;
}

// ---------- Fiskade timmar ----------
// En post per påbörjad timme av varje avslutad tur, viktad med hur stor del av timmen som fiskades.
export function fishedHours(trips) {
  const out = [];
  for (const tr of trips) {
    if (!tr.ended_at || !tr.weather) continue;
    const s = Date.parse(tr.started_at), e = Date.parse(tr.ended_at);
    if (!(e > s)) continue;
    for (let h = Math.floor(s / H) * H; h < e; h += H) {
      const w = (Math.min(e, h + H) - Math.max(s, h)) / H; if (w <= 0) continue;
      const mid = Math.max(s, h) + (Math.min(e, h + H) - Math.max(s, h)) / 2;
      const wx = weatherAt(tr.weather, mid);
      out.push({ ms: mid, w, trip: tr.id, lake: tr.lake_id, feats: features(wx, mid, tr.lat, tr.lon), wx });
    }
  }
  return out;
}
export function catchFeatures(c) { return features(c.weather, Date.parse(c.time), c.lat, c.lon); }

// Fångster per fiskad timme för varje värde av en faktor.
export function rateByFactor(hours, tripCatches, factorKey) {
  const f = FACTORS.find(x => x.key === factorKey);
  const H_ = hours.reduce((a, h) => a + h.w, 0), N = tripCatches.length;
  const overall = H_ ? N / H_ : 0;
  const rows = f.order.map(v => {
    const h = hours.filter(x => x.feats[factorKey] === v).reduce((a, x) => a + x.w, 0);
    const n = tripCatches.filter(c => c.feats[factorKey] === v).length;
    return { value: v, hours: h, n, rate: h ? n / h : 0 };
  });
  return { overall, totalHours: H_, total: N, rows };
}
// Par av förhållanden där det nappat bäst jämfört med snittet.
export function topCombos(hours, tripCatches, { minHours = 3, minCatches = 3, limit = 6 } = {}) {
  const H_ = hours.reduce((a, h) => a + h.w, 0), N = tripCatches.length;
  if (!H_ || !N) return [];
  const overall = N / H_, res = [];
  for (let i = 0; i < FACTORS.length; i++) for (let j = i + 1; j < FACTORS.length; j++) {
    const A = FACTORS[i], B = FACTORS[j];
    for (const va of A.order) for (const vb of B.order) {
      const h = hours.filter(x => x.feats[A.key] === va && x.feats[B.key] === vb).reduce((a, x) => a + x.w, 0);
      if (h < minHours) continue;
      const n = tripCatches.filter(c => c.feats[A.key] === va && c.feats[B.key] === vb).length;
      if (n < minCatches) continue;
      const lift = (n / h) / overall;
      if (lift < 1.2) continue;
      res.push({ a: A, va, b: B, vb, hours: h, n, rate: n / h, lift, unsure: n < 8 || h < 8 });
    }
  }
  res.sort((x, y) => (y.unsure ? 0 : 1) - (x.unsure ? 0 : 1) || y.lift - x.lift);
  return res.slice(0, limit);
}

// ---------- Huggperioder ----------
// Minst `min` fångster på samma vatten där det går högst `gapMin` minuter mellan varje.
export function bitePeriods(catches, { gapMin = 45, min = 3 } = {}) {
  const key = c => c.lake_id || (c.lat != null ? c.lat.toFixed(2) + "," + c.lon.toFixed(2) : "okänt");
  const groups = new Map();
  for (const c of catches) { const k = key(c); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(c); }
  const out = [];
  for (const [k, list] of groups) {
    list.sort((a, b) => Date.parse(a.time) - Date.parse(b.time));
    let cur = [];
    const flush = () => { if (cur.length >= min) out.push({ lakeKey: k, catches: cur, start: Date.parse(cur[0].time), end: Date.parse(cur[cur.length - 1].time) }); };
    for (const c of list) {
      if (cur.length && Date.parse(c.time) - Date.parse(cur[cur.length - 1].time) > gapMin * 60000) { flush(); cur = []; }
      cur.push(c);
    }
    flush();
  }
  return out.sort((a, b) => b.start - a.start);
}
// Förhållanden som var ovanliga under en huggperiod, jämfört med alla fiskade timmar.
export function unusualFeatures(feats, hours) {
  const H_ = hours.reduce((a, h) => a + h.w, 0), out = {};
  if (H_ < 6) return out;
  for (const f of FACTORS) {
    const v = feats[f.key]; if (!v) continue;
    const share = hours.filter(x => x.feats[f.key] === v).reduce((a, x) => a + x.w, 0) / H_;
    if (share < 0.35) out[f.key] = share;
  }
  return out;
}
// Vilka förhållanden som är överrepresenterade i huggperioder jämfört med fiskad tid.
export function periodSummary(periods, hours) {
  const H_ = hours.reduce((a, h) => a + h.w, 0);
  if (!periods.length || H_ < 6) return [];
  const res = [];
  for (const f of FACTORS) for (const v of f.order) {
    const n = periods.filter(p => p.feats && p.feats[f.key] === v).length;
    if (!n) continue;
    const pShare = n / periods.length;
    const hShare = hours.filter(x => x.feats[f.key] === v).reduce((a, x) => a + x.w, 0) / H_;
    if (hShare > 0 && pShare / hShare >= 1.3) res.push({ f, v, n, pShare, hShare, lift: pShare / hShare });
  }
  return res.sort((a, b) => b.lift - a.lift).slice(0, 4);
}
