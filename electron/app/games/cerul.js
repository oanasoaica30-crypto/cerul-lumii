/* Cerul Lumii — companie aeriană pe harta lumii (2–4 jucători).
   Fișierul de integrare: Salon.register + bucla GAZDEI (host) care rulează simularea CerulLogic.step.
   Restul jocului stă în fișierele ajutătoare games/cerul-*.js (încărcate leneș dacă pagina nu le-a inclus). */
(function () {
"use strict";
if (typeof Salon === "undefined") return;
const ID = "cerul";

/* ---------------- încărcarea fișierelor ajutătoare (strict în ordine) ---------------- */
const SELF_SRC = (typeof document !== "undefined" && document.currentScript && document.currentScript.src) || "";
const FILES = [
  ["CerulData", "cerul-data.js", "datele"], ["CerulTheme", "cerul-theme.js", "tema"], ["CerulTune", "cerul-tune.js", "constantele"], ["CerulLogic", "cerul-logic.js", "logica"],
  ["CerulBot", "cerul-bot.js", "boții"], ["CerulArt", "cerul-art.js", "grafica"], ["CerulMap", "cerul-map.js", "harta"],
  ["CerulScenes", "cerul-scenes.js", "scenele"], ["CerulTutorial", "cerul-tutorial.js", "antrenamentul"], ["CerulGuide", "cerul-guide.js", "ghidul"], ["CerulUI", "cerul-ui.js", "interfața"],
];
let loadWait = null, loadTried = false;
const missing = new Set();
const srcOf = file => SELF_SRC ? SELF_SRC.replace(/cerul\.js(\?.*)?$/, file) : "games/" + file;
function allLoaded() { return FILES.every(([g]) => window[g]); }
function ensure(cb) {
  if (allLoaded()) { loadTried = true; cb(true); return; }
  if (loadWait) { loadWait.push(cb); return; }
  loadWait = [cb]; let i = 0;
  const fire = () => { const w = loadWait || []; loadWait = null; loadTried = true; const ok = allLoaded(); w.forEach(f => { try { f(ok); } catch (e) { console.error(e); } }); };
  const next = () => {
    while (i < FILES.length && window[FILES[i][0]]) i++;
    if (i >= FILES.length) { fire(); return; }
    const [g, file] = FILES[i++], sc = document.createElement("script");
    sc.src = srcOf(file); sc.async = false;
    sc.onload = () => { if (!window[g]) missing.add(file); next(); };
    sc.onerror = () => { missing.add(file); console.warn(file + " nu s-a putut încărca"); next(); };
    document.head.appendChild(sc);
  };
  next();
}
if (typeof document !== "undefined") ensure(() => {}); // pornim imediat: logica trebuie să fie gata la „Start”

/* ---------------- ceasul comun: baza de timp a gazdei ----------------
   Viteza de test (__CERUL_SPEED) e aplicată de CerulLogic (st.sp, din opts.speed la newGame); aici timpul e cel real. */
const CID = "c" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); // id-ul acestei pagini
const speed = () => { const s = +window.__CERUL_SPEED; return s > 0 && isFinite(s) ? s : 1; };
const rawNow = () => Date.now();
/* CLK: diferența dintre ceasul local și ceasul gazdei (st.hb = „acum”-ul gazdei la comitere).
   Ca în trenuri.js: minimul lui (acum − hb) pe ultimele comiteri ale altei pagini; se reia de la zero când se schimbă gazda.
   Când preiau eu conducerea, păstrez estimarea → timpul jocului continuă fără salt. */
const CLK = { skew: null, samples: [], host: null, sid: null, rev: null, seenAt: 0, firstSid: {} };
const nowTB = () => rawNow() - (CLK.skew || 0);
/* stare „din trecut”: o scriere întârziată (gazda veche a fost offline și își trimite lumea veche la revenire) are hb (timpul
   gazdei, aliniat între pagini) mult mai mic decât cel mai mare hb văzut deja în partida asta. Gazda care are lumea nouă o rescrie. */
CLK.maxHb = {}; CLK.staleAt = 0;
function isStale(st) {
  if (!st || !st.__sid || typeof st.hb !== "number") return false;
  const mx = CLK.maxHb[st.__sid];
  if (!(mx > st.hb + 5000)) { CLK.staleAt = 0; return false; }
  if (!CLK.staleAt) CLK.staleAt = Date.now();
  if (Date.now() - CLK.staleAt > 10000) { CLK.maxHb[st.__sid] = st.hb; CLK.staleAt = 0; return false; } // nimeni n-a refăcut-o: o acceptăm
  return true;
}
function observe(st) {
  if (!st || !st.__sid) return;
  if (CLK.sid === st.__sid && CLK.rev === st.__rev) return;
  if (isStale(st)) return;
  if (typeof st.hb === "number" && !(CLK.maxHb[st.__sid] >= st.hb)) CLK.maxHb[st.__sid] = st.hb;
  const firstOfSid = CLK.sid !== st.__sid;
  CLK.sid = st.__sid; CLK.rev = st.__rev; CLK.seenAt = Date.now();
  if (!CLK.firstSid[st.__sid]) CLK.firstSid[st.__sid] = Date.now();
  if (st.host === CID || typeof st.hb !== "number") return; // comiterile mele nu spun nimic despre ceas
  if (st.host !== CLK.host) { CLK.host = st.host; CLK.samples = []; }
  if (firstOfSid && CLK.skew == null && Date.now() - (st.__t || 0) > 4000) return; // stare veche (pagină reîncărcată)
  CLK.samples.push(rawNow() - st.hb); if (CLK.samples.length > 30) CLK.samples.shift();
  CLK.skew = Math.min(...CLK.samples);
}

/* ---------------- utilitare ---------------- */
const SEATN = s => +String(s).slice(1) || 99;
let warned = 0;
const warn = (m, e) => { if (warned++ < 12) console.error("[cerul] " + m, e); };
function seatsFromC(c) {
  return (c.players || ["p1", "p2"]).map(s => { const i = (c.seatInfo && c.seatInfo[s]) || {}; return { seat: s, name: (c.names && c.names[s]) || i.name || s, bot: !!i.bot, g: i.g || null }; });
}
function testOpts() {
  const o = {};
  if (speed() !== 1) o.speed = speed();
  if (window.__CERUL_AUTO) o.auto = true;
  if (window.__CERUL_OPTS && typeof window.__CERUL_OPTS === "object") Object.assign(o, window.__CERUL_OPTS);
  if (o.speed || o.auto) o.test = true;
  return o;
}
function newGameFrom(seats, opts) { return window.CerulLogic.newGame(Math.random, nowTB(), seats, opts || {}); }
/* ---------------- stocare robustă: validare + ultima stare bună (în memorie și în localStorage) ---------------- */
function validState(s) {
  if (!s || typeof s !== "object" || Array.isArray(s)) return false;
  if (s.phase === "boot") return !!s.boot;
  if (typeof s.phase !== "string" || !s.c || typeof s.c !== "object" || !Array.isArray(s.ps) || !s.ps.length) return false;
  for (const k of s.ps) if (!s.c[k] || typeof s.c[k] !== "object") return false;
  return typeof s.mv === "number" && isFinite(s.mv);
}
const GOOD = { s: null, sid: null, savedAt: 0 };
function keepGood(s) {
  GOOD.s = s; GOOD.sid = s.__sid || (CLK.sid || null);
  if (Date.now() - GOOD.savedAt < 15000) return;
  GOOD.savedAt = Date.now();
  try { localStorage.setItem("cerul-good", JSON.stringify({ sid: GOOD.sid, t: Date.now(), s })); } catch (e) {}
}
function goodFor(sid) {
  if (GOOD.s && GOOD.sid === sid) return GOOD.s;
  try { const o = JSON.parse(localStorage.getItem("cerul-good") || "null"); if (o && o.sid === sid && validState(o.s)) return o.s; } catch (e) {}
  return null;
}

/* ---------------- GAZDA (host) ----------------
   Gazda = cel mai mic loc ocupat de un om (din partida) a cărui pagină e deschisă; ține st.host/st.hb (bătăi la ≤3 s).
   Dacă starea n-a mai fost comisă de 6 s, preia următorul om (+2 s pentru fiecare rang), apoi un spectator, apoi
   pagina care conduce boții (def.bot). Doar gazda comite starea; ceilalți își pun acțiunile în partea lor (coadă). */
const HB_MS = 3000, STALE_MS = 6000, RANK_MS = 2000, GAP_REBASE = 15000;
let viewAliveAt = 0;           // ultima bătaie a unei bucle de vizualizare din această pagină
let botLoop = null;            // bucla de rezervă pornită de def.bot (doar dacă nu e nicio vizualizare)
function makeHost(getCtx, kind) {
  const H = { kind, work: null, workKey: null, lastCommit: 0, lastMv: null, lastTick: 0, lastStep: Date.now(), partSig: "", urgent: false, dead: false, frozen: false };
  function rank(ctx, st) {
    if (kind === "bot") return 6;
    const me = ctx.me, pl = st.__pl || ctx.players || [];
    if (!me || !pl.includes(me)) return 5;
    const humans = pl.filter(s => { const i = ctx.seatInfo && ctx.seatInfo(s); return i && !i.bot; }).sort((a, b) => SEATN(a) - SEATN(b));
    const r = humans.indexOf(me);
    return r < 0 ? 5 : Math.min(r, 4);
  }
  function shouldClaim(ctx, st) {
    const r = rank(ctx, st), thr = (st.host ? STALE_MS : 0) + r * RANK_MS;
    const quiet = Date.now() - Math.max(CLK.seenAt || 0, CLK.firstSid[st.__sid] || 0);
    return quiet >= thr;
  }
  /* boții: gazda îi rulează pe toți (CerulLogic.step limitează singur ritmul) */
  function botFn(st, seat, now, rng) {
    const B = window.CerulBot; if (!B || typeof B.decide !== "function") return [];
    try { const r = B.decide(st, seat, now, rng || Math.random); return Array.isArray(r) ? r.slice(0, 3) : []; } catch (e) { warn("CerulBot.decide " + seat, e); return []; }
  }
  function winnerOf(ns) {
    const L = window.CerulLogic;
    let w = (ns.res && ns.res.win) || ns.winner || null;
    if (!w && L && typeof L.finalValuation === "function") {
      try { const fv = L.finalValuation(ns) || []; let best = null; fv.forEach(r => { if (!best || r.total > best.total) best = r; }); if (best) w = best.seat; } catch (e) { warn("finalValuation", e); }
    }
    return typeof w === "string" && /^p[1-6]$/.test(w) ? w : "draw";
  }
  function doCommit(ctx, ns) {
    const out = Object.assign({}, ns); delete out.__end;
    out.host = CID; out.hb = nowTB();
    // nu comitem niciodată o stare parțială/stricată: o refuzăm și rămânem pe ultima bună
    if (!validState(out)) { warn("stare invalidă refuzată la comitere", out); H.work = null; H.bad = (H.bad || 0) + 1; return; }
    H.work = null; H.urgent = false; H.lastCommit = Date.now(); H.lastMv = out.mv;
    keepGood(out);
    if (out.phase === "end") ctx.commit(out, { winner: winnerOf(out) });
    else ctx.commit(out);
  }
  /* locurile luate de boți ai core-ului (un om a plecat) sau preluate de oameni: st.c[seat].bot urmează locul */
  function syncBots(ctx, base) {
    if (!base.c || !ctx.seatInfo) return base;
    let out = base;
    for (const s of base.ps || Object.keys(base.c)) {
      const c = base.c[s], i = ctx.seatInfo(s); if (!c || !i) continue;
      const want = i.bot ? 1 : 0;
      if ((c.bot ? 1 : 0) !== want) {
        if (out === base) out = Object.assign({}, base, { c: Object.assign({}, base.c) });
        out.c[s] = Object.assign({}, c, { bot: want });
        H.urgent = true;
      }
    }
    return out;
  }
  const sigOf = ctx => { const p = ctx.parts || {}; return Object.keys(p).sort().map(k => k + ":" + ((p[k] && p[k].n) || 0)).join(","); };
  function tick() {
    if (H.dead) return;
    const ctx = getCtx(); if (!ctx) return;
    H.lastTick = Date.now();
    if (kind === "view") viewAliveAt = H.lastTick;
    else if (Date.now() - viewAliveAt < 3000) { H.work = null; return; } // vizualizarea acestei pagini se ocupă
    const st = ctx.state;
    if (!st || ctx.ended || st.__end) { H.work = null; return; }
    observe(st);
    const L = window.CerulLogic;
    if (!L || typeof L.step !== "function") return;
    if (isStale(st)) { // a ajuns lumea veche a unei gazde care a fost offline: cine are ultima stare bună o recomite
      H.work = null;
      if (GOOD.s && GOOD.sid === st.__sid && GOOD.s.hb >= (CLK.maxHb[st.__sid] || 0) - 1 && Date.now() - H.lastCommit > 300) { console.warn("[cerul] stare întârziată ignorată; recomit ultima stare bună"); doCommit(ctx, GOOD.s); }
      return;
    }
    const mine = st.host === CID;
    if (!mine && !shouldClaim(ctx, st)) { H.work = null; return; }
    // fără rețea nu simulăm și nu comitem: altă pagină preia conducerea; la revenire nu rescriem peste ea o lume „offline”
    const nt = typeof ctx.net === "function" ? ctx.net() : null;
    if (nt && nt.st === "off") { H.work = null; return; }
    // niciun om al partidei nu e aici (toți au plecat / ecrane ascunse de > 5 min): timpul jocului îngheață; la revenire → rebase
    const hum = (st.ps || []).filter(s => { const i = ctx.seatInfo && ctx.seatInfo(s); return i && !i.bot; });
    if (hum.length && typeof ctx.here === "function" && !hum.some(s => ctx.here(s))) { H.work = null; H.frozen = true; return; }
    const thaw = H.frozen; H.frozen = false;
    const wk = st.__sid + "|" + st.__rev + "|" + st.__by + "|" + st.__t;
    if (H.workKey !== wk) H.work = null; // a venit o stare din altă parte
    const now = nowTB();
    let base = H.work || st;
    if (!validState(st)) { // stare stricată în bază: revin la ultima stare bună a acestei partide
      const g = goodFor(st.__sid); if (!g) return;
      warn("stare invalidă primită; refac din ultima bună", st); base = g; H.urgent = true;
    }
    if (mine && (thaw || Date.now() - H.lastStep > GAP_REBASE) && base.phase !== "boot" && typeof L.rebase === "function") {
      try { base = L.rebase(base, now) || base; } catch (e) { warn("rebase", e); } // pagina a dormit / a fost înghețat jocul
    }
    if (!mine) { // preiau conducerea (prima gazdă sau gazda veche a tăcut)
      base = Object.assign({}, base);
      const gapReal = st.host ? Math.max(Date.now() - (CLK.seenAt || Date.now()), typeof st.hb === "number" ? now - st.hb : 0) : 0;
      if (st.host && gapReal > GAP_REBASE && base.phase !== "boot" && typeof L.rebase === "function") {
        try { base = L.rebase(base, now) || base; } catch (e) { warn("rebase", e); }
      }
      H.urgent = true; H.lastMv = null;
    }
    if (base.phase === "boot") { // starea provizorie din setup(): logica n-a fost gata la Start
      let ns = null;
      try { const b = base.boot || {}; ns = newGameFrom(b.seats || [], b.opts || {}); } catch (e) { warn("newGame", e); return; }
      if (ns) doCommit(ctx, ns);
      return;
    }
    base = syncBots(ctx, base);
    let ns = null;
    try { ns = L.step(base, partsFor(st, ctx.parts), now, undefined, botFn, CID); } catch (e) { warn("CerulLogic.step", e); }
    H.lastStep = Date.now();
    if (ns && ns !== base) {
      if (ns.phase !== base.phase || JSON.stringify(ns.ack || null) !== JSON.stringify(base.ack || null)) H.urgent = true;
      H.work = ns; H.workKey = wk;
    } else if (base !== st) { H.work = base; H.workKey = wk; }
    const since = Date.now() - H.lastCommit, cur = H.work || base;
    const changed = cur.mv !== H.lastMv;
    if (cur.phase === "end" || !mine || (H.urgent && since >= 450) || (changed && since >= 1200) || since >= HB_MS) doCommit(ctx, cur);
  }
  /* părțile s-au schimbat: o acțiune nouă în coadă → un pas imediat (comiterea tot e limitată) */
  function kick() {
    const ctx = getCtx(); if (!ctx || !ctx.state || ctx.state.host !== CID) return;
    const sig = sigOf(ctx); if (sig === H.partSig) return;
    H.partSig = sig; tick();
  }
  return { tick, kick, H, isHost: () => { const c = getCtx(); return !!(c && c.state && c.state.host === CID); } };
}

/* ---------------- coada de acțiuni a jucătorului (partea lui) ---------------- */
/* Coada e ținută LOCAL (N.q), nu citită din ctx.myPart: un ecou întârziat al unei scrieri mai vechi a părții (q=[1]) ar fi
   șters acțiunea 2 la următoarea trimitere. Id-ul acțiunii n = max(ultimul+1, Date.now()) → unic și crescător și după reîncărcarea
   paginii (gazda aplică exact o dată: n > ack[loc], ack e în aceeași stare cu efectul). Partea poartă sid-ul partidei, ca o coadă
   rămasă din partida trecută să nu fie aplicată în cea nouă. */
const QMAX = 60, RETRY_MS = 3000;
function makeNet(ctx) {
  const N = { seq: 0, sid: null, sent: {}, lastWrite: 0, q: [] };
  const ackOf = st => (st && st.ack && +st.ack[ctx.me]) || 0;
  function sync() {
    const st = ctx.state;
    if (st && st.__sid !== N.sid) { N.sid = st.__sid; N.seq = 0; N.sent = {}; N.q = []; }
  }
  /* coada mea neconfirmată: cea locală + ce era în partea din bază (după reîncărcare), fără cele deja aplicate */
  function queue() {
    sync();
    const mp = ctx.myPart, ack = ackOf(ctx.state), m = new Map();
    if (mp && Array.isArray(mp.q) && mp.sid && mp.sid === N.sid) mp.q.forEach(i => { if (i && typeof i.n === "number" && i.n > ack) { m.set(i.n, i); if (i.n > N.seq) N.seq = i.n; } });
    // păstrăm local și acțiunile confirmate încă 2 min: dacă starea care le-a confirmat se pierde (gazda era offline și
    // lumea ei a fost ignorată), ack-ul scade din nou și ele redevin „de trimis”
    const now = Date.now();
    N.q.forEach(i => { if (i.n > ack) { m.set(i.n, i); i.ok = 0; } else if (!i.ok) i.ok = now; });
    N.q = N.q.filter(i => i.n > ack || now - i.ok < 120000).concat([...m.values()].filter(i => !N.q.includes(i))).sort((x, y) => x.n - y.n);
    return N.q.filter(i => i.n > ack);
  }
  function pending() { return queue().map(i => ({ n: i.n, a: i.a, t: N.sent[i.n] || 0 })); }
  /* scriem și acțiunile confirmate recent (gazda le sare: n ≤ ack): dacă două gazde au divergat o clipă și lumea care le
     confirmase se pierde, gazda rămasă le găsește tot în parte — altfel ar confirma una mai nouă și ar sări peste ele */
  function write() { N.lastWrite = Date.now(); const all = N.q.slice(-QMAX); ctx.setPart({ sid: N.sid, q: all.map(i => ({ n: i.n, a: i.a })), n: N.seq }); }
  function send(action) {
    const st = ctx.state;
    if (!ctx.me || !st || ctx.ended || st.__end || !action || typeof action !== "object") return 0;
    if (!(st.__pl || ctx.players || []).includes(ctx.me)) return 0;
    let a = action;
    if (a.a == null && a.t != null) { a = Object.assign({}, a, { a: a.t }); delete a.t; } // cheia acțiunii e „a”
    const q = queue(), mp = ctx.myPart || {}, ack = ackOf(st);
    const n = Math.max(N.seq + 1, (mp.sid === N.sid ? +mp.n || 0 : 0) + 1, ack + 1, Date.now());
    N.seq = n; N.sent[n] = Date.now();
    const it = { n, a: JSON.parse(JSON.stringify(a)) };
    q.push(it); N.q.push(it);
    while (q.length > QMAX) { const x = q.shift(); N.q = N.q.filter(y => y !== x); warn("coada de acțiuni e plină; acțiunea veche " + x.n + " a fost renunțată"); }
    write(q);
    return n;
  }
  /* reîncearcă: dacă o acțiune n-a fost aplicată în 3 s, rescriem partea (poate scrierea s-a pierdut sau gazda s-a schimbat) */
  function retry() {
    const st = ctx.state, mp = ctx.myPart;
    if (!ctx.me || !st || ctx.ended) return;
    const q = queue();
    if (!q.length) { if (mp && mp.q && mp.q.length && Date.now() - N.lastWrite > 15000) write([]); return; }
    const oldest = Math.min(...q.map(i => N.sent[i.n] || 0));
    if (Date.now() - oldest < RETRY_MS || Date.now() - N.lastWrite < RETRY_MS) return;
    q.forEach(i => { N.sent[i.n] = Date.now(); });
    write(q);
  }
  return { send, retry, pending, ackOf };
}
/* părțile valabile pentru partida curentă (sid-ul se potrivește; părțile fără sid = format vechi, acceptate) */
function partsFor(st, parts) {
  const o = {}; if (!parts) return o;
  for (const k in parts) { const p = parts[k]; o[k] = p && (!p.sid || p.sid === st.__sid) ? p : null; }
  return o;
}

/* ---------------- textele pentru meniu ---------------- */
const RULES_FALLBACK = `<h3>Scopul jocului</h3><p>Fiecare jucător conduce o companie aeriană pe harta lumii. Câștigă compania cu cea mai mare <b>valoare</b> la final (sau ultima rămasă în picioare).</p>
<h3>Pe scurt</h3><ul><li>Construiești rute cu <b>permise</b> și <b>cărți de resurse</b>.</li><li>Cumperi avioane, le pui pe rute și stabilești prețul biletelor.</li><li>Pasagerii se strâng în aeroporturi; apeși „Decolează” sau angajezi un pilot.</li><li>La sfârșitul fiecărei zile alegeți pe rând cărți cu fața în jos.</li><li>Bancă, împrumuturi între jucători, negocieri, pacte și cărți speciale (❄️ Îngheață timpul).</li></ul>
<p>Regulile complete se încarcă împreună cu jocul (butonul „📖 Ghid” din joc).</p>`;
const CONTROLS = `<p><b>Harta:</b> rotița mouse-ului sau două degete = zoom; trage cu mouse-ul ca să muți harta; clic pe un aeroport sau pe o rută ca s-o vezi.</p>
<ul><li>Clic pe o rută a ta → fereastra de preț (Ieftin / Normal / Premium sau orice preț vrei).</li>
<li>Panoul din dreapta: ✈️ Flotă (butonul verde „🛫 Decolează”, pilot), 🛣️ Rute, 📊 Rapoarte, 🛒 Avioane, 📈 Bursa.</li>
<li>Jos: cărțile de resurse, permisele (cu „Construiește”) și cărțile speciale („Folosește”).</li>
<li>Sus: 🤝 Negociază, 🏦 Bancă, 🃏 Ghișeu, 📖 Ghid, ⛶ ecran complet. Pe telefon folosești bara de jos.</li></ul>`;
const ICON = `<svg viewBox="0 0 48 48" fill="none"><circle cx="24" cy="24" r="19" fill="currentColor" opacity=".16"/><circle cx="24" cy="24" r="19" stroke="currentColor" stroke-width="2.4"/><path d="M5.5 24h37M24 5c-6 6-6 32 0 38M24 5c6 6 6 32 0 38M9 14h30M9 34h30" stroke="currentColor" stroke-width="1.6" opacity=".55"/><path d="M8 33C17 15 31 13 41 12" stroke="#ffd35c" stroke-width="2.2" stroke-dasharray="3 3" stroke-linecap="round"/><path d="M36.5 7.5l1.6 4.7-4.6 3.6 1 1.4 5.2-2.2 3.8 2.6 1.2-.8-2.4-4.3 2.6-4.2-1-.9-3.9 3-2.6-4z" fill="#ffd35c"/></svg>`;

function css() {
  if (typeof document === "undefined" || document.getElementById("css-" + ID)) return;
  const st = document.createElement("style"); st.id = "css-" + ID;
  st.textContent = `
  .ce-boot{min-height:min(70vh,560px);display:grid;place-items:center;text-align:center;color:var(--ink);background:radial-gradient(ellipse at 50% 30%,#1b3557,#0a1424 70%);border-radius:18px;padding:24px}
  .ce-boot h2{font:700 clamp(22px,4vw,34px) var(--display);letter-spacing:.06em;margin:10px 0 6px;color:#ffd35c}
  .ce-boot p{color:var(--muted);margin:6px 0;max-width:560px}
  .ce-boot .ce-spin{width:42px;height:42px;margin:0 auto;border-radius:50%;border:4px solid #ffd35c33;border-top-color:#ffd35c;animation:cespin .9s linear infinite}
  .ce-boot .ce-plane{width:min(240px,60vw);height:auto;margin:auto;display:block;animation:cefly 3s ease-in-out infinite}
  .ce-boot.err h2{color:#ff8a7a}
  @keyframes cespin{to{transform:rotate(360deg)}}
  @keyframes cefly{0%,100%{transform:translateY(0) rotate(-2deg)}50%{transform:translateY(-8px) rotate(1deg)}}
  @media (prefers-reduced-motion:reduce){.ce-boot .ce-spin,.ce-boot .ce-plane{animation:none}}`;
  document.head.appendChild(st);
}
function bootHTML(msg, err) {
  const U = window.CerulUI; // ecranul de încărcare al UI-A (bară de progres + sfaturi), dacă e deja încărcat
  if (!err && U && typeof U.bootHTML === "function") { try { const h = U.bootHTML(msg); if (h) return h; } catch (e) { warn("CerulUI.bootHTML", e); } }
  return `<div class="ce-boot ${err ? "err" : ""}"><div>${err ? "" : `<svg class="ce-plane" viewBox="0 0 240 80"><path d="M20 44c40-10 150-14 196-6 8 2 8 8 0 10-46 8-156 6-196-4z" fill="#dfe8f5"/><path d="M110 42l-30-34h16l46 32zM112 50l-26 26h16l40-24zM20 44l-8-22h10l20 20z" fill="#5fd3dc"/><rect x="60" y="38" width="120" height="3" rx="1.5" fill="#ffd35c"/></svg><div class="ce-spin"></div>`}
    <h2>Cerul Lumii</h2><p>${msg}</p></div></div>`;
}

/* ---------------- bot (def.bot) ----------------
   Nu face nimic pentru locul lui: gazda rulează toți boții în CerulLogic.step. Doar dacă nicio pagină nu mai
   găzduiește (toți oamenii au plecat), pagina care conduce boții devine gazdă de rezervă. */
function defBot(ctx) {
  if (!ctx || !ctx.isBot) return false;
  if (Date.now() - viewAliveAt < 3000) return false;
  if (!window.CerulLogic) { ensure(() => {}); return false; }
  if (!botLoop || botLoop.dead || Date.now() - botLoop.H.lastTick > 3000) {
    if (botLoop) botLoop.H.dead = true;
    let c = ctx;
    botLoop = makeHost(() => c, "bot");
    ctx.interval(() => botLoop && botLoop.tick(), 400);
  }
  const before = ctx.state && ctx.state.__rev;
  botLoop.tick();
  return !!(ctx.state && ctx.state.__rev !== before);
}

Salon.register({
  id: ID, name: "Cerul Lumii", cat: "strategie", mode: "turn", music: "jazz", color: "#5fd3dc",
  maxPlayers: 4, minPlayers: 2,
  blurb: "2–4 jucători: companii aeriene pe harta lumii — rute, avioane, prețuri, negocieri și timp care curge.",
  icon: ICON,
  get rules() { const D = window.CerulData; return (D && typeof D.RULES === "string" && D.RULES) || RULES_FALLBACK; },
  controls: CONTROLS,
  setup(c) {
    const seats = seatsFromC(c), opts = testOpts();
    if (window.CerulLogic && typeof window.CerulLogic.newGame === "function") {
      try { return newGameFrom(seats, opts); } catch (e) { warn("newGame", e); }
    }
    ensure(() => {});
    return { phase: "boot", boot: { seats, opts } };
  },
  bot: defBot,
  view(root, ctx) {
    if (ctx.isBot) { root.innerHTML = ""; return { render() {}, bot: defBot, destroy() {} }; }
    css();
    let alive = true, ui = null, uiErr = false;
    const host = makeHost(() => (alive ? ctx : null), "view");
    const net = makeNet(ctx);
    const fast = () => speed() > 1;
    ctx.interval(() => host.tick(), fast() ? 100 : 250);
    ctx.interval(() => net.retry(), 1000);
    const helpers = {
      get Logic() { return window.CerulLogic; }, get Data() { return window.CerulData; }, get Tune() { return window.CerulTune; },
      get Bot() { return window.CerulBot; }, get Art() { return window.CerulArt; }, get Map() { return window.CerulMap; },
      get Scenes() { return window.CerulScenes; }, get Guide() { return window.CerulGuide; }, get UI() { return window.CerulUI; },
      send: a => { const n = net.send(a); if (n) host.kick(); return n; },
      now: nowTB,
      pending: () => net.pending(),
      acked: n => net.ackOf(ctx.state) >= n,
      lastErr: () => { const st = ctx.state; return (st && st.err && st.err[ctx.me]) || null; },
      get me() { return ctx.me; },
      isHost: () => host.isHost(),
      // conexiunea (UI-A): vezi briefs/DONE_R1_STABILITY.md. frozen = nimeni din partidă nu e aici, timpul stă
      conn: seat => (typeof ctx.conn === "function" ? ctx.conn(seat) : { st: "ok", away: 0, grace: 0, bot: false, me: seat === ctx.me }),
      connAll: () => (typeof ctx.connAll === "function" ? ctx.connAll() : {}),
      net: () => (typeof ctx.net === "function" ? ctx.net() : { st: "ok", lag: 0, pending: 0, since: 0 }),
      get frozen() { return !!host.H.frozen; },
      resetTable: () => { if (typeof ctx.resetTable === "function") ctx.resetTable(); },
      get speed() { return speed(); },
      get auto() { return !!window.__CERUL_AUTO; },
      ctx: () => ctx,
      leave: () => { location.hash = ""; },
      restart: () => { const b = document.getElementById("newGameBtn"); if (b && !b.hidden) b.click(); else ctx.restart(); },
      onTutorial: () => { const G = window.CerulGuide; if (G && G.tutorial) { try { G.tutorial(document.body, helpers, {}); } catch (e) { warn("tutorial", e); } } },
    };
    root.innerHTML = bootHTML("Se încarcă harta lumii și companiile…");
    ctx.status("Se încarcă „Cerul Lumii”…", "");
    function mountUI() {
      if (!alive || ui || uiErr) return;
      if (!allLoaded()) {
        const miss = FILES.filter(([g]) => !window[g]).map(([, f, n]) => `${n} (${f})`);
        root.innerHTML = bootHTML(`Nu s-au putut încărca: ${miss.join(", ")}. Reîncarcă pagina.`, true);
        ctx.status("Jocul nu s-a putut încărca complet.", "bad");
        if (!window.CerulUI) return;
      }
      try { root.innerHTML = ""; ui = window.CerulUI.mount(root, ctx, helpers); }
      catch (e) { uiErr = true; warn("CerulUI.mount", e); root.innerHTML = bootHTML("Interfața jocului nu a pornit. Reîncarcă pagina.", true); ctx.status("Interfața nu a pornit.", "bad"); return; }
      try { ui && ui.render && ui.render(ctx); } catch (e) { warn("CerulUI.render", e); }
    }
    /* NICIODATĂ sincron în view(): o acțiune trimisă la montare (setPart → renderStage) ar găsi core-ul fără vizualizare
       și ar monta încă una, la nesfârșit. */
    ensure(() => { ctx.timeout(() => { if (alive) mountUI(); }, 0); });
    /* linia de stare a core-ului (sub interfața plină, dar o citesc spectatorii / harness-ul) */
    let lastStatus = "";
    function statusLine(st) {
      const L = window.CerulLogic; if (!st || !L) return;
      let txt = "", tone = "";
      try {
        const nm = s => ctx.ui && ctx.ui.esc ? ctx.ui.esc(ctx.nameOf(s)) : ctx.nameOf(s), c = st.c || {}, me = ctx.me;
        if (st.__end || st.phase === "end") { const w = (st.res && st.res.win) || (st.__end && st.__end.winner); txt = w ? (w === me ? "Ai câștigat! Compania ta valorează cel mai mult." : `${nm(w)} a câștigat partida.`) : "Partida s-a încheiat."; tone = w === me ? "win" : ""; }
        else if (st.phase === "setup") { const left = (st.ps || []).filter(s => c[s] && !c[s].ready).map(nm); txt = left.length ? "Alegeți avatarul, compania și culoarea. Mai sunt de pregătit: " + left.join(", ") : "Toți sunt gata — începe zborul!"; tone = me && c[me] && !c[me].ready ? "mine" : ""; }
        else if (st.phase === "draft") { const dr = st.dr, t = dr && dr.ord && dr.ord[dr.i]; txt = t ? (t === me ? "Draftul de seară: alegi tu o carte!" : `Draftul de seară: alege ${nm(t)}…`) : "Draftul de seară."; tone = t === me ? "mine" : "theirs"; }
        else if (st.phase === "nego") { const n = st.ng; txt = n ? `${nm(n.a)} și ${nm(n.b)} negociază — timpul e oprit.` : "Negociere în curs."; }
        else { const ci = (typeof L.clockInfo === "function" && L.clockInfo(st, nowTB())) || {}; txt = `Ziua ${ci.day || st.day || 1}` + (ci.hh != null ? ` · ${String(ci.hh).padStart(2, "0")}:${String(ci.mm || 0).padStart(2, "0")}` : "") + (ci.paused ? " · pauză" : "") + (me && c[me] && c[me].out ? " · compania ta a dat faliment" : me ? " · zboară, vinde bilete, construiește rute" : " · privești partida"); tone = me ? "mine" : ""; }
      } catch (e) { warn("status", e); return; }
      if (txt !== lastStatus) { lastStatus = txt; ctx.status(txt, tone); }
    }
    ctx.interval(() => { if (alive) statusLine(ctx.state); }, 1000);
    /* test: completare automată a profilului / voturilor în faza de setup */
    let autoT = 0, botT = 0, builtinFor = null;
    function autoSetup() {
      const st = ctx.state; if (!window.__CERUL_AUTO || !st || st.phase !== "setup" || !ctx.me) return false;
      if (net.pending().length || Date.now() - autoT < 700) return false;
      autoT = Date.now();
      return playMine(true);
    }
    function builtinSetup(st) {
      const me = ctx.me, c = (st.c && st.c[me]) || {};
      const i = SEATN(me) - 1;
      const others = Object.keys(st.c || {}).filter(s => s !== me).map(s => st.c[s]);
      const usedCol = new Set(others.map(o => o.col)), usedAv = new Set(others.map(o => o.av));
      const col = [0, 1, 2, 3, 4, 5].find(k => !usedCol.has(k) && k >= i % 6) ?? [0, 1, 2, 3, 4, 5].find(k => !usedCol.has(k)) ?? 0;
      const av = [...Array(10).keys()].map(k => (k + i * 3) % 10).find(k => !usedAv.has(k)) ?? i;
      const out = [];
      if (!c.prof) out.push({ a: "prof", av, name: String(ctx.nameOf(me) || "Pilot").slice(0, 18), co: ["Dacia Air", "Carpați Jet", "Delta Wings", "Mioritic Express"][i % 4], color: col });
      if (!c.ready) { out.push({ a: "vote", dur: 60, day: 1 }); out.push({ a: "ready", on: true }); }
      return out;
    }
    /* joacă locul meu prin coadă (harness: Salon._bot; __CERUL_AUTO: setup) */
    function playMine(setupOnly) {
      const st = ctx.state; if (!st || !ctx.me || ctx.ended || st.__end || st.phase === "boot" || st.phase === "end") return false;
      if (setupOnly && st.phase !== "setup") return false;
      let acts = [];
      const B = window.CerulBot;
      if (B && typeof B.decide === "function") { try { acts = B.decide(st, ctx.me, nowTB(), Math.random) || []; } catch (e) { warn("CerulBot.decide (eu)", e); acts = []; } }
      if (!acts.length && st.phase === "setup" && builtinFor !== st.__sid) { builtinFor = st.__sid; acts = builtinSetup(st); }
      acts = acts.slice(0, 3);
      acts.forEach(a => net.send(a));
      if (acts.length) host.kick();
      return acts.length > 0;
    }
    return {
      render() {
        if (!alive) return;
        const st = ctx.state;
        observe(st);
        host.kick();
        if (st && st.phase === "boot" && !window.CerulLogic) ctx.status("Se pregătește partida…", "");
        else statusLine(st);
        if (ui) { try { ui.render(ctx); } catch (e) { warn("CerulUI.render", e); } }
        else if (loadTried && !loadWait) ctx.timeout(() => { if (alive) mountUI(); }, 0);
        if (window.__CERUL_AUTO) ctx.timeout(autoSetup, 0);
      },
      bot() {
        host.tick();
        const st = ctx.state;
        if (!st || !ctx.me || ctx.ended || !window.CerulLogic) return false;
        if (net.pending().length) return false;            // aștept să fie aplicate acțiunile trimise
        if (Date.now() - botT < (fast() ? 250 : 700)) return false;
        botT = Date.now();
        return playMine(false);
      },
      destroy() {
        alive = false; host.H.dead = true;
        if (ui) { try { ui.destroy(); } catch (e) { warn("CerulUI.destroy", e); } ui = null; }
      },
    };
  },
});
})();
