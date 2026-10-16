/* Cerul Lumii — ghid ilustrat + tutorial ghidat (window.CerulGuide). Agent GUIDE.
   Plain IIFE (no Salon.register). Uses window.CerulArt / CerulData / CerulTune LAZILY with fallbacks. CSS prefix cg-. */
(function () {
  "use strict";
  const W = typeof window !== "undefined" ? window : null;
  const D = typeof document !== "undefined" ? document : null;
  const ArtG = () => (W && W.CerulArt) || null;
  const DataG = () => (W && W.CerulData) || null;
  const TuneG = () => (W && W.CerulTune) || null;
  const LSK = "cerul-guide-seen";
  const reduced = () => { try { return !!(W && W.matchMedia && W.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch (e) { return false; } };
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // ---------- formatting ----------
  function thou(n) { const s = String(Math.round(Math.abs(n))); return s.replace(/\B(?=(\d{3})+(?!\d))/g, "."); }
  function fmtE(n, sign) {
    const neg = n < 0, a = Math.abs(n);
    let s;
    if (a >= 1e6) { let v = (a / 1e6).toFixed(a >= 1e8 ? 0 : a >= 1e7 ? 1 : 2); v = v.replace(/\.?0+$/, ""); s = v.replace(".", ",") + " M €"; }
    else s = thou(a) + " €";
    return (neg ? "−" : sign && n > 0 ? "+" : "") + s;
  }
  const pct = v => Math.round(v * 100) + "%";

  // ---------- tune lookup (lazy, defaults) ----------
  function tv(names, def) {
    const T = TuneG(); if (!T) return def;
    const want = names.map(n => n.toLowerCase());
    const scan = (o, depth) => {
      if (!o || typeof o !== "object" || depth > 1) return undefined;
      for (const k of Object.keys(o)) if (want.indexOf(k.toLowerCase()) >= 0 && typeof o[k] === "number") return o[k];
      for (const k of Object.keys(o)) { const r = scan(o[k], depth + 1); if (r !== undefined) return r; }
      return undefined;
    };
    try { const r = scan(T, 0); return typeof r === "number" && isFinite(r) ? r : def; } catch (e) { return def; }
  }

  function tsub(path, def) { try { let o = TuneG(); for (const k of path) { if (!o || typeof o !== "object") return def; o = o[k]; } return o == null ? def : o; } catch (e) { return def; } }
  const RAMP0 = () => { const v = tsub(["demand", "rampStart"], null); return typeof v === "number" ? v : tv(["rampStart"], 0.7); };
  const RAMPD = () => { const v = tsub(["demand", "rampDays"], null); return typeof v === "number" ? v : tv(["rampDays"], 5); };
  const BANKT = () => { const t = tsub(["bank", "terms"], null); return Array.isArray(t) && t.length ? t : [10, 20, 30, 60]; };
  const BANKR = d => { const r = tsub(["bank", "ratePerDay"], null); return r && typeof r === "object" && typeof r[d] === "number" ? r[d] : ({ 10: 0.004, 20: 0.005, 30: 0.006, 60: 0.007 })[d] || 0.005; };
  const BONUS = () => ({ days: +tsub(["start", "bonusDays"], 10) || 10, fee: +tsub(["start", "bonusFeeMult"], 0.5) || 0.5, lease: +tsub(["start", "bonusLeaseMult"], 0.5) || 0.5 });
  function invInfo() {
    const d = { valueMult: 0.5, decay: 0.02, base: { price: [8e6, 16e6, 30e6], demand: 0.10, slots: 1, fee: 0.15 }, term: { price: 15e6, max: 3, share: 0.20, stars: 0.15 },
      eco: { price: [3e6, 8e6, 16e6], fuel: 0.20 }, mnt: { price: 8e6, maint: 0.25, breakdown: 0.6, dep: 0.4 } };
    const t = tsub(["invest"], null); if (!t || typeof t !== "object") return d;
    const m = (a, b) => { const o = Object.assign({}, a); if (b && typeof b === "object") for (const k in b) if (b[k] != null) o[k] = b[k]; return o; };
    return { valueMult: typeof t.valueMult === "number" ? t.valueMult : d.valueMult, decay: typeof t.decay === "number" ? t.decay : d.decay, base: m(d.base, t.base), term: m(d.term, t.term), eco: m(d.eco, t.eco), mnt: m(d.mnt, t.mnt) };
  }

  // ---------- art wrappers (fallbacks) ----------
  function art(fn, args, fb) { const A = ArtG(); if (A && typeof A[fn] === "function") { try { const r = A[fn].apply(A, args); if (r) return r; } catch (e) {} } return fb; }
  const AV_EMO = ["🧑‍✈️", "👨‍💼", "🧔", "👨🏽‍✈️", "👨🏿‍💼", "👩‍✈️", "👩‍💼", "👩🏽‍💼", "👩🏻‍✈️", "👩🏿‍✈️"];
  const avatar = (id, size, mood, ring) => art("avatar", [id, size, mood || "neutral", ring ? { ring } : {}],
    `<span class="cg-fbav" style="width:${size}px;height:${size}px;font-size:${size * .55}px;${ring ? "border-color:" + ring : ""}">${AV_EMO[id % 10]}</span>`);
  const PLANE_KEYS = ["t72", "a320", "s350"];
  const planeSide = (t, color, w) => art("planeSide", [t, color || "#ff8a4c", { w: w || 240 }],
    `<span class="cg-fbplane" style="font-size:${(w || 240) / 5}px">✈️</span>`);
  const planeTopSvg = (t, color, size) => art("planeTop", [t, color, { size: size || 28 }], "");
  const CARD_FB = {
    apr: ["🛂", "Aprobare", "#2a4f8a"], inf: ["🏗️", "Infrastructură", "#6b4b2a"], ech: ["👨‍✈️", "Echipaj", "#2f6b4a"], comb: ["⛽", "Combustibil", "#7a3030"],
    joker: ["⭐", "Joker", "linear-gradient(135deg,#ffd35c,#ff6fa8,#5fd3dc)"],
    freeze: ["❄️", "Îngheață timpul", "linear-gradient(160deg,#4fb6e8,#1f5f8f)"], breaker: ["🔥", "Spărgător de gheață", "linear-gradient(160deg,#ff8a4c,#a83a1a)"],
    rapid: ["🚀", "Construcție rapidă", "linear-gradient(160deg,#7a5cff,#2d1f7a)"], vip: ["🎟️", "Permis VIP", "linear-gradient(160deg,#ffd35c,#a0700f)"],
    boom: ["📈", "Boom de pasageri", "linear-gradient(160deg,#2b3f7a,#1a2550)"], fuelc: ["⛽", "Contract de combustibil", "linear-gradient(160deg,#c0392b,#5a1010)"],
    spy: ["🔍", "Spion", "linear-gradient(160deg,#37474f,#11181c)"], ad: ["📣", "Campanie de reclamă", "linear-gradient(160deg,#ff6fa8,#8a1f4f)"],
    insure: ["🧯", "Asigurare", "linear-gradient(160deg,#5fd38a,#1d6b3d)"], slot: ["🏛️", "Slot suplimentar", "linear-gradient(160deg,#b9a3ff,#4a3a8a)"],
    gift: ["✈️", "Avion cadou", "linear-gradient(160deg,#5fd3dc,#1f6f7a)"]
  };
  const cardFace = (k, w) => art("cardFace", [k, { w: w || 110 }], (() => {
    const f = CARD_FB[k] || ["🃏", k, "#334"]; const h = Math.round((w || 110) * 170 / 120);
    return `<span class="cg-fbcard" style="width:${w || 110}px;height:${h}px;background:${f[2]}"><b style="font-size:${(w || 110) * .36}px">${f[0]}</b><i>${esc(f[1])}</i></span>`;
  })());
  const cardBack = w => art("cardBack", [{ w: w || 110 }], `<span class="cg-fbcard back" style="width:${w || 110}px;height:${Math.round((w || 110) * 170 / 120)}px"><b>✈</b></span>`);
  const cardIcon = (k, s) => art("cardIcon", [k, s || 18], `<span style="font-size:${(s || 18) * .9}px">${(CARD_FB[k] || ["🃏"])[0]}</span>`);
  const icon = (n, s, emo) => art("icon", [n, s || 22], `<span style="font-size:${(s || 22) * .85}px">${emo || "•"}</span>`);
  const stars = (n, s) => art("stars", [n, s || 13], `<span class="cg-stars">${"★".repeat(Math.round(n))}${"☆".repeat(5 - Math.round(n))}</span>`);
  const logo = (name, color, s) => art("logo", [name, color, s || 40], `<span class="cg-fbav" style="width:${s || 40}px;height:${s || 40}px;font-size:${(s || 40) * .4}px;border-color:${color};color:${color}">${esc(name.split(" ").map(w => w[0]).join("").slice(0, 2))}</span>`);
  const consultant = (s, mood) => art("consultant", [s || 90, mood || "happy"], `<span class="cg-fbav" style="width:${s || 90}px;height:${s || 90}px;font-size:${(s || 90) * .55}px;border-color:#ffd35c">🧑‍💼</span>`);
  const OFFICE_FB = `<svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg"><defs>
<linearGradient id="cgow" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1b2c4d"/><stop offset="1" stop-color="#0e1830"/></linearGradient>
<linearGradient id="cgos" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a3f7a"/><stop offset=".55" stop-color="#c46a6a"/><stop offset="1" stop-color="#ffb36b"/></linearGradient>
<linearGradient id="cgod" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7a4a2a"/><stop offset=".06" stop-color="#5a321a"/><stop offset="1" stop-color="#2e1a0e"/></linearGradient></defs>
<rect width="1600" height="900" fill="url(#cgow)"/>
<rect x="260" y="70" width="1080" height="470" rx="14" fill="url(#cgos)" stroke="#0a1222" stroke-width="16"/>
<circle cx="1120" cy="330" r="46" fill="#ffd9a0" opacity=".9"/>
<g fill="#16203d" opacity=".9"><rect x="280" y="330" width="70" height="210"/><rect x="360" y="280" width="50" height="260"/><rect x="420" y="360" width="90" height="180"/><rect x="530" y="250" width="40" height="290"/><rect x="900" y="300" width="60" height="240"/><rect x="970" y="350" width="90" height="190"/><rect x="1180" y="270" width="55" height="270"/><rect x="1245" y="330" width="75" height="210"/></g>
<g fill="#ffe08a" opacity=".7">${Array.from({ length: 40 }, (_, i) => `<rect x="${290 + (i * 97) % 1020}" y="${300 + (i * 53) % 220}" width="6" height="8"/>`).join("")}</g>
<path d="M260 540 L1340 540 L1340 470 L700 470 Z" fill="#2a3346"/><path d="M700 505 L1300 505" stroke="#fff" stroke-width="5" stroke-dasharray="40 30" opacity=".6"/>
<g transform="translate(760 205) rotate(-12)" fill="#e8f0ff"><path d="M0 18 L150 10 Q172 12 176 20 Q172 28 150 30 L0 24Z"/><path d="M70 18 L40 -22 L58 -22 L100 16Z"/><path d="M8 18 L-6 -6 L6 -6 L24 16Z"/></g>
<line x1="800" y1="70" x2="800" y2="540" stroke="#0a1222" stroke-width="12"/>
<rect x="0" y="560" width="1600" height="340" fill="url(#cgod)"/><rect x="0" y="556" width="1600" height="12" fill="#a06a3a"/>
<rect x="680" y="600" width="240" height="120" rx="10" fill="#1a1208" opacity=".35"/></svg>`;
  const office = () => art("office", [{ w: 1600, h: 900 }], OFFICE_FB);
  const handshake = s => art("handshake", [s || 110], `<span style="font-size:${(s || 110) * .6}px">🤝</span>`);

  // ---------- data lookup (cards / events) with fallbacks ----------
  const SPECIALS = [
    ["freeze", 6, "max. 3 în mână", "Alegi o companie: timp de <b>30 de secunde reale</b> operațiunile ei îngheață — avioanele se opresc (chiar și în aer), nu se îmbarcă nimeni, nu decolează nimic. Pe rutele comune, toată cererea nouă vine la tine. Poți juca alt îngheț abia după 2 zile de joc. Nu merge în negociere/draft/pauză, pe o companie deja înghețată sau pe un partener de pact."],
    ["breaker", 4, "max. 2 în mână", "Dacă ești înghețat, apare 5 secunde întrebarea <b>„Folosești Spărgătorul?”</b>. Dacă da, înghețul se anulează pe loc."],
    ["rapid", 4, "", "Construiești o rută cu <b>o carte mai puțin</b> decât cere permisul."],
    ["vip", 3, "", "Îți alegi <b>liber orice permis</b> posibil, nu doar din cele 3 oferite."],
    ["boom", 4, "", "Una dintre rutele tale primește <b>cerere dublă timp de 3 zile</b>."],
    ["fuelc", 3, "", "<b>−30% la combustibil</b> timp de 5 zile pentru toată flota ta."],
    ["spy", 3, "", "Vezi <b>prețul și profitul</b> unei rute a unui adversar timp de o zi."],
    ["ad", 4, "", "<b>+1 stea</b> de reputație timp de 7 zile → mai mulți pasageri te aleg."],
    ["insure", 3, "", "Anulează <b>un eveniment negativ</b> care te lovește."],
    ["slot", 2, "", "<b>+1 slot</b> pentru tine într-un aeroport mare care e deja plin."],
    ["gift", 1, "", "Primești <b>gratuit un Turbo 72</b> în baza ta."]
  ];
  const PH = { loc: "oraș", city: "oraș", ap: "aeroport", reg: "regiune", region: "regiune", cont: "continent", p: "companie", o: "adversar", co: "companie", n: "N" };
  const fill = t => esc(String(t || "")).replace(/\{(\w+)\}/g, (m, k) => `<i class="cg-ph">${PH[k] || k}</i>`);
  function dataCards() { const Dd = DataG(); const c = Dd && (Dd.CARDS || Dd.cards); if (!c) return []; return Array.isArray(c) ? c : Object.keys(c).map(k => Object.assign({ id: k }, c[k])); }
  function cardText(key, fb) {
    const A = ArtG(); let name = (CARD_FB[key] || [0, key])[1];
    try { if (A && A.cardInfo) { const i = A.cardInfo(key); if (i && i.name) name = i.name; } } catch (e) {}
    let text = fb;
    try {
      for (const c of dataCards()) {
        const id = String(c.id || c.k || c.key || "").toLowerCase();
        const nm = String(c.n || c.name || c.title || "");
        if (id === key || (nm && nm.toLowerCase() === name.toLowerCase())) {
          const t = c.text || c.desc || c.d || c.long || c.fx_text;
          if (t && typeof t === "string" && t.length > 20) text = fill(t);
          if (nm) name = nm; break;
        }
      }
    } catch (e) {}
    return { name, text };
  }
  const EVENTS_FB = [
    ["🌋", "Cenușă vulcanică", "O regiune își închide spațiul aerian 1 zi: zborurile de acolo stau la sol."],
    ["🌀", "Uragan", "Furtună puternică într-o regiune — întârzieri, cerere mai mică."],
    ["✊", "Grevă pe aeroport", "Un aeroport nu operează o zi; avioanele așteaptă."],
    ["🏖️", "Sezonul vacanțelor", "Destinațiile de plajă au +50% pasageri."],
    ["⛷️", "Sezon de schi", "Stațiunile montane sunt la mare căutare."],
    ["🏆", "Campionat mondial", "Un oraș gazdă are cerere ×2 câteva zile."],
    ["🛢️", "Criza petrolului", "Combustibil +40% pentru toată lumea."],
    ["📉", "Petrol ieftin", "Combustibilul se ieftinește pentru câteva zile."],
    ["⭐", "Recenzie proastă", "O companie pierde o stea de reputație."],
    ["🧳", "Boom turistic", "Un continent întreg primește mai mulți turiști."],
    ["💶", "Monedă puternică", "Oamenii călătoresc mai mult — cerere în creștere."],
    ["🏗️", "Extinderea aeroportului", "Un aeroport primește +1 slot pentru companii."],
    ["🌫️", "Ceață densă", "Decolări întârziate într-un aeroport mare."],
    ["💼", "Conferință de afaceri", "Orașele de afaceri au mai mulți pasageri."],
    ["🎉", "Festival", "Un oraș devine destinația săptămânii."]
  ];
  function eventsList() {
    const Dd = DataG(); let ev = Dd && (Dd.EVENTS || Dd.events);
    try {
      if (ev && !Array.isArray(ev)) ev = Object.keys(ev).map(k => Object.assign({ id: k }, ev[k]));
      if (ev && ev.length >= 6) {
        return ev.map(e => [e.icon || e.ic || e.emoji || "🌍", fill(e.n || e.name || e.title || e.id), fill(e.text || e.desc || e.d || "")]).filter(e => e[1]);
      }
    } catch (e) {}
    return EVENTS_FB;
  }
  function planesInfo() {
    const fb = [
      { k: "t72", n: "Turbo 72", seats: 70, range: 1800, speed: 520, price: 3e6, cost: "mic", d: "Turbopropulsor robust pentru rute scurte, piste mici și orașe apropiate." },
      { k: "a320", n: "Aero 320", seats: 180, range: 5000, speed: 840, price: 9e6, cost: "mediu", d: "Calul de bătaie al companiei: rute europene și medii, umplut ușor." },
      { k: "s350", n: "Skyliner 350", seats: 320, range: 14500, speed: 900, price: 24e6, cost: "mare", d: "Gigantul intercontinental: București–New York fără escală." }
    ];
    try { // R1: toate cele 6 tipuri, direct din CerulTune.AIRCRAFT, de la mic la mare (planeOrder)
      const T = TuneG(), A = T && Array.isArray(T.AIRCRAFT) ? T.AIRCRAFT : null;
      if (A && A.length >= 3) {
        const KEYS = ["t72", "a320", "s350", "c40", "r100", "c230"], ord = Array.isArray(T.planeOrder) && T.planeOrder.length === A.length ? T.planeOrder : A.map((_, i) => i);
        const cost = f => f <= 2.5 ? "foarte mic" : f <= 5 ? "mic" : f <= 11 ? "mediu" : f <= 12.5 ? "mediu-mare" : "mare";
        return ord.map(i => { const p = A[i] || {}; return { k: KEYS[i] || "t72", ty: i, n: p.name || KEYS[i], seats: p.seats, range: p.range, speed: p.speed, price: p.price, lease: p.leaseDay, pilot: p.pilotDay, minSize: p.minSize || 1, cost: cost(+p.fuelPerKm || 0) + ` (${String(p.fuelPerKm).replace(".", ",")} €/km)`, d: esc(p.role || "") }; });
      }
    } catch (e) {}
    try {
      const T = TuneG(), Dd = DataG();
      const src = (T && (T.PLANES || T.AIRCRAFT || T.planes)) || (Dd && (Dd.AIRCRAFT || Dd.aircraft));
      if (src) {
        const arr = Array.isArray(src) ? src : Object.keys(src).map(k => Object.assign({ _k: k }, src[k]));
        arr.slice(0, 3).forEach((p, i) => {
          const f = fb[i]; if (!p) return;
          const num = (keys) => { for (const k of keys) if (typeof p[k] === "number") return p[k]; return undefined; };
          f.seats = num(["seats", "cap", "s"]) || f.seats; f.range = num(["range", "rng", "r"]) || f.range;
          f.speed = num(["speed", "spd", "v"]) || f.speed; f.price = num(["price", "cost", "p"]) || f.price;
          const nm = p.n || p.name; if (nm && typeof nm === "string") f.n = nm;
          const ds = p.desc || p.d || p.text; if (ds && typeof ds === "string" && ds.length > 15) f.d = esc(ds);
        });
      }
    } catch (e) {}
    return fb;
  }

  // ---------- CSS ----------
  function css() {
    if (!D || D.getElementById("css-cerul-guide")) return;
    try { const A = ArtG(); if (A && A.css) A.css(); } catch (e) {}
    const st = D.createElement("style"); st.id = "css-cerul-guide";
    st.textContent = `
.cg-ov{position:fixed;inset:0;z-index:60;display:grid;place-items:center;padding:clamp(0px,2vw,26px);background:radial-gradient(ellipse at 30% 20%,#1a3360e6,#050b16f2 70%);backdrop-filter:blur(6px);font-family:var(--body,"Barlow",system-ui,sans-serif);color:#e8f0ff;font-size:15px;line-height:1.5;animation:cgfade .3s ease both;--cg-gold:#ffd35c;--cg-me:#ff8a4c;--cg-op:#5fd3dc;--cg-ok:#5fd38a;--cg-bad:#ff6b6b;--cg-mut:#8ea3c4;--cg-line:#22324f;--cg-panel:#111d33}
.cg-ov *{box-sizing:border-box}
@keyframes cgfade{from{opacity:0}to{opacity:1}}
.cg-book{position:relative;width:min(1580px,100%);height:min(960px,100%);display:grid;grid-template-columns:272px minmax(0,1fr);border-radius:22px;overflow:hidden;background:linear-gradient(180deg,#121f38,#0b1424);border:1px solid #2f4673;box-shadow:0 30px 90px #000c,0 0 0 1px #ffffff08 inset;animation:cgbook .45s cubic-bezier(.2,1.1,.3,1) both}
@keyframes cgbook{from{transform:translateY(24px) scale(.97);opacity:0}to{transform:none;opacity:1}}
.cg-head .cg-tutb{display:none;padding:6px 10px;white-space:nowrap}
.cg-side{display:flex;flex-direction:column;min-height:0;background:linear-gradient(180deg,#0e1a30,#0a1322);border-right:1px solid var(--cg-line)}
.cg-brand{display:flex;align-items:center;gap:10px;padding:18px 18px 14px;border-bottom:1px solid var(--cg-line)}
.cg-brand .cg-bico{width:44px;height:44px;border-radius:12px;display:grid;place-items:center;background:linear-gradient(140deg,#ffd35c,#ff8a4c);font-size:24px;box-shadow:0 6px 16px #ff8a4c44;flex:none}
.cg-brand b{display:block;font:900 22px/1 var(--display,Impact,sans-serif);letter-spacing:.04em;text-transform:uppercase;color:#fff}
.cg-brand small{color:var(--cg-mut);font-size:12.5px}
.cg-idx{flex:1;overflow:auto;padding:10px 8px 14px;scrollbar-width:thin;scrollbar-color:#2f4673 transparent}
.cg-idx button{all:unset;box-sizing:border-box;display:flex;align-items:center;gap:10px;width:100%;padding:7px 10px;border-radius:10px;cursor:pointer;color:#b8c8e4;font-size:14px;font-weight:600;position:relative;transition:background .15s,color .15s}
.cg-idx button:hover{background:#18284a;color:#fff}
.cg-idx button:focus-visible{outline:2px solid var(--cg-gold);outline-offset:-2px}
.cg-idx button .n{width:24px;height:24px;flex:none;border-radius:50%;display:grid;place-items:center;font:700 11.5px var(--mono,monospace);background:#1a2b4a;color:var(--cg-mut);border:1px solid #2f4673}
.cg-idx button .e{width:22px;text-align:center;flex:none}
.cg-idx button.seen .n{background:#173a2a;color:var(--cg-ok);border-color:#2a6a48}
.cg-idx button.on{background:linear-gradient(90deg,#ff8a4c2e,#ff8a4c08);color:#fff}
.cg-idx button.on::before{content:"";position:absolute;left:-8px;top:6px;bottom:6px;width:4px;border-radius:3px;background:var(--cg-me)}
.cg-idx button.on .n{background:var(--cg-me);color:#2a1100;border-color:var(--cg-me)}
.cg-sidefoot{padding:12px 14px;border-top:1px solid var(--cg-line);display:flex;flex-direction:column;gap:8px}
.cg-main{display:grid;grid-template-rows:auto minmax(0,1fr) auto;min-height:0;min-width:0}
.cg-head{display:flex;align-items:center;gap:12px;padding:10px 16px;border-bottom:1px solid var(--cg-line);background:#0f1b31cc}
.cg-head .cg-crumb{color:var(--cg-mut);font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cg-head .cg-crumb b{color:#fff}
.cg-head select{display:none;flex:1;min-width:0;background:#1a2b4a;color:#fff;border:1px solid #2f4673;border-radius:10px;padding:8px 10px;font:600 14px var(--body,system-ui)}
.cg-sp{flex:1}
.cg-btn{all:unset;box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:9px 15px;border-radius:11px;cursor:pointer;font-weight:700;font-size:14px;background:#1a2b4a;border:1px solid #2f4673;color:#e8f0ff;transition:transform .12s,background .15s,box-shadow .15s;white-space:nowrap;user-select:none}
.cg-btn:hover{background:#22365c;transform:translateY(-1px)}
.cg-btn:active{transform:translateY(1px)}
.cg-btn:focus-visible{outline:2px solid var(--cg-gold);outline-offset:2px}
.cg-btn.gold{background:linear-gradient(#ffd35c,#e9a92a);color:#2a1d00;border:0;box-shadow:0 6px 18px #e9a92a44}
.cg-btn.gold:hover{box-shadow:0 8px 24px #e9a92a77}
.cg-btn.go{background:linear-gradient(#5fd38a,#2fa862);color:#04210f;border:0}
.cg-btn.ghost{background:transparent}
.cg-btn[disabled]{opacity:.35;pointer-events:none}
.cg-x{width:40px;height:40px;padding:0;font-size:18px}
.cg-scroll{overflow:auto;min-height:0;position:relative;scrollbar-width:thin;scrollbar-color:#2f4673 transparent;overscroll-behavior:contain}
.cg-page{padding:0 0 30px;animation:cgpin .38s cubic-bezier(.2,1,.3,1) both}
.cg-page.l{animation-name:cgpinl}
@keyframes cgpin{from{opacity:0;transform:translateX(40px)}to{opacity:1;transform:none}}
@keyframes cgpinl{from{opacity:0;transform:translateX(-40px)}to{opacity:1;transform:none}}
.cg-hero{position:relative;overflow:hidden;min-height:190px;padding:28px clamp(18px,3vw,42px) 24px;display:flex;align-items:flex-end;gap:20px;background:linear-gradient(180deg,#1d4a86 0%,#2e6aa8 40%,#f0a868 88%,#ff8a4c 100%);border-bottom:1px solid #ffffff1a}
.cg-hero.night{background:linear-gradient(180deg,#050b1c 0%,#0e2050 55%,#28407a 100%)}
.cg-hero.dusk{background:linear-gradient(180deg,#2a1f55 0%,#7a3d78 50%,#ff8a4c 100%)}
.cg-hero.gold{background:linear-gradient(180deg,#3a2a08 0%,#8a6418 50%,#ffd35c 100%)}
.cg-hero.ice{background:linear-gradient(180deg,#0b2a4a 0%,#1f6f9f 55%,#a8e4ff 100%)}
.cg-hero.green{background:linear-gradient(180deg,#0b2a2a 0%,#1d6b5a 55%,#7be0a8 100%)}
.cg-hero::before{content:"";position:absolute;inset:0;background:radial-gradient(ellipse 160px 40px at 15% 35%,#ffffff40,transparent 70%),radial-gradient(ellipse 220px 50px at 70% 25%,#ffffff30,transparent 70%),radial-gradient(ellipse 120px 30px at 45% 60%,#ffffff22,transparent 70%);pointer-events:none}
.cg-hero::after{content:"";position:absolute;inset:auto 0 0 0;height:60%;background:linear-gradient(0deg,#0b1424f0,transparent);pointer-events:none}
.cg-hero .cg-ht{position:relative;z-index:2;max-width:min(760px,100%)}
.cg-hero .cg-kick{display:inline-block;font:700 12px var(--mono,monospace);letter-spacing:.14em;text-transform:uppercase;color:#ffe9b0;background:#0b142488;border:1px solid #ffd35c66;padding:3px 10px;border-radius:999px;margin-bottom:8px}
.cg-hero h2{margin:0;font:900 clamp(30px,4.2vw,56px)/.95 var(--display,Impact,sans-serif);letter-spacing:.02em;text-transform:uppercase;color:#fff;text-shadow:0 3px 0 #0005,0 8px 30px #0008}
.cg-hero p{margin:10px 0 0;font-size:clamp(15px,1.25vw,18px);color:#e6eeff;max-width:680px;text-shadow:0 1px 4px #000a}
.cg-hero .cg-hart{position:absolute;right:clamp(10px,3vw,50px);bottom:10px;z-index:1;display:flex;align-items:flex-end;gap:10px;filter:drop-shadow(0 12px 22px #0009)}
.cg-hero .cg-hart svg{display:block;height:auto}
.cg-fly{position:absolute;z-index:1;top:10px;left:-160px;animation:cgfly 18s linear infinite;opacity:.8}
.cg-fly svg{display:block;width:118px;height:auto;filter:drop-shadow(0 6px 8px #0006)}
@keyframes cgfly{from{transform:translateX(0)}to{transform:translateX(calc(100vw + 300px))}}
.cg-body{padding:22px clamp(16px,3vw,42px) 0;display:flex;flex-direction:column;gap:22px}
.cg-cols{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.15fr);gap:clamp(18px,2.5vw,34px);align-items:start}
.cg-cols.even{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}
.cg-cols>*{min-width:0}
.cg-cols.wide{grid-template-columns:minmax(0,.8fr) minmax(0,1.5fr)}
.cg-txt h3{margin:0 0 8px;font:800 19px var(--body,system-ui);color:#fff;display:flex;align-items:center;gap:8px}
.cg-txt h3 .ic{display:inline-grid;place-items:center;width:30px;height:30px;border-radius:9px;background:#1a2b4a;border:1px solid #2f4673;font-size:16px}
.cg-txt p{margin:0 0 10px;color:#cdd9ee}
.cg-txt ul,.cg-txt ol{margin:0 0 10px;padding-left:20px;color:#cdd9ee}
.cg-txt li{margin:4px 0}
.cg-txt b,.cg-txt strong{color:#fff}
.cg-txt .hl{color:var(--cg-gold);font-weight:700}
.cg-card svg,.cg-pcard svg{max-width:100%;height:auto}
.cg-card{background:#0f1b31;border:1px solid var(--cg-line);border-radius:16px;padding:16px 18px;box-shadow:0 10px 30px #0005}
.cg-tip{display:flex;gap:12px;align-items:flex-start;background:linear-gradient(90deg,#ffd35c18,#ffd35c05);border:1px solid #ffd35c55;border-radius:14px;padding:12px 14px;color:#f3e7c4}
.cg-tip .i{font-size:22px;flex:none;line-height:1.2}
.cg-tip.warn{background:linear-gradient(90deg,#ff6b6b18,#ff6b6b05);border-color:#ff6b6b66;color:#ffd9d9}
.cg-tip.ok{background:linear-gradient(90deg,#5fd38a18,#5fd38a05);border-color:#5fd38a66;color:#d8f6e3}
.cg-steps{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(230px,100%),1fr));gap:12px;counter-reset:cgs}
.cg-step{position:relative;background:#0f1b31;border:1px solid var(--cg-line);border-radius:14px;padding:14px 14px 12px 14px;counter-increment:cgs}
.cg-step::before{content:counter(cgs);position:absolute;top:-11px;left:12px;width:24px;height:24px;border-radius:50%;background:var(--cg-gold);color:#2a1d00;font:800 13px/24px var(--body,system-ui);text-align:center;box-shadow:0 3px 8px #0008}
.cg-step>b{display:block;color:#fff;margin:4px 0 4px}
.cg-step>span{color:#b9c8e2;font-size:14px}
.cg-step>span b{color:#fff}
.cg-step .ic{font-size:26px;line-height:1}
/* worked example */
.cg-ex{background:linear-gradient(180deg,#13254a,#0f1b31);border:1px solid #3a5a8f;border-radius:18px;padding:16px 18px;box-shadow:0 14px 34px #0006}
.cg-ex>h4{margin:0 0 10px;display:flex;align-items:center;gap:8px;font:800 16px var(--body,system-ui);color:#fff}
.cg-ex>h4 .tag{font:700 11px var(--mono,monospace);letter-spacing:.1em;text-transform:uppercase;background:#ffd35c;color:#2a1d00;padding:2px 8px;border-radius:999px}
.cg-tab{width:100%;border-collapse:collapse;font-size:14px}
.cg-tab td,.cg-tab th{padding:6px 8px;border-bottom:1px solid #22324f;text-align:left;vertical-align:top}
.cg-tab th{color:var(--cg-mut);font-weight:600;font-size:12px;letter-spacing:.05em;text-transform:uppercase}
.cg-tab td.r,.cg-tab th.r{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
.cg-tab tr.tot td{border-top:2px solid #3a5a8f;border-bottom:0;font-weight:800;color:#fff;font-size:15px}
.cg-pos{color:var(--cg-ok)!important}.cg-neg{color:var(--cg-bad)!important}.cg-gold{color:var(--cg-gold)!important}
.cg-calc{display:flex;flex-direction:column;gap:10px}
.cg-slider{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:10px;font-size:14px;color:#cdd9ee}
.cg-slider input[type=range]{width:100%;accent-color:var(--cg-me);height:22px}
.cg-slider output{font:700 15px var(--mono,monospace);color:#fff;min-width:74px;text-align:right}
.cg-seg{display:flex;gap:6px;flex-wrap:wrap}
.cg-seg button{all:unset;cursor:pointer;padding:6px 11px;border-radius:9px;background:#1a2b4a;border:1px solid #2f4673;font-weight:700;font-size:13px}
.cg-seg button.on{border-color:var(--cg-gold);background:#3a2f12;color:var(--cg-gold)}
.cg-bars{display:flex;flex-direction:column;gap:8px}
.cg-bar{display:grid;grid-template-columns:92px minmax(0,1fr) 64px;gap:8px;align-items:center;font-size:13.5px}
.cg-bar .t{height:22px;border-radius:7px;background:#1a2640;overflow:hidden;position:relative}
.cg-bar .t i{position:absolute;inset:0 auto 0 0;border-radius:7px;transition:width .35s cubic-bezier(.2,1,.3,1)}
.cg-bar b{text-align:right;font-variant-numeric:tabular-nums}
.cg-formula{font:600 14px var(--mono,monospace);background:#0a1426;border:1px dashed #3a5a8f;border-radius:12px;padding:10px 12px;color:#cfe0ff;overflow-x:auto;white-space:nowrap}
.cg-formula em{font-style:normal;color:var(--cg-gold)}
/* planes */
.cg-planes{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}
.cg-pcard{background:linear-gradient(180deg,#16284a,#0f1b31);border:1px solid #2f4673;border-radius:18px;padding:14px;display:flex;flex-direction:column;gap:8px;position:relative;overflow:hidden}
.cg-pcard::before{content:"";position:absolute;inset:0 0 auto 0;height:110px;background:radial-gradient(ellipse at 50% 100%,#5fd3dc22,transparent 70%)}
.cg-pcard .pic{position:relative;height:96px;display:grid;place-items:center}
.cg-pcard .pic svg{width:100%;max-width:260px;height:auto}
.cg-pcard h4{margin:0;font:900 22px var(--display,Impact,sans-serif);letter-spacing:.03em;text-transform:uppercase}
.cg-pcard dl{display:grid;grid-template-columns:auto 1fr;gap:3px 10px;margin:0;font-size:13.5px}
.cg-pcard dt{color:var(--cg-mut)}.cg-pcard dd{margin:0;text-align:right;font-weight:700;font-variant-numeric:tabular-nums}
.cg-pcard p{margin:0;color:#b9c8e2;font-size:13.5px}
/* card galleries */
.cg-gal{display:flex;flex-wrap:wrap;gap:14px;justify-content:flex-start}
.cg-gc{display:flex;flex-direction:column;align-items:center;gap:6px;width:116px;text-align:center;font-size:13px;color:#cdd9ee}
.cg-gc svg,.cg-gc .cg-fbcard{filter:drop-shadow(0 8px 14px #0009);transition:transform .2s}
.cg-gc:hover svg,.cg-gc:hover .cg-fbcard{transform:translateY(-4px) rotate(-2deg)}
.cg-gc b{color:#fff}
.cg-gc .pc{font:700 12px var(--mono,monospace);color:var(--cg-gold)}
.cg-spec{display:grid;grid-template-columns:repeat(auto-fill,minmax(330px,1fr));gap:14px}
.cg-sp1{display:grid;grid-template-columns:96px minmax(0,1fr);gap:14px;align-items:start;background:#0f1b31;border:1px solid var(--cg-line);border-radius:16px;padding:12px}
.cg-sp1 svg,.cg-sp1 .cg-fbcard{width:96px;height:auto;filter:drop-shadow(0 6px 12px #0009)}
.cg-sp1 h4{margin:0 0 4px;font-size:16px;color:#fff;display:flex;gap:8px;align-items:baseline;flex-wrap:wrap}
.cg-sp1 h4 small{font:700 11.5px var(--mono,monospace);color:var(--cg-gold);background:#3a2f12;border-radius:999px;padding:1px 8px}
.cg-sp1 p{margin:0;color:#c3d1ea;font-size:14px}
.cg-evs{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px}
.cg-ev{display:flex;gap:10px;align-items:flex-start;background:#0f1b31;border:1px solid var(--cg-line);border-radius:14px;padding:10px 12px}
.cg-ev .e{font-size:26px;width:40px;height:40px;flex:none;display:grid;place-items:center;border-radius:12px;background:#1a2b4a}
.cg-ev b{display:block;color:#fff}.cg-ph{font-style:normal;color:#ffd35c;background:#ffd35c1c;border-radius:5px;padding:0 4px}.cg-ev span{color:#b9c8e2;font-size:13.5px}
/* fallbacks */
.cg-fbav{display:inline-grid;place-items:center;border-radius:50%;background:#1c2a46;border:3px solid #ff8a4c;flex:none}
.cg-fbcard{display:inline-flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;border-radius:12px;border:2px solid #ffffff33;color:#fff;box-shadow:inset 0 0 0 4px #00000022;text-align:center;padding:6px}
.cg-fbcard i{font-style:normal;font-weight:800;font-size:12px;line-height:1.1}
.cg-fbcard.back{background:repeating-linear-gradient(45deg,#1a2b4a 0 8px,#22365c 8px 16px);border-color:#ffd35c66;color:#ffd35c;font-size:30px}
.cg-stars{color:var(--cg-gold);letter-spacing:1px}
/* annotated replica stage */
.cg-stage{position:relative;display:grid;grid-template-columns:minmax(150px,200px) minmax(0,1fr) minmax(150px,200px);gap:34px;align-items:center}
.cg-stage.nol{grid-template-columns:minmax(0,1fr) minmax(150px,230px)}
.cg-stage .cg-notes{display:flex;flex-direction:column;gap:12px;position:relative;z-index:3}
.cg-note{position:relative;background:#fffbe8;color:#2a2410;border-radius:12px;padding:8px 10px 8px 34px;font-size:13px;line-height:1.35;box-shadow:0 8px 20px #0009}
.cg-note b{color:#000}
.cg-note .k,.cg-pin{position:absolute;left:7px;top:8px;width:20px;height:20px;border-radius:50%;background:#ff2d6f;color:#fff;font:800 11.5px/20px var(--body,system-ui);text-align:center;box-shadow:0 2px 6px #0008}
.cg-pin{left:0;top:0;transform:translate(-50%,-50%);z-index:4;pointer-events:none;outline:3px solid #ff2d6f55;animation:cgpin2 2s ease-in-out infinite}
@keyframes cgpin2{0%,100%{outline-width:3px}50%{outline-width:7px}}
.cg-arrows{position:absolute;inset:0;pointer-events:none;z-index:2;overflow:visible}
.cg-arrows path{fill:none;stroke:#ff2d6f;stroke-width:2.2;stroke-linecap:round;filter:drop-shadow(0 1px 2px #000a)}
.cg-arrows .hd{fill:#ff2d6f;stroke:none}
.cg-fit{position:relative;width:100%;min-width:0}
.cg-fit>.cg-r{position:absolute;left:0;top:0;transform-origin:0 0}
.cg-legend{display:none;flex-direction:column;gap:8px}
.cg-legend .cg-note{box-shadow:none}
.cg-stage.narrow{display:flex;flex-direction:column;gap:14px;align-items:stretch}
.cg-stage.narrow .cg-notes{display:none}
.cg-stage.narrow .cg-legend{display:flex}
.cg-stage.narrow .cg-arrows{display:none}
/* replica kit (faithful to mockup) */
.cg-r{--bg:#0b1424;--panel:#111d33;--line:#22324f;--ink:#e8f0ff;--mut:#8ea3c4;color:var(--ink);font:13px/1.35 system-ui,"Segoe UI",sans-serif;background:var(--bg);border-radius:12px;overflow:hidden;box-shadow:0 18px 50px #000b,0 0 0 1px #3a5a8f;text-align:left}
.cg-r *{box-sizing:border-box}
.r-top{height:52px;display:flex;align-items:center;gap:7px;white-space:nowrap;overflow:hidden;min-width:0;padding:0 12px;background:linear-gradient(#152440,#0f1b31);border-bottom:1px solid var(--line)}
.r-co{display:flex;align-items:center;gap:8px}.r-co b{font-size:14px;display:block}.r-co small{color:var(--mut);font-size:10.5px}
.r-av{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;overflow:hidden;border:2.5px solid #ff8a4c;background:#1c2a46;font-size:18px;flex:none}
.r-av svg{width:100%;height:100%}
.r-stat{background:#0c172b;border:1px solid var(--line);border-radius:9px;padding:3px 8px;min-width:0}.r-stat small{display:block;color:var(--mut);font-size:9px;letter-spacing:.06em;text-transform:uppercase}.r-stat b{font-size:14px}
.r-clock{display:flex;align-items:center;gap:7px;background:#0c172b;border:1px solid #31507f;border-radius:11px;padding:3px 9px}
.r-ring{width:30px;height:30px;border-radius:50%;background:conic-gradient(#ffd35c 0 62%,#26365a 62%);display:grid;place-items:center}.r-ring i{width:22px;height:22px;border-radius:50%;background:#0c172b;display:grid;place-items:center;font-style:normal;font-size:12px}
.r-op{display:flex;align-items:center;gap:6px;padding:3px 9px;border-radius:10px;border:1px solid var(--line);font-size:12px}.r-op .r-av{width:28px;height:28px;border-color:#5fd3dc;font-size:14px}
.r-btns{margin-left:auto;display:flex;gap:6px}
.r-b{background:#1a2b4a;border:1px solid #2f4673;border-radius:8px;padding:6px 10px;font-weight:700;font-size:12px;color:var(--ink);white-space:nowrap;display:inline-block}
.r-b.gold{background:linear-gradient(#ffd35c,#e9a92a);color:#2a1d00;border:0}
.r-b.sel{border-color:#ffd35c}
.r-main{display:grid;grid-template-columns:minmax(0,1fr) 250px;min-height:0}
.r-map{position:relative;overflow:hidden;background:radial-gradient(ellipse at 50% 40%,#16365c,#0b1d36 70%)}
.r-map>svg{position:absolute;inset:0;width:100%;height:100%}
.r-lbl{font:600 11px system-ui;fill:#e8f0ff;paint-order:stroke;stroke:#0b1d36;stroke-width:3px}
.r-side{background:var(--panel);border-left:1px solid var(--line);display:flex;flex-direction:column}
.r-tabs{display:flex;border-bottom:1px solid var(--line)}.r-tabs div{flex:1;text-align:center;padding:8px 2px;font-weight:700;color:var(--mut);font-size:11px;white-space:nowrap}.r-tabs .on{color:var(--ink);box-shadow:inset 0 -3px #ff8a4c}
.r-list{padding:8px;display:flex;flex-direction:column;gap:7px}
.r-pl{background:#0c172b;border:1px solid var(--line);border-radius:10px;padding:8px 10px}.r-pl .h{display:flex;justify-content:space-between;align-items:center;gap:6px}.r-pl .h b{font-size:13px}
.r-tag{font-size:10px;padding:2px 7px;border-radius:999px;background:#22324f;color:var(--mut);white-space:nowrap}.r-tag.ok{background:#173a2a;color:#5fd38a}.r-tag.pil{background:#3a2f12;color:#ffd35c}
.r-bar{height:7px;border-radius:5px;background:#22324f;margin:6px 0 4px;overflow:hidden}.r-bar i{display:block;height:100%;background:linear-gradient(90deg,#ff8a4c,#ffb36b)}
.r-bar.c i{background:linear-gradient(90deg,#5fd3dc,#9be8ee)}
.r-pl .r{display:flex;justify-content:space-between;align-items:center;color:var(--mut);font-size:11.5px;gap:6px}
.r-go{background:linear-gradient(#5fd38a,#2fa862);color:#04210f;border-radius:8px;padding:4px 9px;font-weight:800;font-size:11.5px;white-space:nowrap}
.r-bottom{display:grid;grid-template-columns:300px 1fr 300px;gap:10px;padding:9px 12px;background:linear-gradient(#0f1b31,#0b1424);border-top:1px solid var(--line)}
.r-box{background:#0c172b;border:1px solid var(--line);border-radius:11px;padding:7px 9px;position:relative}.r-box>small{color:var(--mut);font-size:9px;letter-spacing:.08em;text-transform:uppercase}
.r-res{display:flex;gap:6px;margin-top:6px}.r-rc{width:50px;height:62px;border-radius:8px;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:20px;position:relative;border:2px solid #ffffff22}
.r-rc span{font-size:8.5px;font-weight:700;margin-top:2px}.r-rc em{position:absolute;top:-7px;right:-7px;background:#fff;color:#111;border-radius:999px;font-style:normal;font-weight:900;font-size:10.5px;padding:0 6px}
.r-rc svg{width:100%;height:100%;border-radius:7px}
.r-perm{display:flex;gap:7px;margin-top:6px}.r-pm{flex:1;background:#132544;border:1px dashed #4d6ea8;border-radius:10px;padding:6px 8px;font-size:11px;min-width:0}.r-pm b{font-size:12px;display:block}
.r-need{display:flex;gap:3px;margin:4px 0;font-size:13px;flex-wrap:wrap}.r-need .x{opacity:.3;filter:grayscale(1)}
.r-need svg{width:16px;height:16px}
.r-bld{display:inline-block;margin-top:2px;background:linear-gradient(#ffd35c,#e9a92a);color:#2a1d00;font-weight:800;border-radius:7px;padding:2px 8px;font-size:10.5px}
.r-sp{display:flex;gap:7px;margin-top:6px}.r-sc{width:84px;height:66px;border-radius:10px;padding:6px;font-size:10px;background:linear-gradient(160deg,#2b3f7a,#1a2550);border:2px solid #7d9cff66}.r-sc b{display:block;font-size:16px}.r-sc.ice{background:linear-gradient(160deg,#4fb6e8,#1f5f8f)}.r-sc.fire{background:linear-gradient(160deg,#ff8a4c,#a83a1a)}
.r-cons{position:absolute;left:10px;top:10px;display:flex;gap:7px;align-items:flex-start;max-width:300px}
.r-cons .r-av{border-color:#ffd35c}
.r-bub{background:#fffbe8;color:#2a2410;border-radius:11px;padding:6px 9px;font-size:11px;box-shadow:0 6px 18px #0008}
.r-pop{position:absolute;width:236px;background:#0f1d36f2;border:1px solid #3a5a8f;border-radius:12px;padding:9px 11px;box-shadow:0 12px 30px #000a}
.r-pop h4{margin:0 0 3px;font-size:13.5px}.r-pop .row{display:flex;justify-content:space-between;color:var(--mut);font-size:11.5px;margin:2px 0}.r-pop .row b{color:var(--ink)}
.r-pop .pr{display:flex;gap:5px;margin:6px 0}.r-pop .pr .r-b{padding:4px 6px;font-size:10.5px;flex:1;text-align:center}
.r-zoom{position:absolute;right:10px;bottom:10px;display:flex;flex-direction:column;gap:5px}.r-zoom span{width:28px;height:28px;border-radius:8px;background:#0f1d36e6;border:1px solid #2f4673;display:grid;place-items:center;font-size:13px;font-weight:700}
.r-legend{position:absolute;left:10px;bottom:10px;background:#0f1d36e6;border:1px solid #2f4673;border-radius:8px;padding:5px 9px;font-size:10.5px;color:var(--mut)}
/* draft replica */
.r-draft{background:radial-gradient(ellipse at 50% 30%,#1b4a3a,#0b2018 75%);padding:16px;display:flex;flex-direction:column;gap:12px;align-items:center}
.r-draft .hd{display:flex;gap:10px;align-items:center;flex-wrap:wrap;justify-content:center}
.r-chip{display:flex;align-items:center;gap:6px;background:#0c172bcc;border:1px solid #2f4673;border-radius:999px;padding:3px 10px 3px 3px;font-size:12px;font-weight:700}
.r-chip .r-av{width:26px;height:26px}
.r-chip.on{border-color:#ffd35c;box-shadow:0 0 0 3px #ffd35c33}
.r-chip em{font-style:normal;color:#ffd35c;font-family:monospace}
.r-dgrid{display:grid;grid-template-columns:repeat(7,62px);gap:10px;perspective:800px}
.r-dc{width:62px;height:88px;position:relative;transform-style:preserve-3d;transition:transform .6s cubic-bezier(.2,1,.3,1);cursor:pointer}
.r-dc.f{transform:rotateY(180deg)}
.r-dc>div{position:absolute;inset:0;backface-visibility:hidden;-webkit-backface-visibility:hidden}
.r-dc>div svg,.r-dc>div .cg-fbcard{width:62px!important;height:88px!important}
.r-dc .fr{transform:rotateY(180deg)}
.r-dc .who{position:absolute;left:50%;bottom:-8px;transform:translateX(-50%);font:800 9.5px system-ui;background:#ff8a4c;color:#2a1100;padding:1px 6px;border-radius:999px;white-space:nowrap}
.r-timer{width:220px;height:6px;border-radius:4px;background:#ffffff22;overflow:hidden}.r-timer i{display:block;height:100%;width:60%;background:linear-gradient(90deg,#5fd38a,#ffd35c)}
/* bank replica */
.r-dlg{background:linear-gradient(180deg,#15284a,#0f1b31);border:1px solid #3a5a8f;border-radius:14px;padding:14px;width:360px}
.r-dlg h4{margin:0 0 8px;font-size:16px}
.r-kv{display:flex;justify-content:space-between;font-size:12.5px;color:var(--mut);padding:3px 0;border-bottom:1px solid #22324f}.r-kv b{color:var(--ink)}
/* office replica */
.cg-office{position:relative;border-radius:18px;overflow:hidden;aspect-ratio:16/8;min-height:240px;background:linear-gradient(180deg,#2a4a7a,#0f1b31);box-shadow:0 18px 50px #000b,0 0 0 1px #3a5a8f}
.cg-office>svg{position:absolute;inset:0;width:100%;height:100%}
.cg-office .av{position:absolute;bottom:37%;width:26%;max-width:300px;filter:drop-shadow(0 10px 18px #000a)}
.cg-office .av svg,.cg-office .av .cg-fbav{width:100%!important;height:auto!important;aspect-ratio:1}
.cg-office .av.a{left:9%}.cg-office .av.b{right:9%}
.cg-office .desk{position:absolute;left:0;right:0;bottom:0;height:37.8%;pointer-events:none}
.cg-office .tbl{position:absolute;left:50%;bottom:9%;transform:translateX(-50%);display:flex;gap:8px;flex-wrap:wrap;justify-content:center;width:46%}
.cg-office .it{background:#fffbe8;color:#2a2410;border-radius:10px;padding:5px 9px;font:700 12.5px system-ui;box-shadow:0 6px 14px #0009;white-space:nowrap}
.cg-office .it.b{background:#d9f7fa}
.cg-office .bub{position:absolute;top:8%;background:#fffbe8;color:#2a2410;border-radius:14px;padding:7px 11px;font:600 13px system-ui;box-shadow:0 6px 16px #0009;max-width:30%}
.cg-office .bub.a{left:6%}.cg-office .bub.b{right:6%;background:#d9f7fa}
.cg-office .hs{position:absolute;left:50%;top:14%;transform:translateX(-50%);width:16%;max-width:140px;animation:cghs 2.4s ease-in-out infinite}
.cg-office .hs svg{width:100%;height:auto}
@keyframes cghs{0%,100%{transform:translateX(-50%) rotate(-4deg)}50%{transform:translateX(-50%) rotate(4deg) translateY(-4px)}}
/* waterfall */
.cg-wf{display:flex;flex-direction:column;gap:7px}
.cg-wf .row{display:grid;grid-template-columns:minmax(120px,210px) minmax(0,1fr) 90px;gap:10px;align-items:center;font-size:14px}
.cg-wf .tr{position:relative;height:26px;background:#0a1426;border-radius:7px}
.cg-wf .tr i{position:absolute;top:3px;bottom:3px;border-radius:5px;transform-origin:left;animation:cgwf .8s cubic-bezier(.2,1,.3,1) both}
@keyframes cgwf{from{transform:scaleX(0)}to{transform:none}}
.cg-wf .row b{text-align:right;font-variant-numeric:tabular-nums}
.cg-wf .row.tot{border-top:2px solid #3a5a8f;padding-top:6px}
.cg-wf .row.tot span{font-weight:800;color:#fff}
/* share table */
.cg-sh{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}
/* hero avatars row */
.cg-avs{display:flex;gap:6px;align-items:flex-end}
.cg-avs svg,.cg-avs .cg-fbav{width:84px;height:84px}
.cg-avs>*:nth-child(odd){transform:translateY(-8px)}
/* foot nav */
.cg-foot{display:flex;align-items:center;gap:12px;padding:10px 16px;border-top:1px solid var(--cg-line);background:#0f1b31e6}
.cg-dots{flex:1;display:flex;gap:6px;justify-content:center;flex-wrap:wrap;min-width:0}
.cg-dots button{all:unset;cursor:pointer;width:9px;height:9px;border-radius:50%;background:#2f4673;transition:all .25s}
.cg-dots button:hover{background:#5a78b0}
.cg-dots button.seen{background:#4a6a9a}
.cg-dots button.on{width:26px;border-radius:5px;background:var(--cg-me)}
.cg-dots button:focus-visible{outline:2px solid var(--cg-gold);outline-offset:2px}
.cg-cnt{font:700 13px var(--mono,monospace);color:var(--cg-mut);white-space:nowrap}
.cg-kbd{display:inline-block;padding:0 6px;border-radius:5px;border:1px solid #3a5a8f;background:#1a2b4a;font:700 11px var(--mono,monospace);color:#cfe0ff}
.cg-tutbig{display:flex;gap:18px;align-items:center;background:linear-gradient(120deg,#ff8a4c2a,#ffd35c18 50%,#5fd3dc1a);border:1px solid #ffd35c66;border-radius:20px;padding:18px 20px;flex-wrap:wrap}
.cg-tutbig .t{flex:1;min-width:220px}
.cg-tutbig h3{margin:0 0 4px;font:900 26px var(--display,Impact,sans-serif);text-transform:uppercase;letter-spacing:.03em}
.cg-tutbig p{margin:0;color:#e3d9bd}
/* estimate list (assign warning) + investments */
.cg-estl{display:flex;flex-direction:column;gap:8px}
.cg-estl .o{display:flex;align-items:center;gap:10px;background:#0f1b31;border:1px solid #2a4170;border-radius:12px;padding:9px 12px}
.cg-estl .o.on{border-color:#ffd35c;box-shadow:0 0 0 2px #ffd35c33 inset}
.cg-estl .o .g{flex:1;min-width:0}.cg-estl .o .g b{display:block;color:#fff;font-size:14px}.cg-estl .o .g small{color:#8ea3c4;font-size:12px}
.cg-estl .o .e{text-align:right;flex:none}.cg-estl .o .e b{display:block;font:800 14px var(--mono,monospace)}.cg-estl .o .e small{color:#b9c8e2;font-size:12px}
.cg-estl .fit{color:#cdd9ee;font-size:13px;padding:2px 4px}
.cg-inv{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}
.cg-inv .cg-sp1 .ico{width:96px;height:96px;display:grid;place-items:center;font-size:52px;background:radial-gradient(circle at 50% 40%,#2a4170,#0f1b31);border:1px solid #3a5a8f;border-radius:18px}
.cg-badge{display:inline-flex;align-items:center;gap:6px;background:linear-gradient(90deg,#ffd35c,#ffb36b);color:#2a1d00;font:800 13px var(--body,system-ui);padding:4px 12px;border-radius:999px;white-space:nowrap}
@media (max-width:700px){.cg-inv{grid-template-columns:1fr}.cg-inv .cg-sp1{grid-template-columns:76px minmax(0,1fr)}.cg-inv .cg-sp1 .ico{width:76px;height:76px;font-size:40px}.cg-badge{white-space:normal}}
/* responsive */
@media (max-width:1180px){.cg-book{grid-template-columns:220px minmax(0,1fr)}.cg-idx button{font-size:13px}.cg-cols,.cg-cols.wide{grid-template-columns:minmax(0,1fr)}.cg-planes{grid-template-columns:1fr 1fr 1fr}}
@media (max-width:820px){
 .cg-ov{padding:0}.cg-book{grid-template-columns:minmax(0,1fr);border-radius:0;height:100%;width:100%;border:0}
 .cg-side{display:none}.cg-head select{display:block}.cg-head .cg-crumb{display:none}.cg-head .cg-tutb{display:inline-flex}.cg-head .cg-tutb .lbl{display:none}.cg-main{min-width:0}
 .cg-hero{min-height:150px;padding:30px 16px 16px}.cg-hero .cg-hart{display:none}.cg-sp{display:none}.cg-note{font-size:12.5px;padding:6px 9px 6px 32px}
 .cg-cols,.cg-cols.even,.cg-cols.wide{grid-template-columns:minmax(0,1fr)}.cg-planes{grid-template-columns:1fr}
 .cg-body{padding:16px 14px 0;gap:18px}.cg-foot{padding:8px 10px;gap:8px}.cg-foot .cg-btn{padding:9px 11px}.cg-foot .lbl{display:none}
 .cg-dots button{width:7px;height:7px}.cg-dots button.on{width:16px}.cg-dots{gap:4px}
 .cg-spec{grid-template-columns:1fr}.cg-sp1{grid-template-columns:76px minmax(0,1fr)}.cg-sp1 svg,.cg-sp1 .cg-fbcard{width:76px}
 .cg-wf .row{grid-template-columns:110px minmax(0,1fr) 74px;font-size:12.5px}
 .cg-bar{grid-template-columns:78px minmax(0,1fr) 56px}
 .cg-cnt{display:none}
 .cg-avs svg,.cg-avs .cg-fbav{width:58px;height:58px}
 .cg-office .bub{font-size:11px;max-width:36%}
 .cg-office .it{font-size:10.5px;padding:3px 6px}
}
@media (prefers-reduced-motion:reduce){.cg-ov *,.cg-ov{animation:none!important;transition:none!important}.cg-fly{display:none}}
/* ---------- tutorial spotlight ---------- */
.cg-tut{position:fixed;inset:0;z-index:70;pointer-events:none;font-family:var(--body,"Barlow",system-ui,sans-serif)}
.cg-tut *{box-sizing:border-box}
.cg-tut-dim{display:none}
.cg-tut-hole{position:fixed;border-radius:14px;box-shadow:0 0 0 9999px #0208146b,0 0 0 3px #ffd35c,0 0 26px 6px #ffd35caa;transition:left .28s cubic-bezier(.2,1,.3,1),top .28s cubic-bezier(.2,1,.3,1),width .28s,height .28s,opacity .25s;opacity:0}
.cg-tut-hole.on{opacity:1}
.cg-tut-hole::after{content:"";position:absolute;inset:-8px;border-radius:18px;border:2px solid #ffd35c;animation:cgtp 1.6s ease-out infinite}
@keyframes cgtp{from{opacity:.9;transform:scale(1)}to{opacity:0;transform:scale(1.08)}}
.cg-tut-bub{position:fixed;width:min(380px,calc(100vw - 24px));pointer-events:auto;background:linear-gradient(180deg,#fffdf2,#fff4cf);color:#2a2410;border-radius:16px;padding:14px 16px 12px;box-shadow:0 18px 44px #000c,0 0 0 2px #ffd35c;transition:left .28s cubic-bezier(.2,1,.3,1),top .28s cubic-bezier(.2,1,.3,1);font-size:14.5px;line-height:1.45}
.cg-tut-bub .ar{position:absolute;width:16px;height:16px;background:#fff7dc;transform:rotate(45deg);box-shadow:0 0 0 2px #ffd35c;z-index:-1}
.cg-tut-bub .hd{display:flex;align-items:center;gap:10px;margin-bottom:6px}
.cg-tut-bub .hd .cs{width:46px;height:46px;flex:none;border-radius:50%;overflow:hidden;background:#1c2a46;display:grid;place-items:center;border:2.5px solid #ffd35c}
.cg-tut-bub .hd .cs svg,.cg-tut-bub .hd .cs .cg-fbav{width:100%!important;height:100%!important;border:0}
.cg-tut-bub .hd small{display:block;font:700 11px var(--mono,monospace);letter-spacing:.1em;text-transform:uppercase;color:#a07a10}
.cg-tut-bub .hd b{font-size:16.5px;color:#1a1408}
.cg-tut-bub p{margin:0 0 8px}
.cg-tut-bub .do{display:flex;align-items:center;gap:6px;font-weight:700;color:#7a4a00;background:#ffd35c55;border-radius:9px;padding:5px 9px;margin:0 0 8px;font-size:13.5px}
.cg-tut-bub .miss{font-size:12.5px;color:#7a6a40;font-style:italic;margin:0 0 8px}
.cg-tut-bub .bt{display:flex;gap:6px;align-items:center;justify-content:flex-end;flex-wrap:wrap}
.cg-tut-bub .bt button{all:unset;cursor:pointer;padding:7px 12px;border-radius:10px;font-weight:800;font-size:13px;background:#efe3bd;color:#3a2a00}
.cg-tut-bub .bt button.pri{background:linear-gradient(#ffd35c,#e9a92a);color:#2a1d00;box-shadow:0 4px 10px #e9a92a66}
.cg-tut-bub .bt button:focus-visible{outline:2px solid #ff8a4c}
.cg-tut-bub .bt .prog{flex-basis:100%;display:flex;gap:3px;flex-wrap:wrap;margin-bottom:2px}
.cg-tut-bub .bt .prog i{width:6px;height:6px;border-radius:50%;background:#d8c78f}.cg-tut-bub .bt .prog i.on{background:#ff8a4c}
.cg-tut-bub.pop{animation:cgbp .35s cubic-bezier(.2,1.4,.4,1) both}
@keyframes cgbp{from{transform:scale(.9);opacity:0}to{transform:none;opacity:1}}
@media (prefers-reduced-motion:reduce){.cg-tut *{animation:none!important;transition:none!important}}
.cg-tut-bub .bt button.x{background:none;color:#8a6a20;font-weight:700;padding:7px 4px;margin-right:auto;font-size:12.5px}
.cg-tut-bub .bt button.x:hover{color:#5a3a00;text-decoration:underline}
.cg-tut-bub .wait{font-size:13px;color:#5a4410;background:#fff0c2;border:1px dashed #d9b04a;border-radius:9px;padding:6px 9px;margin:0 0 8px}
.cg-tut-bub .bt button.lnk{background:none;color:#8a6a20;text-decoration:underline;font-weight:700;padding:7px 6px;font-size:12.5px}
.cg-tut-bub .bt .prog i.ok{background:#3fb56b}
.cg-tut-bub .hd{min-width:0}.cg-tut-bub .hd>div{min-width:0}
@media (max-width:700px){.cg-tut-bub{font-size:13.5px;padding:11px 12px 10px;width:min(360px,calc(100vw - 20px))}.cg-tut-bub .hd .cs{width:38px;height:38px}}
.cg-hint{position:fixed;z-index:61;width:300px;box-sizing:border-box;pointer-events:none;background:rgba(15,36,64,.95);border:1px solid #ffd35c;color:#ffe7a8;border-radius:12px;padding:8px 12px;font:600 13px system-ui,sans-serif;text-align:center;box-shadow:0 6px 18px rgba(0,0,0,.45);transition:opacity .6s}.cg-hint.out{opacity:0}
.cg-offer{box-sizing:border-box;position:fixed;left:0;right:0;margin:0 auto;bottom:22px;z-index:71;display:flex;gap:14px;align-items:center;width:min(460px,calc(100vw - 20px));background:linear-gradient(180deg,#fffdf2,#fff4cf);color:#2a2410;border-radius:18px;padding:14px 16px;box-shadow:0 18px 44px #000c,0 0 0 2px #ffd35c;font:14.5px/1.45 var(--body,"Barlow",system-ui,sans-serif);animation:cgbp .4s cubic-bezier(.2,1.4,.4,1) both}
.cg-offer .cs{width:56px;height:56px;flex:none;border-radius:50%;overflow:hidden;background:#1c2a46;display:grid;place-items:center;border:2.5px solid #ffd35c}
.cg-offer .cs svg,.cg-offer .cs .cg-fbav{width:100%!important;height:100%!important;border:0}
.cg-offer b{font-size:17px;color:#1a1408}.cg-offer p{margin:2px 0 10px}
.cg-offer .bt{display:flex;gap:8px;flex-wrap:wrap}
.cg-offer button{all:unset;cursor:pointer;padding:8px 14px;border-radius:10px;font-weight:800;font-size:14px;background:#efe3bd;color:#3a2a00}
.cg-offer button.pri{background:linear-gradient(#ffd35c,#e9a92a);color:#2a1d00;box-shadow:0 4px 10px #e9a92a66}
.cg-offer button:focus-visible{outline:2px solid #ff8a4c}
@media (max-width:700px){.cg-offer{bottom:76px;padding:12px}.cg-offer .cs{width:44px;height:44px}}
@media (prefers-reduced-motion:reduce){.cg-offer{animation:none}}

`;
    D.head.appendChild(st);
    try { W.CerulTheme && W.CerulTheme.inject(); } catch (e) { /* fără temă */ }
  }

  // ---------- replica builders (mini UI, faithful to the approved mockup) ----------
  let ME = "#ff8a4c", OP = "#5fd3dc";
  const rAv = (id, ring) => `<div class="r-av" style="border-color:${ring || ME}">${avatar(id, 34, "happy")}</div>`;
  const resCard = (k, n, label) => {
    const A = ArtG();
    if (A && A.cardFace) return `<div class="r-rc" style="border:0">${art("cardFace", [k, { w: 50 }], "")}<em>${n}</em></div>`;
    const f = CARD_FB[k]; return `<div class="r-rc" style="background:${f[2]}">${f[0]}<span${k === "joker" ? ' style="color:#222"' : ""}>${label || f[1]}</span><em>${n}</em></div>`;
  };
  const need = (list) => list.map(([k, have]) => `<span class="${have ? "" : "x"}">${cardIcon(k, 16)}</span>`).join("");

  function mapSvg(opt) {
    opt = opt || {};
    const pt = (t, x, y, rot, o) => {
      const s = planeTopSvg(t, ME, 30);
      if (s) return `<g transform="translate(${x} ${y}) rotate(${rot}) scale(2.3) translate(-15 -15)" opacity="${o || 1}">${s}</g>`;
      return `<text x="${x}" y="${y}" font-size="24" opacity="${o || 1}" text-anchor="middle" dominant-baseline="middle">✈️</text>`;
    };
    return `<svg viewBox="0 0 1520 866" preserveAspectRatio="xMidYMid slice">
<defs><linearGradient id="cgnight" x1="0" x2="1"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset=".25" stop-color="#020814" stop-opacity=".6"/><stop offset=".75" stop-color="#020814" stop-opacity=".6"/><stop offset="1" stop-color="#000" stop-opacity="0"/></linearGradient></defs>
<g stroke="#ffffff10" stroke-width="1">${[1, 2, 3, 4, 5, 6, 7].map(i => `<line x1="${i * 190}" y1="0" x2="${i * 190}" y2="866"/>`).join("")}${[1, 2, 3, 4].map(i => `<line x1="0" y1="${i * 173}" x2="1520" y2="${i * 173}"/>`).join("")}</g>
<g fill="#2c4a3a" stroke="#4f7a5c" stroke-width="2">
<path d="M110 170 C200 110 360 120 430 170 C470 240 420 300 380 330 C350 380 300 400 270 450 C230 430 200 380 160 330 C120 280 90 220 110 170Z"/>
<path d="M330 470 C380 470 420 520 410 600 C400 680 360 760 330 790 C300 740 290 660 300 590 C305 540 300 490 330 470Z"/>
<path d="M660 160 C720 130 800 140 840 170 C860 210 830 250 790 270 C740 290 690 280 660 250 C640 220 640 185 660 160Z"/>
<path d="M660 300 C730 290 800 310 830 360 C850 440 820 520 780 580 C740 620 700 600 680 540 C650 470 630 380 660 300Z"/>
<path d="M850 140 C980 100 1180 110 1320 170 C1380 220 1350 300 1270 330 C1200 360 1120 350 1060 390 C1000 420 940 400 900 360 C860 300 820 210 850 140Z"/>
<path d="M1200 560 C1270 540 1350 560 1380 610 C1380 660 1320 690 1260 680 C1210 670 1180 620 1200 560Z"/></g>
<rect x="980" y="0" width="420" height="866" fill="url(#cgnight)"/>
<g fill="#ffe08a" opacity=".85"><circle cx="1100" cy="250" r="3"/><circle cx="1150" cy="300" r="2.5"/><circle cx="1240" cy="230" r="3"/><circle cx="1050" cy="330" r="2.5"/><circle cx="1290" cy="280" r="2.5"/><circle cx="1180" cy="200" r="2"/></g>
<g fill="none" stroke-width="5" stroke-linecap="round">
<path d="M770 205 Q600 120 330 240" stroke="${ME}"/><path d="M770 205 Q760 180 718 192" stroke="${ME}"/><path d="M770 205 Q900 260 960 330" stroke="${ME}"/>
<path d="M718 192 Q700 150 690 175" stroke="${OP}" stroke-dasharray="2 10" opacity=".7"/><path d="M718 192 Q560 100 300 220" stroke="${OP}" opacity=".55" stroke-width="3.5"/>
<path d="M960 330 Q1100 330 1230 250" stroke="${ME}" stroke-dasharray="12 9"/></g>
${pt("a320", 540, 160, -78)}${pt("s350", 880, 268, 62)}${pt("t72", 640, 158, -100, .5)}
<g fill="#fff" stroke="#0b1d36" stroke-width="3"><circle cx="770" cy="205" r="11" fill="${ME}"/><circle cx="718" cy="192" r="7"/><circle cx="330" cy="240" r="8"/><circle cx="960" cy="330" r="8"/><circle cx="1230" cy="250" r="7"/><circle cx="690" cy="175" r="6"/><circle cx="300" cy="220" r="7"/><circle cx="740" cy="400" r="6"/><circle cx="360" cy="560" r="6"/><circle cx="1290" cy="610" r="6"/><circle cx="1100" cy="280" r="6"/></g>
<g class="r-lbl" style="font-size:${opt.big ? 22 : 18}px"><text x="786" y="212">București (bază)</text><text x="650" y="222">Viena</text><text x="250" y="272">New York</text><text x="975" y="340">Dubai</text><text x="1244" y="246">Beijing</text><text x="636" y="166">Londra</text><text x="226" y="212">Toronto</text><text x="752" y="408">Lagos</text><text x="372" y="566">São Paulo</text><text x="1300" y="616">Sydney</text><text x="1112" y="285">Delhi</text></g>
${opt.anchors ? `<circle data-a="base" cx="770" cy="205" r="2" fill="none"/><circle data-a="myroute" cx="560" cy="160" r="2" fill="none"/><circle data-a="oproute" cx="500" cy="140" r="2" fill="none"/><circle data-a="dash" cx="1100" cy="315" r="2" fill="none"/><circle data-a="night" cx="1180" cy="460" r="2" fill="none"/><circle data-a="plane" cx="880" cy="268" r="2" fill="none"/>` : ""}
</svg>`;
  }

  function replicaFull() {
    return `<div class="cg-r" style="width:1100px;height:620px;display:grid;grid-template-columns:minmax(0,1fr);grid-template-rows:52px minmax(0,1fr) 118px">
<div class="r-top">
 <div class="r-co" data-a="company">${rAv(VW.av)}<div><b>${esc(VW.co)}</b><small>Bază: ${esc(VW.base || "București")} · ★★★★☆</small></div></div>
 <div class="r-stat" data-a="cash"><small>Bani</small><b style="color:#5fd38a">18,4 M €</b></div>
 <div class="r-stat"><small>Valoare companie</small><b>63,2 M €</b></div>
 <div class="r-stat"><small>Credit bancă</small><b style="color:#ff6b6b">−5,0 M €</b></div>
 <div class="r-clock" data-a="clock"><div class="r-ring"><i>☀️</i></div><div><small style="color:#8ea3c4;font-size:9px">ZIUA 34 · 14:20</small><br><b style="font-size:13px">1:12:40 rămas</b></div></div>
 <div class="r-op" data-a="opp">${rAv(RV.av, OP)}<div><b>${esc(RV.co)}</b><br><small style="color:#8ea3c4;font-size:10px">★★★★★ · 9 în aer</small></div></div>
 <div class="r-btns" data-a="btns"><span class="r-b gold">🤝 Negociază</span><span class="r-b">🏦 Bancă</span><span class="r-b">🃏 Ghișeu</span><span class="r-b">📖</span></div>
</div>
<div class="r-main">
 <div class="r-map" data-a="map">${mapSvg()}
  <div class="r-cons" data-a="cons"><div class="r-av" style="border-color:#ffd35c">${consultant(34)}</div><div class="r-bub"><b>Consultantul tău:</b> „Ruta Viena–Londra e plină doar 38%.”</div></div>
  <div class="r-pop" data-a="pop" style="left:46%;top:25%"><h4>✈️ București → Dubai</h4><div class="row">Pasageri/zi <b>420 (tu 61%)</b></div><div class="row">Prețul tău <b>210 €</b></div><div class="pr"><span class="r-b">💸 160 €</span><span class="r-b sel">205 €</span><span class="r-b">💎 290 €</span></div><div class="row">Profit azi <b style="color:#5fd38a">+48.200 €</b></div></div>
  <div class="r-zoom"><span>+</span><span>−</span><span>🌍</span></div>
 </div>
 <div class="r-side" data-a="side"><div class="r-tabs"><div class="on">✈️ Flotă</div><div>🛣️ Rute</div><div>📊</div><div>🛒</div></div>
  <div class="r-list">
   <div class="r-pl"><div class="h"><b>Aero 320 „Carpați”</b><span class="r-tag">se îmbarcă</span></div><div class="r-bar"><i style="width:68%"></i></div><div class="r">122/180 · spre Viena <span class="r-go" data-a="go">🛫 Decolează</span></div></div>
   <div class="r-pl"><div class="h"><b>Skyliner 350 „Dunărea”</b><span class="r-tag pil">👨‍✈️ pilot</span></div><div class="r-bar c"><i style="width:45%"></i></div><div class="r">În zbor → Dubai <span class="r-tag ok">+61.000 €</span></div></div>
   <div class="r-pl"><div class="h"><b>Turbo 72 „Brașov”</b><span class="r-tag">se îmbarcă</span></div><div class="r-bar"><i style="width:94%"></i></div><div class="r">66/70 · spre Londra <span class="r-go">🛫 Decolează</span></div></div>
   <div class="r-pl"><div class="h"><b>Skyliner 350 „Siret”</b><span class="r-tag">în hangar</span></div><div class="r" style="margin-top:5px">Fără rută <span class="r-b" style="padding:3px 8px;font-size:10.5px">Atribuie rută</span></div></div>
  </div></div>
</div>
<div class="r-bottom">
 <div class="r-box" data-a="cards"><small>Cărțile tale (resurse)</small><div class="r-res">${resCard("apr", 3, "Aprobare")}${resCard("inf", 2, "Infrastr.")}${resCard("ech", 4, "Echipaj")}${resCard("comb", 1, "Combust.")}${resCard("joker", 1)}</div></div>
 <div class="r-box" data-a="permits"><small>Permisele tale (max 3)</small><div class="r-perm"><div class="r-pm"><b>București → Dubai</b><div class="r-need">${need([["apr", 1], ["apr", 1], ["inf", 1], ["comb", 1], ["comb", 0], ["ech", 1]])}</div><span class="r-bld">⭐ → Construiește</span></div><div class="r-pm"><b>Dubai → Beijing</b><div class="r-need">${need([["apr", 1], ["apr", 0], ["inf", 0], ["inf", 0], ["comb", 0], ["ech", 1]])}</div>lipsesc 4 cărți</div><div class="r-pm" style="opacity:.6;display:grid;place-items:center;text-align:center"><b>＋ Trage permis</b></div></div></div>
 <div class="r-box" data-a="specials"><small>Cărți speciale</small><div class="r-sp"><div class="r-sc ice"><b>❄️</b>Îngheață timpul</div><div class="r-sc fire"><b>🔥</b>Spărgător</div><div class="r-sc"><b>📈</b>Boom</div></div></div>
</div></div>`;
  }

  function replicaMap() {
    return `<div class="cg-r" style="width:900px;height:520px"><div class="r-map" style="height:100%" data-a="mapbox">${mapSvg({ anchors: true, big: true })}
<div class="r-legend">🟠 rutele tale · 🔵 rutele ${esc(RV.co)} (doar traseul) · - - - în construcție · 🌙 noapte</div>
<div class="r-zoom" data-a="zoom"><span>+</span><span>−</span><span>🌍</span></div></div></div>`;
  }

  function replicaFleet() {
    return `<div class="cg-r" style="width:380px"><div class="r-side" style="border:0"><div class="r-tabs"><div class="on" data-a="tab">✈️ Flotă (4)</div><div>🛣️ Rute</div><div>📊</div><div>🛒</div></div><div class="r-list">
<div class="r-pl"><div class="h"><b>Aero 320 „Carpați”</b><span class="r-tag">București · se îmbarcă</span></div><div class="r-bar" data-a="bar"><i style="width:68%"></i></div><div class="r">122/180 pasageri · spre Viena <span class="r-go" data-a="go">🛫 Decolează</span></div></div>
<div class="r-pl"><div class="h"><b>Skyliner 350 „Dunărea”</b><span class="r-tag pil" data-a="pilot">👨‍✈️ pilot</span></div><div class="r-bar c" data-a="fly"><i style="width:45%"></i></div><div class="r">În zbor → Dubai · 3h 10m <span class="r-tag ok" data-a="profit">+61.000 €</span></div></div>
<div class="r-pl"><div class="h"><b>Turbo 72 „Brașov”</b><span class="r-tag">Viena · se îmbarcă</span></div><div class="r-bar"><i style="width:94%"></i></div><div class="r">66/70 pasageri · spre Londra <span class="r-go">🛫 Decolează</span></div></div>
<div class="r-pl"><div class="h"><b>Skyliner 350 „Siret”</b><span class="r-tag">în hangar</span></div><div class="r" style="margin-top:5px">Fără rută · <span class="r-b" data-a="assign" style="padding:3px 8px;font-size:11px">Atribuie rută</span></div></div>
</div></div></div>`;
  }

  function replicaPermits() {
    return `<div class="cg-r" style="width:720px;padding:0"><div class="r-bottom" style="grid-template-columns:270px 1fr;border:0">
<div class="r-box" data-a="cards"><small>Cărțile tale (resurse)</small><div class="r-res">${resCard("apr", 3, "Aprobare")}${resCard("inf", 2, "Infrastr.")}${resCard("ech", 4, "Echipaj")}${resCard("comb", 1, "Combust.")}${resCard("joker", 1)}</div></div>
<div class="r-box"><small>Permisele tale (max 3) — ce mai lipsește</small><div class="r-perm">
<div class="r-pm" data-a="perm"><b>București → Dubai</b><div class="r-need" data-a="need">${need([["apr", 1], ["apr", 1], ["inf", 1], ["comb", 1], ["comb", 0], ["ech", 1]])}</div>lipsește 1 ⛽ · <span class="r-bld" data-a="build">⭐ → Construiește</span></div>
<div class="r-pm" style="opacity:.6;display:grid;place-items:center;text-align:center" data-a="draw"><b>＋ Trage permis</b>(loc liber)</div>
</div></div></div></div>`;
  }

  function replicaPopup() {
    return `<div class="cg-r" style="width:330px;background:transparent;box-shadow:none;overflow:visible"><div class="r-pop" style="position:relative;width:330px;padding:12px 14px 12px 24px">
<h4 style="font-size:16px">✈️ București → Londra</h4>
<div class="row" data-a="dem">Pasageri/zi <b>400 (tu <span data-v="shp">62%</span>)</b></div>
<div class="row">Prețul tău <b data-v="myp">180 €</b></div>
<div class="pr" data-a="pres"><span class="r-b">💸 Ieftin 150 €</span><span class="r-b sel">Normal 200 €</span><span class="r-b">💎 Premium 280 €</span></div>
<div class="row" data-a="rec">Recomandat <b style="color:#ffd35c">195 € · ~84% plin</b></div>
<div class="row">Profit azi <b style="color:#5fd38a">+31.400 €</b></div></div></div>`;
  }

  // ---------- annotation layout (pins + arrows) ----------
  function stageHTML(replica, notes, opts) {
    opts = opts || {};
    const L = notes.filter(n => n.side === "l"), R = notes.filter(n => n.side !== "l");
    const nt = n => `<div class="cg-note" data-to="${n.to}"><span class="k">${n.n}</span>${n.html}</div>`;
    return `<div class="cg-stage${L.length ? "" : " nol"}" data-w="${opts.w}" data-h="${opts.h}">
${L.length ? `<div class="cg-notes l">${L.map(nt).join("")}</div>` : ""}
<div class="cg-fit" data-w="${opts.w}" data-h="${opts.h}">${replica}</div>
<div class="cg-notes r">${R.map(nt).join("")}</div>
<div class="cg-legend">${notes.slice().sort((a, b) => a.n - b.n).map(nt).join("")}</div>
<svg class="cg-arrows"></svg></div>`;
  }
  function layoutStage(stage) {
    const fit = stage.querySelector(".cg-fit"); if (!fit) return;
    const rep = fit.firstElementChild; const w = +fit.dataset.w, h = +fit.dataset.h;
    const sw = stage.getBoundingClientRect().width;
    const narrow = sw < 760 || (w > 600 && (sw - 468) / w < 0.55);
    stage.classList.toggle("narrow", narrow);
    const avail = fit.getBoundingClientRect().width || sw;
    const sc = Math.min(1, avail / w);
    rep.style.transform = `scale(${sc})`; fit.style.height = (h * sc) + "px";
    // pins
    stage.querySelectorAll(".cg-pin").forEach(p => p.remove());
    const srect = stage.getBoundingClientRect();
    if (!stage.dataset.sorted) {
      stage.dataset.sorted = "1";
      stage.querySelectorAll(".cg-notes").forEach(col => {
        const arr = [...col.children].map(n => { const a = rep.querySelector(`[data-a="${n.dataset.to}"]`); const r = a ? a.getBoundingClientRect() : { top: 0, left: 0 }; return [r.top + r.left * 0.001, n]; });
        arr.sort((x, y) => x[0] - y[0]).forEach(x => col.appendChild(x[1]));
      });
    }
    const notes = [...stage.querySelectorAll(".cg-notes .cg-note")];
    const svg = stage.querySelector(".cg-arrows");
    let paths = "";
    const seenPin = {}, pinAt = {};
    stage.querySelectorAll(".cg-legend .cg-note, .cg-notes .cg-note").forEach(n => {
      const to = n.dataset.to; if (seenPin[to]) return; seenPin[to] = 1;
      const a = rep.querySelector(`[data-a="${to}"]`); if (!a) return;
      const r = a.getBoundingClientRect();
      const pin = D.createElement("span"); pin.className = "cg-pin"; pin.textContent = n.querySelector(".k").textContent;
      const big = r.width > 24 || r.height > 24; const px = r.left - srect.left + (big ? -11 : r.width / 2), py = r.top - srect.top + (big && r.height >= 40 ? 0 : r.height / 2);
      pin.style.left = px + "px"; pin.style.top = py + "px"; pinAt[to] = [px, py];
      stage.appendChild(pin);
    });
    if (!narrow) {
      notes.forEach(n => {
        const a = rep.querySelector(`[data-a="${n.dataset.to}"]`); if (!a) return;
        const nr = n.getBoundingClientRect();
        const left = n.closest(".cg-notes").classList.contains("l");
        const x1 = (left ? nr.right : nr.left) - srect.left, y1 = nr.top + nr.height / 2 - srect.top;
        const pp = pinAt[n.dataset.to]; if (!pp) return;
        const dd = Math.hypot(pp[0] - x1, pp[1] - y1) || 1;
        const x2 = pp[0] - (pp[0] - x1) / dd * 14, y2 = pp[1] - (pp[1] - y1) / dd * 14;
        const mx = (x1 + x2) / 2, my = (y1 + y2) / 2 - Math.min(40, Math.abs(x2 - x1) * .12);
        const ang = Math.atan2(y2 - my, x2 - mx);
        const hx = x2 - Math.cos(ang) * 4, hy = y2 - Math.sin(ang) * 4;
        const p1 = [hx - Math.cos(ang - .45) * 11, hy - Math.sin(ang - .45) * 11], p2 = [hx - Math.cos(ang + .45) * 11, hy - Math.sin(ang + .45) * 11];
        paths += `<path d="M${x1.toFixed(1)} ${y1.toFixed(1)} Q${mx.toFixed(1)} ${my.toFixed(1)} ${hx.toFixed(1)} ${hy.toFixed(1)}"/><polygon class="hd" points="${(x2 + Math.cos(ang) * 2).toFixed(1)},${(y2 + Math.sin(ang) * 2).toFixed(1)} ${p1[0].toFixed(1)},${p1[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}"/>`;
      });
    }
    svg.setAttribute("width", srect.width); svg.setAttribute("height", srect.height);
    svg.innerHTML = paths;
  }

  // ---------- math for worked examples ----------
  const EPS = () => tv(["EPS", "ELASTICITY", "PRICE_ELASTICITY", "priceEps", "eps"], 1.8);
  function attract(price, normal, stars, freq) { return Math.pow(price / normal, -EPS()) * (freq || 1) * (1 + 0.15 * (stars - 3)); }

  // ---------- chapters ----------
  const CH = [];
  const ch = (id, icon, title, hero, build, mount) => CH.push({ id, icon, title, hero, build, mount });
  const hero = (o) => o;

  ch("bun-venit", "🌍", "Bine ai venit", hero({ cls: "", lead: "Conduci o companie aeriană pe o hartă a lumii reale. Construiești rute, cumperi avioane, fixezi prețuri și te lupți pentru pasageri cu prietenii tăi — în timp real." }), () => {
    const avs = [VW.av, RV.av].concat([2, 7, 1, 8, 3].filter(x => x !== VW.av && x !== RV.av).slice(0, 2)).map((id, i) => avatar(id, 84, i % 2 ? "smug" : "happy", [ME, OP, "#b9a3ff", "#7be07b"][i])).join("");
    return `<div class="cg-cols">
<div class="cg-txt"><h3><span class="ic">🏆</span>Scopul jocului</h3>
<p>Câștigă compania cu <b>cea mai mare valoare finală</b> — bani, avioane, rute, sloturi, huburi, investiții, cărți rămase și acțiuni la alte companii, minus datoriile. În modul <b>„Fără timp”</b> câștigă ultima companie rămasă în picioare.</p>
<h3><span class="ic">👥</span>Jucători</h3><p>2–4 companii. Locurile goale pot fi luate de <b>boți</b> — poți juca și singur(ă) contra 1–3 boți.</p>
<h3><span class="ic">⏱️</span>Timpul curge continuu</h3>
<ul><li>O zi de joc = <b>1, 2 sau 3 minute reale</b> („Normal”, „Relaxat”, „Lung”).</li><li>Durata partidei: <b>1 h, 2 h, 3 h</b> sau <b>„Fără timp”</b> (după ziua 60 crizele se înăspresc).</li><li>Timpul se oprește singur doar la <b>draft</b> (sfârșitul zilei) și în <b>negocieri</b>.</li><li>Când jocul e pus pe <b>pauză</b>, poți doar să privești sau să negociezi: construcțiile, cumpărăturile și decolările așteaptă reluarea.</li></ul>
<h3><span class="ic">🔒</span>Informații private</h3><p>Nu vezi prețurile, orarul, profitul, cărțile sau permisele adversarilor. Vezi doar <b>traseele</b> lor pe hartă, avioanele în zbor, numele, culoarea, stelele de reputație și un loc aproximativ în clasament.</p></div>
<div class="cg-card" style="display:flex;flex-direction:column;gap:14px;align-items:center;text-align:center">
<div class="cg-avs">${avs}</div>
<div style="width:100%;max-width:520px">${planeSide("s350", ME, 520)}</div>
<div class="cg-txt"><p style="margin:0">Fiecare companie pornește dintr-o <b>bază</b> diferită, pe alt continent, cu <b>bani de start</b>, un <b>Turbo 72 gratuit</b>, 4 cărți de resurse și 3 permise din care păstrează cel puțin unul.</p></div>
</div></div>
<div class="cg-steps">
<div class="cg-step"><span class="ic">🎟️</span><b>Primești permise</b><span>Perechi de orașe pe care ai voie să zbori.</span></div>
<div class="cg-step"><span class="ic">🃏</span><b>Aduni cărți</b><span>Aprobare, Infrastructură, Echipaj, Combustibil, Joker.</span></div>
<div class="cg-step"><span class="ic">🛣️</span><b>Construiești ruta</b><span>Plătești cărțile + sloturile din aeroporturi.</span></div>
<div class="cg-step"><span class="ic">✈️</span><b>Pui avioane pe ea</b><span>Pasagerii se îmbarcă, tu apeși „Decolează” (sau angajezi pilot).</span></div>
<div class="cg-step"><span class="ic">💶</span><b>Încasezi și crești</b><span>Prețuri bune, mai multe avioane, huburi, bursă.</span></div>
</div>
${(() => { const b = BONUS(); return `<div class="cg-tip ok"><span class="i">🌱</span><div><span class="cg-badge">🌱 Start de companie: −${Math.round((1 - b.fee) * 100)}% taxe, zilele 1–${b.days}</span><br>În primele <b>${b.days} zile</b> de joc plătești doar <b>${pct(b.fee)}</b> din taxele de aterizare${b.lease === b.fee ? " și din leasing" : ` și ${pct(b.lease)} din leasing`}. Insigna aurie de pe hartă îți arată câte zile mai ai — profită ca să-ți construiești primele rute și să iei primele avioane.</div></div>`; })()}
<div class="cg-tip"><span class="i">💡</span><div>Navighezi cu <span class="cg-kbd">←</span> <span class="cg-kbd">→</span>, cu glisare pe telefon, din cuprinsul din stânga sau din punctele de jos. <span class="cg-kbd">Esc</span> închide ghidul. Îl redeschizi oricând cu butonul <b>📖 Ghid</b>.</div></div>`;
  });

  ch("ecran", "🖥️", "Ecranul de joc", hero({ cls: "night", lead: "Totul într-o singură privire: sus banii și ceasul, în centru harta, la dreapta flota, jos cărțile și permisele." }), () => {
    const notes = [
      { n: 1, to: "company", side: "l", html: "<b>Compania ta</b> — avatar, nume, bază și stele de reputație." },
      { n: 2, to: "cash", side: "l", html: "<b>Bani, valoare, credit</b> — dacă banii devin negativi, ai 5 zile să-ți revii." },
      { n: 3, to: "clock", side: "l", html: "<b>Ceasul zilei</b> — inelul se umple; la final vine draftul. Dedesubt: timpul rămas din partidă." },
      { n: 4, to: "cons", side: "l", html: "<b>Consultantul</b> (dacă îl angajezi) îți șoptește sfaturi." },
      { n: 5, to: "opp", side: "r", html: "<b>Adversarii</b> — doar informații publice: stele, avioane în aer." },
      { n: 6, to: "btns", side: "r", html: "<b>Negociază, Bancă, Ghișeu, Ghid</b> — acțiuni speciale." },
      { n: 7, to: "pop", side: "r", html: "<b>Fereastra rutei</b> — click pe o rută: prețuri, cerere, profit." },
      { n: 8, to: "side", side: "r", html: "<b>Panoul din dreapta</b> — Flotă, Rute, Rapoarte, Avioane, Bursa, Investiții." },
      { n: 9, to: "cards", side: "l", html: "<b>Cărțile de resurse</b> cu numărul din fiecare." },
      { n: 10, to: "permits", side: "r", html: "<b>Permisele</b> și ce cărți mai lipsesc; „Construiește” se aprinde când poți." },
      { n: 11, to: "specials", side: "r", html: "<b>Cărțile speciale</b> — butonul „Folosește”." }
    ];
    return stageHTML(replicaFull(), notes, { w: 1100, h: 620 }) +
      `<div class="cg-tip"><span class="i">📱</span><div><b>Pe telefon:</b> harta ocupă partea de sus; jos ai o bară cu file (Flotă, Cărți, Permise, Bani…) care deschid foi glisante. Când un avion e gata de plecare primești o notificare cu „Decolează”. Pe PC poți trage de separatorul hărții sau poți trece în modul <b>„doar harta”</b>.</div></div>`;
  });

  ch("harta", "🗺️", "Harta lumii", hero({ cls: "night", lead: "Circa 130 de aeroporturi reale. Ziua și noaptea trec peste hartă în timp real — orașele se aprind noaptea." }), () => {
    const notes = [
      { n: 1, to: "base", side: "l", html: "<b>Baza ta</b> — cercul mare, în culoarea companiei." },
      { n: 2, to: "myroute", side: "l", html: "<b>Rutele tale</b> — arce groase, în culoarea ta." },
      { n: 3, to: "oproute", side: "l", html: "<b>Rutele adversarilor</b> — subțiri, transparente. Vezi doar traseul, nu și prețul." },
      { n: 4, to: "plane", side: "r", html: "<b>Avioane în zbor</b> — se mișcă lin pe arc. Click pe ele pentru detalii." },
      { n: 5, to: "dash", side: "r", html: "<b>Linie punctată</b> — rută în construcție sau permis încă neconstruit." },
      { n: 6, to: "night", side: "r", html: "<b>Noaptea</b> — umbra se mută după ora jocului." },
      { n: 7, to: "zoom", side: "r", html: "<b>Zoom</b> — rotița mouse-ului / două degete, trage ca să muți, 🌍 = toată lumea." }
    ];
    return stageHTML(replicaMap(), notes, { w: 900, h: 520 }) + `<div class="cg-cols even">
<div class="cg-txt"><h3><span class="ic">🛬</span>Aeroporturile</h3><p>Fiecare aeroport are o <b>mărime</b> (mic, mediu, mare) și o <b>populație</b> care dă cererea. Unele au etichete: <b>plajă</b>, <b>schi</b>, <b>afaceri</b> — vara plajele se umplu, iarna stațiunile de schi.</p>
<p>Cererea zilnică dintre două orașe crește cu mărimea lor și scade cu distanța. O rută nouă pornește de la <b>${pct(RAMP0())}</b> din cerere și ajunge la <b>100%</b> în aproximativ <b>${RAMPD()} zile</b>.</p></div>
<div class="cg-txt"><h3><span class="ic">🖱️</span>Ce poți face pe hartă</h3><ul><li><b>Click pe aeroport</b> — informații, sloturi libere, cumpără slot sau hub.</li><li><b>Click pe rută</b> — fereastra cu prețuri și profit.</li><li><b>Click pe avion</b> — încărcare, destinație, ora de sosire.</li><li>Rutele înghețate și avioanele oprite apar acoperite de gheață ❄️.</li></ul></div></div>`;
  });

  ch("permise", "🎟️", "Permise și cărți", hero({ cls: "gold", lead: "Ca să zbori între două orașe ai nevoie de un permis de rută și de cărțile de resurse cerute de el." }), () => {
    const res = [["apr", "22%"], ["inf", "22%"], ["ech", "22%"], ["comb", "22%"], ["joker", "6%"]];
    const gal = res.map(([k, p]) => { const t = cardText(k, ""); return `<div class="cg-gc">${cardFace(k, 104)}<b>${esc(t.name)}</b><span class="pc">${p}</span></div>`; }).join("") +
      `<div class="cg-gc">${cardBack(104)}<b>Specială</b><span class="pc">6%</span></div>`;
    const notes = [
      { n: 1, to: "cards", side: "l", html: "<b>Mâna ta</b> — câte cărți ai din fiecare tip." },
      { n: 2, to: "need", side: "r", html: "<b>Costul permisului</b> — iconițele colorate le ai deja, cele gri îți lipsesc." },
      { n: 3, to: "build", side: "r", html: "<b>Construiește</b> — se aprinde când ai tot (Jokerul acoperă o lipsă)." },
      { n: 4, to: "draw", side: "r", html: "<b>Trage permis</b> — doar când ai sub 3 permise deschise." }
    ];
    return `<div class="cg-cols wide"><div class="cg-txt"><h3><span class="ic">🎟️</span>Permisul de rută</h3>
<p>Un permis este o pereche de orașe <b>A ↔ B</b>. Cel puțin un capăt trebuie să fie <b>în rețeaua ta</b>: baza, un hub sau orice aeroport pe care îl deservești deja.</p>
<ul><li>Când tragi, primești <b>3 oferte</b> (scurte, medii, lungi — toate posibile cu un avion existent) și păstrezi <b>cel puțin unul</b>.</li><li>Poți avea <b>maximum 3 permise deschise</b>. Tragi din nou abia când ai sub 3.</li><li>Renunțarea la un permis costă o mică penalizare și eliberează locul.</li><li>La final, fiecare permis neconstruit îți scade puțin din scor.</li></ul></div>
<div><div class="cg-txt"><h3><span class="ic">🃏</span>Cărțile de resurse (pachet nelimitat)</h3></div><div class="cg-gal">${gal}</div>
<div class="cg-txt" style="margin-top:10px"><p>⚠️ Cartea <b>„Combustibil”</b> e doar o resursă pentru permise — combustibilul avioanelor se plătește în bani la fiecare zbor (vezi „Profitul unui zbor”). <b>Jokerul</b> ține locul oricărei cărți normale. 6% din cărți sunt <b>speciale</b> (cât timp mai sunt în rezervă) — le găsești la capitolul „Cărți speciale”.</p></div></div></div>
${stageHTML(replicaPermits(), notes, { w: 720, h: 128 })}
<div class="cg-cols even"><div class="cg-ex"><h4><span class="tag">Exemplu</span>Cât costă un permis</h4>
<table class="cg-tab"><tr><th>Tip rută</th><th>Exemplu</th><th class="r">Cărți</th></tr>
<tr><td>Scurtă</td><td>București – Viena</td><td class="r">2–3</td></tr><tr><td>Medie</td><td>București – Dubai</td><td class="r">4–5</td></tr><tr><td>Lungă / intercontinentală</td><td>București – New York</td><td class="r">6–8</td></tr></table>
<p class="cg-txt" style="margin:8px 0 0;color:#b9c8e2;font-size:13.5px">Aeroporturile mari cer în plus <b>Infrastructură</b>; rutele lungi cer mai mult <b>Combustibil</b> și <b>Echipaj</b>.</p></div>
<div class="cg-ex"><h4><span class="tag">De unde</span>Cum obții cărți</h4><ul class="cg-txt" style="margin:0;padding-left:20px;color:#cdd9ee">
<li>La start: <b>4 cărți</b> aleatorii.</li><li>La <b>draftul</b> de la sfârșitul fiecărei zile: <b>3 cărți</b> alese pe rând.</li><li>La <b>Ghișeu</b>: <b>5 cărți normale → 1 carte la alegere</b>.</li><li><b>Cumpărate cu bani</b>: ${(() => { const C = tsub(["cards"], {}) || {}, m = +C.buyMult || 1.3, h = Math.round((+C.heatHalfLifeMin || 720) / 60); return `prețul de bază e ${fmtE(+C.buyPrice || 350000)}; fiecare carte cumpărată îl urcă ×${String(m).replace(".", ",")} (P → ${String(m).replace(".", ",")}P → ${String(Math.round(m * m * 100) / 100).replace(".", ",")}P…), iar scumpirea se înjumătățește la fiecare ${h} ore de joc. Cel mult ${+C.buyMaxPerDay || 6} pe zi.`; })()} Cărțile speciale nu se cumpără.</li></ul></div></div>`;
  });

  ch("constructie", "🏗️", "Construiești o rută", hero({ cls: "dusk", lead: "Permis + cărți + sloturi la aeroporturi = rută nouă. Cine deschide primul o rută primește bonusul de pionier." }), () => `
<div class="cg-steps">
<div class="cg-step"><span class="ic">🎟️</span><b>1. Alegi permisul</b><span>Din bara de jos, permisul pe care vrei să-l construiești.</span></div>
<div class="cg-step"><span class="ic">🃏</span><b>2. Plătești cărțile</b><span>Cele cerute de permis. Jokerii umplu golurile; 🚀 Construcție rapidă scade o carte.</span></div>
<div class="cg-step"><span class="ic">🏛️</span><b>3. Plătești sloturile</b><span>La fiecare capăt unde nu ești încă prezent cumperi un <b>slot</b>.</span></div>
<div class="cg-step"><span class="ic">🎉</span><b>4. Ruta e gata</b><span>Apare pe hartă; atribui avioane și fixezi prețul.</span></div></div>
<div class="cg-cols even">
<div class="cg-txt"><h3><span class="ic">🏛️</span>Sloturile sunt limitate!</h3>
<p>Un aeroport are un număr limitat de locuri pentru companii:</p>
<table class="cg-tab"><tr><th>Aeroport</th><th class="r">Sloturi pentru companii</th><th class="r">Preț slot</th></tr>
<tr><td>Mic</td><td class="r">nelimitat</td><td class="r">ieftin</td></tr><tr><td>Mediu</td><td class="r">3</td><td class="r">mediu</td></tr><tr><td>Mare</td><td class="r cg-gold">doar 2</td><td class="r">scump</td></tr></table>
<p style="margin-top:10px">Dacă iei tu ultimul slot dintr-un aeroport mare, ceilalți <b>nu mai pot intra</b> acolo (decât cu 🏛️ Slot suplimentar sau după o extindere). Blocarea e o strategie!</p></div>
<div class="cg-txt"><h3><span class="ic">🥇</span>Bonusul de pionier</h3><p>Primul care construiește o pereche de orașe primește <b>+${pct(+tsub(["build", "pioneerDemand"], 0.2) || 0.2)} cerere timp de ${+tsub(["build", "pioneerDays"], 12) || 12} zile</b>, <b>atractivitate mai mare</b> față de cei care vin după el (cu atât mai mare cu cât piața e mai bogată) și <b>reputație</b>. Și alte companii pot construi apoi aceeași rută — atunci vă împărțiți pasagerii (vezi „Prețuri și cota de piață”).</p>
<h3><span class="ic">🏢</span>Hub</h3><p>Într-un aeroport unde ești deja prezent poți cumpăra un <b>hub</b> (scump). Îți dă: <b>taxe de aterizare mai mici</b> acolo, <b>bonus de tranzit ×1,5</b> și <b>+1 slot rezervat</b>.</p>
<h3><span class="ic">🔁</span>Tranzit</h3><p>Dacă zbori A–H și H–X, primești și pasageri care vor de la A la X (cam ${pct(+tsub(["demand", "transitShare"], 0.25) || 0.25)} din cererea acelei perechi), care îți umplu ambele zboruri. Un hub nu e un hangar: e un centru de legături.</p>
<h3><span class="ic">🚪</span>Porți</h3><p>Porțile de la sol sunt <b>comune tuturor</b>: ${(() => { const g = tsub(["gates", "bySize"], [0, 3, 6, 10]) || [0, 3, 6, 10]; return `mic ${g[1]}, mediu ${g[2]}, mare ${g[3]}`; })()} avioane deodată (mai multe la 3–4 jucători). Dacă sunt pline, avionul așteaptă (cel mult ${Math.round((+tsub(["gates", "maxWaitMin"], 180) || 180) / 60)} h). Le vezi în panoul aeroportului.</p></div></div>
<div class="cg-cols even"><div class="cg-txt"><h3><span class="ic">🔀</span>Rută cu escală (A → B → C)</h3><p>Un avion poate zbura pe <b>două rute ale tale</b> cu un oraș comun B: A → B → C și înapoi (Flotă → „Atribuie rută” → „Cu escală”, sau „Prelungește escala” din cardul avionului). Ia pasagerii fiecărei rute <b>plus</b> pe cei care merg direct A → C (~${pct(+tsub(["chain", "share"], 0.3) || 0.3)} din cererea A–C) — dar numai dacă drumul e aproape drept: la un ocol de ${String(+tsub(["chain", "maxDetour"], 1.6) || 1.6).replace(".", ",")}× distanța directă nu mai vine nimeni. Escala costă ${+tsub(["chain", "stopMin"], 30) || 30} min și o taxă de aterizare în B, iar dacă cineva zboară direct A–C primești mult mai puțini.</p></div>
<div class="cg-ex"><h4><span class="tag">Exemplu</span>Bună vs. proastă</h4><p class="cg-txt" style="margin:0;color:#cdd9ee">✅ <b>Atena → Roma → Londra</b>: aproape în linie dreaptă → +73 pasageri/zi prin escală, ~+98.000 €/zi.<br>❌ <b>Atena → Roma → București</b> cu un Skyliner 350: ocol mare, niciun pasager direct, avion prea mare pentru ruta subțire → <b class="cg-neg">pierdere la fiecare zbor</b>. În antrenament le vezi pe amândouă, cu rezultatul real a doua zi.</p></div></div>
<div class="cg-tip ok"><span class="i">🧭</span><div><b>Truc:</b> construiește întâi rute scurte și ieftine din bază, ca să aduni bani și să-ți extinzi rețeaua — fiecare oraș nou deservit deschide permise noi pornind de acolo.</div></div>`);

  ch("avioane", "✈️", "Avioanele", hero({ cls: "", lead: `${planesInfo().length === 6 ? "Șase" : "Trei"} modele, de la naveta de 40 de locuri la gigantul intercontinental. Le cumperi noi, la mâna a doua sau în leasing.` }), () => {
    const P = planesInfo(), LS = tsub(["lease"], {}) || {}, ramp = [+LS.rampFromDay || 8, +LS.rampToDay || 12], own = Math.round((+LS.ownMult || 1.15) * 100);
    const PR = tsub(["permits"], {}) || {}, pmin = +PR.rangeMinKm || 3300, pmar = Math.round((+PR.rangeMargin || 0.1) * 100);
    const cards = P.map((p, i) => `<div class="cg-pcard"><div class="pic">${planeSide(p.k, [ME, OP, "#b9a3ff", "#7be07b", "#ffe83a", "#ff4fb0"][i % 6], 260)}</div><h4>${esc(p.n)}</h4><p>${p.d}</p>
<dl><dt>Locuri</dt><dd>${p.seats}</dd><dt>Autonomie</dt><dd>${thou(p.range)} km</dd><dt>Viteză</dt><dd>${p.speed} km/h</dd><dt>Preț nou</dt><dd>~${fmtE(p.price)}</dd>${p.lease ? `<dt>Leasing</dt><dd>${fmtE(p.lease)}/zi</dd>` : ""}<dt>Combustibil</dt><dd>${p.cost}</dd>${p.minSize > 1 ? `<dt>Aeroporturi</dt><dd>doar medii și mari</dd>` : ""}</dl></div>`).join("");
    return `<div class="cg-planes">${cards}</div>
<div class="cg-cols even"><div class="cg-txt"><h3><span class="ic">🛒</span>Cum obții avioane (fila 🛒 Avioane)</h3><ul>
<li><b>Nou</b> — prețul întreg, fiabil.</li><li><b>Second-hand</b> — piață de 4–6 avioane schimbată săptămânal: mai ieftine, dar mai vechi → <b>mai multe defecțiuni și întârzieri</b>, care îți scad reputația.</li>
<li><b>Leasing</b> — nimic de plătit acum, dar o <b>chirie zilnică</b>. În primele zile chiria e la jumătate, apoi crește treptat (zilele ${ramp[0]}–${ramp[1] - 1}) și e <b>100% din ziua ${ramp[1]}</b>. Îl poți <b>răscumpăra</b> oricând (meniul „⋯” → 🔑 Răscumpără), iar când chiria plătită ajunge la ~${own}% din prețul nou devine <b>automat al tău</b>. Până atunci nu adaugă nimic la valoarea companiei.</li>
<li><b>Vânzare</b> — primești valoarea depreciată (avioanele se învechesc și pierd din valoare).</li></ul>
<p>Un avion <b>nou</b> intră în valoarea companiei cu <b>tot prețul plătit</b> și pierde din valoare treptat. Unul cumpărat second-hand sau răscumpărat valorează cel mult cât ai dat pe el.</p></div>
<div class="cg-txt"><h3><span class="ic">📏</span>Autonomia contează</h3><p>Un avion poate zbura doar pe rute <b>mai scurte decât autonomia</b> lui. București–New York (~7.600 km) cere un Skyliner 350 (sau Cometa 230 până la 8.500 km); București–Viena (~850 km) merge perfect cu un Turbo 72.</p>
<p><b>Permisele urmează flota:</b> primești oferte de permise doar până la autonomia celui mai lung avion pe care îl ai (cumpărat sau în leasing) + ${pmar}% — minimum ${thou(pmin)} km. Vrei rute lungi? Ia întâi un avion cu rază mare.</p>
<p>Avionul potrivit pe ruta potrivită: un Skyliner pe jumătate gol pierde bani, un Turbo 72 mereu plin lasă pasageri pe aeroport.</p>
<p>Costurile zilnice: <b>întreținere</b> (mai mare la avioanele vechi și mari), <b>leasing</b>, <b>salarii piloți</b>.</p></div></div>`;
  });

  ch("zboruri", "🛫", "Îmbarcare și piloți", hero({ cls: "dusk", lead: "Pasagerii se adună la poartă. Tu decizi când pleacă avionul — sau lași un pilot să decidă." }), () => {
    const notes = [
      { n: 1, to: "tab", side: "l", html: "<b>Fila Flotă</b> — toate avioanele tale." },
      { n: 2, to: "bar", side: "l", html: "<b>Bara de îmbarcare</b> — câți pasageri sunt deja la bord." },
      { n: 3, to: "go", side: "r", html: "<b>🛫 Decolează</b> — avionul pleacă imediat, cu câți are." },
      { n: 4, to: "pilot", side: "r", html: "<b>Pilot</b> — pleacă singur când merită." },
      { n: 5, to: "profit", side: "r", html: "<b>Profitul zborului</b> — încasat la aterizare." },
      { n: 6, to: "assign", side: "l", html: "<b>Atribuie rută</b> — fiecare avion face naveta pe o singură rută." }
    ];
    return `${stageHTML(replicaFleet(), notes, { w: 380, h: 352 })}
<div class="cg-cols even"><div class="cg-txt"><h3><span class="ic">🧳</span>Cum se îmbarcă</h3><ol>
<li>Pasagerii sosesc <b>continuu</b> la aeroportul de plecare, într-o coadă a companiei tale pentru acea rută și direcție.</li>
<li>Avionul aflat la poartă îi urcă la bord până la numărul de locuri. Îmbarcarea durează minimum <b>~45 de minute de joc</b>.</li>
<li><b>Fără pilot</b>, avionul <b>așteaptă</b> până apeși <b>„Decolează”</b> — oricât de plin ar fi.</li>
<li>Pasagerii care așteaptă prea mult (cam o zi) pleacă supărați.</li></ol></div>
<div class="cg-txt"><h3><span class="ic">👨‍✈️</span>Pilotul automat</h3><p>Angajezi un pilot pe avion (salariu zilnic). Avionul pleacă singur când:</p><ul>
<li>e <b>plin</b>, sau</li><li>are destui pasageri ca zborul să fie <b>profitabil</b> (cel puțin ~${pct(+tsub(["planes", "pilotMinLoad"], 0.6) || 0.6)} plin) și a așteptat cel puțin ${+tsub(["planes", "pilotMinWaitMin"], 60) || 60} de minute, sau</li><li>a așteptat <b>${Math.round((+tsub(["planes", "maxWaitPilotMin"], 360) || 360) / 60)} ore de joc</b>.</li></ul>
<p><b>Minimul pilotului</b> (cursorul din „Angajează pilot” sau meniul „⋯”): alegi tu de la câți pasageri pleacă. Linia roșie e <b>pragul de profit</b> — sub ea cifra „un zbor” devine <b class="cg-neg">roșie</b> (pierdere), peste ea <b class="cg-pos">verde</b>. După ce minimul e atins, pilotul mai așteaptă cel mult ${+tsub(["planes", "pilotSmartMaxMin"], 75) || 75} de minute dacă vin repede pasageri. Un avion care nu-și atinge minimul apare „sub prag”.</p>
<p><b>Mai multe avioane pe aceeași rută</b> stau <b>la rând</b>: cel de la poartă ia pasagerii și pleacă la minimul lui, apoi se îmbarcă următorul — nu pleacă toate pe jumătate goale. Ruta îți arată „3 avioane · ideal 2”.</p></div></div>
<div class="cg-cols even"><div class="cg-txt"><h3><span class="ic">🧮</span>Estimarea la atribuire (gratuită)</h3>
<p>Când pui un avion pe o rută (butonul <b>„Atribuie rută”</b> din fila Flotă sau <b>„Pune un avion pe rută”</b> din fereastra rutei), fiecare variantă îți arată doar două cifre:</p>
<ul><li><b>profitul estimat pe zi</b> al acelui avion pe rută — <b class="cg-pos">verde</b> dacă câștigi, <b class="cg-neg">roșu</b> dacă pierzi;</li><li><b>cât de plin</b> va zbura, de exemplu „~45% plin”.</li></ul>
<p>Dacă un alt avion <b>de-al tău</b> s-ar potrivi clar mai bine, apare un singur rând, de exemplu „Turbo 72 ar fi mai potrivit aici”. Aceeași estimare apare și în fereastra rutei, când schimbi prețul.</p>
<p style="color:#8ea3c4;font-size:13.5px">Estimarea nu ține locul consultantului: nu spune nimic despre adversari și nu îți dă strategii — doar cifrele avionului tău.</p></div>
<div class="cg-ex"><h4><span class="tag">Exemplu</span>Atribuie ruta · Aero 320 „Carpați”</h4><div class="cg-estl">
<div class="o on"><div class="g"><b>București ⇄ Viena</b><small>850 km · 2 avioane</small></div><div class="e"><b class="cg-neg">−6.400 €/zi</b><small>~38% plin</small></div></div>
<div class="o"><div class="g"><b>București ⇄ Londra</b><small>2.100 km · 1 avion</small></div><div class="e"><b class="cg-pos">+42.800 €/zi</b><small>~81% plin</small></div></div>
<div class="o"><div class="g"><b>București ⇄ Dubai</b><small>3.300 km · 1 avion</small></div><div class="e"><b class="cg-pos">+18.900 €/zi</b><small>~64% plin</small></div></div>
<div class="fit">💡 Turbo 72 „Brașov” ar fi mai potrivit aici.</div></div>
<p style="margin:10px 0 0;color:#8ea3c4;font-size:12.5px">Cifre ilustrative. Pe o rută scurtă și mică, un avion mare zboară pe jumătate gol și pierde bani.</p></div></div>
<div class="cg-ex"><h4><span class="tag">Exemplu</span>Cât durează un zbor</h4><p class="cg-txt" style="margin:0;color:#cdd9ee">Durata = distanța ÷ viteză + 30 min (decolare și aterizare). București → Londra ≈ 2.100 km cu un Aero 320 (840 km/h): 2.100 ÷ 840 = 2,5 h + 0,5 h = <b class="cg-gold">3 ore de joc</b>. Într-o zi „Normal” (1 minut real), asta înseamnă cam <b>7–8 secunde reale</b>.</p></div>`;
  });

  ch("preturi", "💶", "Prețuri și cota de piață", hero({ cls: "gold", lead: "Tu fixezi prețul biletului pe fiecare rută și direcție. Cu cât ești mai ieftin și mai bine cotat, cu atât iei mai mulți pasageri — dar câștigi mai puțin pe fiecare." }), () => {
    const notes = [
      { n: 1, to: "dem", side: "l", html: "<b>Cererea zilnică</b> pe rută și partea ta din ea." },
      { n: 2, to: "pres", side: "r", html: "<b>Ieftin / Normal / Premium</b> — 0,75× · 1× · 1,4× prețul normal." },
      { n: 3, to: "rec", side: "l", html: "<b>Recomandat</b> — prețul care îți umple bine avioanele (cel puțin ~55%)." }
    ];
    return `<div class="cg-cols even"><div>${stageHTML(replicaPopup(), notes, { w: 330, h: 160 })}</div>
<div class="cg-txt"><h3><span class="ic">🏷️</span>Prețul e liber</h3><p>Poți pune <b>orice preț</b> (de la 1 € la 10× prețul normal), oricând, separat pe fiecare direcție sau pe amândouă deodată. Butoanele rapide: <b>Ieftin</b> ≈ 0,75×, <b>Normal</b> (calculat după distanță), <b>Premium</b> ≈ 1,4×.</p>
<h3><span class="ic">⚖️</span>Cota de piață</h3><p>Dacă mai multe companii zboară pe aceeași rută, pasagerii se împart după <b>atractivitate</b>:</p>
<div class="cg-formula">A = (<em>preț</em> ÷ normal)<sup>−${String(EPS()).replace(".", ",")}</sup> × frecvență × (1 + 0,15 × (<em>stele</em> − 3)) × pionier</div>
<p style="margin-top:8px">Cota ta = A-ul tău ÷ suma tuturor A-urilor. Prețul contează <b>mult</b> (exponentul ${String(EPS()).replace(".", ",")}), stelele cam 15% fiecare, iar mai multe avioane pe rută (frecvență) atrag și ele.</p></div></div>
<div class="cg-ex" data-calc="share"><h4><span class="tag">Calculator</span>Tu contra ${esc(RV.name)} pe București – Londra (cerere 400 pasageri/zi, normal 200 €)</h4>
<div class="cg-cols even"><div class="cg-calc">
<div class="cg-slider"><span>Prețul tău</span><input type="range" min="100" max="400" step="5" value="180" data-k="myp" aria-label="Prețul tău"><output data-o="myp">180 €</output></div>
<div class="cg-slider"><span>Stelele tale</span><input type="range" min="1" max="5" step="1" value="4" data-k="mys" aria-label="Stelele tale"><output data-o="mys">★★★★</output></div>
<div class="cg-slider"><span>Prețul ${esc(RV.name)}</span><input type="range" min="100" max="400" step="5" value="220" data-k="opp" aria-label="Prețul ${esc(RV.name)}"><output data-o="opp">220 €</output></div>
<div class="cg-slider"><span>Stelele ${esc(RV.name)}</span><input type="range" min="1" max="5" step="1" value="3" data-k="ops" aria-label="Stelele ${esc(RV.name)}"><output data-o="ops">★★★</output></div>
<div class="cg-bars" style="margin-top:6px"><div class="cg-bar"><span>Tu</span><div class="t"><i data-b="me" style="background:linear-gradient(90deg,#ff8a4c,#ffb36b)"></i></div><b data-o="shme">62%</b></div>
<div class="cg-bar"><span>${esc(RV.name)}</span><div class="t"><i data-b="op" style="background:linear-gradient(90deg,#5fd3dc,#9be8ee)"></i></div><b data-o="shop">38%</b></div></div></div>
<table class="cg-tab" data-t="share"></table></div></div>
<div class="cg-tip"><span class="i">🎯</span><div>Ieftin nu înseamnă automat mai bine: dacă avionul tău are 180 de locuri și primești 300 de pasageri, ceilalți 120 pleacă. Pune prețul cât să-ți <b>umpli avioanele</b>, nu mai jos. Prețul <b>recomandat</b> țintește cel puțin ~55% grad de umplere; dacă pe o rută nici prețul cel mai mic nu umple avionul, vezi mesajul „prea multe locuri pentru cererea de aici” — pune un avion mai mic.</div></div>
<div class="cg-cols even"><div class="cg-tip warn"><span class="i">📉</span><div><b>Prea scump = fără pasageri.</b> Peste Premium (${String(+tsub(["demand", "priceKneeMult"], 1.4) || 1.4).replace(".", ",")}× normal) cererea totală se prăbușește — oamenii aleg trenul sau nu mai zboară, chiar dacă ești singur pe rută. Și reputația scade dacă ceri peste ${String(+tsub(["rep", "priceGougeMult"], 3) || 3).replace(".", ",")}× normal.</div></div>
<div class="cg-tip ok"><span class="i">🌎</span><div><b>Piețe bogate:</b> prețul normal depinde de regiune — Europa de Vest și America de Nord plătesc mult mai mult decât piețele modeste de unde pornești, iar rutele <b>intercontinentale</b> au încă ×${String(+tsub(["price", "intercontPrem"], 1.35) || 1.35).replace(".", ",")}. Strategia: faci bani aproape de casă, apoi te extinzi acolo.</div></div></div>`;
  }, (el) => {
    const box = el.querySelector('[data-calc="share"]'); if (!box) return;
    const g = k => +box.querySelector(`[data-k="${k}"]`).value;
    const upd = () => {
      const myp = g("myp"), mys = g("mys"), opp = g("opp"), ops = g("ops"), N = 200, Dm = 400;
      const am = attract(myp, N, mys), ao = attract(opp, N, ops), s = am / (am + ao);
      box.querySelector('[data-o="myp"]').textContent = myp + " €"; box.querySelector('[data-o="opp"]').textContent = opp + " €";
      box.querySelector('[data-o="mys"]').textContent = "★".repeat(mys); box.querySelector('[data-o="ops"]').textContent = "★".repeat(ops);
      box.querySelector('[data-b="me"]').style.width = (s * 100) + "%"; box.querySelector('[data-b="op"]').style.width = ((1 - s) * 100) + "%";
      box.querySelector('[data-o="shme"]').textContent = pct(s); box.querySelector('[data-o="shop"]').textContent = pct(1 - s);
      const pm = Math.round(Dm * s), po = Dm - pm;
      const f = v => v.toFixed(2).replace(".", ",");
      box.querySelector('[data-t="share"]').innerHTML = `<tr><th></th><th class="r">Tu</th><th class="r">${esc(RV.name)}</th></tr>
<tr><td>Preț ÷ normal</td><td class="r">${f(myp / N)}</td><td class="r">${f(opp / N)}</td></tr>
<tr><td>Factor preț</td><td class="r">${f(Math.pow(myp / N, -EPS()))}</td><td class="r">${f(Math.pow(opp / N, -EPS()))}</td></tr>
<tr><td>Factor stele</td><td class="r">${f(1 + .15 * (mys - 3))}</td><td class="r">${f(1 + .15 * (ops - 3))}</td></tr>
<tr><td>Atractivitate A</td><td class="r">${f(am)}</td><td class="r">${f(ao)}</td></tr>
<tr><td>Cota</td><td class="r cg-gold">${pct(s)}</td><td class="r">${pct(1 - s)}</td></tr>
<tr><td>Pasageri / zi</td><td class="r">${pm}</td><td class="r">${po}</td></tr>
<tr class="tot"><td>Încasări / zi</td><td class="r cg-pos">${fmtE(pm * myp)}</td><td class="r">${fmtE(po * opp)}</td></tr>`;
      const shp = el.querySelector('[data-v="shp"]'); if (shp) shp.textContent = pct(s);
      const mp = el.querySelector('[data-v="myp"]'); if (mp) mp.textContent = myp + " €";
    };
    box.addEventListener("input", upd); upd();
  });

  ch("profit", "📊", "Profitul unui zbor", hero({ cls: "green", lead: "Banii intră la aterizare: pasageri × preț. Din ei scazi combustibilul, taxele de aeroport și echipajul." }), () => `
<div class="cg-cols even"><div class="cg-txt"><h3><span class="ic">💶</span>Ce câștigi și ce plătești</h3><ul>
<li><b>Venit</b> (la aterizare) = pasageri × prețul biletului.</li><li><b>Combustibil</b> = km × costul pe km al avionului × indicele prețului petrolului (urcă și coboară cu evenimentele).</li>
<li><b>Taxe de aterizare</b> — după mărimea aeroportului (mai mici în hubul tău).</li><li><b>Echipaj</b> pe zbor.</li></ul>
<p>La <b>sfârșitul zilei</b> se plătesc separat: întreținerea avioanelor, leasingul, salariile piloților și ratele la bancă. ${(() => { const C = tsub(["company"], {}) || {}; return `Tot atunci se plătește și <b>impozitul pe profit</b> — doar pentru liderul care fuge departe: <b>${pct(+C.profitTaxRate || 0.4)}</b> din profitul zilei peste <b>${fmtE(+C.profitTaxFree || 1e7)}</b> sau peste ${String(+C.profitTaxRelMult || 1.4).replace(".", ",")} × profitul mediu de ieri al rivalilor (pragul mai mare). Companiile obișnuite nu-l plătesc.`; })()}</p>
<h3><span class="ic">🧾</span>Net, nu doar zboruri</h3><p>Fereastra rutei arată mare <b>„Ruta asta: ±X €/zi (net)”</b> — profitul zborurilor <b>minus</b> costurile fixe ale avioanelor de pe ea. O rută poate avea zboruri pe plus și totuși să piardă bani pe zi.</p>
<h3><span class="ic">⚖️</span>Pragul de rentabilitate</h3><p>Numărul minim de pasageri ca zborul să nu piardă bani. Sub prag, mai bine aștepți să se umple (sau scazi prețul).</p></div>
<div class="cg-ex" data-calc="flight"><h4><span class="tag">Exemplu</span>Aero 320, București → Londra (2.100 km), bilet 210 €</h4>
<div class="cg-slider"><span>Pasageri</span><input type="range" min="0" max="180" step="1" value="150" data-k="pax" aria-label="Pasageri la bord"><output data-o="pax">150</output></div>
<table class="cg-tab" data-t="fl" style="margin-top:8px"></table>
<div class="cg-bars" style="margin-top:10px"><div class="cg-bar"><span>Grad de umplere</span><div class="t"><i data-b="load" style="background:linear-gradient(90deg,#ff8a4c,#ffd35c)"></i><i data-b="be" style="width:2px;left:0;background:#fff;border-radius:0"></i></div><b data-o="load">83%</b></div></div>
<p style="margin:8px 0 0;color:#8ea3c4;font-size:12.5px">Cifre rotunjite, ca ilustrare. Linia albă = pragul de rentabilitate.</p></div></div>
<div class="cg-tip"><span class="i">📈</span><div>În fila <b>📊 Rapoarte</b> vezi graficul profitului pe zile și cele mai bune rute. Iar consultantul îți spune când o rută are prea multe locuri goale.</div></div>`, (el) => {
    const box = el.querySelector('[data-calc="flight"]'); if (!box) return;
    const upd = () => {
      const pax = +box.querySelector('[data-k="pax"]').value, price = 210, fuel = 2100 * 6, fees = 1800, crew = 1200, cost = fuel + fees + crew, rev = pax * price, pr = rev - cost, be = Math.ceil(cost / price);
      box.querySelector('[data-o="pax"]').textContent = pax;
      box.querySelector('[data-t="fl"]').innerHTML = `<tr><td>Venit: ${pax} × 210 €</td><td class="r cg-pos">${fmtE(rev)}</td></tr>
<tr><td>Combustibil: 2.100 km × 6 €/km</td><td class="r cg-neg">−${fmtE(fuel)}</td></tr><tr><td>Taxe aterizare (aeroport mare)</td><td class="r cg-neg">−${fmtE(fees)}</td></tr><tr><td>Echipaj</td><td class="r cg-neg">−${fmtE(crew)}</td></tr>
<tr class="tot"><td>Profit pe zbor</td><td class="r ${pr >= 0 ? "cg-pos" : "cg-neg"}">${fmtE(pr, true)}</td></tr>
<tr><td>Prag de rentabilitate</td><td class="r cg-gold">${be} pasageri (${pct(be / 180)})</td></tr>`;
      box.querySelector('[data-b="load"]').style.width = (pax / 180 * 100) + "%"; box.querySelector('[data-b="be"]').style.left = (be / 180 * 100) + "%";
      box.querySelector('[data-o="load"]').textContent = pct(pax / 180);
    };
    box.addEventListener("input", upd); upd();
  });

  ch("draft", "🃏", "Draftul de seară", hero({ cls: "night", lead: "La sfârșitul fiecărei zile ceasul se oprește. Pe masă stau cărți cu fața în jos — alegeți pe rând, pe ghicite." }), () => {
    const faces = ["apr", "joker", "comb", "freeze", "inf", "ech", "apr", "boom", "comb", "inf", "ech", "apr", "rapid"];
    const who = { 1: RV.name, 3: "Tu", 7: "Bot" };
    const cards = faces.map((k, i) => `<div class="r-dc${who[i] ? " f taken" : ""}" data-i="${i}" title="Click ca să întorci"><div>${cardBack(62)}</div><div class="fr">${cardFace(k, 62)}${who[i] ? `<span class="who">${who[i]}</span>` : ""}</div></div>`).join("");
    return `<div class="cg-cols wide"><div class="cg-txt"><h3><span class="ic">🌙</span>Cum merge</h3><ol>
<li>Pe masă sunt <b>3 × N + 4</b> cărți cu fața în jos (N = jucători activi). La 3 jucători: 13 cărți.</li>
<li>Primul alege cel cu <b>cea mai mică valoare a companiei</b>, apoi ordinea merge „șarpe” (dus-întors).</li>
<li>Fiecare ia <b>3 cărți</b>, câte una pe rând. Ai <b>10 secunde</b>; dacă nu alegi, se alege la întâmplare.</li>
<li>Fiecare carte luată se întoarce și o vede toată lumea.</li>
<li>La final se întorc și cărțile rămase — <b>„ce ați ratat”</b>.</li>
<li>Apoi se face <b>socoteala zilei</b> (costuri zilnice, dobânzi, rate, verificare faliment, evenimente) și începe ziua următoare.</li></ol>
<p>Dacă ai <b>consultant</b>, uneori îți șoptește ce e sub o carte înainte să alegi.</p></div>
<div class="cg-r r-draft" style="border-radius:18px"><div class="hd"><span class="r-chip">${rAv(RV.av, OP)}${esc(RV.name)} <em>1</em></span><span class="r-chip on">${rAv(VW.av)}Tu <em>2</em></span><span class="r-chip">${rAv(2, "#b9a3ff")}Bot <em>3</em></span></div>
<div style="font:700 13px system-ui;color:#ffe9b0">Rândul tău · alege o carte</div><div class="r-timer"><i></i></div>
<div class="r-dgrid" data-draft>${cards}</div><div style="font-size:12px;color:#cfe">Încearcă: dă click pe o carte ca s-o întorci.</div></div></div>
<div class="cg-ex"><h4><span class="tag">Exemplu</span>Ordinea „șarpe” la 3 jucători</h4>
<p class="cg-txt" style="margin:0;color:#cdd9ee">Valori: ${esc(RV.name)} 48 M €, tu 63 M €, Bot 70 M € → ordinea: <b>${esc(RV.name)} → Tu → Bot → Bot → Tu → ${esc(RV.name)} → ${esc(RV.name)} → Tu → Bot</b>. Cine e în urmă alege primul — așa nimeni nu fuge prea departe.</p></div>`;
  }, (el) => {
    const g = el.querySelector("[data-draft]"); if (!g) return;
    g.addEventListener("click", e => { const c = e.target.closest(".r-dc"); if (c && !c.classList.contains("taken")) c.classList.toggle("f"); });
    // reduce grid on phones
    const fix = () => { const w = g.parentElement.getBoundingClientRect().width; g.style.gridTemplateColumns = `repeat(${w < 420 ? 4 : w < 560 ? 5 : 7},62px)`; };
    fix(); return fix;
  });

  ch("banca", "🏦", "Bancă și faliment", hero({ cls: "night", lead: "Banca te ajută să crești repede — dar fiecare zi de datorie costă. Banii negativi prea mult timp înseamnă faliment." }), () => {
    const limitVal = 63.2e6, debt = 5e6;
    return `<div class="cg-cols even"><div class="cg-txt"><h3><span class="ic">🏦</span>Creditul bancar</h3><ul>
<li>Îl iei <b>oricând</b>, fără pauză de joc (butonul 🏦 Bancă).</li><li><b>Limita</b> = ${pct(+tsub(["bank", "limitFrac"], 0.4) || 0.4)} din valoarea companiei (ajustat după scorul de credit) − datoria actuală; minimum ${fmtE(+tsub(["bank", "minLimit"], 3e6) || 3e6)}.</li>
<li>Termen: <b>${BANKT().join(", ")} de zile</b>; plătești o <b>rată zilnică</b> cu dobândă (${BANKT().map(d => `${d} zile: ${String(Math.round(BANKR(d) * 1000) / 10).replace(".", ",")}%/zi`).join(" · ")}). Termenul lung (${BANKT()[BANKT().length - 1]} zile) e pentru extinderea flotei la mijlocul jocului: rată mică pe zi, dar dobândă totală mare.</li><li>Rambursarea mai devreme e <b>gratuită</b>.</li>
<li><b>Scorul de credit</b>: zilele cu bani negativi sau ratele întârziate îți scad limita și îți urcă dobânda.</li></ul>
<h3><span class="ic">💀</span>Falimentul</h3><p>Dacă banii devin negativi apare un avertisment roșu: ai <b>5 zile de joc</b> să revii pe plus. Dacă după 5 zile ești tot pe minus, sau datoria trece de limită → <b>faliment</b>: avioanele sunt confiscate și compania iese din joc. La 3–4 jucători, partida continuă pentru ceilalți.</p><p><b>Datoriile la faliment:</b> întâi se scad datoriile reciproce dintre jucători. Apoi, din banii și avioanele lui, se plătesc <b>întâi jucătorii</b> care i-au împrumutat bani (proporțional, dacă nu ajunge); banca ia doar ce rămâne. Dacă tu îi datorai lui, plătești în continuare la scadență.</p></div>
<div class="cg-ex" data-calc="loan"><h4><span class="tag">Calculator</span>Un credit pentru un Aero 320</h4>
<div class="cg-slider"><span>Sumă</span><input type="range" min="1" max="26" step="0.5" value="10" data-k="amt" aria-label="Suma creditului"><output data-o="amt">10 M €</output></div>
<div class="cg-slider"><span>Termen</span><div class="cg-seg" data-k="days">${BANKT().map(d => `<button data-d="${d}"${d === 20 ? ' class="on"' : ""}>${d} zile</button>`).join("")}</div><span></span></div>
<table class="cg-tab" data-t="loan" style="margin-top:8px"></table>
<p style="margin:8px 0 0;color:#8ea3c4;font-size:12.5px">Limita ta în exemplu: ${pct(+tsub(["bank", "limitFrac"], 0.4) || 0.4)} × ${fmtE(limitVal)} − ${fmtE(debt)} = <b class="cg-gold">${fmtE(limitVal * (+tsub(["bank", "limitFrac"], 0.4) || 0.4) - debt)}</b>. Calcul simplificat; dobânda exactă depinde de scorul tău de credit.</p></div></div>
<div class="cg-tip warn"><span class="i">⚠️</span><div>Rata se plătește în fiecare seară, chiar dacă ruta nouă încă nu aduce bani (cererea pornește de la ${pct(RAMP0())}). Ia credit doar pentru avioane care au deja pasageri care le așteaptă.</div></div>`;
  }, (el) => {
    const box = el.querySelector('[data-calc="loan"]'); if (!box) return;
    let days = 20;
    const upd = () => {
      const amt = +box.querySelector('[data-k="amt"]').value * 1e6, r = BANKR(days);
      const interest = amt * r * days, tot = amt + interest, daily = tot / days;
      box.querySelector('[data-o="amt"]').textContent = fmtE(amt);
      box.querySelectorAll('[data-d]').forEach(b => b.classList.toggle("on", +b.dataset.d === days));
      box.querySelector('[data-t="loan"]').innerHTML = `<tr><td>Împrumuți</td><td class="r">${fmtE(amt)}</td></tr><tr><td>Dobândă: ${String(r * 100).replace(".", ",")}% × ${days} zile</td><td class="r cg-neg">${fmtE(interest)}</td></tr>
<tr><td>Total de dat înapoi</td><td class="r">${fmtE(tot)}</td></tr><tr class="tot"><td>Rată zilnică</td><td class="r cg-gold">${fmtE(daily)}</td></tr>`;
    };
    box.addEventListener("input", upd);
    box.addEventListener("click", e => { const b = e.target.closest("[data-d]"); if (b) { days = +b.dataset.d; upd(); } });
    upd();
  });

  ch("negociere", "🤝", "Negocieri și pacte", hero({ cls: "dusk", lead: "Deschide o negociere și timpul se oprește pentru toată lumea. Doi directori, un birou și orice se poate pune pe masă." }), () => {
    const off = office();
    return `<div class="cg-office">${off}<div class="av a">${art("avatar", [VW.av, 220, "smug", { bg: false }], avatar(VW.av, 220, "smug", ME))}</div><div class="av b">${art("avatar", [RV.av, 220, "thinking", { bg: false, flip: true }], avatar(5, 220, "thinking", OP))}</div>
<div class="bub a">„Îți dau ruta Viena–Londra + 3 M €…”</div><div class="bub b">„…și un pact de 5 zile fără înghețări?”</div>
<div class="hs">${handshake(120)}</div>
<div class="tbl"><span class="it">💶 3 M €</span><span class="it">🛣️ Viena–Londra</span><span class="it b">🃏 2× Combustibil</span><span class="it b">🕊️ Pact 5 zile</span></div></div>
<div class="cg-cols even"><div class="cg-txt"><h3><span class="ic">🤝</span>Cum negociezi</h3><ol>
<li>Apeși <b>🤝 Negociază</b> și alegi un singur jucător. Poți deschide <b>o negociere pe zi de joc</b>; durează maximum <b>2 minute reale</b>.</li>
<li>Timpul se oprește pentru toți; ceilalți văd „${esc(VW.name)} și ${esc(RV.name)} negociază…”.</li>
<li>Fiecare pune pe masă ce oferă: <b>bani, cărți normale, cărți speciale, permise deschise, rute construite</b> (cu sloturile lor; avioanele rămân la tine), <b>sloturi, avioane, pact, împrumut</b>.</li>
<li>Răspunsuri: <b>Accept</b> (strângere de mână), <b>Refuz</b> sau <b>Contraofertă</b>. Ai și fraze rapide și emoji.</li>
<li>La 3–4 jucători poți <b>invita un al treilea</b> la masă, din birou. Ceilalți sunt <b>spectatori</b>: văd biroul și ce se pune pe masă, dar nu pot oferi nimic; timpul stă și pentru ei.</li></ol></div>
<div class="cg-txt"><h3><span class="ic">🕊️</span>Pactul de neagresiune</h3><p>Pe N zile de joc nu vă puteți îngheța unul pe altul — jocul chiar îl impune.</p>
<h3><span class="ic">💸</span>Împrumut între jucători</h3><p>„<b>Cere împrumut</b>” deschide aceeași scenă, completată. Suma e cel mult cât are cel care împrumută; stabiliți suma de returnat și termenul. La termen banii se iau <b>automat</b> — chiar dacă cel împrumutat ajunge pe minus. Când alegi suma vezi un indiciu de <b>risc mic / mediu / mare</b>: (suma + datoriile celui care împrumută) față de valoarea companiei lui (sub ${pct((tsub(["loanRisk", "levels"], [0.25, 0.6]) || [0.25])[0])} mic, peste ${pct((tsub(["loanRisk", "levels"], [0.25, 0.6]) || [0, 0.6])[1])} mare).</p>
<div class="cg-ex" style="margin-top:8px"><h4><span class="tag">Exemplu</span>${esc(RV.name)} îți împrumută 5 M €</h4><p style="margin:0;color:#cdd9ee">Returnezi <b>5,6 M €</b> în <b>8 zile</b>. ${esc(RV.name)} câștigă 0,6 M € (≈1,5% pe zi — mai scump decât banca, dar fără limită de credit și fără scor).</p></div></div></div>`;
  });

  ch("speciale", "✨", "Cărțile speciale", hero({ cls: "ice", lead: "37 de cărți rare, în rezervă comună pentru toată partida. După ce o joci, se întoarce în rezervă după 10 zile de joc." }), () => {
    const items = SPECIALS.map(([k, cnt, lim, fb]) => {
      const t = cardText(k, fb);
      return `<div class="cg-sp1">${cardFace(k, 96)}<div><h4>${esc(t.name)} <small>×${cnt}${lim ? " · " + lim : ""}</small></h4><p>${t.text}</p></div></div>`;
    }).join("");
    return `<div class="cg-spec">${items}</div>
<div class="cg-cols even"><div class="cg-tip"><span class="i">❄️</span><div><b>Înghețul pe larg:</b> compania înghețată nu poate face nimic timp de 30 de secunde reale (poate doar să privească și să joace 🔥). Avioanele ei stau pe loc chiar și în aer. Pe rutele pe care le aveți în comun, <b>toată cererea nouă vine la cel care a înghețat</b>.</div></div>
<div class="cg-tip ok"><span class="i">🃏</span><div>Cărțile speciale vin doar din <b>draft</b> și din tragerile norocoase (6%). Nu se pot cumpăra. Folosești una din bara de jos cu <b>„Folosește”</b>; 🔥 Spărgătorul se oferă singur când ești înghețat.</div></div></div>`;
  });

  ch("evenimente", "🌋", "Evenimente", hero({ cls: "dusk", lead: "Lumea nu stă pe loc: vulcani, greve, sezoane, campionate mondiale și crize ale petrolului schimbă cererea și costurile." }), () => {
    const ev = eventsList().map(e => `<div class="cg-ev"><span class="e">${e[0]}</span><div><b>${e[1]}</b><span>${e[2]}</span></div></div>`).join("");
    return `<div class="cg-evs">${ev}</div>
<div class="cg-cols even"><div class="cg-txt"><h3><span class="ic">🎲</span>Când apar</h3><p>La socoteala de la sfârșitul zilei se trag evenimentele noi (de la ziua ${+tsub(["events", "firstDay"], 3) || 3}). Cele locale cad aproape mereu <b>unde zboară jucătorii</b>, nu în colțuri ale lumii unde nu e nimeni. Câte apar (puține / normale / multe) se <b>votează la începutul partidei</b>. Apar ca anunț și ca bandă pe hartă, cu durata lor; <b>click pe bandă</b> deschide cardul evenimentului, cu „<b>Ce poți face</b>”.</p></div>
<div class="cg-txt"><h3><span class="ic">🧯</span>Cum te aperi</h3><p><b>🧯 Asigurarea</b> anulează un eveniment negativ care te lovește. O rețea pe mai multe continente te protejează de ghinion local. În modul <b>„Fără timp”</b>, după ziua 60 crizele se înăspresc (petrol mai scump, taxe mai mari).</p></div></div>`;
  });

  ch("bursa", "📈", "Bursa", hero({ cls: "green", lead: "Fiecare companie are 100 de acțiuni. Poți cumpăra până la 49 din compania unui adversar — și câștigi când el crește." }), () => `
<div class="cg-cols even"><div class="cg-txt"><h3><span class="ic">📈</span>Regulile</h3><ul>
<li>Prețul unei acțiuni = <b>valoarea companiei ÷ 100</b>, plus un comision de <b>2%</b>.</li><li>Poți deține <b>cel mult 49</b> de acțiuni dintr-o companie străină.</li>
<li>Proprietarul își poate <b>răscumpăra</b> acțiunile.</li><li>La final, acțiunile valorează același procent din valoarea finală a acelei companii.</li>
<li>Cumpărarea nu „fură” valoare: banii pe care o companie îi primește din vânzarea propriilor acțiuni rămân doar ai ei și nu intră în ce dețin acționarii. Câștigi doar dacă firma crește după ce ai cumpărat.</li></ul>
<p>Bursa e o asigurare: dacă ${esc(RV.name)} fuge înainte, câștigi și tu din succesul ei.</p></div>
<div class="cg-ex"><h4><span class="tag">Exemplu</span>Cumperi 20 de acțiuni ${esc(RV.co)}</h4><table class="cg-tab">
<tr><td>Valoarea ${esc(RV.co)} acum</td><td class="r">80 M €</td></tr><tr><td>Preț pe acțiune (80 M ÷ 100)</td><td class="r">800.000 €</td></tr>
<tr><td>20 acțiuni + 2% comision</td><td class="r cg-neg">−16,32 M €</td></tr><tr><td>Valoarea finală ${esc(RV.co)}</td><td class="r">120 M €</td></tr>
<tr class="tot"><td>Cele 20% ale tale la final</td><td class="r cg-pos">24 M €</td></tr><tr><td>Câștig</td><td class="r cg-gold">+7,68 M €</td></tr></table></div></div>`);

  ch("investitii", "🏗️", "Investiții", hero({ cls: "dusk", lead: "Spre mijlocul și finalul partidei banii se adună. Investițiile îi transformă în avantaje permanente — și contează și la evaluarea finală." }), () => {
    const I = invInfo(), P = n => fmtE(n), pc = v => Math.round(v * 100) + "%";
    const bp = Array.isArray(I.base.price) ? I.base.price : [I.base.price], ep = Array.isArray(I.eco.price) ? I.eco.price : [I.eco.price, I.eco.price, I.eco.price];
    const pn = planesInfo().map(p => p.n);
    const items = [
      ["🏙️", "Extinde baza", `${bp.length} niveluri · de la ${P(bp[0])}`, `Nivelurile costă ${bp.map(P).join(" → ")}. La fiecare nivel: <b>+${pc(I.base.demand)} cerere</b> pe rutele care pleacă din bază, <b>+${I.base.slots} slot</b> în aeroportul bazei și <b>taxe de aterizare cu ${pc(I.base.fee)} mai mici</b> acolo.`],
      ["🛄", "Terminal propriu", `${P(I.term.price)} · max. ${I.term.max}`, `Într-un <b>aeroport mare</b> unde ai deja un slot. Rutele tale care trec prin el devin mai atractive (<b>cotă de piață mai mare</b>), iar reputația ta crește permanent.`],
      ["🌿", "Flotă eco", `pe tip de avion · de la ${P(Math.min(...ep))}`, `O singură dată pentru fiecare tip de avion: toate avioanele de acel tip consumă cu <b>${pc(I.eco.fuel)} mai puțin combustibil</b>. Prețuri: ${pn.map((n, i) => `${n} — ${P(ep[i])}`).join(", ")}.`],
      ["🔧", "Centru de mentenanță", `${P(I.mnt.price)} · o singură dată`, `Întreținere cu <b>${pc(I.mnt.maint)} mai ieftină</b>, <b>mai puține defecțiuni</b> și avioane care își pierd mai încet valoarea.`]
    ].map(([ic, n, pr, t]) => `<div class="cg-sp1"><span class="ico" aria-hidden="true">${ic}</span><div><h4>${n} <small>${pr}</small></h4><p>${t}</p></div></div>`).join("");
    return `<div class="cg-inv">${items}</div>
<div class="cg-cols even"><div class="cg-txt"><h3><span class="ic">🧭</span>Unde le găsești</h3><p>În fila <b>🏗️ Investiții</b> din panoul din dreapta (pe telefon, în <b>🛒 Avioane</b>). Fiecare investiție arată prețul și dacă o poți cumpăra acum; dacă nu, scrie pe scurt de ce (de exemplu: nu ai destui bani sau nu ai niciun slot într-un aeroport mare).</p>
<p>Nu poți investi cât timp jocul e pe pauză sau cât timp compania ta e înghețată.</p></div>
<div class="cg-txt"><h3><span class="ic">🏁</span>La final</h3><p>Investițiile nu se pot vinde. Valorează <b>cât ai plătit</b>, apoi pierd treptat <b>${pc(I.decay)} pe zi</b>, până la minim <b>${pc(I.valueMult)}</b>; la evaluarea finală intră cu cât valorează atunci. Așa că merită cumpărate <b>devreme</b>, cât au timp să aducă profit, nu în ultimele zile.</p></div></div>
<div class="cg-tip ok"><span class="i">💡</span><div><b>Ordinea bună:</b> întâi rute și avioane care se umplu. Investițiile sunt pentru banii pe care nu mai ai unde să-i pui cu folos — o bază extinsă ajută toate rutele din bază, iar Flota eco merită pentru tipul de avion pe care îl ai cel mai des.</div></div>`;
  });

  ch("unelte", "🧰", "Panouri, mesaje și scurtături", hero({ cls: "night", lead: "Unelte care îți scurtează drumul: panoul aeroportului, cardul avionului, flota cu filtre, anularea, raportul zilei și setările." }), () => {
    const us = +tsub(["undo", "sec"], 8) || 8, so = tsub(["startOpts"], {}) || {}, sc = +tsub(["start", "cash"], 2e7) || 2e7, cm = so.cash || { low: 0.6, normal: 1, high: 1.75 };
    const items = [
      ["🛬", "Panoul aeroportului", "click pe un aeroport", "Starea (prea multe avioane / echilibrat / avioane libere), <b>o singură sugestie cu cifre</b> (de ex. „+1 avion pe X–Y ≈ +40.000 €/zi”), avioanele tale la sol cu cât așteaptă, pasagerii care așteaptă pe fiecare rută, rutele posibile de acolo și, jos, sloturi / porți / hub / terminal."],
      ["✈️", "Cardul avionului", "click pe un avion în zbor", "Profitul <b>pe acest zbor</b>, pasagerii la bord, de unde → unde, ora sosirii, profitul pe zi. Butoane: Prelungește escala, Schimbă ruta, Minimul pilotului. Pe hartă se desenează doar avioanele în zbor; cele de la sol apar ca „✈ N” lângă aeroport."],
      ["🧮", "Flota: filtre și în bloc", "fila ✈️ Flotă", "Filtre: <b>pe minus · fără rută · sub prag · în leasing · în zbor · la sol</b>. Bifezi avioane (sau „Selectează toate”) și dai o comandă tuturor: pilot pornit/oprit, minim, mută pe rută, preț."],
      ["↩", "Anulează", `${us} secunde`, `Cumpărare / leasing, mutare pe rută, preț, slot sau construcție se pot anula din mesajul „↩ Anulează” timp de ${us} secunde. Nu mai merge după ce avionul a decolat, după altă acțiune a ta sau dacă un rival a atins aceeași rută.`],
      ["💬", "Mesaje scurte", "colțul ecranului", "Aterizare pe pierdere, <b>rival pe ruta ta</b> (cu butoane rapide [Schimbă prețul] [+1 avion]), bani pe minus, eveniment care te atinge, avion „sub prag”. Dispar singure; click pentru detalii."],
      ["📋", "Raportul zilei și Gazeta", "dimineața", "Raportul: cea mai bună și cea mai proastă rută, cât au crescut valoarea și banii, locul în clasament. <b>Gazeta Cerului</b>: un titlu amuzant din ce s-a întâmplat ieri. Sus, lângă bani și valoare, vezi ▲/▼ față de ieri."],
      ["😀", "Reacții", "bara de sus", "Un emoji sau o frază scurtă pe care o văd toți, ca balon lângă numele tău (cu măsură: câteva pe minut)."],
      ["⚙️", "Setări și taste", "⚙ din bara de sus", "Volum muzică / efecte / anunțuri, grafică (auto / simplă / bogată), text mai mare — salvate pe dispozitivul tău. Pe PC: <span class=\"cg-kbd\">Spațiu</span> pauză, <span class=\"cg-kbd\">F</span> flotă, <span class=\"cg-kbd\">R</span> rute, <span class=\"cg-kbd\">B</span> bancă, <span class=\"cg-kbd\">G</span> ghid, <span class=\"cg-kbd\">Esc</span> închide, <span class=\"cg-kbd\">?</span> lista."],
      ["🗳️", "Setări de start votate", "la masă, înainte de joc", `Pe lângă durată votați <b>banii de start</b> (${fmtE(sc * (+cm.low || 0.6))} / ${fmtE(sc * (+cm.normal || 1))} / ${fmtE(sc * (+cm.high || 1.75))}) și <b>câte evenimente</b> apar (puține / normale / multe).`]
    ].map(([ic, n, pr, t]) => `<div class="cg-sp1"><span class="ico" aria-hidden="true">${ic}</span><div><h4>${n} <small>${pr}</small></h4><p>${t}</p></div></div>`).join("");
    return `<div class="cg-inv">${items}</div>
<div class="cg-tip"><span class="i">🎓</span><div>Toate le exersezi în <b>meciul de antrenament</b> de dinainte de partidă (îl alegi la masă: „🎓 Fac tutorialul”). Dacă reîncarci pagina, antrenamentul continuă de la același pas.</div></div>`;
  });

  ch("final", "🏁", "Finalul și scorul", hero({ cls: "gold", lead: "Când se termină timpul, fiecare companie este evaluată pas cu pas, cu animație. Cea mai valoroasă câștigă." }), () => {
    const steps = [["💶 Bani în cont", 18.4, "#5fd38a"], ["🏦 Plătești datoria la bancă", -5, "#ff6b6b"], ["🤝 Împrumuturi între jucători", -1.2, "#ff6b6b"], ["✈️ Avioane (depreciate)", 31.5, "#5fd3dc"], ["🛣️ Rute", 21, "#ff8a4c"], ["🏛️ Sloturi și huburi", 6.3, "#b9a3ff"], ["🏗️ Investiții", 4, "#ffb36b"], ["🃏 Cărți rămase", 2.1, "#ffd35c"], ["🎟️ Permise neconstruite", -0.4, "#ff6b6b"], ["📈 Acțiuni la alții", 8, "#7be07b"]];
    let acc = 0; const tot = steps.reduce((s, x) => s + x[1], 0), max = Math.max(...steps.map((_, i) => steps.slice(0, i + 1).reduce((s, x) => s + x[1], 0)), tot) * 1.04;
    const rows = steps.map(([l, v, c], i) => { const a = acc; acc += v; const x0 = Math.min(a, acc), w = Math.abs(v); return `<div class="row"><span>${l}</span><div class="tr"><i style="left:${x0 / max * 100}%;width:${w / max * 100}%;background:${c};animation-delay:${i * .12}s"></i></div><b class="${v < 0 ? "cg-neg" : ""}">${fmtE(v * 1e6, true)}</b></div>`; }).join("");
    return `<div class="cg-cols wide"><div class="cg-txt"><h3><span class="ic">🧮</span>Ordinea evaluării</h3><ol>
<li>Se <b>plătește datoria la bancă</b>.</li><li>Se <b>decontează împrumuturile</b> dintre jucători.</li><li>Se adună <b>avioanele</b> (valoare depreciată), <b>rutele</b>, <b>sloturile</b> și <b>huburile</b>, plus <b>investițiile</b> (cât ai plătit, minus ${pct(invInfo().decay)} pe zi, minim ${pct(invInfo().valueMult)}).</li>
<li>Se adună <b>cărțile rămase</b>: o carte normală = profitul unei zile pe o rută medie, Jokerul 3×, o specială 5×, bonus de colecționar pentru 5 de același fel; <b>minus</b> o penalizare pentru fiecare permis neconstruit.</li>
<li>Se adună <b>acțiunile</b> deținute la alte companii.</li></ol>
<p><b>Valoarea companiei</b> din bara de sus e calculată <b>exact</b> la fel, live, toată partida — ce vezi acolo e scorul tău. Ultimele zile nu ascund trucuri: un avion cumpărat second-hand sau răscumpărat valorează cel mult cât ai plătit, investițiile încep să scadă din prima zi.</p>
<p>Urmează <b>podiumul</b>, fila <b>📈 Evoluția valorii</b> (graficul fiecărei companii, zi de zi), <b>realizările</b> și statisticile partidei.</p></div>
<div class="cg-ex"><h4><span class="tag">Exemplu</span>Evaluarea ${esc(VW.co)}</h4><div class="cg-wf">${rows}<div class="row tot"><span>🏆 Valoare finală</span><div class="tr"><i style="left:0;width:${tot / max * 100}%;background:linear-gradient(90deg,#ffd35c,#ff8a4c);animation-delay:${steps.length * .12}s"></i></div><b class="cg-gold">${fmtE(tot * 1e6)}</b></div></div></div></div>
<div class="cg-steps"><div class="cg-step"><span class="ic">⏱️</span><b>1 h · 2 h · 3 h</b><span>La final, evaluarea de mai sus decide câștigătorul.</span></div>
<div class="cg-step"><span class="ic">♾️</span><b>Fără timp</b><span>Se joacă până rămâne o singură companie. După ziua 60 crizele cresc.</span></div>
<div class="cg-step"><span class="ic">🏳️</span><b>Abandon</b><span>Locul tău e preluat de un bot, ca ceilalți să poată continua.</span></div></div>`;
  });

  ch("sfaturi", "💡", "Sfaturi și tutorial", hero({ cls: "", lead: "Câteva lecții învățate pe pielea altor directori. Și un tutorial ghidat dacă vrei să înveți jucând." }), () => `
<div class="cg-tutbig"><div style="width:96px;flex:none">${consultant(96, "happy")}</div><div class="t"><h3>🎓 Tutorial pas cu pas</h3><p>Te conduc pe jocul tău real: îți arăt unde să apeși — permis, cărți, construcție, avion, rută, preț, decolare, draft. Treci mai departe doar după ce faci tu pasul.</p></div><button class="cg-btn gold" data-act="tut" style="font-size:16px;padding:12px 20px">🎓 Pornește tutorialul</button></div>
<div class="cg-steps">
<div class="cg-step"><span class="ic">🎯</span><b>Umple avioanele</b><span>Un avion plin la preț normal bate unul gol la preț premium.</span></div>
<div class="cg-step"><span class="ic">🧩</span><b>Rețea, nu rute izolate</b><span>Rute care se leagă printr-un oraș dau pasageri de tranzit și permise noi.</span></div>
<div class="cg-step"><span class="ic">🏛️</span><b>Prinde sloturile mari</b><span>Aeroporturile mari au doar 2 locuri. Cine ajunge primul, blochează.</span></div>
<div class="cg-step"><span class="ic">👨‍✈️</span><b>Piloți pe rutele bune</b><span>Lasă rutele sigure pe pilot automat și ocupă-te de expansiune.</span></div>
<div class="cg-step"><span class="ic">🏦</span><b>Credit cu cap</b><span>Ratele vin în fiecare seară. Nu te îndatora pentru o rută care abia pornește.</span></div>
<div class="cg-step"><span class="ic">❄️</span><b>Păstrează un 🔥</b><span>Un Spărgător în mână te scapă de cel mai urât moment al partidei.</span></div>
<div class="cg-step"><span class="ic">🌱</span><b>Profită de start</b><span>În primele ${BONUS().days} zile taxele și leasingul sunt la jumătate. Atunci se pun bazele.</span></div>
<div class="cg-step"><span class="ic">🏗️</span><b>Investește surplusul</b><span>Când banii se adună, o bază extinsă sau un terminal propriu aduc pasageri în fiecare zi.</span></div>
<div class="cg-step"><span class="ic">🃏</span><b>Nu strânge cărți degeaba</b><span>La final o carte valorează puțin. Construiește!</span></div>
<div class="cg-step"><span class="ic">🤝</span><b>Negociază</b><span>Un pact sau o rută schimbată la timp poate valora mai mult decât zece zboruri.</span></div></div>
<div class="cg-tip ok"><span class="i">📖</span><div>Ghidul se redeschide oricând din butonul <b>📖 Ghid</b>. Rezumatul regulilor îl găsești la butonul <b>Reguli</b>. Zbor plăcut!</div></div>`, (el, api) => {
    const b = el.querySelector('[data-act="tut"]'); if (b) b.addEventListener("click", () => api.startTutorial());
  });

  // ---------- the book ----------
  let current = null;
  function open(container, helpers, opts) {
    if (!D) return null;
    opts = opts || {}; helpers = helpers || {};
    if (opts.tutorial) return tutorial(container, helpers, opts);
    css(); close();
    container = container || D.body;
    const ov = D.createElement("div"); ov.className = "cg-ov"; ov.setAttribute("role", "dialog"); ov.setAttribute("aria-modal", "true"); ov.setAttribute("aria-label", "Ghidul Cerul Lumii");
    let idx = 0; if (opts.chapter != null) { const i = typeof opts.chapter === "number" ? opts.chapter : CH.findIndex(c => c.id === opts.chapter); if (i >= 0) idx = i; }
    const seenCh = new Set();
    ov.innerHTML = `<div class="cg-book"><aside class="cg-side"><div class="cg-brand"><span class="cg-bico">${(W && W.CerulTheme && W.CerulTheme.icon("guide")) || "📖"}</span><div><b>Ghidul pilotului</b><small>Cerul Lumii · ${CH.length} capitole</small></div></div>
<nav class="cg-idx" aria-label="Cuprins">${CH.map((c, i) => `<button data-i="${i}"><span class="n">${i + 1}</span><span class="e">${c.icon}</span><span>${esc(c.title)}</span></button>`).join("")}</nav>
<div class="cg-sidefoot"><button class="cg-btn gold" data-act="tut">🎓 Tutorial pas cu pas</button></div></aside>
<section class="cg-main"><header class="cg-head"><select aria-label="Capitol">${CH.map((c, i) => `<option value="${i}">${i + 1}. ${c.icon} ${esc(c.title)}</option>`).join("")}</select><span class="cg-crumb"></span><span class="cg-sp"></span><button class="cg-btn ghost cg-tutb" data-act="tut" title="Tutorial pas cu pas">🎓<span class="lbl"> Tutorial</span></button><button class="cg-btn ghost cg-x" data-act="close" aria-label="Închide ghidul" title="Închide (Esc)">✕</button></header>
<div class="cg-scroll"></div>
<footer class="cg-foot"><button class="cg-btn" data-act="prev">← <span class="lbl">Înapoi</span></button><div class="cg-dots">${CH.map((c, i) => `<button data-i="${i}" aria-label="${esc(c.title)}" title="${esc(c.title)}"></button>`).join("")}</div><span class="cg-cnt"></span><button class="cg-btn gold" data-act="next"><span class="lbl">Înainte</span> →</button></footer></section></div>`;
    container.appendChild(ov);
    const scroll = ov.querySelector(".cg-scroll"), sel = ov.querySelector("select");
    const cleanups = [];
    let ro = null, pageFix = null;
    const relayout = () => { ov.querySelectorAll(".cg-stage").forEach(layoutStage); if (pageFix) try { pageFix(); } catch (e) {} };
    const api = {
      el: ov, close: () => doClose(),
      go: (i) => { if (typeof i === "string") i = CH.findIndex(c => c.id === i); if (i >= 0 && i < CH.length) show(i, i < idx ? -1 : 1); },
      startTutorial: () => {
        const fn = opts.onTutorial || helpers.onTutorial;
        doClose();
        if (typeof fn === "function") { try { fn(); } catch (e) {} } else tutorial(container, helpers, {});
      }
    };
    function show(i, dir) {
      idx = clamp(i, 0, CH.length - 1); seenCh.add(idx);
      const c = CH[idx], h = c.hero || {};
      const flyArt = planeSide(["t72", "a320", "s350"][idx % 3], [ME, OP, "#ffd35c"][idx % 3], 200);
      const heroArt = idx === 0 ? `<div class="cg-hart" style="width:min(380px,40%)">${planeSide("a320", ME, 380)}</div>` :
        c.id === "negociere" ? `<div class="cg-hart">${avatar(VW.av, 120, "smug", ME)}${avatar(RV.av, 120, "happy", OP)}</div>` :
        c.id === "speciale" ? `<div class="cg-hart">${cardFace("freeze", 92)}${cardFace("breaker", 92)}${cardFace("boom", 92)}</div>` :
        c.id === "permise" ? `<div class="cg-hart">${cardFace("apr", 84)}${cardFace("joker", 84)}${cardFace("comb", 84)}</div>` :
        c.id === "sfaturi" || c.id === "draft" ? `<div class="cg-hart">${consultant(140, "happy")}</div>` :
        c.id === "final" ? `<div class="cg-hart">${icon("trophy", 130, "🏆")}</div>` :
        c.id === "bursa" || c.id === "banca" ? `<div class="cg-hart">${logo(VW.co, ME, 110)}${logo(RV.co, OP, 110)}</div>` :
        `<div class="cg-hart" style="font-size:96px;line-height:1">${c.icon}</div>`;
      scroll.innerHTML = `<article class="cg-page${dir < 0 ? " l" : ""}"><div class="cg-hero ${h.cls || ""}">${reduced() ? "" : `<div class="cg-fly" style="animation-delay:-${(idx * 3.7) % 16}s">${flyArt}</div>`}${heroArt}<div class="cg-ht"><span class="cg-kick">Capitolul ${idx + 1} din ${CH.length}</span><h2>${c.icon} ${esc(c.title)}</h2><p>${h.lead || ""}</p></div></div><div class="cg-body">${c.build()}</div></article>`;
      scroll.scrollTop = 0;
      pageFix = null;
      if (c.mount) { try { const r = c.mount(scroll, api); if (typeof r === "function") pageFix = r; } catch (e) { if (W && W.console) console.warn("cerul-guide mount", e); } }
      ov.querySelectorAll(".cg-idx button").forEach((b, j) => { b.classList.toggle("on", j === idx); b.classList.toggle("seen", seenCh.has(j) && j !== idx); if (j === idx) { b.setAttribute("aria-current", "page"); try { b.scrollIntoView({ block: "nearest" }); } catch (e) {} } else b.removeAttribute("aria-current"); });
      ov.querySelectorAll(".cg-dots button").forEach((b, j) => { b.classList.toggle("on", j === idx); b.classList.toggle("seen", seenCh.has(j)); });
      sel.value = String(idx);
      ov.querySelector(".cg-crumb").innerHTML = `Ghid · <b>${esc(c.title)}</b>`;
      ov.querySelector(".cg-cnt").textContent = `${idx + 1} / ${CH.length}`;
      ov.querySelector('[data-act="prev"]').disabled = idx === 0;
      const nx = ov.querySelector('[data-act="next"]');
      nx.innerHTML = idx === CH.length - 1 ? `<span class="lbl">Am înțeles,</span> la joc! ✈️` : `<span class="lbl">Înainte</span> →`;
      // layout after paint (fonts / svg)
      requestAnimationFrame(() => requestAnimationFrame(relayout));
      setTimeout(relayout, 350); setTimeout(relayout, 1200);
    }
    function doClose() {
      if (!ov.parentNode) return;
      markSeen();
      cleanups.forEach(f => { try { f(); } catch (e) {} });
      if (ro) try { ro.disconnect(); } catch (e) {}
      ov.remove(); if (current === api) current = null;
      if (typeof opts.onClose === "function") try { opts.onClose(); } catch (e) {}
    }
    const on = (t, ty, fn, o) => { t.addEventListener(ty, fn, o); cleanups.push(() => t.removeEventListener(ty, fn, o)); };
    on(ov, "click", e => {
      const a = e.target.closest("[data-act]"); const ib = e.target.closest(".cg-idx [data-i], .cg-dots [data-i]");
      if (ib) { const j = +ib.dataset.i; if (j !== idx) show(j, j < idx ? -1 : 1); return; }
      if (!a) { if (e.target === ov) doClose(); return; }
      const act = a.dataset.act;
      if (act === "close") doClose();
      else if (act === "prev") { if (idx > 0) show(idx - 1, -1); }
      else if (act === "next") { if (idx < CH.length - 1) show(idx + 1, 1); else doClose(); }
      else if (act === "tut" && !a.closest(".cg-page")) api.startTutorial();
    });
    on(sel, "change", () => { const j = +sel.value; show(j, j < idx ? -1 : 1); });
    on(D, "keydown", e => {
      if (!ov.parentNode) return;
      const tg = e.target; if (tg && /INPUT|SELECT|TEXTAREA/.test(tg.tagName) && tg.type !== "range") return;
      if (tg && tg.type === "range" && /Arrow/.test(e.key)) return;
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); doClose(); }
      else if (e.key === "ArrowRight" || e.key === "PageDown") { e.preventDefault(); if (idx < CH.length - 1) show(idx + 1, 1); }
      else if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); if (idx > 0) show(idx - 1, -1); }
      else if (e.key === "Home") { e.preventDefault(); show(0, -1); }
      else if (e.key === "End") { e.preventDefault(); show(CH.length - 1, 1); }
    }, true);
    // swipe (touch / pen)
    let sx = 0, sy = 0, st = 0, sOk = false;
    on(scroll, "pointerdown", e => { if (e.pointerType === "mouse") return; if (e.target.closest("input,button,select,.r-dc")) { sOk = false; return; } sOk = true; sx = e.clientX; sy = e.clientY; st = Date.now(); });
    on(scroll, "pointerup", e => {
      if (!sOk) return; sOk = false; const dx = e.clientX - sx, dy = e.clientY - sy;
      if (Date.now() - st < 700 && Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.6) { if (dx < 0 && idx < CH.length - 1) show(idx + 1, 1); else if (dx > 0 && idx > 0) show(idx - 1, -1); }
    });
    on(scroll, "pointercancel", () => { sOk = false; });
    if (W && W.ResizeObserver) { ro = new ResizeObserver(() => relayout()); ro.observe(scroll); } else on(W, "resize", relayout);
    if (D.fonts && D.fonts.ready) D.fonts.ready.then(() => relayout()).catch(() => {});
    show(idx, 1);
    setTimeout(() => { try { ov.querySelector('[data-act="next"]').focus({ preventScroll: true }); } catch (e) {} }, 50);
    current = api;
    return api;
  }
  function close() { if (current) current.close(); }

  // ---------- cine se uită (DOAR acest dispozitiv / acest jucător) ----------
  // Ghidul și tutorialul sunt 100% locale: nimic nu se scrie în starea jocului, în db sau în cameră.
  // Identitatea = id-ul jucătorului de pe acest dispozitiv (ctx.me), niciodată contul.
  let VW = { id: null, co: "Compania ta", name: "Tu", av: 0, color: "#ff8a4c", base: "" };
  let RV = { name: "Mara", co: "Mara Air", av: 5 };
  function setViewer(v) {
    if (!v) return;
    if (v.id) VW.id = String(v.id);
    if (v.co) VW.co = String(v.co).slice(0, 40);
    if (v.name) VW.name = String(v.name).slice(0, 24);
    if (v.av != null && v.av !== "" && !isNaN(+v.av)) VW.av = +v.av;
    if (v.base) VW.base = String(v.base);
    if (typeof v.color === "string" && /^#[0-9a-f]{3,8}$/i.test(v.color)) VW.color = v.color;
    ME = VW.color;
    OP = /^#5f|^#4f|^#6f/i.test(ME) ? "#ff8a4c" : "#5fd3dc";
    RV.av = [5, 6, 7, 8].find(x => x !== VW.av);
    if (VW.name === RV.name) RV = Object.assign(RV, { name: "Ilinca", co: "Ilinca Air" });
  }
  function helpersViewer(h) { try { if (h && h.me) setViewer({ id: h.me }); } catch (e) {} }
  // cheia locală = id-ul acestui dispozitiv/jucător (același ca în core: __SALON_ME sau „salon-id” [+ fila, în modul test]).
  // Nu folosim locul de la masă (p1/p2 se schimbă de la o partidă la alta) și nici contul Claude.
  function devId() {
    try {
      if (W.__SALON_ME) return String(W.__SALON_ME);
      const t = localStorage.getItem("salon-id") || "";
      if (localStorage.getItem("salon-test") === "1") { let tb = ""; try { tb = sessionStorage.getItem("salon-tab") || ""; } catch (e) {} return t + "-" + tb; }
      return t || VW.id || "anon";
    } catch (e) { return VW.id || "anon"; }
  }
  const lsK = k => k + ":" + devId();
  function lsGet(k) { try { return W && W.localStorage ? localStorage.getItem(lsK(k)) : null; } catch (e) { return null; } }
  function lsSet(k, v) { try { if (!W || !W.localStorage) return; if (v == null) localStorage.removeItem(lsK(k)); else localStorage.setItem(lsK(k), v); } catch (e) {} }
  const LSK_T = "cerul-tut";
  function tutState() { try { return JSON.parse(lsGet(LSK_T) || "null") || {}; } catch (e) { return {}; } }
  function tutSave(o) { lsSet(LSK_T, JSON.stringify(Object.assign(tutState(), o))); }
  function seen() { return !!lsGet(LSK) || !!tutState().ans; }
  function markSeen() { lsSet(LSK, String(Date.now())); }
  function resetSeen() { lsSet(LSK, null); lsSet(LSK_T, null); }

  // ultima stare văzută de UI (doar datele MELE, din vederea mea)
  let OBS = null;
  function observe(s) {
    if (!s) return;
    if (W && W.__CERUL_PRACTICE) return; // meciul de antrenament (cerul-tutorial.js) are propriul antrenor
    OBS = s;
    if (s.me || s.id) setViewer(Object.assign({ id: s.id }, s.me || {}));
    if (tutCur) tutCur._tick();
    else if (pendingOffer && s.phase === "play" && !s.why && !current && !offerEl) { const p = pendingOffer; pendingOffer = null; setTimeout(() => autoOpen(p.container, p.helpers, p.opts), 800); }
    else if (!resumeTried && D && (s.phase === "play" || s.phase === "draft") && !s.ended) {
      // reîncărcare de pagină în timpul tutorialului: continuăm de unde a rămas ACEST jucător
      resumeTried = true;
      const ts = tutState();
      if (ts.run && !ts.done && !current) setTimeout(() => { if (!tutCur) tutorial(D.body, null, { resume: true, startIdx: ts.step || 0 }); }, 600);
    }
  }
  let resumeTried = false, pendingOffer = null;

  // ---------- oferta de la prima partidă ----------
  let offerEl = null;
  function autoOpen(container, helpers, opts) {
    if (!D) return null;
    helpersViewer(helpers);
    if (current || tutCur || offerEl) return null;
    if (OBS && (OBS.phase !== "play" || OBS.why)) { pendingOffer = { container, helpers, opts }; return null; }
    // Oferta mare „Prima dată aici?” nu mai apare: există meciul de antrenament înainte de partidă (cerul-tutorial.js).
    // Tutorialul pas cu pas pe jocul real rămâne doar ca reîmprospătare din 📖 Ghid. Cine a sărit antrenamentul primește
    // doar un indiciu mic, care nu blochează nimic, lângă butonul 📖 Ghid, câteva secunde (o dată pe partidă).
    const ts = tutState();
    if (ts.practice === "done" || hintShown) return null;
    hintShown = true;
    css();
    const btn = D.querySelector('.cl-root [data-tut="btn-guide"]'), r = btn && btn.offsetParent ? btn.getBoundingClientRect() : null;
    const el = D.createElement("div"); el.className = "cg-hint"; el.setAttribute("role", "status");
    el.innerHTML = "📖 Regulile și tutorialul pas cu pas sunt în <b>Ghid</b>";
    if (r) { el.style.top = Math.round(r.bottom + 10) + "px"; el.style.left = Math.round(Math.max(8, Math.min(innerWidth - 300, r.left + r.width / 2 - 150))) + "px"; }
    else { el.style.top = "64px"; el.style.right = "10px"; }
    D.body.appendChild(el);
    setTimeout(() => el.classList.add("out"), 4500); setTimeout(() => el.remove(), 5200);
    return { el, close: () => el.remove() };
  }
  let hintShown = false;

  // ---------- tutorialul interactiv (pe jocul real) ----------
  // Fiecare pas: ce să apeși (tut = data-tut sau "sel:<css>", primul vizibil câștigă), când e gata (done),
  // când e deja făcut (skip), ce să faci dacă acum nu se poate (wait). Avansează DOAR când jucătorul chiar face acțiunea.
  const nAir = s => (s.planes || []).filter(p => p.rid != null && p.st === "air" && !p.ferry).length;
  const nOnRoute = s => (s.planes || []).filter(p => p.rid != null).length;
  const TSTEPS = [
    { id: "permits", title: "Alege permisele", tut: ["sel:.cl-modal [data-okeep]:not([disabled])", "sel:.cl-modal [data-osel]", "sel:[data-offer]", "btn-draw", "permits"],
      text: s => s.offer ? (s.modal === "offer" ? "Un permis îți dă voie să construiești o rută între două orașe. Bifează o rută <b>scurtă</b>, apoi apasă <b>„Păstrează”</b>." : "Ai permise oferite. Apasă <b>„🎟️ Alege permisele”</b> și păstrează cel puțin unul.")
        : "Apasă <b>„＋ Trage permis”</b> ca să primești 3 rute din care alegi.",
      done: s => !s.offer && s.permits > 0, skip: s => !s.offer && s.permits > 0,
      bravo: "Ai primul permis de rută. Acum îți trebuie cărțile cerute de el." },
    { id: "cards", title: "Cărți la Ghișeu", tut: ["sel:.cl-modal [data-buycard]:not([disabled])", "btn-ghiseu", "sel:[data-buycard]", "cards"],
      text: s => s.modal === "ghiseu" ? "Apasă <b>„💶 Cumpără o carte”</b> (sau dă 5 cărți pe una la alegere)." : "Fiecare permis cere câteva cărți (iconițele gri îți arată ce lipsește). Deschide <b>🃏 Ghișeu</b> și cumpără o carte.",
      done: (s, b) => s.hand > b.hand, skip: s => s.buildable > 0 || s.routes > 0,
      wait: s => s.cardPrice != null && s.cash < s.cardPrice ? "Acum n-ai bani pentru o carte. Nu-i nimic: cărți primești gratis la draftul de seară." : "",
      bravo: "Ai cumpărat o carte. Când ai toate cărțile unui permis, poți construi ruta." },
    { id: "build", title: "Construiește ruta", tut: ["btn-build", "permits"],
      text: s => s.phone && !s.vis["btn-build"] ? "Deschide <b>🃏 Cărți</b> de jos: la permisul complet apasă <b>„→ Construiește”</b>." : "Permisul are toate cărțile — apasă <b>„→ Construiește”</b>. Plătești cărțile și sloturile de aeroport.",
      done: (s, b) => s.routes > b.routes, skip: s => s.routes > 0,
      wait: s => !s.buildable ? "Îți mai lipsesc cărți pentru permis. Mai cumpără la Ghișeu sau așteaptă draftul de seară — revin aici singur." : "",
      bravo: "Prima ta rută e gata! Acum îi trebuie un avion." },
    { id: "plane", title: "Un avion pentru rută", tut: ["shop-new", "tab-shop"],
      text: s => s.idle > 0 ? "Ai deja un <b>Turbo 72</b> gratuit în hangar. Deschide <b>🛒 Avioane</b> ca să vezi de unde cumperi sau iei în <b>leasing</b> altele." : "Deschide <b>🛒 Avioane</b> și apasă <b>„Cumpără”</b> sau <b>„Leasing”</b> la un avion.",
      done: (s, b) => s.nPlanes > b.nPlanes || (s.idle > 0 && (s.tab === "shop" || s.ptab === "shop")), skip: s => nOnRoute(s) > 0,
      wait: s => !s.idle && !s.canBuyPlane ? "Acum n-ai bani pentru un avion. Ia un credit la 🏦 Bancă sau încearcă leasingul." : "",
      bravo: s => s.idle > 0 ? "Știi de unde iei avioane. Acum pune-l pe cel din hangar pe rută." : "Avion nou în flotă! Acum pune-l pe rută." },
    { id: "assign", title: "Atribuie ruta", tut: ["sel:.cl-modal [data-massign]:not([disabled])", "sel:.cl-modal [data-passign]:not([disabled])", "sel:.cl-modal [data-msel]:not([disabled])", "sel:.cl-modal [data-psel]", "assign", "tab-fleet"],
      text: s => s.modal === "assign" || s.modal === "putplane" ? "Alege ruta (vezi estimarea de profit), apoi apasă <b>„Atribuie”</b>." : "În <b>✈️ Flotă</b>, la avionul din hangar, apasă <b>„Atribuie rută”</b>.",
      done: (s, b) => nOnRoute(s) > nOnRoute(b), skip: s => nOnRoute(s) > 0,
      wait: s => !s.routes ? "Mai întâi construiește o rută." : !s.idle ? "Nu ai niciun avion liber — cumpără unul din 🛒 Avioane." : "",
      bravo: "Avionul face acum naveta pe ruta ta. Pasagerii încep să se adune la poartă." },
    { id: "price", title: "Prețul biletului", tut: ["price-presets", "route-popup", "sel:.cl-rt[data-route]", "tab-routes"],
      text: s => s.popRoute ? "Alege un preț: <b>Normal</b> e bun la început. <b>Ieftin</b> = avion plin, <b>Premium</b> = bani mai mulți pe bilet." : "Deschide ruta (fila <b>🛣️ Rute</b> sau click pe ea pe hartă) și alege un preț.",
      done: (s, b, ev) => ev.has("priceSet"), skip: () => false,
      wait: s => !s.routes ? "Mai întâi construiește o rută." : "",
      bravo: "Ai setat prețul. Mai jos = mai mulți pasageri, mai sus = mai mult pe bilet." },
    { id: "depart", title: "Decolează!", tut: ["btn-depart", "pilot", "plane", "tab-fleet"],
      text: "Când avionul are pasageri la poartă, apasă <b>„🛫 Decolează”</b>. Sau angajează un <b>👨‍✈️ pilot</b>: decolează singur când e plin.",
      done: (s, b, ev) => ev.has("departed") || ev.has("pilotOn") || nAir(s) > 0, skip: () => false,
      wait: s => !nOnRoute(s) ? "Mai întâi pune un avion pe o rută." : (s.planes || []).some(p => p.rid != null && p.ferry) ? "Avionul zboară gol spre ruta lui. Așteaptă să ajungă la poartă…" : "",
      bravo: "Decolare! Banii pe bilete îi primești la aterizare." },
    { id: "land", title: "Primul zbor", tut: ["cash"], watch: "Așteaptă aterizarea — durează puțin.",
      text: s => nAir(s) ? "Avionul e în aer. La aterizare încasezi biletele — urmărește <b>banii</b> aici sus." : "Urmărește <b>banii</b> aici sus: la fiecare aterizare încasezi biletele.",
      done: (s, b, ev, mk) => s.landings > (mk.dep != null ? mk.dep : b.landings), skip: () => false,
      wait: s => nAir(s) ? "" : !(s.planes || []).some(p => p.rid != null) ? "Niciun avion pe rută încă. Pune unul și apasă „Decolează”." : (s.planes || []).some(p => p.rid != null && p.st === "board") ? "Avionul tău așteaptă la poartă — apasă „🛫 Decolează” (fila ✈️ Flotă) ca să zboare." : "",
      bravo: s => s.lastProfit != null && s.lastProfit < 0 ? "Primul zbor a aterizat, dar pe pierdere. Încearcă alt preț sau un avion mai potrivit." : "Primul zbor a aterizat cu profit! Asta e toată rețeta: rute, avioane, pasageri." },
    { id: "draft", title: "Draftul de seară", tut: ["sel:.cs-dc.can", "sel:.cs-cards", "clock"], watch: s => !s.draft ? "Așteaptă sfârșitul zilei — vin eu după tine." : s.draft.mine ? "" : "Așteaptă-ți rândul…",
      text: s => !s.draft ? "Când se umple inelul ceasului, ziua se termină și vine <b>draftul</b>: fiecare alege pe rând cărți cu fața în jos. Joacă liniștit până atunci." : s.draft.mine ? "E rândul tău! <b>Alege o carte</b> de pe masă." : "Acum alege altcineva — vine imediat și rândul tău.",
      done: (s, b) => (s.draft && s.draft.myPicks > 0) || (s.day > b.day && b.day != null), skip: () => false,
      bravo: "Ai luat cărți la draft. Le folosești pentru permise noi." },
    { id: "bank", info: true, title: "Banca", tut: ["btn-bank"], text: "<b>🏦 Bancă</b>: iei credit când ai nevoie de un avion sau de o rută. Rata se plătește în fiecare seară — fii prudent." },
    { id: "nego", info: true, title: "Negocieri", tut: ["btn-nego"], text: "<b>🤝 Negociază</b>: schimbi bani, cărți, rute sau faci pacte cu ceilalți. Timpul se oprește cât negociați." },
    { id: "invest", info: true, title: "Investiții", tut: ["tab-invest", "tab-shop"], text: s => s.phone ? "<b>🏗️ Investiții</b> le găsești în 🛒 Avioane: bază extinsă, terminal, flotă eco, mentenanță. Contează la valoarea finală." : "<b>🏗️ Investiții</b>: bază extinsă, terminal propriu, flotă eco, mentenanță. Contează la valoarea finală." },
    { id: "guide", info: true, title: "Ghidul", tut: ["btn-guide", "sel:.cl-root.phone [data-k=guide]"], text: "<b>📖 Ghid</b>: toate regulile, cu desene. Tot de acolo pornești din nou <b>tutorialul pas cu pas</b>." },
    { id: "end", info: true, title: "Gata, ești director!", text: "Construiește rute, umple avioanele și urmărește-ți valoarea. Zbor plăcut! ✈️" }
  ];
  let tutCur = null;
  function tutorial(container, helpers, opts) {
    if (!D) return null;
    css(); opts = opts || {}; helpersViewer(helpers);
    if (tutCur) tutCur.stop(true);
    if (offerEl) { offerEl.remove(); offerEl = null; }
    close();
    const root = D.createElement("div"); root.className = "cg-tut center";
    root.innerHTML = `<div class="cg-tut-dim"></div><div class="cg-tut-hole"></div><div class="cg-tut-bub" role="dialog" aria-live="polite" aria-label="Tutorial"><span class="ar"></span><div class="in"></div></div>`;
    D.body.appendChild(root);
    const hole = root.querySelector(".cg-tut-hole"), bub = root.querySelector(".cg-tut-bub"), arw = bub.querySelector(".ar"), inner = bub.querySelector(".in");
    let i = 0;
    if (opts.startIdx != null) i = clamp(+opts.startIdx || 0, 0, TSTEPS.length - 1);
    if (opts.start) { const j = TSTEPS.findIndex(s => s.id === opts.start); if (j >= 0) i = j; }
    let target = null, raf = 0, lastQ = 0, alive = true, lastR = "", lastHTML = "", mode = "step", base = null, ev = new Set(), bravoTxt = "";
    const mk = {};
    const S = () => {
      const s = OBS || {};
      const vis = {}; ["btn-build"].forEach(k => { vis[k] = !!findOne([k]); });
      return Object.assign({ planes: [], routes: 0, permits: 0, offer: 0, hand: 0, cash: 0, landings: 0, nPlanes: 0, idle: 0 }, s, { vis });
    };
    function visible(el) {
      if (!el || root.contains(el) || (offerEl && offerEl.contains(el))) return false;
      const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return false;
      if (r.bottom < 0 || r.right < 0 || r.top > innerHeight || r.left > innerWidth) return false;
      const cs = getComputedStyle(el); if (cs.visibility === "hidden" || +cs.opacity === 0 || cs.display === "none") return false;
      // ascuns sub o fereastră / scenă (alt element deasupra centrului)?
      try { const cx = clamp(r.left + r.width / 2, 1, innerWidth - 2), cy = clamp(r.top + r.height / 2, 1, innerHeight - 2); const top = D.elementFromPoint(cx, cy); if (top && !el.contains(top) && !top.contains(el) && !root.contains(top) && !(offerEl && offerEl.contains(top))) { const m = top.closest(".cl-modal, .cl-scene > *, .cg-ov"); if (m && !m.contains(el)) return false; } } catch (e) {}
      return true;
    }
    function findOne(list) {
      for (const k of list) {
        const sel = k.indexOf("sel:") === 0 ? k.slice(4) : `[data-tut="${k}"]`;
        let els; try { els = D.querySelectorAll(sel); } catch (e) { continue; }
        for (const el of els) if (visible(el)) return el;
      }
      return null;
    }
    const tx = (v, s) => typeof v === "function" ? v(s) : (v || "");
    // când ținta e doar „drumul” spre buton (o filă, un meniu), spun exact ce să deschidă
    const VIA = { "tab-fleet": "Deschide fila <b>✈️ Flotă</b> (evidențiată).", "tab-routes": "Deschide fila <b>🛣️ Rute</b> (evidențiată).", "tab-shop": "Deschide fila <b>🛒 Avioane</b> (evidențiată).",
      "permits": "Deschide <b>🃏 Cărți</b> (evidențiat).", "btn-ghiseu": "Apasă <b>🃏 Ghișeu</b> (evidențiat).", "cards": "Deschide <b>🃏 Cărți</b> (evidențiat).", "tab-invest": "" };
    const tKey = () => target ? (target.getAttribute("data-tut") || "") : "";
    const blockMsg = (s, st) => {
      if (s.ended || s.phase === "end") return "Partida s-a terminat.";
      if (st.id !== "draft" && (s.why === "draft" || s.phase === "draft")) return s.draft && s.draft.mine ? "Acum e draftul de seară — alege o carte de pe masă, apoi continuăm." : "Acum e draftul de seară. Așteaptă rândul tău și alege o carte — apoi continuăm.";
      if (s.why === "nego" || s.phase === "nego") return "Se negociază — timpul e oprit pentru toți. Continuăm imediat după.";
      if (s.why === "pause" || s.paused) return "Jocul e pe pauză. Când pornește din nou, continuăm de aici.";
      if (s.frozen) return "Compania ta e înghețată câteva secunde ❄️. Așteaptă să se dezghețe.";
      if (s.bankrupt) return "Compania ta a ieșit din joc.";
      return "";
    };
    const render = () => {
      const st = TSTEPS[i], s = S();
      const prog = TSTEPS.map((x, j) => `<i class="${j < i ? "ok" : j === i ? "on" : ""}"></i>`).join("");
      const x = `<button class="x" data-t="stop" title="Închide tutorialul (îl reiei din 📖 Ghid)">✕ Închide tutorialul</button>`;
      let h;
      if (mode === "bravo") {
        h = `<div class="hd"><span class="cs">${consultant(44, "happy")}</span><div><small>Pasul ${i + 1} din ${TSTEPS.length} · gata</small><b>Bravo! 🎉</b></div></div>
<p>${bravoTxt}</p><div class="bt"><span class="prog">${prog}</span><button data-t="solo">Mă descurc singur</button><button class="pri" data-t="cont">Continuă ghidul →</button></div>`;
      } else {
        const blk = blockMsg(s, st), wt = !blk && st.wait ? st.wait(s) : "";
        const last = i === TSTEPS.length - 1;
        const missing = st.tut && !target && !blk && !wt;
        h = `<div class="hd"><span class="cs">${consultant(44, "happy")}</span><div><small>Tutorial · pasul ${i + 1} din ${TSTEPS.length}</small><b>${esc(st.title)}</b></div></div>
${blk ? `<p class="wait">⏳ ${esc(blk)}</p>` : `<p>${tx(st.text, s)}</p>`}${blk ? "" : wt ? `<p class="wait">⏳ ${esc(wt)}</p>` : tx(st.watch, s) ? `<div class="do">⏳ ${esc(tx(st.watch, s))}</div>` : !st.info ? `<div class="do">👉 ${VIA[tKey()] && st.tut.indexOf(tKey()) > 0 ? VIA[tKey()] : "Apasă tu ce e evidențiat — continui când văd că ai făcut pasul."}</div>` : ""}${missing && !st.info ? `<p class="miss">${s.modal ? "Închide fereastra deschisă (✕) ca să vezi butonul." : "Nu văd încă butonul pe ecran — apare imediat ce e disponibil."}</p>` : ""}
<div class="bt"><span class="prog">${prog}</span>${x}${!st.info ? `<button data-t="skip" class="lnk">Sari peste</button>` : ""}${st.info && (!blk || last) ? (last ? `<button class="pri" data-t="finish">La joc! ✈️</button>` : `<button class="pri" data-t="next">Am înțeles →</button>`) : ""}</div>`;
      }
      if (h !== lastHTML) {
        const fresh = !lastHTML || inner.dataset.k !== mode + i;
        inner.innerHTML = h; lastHTML = h; inner.dataset.k = mode + i; lastR = "";
        if (fresh) { bub.classList.remove("pop"); void bub.offsetWidth; if (!reduced()) bub.classList.add("pop"); }
      }
    };
    const inter = (a, b) => Math.max(0, Math.min(a.r, b.r) - Math.max(a.l, b.l)) * Math.max(0, Math.min(a.b, b.b) - Math.max(a.t, b.t));
    const place = () => {
      const vw = innerWidth, vh = innerHeight, bw = bub.offsetWidth, bh = bub.offsetHeight, m = 10;
      const tgt = mode === "bravo" ? null : target;
      if (!tgt) {
        const key = ["c", bw, bh, vw, vh].join(","); if (key === lastR) return; lastR = key;
        root.classList.add("center"); hole.classList.remove("on"); arw.style.display = "none";
        // fără țintă: jos în centru, ca să nu acopere jocul
        bub.style.left = Math.round((vw - bw) / 2) + "px"; bub.style.top = Math.round(vh - bh - (vw < 700 ? 74 : 22)) + "px"; return;
      }
      const r = tgt.getBoundingClientRect(), pad = 6;
      const hx = Math.max(2, r.left - pad), hy = Math.max(2, r.top - pad), hw = Math.min(vw - 4 - hx, r.width + pad * 2), hh = Math.min(vh - 4 - hy, r.height + pad * 2);
      const key = [hx, hy, hw, hh, bw, bh, vw, vh].map(Math.round).join(",");
      if (key === lastR) return; lastR = key;
      root.classList.remove("center");
      Object.assign(hole.style, { left: hx + "px", top: hy + "px", width: hw + "px", height: hh + "px" }); hole.classList.add("on");
      const H = { l: hx, t: hy, r: hx + hw, b: hy + hh }, cx = hx + hw / 2, cy = hy + hh / 2, g = 14;
      // dacă ținta e într-o fereastră / popup, balonul stă în afara ei (să nu acopere celelalte butoane)
      let C = null; try { const box = tgt.closest(".cl-mcard, .cl-pop, .cs-cards"); if (box) { const q = box.getBoundingClientRect(); C = { l: q.left - 4, t: q.top - 4, r: q.right + 4, b: q.bottom + 4 }; } } catch (e) {}
      const around = (R) => { const rx = (R.l + R.r) / 2, ry = (R.t + R.b) / 2; return [["b", cx - bw / 2, R.b + g], ["t", cx - bw / 2, R.t - bh - g], ["r", R.r + g, cy - bh / 2], ["l", R.l - bw - g, cy - bh / 2], ["b", rx - bw / 2, R.b + g], ["t", rx - bw / 2, R.t - bh - g], ["r", R.r + g, ry - bh / 2], ["l", R.l - bw - g, ry - bh / 2]]; };
      const raw = (C ? around(C) : []).concat(around(H), [["in", m, vh - bh - m], ["in", vw - bw - m, vh - bh - m], ["in", vw - bw - m, m], ["in", m, m]]);
      const cand = raw.map(([side, x, y]) => { x = clamp(x, m, Math.max(m, vw - bw - m)); y = clamp(y, m, Math.max(m, vh - bh - m)); const B = { l: x, t: y, r: x + bw, b: y + bh }; return { side, x, y, ov: inter(H, B), oc: C ? inter(C, B) : 0 }; });
      const best = cand.find(c => c.ov === 0 && c.oc === 0) || cand.filter(c => c.ov === 0).sort((a, b) => a.oc - b.oc)[0] || cand.slice().sort((a, b) => a.ov - b.ov)[0];
      bub.style.left = Math.round(best.x) + "px"; bub.style.top = Math.round(best.y) + "px";
      // săgeata: spre țintă, pe latura balonului dinspre ea
      const B = { l: best.x, t: best.y, r: best.x + bw, b: best.y + bh };
      const side = best.ov > 0 ? "" : B.t >= H.b - 1 && cx > B.l + 14 && cx < B.r - 14 ? "b" : B.b <= H.t + 1 && cx > B.l + 14 && cx < B.r - 14 ? "t" : B.l >= H.r - 1 && cy > B.t + 14 && cy < B.b - 14 ? "r" : B.r <= H.l + 1 && cy > B.t + 14 && cy < B.b - 14 ? "l" : "";
      if (!side) arw.style.display = "none";
      else {
        arw.style.display = "block";
        if (side === "b" || side === "t") { arw.style.left = clamp(cx - best.x - 8, 14, bw - 30) + "px"; arw.style.top = side === "b" ? "-8px" : (bh - 8) + "px"; }
        else { arw.style.top = clamp(cy - best.y - 8, 14, bh - 30) + "px"; arw.style.left = side === "r" ? "-8px" : (bw - 8) + "px"; }
      }
    };
    const save = () => tutSave({ run: 1, step: i, done: 0, ans: "yes" });
    const go = (j) => {
      if (!alive) return;
      // sari automat peste pașii deja făcuți
      while (j < TSTEPS.length && !TSTEPS[j].info && TSTEPS[j].skip && OBS && TSTEPS[j].skip(S())) j++;
      if (j >= TSTEPS.length) { finish(); return; }
      i = clamp(j, 0, TSTEPS.length - 1); mode = "step"; target = null; lastR = ""; lastQ = 0; ev = new Set(); base = S();
      save(); tick(true);
      try { if (target && innerWidth < 700) target.scrollIntoView({ block: "nearest", inline: "nearest" }); } catch (e) {}
    };
    function tick(force) {
      if (!alive) return;
      const now = Date.now(); if (!force && now - lastQ < 200) return; lastQ = now;
      root.style.display = current ? "none" : "";
      const st = TSTEPS[i], s = S();
      if (mode === "step" && !st.info && st.done && base && st.done(s, base, ev, mk)) {
        mode = "bravo"; bravoTxt = tx(st.bravo, s) || "Ai reușit!"; target = null;
        if (st.id === "depart") mk.dep = s.landings || 0;
      }
      if (mode === "step") {
        const blk = blockMsg(s, st);
        const nt = st.tut && !(blk && st.id !== "draft") ? findOne(st.tut) : null;
        if (nt !== target) { target = nt; lastR = ""; }
      }
      render(); place();
    }
    const loop = () => { if (!alive) return; tick(false); place(); raf = requestAnimationFrame(loop); };
    const onClick = (e) => {
      if (!bub.contains(e.target)) {
        // pașii informativi trec mai departe și când apeși chiar elementul arătat
        const st = TSTEPS[i]; if (mode === "step" && st.info && target && target.contains(e.target)) setTimeout(() => { if (alive && TSTEPS[i] === st && mode === "step") go(i + 1); }, 400);
        else setTimeout(() => tick(true), 120);
        return;
      }
      const b = e.target.closest("[data-t]"); if (!b) return;
      e.stopPropagation();
      const t = b.dataset.t;
      if (t === "next" || t === "cont" || t === "skip") go(i + 1);
      else if (t === "finish") finish();
      else if (t === "solo" || t === "stop") stop();
    };
    D.addEventListener("click", onClick, true);
    const onRs = () => { lastR = ""; };
    W.addEventListener("resize", onRs);
    function finish() { tutSave({ run: 0, done: 1, ans: "yes" }); stop(true); }
    function stop(keep) {
      if (!alive) return; alive = false; cancelAnimationFrame(raf);
      D.removeEventListener("click", onClick, true); W.removeEventListener("resize", onRs);
      root.remove(); if (tutCur === api) tutCur = null; markSeen();
      if (!keep) tutSave({ run: 0 });
      if (typeof opts.onEnd === "function") try { opts.onEnd(); } catch (e) {}
    }
    const api = {
      next: () => go(i + 1), prev: () => go(i - 1), stop: (k) => stop(k), el: root,
      get step() { return i; }, get id() { return TSTEPS[i] && TSTEPS[i].id; }, get mode() { return mode; },
      get target() { return target; },
      _event(name) { ev.add(name); setTimeout(() => tick(true), 80); },
      _tick: () => tick(false)
    };
    tutCur = api;
    if (!opts.resume) tutSave({ ans: "yes", run: 1, step: i, done: 0 });
    go(i); raf = requestAnimationFrame(loop);
    return api;
  }
  function notify(name) { if (tutCur) tutCur._event(name); }
  // meciul de antrenament s-a terminat (sau jucătorul a ieșit): fără ofertă „Prima dată aici?” în partida reală
  function practiceDone(finished) { tutSave({ practice: finished ? "done" : "left", ans: tutState().ans || "practice", run: 0 }); if (finished) markSeen(); }

  const CerulGuide = {
    open, close, autoOpen, seen, markSeen, resetSeen, tutorial, notify, observe, setViewer, practiceDone,
    viewer: () => Object.assign({}, VW), tutorialState: () => tutState(),
    isOpen: () => !!current, tutorialActive: () => !!tutCur, offerOpen: () => !!offerEl, _tut: () => tutCur, _obs: () => OBS,
    CHAPTERS: CH.map(c => ({ id: c.id, title: c.title, icon: c.icon })),
    TUTORIAL_STEPS: TSTEPS.map(s => ({ id: s.id, tut: s.tut || null, info: !!s.info })),
    TUT_ATTRS: ["company", "cash", "value", "debt", "clock", "opponents", "btn-nego", "btn-bank", "btn-ghiseu", "btn-guide", "map", "map-zoom", "route-popup", "price-presets", "consultant", "tab-fleet", "tab-routes", "tab-reports", "tab-shop", "tab-shares", "plane", "btn-depart", "pilot", "assign", "shop-new", "cards", "permits", "btn-draw", "btn-build", "specials", "draft"],
    css, fmtE
  };
  if (W) W.CerulGuide = CerulGuide;
  if (typeof module !== "undefined" && module.exports) module.exports = CerulGuide;
})();
