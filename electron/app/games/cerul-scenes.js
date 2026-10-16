/* Cerul Lumii — CerulScenes: scene full-screen (lobby, draft, negociere, împrumut, bancă, îngheț, faliment, final).
   Fișier ajutător (IIFE), fără Salon.register. Globalele celorlalți (CerulLogic/Art/Data/Tune) se citesc LENEȘ. */
(function () {
  "use strict";
  const ACT_KEY = "a";                       // cheia tipului de acțiune trimis prin helpers.send()
  const W = typeof window !== "undefined" ? window : {};
  const Lg = () => W.CerulLogic || null, Ar = () => W.CerulArt || null, Dt = () => W.CerulData || null, Tn = () => W.CerulTune || null;
  const RM = () => { try { return !!(W.matchMedia && W.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch (e) { return false; } };

  /* ------------------------------------------------------------------ utilitare */
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const num = (x, d) => (typeof x === "number" && isFinite(x)) ? x : d;
  const first = (...xs) => { for (const x of xs) if (x !== undefined && x !== null) return x; return undefined; };
  const gx = (g, m, f) => (g === "f" ? f : m);
  const fold = s => String(s == null ? "" : s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const PAL = ["#ff8a4c", "#5fd3dc", "#b9a3ff", "#7be07b", "#ff6fa8", "#ffd35c"];
  function fmtE(n) {
    const D = Dt(); if (D && typeof D.fmtEur === "function") { try { return D.fmtEur(n); } catch (e) { /* fallback */ } }
    n = Math.round(num(n, 0)); const neg = n < 0; let a = Math.abs(n), s;
    if (a >= 1e6) s = (a / 1e6).toFixed(a >= 1e8 ? 0 : 2).replace(/\.?0+$/, "").replace(".", ",") + " M €";
    else s = String(a).replace(/\B(?=(\d{3})+(?!\d))/g, ".") + " €";
    return (neg ? "−" : "") + s;
  }
  const fmtM = n => fmtE(n);
  /* sume exacte cu „.” la mii (1.250.000) + citire tolerantă: „5.000.000”, „5 000 000”, „5,5 M”, „500k”, „1,2 mld” */
  const fmtInt = n => { n = Math.round(num(n, 0)); return (n < 0 ? "−" : "") + String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, "."); };
  const fmtFull = n => fmtInt(n) + " €";
  function parseAmt(s) {
    if (typeof s === "number") return isFinite(s) ? s : 0;
    let t = String(s == null ? "" : s).toLowerCase().replace(/€|eur[o]?/g, "").replace(/[\s  ]/g, "").replace(/−/g, "-");
    let mul = 1; const m = t.match(/(mld|miliard[e]?|mil[ioane]*|mln|m|k|mii)$/);
    if (m) { mul = /^mld|^miliard/.test(m[1]) ? 1e9 : /^k|^mii/.test(m[1]) ? 1e3 : 1e6; t = t.slice(0, -m[1].length); }
    if (mul > 1) { const parts = t.split(/[.,]/); t = parts.length > 1 ? parts.slice(0, -1).join("") + "." + parts[parts.length - 1] : parts[0]; }
    else t = t.replace(/\./g, "").replace(",", ".");
    const v = parseFloat(t); return isFinite(v) ? Math.round(v * mul) : 0;
  }
  const amtVal = el => el ? parseAmt(el.value) : 0;
  function setAmt(el, n) { if (el) el.value = fmtInt(Math.max(0, Math.round(num(n, 0)))); }
  /* câmp sumă: reformatează live (păstrează cursorul după cifre) când textul are doar cifre/puncte */
  function amtLive(el) {
    if (!el || !/^[\d.\s]*$/.test(el.value)) return;
    const pos = el.selectionStart == null ? el.value.length : el.selectionStart;
    const right = el.value.slice(pos).replace(/\D/g, "").length;
    const digits = el.value.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
    const nv = digits ? fmtInt(+digits) : ""; if (nv === el.value) return;
    el.value = nv; let p = nv.length, seen = 0;
    while (p > 0 && seen < right) { p--; if (/\d/.test(nv[p])) seen++; }
    try { el.setSelectionRange(p, p); } catch (e) { /* ignore */ }
  }
  /* „returnează” urmează suma (aceeași dobândă, implicit +12%) până când jucătorul îl modifică de mână (dataset.man) */
  function autoRep(amtEl, repEl) {
    if (!amtEl || !repEl || repEl.dataset.man) return;
    const a = amtVal(amtEl); if (!(a > 0)) return;
    const k = num(+repEl.dataset.k, 0) || (() => { const a0 = num(+amtEl.dataset.prev, 0), r0 = amtVal(repEl); return a0 > 0 && r0 >= a0 ? r0 / a0 : 1.12; })();
    repEl.dataset.k = k; amtEl.dataset.prev = a; setAmt(repEl, Math.round(a * k / 10000) * 10000);
  }
  const amtInput = (r, v, extra) => `<input class="cs-in cs-amt" type="text" inputmode="numeric" autocomplete="off" data-r="${r}" value="${fmtInt(v)}"${extra ? " " + extra : ""}>`;
  function colorHex(c, idx) {
    if (typeof c === "string" && /^#/.test(c)) return c;
    const D = Dt(), C = D && D.COLORS;
    if (C) {
      if (typeof c === "number" && C[c]) return C[c].hex || PAL[c % 6];
      if (typeof c === "string") { const f = C.find(x => x.id === c); if (f) return f.hex; }
    }
    if (typeof c === "number") return PAL[((c % 6) + 6) % 6];
    return PAL[(idx || 0) % 6];
  }
  function colorsList() {
    const D = Dt(); if (D && Array.isArray(D.COLORS) && D.COLORS.length) return D.COLORS.map((c, i) => ({ id: i, key: c.id, n: c.n || "", hex: c.hex || PAL[i % 6] }));
    const nm = ["Portocaliu", "Turcoaz", "Lavandă", "Verde", "Roz", "Auriu"];
    return PAL.map((h, i) => ({ id: i, key: i, n: nm[i], hex: h }));
  }
  function avatarsMeta() {
    const D = Dt(), A = Ar();
    const src = (D && D.AVATARS) || (A && A.AVATARS);
    if (Array.isArray(src) && src.length >= 10) return src.slice(0, 10).map((a, i) => ({ id: num(a.id, i), g: a.g || (i < 5 ? "m" : "f"), name: a.name || a.n || "", style: a.style || "" }));
    const nm = ["Andrei", "Mihai", "Radu", "Tudor", "Victor", "Ioana", "Elena", "Maria", "Ana", "Irina"];
    return nm.map((n, i) => ({ id: i, g: i < 5 ? "m" : "f", name: n, style: "" }));
  }
  const genderOfAv = av => { const m = avatarsMeta()[av]; return m ? m.g : (av >= 5 ? "f" : "m"); };

  /* --------------------------------------------------- artă (cu rezerve proprii) */
  function avatarSVG(av, size, mood, opts) {
    const A = Ar(); av = num(av, 0);
    if (A && typeof A.avatar === "function") { try { return A.avatar(av, size, mood || "neutral", opts || {}); } catch (e) { /* fallback */ } }
    const g = genderOfAv(av), skin = ["#f1c7a5", "#d9a57f", "#a8704e", "#7a4a30", "#efd2b8"][av % 5], hair = ["#2b1a10", "#6b3b1e", "#111", "#c99a48", "#3a2a22"][(av * 3) % 5];
    const ring = opts && opts.ring, flip = opts && opts.flip;
    const mouth = { happy: "M80 132 Q100 150 120 132", angry: "M82 140 Q100 128 118 140", smug: "M84 136 Q104 144 120 130", sad: "M82 142 Q100 130 118 142", thinking: "M86 138 L114 136" }[mood] || "M84 136 Q100 142 116 136";
    const brow = mood === "angry" ? '<path d="M70 92 L92 100 M130 92 L108 100" stroke="#2a1a12" stroke-width="5" stroke-linecap="round"/>' : '<path d="M70 94 Q81 88 92 94 M108 94 Q119 88 130 94" stroke="#2a1a12" stroke-width="4" fill="none" stroke-linecap="round"/>';
    const hairP = g === "f" ? `<path d="M48 110 Q40 40 100 34 Q160 40 152 110 L156 170 Q140 150 140 110 Q130 70 100 66 Q70 70 60 110 Q60 150 44 170 Z" fill="${hair}"/>` : `<path d="M56 96 Q54 42 100 38 Q148 42 144 96 Q136 66 100 64 Q66 66 56 96Z" fill="${hair}"/>`;
    return `<svg viewBox="0 0 200 200" width="${size}" height="${size}" style="${flip ? "transform:scaleX(-1);" : ""}border-radius:${ring ? "50%" : "18%"}">
      <defs><linearGradient id="fbg${av}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#21496a"/><stop offset="1" stop-color="#0d1f33"/></linearGradient></defs>
      <rect width="200" height="200" fill="url(#fbg${av})"/>
      <path d="M30 200 Q36 160 100 156 Q164 160 170 200Z" fill="${["#2c4b7a", "#7a2c3e", "#2f6b52", "#5b3d82", "#80602a"][av % 5]}"/>
      <rect x="86" y="140" width="28" height="22" fill="${skin}"/>
      <ellipse cx="100" cy="104" rx="44" ry="52" fill="${skin}"/>${hairP}${brow}
      <circle cx="82" cy="106" r="5" fill="#1b1b22"/><circle cx="118" cy="106" r="5" fill="#1b1b22"/>
      <path d="${mouth}" stroke="#6b2a22" stroke-width="5" fill="none" stroke-linecap="round"/>
      ${ring ? `<circle cx="100" cy="100" r="96" fill="none" stroke="${ring}" stroke-width="8"/>` : ""}</svg>`;
  }
  const RES = { aprobare: ["🛂", "Aprobare", "#3b6fd8"], infra: ["🏗️", "Infrastructură", "#9a6a3a"], echipaj: ["👨‍✈️", "Echipaj", "#2f8a5b"], combustibil: ["⛽", "Combustibil", "#b8423a"], joker: ["⭐", "Joker", "#e0a020"] };
  const SPEC = { freeze: ["❄️", "Îngheață timpul", "#4aa8e8"], breaker: ["🔥", "Spărgător de gheață", "#ef6a2c"], fastbuild: ["🚀", "Construcție rapidă", "#7d5be0"], vip: ["🎟️", "Permis VIP", "#c9a227"], boom: ["📈", "Boom de pasageri", "#2fae6e"], fuel: ["⛽", "Contract de combustibil", "#c0503c"], spy: ["🔍", "Spion", "#556070"], ads: ["📣", "Campanie de reclamă", "#e0508a"], insurance: ["🧯", "Asigurare", "#d04848"], slot: ["🏛️", "Slot suplimentar", "#4a7ab0"], giftplane: ["✈️", "Avion cadou", "#37a0c0"] };
  /* LOGIC: resurse = index 0..4, speciale = id scurt; DATA/ART: id-uri lungi */
  const RESK = ["aprobare", "infra", "echipaj", "combustibil", "joker"];
  const L2D = { frz: "freeze", brk: "breaker", fast: "fastbuild", vip: "vip", boom: "boom", fuel: "fuel", spy: "spy", ad: "ads", ins: "insurance", slot: "slot", gift: "giftplane",
    apr: "aprobare", inf: "infra", ech: "echipaj", comb: "combustibil", rapid: "fastbuild", fuelc: "fuel", insure: "insurance", gift_plane: "giftplane" };
  const D2L = { freeze: "frz", breaker: "brk", fastbuild: "fast", vip: "vip", boom: "boom", fuel: "fuel", spy: "spy", ads: "ad", insurance: "ins", slot: "slot", giftplane: "gift" };
  function cardKey(c) {
    if (c == null) return null;
    if (typeof c === "number") return RESK[c] || null;
    if (typeof c === "string") return /^\d$/.test(c) ? RESK[+c] : (L2D[c] || c);
    return cardKey(first(c.k, c.c, c.t, c.type, c.id, c.key, null));
  }
  function cardMeta(c) {
    const k = cardKey(c); const D = Dt(), A = Ar();
    const dc = D && D.CARDS && k && D.CARDS[k];
    let ai = null; if (A && typeof A.cardInfo === "function" && k) { try { ai = A.cardInfo(k); } catch (e) { ai = null; } }
    const fb = RES[k] || SPEC[k] || (k && Object.values(RES).concat(Object.values(SPEC)).find(v => v[1].toLowerCase().indexOf(String(k).toLowerCase()) === 0)) || ["🃏", String(k || "?"), "#4a6278"];
    const special = dc ? dc.kind === "special" : (ai ? !!ai.special : !!SPEC[k]);
    return { k, icon: (dc && dc.icon) || fb[0], name: (dc && dc.n) || (ai && ai.name) || fb[1], color: (ai && ai.color) || fb[2], special, d: (dc && dc.d) || "" };
  }
  function cardFaceSVG(c, w) {
    const A = Ar(), k = cardKey(c);
    if (A && typeof A.cardFace === "function") { try { return A.cardFace(k, { w }); } catch (e) { /* fallback */ } }
    const m = cardMeta(c);
    return `<svg viewBox="0 0 120 170" width="${w}" height="${Math.round(w * 170 / 120)}"><defs><linearGradient id="cf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${m.color}"/><stop offset="1" stop-color="#0e1a2a"/></linearGradient></defs>
      <rect x="2" y="2" width="116" height="166" rx="12" fill="url(#cf)" stroke="#fff6" stroke-width="2"/>
      ${m.special ? '<rect x="7" y="7" width="106" height="156" rx="9" fill="none" stroke="#ffd35c" stroke-width="2" stroke-dasharray="4 3"/>' : ""}
      <text x="60" y="88" font-size="46" text-anchor="middle">${m.icon}</text>
      <text x="60" y="138" font-size="13" font-weight="700" fill="#fff" text-anchor="middle" font-family="Barlow,system-ui">${esc(m.name.length > 15 ? m.name.slice(0, 14) + "…" : m.name)}</text></svg>`;
  }
  function cardBackSVG(w) {
    const A = Ar(); if (A && typeof A.cardBack === "function") { try { return A.cardBack({ w }); } catch (e) { /* fallback */ } }
    return `<svg viewBox="0 0 120 170" width="${w}" height="${Math.round(w * 170 / 120)}"><defs><linearGradient id="cb" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#173a5e"/><stop offset="1" stop-color="#0a1830"/></linearGradient>
      <pattern id="cbp" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="14" height="14" fill="none"/><path d="M0 7H14" stroke="#ffffff10" stroke-width="3"/></pattern></defs>
      <rect x="2" y="2" width="116" height="166" rx="12" fill="url(#cb)" stroke="#ffd35c99" stroke-width="2"/><rect x="2" y="2" width="116" height="166" rx="12" fill="url(#cbp)"/>
      <circle cx="60" cy="85" r="30" fill="none" stroke="#ffd35c" stroke-width="2.5"/><text x="60" y="97" font-size="32" text-anchor="middle">✈️</text></svg>`;
  }
  function artCall(fn, args, fb) { const A = Ar(); if (A && typeof A[fn] === "function") { try { return A[fn].apply(A, args); } catch (e) { /* fallback */ } } return fb; }
  const logoSVG = (name, color, size) => artCall("logo", [name || "?", color, size], `<svg viewBox="0 0 48 48" width="${size}" height="${size}"><circle cx="24" cy="24" r="22" fill="${color}"/><text x="24" y="30" font-size="16" font-weight="800" text-anchor="middle" fill="#0b1626" font-family="Barlow,system-ui">${esc(String(name || "?").split(/\s+/).map(w => w[0] || "").join("").slice(0, 2).toUpperCase())}</text></svg>`);
  const consultantSVG = (size, mood) => artCall("consultant", [size, mood], `<div style="font-size:${size * 0.7}px;line-height:1">🧑‍💼</div>`);
  const handshakeSVG = size => artCall("handshake", [size], `<div style="font-size:${size * 0.7}px;line-height:1">🤝</div>`);
  const officeSVG = () => artCall("office", [{ w: 1600, h: 900 }], OFFICE_FB());
  function OFFICE_FB() {
    const bld = []; let x = 330; let i = 0;
    while (x < 1270) { const w = 26 + ((i * 37) % 40), hh = 60 + ((i * 53) % 140); bld.push(`<rect x="${x}" y="${470 - hh}" width="${w}" height="${hh}" fill="#24344f"/>`); for (let wy = 470 - hh + 10; wy < 460; wy += 16) for (let wx = x + 5; wx < x + w - 5; wx += 9) if ((wx * 7 + wy * 3 + i) % 5 < 2) bld.push(`<rect x="${wx}" y="${wy}" width="4" height="6" fill="#ffd98a" opacity=".7"/>`); x += w + 6; i++; }
    return `<svg viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" width="100%" height="100%"><defs>
      <linearGradient id="ofw" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1b2a40"/><stop offset="1" stop-color="#0f1a2a"/></linearGradient>
      <linearGradient id="ofs" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2c4a7a"/><stop offset=".55" stop-color="#e88a5a"/><stop offset="1" stop-color="#f4c27a"/></linearGradient>
      <linearGradient id="ofr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a3f4a"/><stop offset="1" stop-color="#22262e"/></linearGradient></defs>
      <rect width="1600" height="900" fill="url(#ofw)"/>
      <rect x="300" y="60" width="1000" height="480" rx="10" fill="url(#ofs)"/>
      <circle cx="1050" cy="300" r="46" fill="#ffe7a8" opacity=".85"/>
      ${bld.join("")}
      <rect x="300" y="470" width="1000" height="70" fill="url(#ofr)"/><path d="M300 505 H1300" stroke="#f4f4f4" stroke-width="3" stroke-dasharray="30 22"/>
      <g fill="none" stroke="#0b1320" stroke-width="16"><rect x="300" y="60" width="1000" height="480" rx="10"/><path d="M633 60 V540 M966 60 V540"/></g>
      <rect x="0" y="540" width="1600" height="360" fill="#141f30"/><rect x="0" y="540" width="1600" height="8" fill="#0a111c"/>
      <g opacity=".9"><rect x="1380" y="380" width="70" height="160" rx="8" fill="#2a3a28"/><circle cx="1415" cy="350" r="60" fill="#2f6b3a"/><circle cx="1385" cy="320" r="40" fill="#3a8048"/><circle cx="1445" cy="315" r="38" fill="#2f6b3a"/></g>
      <g><rect x="120" y="150" width="120" height="8" fill="#4a3324"/><rect x="132" y="112" width="20" height="38" fill="#b9a3ff"/><rect x="156" y="104" width="16" height="46" fill="#5fd3dc"/><rect x="176" y="118" width="22" height="32" fill="#ff8a4c"/><rect x="120" y="260" width="120" height="8" fill="#4a3324"/><circle cx="160" cy="240" r="18" fill="#ffd35c"/></g></svg>`;
  }
  const iceHTML = () => artCall("iceOverlay", [], '<div class="cs-icefb"></div>');
  const starsSVG = (n, s) => artCall("stars", [n, s], "★★★★★".slice(0, Math.round(n)) + "☆☆☆☆☆".slice(0, 5 - Math.round(n)));

  /* ---------------------------------------------------- adaptoare de stare (LOGIC) */
  function seatsOf(st) {
    if (!st) return [];
    if (Array.isArray(st.ps)) return st.ps.slice();
    if (Array.isArray(st.players) && st.players.length && typeof st.players[0] === "string") return st.players.slice();
    if (Array.isArray(st.__pl)) return st.__pl.slice();
    const o = st.c || st.pl || st.p; if (o && typeof o === "object" && !Array.isArray(o)) return Object.keys(o).sort();
    return [];
  }
  function rawP(st, seat) {
    if (!st) return {};
    for (const k of ["c", "pl", "p", "co"]) { const o = st[k]; if (o && typeof o === "object" && !Array.isArray(o) && o[seat]) return o[seat]; }
    if (Array.isArray(st.players) && typeof st.players[0] === "object") { const f = st.players.find(x => x.seat === seat); if (f) return f; }
    return {};
  }
  function pinfo(st, seat, ctx) {
    const P = rawP(st, seat), pr = (P.prof && typeof P.prof === "object") ? P.prof : P;
    const seats = seatsOf(st), idx = Math.max(0, seats.indexOf(seat));
    const si = ctx && typeof ctx.seatInfo === "function" ? (ctx.seatInfo(seat) || {}) : {};
    let av = num(first(pr.av, pr.avatar), -1); if (av < 0 || av > 9) av = (idx * 3 + (idx % 2 ? 5 : 0)) % 10;
    const name = pr.name || pr.n || si.name || (ctx && ctx.names && ctx.names[seat]) || "Jucător " + (idx + 1);
    let col = first(pr.col, pr.color, -1); if (typeof col === "number" && col < 0) col = idx % 6;
    return {
      seat, idx, av, name, co: pr.co || pr.company || pr.cn || name + " Air", g: (pr.prof || pr.av >= 0) ? first(pr.g, genderOfAv(av)) : genderOfAv(av),
      color: colorHex(col, idx), colorId: col, prof: !!pr.prof,
      bot: !!first(P.bot, pr.bot, si.bot), ready: !!first(P.ready, pr.ready, st && st.ready && st.ready[seat]),
      tut: P.tut && typeof P.tut === "object" ? { step: num(P.tut.step, 1), of: num(P.tut.of, 20) } : null,
      vote: first(P.vote, st && st.votes && st.votes[seat], null), out: !!first(P.out, P.bankrupt, P.br, false),
      stars: num(first(P.stars, P.rep), 3), st: P.st || null, value: first(P.value, P.val), cash: first(P.cash, P.m)
    };
  }
  const phaseOf = st => (st && (st.phase || st.ph)) || null;

  /* ------------------------------------------------------- infrastructură scene */
  let cssDone = false;
  function injectCSS() {
    if (cssDone || typeof document === "undefined") return; cssDone = true;
    const A = Ar(); if (A && typeof A.css === "function") { try { A.css(); } catch (e) { /* ignore */ } }
    if (document.getElementById("cerul-scenes-css")) return;
    const s = document.createElement("style"); s.id = "cerul-scenes-css"; s.textContent = CSS; document.head.appendChild(s);
    try { window.CerulTheme && window.CerulTheme.inject(); } catch (e) { /* fără temă */ }
  }
  function makeHelp(o, h) {
    o = o || {}; h = h || {};
    const ctx = o.ctx || {};
    const send = a => { const f = o.send || h.send; if (typeof f === "function") { try { return f(a); } catch (e) { return false; } } return false; };
    const now = () => { const f = o.now || h.now; if (typeof f === "function") { try { return f(); } catch (e) { /* ignore */ } } return Date.now(); };
    const sfx = name => { const s = (ctx && ctx.sfx) || h.sfx; if (s && typeof s[name] === "function") { try { s[name](); } catch (e) { /* ignore */ } } };
    const fx = (fn, ...args) => { const f = (ctx && ctx.fx) || h.fx; if (f && typeof f[fn] === "function" && !RM()) { try { f[fn](...args); } catch (e) { /* ignore */ } } };
    const toast = t => { if (ctx && typeof ctx.toast === "function") ctx.toast(t); };
    const act = (type, payload) => send(Object.assign({ [ACT_KEY]: type }, payload || {}));
    return { send, now, sfx, fx, toast, act };
  }
  const VC = { st: null, seat: null, t: 0, v: null };
  function viewOf(o, h, H) {
    if (o && o.view) return o.view;
    const L = (h && h.Logic) || Lg();
    if (L && typeof L.view === "function" && o && o.st && o.seat) {
      const t = H.now(); if (VC.st === o.st && VC.seat === o.seat && Math.abs(t - VC.t) < 400) return VC.v;
      try { VC.v = L.view(o.st, o.seat, t); VC.st = o.st; VC.seat = o.seat; VC.t = t; return VC.v; } catch (e) { return null; } }
    return null;
  }
  function base(container, cls, o) {
    injectCSS();
    const el = document.createElement("div");
    el.className = "cs-root " + cls + (RM() ? " cs-rm" : "");
    if (container === document.body) el.style.position = "fixed";
    container.appendChild(el);
    const timers = new Set(), cleanups = [];
    const S = {
      el, dead: false,
      t(fn, ms) { const id = setTimeout(() => { timers.delete(id); if (!S.dead) fn(); }, ms); timers.add(id); return id; },
      iv(fn, ms) { const id = setInterval(() => { if (!S.dead) fn(); }, ms); timers.add(id); cleanups.push(() => clearInterval(id)); return id; },
      on(t, ev, fn, opt) { t.addEventListener(ev, fn, opt); cleanups.push(() => t.removeEventListener(ev, fn, opt)); },
      fit() { const w = el.clientWidth || (W.innerWidth || 1200); el.classList.toggle("cs-phone", w < 700); el.classList.toggle("cs-narrow", w < 1100); },
      destroy() { S.dead = true; timers.forEach(clearTimeout); cleanups.forEach(f => { try { f(); } catch (e) { /* ignore */ } }); if (el.parentNode) el.parentNode.removeChild(el); }
    };
    S.fit(); if (W.addEventListener) S.on(W, "resize", () => S.fit());
    return S;
  }
  const setH = (el, h) => { if (el && el._h !== h) { el.innerHTML = h; el._h = h; } };
  const q = (el, s) => el.querySelector(s), qa = (el, s) => Array.from(el.querySelectorAll(s));
  function countUp(el, from, to, ms, fmt) {
    if (!el) return; if (RM() || ms <= 0) { el.textContent = fmt(to); return; }
    const t0 = performance.now();
    const step = t => { const k = clamp((t - t0) / ms, 0, 1), e = 1 - Math.pow(1 - k, 3); el.textContent = fmt(from + (to - from) * e); if (k < 1 && el.isConnected) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }
  function sparks(host, x, y, color, n) {
    if (RM()) return; n = n || 18;
    for (let i = 0; i < n; i++) {
      const s = document.createElement("i"); s.className = "cs-spark"; const a = Math.random() * Math.PI * 2, d = 40 + Math.random() * 90;
      s.style.cssText = `left:${x}px;top:${y}px;background:${color || "#ffd35c"};--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d}px`;
      host.appendChild(s); setTimeout(() => s.remove(), 900);
    }
  }
  function confettiIn(host) {
    const A = Ar(); if (A && typeof A.confetti === "function") { try { A.confetti(host); return; } catch (e) { /* fallback */ } }
    if (RM()) return; const cols = ["#ffd35c", "#ff8a4c", "#5fd3dc", "#b9a3ff", "#7be07b", "#ff6fa8"];
    for (let i = 0; i < 90; i++) {
      const c = document.createElement("i"); c.className = "cs-conf";
      c.style.cssText = `left:${Math.random() * 100}%;background:${cols[i % 6]};animation-delay:${Math.random() * 0.8}s;animation-duration:${2.2 + Math.random() * 1.6}s;--rx:${(Math.random() - 0.5) * 220}px`;
      host.appendChild(c); setTimeout(() => c.remove(), 4800);
    }
  }

  /* ================================================================== SETUP / LOBBY */
  const DURS = [{ v: 60, n: "1 oră", d: "partidă scurtă", ic: "⏱️" }, { v: 120, n: "2 ore", d: "clasic", ic: "🕑" }, { v: 180, n: "3 ore", d: "maraton", ic: "🕒" }, { v: 0, n: "Fără timp", d: "până rămâne unul", ic: "♾️" }];
  const DAYS = [{ v: 1, n: "Normal", d: "1 min / zi", ic: "✈️" }, { v: 2, n: "Relaxat", d: "2 min / zi", ic: "☕" }, { v: 3, n: "Lung", d: "3 min / zi", ic: "🌙" }];
  /* setările de start votate (LOGIC-2): bani la start și frecvența evenimentelor; lipsă = „normal” */
  const MONEY_K = ["low", "normal", "high"], EV_K = ["few", "normal", "many"];
  function normOpt(x, K) {
    if (x == null || x === "") return null;
    if (typeof x === "number") return K[clamp(Math.round(x < 0 ? x + 1 : x), 0, 2)] || null; // -1/0/1 sau 0/1/2
    const s = fold(String(x));
    if (K.indexOf(s) >= 0) return s;
    if (/^(low|lo|mic|putin|few|rar|0$)/.test(s)) return K[0];
    if (/^(high|hi|mult|mare|many|des|2$)/.test(s)) return K[2];
    return K[1];
  }
  function startMoneyAmts() {
    const T = Tn() || {}, L = Lg(); let K = {}; try { K = (L && typeof L.tune === "function" && L.tune()) || {}; } catch (e) { K = {}; }
    const base = num(first(T.startCash, K.startCash, T.start && T.start.cash), 20e6);
    const opt = first(T.startCashOpts, T.startMoney, K.startCashOpts, T.start && T.start.cashOpts, null);
    const g = k => { const v = opt && (Array.isArray(opt) ? opt[MONEY_K.indexOf(k)] : opt[k]); return typeof v === "number" ? (v < 10 ? base * v : v) : null; };
    return { low: first(g("low"), base * 0.6), normal: first(g("normal"), base), high: first(g("high"), base * 1.75) }; // LOGIC-2: ×0,6 / ×1 / ×1,75
  }
  function moneyOpts() {
    const a = startMoneyAmts();
    return [{ v: "low", n: "Puțini", d: a.low ? fmtE(a.low) : "start greu", ic: "🪙" }, { v: "normal", n: "Normal", d: a.normal ? fmtE(a.normal) : "echilibrat", ic: "💶" }, { v: "high", n: "Mulți", d: a.high ? fmtE(a.high) : "start ușor", ic: "💰" }];
  }
  const EVS = [{ v: "few", n: "Puține", d: "joc liniștit", ic: "🌤️" }, { v: "normal", n: "Normale", d: "ca de obicei", ic: "⛅" }, { v: "many", n: "Multe", d: "haos pe cer", ic: "⛈️" }];
  function setupVM(st, seat, ctx) {
    const seats = seatsOf(st), S = (st && (st.su || st.setup)) || {};
    const players = seats.map(s => {
      const p = pinfo(st, s, ctx);
      const v = p.vote || (S.votes && S.votes[s]) || null;
      p.hasProf = p.prof || p.bot;
      if (p.bot) { p.ready = true; p.tut = null; }
      p.vote = v ? { dur: num(first(v.dur, v.d), null), day: num(first(v.day, v.dl), null), money: normOpt(first(v.money, v.cash, v.sc, v.start), MONEY_K), ev: normOpt(first(v.ev, v.evf, v.events, v.evq), EV_K) } : null;
      return p;
    });
    const T = Tn() || {}, at = num(first(S.at, S.dl), 0);
    const dl = S.at ? at + num(T.setupResolveSec, 30) * 1000 / num(st.sp, 1) : at;
    const tutBusy = players.some(p => !p.bot && p.tut);
    return { seats, players, me: players.find(p => p.seat === seat) || null, dl: tutBusy ? 0 : dl, tutBusy };
  }
  function tally(players, key) { const m = {}; players.forEach(p => { if (p.bot || !p.vote || p.vote[key] == null) return; (m[p.vote[key]] = m[p.vote[key]] || []).push(p); }); return m; }

  function sceneSetup(container, o, h) {
    const S = base(container, "cs-setup", o), H = makeHelp(o, h);
    let O = o, local = null, sendT = 0, lastKey = "";
    const el = S.el;
    el.innerHTML = `<div class="cs-sky"><i class="cs-cloud c1"></i><i class="cs-cloud c2"></i><i class="cs-cloud c3"></i><div class="cs-jet">${artCall("planeSide", ["a320", "#ff8a4c", { w: 240 }], "✈️")}</div></div>
      <div class="cs-setup-in">
        <header class="cs-su-head"><div class="cs-brand"><span class="cs-globe">🌍</span><div><h1>Cerul Lumii</h1><p>Construiește cea mai valoroasă companie aeriană din lume</p></div></div><div class="cs-su-status" data-r="status"></div></header>
        <div class="cs-su-grid">
          <section class="cs-card cs-prof"><h2>Profilul tău</h2>
            <div class="cs-prof-top"><div class="cs-bigav" data-r="bigav"></div>
              <div class="cs-prof-f"><label>Numele tău<input class="cs-in" data-f="name" maxlength="16" autocomplete="off"></label>
              <div class="cs-gsel"><span>Cum să-ți spunem</span><div class="cs-seg" data-r="gsel"><button data-g="m">el</button><button data-g="f">ea</button></div></div>
              <label>Numele companiei<div class="cs-co-row"><span data-r="logo"></span><input class="cs-in" data-f="co" maxlength="22" autocomplete="off"></div></label>
              <div class="cs-sugs" data-r="sugs"></div></div></div>
            <div class="cs-lbl">Alege-ți personajul</div><div class="cs-avs" data-r="avs"></div>
            <div class="cs-lbl">Culoarea companiei</div><div class="cs-cols" data-r="cols"></div>
          </section>
          <section class="cs-card cs-votes"><h2>Votați partida</h2>
            <div class="cs-lbl">Cât durează jocul</div><div class="cs-vt cs-vt4" data-r="dur"></div>
            <div class="cs-lbl">Cât durează o zi în joc</div><div class="cs-vt cs-vt3" data-r="day"></div>
            <div class="cs-lbl">Bani la start</div><div class="cs-vt cs-vt3" data-r="money"></div>
            <div class="cs-lbl">Evenimente</div><div class="cs-vt cs-vt3" data-r="ev"></div>
            <div class="cs-vres" data-r="vres"></div>
          </section>
          <section class="cs-card cs-crew"><h2>La masă</h2><div class="cs-plist" data-r="plist"></div>
            <div class="cs-tutq" data-r="tutq"></div><button class="cs-btn cs-go" data-r="ready"></button><div class="cs-hint" data-r="hint"></div><button class="cs-chip cs-reset" data-reset="1" title="Locuri blocate? Golește masa și așezați-vă din nou" style="margin:10px auto 0;display:flex;gap:6px;align-items:center;border-color:rgba(255,120,120,.45)">🔄 Resetează masa</button></section>
        </div></div>`;
    const R = k => q(el, `[data-r="${k}"]`);
    const avs = avatarsMeta();
    function myDefault(vm) {
      const me = vm.me; if (!me) return null;
      const taken = new Set(vm.players.filter(p => p.seat !== me.seat).map(p => String(p.colorId)));
      let col = me.colorId; if (taken.has(String(col))) col = colorsList().map(c => c.id).find(c => !taken.has(String(c))) || 0;
      return { av: me.av, name: me.name, co: me.co, color: col, g: me.g === "f" ? "f" : "m", gSet: !!(me.prof && me.g && me.g !== genderOfAv(me.av)) };
    }
    function pushProf(now) {
      clearTimeout(sendT);
      const go = () => { if (!local) return; H.act("prof", { av: local.av, name: (local.name || "").trim().slice(0, 16) || "Pilot", co: (local.co || "").trim().slice(0, 22) || "Air", color: local.color, g: local.g || genderOfAv(local.av) }); };
      if (now) go(); else sendT = setTimeout(go, 450);
    }
    function draw() {
      const vm = setupVM(O.st, O.seat, O.ctx), me = vm.me, spect = !me;
      if (!local && me) { local = myDefault(vm); if (local && (!me.hasProf || local.color !== me.colorId)) pushProf(true); }
      const ready = !!(me && me.ready);
      el.classList.toggle("cs-ro", spect || ready);
      // avatar mare + logo
      const L = local || (me ? { av: me.av, name: me.name, co: me.co, color: me.colorId, g: me.g } : { av: 0, name: "", co: "", color: 0, g: "m" });
      const col = colorHex(L.color, 0);
      const key = JSON.stringify([L, ready]);
      if (key !== lastKey) {
        lastKey = key;
        R("bigav").innerHTML = avatarSVG(L.av, 150, ready ? "happy" : "smug", { ring: col });
        qa(R("gsel"), "[data-g]").forEach(b => { b.classList.toggle("on", b.dataset.g === (L.g === "f" ? "f" : "m")); b.disabled = spect || ready; });
        R("logo").innerHTML = logoSVG(L.co, col, 40);
        R("avs").innerHTML = avs.map(a => `<button class="cs-av${a.id === L.av ? " on" : ""}" data-av="${a.id}" title="${esc(a.name)}" ${spect || ready ? "disabled" : ""}>${avatarSVG(a.id, 64, "neutral", {})}<span>${esc(a.name)}</span></button>`).join("");
        const sug = avs[L.av] ? avs[L.av].name : "";
        const cos = ["Air", "Airways", "Wings", "Sky", "Jet"].map(x => (L.name || sug || "Cer").split(" ")[0] + " " + x);
        R("sugs").innerHTML = (sug && sug !== L.name ? `<button class="cs-chip" data-sug-name="${esc(sug)}">👤 ${esc(sug)}</button>` : "") + cos.filter(c => c !== L.co).slice(0, 3).map(c => `<button class="cs-chip" data-sug-co="${esc(c)}">🏷️ ${esc(c)}</button>`).join("");
      }
      const fn = q(el, '[data-f="name"]'), fc = q(el, '[data-f="co"]');
      if (document.activeElement !== fn) fn.value = L.name || ""; if (document.activeElement !== fc) fc.value = L.co || "";
      fn.disabled = fc.disabled = spect || ready;
      // culori
      const takenBy = {}; vm.players.forEach(p => { if (!me || p.seat !== me.seat) takenBy[String(p.colorId)] = p; });
      R("cols").innerHTML = colorsList().map(c => { const t = takenBy[String(c.id)]; return `<button class="cs-col${String(c.id) === String(L.color) ? " on" : ""}" data-col="${c.id}" style="--c:${c.hex}" ${t || spect || ready ? "disabled" : ""} title="${esc(c.n)}${t ? " — " + esc(t.name) : ""}">${t ? avatarSVG(t.av, 26, "neutral", { ring: c.hex }) : ""}</button>`; }).join("");
      // voturi
      const td = tally(vm.players, "dur"), ty = tally(vm.players, "day"), mv = (me && me.vote) || {};
      const tile = (it, t, mine, kind) => `<button class="cs-vtile${mine ? " on" : ""}" data-${kind}="${it.v}" ${spect || ready ? "disabled" : ""}><span class="ic">${it.ic}</span><b>${it.n}</b><small>${it.d}</small><span class="cs-voters">${(t || []).map(p => `<i style="--c:${p.color}">${avatarSVG(p.av, 22, "neutral", { ring: p.color })}</i>`).join("")}</span></button>`;
      setH(R("dur"), DURS.map(it => tile(it, td[it.v], mv.dur === it.v, "dur")).join(""));
      setH(R("day"), DAYS.map(it => tile(it, ty[it.v], mv.day === it.v, "day")).join(""));
      const tm = tally(vm.players, "money"), te = tally(vm.players, "ev"), MO = moneyOpts();
      setH(R("money"), MO.map(it => tile(it, tm[it.v], (mv.money || "normal") === it.v && !!me && !!me.vote, "money")).join(""));
      setH(R("ev"), EVS.map(it => tile(it, te[it.v], (mv.ev || "normal") === it.v && !!me && !!me.vote, "ev")).join(""));
      const humans = vm.players.filter(p => !p.bot);
      const agreeK = (k, dflt) => humans.length && humans.every(p => p.vote && first(p.vote[k], dflt) === first(humans[0].vote[k], dflt) && first(p.vote[k], dflt) != null);
      const agreeD = agreeK("dur"), agreeY = agreeK("day"), agreeM = agreeK("money", "normal"), agreeE = agreeK("ev", "normal");
      const maj = t => { let best = null, n = -1; Object.keys(t).forEach(k => { if (t[k].length > n) { n = t[k].length; best = k; } }); return best; };
      const md = maj(td), my = maj(ty), mm = maj(tm), me2 = maj(te);
      const nmOf = (arr, v) => ((arr.find(d => String(d.v) === String(v)) || {}).n || "?").toLowerCase();
      if (agreeD && agreeY && agreeM && agreeE) { const v0 = humans[0].vote; setH(R("vres"), `<span class="ok">✔ Toți ați votat la fel: <b>${DURS.find(d => d.v === v0.dur).n}</b>, zile de <b>${v0.day} min</b>, bani <b>${nmOf(MO, v0.money || "normal")}</b>, evenimente <b>${nmOf(EVS, v0.ev || "normal")}</b></span>`); }
      else { const bits = []; if (md != null) bits.push(`<b>${(DURS.find(d => d.v === +md) || {}).n || "?"}</b>`); if (my != null) bits.push(`<b>${my} min/zi</b>`); if (mm != null) bits.push(`bani <b>${nmOf(MO, mm)}</b>`); if (me2 != null) bits.push(`evenimente <b>${nmOf(EVS, me2)}</b>`);
        setH(R("vres"), `<span>Voturile nu se potrivesc încă${bits.length ? ` — majoritatea: ${bits.join(", ")}` : ""}. După 30 s gazda alege majoritatea.</span>`); }
      // jucători
      setH(R("plist"), vm.players.map(p => `<div class="cs-pl${p.ready ? " rd" : ""}" style="--c:${p.color}"><div class="cs-pl-av">${avatarSVG(p.av, 54, p.ready ? "happy" : "neutral", { ring: p.color })}</div>
        <div class="cs-pl-t"><b>${esc(p.name)}${me && p.seat === me.seat ? ' <em>(tu)</em>' : ""}${p.bot ? ' <em class="bot">bot</em>' : ""}</b><span>${logoSVG(p.co, p.color, 18)} ${esc(p.co)}</span>
        <small>${p.vote ? `${(DURS.find(d => d.v === p.vote.dur) || {}).n || "—"} · ${p.vote.day || "—"} min/zi${p.vote.money && p.vote.money !== "normal" ? " · bani " + nmOf(MO, p.vote.money) : ""}${p.vote.ev && p.vote.ev !== "normal" ? " · ev. " + nmOf(EVS, p.vote.ev) : ""}` : (p.bot ? "acceptă orice" : "n-a votat încă")}</small></div>
        <div class="cs-pl-s">${p.tut ? `<span class="cs-tutchip" title="Joacă meciul de antrenament">🎓 în tutorial <small>(pasul ${p.tut.step}/${p.tut.of})</small></span>` : p.ready ? `✔ ${gx(p.g, "Gata", "Gata")}` : `<span class="cs-dots" title="își alege profilul"><i></i><i></i><i></i></span>`}</div></div>`).join(""));
      const rb = R("ready"), inTut = !!(me && me.tut), tutLocal = !!(W.CerulTutorial && W.CerulTutorial.active());
      rb.style.display = spect ? "none" : "";
      rb.className = "cs-btn cs-go" + (ready ? " on" : "") + (!ready ? " cs-go2" : "");
      rb.innerHTML = ready ? "✔ Ești gata — apasă ca să modifici" : inTut ? "Ies din tutorial — sunt gata" : "Știu jocul — sunt gata";
      setH(R("tutq"), spect || ready ? "" : inTut ? `<button class="cs-btn cs-tutb" data-tut-go="1">${tutLocal ? "🎓 Ești în tutorial…" : "🎓 Continuă tutorialul"}</button>`
        : `<button class="cs-btn cs-tutb" data-tut-go="1">🎓 Fac tutorialul <small>(~10 min)</small></button><div class="cs-tutd">Un meci de antrenament doar pe ecranul tău, contra unui bot. Partida reală pornește după ce toți sunt gata.</div>`);
      const notReady = vm.players.filter(p => !p.ready && !p.tut), inT = vm.players.filter(p => !p.bot && p.tut);
      const left = vm.dl ? Math.max(0, Math.ceil((vm.dl - H.now()) / 1000)) : 0;
      setH(R("hint"), spect ? "Privești pregătirea partidei." : inT.length ? `🎓 Așteptăm să termine tutorialul: ${inT.map(p => `<b>${esc(p.name)}</b> (${p.tut.step}/${p.tut.of})`).join(", ")}${notReady.length ? ` · și pe ${notReady.map(p => me && p.seat === me.seat ? "tine" : esc(p.name)).join(", ")}` : ""}. Jocul și ceasul pornesc când toți sunt gata.`
        : notReady.length ? `Așteptăm: ${notReady.map(p => esc(p.name)).join(", ")}${left ? ` · pornire automată în <b>${left}</b> s` : ""}` : "Toți sunt gata — decolăm!");
      setH(R("status"), `<b>${vm.players.length}</b> companii · ${vm.players.filter(p => p.ready).length} gata${vm.tutBusy ? ` · ${vm.players.filter(p => !p.bot && p.tut).length} în tutorial` : ""}`);
    }
    let pv = null; // vot local trimis, până îl confirmă gazda
    S.on(el, "click", e => {
      const b = e.target.closest("button"); if (!b || b.disabled) return;
      if (b.dataset.reset) { const cx = (O && O.ctx) || {}, f = cx.resetTable || (h && h.resetTable); if (typeof f === "function") f(); else { const rb = document.getElementById("resetTableBtn"); if (rb) rb.click(); } return; }
      if (b.dataset.g && local) { local.g = b.dataset.g === "f" ? "f" : "m"; local.gSet = true; H.sfx("tick"); pushProf(true); draw(); }
      else if (b.dataset.av != null && local) { local.av = +b.dataset.av; if (!local.gSet) local.g = genderOfAv(local.av); const sug = avatarsMeta()[local.av]; H.sfx("select"); if (sug && (!local.name || avatarsMeta().some(a => a.name === local.name))) local.name = sug.name; pushProf(true); draw(); }
      else if (b.dataset.col != null && local) { local.color = isNaN(+b.dataset.col) ? b.dataset.col : +b.dataset.col; H.sfx("pop"); pushProf(true); draw(); }
      else if (b.dataset.sugName && local) { local.name = b.dataset.sugName; H.sfx("tick"); pushProf(true); draw(); }
      else if (b.dataset.sugCo && local) { local.co = b.dataset.sugCo; H.sfx("tick"); pushProf(true); draw(); }
      else if (b.dataset.dur != null || b.dataset.day != null || b.dataset.money != null || b.dataset.ev != null) {
        // celelalte voturi din ultima mea alegere încă neconfirmată de gazdă, altfel din stare
        const vm = setupVM(O.st, O.seat, O.ctx), mv = (pv && Date.now() - pv.t < 6000) ? pv : ((vm.me && vm.me.vote) || {});
        const dur = b.dataset.dur != null ? +b.dataset.dur : num(mv.dur, 120), day = b.dataset.day != null ? +b.dataset.day : num(mv.day, 1);
        const money = b.dataset.money || mv.money || "normal", ev = b.dataset.ev || mv.ev || "normal";
        pv = { dur, day, money, ev, t: Date.now() };
        H.sfx("select"); H.act("vote", { dur, day, money, ev });
      } else if (b.dataset.tutGo) {
        const vm = setupVM(O.st, O.seat, O.ctx); if (!vm.me || vm.me.ready) return;
        startTutorial(vm);
      } else if (b.dataset.r === "ready") {
        const vm = setupVM(O.st, O.seat, O.ctx); if (!vm.me) return;
        if (!vm.me.ready) { pushProf(true); const mv = vm.me.vote || {}; if (mv.dur == null || mv.day == null) H.act("vote", { dur: num(mv.dur, 120), day: num(mv.day, 1) }); H.sfx("start"); } else H.sfx("click");
        H.act("ready", { on: !vm.me.ready });
      }
    });
    // meciul de antrenament (cerul-tutorial.js): local; în rețea pleacă DOAR acțiunea `tut {step, of}` și la final `ready {}`
    function startTutorial(vm) {
      const T = W.CerulTutorial; if (!T || !T.start) { H.toast("Tutorialul se încarcă…"); return; }
      if (T.active()) return;
      pushProf(true);
      const mv = vm.me.vote || {}; if (mv.dur == null || mv.day == null) H.act("vote", { dur: num(mv.dur, 120), day: num(mv.day, 1) });
      const L = local || { av: vm.me.av, name: vm.me.name, co: vm.me.co, color: vm.me.colorId, g: vm.me.g };
      H.act("tut", { step: 1, of: T.STEPS_N }); H.sfx("start");
      let lastStep = 0;
      const api = T.start({ profile: { av: L.av, name: L.name, co: L.co, color: L.color, g: L.g || genderOfAv(L.av) }, ctx: O.ctx,
        onStep: (i, n) => { if (i !== lastStep) { lastStep = i; H.act("tut", { step: i, of: n }); } },
        onExit: () => { H.act("ready", { on: true }); H.sfx("start"); } });
      if (!api) H.act("tut", { off: true });
      draw();
    }
    S.on(el, "input", e => { const f = e.target.dataset && e.target.dataset.f; if (!f || !local) return; local[f] = e.target.value; R("logo").innerHTML = logoSVG(local.co, colorHex(local.color), 40); pushProf(false); });
    S.iv(() => { const vm = setupVM(O.st, O.seat, O.ctx); if (vm.dl) draw(); }, 1000);
    draw();
    return { el, update(n) { O = Object.assign({}, O, n); draw(); }, destroy() { clearTimeout(sendT); S.destroy(); } };
  }

  /* ================================================================== DRAFT */
  function draftVM(st, seat, view) {
    const d = (st && (st.dr || st.draft)) || {};
    const tk = d.tk || null;
    const cards = (d.cards || d.c || []).map((c, i) => {
      const o = (c && typeof c === "object") ? c : { k: c };
      const by = tk ? tk[i] : first(o.by, o.s, null);
      return { i, k: cardKey(o.k !== undefined ? o.k : o), by: by == null ? null : by, no: null };
    });
    const order = d.ord || d.order || [];
    // numărul alegerii (pentru banda de ordine): a câta alegere a jucătorului
    const cnt = {}; order.forEach((s, j) => { cnt[s] = cnt[s] || []; cnt[s].push(j); });
    const used = {}; cards.forEach(c => { if (c.by != null) { used[c.by] = (used[c.by] || 0); }});
    const turn = num(first(d.i, d.turn), cards.filter(c => c.by != null).length);
    let whI = d.wh ? d.wh[seat] : undefined; if (whI && typeof whI === "object") whI = whI.i;
    const whisper = whI != null && cards[whI] ? { i: whI, k: cards[whI].k } : null;
    return { cards, order, turn, cur: (d.rv || d.rev) ? null : (order[turn] || null), dl: num(first(d.t, d.dl), 0), rev: !!first(d.rv, d.rev, false), day: num(first(st && st.day), null), whisper };
  }
  function sceneDraft(container, o, h) {
    const S = base(container, "cs-draft", o), H = makeHelp(o, h);
    let O = o, seen = {}, revDone = false, revAt = 0, lastCur = null, picked = false, lastTurn = -1, seq = [];
    const el = S.el;
    el.innerHTML = `<div class="cs-felt"></div><div class="cs-dr-in">
      <header class="cs-dr-head"><div><h1 data-r="title">Sfârșitul zilei</h1><p data-r="sub">Cărțile sunt cu fața în jos. Fiecare alege pe rând, pe nevăzute.</p></div><div class="cs-dr-timer" data-r="timer"><svg viewBox="0 0 44 44"><circle cx="22" cy="22" r="19" class="bg"/><circle cx="22" cy="22" r="19" class="fg" data-r="ring"/></svg><b data-r="secs">10</b></div></header>
      <div class="cs-order" data-r="order"></div>
      <div class="cs-table"><div class="cs-cards" data-r="cards"></div><div class="cs-banner" data-r="banner"></div></div>
      <footer class="cs-dr-foot"><div class="cs-mine"><span class="cs-lbl">Ai luat</span><div class="cs-mine-c" data-r="mine"></div></div><div class="cs-dr-pls" data-r="pls"></div><div class="cs-whisper" data-r="whisper"></div></footer></div>`;
    const R = k => q(el, `[data-r="${k}"]`);
    function cardEl(c, vm, me) {
      const shown = c.by != null || vm.rev, mineTurn = vm.cur === me && c.by == null && !vm.rev && !picked;
      const who = c.by != null ? pinfo(O.st, c.by, O.ctx) : null;
      const wh = vm.whisper && vm.whisper.i === c.i && c.by == null && !vm.rev;
      return `<button class="cs-dc${shown ? " up" : ""}${mineTurn ? " can" : ""}${c.by == null && vm.rev ? " missed" : ""}${wh ? " wh" : ""}" data-i="${c.i}" ${mineTurn ? "" : "tabindex=-1"} style="--d:${(c.i % 8) * 40}ms${who ? ";--c:" + who.color : ""}" aria-label="${shown ? esc(cardMeta(c.k).name) : "carte cu fața în jos"}">
        <span class="cs-flip"><span class="cs-back">${cardBackSVG(120)}</span><span class="cs-face">${c.k ? cardFaceSVG(c.k, 120) : cardBackSVG(120)}</span></span>
        ${who ? `<span class="cs-by">${avatarSVG(who.av, 30, "happy", { ring: who.color })}</span>` : ""}${wh ? '<span class="cs-eye">👁️</span>' : ""}</button>`;
    }
    function draw() {
      const vm = draftVM(O.st, O.seat, O.view), me = O.seat;
      const pl = {}; seatsOf(O.st).forEach(s => pl[s] = pinfo(O.st, s, O.ctx));
      if (vm.turn !== lastTurn) { picked = false; lastTurn = vm.turn; }
      R("title").textContent = vm.rev ? "Ce ați ratat" : `Sfârșitul zilei${vm.day ? " " + vm.day : ""} — tragerea cărților`;
      const cp = vm.cur && pl[vm.cur];
      R("sub").innerHTML = vm.rev ? "Iată cărțile pe care nu le-a ales nimeni." : vm.cur === me ? `<b class="me">E rândul tău!</b> Alege o carte cu fața în jos.` : cp ? `Alege <b style="color:${cp.color}">${esc(cp.name)}</b>…` : "Se amestecă…";
      // ordinea (șarpe)
      vm.cards.forEach(c => { if (c.by != null && seq.indexOf(c.i) < 0) seq.push(c.i); });
      const nth = {}; const bySeat = {}; seq.forEach(ci => { const c = vm.cards[ci]; if (c) (bySeat[c.by] = bySeat[c.by] || []).push(c); });
      setH(R("order"), vm.order.map((s, i) => { const p = pl[s] || pinfo(O.st, s, O.ctx); nth[s] = (nth[s] || 0) + 1; const c = (bySeat[s] || [])[nth[s] - 1] || null; const done = i < vm.turn || vm.rev;
        return `<div class="cs-os${i === vm.turn && !vm.rev ? " cur" : ""}${done ? " done" : ""}" style="--c:${p.color}" title="${esc(p.name)}">${avatarSVG(p.av, 40, i === vm.turn ? "thinking" : "neutral", { ring: p.color })}${done && c && c.k ? `<span class="cs-om">${cardMeta(c.k).icon}</span>` : `<span class="cs-on">${i + 1}</span>`}</div>`; }).join('<i class="cs-oarr">›</i>'));
      // cărți: construim o singură dată, apoi doar clase
      const box = R("cards");
      if (box.children.length !== vm.cards.length) { box.innerHTML = vm.cards.map(c => cardEl(c, vm, me)).join(""); box.style.setProperty("--n", vm.cards.length); vm.cards.forEach(c => { if (c.by != null) seen[c.i] = 1; }); if (!RM()) qa(box, ".cs-dc").forEach((b, i) => { b.classList.add("deal"); b.style.animationDelay = (i * 45) + "ms"; }); H.sfx("shuffle"); }
      else vm.cards.forEach(c => {
        const b = box.children[c.i]; if (!b) return;
        const fresh = c.by != null && !seen[c.i];
        if (fresh || (vm.rev && !b.classList.contains("up")) || !!(vm.whisper && vm.whisper.i === c.i && c.by == null && !vm.rev) !== b.classList.contains("wh") || (vm.cur === me && !picked && c.by == null && !vm.rev) !== b.classList.contains("can")) {
          const nb = document.createElement("div"); nb.innerHTML = cardEl(c, vm, me); const ne = nb.firstElementChild;
          if (fresh) { ne.classList.remove("up"); box.replaceChild(ne, b); seen[c.i] = 1; requestAnimationFrame(() => requestAnimationFrame(() => { ne.classList.add("up", "pop"); }));
            H.sfx("flip"); const r = ne.getBoundingClientRect(), rr = el.getBoundingClientRect(); const who = pl[c.by]; S.t(() => sparks(el, r.left - rr.left + r.width / 2, r.top - rr.top + r.height / 2, who && who.color, 16), 260);
            if (c.by === me) { H.sfx("chime"); } }
          else box.replaceChild(ne, b);
        }
      });
      if (vm.rev && !revDone) { revDone = true; revAt = Date.now(); H.sfx("deal"); qa(box, ".cs-dc.missed").forEach((b, i) => { b.classList.remove("up"); S.t(() => { b.classList.add("up"); H.sfx("flip"); }, 300 + i * 160); }); R("banner").innerHTML = "<span>Ce ați ratat</span>"; R("banner").classList.add("on"); }
      // jucătorii și câte au luat
      setH(R("pls"), Object.values(pl).map(p => { const n = vm.cards.filter(c => c.by === p.seat).length, tot = vm.order.filter(s => s === p.seat).length || 3; return `<span class="cs-dpl${vm.cur === p.seat && !vm.rev ? " cur" : ""}" style="--c:${p.color}">${avatarSVG(p.av, 30, "neutral", { ring: p.color })}<b>${esc(p.name)}</b><i>${n}/${tot}</i></span>`; }).join(""));
      el.classList.toggle("rev", vm.rev);
      // ale mele
      const mine = vm.cards.filter(c => c.by === me && me);
      setH(R("mine"), mine.length ? mine.map(c => `<span class="cs-mc">${cardFaceSVG(c.k, 46)}</span>`).join("") : '<span class="cs-muted">încă nimic</span>');
      el.querySelector(".cs-mine").style.display = me ? "" : "none";
      // șoapta consultantului
      const w = vm.whisper && !vm.rev && vm.cards[vm.whisper.i] && vm.cards[vm.whisper.i].by == null ? vm.whisper : null;
      setH(R("whisper"), w ? `<div class="cs-cons">${consultantSVG(64, "smug")}</div><div class="cs-wb"><b>Consultantul îți șoptește:</b> „Psst… ${w.i === 0 ? "prima carte" : `a ${w.i + 1}-a carte`} e <b>${esc(cardMeta(w.k).name)}</b> ${cardMeta(w.k).icon}. Eu doar zic…”</div>` : "");
      R("whisper").classList.toggle("on", !!w);
      if (vm.cur !== lastCur) { lastCur = vm.cur; if (vm.cur === me && me && !vm.rev) H.sfx("turn"); }
      el.classList.toggle("myturn", vm.cur === me && !vm.rev && !!me);
      tick();
    }
    function tick() {
      const vm = draftVM(O.st, O.seat, O.view), tm = R("timer");
      if (vm.rev || !vm.dl) { tm.style.visibility = "hidden"; return; }
      tm.style.visibility = "";
      const left = Math.max(0, (vm.dl - H.now()) / 1000), k = clamp(left / 10, 0, 1);
      R("secs").textContent = Math.ceil(left); R("ring").style.strokeDashoffset = String(119.4 * (1 - k));
      tm.classList.toggle("hot", left <= 3.5);
      if (vm.cur === O.seat && left <= 3.5 && left > 0 && Math.ceil(left) !== tick.last) { tick.last = Math.ceil(left); H.sfx("tick"); }
    }
    S.on(el, "click", e => {
      const b = e.target.closest(".cs-dc.can"); if (!b || picked) return;
      picked = true; b.classList.add("chosen"); qa(el, ".cs-dc.can").forEach(x => x.classList.remove("can"));
      H.sfx("select"); H.act("pick", { i: +b.dataset.i });
    });
    S.iv(tick, 200);
    draw();
    return { el, update(n) { O = Object.assign({}, O, n); draw(); }, destroy: S.destroy, get revealed() { return revDone && Date.now() - revAt > 1800; }, revealLocal() { if (!revDone) { const st = JSON.parse(JSON.stringify(O.st || {})); const d = st.draft || st.dr; if (d) { d.rev = true; O = Object.assign({}, O, { st }); draw(); } } } };
  }

  /* ================================================================== NEGOCIERE */
  const PHRASES = [
    { t: "Hai să facem o afacere bună pentru amândoi! 🤝", m: "happy" },
    { t: "E prea puțin. Mai pune ceva. 😤", m: "angry" },
    { t: "Mai adaugă puțin și batem palma.", m: "smug" },
    { t: "Glumești, nu? 😂", m: "smug" },
    { t: "Ofertă finală. Acum sau niciodată! ⏳", m: "neutral" },
    { t: "Îmi place cum gândești. 😎", m: "happy" },
    { t: "Lasă-mă să mă gândesc puțin… 🤔", m: "thinking" },
    { t: "{O:Ești un negociator dur|Ești o negociatoare dură}! 💼", m: "smug" },
    { t: "Pe cuvânt, e cel mai bun preț din aeroport. ✈️", m: "happy" },
    { t: "Nu-mi trebuie, mersi. 🙅", m: "angry" },
    { t: "Bine, ai câștigat… de data asta. 😅", m: "sad" },
    { t: "Hai să semnăm și un pact de neagresiune. 🕊️", m: "happy" }
  ];
  function sayText(k, g, og) {
    k = String(k == null ? "" : k);
    if (/^\d+$/.test(k) && PHRASES[+k]) return phraseText(+k, g, og);
    if (k === "refuz") return "Refuz. ✋";
    const D = Dt(); if (D && D.LINES && D.LINES[k] && typeof D.line === "function") { try { return D.line(k, { g, og }); } catch (e) { /* ignore */ } }
    return k;
  }
  function phraseText(i, g, og) { const p = PHRASES[i]; if (!p) return ""; return p.t.replace(/\{O:([^|}]*)\|([^}]*)\}/g, (_, m, f) => og === "f" ? f : m).replace(/\{G:([^|}]*)\|([^}]*)\}/g, (_, m, f) => g === "f" ? f : m); }
  const ITEM_KINDS = [
    { k: "m", ic: "💶", n: "Bani" }, { k: "c", ic: "🃏", n: "Cărți" }, { k: "sp", ic: "✨", n: "Speciale" }, { k: "pe", ic: "📜", n: "Permise" },
    { k: "r", ic: "🛣️", n: "Rute" }, { k: "sl", ic: "🅿️", n: "Sloturi" }, { k: "pl", ic: "✈️", n: "Avioane" }, { k: "pact", ic: "🕊️", n: "Pact" }, { k: "loan", ic: "💰", n: "Împrumut" }
  ];
  const emptyItems = () => ({ m: 0, c: {}, sp: [], pe: [], r: [], sl: [], pl: [] });
  function normItems(x) {
    x = x || {}; const o = emptyItems();
    o.m = num(first(x.cash, x.m, x.money), 0);
    const c = first(x.cards, x.c, {});
    if (Array.isArray(c)) c.forEach((n, i) => { if (n > 0) o.c[RESK[i]] = n; }); else Object.keys(c).forEach(k => { if (c[k] > 0) o.c[cardKey(k)] = c[k]; });
    const sx = x.sx || {}; Object.keys(sx).forEach(k => { for (let i = 0; i < (sx[k] | 0); i++) o.sp.push(cardKey(k)); });
    if (Array.isArray(x.sp)) x.sp.forEach(k => o.sp.push(cardKey(k)));
    [["pe", "permits"], ["r", "routes"], ["sl", "slots"], ["pl", "planes"]].forEach(([k, alt]) => { const v = x[alt] || x[k]; if (Array.isArray(v)) o[k] = v.map(y => (y && typeof y === "object") ? first(y.id, y.rid, y.ap) : y); });
    if (x.pact) o.pact = num(typeof x.pact === "object" ? x.pact.days : x.pact, 10);
    if (x.loan) o.loan = { amt: num(first(x.loan.amt, x.loan.amount), 0), rep: num(first(x.loan.rep, x.loan.repay), 0), days: num(x.loan.days, 10) };
    return o;
  }
  function packItems(it) {
    const o = {}; if (it.m) o.cash = it.m;
    const ks = Object.keys(it.c); if (ks.length) o.cards = RESK.map(k => it.c[k] || 0);
    if (it.sp.length) { o.sx = {}; it.sp.forEach(k => { const id = D2L[k] || k; o.sx[id] = (o.sx[id] || 0) + 1; }); }
    if (it.pe.length) o.permits = it.pe.slice(); if (it.r.length) o.routes = it.r.slice(); if (it.sl.length) o.slots = it.sl.slice(); if (it.pl.length) o.planes = it.pl.slice();
    if (it.pact) o.pact = it.pact; if (it.loan) o.loan = it.loan;
    return o;
  }
  const itemsEmpty = it => !it.m && !Object.keys(it.c).length && !it.sp.length && !it.pe.length && !it.r.length && !it.sl.length && !it.pl.length && !it.pact && !it.loan;
  function negoVM(st, seat, view) {
    const n = (st && (st.ng || st.nego)) || null; if (!n) return null;
    const a = first(n.a, n.from), b = first(n.b, n.with, n.to);
    const ps = Array.isArray(n.ps) && n.ps.length ? n.ps.slice() : [a, b];
    const inv = (Array.isArray(n.inv) ? n.inv : []).map(x => (x && typeof x === "object") ? { s: x.s, by: x.by } : { s: x, by: null });
    const off = n.off || n.offer || null;
    let offer = null;
    if (off) {
      const by = first(off.by, a), to0 = off.to != null ? off.to : (by === a ? b : a);
      const lines = Array.isArray(off.lines) ? off.lines.map(l => ({ f: l.f, t: l.t, it: normItems(l.it) }))
        : [{ f: by, t: to0, it: normItems(off.give) }, { f: to0, t: by, it: normItems(off.get) }].filter(l => !itemsEmpty(l.it));
      const parts = Array.isArray(off.parts) && off.parts.length ? off.parts.slice() : [by, to0];
      offer = { by, to: parts.length === 2 ? parts.find(x => x !== by) : null, lines, parts, ok: off.ok || { [by]: 1 }, give: normItems(off.give), get: normItems(off.get), n: num(first(off.at, off.n), 0) };
    }
    const say = (n.msgs || n.say || []).map(x => ({ s: first(x.s, x.seat), k: String(first(x.k, x.i, "")), t: num(first(x.at, x.t), 0) }));
    const mine = inv.find(x => x.s === seat);
    return { a, b, ps, inv, dec: Array.isArray(n.dec) ? n.dec : [], invited: !!mine && !n.res, invBy: mine ? mine.by : null, loan: !!first(n.req, n.loan, false), loanReq: null, offer, say, last: n.last || null,
      dl: num(first(n.until, n.dl), 0), res: first(n.res, null), mood: n.mood || {}, involved: ps.indexOf(seat) >= 0 };
  }
  /* riscul unui împrumut pentru DEBITOR (borrower): LOGIC-2 loanRisk(st, from=creditor, to=debitor, sumă); rezervă locală:
     (datorii + sumă) / valoarea companiei → mic < 25%, mediu < 60%, mare peste. Limitele nu se schimbă — e doar un indiciu. */
  function loanRiskOf(st, borrower, lender, amount) {
    const L = Lg(); amount = Math.max(0, num(amount, 0));
    if (L && typeof L.loanRisk === "function") { try { const r = L.loanRisk(st, lender, borrower, amount); if (r && r.level) return { level: fold(r.level), ratio: num(r.ratio, null), debt: num(r.debt, null), value: num(r.value, null) }; } catch (e) { /* rezervă */ } }
    const c = rawP(st, borrower); let value = num(first(c.value, c.val), null);
    if (L && typeof L.companyValue === "function" && st && st.c && st.c[borrower]) { try { value = L.companyValue(st, borrower); } catch (e) { /* ignore */ } }
    if (value == null) return null;
    const debt = (Array.isArray(c.bl) ? c.bl.reduce((a, l) => a + num(l.p, 0), 0) : 0) + (st && Array.isArray(st.ln) ? st.ln.filter(l => l.b === borrower).reduce((a, l) => a + num(l.rep, 0), 0) : 0);
    const ratio = (debt + amount) / Math.max(1, value);
    return { level: value <= 0 ? "mare" : ratio < 0.25 ? "mic" : ratio < 0.6 ? "mediu" : "mare", ratio, debt, value };
  }
  function riskHTML(r, borrowerIsMe, bName) {
    if (!r) return "";
    const lv = r.level === "mare" ? "mare" : r.level === "mediu" ? "mediu" : "mic";
    const pct = r.ratio != null ? ` · datorii după împrumut: <b>${Math.round(r.ratio * 100)}%</b> din valoarea ${borrowerIsMe ? "companiei tale" : "companiei lui " + esc(bName)}` : "";
    return `<div class="cs-risk r-${lv}"><i></i><span><b>Risc ${lv}</b>${pct}</span></div>`;
  }
  const NG_MAXP = 4;
  const lineOf = (off, f, t) => { const l = off && off.lines.find(x => x.f === f && x.t === t); return l ? l.it : emptyItems(); };
  function namesRo(arr) { return arr.length <= 1 ? (arr[0] || "") : arr.slice(0, -1).join(", ") + " și " + arr[arr.length - 1]; }
  function invOf(st, seat, view, me) {
    // inventar: pentru mine din view (privat), pentru celălalt doar public
    const inv = { cash: null, c: {}, sp: [], pe: [], r: [], sl: [], pl: [] };
    const v = view || {}, its = v.nego && v.nego.items;
    const rName = rid => { const r = (v.routes || []).find(x => x.rid === rid || x.id === rid); if (r) return apName(r.a) + " ↔ " + apName(r.b); const pr = String(rid).split("-"); return pr.length === 2 ? apName(pr[0]) + " ↔ " + apName(pr[1]) : String(rid); };
    const pName = (p) => { const f = (v.planes || []).find(x => x.id === p.id); return (f && f.name ? "„" + f.name + "” " : "") + planeName(first(p.ty, p.type, f && f.ty)); };
    if (me) {
      const co = v.co || (typeof v.me === "object" ? v.me : {}) || {}, mine = its && its.mine;
      inv.cash = num(first(mine && mine.cash, co.cash, v.cash), null);
      const h = first(mine && mine.cards, v.cards && v.cards.h, v.hand, []);
      if (Array.isArray(h)) h.forEach((n, i) => { if (n > 0) inv.c[RESK[i]] = n; }); else Object.keys(h).forEach(k => { if (h[k] > 0) inv.c[cardKey(k)] = h[k]; });
      const sx = first(mine && mine.sx, v.cards && v.cards.sx, {});
      Object.keys(sx).forEach(k => { for (let i = 0; i < (sx[k] | 0); i++) inv.sp.push(cardKey(k)); });
      (v.specials || []).forEach(x => inv.sp.push(cardKey(x)));
      (first(mine && mine.permits, v.permits, [])).forEach(p => inv.pe.push({ id: p.id, n: apName(p.a) + " → " + apName(p.b) }));
      (first(mine && mine.routes, (v.routes || []).map(r => first(r.rid, r.id)))).forEach(rid => inv.r.push({ id: rid, n: rName(rid) }));
      const sl = first(mine && mine.slots, null);
      if (sl) sl.forEach(ap => inv.sl.push({ id: ap, n: apName(ap) }));
      (first(mine && mine.planes, v.planes, [])).forEach(p => inv.pl.push({ id: p.id, n: pName(p) }));
    } else {
      const th = its && (its.others ? its.others[seat] : its.theirs), op = (v.opp || v.opps || []).find(x => x.seat === seat);
      (first(th && th.routes, op && op.routes, [])).forEach(rid => inv.r.push({ id: typeof rid === "object" ? first(rid.rid, rid.id) : rid, n: rName(typeof rid === "object" ? first(rid.rid, rid.id) : rid) }));
      const set = new Set(); inv.r.forEach(r => String(r.id).split("-").forEach(a => set.add(a))); set.forEach(a => { if (a) inv.sl.push({ id: a, n: apName(a) }); });
      (first(th && th.planes, st && Array.isArray(st.pl) ? st.pl.filter(p => p.s === seat && !p.ls) : [], [])).forEach(p => inv.pl.push({ id: p.id, n: planeName(first(p.ty, p.type)) + " #" + p.id }));
    }
    return inv;
  }
  function apName(id) { const D = Dt(); const a = D && D.AP && D.AP[id]; return a ? a.n : String(id == null ? "?" : id); }
  function planeName(t) { if (typeof t === "number") t = ["t72", "a320", "s350"][t]; const D = Dt(); const a = D && D.AIRCRAFT && D.AIRCRAFT[t]; return a ? a.n : ({ t72: "Turbo 72", a320: "Aero 320", s350: "Skyliner 350" }[t] || String(t == null ? "avion" : t)); }
  const RES_IDS = () => RESK.slice();
  const SPEC_IDS = () => Object.keys(SPEC);

  function itemChips(it, inv, side) {
    const out = [];
    const lbl = (arr, id) => { const f = (arr || []).find(x => x.id === id); return f ? f.n : (typeof id === "string" ? apName(id) : String(id)); };
    if (it.m) out.push({ k: "m", ic: "💶", t: fmtE(it.m), cls: "money" });
    Object.keys(it.c).forEach(k => out.push({ k: "c", id: k, ic: cardMeta(k).icon, t: `${it.c[k]}× ${cardMeta(k).name}` }));
    it.sp.forEach((k, i) => out.push({ k: "sp", id: i, ic: cardMeta(k).icon, t: cardMeta(k).name, cls: "spec" }));
    it.pe.forEach(id => out.push({ k: "pe", id, ic: "📜", t: "Permis " + lbl(inv.pe, id) }));
    it.r.forEach(id => out.push({ k: "r", id, ic: "🛣️", t: "Ruta " + lbl(inv.r, id) }));
    it.sl.forEach(id => out.push({ k: "sl", id, ic: "🅿️", t: "Slot " + lbl(inv.sl, id) }));
    it.pl.forEach(id => out.push({ k: "pl", id, ic: "✈️", t: lbl(inv.pl, id) }));
    if (it.pact) out.push({ k: "pact", ic: "🕊️", t: `Pact ${it.pact} zile`, cls: "pact" });
    if (it.loan) out.push({ k: "loan", ic: "💰", t: `Împrumut ${fmtE(it.loan.amt)} → returnează ${fmtE(it.loan.rep)} în ${it.loan.days} zile`, cls: "loan" });
    return out.map(c => `<span class="cs-tok ${c.cls || ""}" data-side="${side}" data-k="${c.k}" data-id="${esc(c.id == null ? "" : c.id)}"><i>${c.ic}</i>${esc(c.t)}<b class="x" title="Scoate">×</b></span>`).join("");
  }

  /* Biroul de negocieri. 2–4 participanți (vm.ps); ceilalți jucători văd același birou DOAR în citire (cs-watch) și pot primi
     o invitație la masă. Oferta = linii „X îi dă lui Y …”; cu 3+ participanți alegi sus cu cine lucrezi (cp), iar oferta poate
     cuprinde mai mulți jucători — se face doar când acceptă toate părțile. */
  function sceneNego(container, o, h) {
    const S = base(container, "cs-nego", o), H = makeHelp(o, h);
    let lastMine = null; let O = o, built = false, drafts = null, draft = null, editing = false, lastOffN = -1, lastSayLen = 0, lastRes = null, pop = null, prefilled = false, lastRefAt = null, refT = 0, refBy = null, cp = null;
    const el = S.el;
    function build() {
      if (built) return; built = true;
      el.className = el.className.replace(/\bcs-nbanner\b/, "") + " cs-office";
      el.innerHTML = `<div class="cs-of-bg">${officeSVG() || ""}</div><div class="cs-of-shade"></div>
        <header class="cs-of-head"><h1 data-r="title">Biroul de negocieri</h1><div class="cs-of-sub" data-r="sub"></div><div class="cs-of-t"><div class="cs-tbar"><i data-r="tbar"></i></div><b data-r="tl"></b></div><button class="cs-x" data-act="close" data-r="xbtn" title="Închide negocierea">🚪 Pleacă</button></header>
        <div class="cs-stage">
          <div class="cs-seats" data-r="seats"></div>
          <div class="cs-side me"><div class="cs-bub" data-r="bub-me"></div><div class="cs-pav" data-r="av-me"></div><div class="cs-pname" data-r="n-me"></div></div>
          <div class="cs-side op"><div class="cs-bub" data-r="bub-op"></div><div class="cs-pav" data-r="av-op"></div><div class="cs-pname" data-r="n-op"></div></div>
          <div class="cs-deal2" data-r="deal2"></div>
          <div class="cs-desk"><div class="cs-tray me"><div class="cs-tray-h" data-r="giveh">Tu dai</div><div class="cs-tray-c" data-r="give"></div></div>
            <div class="cs-mid" data-r="mid"></div>
            <div class="cs-tray op"><div class="cs-tray-h" data-r="geth">Primești</div><div class="cs-tray-c" data-r="get"></div></div>
            <div class="cs-dealbox" data-r="deal"></div></div>
          <div class="cs-hs" data-r="hs"></div><div class="cs-stamp" data-r="stamp"></div>
        </div>
        <div class="cs-ctrl">
          <div class="cs-add"><span class="cs-lbl">Pune pe masă:</span><div data-r="add"></div></div>
          <div class="cs-acts" data-r="acts"></div>
          <div class="cs-phr" data-r="phr"></div>
        </div><div class="cs-pop" data-r="pop"></div>`;
    }
    const R = k => q(el, `[data-r="${k}"]`);
    const setH = (k, html) => { const n = R(k); if (n && n._h !== html) { n.innerHTML = html; n._h = html; } };
    const meSeat = vm => vm.involved ? O.seat : vm.ps[0];
    function other(vm) { // partenerul selectat (cp)
      const me = meSeat(vm), ok = x => x != null && x !== me && vm.ps.indexOf(x) >= 0;
      if (ok(cp)) return cp;
      const off = vm.offer;
      if (off && vm.involved && off.by !== me && off.parts.indexOf(me) >= 0) cp = off.by;
      else if (off && !vm.involved) cp = off.parts.find(x => x !== me) || null;
      if (!ok(cp)) cp = vm.ps.find(x => x !== me);
      return cp;
    }
    function myMood(vm, side) {
      const seat = side === "me" ? meSeat(vm) : (side === "op" ? other(vm) : side);
      if (vm.mood && vm.mood[seat]) return vm.mood[seat];
      if (vm.res === "acc" || vm.res === "accepted") return "happy";
      if (vm.res === "ref" || vm.res === "refused") return seat === (vm.offer && vm.offer.by) ? "angry" : "smug";
      if (Date.now() - refT < 5000 && refBy) return seat === refBy ? "smug" : "angry";
      const last = vm.say.filter(s => s.s === seat).slice(-1)[0];
      if (last && /^\d+$/.test(last.k) && PHRASES[+last.k]) return PHRASES[+last.k].m;
      if (vm.offer && vm.offer.by !== seat && vm.offer.parts.indexOf(seat) >= 0 && !vm.offer.ok[seat]) return "thinking";
      return "neutral";
    }
    function canInviteList(vm) {
      if (!vm.involved || vm.res || vm.ps.length + vm.inv.length >= NG_MAXP) return [];
      return seatsOf(O.st).filter(s => vm.ps.indexOf(s) < 0 && !vm.inv.some(x => x.s === s) && vm.dec.indexOf(s) < 0 && !pinfo(O.st, s, O.ctx).out);
    }
    function dealHTML(vm, view, d) { // toate liniile ofertei (sau ale ciornei) + cine a acceptat
      const off = vm.offer; const me = meSeat(vm);
      let lines = [], parts = [], okm = {};
      if (d) { Object.keys(d).forEach(x => { if (!itemsEmpty(d[x].give)) lines.push({ f: O.seat, t: x, it: d[x].give }); if (!itemsEmpty(d[x].get)) lines.push({ f: x, t: O.seat, it: d[x].get }); }); }
      else if (off) { lines = off.lines; parts = off.parts; okm = off.ok || {}; }
      if (!lines.length) return d ? `<div class="cs-dl-e">Ciorna e goală — pune obiecte pe masă.</div>` : `<div class="cs-dl-e">${vm.res ? "" : "Încă nu e nicio ofertă pe masă."}</div>`;
      const P = s => pinfo(O.st, s, O.ctx);
      const rows = lines.map(l => { const f = P(l.f), t = P(l.t), inv = invOf(O.st, l.f, view, l.f === O.seat);
        return `<div class="cs-dl"><span class="cs-dlw"><b style="color:${f.color}">${esc(l.f === O.seat ? "Tu" : f.name)}</b> <i>→</i> <b style="color:${t.color}">${esc(l.t === O.seat ? (l.f === O.seat ? "tu" : "ție") : t.name)}</b></span><span class="cs-dlc">${itemChips(l.it, inv, "ro")}</span></div>`; }).join("");
      const head = d ? `<div class="cs-dl-h">📝 Ciorna ta</div>` : `<div class="cs-dl-h">📋 Oferta lui <b style="color:${P(off.by).color}">${esc(off.by === O.seat ? "tine" : P(off.by).name)}</b>${parts.length > 2 ? ` · ${parts.length} părți` : ""}</div>`;
      const sts = d ? "" : `<div class="cs-dl-st">${parts.map(x => `<span class="${okm[x] || vm.res === "acc" ? "ok" : ""}">${okm[x] || vm.res === "acc" ? "✔" : "⏳"} ${esc(x === O.seat ? "tu" : P(x).name)}</span>`).join("")}</div>`;
      void me; return head + rows + sts;
    }
    function draw() {
      const vm = negoVM(O.st, O.seat, O.view); if (!vm) return;
      build();
      const watch = !vm.involved, multi = vm.ps.length > 2, meS = meSeat(vm);
      el.classList.toggle("cs-watch", watch); el.classList.toggle("cs-multi", multi || watch || vm.inv.length > 0);
      const left = vm.dl ? Math.max(0, (vm.dl - H.now()) / 1000) : 0;
      const os = other(vm), me = pinfo(O.st, meS, O.ctx), op = pinfo(O.st, os, O.ctx);
      const view = O.view || viewOf(O, h, H);
      const myInv = invOf(O.st, meS, view, !watch), opInv = invOf(O.st, os, view, false);
      R("title").textContent = vm.loan ? "Cerere de împrumut" : "Biroul de negocieri";
      R("tl").textContent = left ? fmtClock(left) : "";
      R("tbar").style.width = (vm.dl ? clamp(left / 120, 0, 1) * 100 : 100) + "%";
      const xb = R("xbtn"); xb.hidden = watch; xb.textContent = multi && !vm.res ? "🚪 Pleacă de la masă" : "🚪 Pleacă"; xb.title = multi && !vm.res ? "Ieși din negociere (ceilalți continuă)" : "Închide negocierea";
      // avatare (mood)
      const mm = myMood(vm, "me"), om = myMood(vm, "op");
      const ak = me.av + mm + "|" + op.av + om + "|" + os;
      if (R("av-me").dataset.k !== ak) { R("av-me").dataset.k = ak; R("av-me").innerHTML = avatarSVG(me.av, 320, mm, { ring: me.color, bg: false }); R("av-op").innerHTML = avatarSVG(op.av, 320, om, { ring: op.color, bg: false, flip: true }); }
      R("n-me").innerHTML = `<b style="color:${me.color}">${esc(me.name)}</b><span>${esc(me.co)}</span>`;
      R("n-op").innerHTML = `<b style="color:${op.color}">${esc(op.name)}</b><span>${esc(op.co)}</span>`;
      // masa: cine stă la ea (+ invitați)
      const off = vm.offer;
      const seatChip = (x, inv) => { const p = pinfo(O.st, x, O.ctx), part = off && off.parts.indexOf(x) >= 0;
        const stt = inv ? "📨 invitat" : x === meS && !watch ? "tu" : vm.res === "acc" && part ? "✔ de acord" : part ? (off.ok[x] ? "✔ de acord" : "⏳ se gândește") : "";
        return `<button class="cs-seat${x === os ? " on" : ""}${x === meS ? " me" : ""}${inv ? " inv" : ""}" data-cp="${inv || x === meS ? "" : esc(x)}" style="--c:${p.color}" ${inv || x === meS ? "tabindex=-1" : ""}>${avatarSVG(p.av, 34, inv ? "neutral" : myMood(vm, x), { ring: p.color })}<span><b>${esc(p.name)}</b><small>${esc(stt)}</small></span><em class="cs-sb" data-sb="${esc(x)}"></em></button>`; };
      const showSeats = multi || watch || vm.inv.length > 0;
      setH("seats", showSeats ? `<span class="cs-seats-l">La masă${multi && !watch ? " · alege cu cine" : ""}:</span>` + vm.ps.map(x => seatChip(x, false)).join("") + vm.inv.map(x => seatChip(x.s, true)).join("") + (multi || watch ? `<button class="cs-seat all" data-act="deal">📋 Toată oferta</button>` : "") : "");
      // ofertă curentă (din perspectiva mea, cu partenerul selectat)
      const theirsPending = !watch && off && off.by !== O.seat && off.parts.indexOf(O.seat) >= 0 && !off.ok[O.seat] && !vm.res;
      let give, get;
      if (editing && draft) { give = draft.give; get = draft.get; }
      else if (off) { give = lineOf(off, meS, os); get = lineOf(off, os, meS); }
      else { give = emptyItems(); get = emptyItems(); }
      if (off && off.by === O.seat) lastMine = off;
      if (!watch && !off && vm.loan && !prefilled && vm.a === O.seat) {
        // după un refuz pornim de la ultima mea cerere (nu de la valorile implicite 5 M / 5,6 M)
        prefilled = true; const L = vm.loanReq || (lastMine && lineOf(lastMine, os, O.seat).loan) || {};
        startEdit(false, true);
        draft.get.loan = { amt: num(first(L.amt, L.amount), 5e6), rep: num(first(L.rep, L.repay), Math.round(num(first(L.amt, L.amount), 5e6) * 1.12)), days: num(L.days, 10) };
        give = draft.give; get = draft.get;
      }
      const gH = itemChips(give, myInv, "give") || `<span class="cs-empty">${editing ? "nimic încă — adaugă de jos" : "—"}</span>`;
      const tH = itemChips(get, opInv, "get") || `<span class="cs-empty">${editing ? "ce vrei de la " + esc(op.name) + "?" : "—"}</span>`;
      setH("give", gH); setH("get", tH);
      el.classList.toggle("editing", editing);
      setH("giveh", `<b style="color:${me.color}">${esc(me.name)}</b><small>${esc(me.co)}</small><em>${watch ? gx(me.g, "el", "ea") + " dă" : "tu dai"}</em>`);
      setH("geth", `<b style="color:${op.color}">${esc(op.name)}</b><small>${esc(op.co)}</small><em>${gx(op.g, "el", "ea")} dă${watch ? "" : " · tu primești"}</em>`);
      // oferta întreagă (pe masă la spectatori; în mijloc la 3+ participanți)
      const dH = dealHTML(vm, view, editing && multi ? drafts : null);
      setH("deal", watch ? dH : ""); setH("deal2", !watch && multi ? dH : "");
      const P = s => pinfo(O.st, s, O.ctx), nm = arr => namesRo(arr.map(x => x === O.seat ? "tu" : P(x).name));
      const busy = (view && view.nego && view.nego.busy) || `Negociere în curs între ${namesRo(vm.ps.map(x => P(x).name))} — poți doar să privești.`;
      const sub = vm.res === "acc" || vm.res === "accepted" ? `<b class="ok">Afacere încheiată!</b>`
        : vm.res === "ref" || vm.res === "refused" ? `<b class="bad">Oferta a fost refuzată.</b>`
        : watch ? (vm.invited ? `📨 <b>${esc(P(vm.invBy).name)}</b> te invită la masă. Vii?` : `👀 ${esc(busy)}`)
        : editing ? (multi ? "Pregătești o ofertă — alege sus cu cine, pune obiecte pe masă (poți include mai mulți), apoi trimite." : "Pregătești o ofertă — pune obiecte pe masă de ambele părți, apoi trimite.")
        : theirsPending ? `<b>${esc(P(off.by).name)}</b> ${off.parts.length > 2 ? "propune o afacere în " + off.parts.length + " (toți trebuie să accepte)" : "ți-a făcut o ofertă"}. Accepți, refuzi sau faci o contraofertă?`
        : off && off.parts.indexOf(O.seat) >= 0 && (off.by === O.seat || off.ok[O.seat]) ? `Aștepți răspunsul de la <b>${esc(nm(off.parts.filter(x => !off.ok[x])))}</b>…`
        : off ? `<b>${esc(P(off.by).name)}</b> propune o afacere între ${esc(nm(off.parts))}. Tu nu ești parte din ea.`
        : multi ? `La masă: ${esc(nm(vm.ps))}. Fă o ofertă sau așteaptă.`
        : vm.a === O.seat ? `${gx(op.g, "L-ai chemat pe", "Ai chemat-o pe")} <b>${esc(op.name)}</b> la birou. Fă prima ofertă.`
        : `<b>${esc(op.name)}</b> te-a chemat la negocieri. Așteaptă oferta sau propune tu.`;
      if (R("sub")._h !== sub) { R("sub").innerHTML = sub; R("sub")._h = sub; }
      setH("mid", `<div class="cs-swap">⇄</div>`);
      // butoane de adăugare
      const add = R("add");
      if (!add.dataset.done) { add.dataset.done = 1; add.innerHTML = ITEM_KINDS.map(k => `<button class="cs-ib" data-add="${k.k}"><i>${k.ic}</i>${k.n}</button>`).join(""); }
      qa(add, "button").forEach(b => b.disabled = !!(vm.res) || watch);
      // acțiuni
      const acts = [];
      if (watch) {
        if (vm.invited) { acts.push(`<button class="cs-btn ok" data-act="join">🤝 Vin la masă</button>`); acts.push(`<button class="cs-btn bad" data-act="nojoin">✖ Nu, mersi</button>`); }
        else acts.push(`<span class="cs-watchmsg">👀 ${esc(busy)}</span>`);
      } else if (!vm.res) {
        if (editing) {
          const empty = Object.keys(drafts || {}).every(x => itemsEmpty(drafts[x].give) && itemsEmpty(drafts[x].get));
          acts.push(`<button class="cs-btn gold" data-act="send" ${empty ? "disabled" : ""}>📨 ${theirsPending ? "Trimite contraoferta" : "Trimite oferta"}</button>`);
          acts.push(`<button class="cs-btn ghost" data-act="cancel">Renunță la modificări</button>`);
        } else {
          if (theirsPending) {
            acts.push(`<button class="cs-btn ok" data-act="accept">🤝 Accept</button>`);
            acts.push(`<button class="cs-btn bad" data-act="refuse">✖ Refuz</button>`);
            acts.push(`<button class="cs-btn" data-act="counter">↩ Contraofertă</button>`);
          } else acts.push(`<button class="cs-btn gold" data-act="new">✍️ ${off && off.by === O.seat ? "Modifică oferta" : off ? "Altă ofertă" : "Fă o ofertă"}</button>`);
          if (canInviteList(vm).length) acts.push(`<button class="cs-btn" data-act="invite" title="Mai poate veni cineva la masă (maxim ${NG_MAXP} jucători)">➕ Invită</button>`);
        }
      } else acts.push(`<button class="cs-btn" data-act="close">Înapoi la joc</button>`);
      setH("acts", acts.join(""));
      // fraze rapide
      const phr = R("phr");
      if (!phr.dataset.done) { phr.dataset.done = 1; phr.innerHTML = PHRASES.map((p, i) => `<button class="cs-qp" data-say="${i}">${esc(phraseText(i, me.g, op.g))}</button>`).join(""); }
      // baloane
      if (vm.say.length !== lastSayLen) {
        const fresh = vm.say.slice(lastSayLen < vm.say.length ? lastSayLen : Math.max(0, vm.say.length - 1)); lastSayLen = vm.say.length;
        fresh.forEach(s => { const side = s.s === meS ? "me" : s.s === os ? "op" : null; const who = P(s.s), oth = side === "me" ? op : me;
          const b = side ? R("bub-" + side) : q(el, `[data-sb="${s.s}"]`); if (!b) return;
          b.textContent = sayText(s.k, who.g, oth.g); b.classList.remove("on"); void b.offsetWidth; b.classList.add("on"); if (s.s !== O.seat) H.sfx("ping");
          clearTimeout(b._t); b._t = setTimeout(() => b.classList.remove("on"), 4200); });
      }
      // animații ofertă nouă / rezultat
      if (off && off.n !== lastOffN) { const first0 = lastOffN === -1; lastOffN = off.n; if (!first0 && !RM()) { qa(el, ".cs-tray-c, .cs-dealbox, .cs-deal2").forEach(t => { t.classList.remove("slide"); void t.offsetWidth; t.classList.add("slide"); }); } if (!first0 && off.by !== O.seat) H.sfx("deal"); }
      const lr = vm.last && vm.last.k === "ref" ? vm.last.at : null;
      if (lr !== lastRefAt) { lastRefAt = lr; if (lr) { refT = Date.now(); refBy = vm.last.by; const st2 = R("stamp"); st2.innerHTML = "REFUZAT"; st2.classList.remove("on"); void st2.offsetWidth; st2.classList.add("on"); H.sfx(vm.last.by === O.seat ? "click" : "wrong"); S.t(draw, 5100); } }
      if (vm.res !== lastRes) {
        const was = lastRes; lastRes = vm.res;
        if (was !== null || vm.res) {
          if (vm.res === "acc" || vm.res === "accepted") { R("hs").innerHTML = handshakeSVG(220); R("hs").classList.add("on"); H.sfx("win"); confettiIn(el); const r = R("hs").getBoundingClientRect(), rr = el.getBoundingClientRect(); sparks(el, r.left - rr.left + r.width / 2, r.top - rr.top + r.height / 2, "#ffd35c", 30); }
          else if (vm.res === "ref" || vm.res === "refused") { R("stamp").innerHTML = "REFUZAT"; R("stamp").classList.add("on"); H.sfx("wrong"); H.fx("shake", R("stamp")); }
        }
      }
    }
    function fmtClock(s) { s = Math.ceil(s); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); }
    function startEdit(fromOffer, quiet) {
      const vm = negoVM(O.st, O.seat, O.view); if (!vm || !vm.involved) return; const off = vm.offer; const os = other(vm);
      drafts = {};
      vm.ps.filter(x => x !== O.seat).forEach(x => {
        const g = fromOffer && off ? lineOf(off, O.seat, x) : emptyItems(), t = fromOffer && off ? lineOf(off, x, O.seat) : emptyItems();
        drafts[x] = { give: normItems(JSON.parse(JSON.stringify(g))), get: normItems(JSON.parse(JSON.stringify(t))) };
      });
      draft = drafts[os] || (drafts[os] = { give: emptyItems(), get: emptyItems() });
      editing = true; if (!quiet) draw();
    }
    function closePop() { pop = null; const p = R("pop"); if (p) { p.classList.remove("on"); p.innerHTML = ""; } }
    function openPop(kind) {
      const vm0 = negoVM(O.st, O.seat, O.view); if (!vm0 || !vm0.involved) return;
      if (!editing) startEdit(true);
      const vm = negoVM(O.st, O.seat, O.view), os = other(vm), op = pinfo(O.st, os, O.ctx);
      const view = O.view || viewOf(O, h, H), myInv = invOf(O.st, O.seat, view, true), opInv = invOf(O.st, os, view, false);
      pop = { kind, side: "give" };
      const K = ITEM_KINDS.find(k => k.k === kind);
      const sideSel = (kind === "pact") ? "" : `<div class="cs-seg" data-r="side"><button data-side="give" class="on">Eu dau</button><button data-side="get">Cer de la ${esc(op.name)}</button></div>`;
      let body = "";
      const list = (arr, side) => arr.length ? arr.map(x => `<button class="cs-li" data-pick="${esc(x.id)}" data-pside="${side}">${esc(x.n)}</button>`).join("") : `<span class="cs-muted">${side === "get" ? "Nu se vede nimic public." : "Nu ai așa ceva."}</span>`;
      if (kind === "m") body = `<div class="cs-mrow"><button class="cs-ib" data-mstep="-1000000">−1 M</button>${amtInput("mval", 1000000)}<button class="cs-ib" data-mstep="1000000">+1 M</button></div><div class="cs-chips">${[500000, 1e6, 2e6, 5e6, 10e6].map(v => `<button class="cs-chip" data-mset="${v}">${fmtE(v)}</button>`).join("")}</div>${myInv.cash != null ? `<small class="cs-muted">Ai ${fmtE(myInv.cash)}</small>` : ""}<button class="cs-btn gold" data-ok="m">Pune pe masă</button>`;
      else if (kind === "c") body = `<div class="cs-cgrid">${RES_IDS().map(k => `<div class="cs-cc" data-ck="${k}">${cardFaceSVG(k, 54)}<div><button class="cs-ib" data-cstep="-1">−</button><b data-cn>0</b><button class="cs-ib" data-cstep="1">+</button></div><small data-have>${myInv.c[k] || 0} în mână</small></div>`).join("")}</div><button class="cs-btn gold" data-ok="c">Pune pe masă</button>`;
      else if (kind === "sp") body = `<div class="cs-two"><div><b>Ale tale</b><div class="cs-list">${myInv.sp.length ? myInv.sp.map(k => `<button class="cs-li" data-pick="${k}" data-pside="give">${cardMeta(k).icon} ${esc(cardMeta(k).name)}</button>`).join("") : '<span class="cs-muted">Nu ai cărți speciale.</span>'}</div></div><div><b>Cere de la ${esc(op.name)}</b><div class="cs-list">${SPEC_IDS().map(k => `<button class="cs-li" data-pick="${k}" data-pside="get">${cardMeta(k).icon} ${esc(cardMeta(k).name)}</button>`).join("")}</div></div></div>`;
      else if (kind === "pe") body = `<div class="cs-list">${list(myInv.pe, "give")}</div><small class="cs-muted">Permisele celorlalți sunt secrete — poți oferi doar din ale tale.</small>`;
      else if (kind === "r" || kind === "sl" || kind === "pl") body = `<div class="cs-two"><div><b>Ale tale</b><div class="cs-list">${list(myInv[kind], "give")}</div></div><div><b>Ce are ${esc(op.name)}</b><div class="cs-list">${list(opInv[kind], "get")}</div></div></div>${kind === "r" ? '<small class="cs-muted">Ruta trece cu tot cu sloturi; avioanele rămân.</small>' : ""}`;
      else if (kind === "pact") body = `<p>Tu și ${esc(op.name)} nu vă puteți îngheța unul pe altul cât ține pactul.</p><div class="cs-chips">${[5, 10, 20].map(d => `<button class="cs-chip" data-pact="${d}">${d} zile</button>`).join("")}</div>`;
      else if (kind === "loan") body = `<div class="cs-seg" data-r="lside"><button data-lside="get" class="on">Împrumut de la ${esc(op.name)}</button><button data-lside="give">Îi împrumut eu</button></div>
        <label>Suma ${amtInput("lamt", 5000000)}</label><label>Returnează ${amtInput("lrep", 5600000)}</label>
        <div class="cs-chips">${[10, 15, 20, 30].map(d => `<button class="cs-chip${d === 10 ? " on" : ""}" data-ldays="${d}">${d} zile</button>`).join("")}</div><small class="cs-muted" data-r="lint"></small><div class="cs-riskw" data-r="lrisk"></div><button class="cs-btn gold" data-ok="loan">Pune pe masă</button>`;
      const p = R("pop"); p.innerHTML = `<div class="cs-popc"><header><b>${K.ic} ${K.n}${vm.ps.length > 2 ? ` <small class="cs-muted">· cu ${esc(op.name)}</small>` : ""}</b><button class="cs-x2" data-act="pclose">×</button></header>${(kind === "m" || kind === "c") ? sideSel : ""}${body}</div>`;
      p.classList.add("on"); p.dataset.days = 10; H.sfx("pop");
      if (kind === "loan") updLoanInfo();
    }
    function openInfoPop(title, html) { pop = { kind: "info" }; const p = R("pop"); p.innerHTML = `<div class="cs-popc"><header><b>${title}</b><button class="cs-x2" data-act="pclose">×</button></header>${html}</div>`; p.classList.add("on"); H.sfx("pop"); }
    function updLoanInfo() {
      const a = amtVal(R("lamt")), r = amtVal(R("lrep")), d = +(R("pop").dataset.days || 10), pc = x => String(Math.round(x * 100) / 100).replace(".", ",");
      R("lint").textContent = a ? `Dobândă totală ${pc((r / a - 1) * 100)}% (${pc((r / a - 1) / d * 100)}%/zi) · banca cere ~0,5%/zi` : "";
      const lr = R("lrisk"); if (!lr) return;
      const vm = negoVM(O.st, O.seat, O.view), os = vm ? other(vm) : null, iBorrow = !pop || (pop.lside || "get") === "get";
      const bw = iBorrow ? O.seat : os, risk = a > 0 && bw ? loanRiskOf(O.st, bw, iBorrow ? os : O.seat, a) : null;
      setH("lrisk", riskHTML(risk, iBorrow, bw ? pinfo(O.st, bw, O.ctx).name : ""));
    }
    S.on(el, "input", e => { const r = e.target.dataset.r; if (e.target.classList.contains("cs-amt")) amtLive(e.target);
      if (r === "lrep") e.target.dataset.man = 1; else if (r === "lamt") autoRep(e.target, R("lrep"));
      if (r === "lamt" || r === "lrep") updLoanInfo(); });
    S.on(el, "focusout", e => { if (e.target.classList && e.target.classList.contains("cs-amt")) { setAmt(e.target, amtVal(e.target)); if (e.target.dataset.r === "lamt" || e.target.dataset.r === "lrep") updLoanInfo(); } });
    S.on(el, "click", e => {
      const b = e.target.closest("button, .cs-tok .x"); if (!b) { if (pop && !e.target.closest(".cs-popc")) closePop(); return; }
      const vm = negoVM(O.st, O.seat, O.view); if (!vm) return;
      const d = b.dataset;
      if (d.act === "pclose") { closePop(); return; }
      if (d.act === "deal") { const vw = O.view || viewOf(O, h, H); openInfoPop("📋 Oferta de pe masă", `<div class="cs-deal">${dealHTML(vm, vw, editing && vm.ps.length > 2 ? drafts : null)}</div>`); return; }
      if (d.cp) { if (d.cp === cp) return; cp = d.cp; H.sfx("tick"); if (editing && drafts) draft = drafts[cp] || (drafts[cp] = { give: emptyItems(), get: emptyItems() }); R("av-me").dataset.k = ""; draw(); return; }
      if (!vm.involved) { // spectator: doar invitația
        if (d.act === "join") { H.sfx("coin"); H.act("negoJoin", { yes: true }); return; }
        if (d.act === "nojoin") { H.sfx("click"); H.act("negoJoin", { yes: false }); return; }
        return;
      }
      if (b.classList.contains("x")) { const t = b.closest(".cs-tok"); if (!t || !t.dataset.side || t.dataset.side === "ro") return; if (!editing) startEdit(true); const it = draft[t.dataset.side], k = t.dataset.k, id = t.dataset.id;
        if (k === "m") it.m = 0; else if (k === "c") delete it.c[id]; else if (k === "pact") delete it.pact; else if (k === "loan") delete it.loan; else if (k === "sp") it.sp.splice(+id, 1); else it[k] = it[k].filter(x => String(x) !== id);
        H.sfx("tick"); draw(); return; }
      if (d.act === "close") { H.sfx("click"); H.act("negoClose"); if (O.close && !(vm.ps.length > 2 && !vm.res)) O.close(); return; }
      if (d.act === "new") { H.sfx("click"); startEdit(true); return; }
      if (d.act === "counter") { H.sfx("click"); startEdit(true); return; }
      if (d.act === "cancel") { editing = false; draft = null; drafts = null; H.sfx("tick"); draw(); return; }
      if (d.act === "accept") { H.sfx("coin"); H.act("negoAccept"); return; }
      if (d.act === "refuse") { H.sfx("click"); H.act("negoRefuse"); return; }
      if (d.act === "invite") { const ls = canInviteList(vm); openInfoPop("➕ Invită la masă", `<p>Cine mai vine la negociere? Primește o invitație și poate accepta sau refuza. La masă pot sta cel mult ${NG_MAXP} jucători.</p><div class="cs-who">${ls.map(s => { const p = pinfo(O.st, s, O.ctx); return `<button class="cs-whob" data-inv="${esc(s)}" style="--c:${p.color}">${avatarSVG(p.av, 64, "neutral", { ring: p.color })}<b>${esc(p.name)}</b><small>${esc(p.co)}</small>${p.bot ? "<em>bot</em>" : ""}</button>`; }).join("")}</div>`); return; }
      if (d.inv) { H.act("negoInvite", { who: d.inv }); H.sfx("whoosh"); closePop(); return; }
      if (d.act === "send" && drafts) {
        const legs = Object.keys(drafts).filter(x => vm.ps.indexOf(x) >= 0 && x !== O.seat && (!itemsEmpty(drafts[x].give) || !itemsEmpty(drafts[x].get)));
        if (legs.length <= 1) { const to = legs[0] || other(vm); H.act("negoOffer", { to, give: packItems(drafts[to].give), get: packItems(drafts[to].get) }); }
        else { const lines = []; legs.forEach(x => { lines.push({ f: O.seat, t: x, it: packItems(drafts[x].give) }); lines.push({ f: x, t: O.seat, it: packItems(drafts[x].get) }); }); H.act("negoOffer", { lines }); }
        H.sfx("whoosh"); editing = false; draft = null; drafts = null; draw(); return;
      }
      if (d.add) { openPop(d.add); return; }
      if (d.say != null) { H.act("negoSay", { k: String(d.say) }); H.sfx("pop"); const bb = R("bub-me"); bb.textContent = b.textContent; bb.classList.remove("on"); void bb.offsetWidth; bb.classList.add("on"); clearTimeout(bb._t); bb._t = setTimeout(() => bb.classList.remove("on"), 4200); return; }
      if (!pop || !draft) return;
      if (d.side) { pop.side = d.side; qa(R("pop"), "[data-side]").forEach(x => x.classList.toggle("on", x === b)); qa(R("pop"), "[data-have]").forEach(x => x.style.visibility = d.side === "give" ? "" : "hidden"); return; }
      if (d.lside) { pop.lside = d.lside; qa(R("pop"), "[data-lside]").forEach(x => x.classList.toggle("on", x === b)); updLoanInfo(); return; }
      if (d.ldays) { R("pop").dataset.days = d.ldays; qa(R("pop"), "[data-ldays]").forEach(x => x.classList.toggle("on", x === b)); updLoanInfo(); return; }
      if (d.mstep) { const i = R("mval"); setAmt(i, amtVal(i) + (+d.mstep)); H.sfx("tick"); return; }
      if (d.mset) { setAmt(R("mval"), +d.mset); H.sfx("tick"); return; }
      if (d.cstep) { const cc = b.closest(".cs-cc"), n = cc.querySelector("[data-cn]"); n.textContent = Math.max(0, Math.min(20, (+n.textContent) + (+d.cstep))); H.sfx("tick"); return; }
      if (d.pact) { draft.give.pact = +d.pact; delete draft.get.pact; closePop(); H.sfx("chime"); draw(); return; }
      if (d.pick != null) { const it = draft[d.pside]; const k = pop.kind; const v = d.pick; if (k === "sp") it.sp.push(v); else if (!it[k].some(x => String(x) === v)) { const vw = O.view || viewOf(O, h, H); const inv = invOf(O.st, d.pside === "give" ? O.seat : other(vm), vw, d.pside === "give"); const f = (inv[k] || []).find(x => String(x.id) === v); it[k].push(f ? f.id : v); } H.sfx("place"); closePop(); draw(); return; }
      if (d.ok === "m") { const v = Math.max(0, amtVal(R("mval"))); draft[pop.side].m = v; H.sfx("coin"); closePop(); draw(); return; }
      if (d.ok === "c") { qa(R("pop"), ".cs-cc").forEach(cc => { const n = +cc.querySelector("[data-cn]").textContent; const k = cc.dataset.ck; if (n > 0) draft[pop.side].c[k] = n; }); H.sfx("deal"); closePop(); draw(); return; }
      if (d.ok === "loan") { const amt = amtVal(R("lamt")), rep = amtVal(R("lrep")), days = +(R("pop").dataset.days || 10); if (amt <= 0) return; const side = (pop.lside || "get"); delete draft.give.loan; delete draft.get.loan; draft[side].loan = { amt, rep: Math.max(rep, amt), days }; H.sfx("coin"); closePop(); draw(); return; }
    });
    S.iv(() => { const vm = negoVM(O.st, O.seat, O.view); if (!vm || !built) return; const left = vm.dl ? Math.max(0, (vm.dl - H.now()) / 1000) : 0; const t = R("tl"); if (t) t.textContent = left ? fmtClock(left) : ""; const tb = R("tbar"); if (tb) tb.style.width = (vm.dl ? clamp(left / 120, 0, 1) * 100 : 100) + "%"; }, 500);
    draw();
    return { el, update(n) { O = Object.assign({}, O, n); draw(); }, destroy: S.destroy };
  }

  /* ---- deschidere negociere / cerere de împrumut (alegi partenerul) */
  function sceneNegoOpen(container, o, h) {
    const S = base(container, "cs-dlg cs-nopen", o), H = makeHelp(o, h);
    let O = o, loan = !!o.loan;
    const el = S.el;
    const allSeats = () => seatsOf(O.st).filter(s => s !== O.seat && !pinfo(O.st, s, O.ctx).out);
    let sel = o.with || null, days = 10;
    el.innerHTML = `<div class="cs-dlg-c"><header><h2 data-r="h"></h2><button class="cs-x2" data-act="x" aria-label="Închide">×</button></header>
      <div class="cs-seg"><button data-mode="0">🤝 Negociere</button><button data-mode="1">💰 Cere împrumut</button></div>
      <p class="cs-muted" data-r="p"></p>
      <div class="cs-who" data-r="who"></div>
      <div class="cs-loanf" data-r="lf"><label>Suma dorită${amtInput("amt", 5000000)}</label><label>Propui să returnezi${amtInput("rep", 5600000)}</label>
      <div class="cs-chips">${[1e6, 2e6, 5e6, 10e6, 20e6].map(v => `<button class="cs-chip" data-amt="${v}">${fmtE(v)}</button>`).join("")}</div>
      <div class="cs-chips">${[10, 15, 20, 30].map(d => `<button class="cs-chip${d === 10 ? " on" : ""}" data-d="${d}">${d} zile</button>`).join("")}</div><small class="cs-muted" data-r="li"></small><div class="cs-riskw" data-r="risk"></div></div>
      <div class="cs-warn" data-r="warn" hidden></div>
      <div class="cs-dlg-a"><button class="cs-btn ghost" data-act="x">Renunță</button><button class="cs-btn gold" data-act="go"></button></div></div>`;
    const R = k => q(el, `[data-r="${k}"]`);
    function draw() {
      const seats = allSeats(), v = O.view || viewOf(O, h, H) || {}, lg = v.legal || {};
      const can = Array.isArray(lg.canNego) ? lg.canNego : null;
      const ok = s => !can || can.indexOf(s) >= 0;
      if (!sel || !ok(sel)) sel = seats.find(ok) || null;
      qa(el, "[data-mode]").forEach(b => b.classList.toggle("on", (b.dataset.mode === "1") === loan));
      R("h").textContent = loan ? "💰 Cere un împrumut" : "🤝 Negociază";
      R("p").textContent = loan ? "Alege de la cine ceri bani. Timpul se oprește pentru toți cât discutați (max. 2 minute)." : "Alege cu cine vrei să negociezi. Timpul se oprește pentru toți (max. 2 minute; o negociere deschisă pe zi).";
      R("lf").style.display = loan ? "" : "none";
      setH(R("who"), seats.length ? seats.map(s => { const p = pinfo(O.st, s, O.ctx), en = ok(s); return `<button class="cs-whob${s === sel ? " on" : ""}" data-s="${s}" style="--c:${p.color}" ${en ? "" : "disabled"}>${avatarSVG(p.av, 72, "neutral", { ring: p.color })}<b>${esc(p.name)}</b><small>${esc(p.co)}</small>${p.bot ? "<em>bot</em>" : ""}</button>`; }).join("") : '<span class="cs-muted">Nu e nimeni cu care să negociezi.</span>');
      const me = rawP(O.st, O.seat), already = me && me.ngd && O.st && me.ngd === O.st.day;
      const w = R("warn"); w.hidden = !already && !!sel; w.textContent = already ? "Ai deschis deja o negociere azi — mai poți mâine." : !sel ? "Momentan nu poți negocia cu nimeni." : "";
      const go = q(el, '[data-act="go"]'); go.textContent = loan ? "📨 Cere împrumutul" : "🚪 Cheamă la birou"; go.disabled = !sel || !!already;
      if (loan) { const a = amtVal(R("amt")), r = amtVal(R("rep")); R("li").textContent = a > 0 ? `Dobândă propusă: ${String(Math.round((r / a - 1) * 1000) / 10).replace(".", ",")}% în ${days} zile` : "";
        setH(R("risk"), a > 0 ? riskHTML(loanRiskOf(O.st, O.seat, sel, a), true, "") : ""); }
    }
    const close = () => { if (O.close) O.close(); else if (O.onClose) O.onClose(); else api.destroy(); };
    S.on(el, "input", e => { if (e.target.classList && e.target.classList.contains("cs-amt")) amtLive(e.target); const r = e.target.dataset && e.target.dataset.r; if (r === "rep") e.target.dataset.man = 1; else if (r === "amt") autoRep(e.target, R("rep")); draw(); });
    S.on(el, "focusout", e => { if (e.target.classList && e.target.classList.contains("cs-amt")) { setAmt(e.target, amtVal(e.target)); draw(); } });
    S.on(el, "click", e => {
      const b = e.target.closest("button"); if (!b) { if (e.target === el) close(); return; }
      if (b.dataset.mode != null) { loan = b.dataset.mode === "1"; H.sfx("tick"); draw(); }
      else if (b.dataset.s) { sel = b.dataset.s; H.sfx("select"); draw(); }
      else if (b.dataset.amt) { const a = +b.dataset.amt, ra = amtVal(R("amt")), rr = amtVal(R("rep")), k = ra > 0 && rr >= ra ? rr / ra : 1.12; setAmt(R("amt"), a); setAmt(R("rep"), Math.round(a * k / 10000) * 10000); H.sfx("tick"); draw(); }
      else if (b.dataset.d) { days = +b.dataset.d; qa(el, "[data-d]").forEach(x => x.classList.toggle("on", x === b)); H.sfx("tick"); draw(); }
      else if (b.dataset.act === "x") { H.sfx("click"); close(); }
      else if (b.dataset.act === "go" && sel) {
        const pay = { with: sel }; if (loan) { const amt = amtVal(R("amt")), rep = amtVal(R("rep")); if (amt <= 0) return; pay.loan = { amt, rep: Math.max(rep, amt), days }; }
        H.act("negoOpen", pay); H.sfx("whoosh"); close();
      }
    });
    draw();
    const api = { el, update(n) { O = Object.assign({}, O, n); draw(); }, destroy: S.destroy };
    return api;
  }

  /* ================================================================== BANCĂ */
  function bankVM(o, h, H) {
    const v = viewOf(o, h, H) || {}, m = v.co || (typeof v.me === "object" ? v.me : {}) || {}, b = v.bank || {}, T = Tn() || {};
    const loans = (b.loans || []).map(l => ({ id: first(l.id, l.i), amt: num(first(l.amt, l.n0, l.amount), 0), left: num(first(l.p, l.left, l.rest), 0), days: num(first(l.d, l.days, l.daysLeft), 0), inst: num(first(l.inst, l.daily), 0), late: !!l.late }));
    return { cash: num(first(m.cash, v.cash), 0), value: num(first(m.value, v.value), 0), debt: num(first(m.debt, b.debt), loans.reduce((s, l) => s + l.left, 0)), limit: Math.max(0, num(b.limit, 0)), rate: num(first(b.rate, T.bankRate), 0.005), score: num(first(b.score, m.cs), null), negDays: num(first(m.neg, m.negDays), 0), negLeft: first(m.negLeft, null), loans, terms: b.terms || [10, 20, 30], g: m.g };
  }
  function sceneBank(container, o, h) {
    const S = base(container, "cs-dlg cs-bank", o), H = makeHelp(o, h);
    let O = o, amt = 0, days = 20; const el = S.el;
    el.innerHTML = `<div class="cs-dlg-c cs-bank-c"><header><div class="cs-bk-logo">🏛️</div><div><h2>Banca Mondială a Aviației</h2><small class="cs-muted">Credit oricând, fără să oprești timpul</small></div><button class="cs-x2" data-act="x">×</button></header>
      <div class="cs-bk-stats" data-r="stats"></div>
      <div class="cs-bk-new"><h3>Credit nou</h3><div class="cs-bk-amt"><b data-r="amt">0 €</b><input type="range" min="0" step="250000" data-r="rng"></div>
        <div class="cs-chips" data-r="q"></div>
        <div class="cs-seg cs-terms" data-r="terms">${[10, 20, 30].map(d => `<button data-days="${d}" class="${d === 20 ? "on" : ""}">${d} zile</button>`).join("")}</div>
        <div class="cs-bk-calc" data-r="calc"></div><button class="cs-btn gold big" data-act="take">🏦 Ia creditul</button></div>
      <div class="cs-bk-loans"><h3>Creditele tale</h3><div data-r="loans"></div></div></div>`;
    const R = k => q(el, `[data-r="${k}"]`);
    function calc(vm) { const r = vm.rate * (vm.score != null && vm.score < 40 ? 1.5 : 1); const total = Math.round(amt * (1 + r * days)); return { total, inst: Math.round(total / days), r }; }
    function draw() {
      const vm = bankVM(O, h, H);
      const scoreTxt = vm.score == null ? "" : `<div class="cs-bk-s"><span>Scor de credit</span><div class="cs-gauge"><i style="width:${clamp(vm.score, 0, 100)}%;background:${vm.score >= 70 ? "#7be07b" : vm.score >= 40 ? "#ffd35c" : "#ff6b6b"}"></i></div><b>${Math.round(vm.score)}</b></div>`;
      setH(R("stats"), `<div><span>Bani</span><b class="${vm.cash < 0 ? "bad" : "ok"}">${fmtE(vm.cash)}</b></div><div><span>Valoare companie</span><b>${fmtE(vm.value)}</b></div><div><span>Datorie la bancă</span><b class="${vm.debt > 0 ? "bad" : ""}">${fmtE(-vm.debt)}</b></div><div><span>Mai poți lua</span><b class="gold">${fmtE(vm.limit)}</b></div>${scoreTxt}
        ${vm.cash < 0 ? `<div class="cs-warn">⚠️ Ești pe minus! ${vm.negDays ? `Ziua ${vm.negDays} din 5 — ` : ""}dacă nu-ți revii în 5 zile, intri în faliment.</div>` : ""}`);
      const terms = (Array.isArray(vm.terms) && vm.terms.length ? vm.terms : [10, 20, 30]).map(Number).filter(x => x > 0);
      if (terms.indexOf(days) < 0) days = terms[Math.min(1, terms.length - 1)];
      setH(R("terms"), terms.map(d => `<button data-days="${d}" class="${d === days ? "on" : ""}">${d} zile</button>`).join(""));
      const rng = R("rng"); rng.max = String(Math.max(0, vm.limit)); if (amt > vm.limit) amt = vm.limit; if (!amt && vm.limit > 0) amt = Math.min(vm.limit, Math.max(250000, Math.round(vm.limit / 2 / 250000) * 250000));
      rng.value = String(amt); rng.disabled = vm.limit <= 0;
      R("amt").textContent = fmtE(amt);
      setH(R("q"), [1e6, 2e6, 5e6, 10e6].filter(v => v <= vm.limit).map(v => `<button class="cs-chip" data-set="${v}">${fmtE(v)}</button>`).join("") + (vm.limit > 0 ? `<button class="cs-chip" data-set="${vm.limit}">Maxim</button>` : ""));
      const c = calc(vm);
      setH(R("calc"), vm.limit > 0 ? `<div><span>Dobândă</span><b>${(c.r * 100).toFixed(2).replace(".", ",")}% / zi</b></div><div><span>Rată zilnică</span><b>${fmtE(c.inst)}</b></div><div><span>Total de returnat</span><b>${fmtE(c.total)}</b></div><small class="cs-muted">Rambursarea anticipată e gratuită.</small>` : `<div class="cs-warn">Banca nu-ți mai dă credit acum. Limita = 50% din valoarea companiei minus datoria.</div>`);
      q(el, '[data-act="take"]').disabled = !(amt > 0 && vm.limit > 0);
      setH(R("loans"), vm.loans.length ? vm.loans.map(l => `<div class="cs-loan${l.late ? " late" : ""}"><div><b>${fmtE(l.left)}</b><small>rest de plată${l.amt ? ` din ${fmtE(l.amt)}` : ""}</small></div><div><b>${l.days} zile</b><small>rămase</small></div><div><b>${fmtE(l.inst)}</b><small>rată / zi</small></div>
        <div class="cs-loan-a"><button class="cs-btn small" data-repay="${esc(l.id)}" data-am="${Math.min(l.left, Math.max(0, vm.cash))}" ${vm.cash <= 0 ? "disabled" : ""}>${vm.cash >= l.left ? "Achită tot" : "Plătește " + fmtE(Math.max(0, vm.cash))}</button></div></div>`).join("") : '<div class="cs-muted cs-none">Nu ai niciun credit. 👍</div>');
    }
    const close = () => { H.sfx("click"); if (O.close) O.close(); else if (O.onClose) O.onClose(); };
    S.on(el, "input", e => { if (e.target.dataset.r === "rng") { amt = +e.target.value; H.sfx("tick"); draw(); } });
    S.on(el, "click", e => {
      const b = e.target.closest("button"); if (!b) { if (e.target === el) close(); return; }
      if (b.dataset.act === "x") close();
      else if (b.dataset.set) { amt = +b.dataset.set; H.sfx("tick"); draw(); }
      else if (b.dataset.days) { days = +b.dataset.days; qa(el, "[data-days]").forEach(x => x.classList.toggle("on", x === b)); H.sfx("tick"); draw(); }
      else if (b.dataset.act === "take" && amt > 0) { H.act("bank", { amount: amt, days }); H.sfx("coin"); const r = b.getBoundingClientRect(); artCall("moneyBurst", [r.left + r.width / 2, r.top, "+" + fmtE(amt), { container: document.body, color: "#7be07b" }], null); amt = 0; S.t(draw, 50); }
      else if (b.dataset.repay != null) { const id = isNaN(+b.dataset.repay) ? b.dataset.repay : +b.dataset.repay; H.act("repay", { id, amount: +b.dataset.am }); H.sfx("coin"); }
    });
    draw();
    return { el, update(n) { O = Object.assign({}, O, n); draw(); }, destroy: S.destroy };
  }

  /* ================================================================== ÎNGHEȚ */
  function freezeVM(st, seat, view, now) {
    const T = Tn() || {};
    const v = view && view.frozen !== undefined ? view.frozen : undefined;
    if (v !== undefined) {
      if (!v) return { frozen: false, left: 0, by: null, canBreak: false, promptLeft: 0, total: num(T.freezeSec, 30) };
      return { frozen: num(v.left, 0) > 0, left: num(v.left, 0), by: v.by || null, canBreak: !!v.canBreak, prompt: !!v.prompt, promptLeft: v.prompt ? num(v.promptLeft, 5) : 0, total: num(T.freezeSec, 30) };
    }
    const c = rawP(st, seat), fz = c && c.fz;
    if (!fz) return { frozen: false, left: 0, by: null, canBreak: false, promptLeft: 0, total: num(T.freezeSec, 30) };
    return { frozen: true, left: num(T.freezeSec, 30), by: fz.by || null, canBreak: !!(c.sx && c.sx.brk && fz.pu), prompt: !!fz.pu, promptLeft: 0, total: num(T.freezeSec, 30) };
  }
  function sceneFreeze(container, o, h) {
    const S = base(container, "cs-freeze", o), H = makeHelp(o, h);
    let O = o, answered = false, gone = false, wasPrompt = false, pDead = 0; const el = S.el;
    el.innerHTML = `<div class="cs-ice">${iceHTML()}</div><div class="cs-fz-c"><div class="cs-fz-ic">❄️</div><h2 data-r="t">Compania ta e înghețată!</h2><p data-r="s"></p><div class="cs-fz-ring"><svg viewBox="0 0 44 44"><circle cx="22" cy="22" r="19" class="bg"/><circle cx="22" cy="22" r="19" class="fg" data-r="ring"/></svg><b data-r="sec">30</b></div></div>
      <div class="cs-brk" data-r="brk"><div class="cs-brk-c"><div class="cs-brk-ic">🔥</div><h3>Folosești Spărgătorul de gheață?</h3><p>Anulezi înghețul pe loc. Ai 5 secunde!</p><div class="cs-brk-bar"><i data-r="pb"></i></div>
      <div class="cs-brk-a"><button class="cs-btn bad big" data-use="1">🔥 Da, sparge gheața!</button><button class="cs-btn ghost" data-use="0">Nu, păstrez cartea</button></div></div></div>`;
    const R = k => q(el, `[data-r="${k}"]`);
    H.sfx("powerup");
    function draw() {
      const vm = freezeVM(O.st, O.seat, O.view || viewOf(O, h, H), H.now());
      const by = vm.by ? pinfo(O.st, vm.by, O.ctx) : null;
      R("s").innerHTML = by ? `<b class="cs-fzby" style="--c:${by.color}">${esc(by.name)}</b> ${gx(by.g, "a jucat", "a jucat")} „Îngheață timpul” împotriva ta. Avioanele tale stau pe loc, iar pasagerii de pe rutele comune merg la ${gx(by.g, "el", "ea")}.` : "Avioanele tale stau pe loc și nu poți face nimic până se topește gheața.";
      R("sec").textContent = Math.ceil(vm.left);
      R("ring").style.strokeDashoffset = String(119.4 * (1 - clamp(vm.left / (vm.total || 30), 0, 1)));
      // vederea (O.view) vine doar la randări: ținem termenul local, ca promptul să dispară la timp și bara să curgă
      if (vm.canBreak && vm.promptLeft > 0) { const d = H.now() + (vm.promptLeft - 0.6) * 1000; if (!pDead || d < pDead) pDead = d; }
      const pLeft = pDead ? Math.max(0, (pDead - H.now()) / 1000) : 0;
      const prompt = vm.canBreak && pLeft > 0 && !answered;
      R("brk").classList.toggle("on", prompt);
      if (prompt && !wasPrompt) H.sfx("alarm"); wasPrompt = prompt;
      if (prompt) R("pb").style.width = clamp(pLeft / 5, 0, 1) * 100 + "%";
      if (!vm.frozen && !gone) { gone = true; shatter(); }
    }
    function shatter() { el.classList.add("melt"); H.sfx("splash"); S.t(() => { if (O.close) O.close(); }, 1200); }
    S.on(el, "click", e => { const b = e.target.closest("[data-use]"); if (!b || answered) return; answered = true; const use = b.dataset.use === "1"; H.act("breaker", { use }); R("brk").classList.remove("on"); if (use) { H.sfx("boom"); el.classList.add("crack"); } else H.sfx("click"); });
    S.iv(draw, 150); draw();
    return { el, update(n) { O = Object.assign({}, O, n); draw(); }, destroy: S.destroy };
  }

  /* ================================================================== FALIMENT */
  function sceneBankrupt(container, o, h) {
    const S = base(container, "cs-bkr", o), H = makeHelp(o, h);
    const O = o, el = S.el, victim = o.victim || o.seat, p = pinfo(O.st, victim, O.ctx), mine = victim === O.seat;
    el.innerHTML = `<div class="cs-storm"><i class="r1"></i><i class="r2"></i><i class="flash"></i></div><div class="cs-bkr-c">
      <div class="cs-bkr-av">${avatarSVG(p.av, 200, "sad", { ring: p.color })}<span class="cs-stamp2">FALIMENT</span></div>
      <div class="cs-bkr-logo">${logoSVG(p.co, "#6b6f78", 56)}<b>${esc(p.co)}</b></div>
      <h1>${mine ? gx(p.g, "Ai dat faliment", "Ai dat faliment") : `${esc(p.name)} a dat faliment`}</h1>
      <p>${mine ? `Compania ta, <b>${esc(p.co)}</b>, nu și-a mai putut plăti datoriile. Avioanele au fost sechestrate de bancă, iar rutele s-au închis. Poți urmări în continuare partida ca ${gx(p.g, "spectator", "spectatoare")}.`
        : `Compania <b>${esc(p.co)}</b> (${esc(p.name)}) a ieșit din joc: avioanele au fost sechestrate, iar rutele și sloturile s-au eliberat. Profită!`}</p>
      <div class="cs-planes">${[0, 1, 2].map(i => `<span class="cs-gp" style="--i:${i}">${artCall("planeSide", [["t72", "a320", "s350"][i], "#6b6f78", { w: 160 }], "✈️")}</span>`).join("")}</div>
      <button class="cs-btn ${mine ? "" : "gold"}" data-act="ok">${mine ? "Continuă să privești" : "Mai departe"}</button></div>`;
    H.sfx(mine ? "lose" : "boom");
    S.on(el, "click", e => { if (e.target.closest('[data-act="ok"]')) { H.sfx("click"); if (O.close) O.close(); else if (O.onClose) O.onClose(); } });
    if (!mine) S.t(() => { if (O.close) O.close(); else if (O.onClose) O.onClose(); }, 9000);
    return { el, update() { }, destroy: S.destroy };
  }

  /* ================================================================== FINAL */
  const STEP_DEF = [
    { k: "cash", n: "Bani în cont", ic: "💶", alias: ["cash", "bani", "start", "money"] },
    { k: "bank", n: "1. Datoria la bancă rambursată", ic: "🏦", alias: ["bank", "debt", "banca", "credit"] },
    { k: "loans", n: "2. Împrumuturi între jucători", ic: "🤝", alias: ["loans", "loan", "p2p", "imprumut"] },
    { k: "assets", n: "3. Avioane, rute, sloturi, huburi, investiții", ic: "✈️", alias: ["assets", "planes", "routes", "slots", "hubs", "fleet", "inv"] },
    { k: "cards", n: "4. Cărți rămase (− permise neconstruite)", ic: "🃏", alias: ["cards", "hand", "permits", "collector"] },
    { k: "shares", n: "5. Acțiuni la alte companii", ic: "📈", alias: ["shares", "stock", "bursa"] }
  ];
  function endVM(st, ctx) {
    const RS = (st && st.res) || {};
    let fv = RS.vals || (st && (st.fv || st.final)) || null;
    const L = Lg();
    if (!fv && L && typeof L.finalValuation === "function") { try { fv = L.finalValuation(st); } catch (e) { fv = null; } }
    fv = Array.isArray(fv) ? fv : (fv ? Object.keys(fv).map(s => Object.assign({ seat: s }, fv[s])) : []);
    const rows = fv.map(r => {
      const p = pinfo(st, r.seat, ctx);
      const steps = STEP_DEF.map(d => ({ k: d.k, v: 0, parts: [] }));
      (r.steps || []).forEach(s => {
        const key = String(first(s.k, s.key, s.id, s.n, "")).toLowerCase(); const v = num(first(s.v, s.val, s.amount, s.d), 0);
        let i = STEP_DEF.findIndex(d => d.alias.some(a => key.indexOf(a) === 0));
        if (i < 0) i = 3;
        steps[i].v += v; steps[i].parts.push({ n: first(s.n, s.label, s.name, key), v });
      });
      const total = num(r.total, steps.reduce((a, s) => a + s.v, 0));
      return { seat: r.seat, p, steps, total, rank: num(r.rank, 0), out: !!first(r.out, r.bankrupt, p.out, false) };
    });
    rows.sort((a, b) => (a.out - b.out) || (b.total - a.total)); rows.forEach((r, i) => { if (!r.rank) r.rank = i + 1; });
    const winner = first(RS.win, st && st.winner, rows[0] && rows[0].seat, null);
    const ach = RS.ach || (st && st.ach) || {};
    const stats = RS.stats || (st && st.stats) || {};
    rows.forEach(r => { if (!stats[r.seat] && r.p.st) stats[r.seat] = r.p.st; });
    return { rows, winner, ach, stats };
  }
  // chei LOGIC (CerulData.STATS_FIELDS) → etichete scurte, cu majusculă, în ordinea afișării
  const STAT_L2 = { flights: ["Zboruri efectuate", 0, 1], revenue: ["Venituri din bilete", 1, 3], profit: ["Profit din zboruri", 1, 4], bestFlight: ["Cel mai profitabil zbor", 1, 5],
    fullFlights: ["Zboruri pline", 0, 12], routes: ["Rute construite", 0, 7], longestRoute: ["Cea mai lungă rută (km)", 0, 8], pioneer: ["Rute de pionier", 0, 9], planesMax: ["Flotă maximă", 0, 10],
    planesBought: ["Avioane cumpărate", 0, 23], usedBought: ["Avioane la mâna a doua", 0, 24], planesSold: ["Avioane vândute", 0, 26], freezes: ["Înghețuri date", 0, 15], frozen: ["Înghețuri primite", 0, 16],
    breakers: ["Spărgătoare folosite", 0, 17], bankLoans: ["Credite bancare", 0, 22], maxValue: ["Valoarea maximă", 1, 11.5], pacts: ["Pacte semnate", 0, 19.5], breakdowns: ["Defecțiuni", 0, 28] };
  const STAT_L = { fl: ["Zboruri", 0, 1], pax: ["Pasageri transportați", 0, 2], rev: ["Venituri din bilete", 1, 3], cost: ["Costuri de zbor", 1, 4], best: ["Cel mai profitabil zbor", 1, 5],
    km: ["Kilometri zburați", 0, 6], built: ["Rute construite", 0, 7], longest: ["Cea mai lungă rută (km)", 0, 8], pio: ["Rute de pionier", 0, 9], maxPlanes: ["Flotă maximă", 0, 10],
    maxCash: ["Cei mai mulți bani avuți", 1, 11], full: ["Zboruri pline", 0, 12], picks: ["Cărți alese la draft", 0, 13], specials: ["Speciale jucate", 0, 14], frz: ["Înghețuri date", 0, 15],
    frzd: ["Înghețuri primite", 0, 16], brk: ["Spărgătoare folosite", 0, 17], deals: ["Afaceri încheiate", 0, 18], negos: ["Negocieri deschise", 0, 19], loansGiven: ["Împrumuturi date", 0, 20],
    loansTaken: ["Împrumuturi luate", 0, 21], bank: ["Credite bancare", 0, 22], planes: ["Avioane cumpărate", 0, 23], used: ["Avioane la mâna a doua", 0, 24], leased: ["Avioane în leasing", 0, 25],
    sold: ["Avioane vândute", 0, 26], hubs: ["Huburi", 0, 27], delays: ["Întârzieri", 0, 28], events: ["Evenimente trăite", 0, 29], ghiseu: ["Schimburi la ghișeu", 0, 30],
    bought: ["Cărți cumpărate", 0, 31], cards: ["Cărți primite", 0, 32], shares: ["Acțiuni cumpărate", 0, 33], days: ["Zile jucate", 0, 34] };
  Object.assign(STAT_L, STAT_L2);
  /* istoricul valorii (LOGIC-2): {seat:[v…]} | [{d|day, v:{seat:val}}] | per companie c.vh = [v…] sau [{d, v}] / [[d, v]] */
  function histOf(st, seats) {
    const out = {}; if (!st) return out;
    const RS = st.res || {};
    const ptOf = (x, i) => { if (typeof x === "number") return { d: i, v: x }; if (Array.isArray(x)) return x.length === 2 ? { d: num(x[0], i), v: num(x[1], NaN) } : null; if (x && typeof x === "object") return { d: num(first(x.d, x.day), i), v: num(first(x.v, x.val, x.value), NaN) }; return null; };
    const addSeries = (s, arr) => { if (!Array.isArray(arr)) return; const pts = arr.map(ptOf).filter(p => p && isFinite(p.v)); if (pts.length) out[s] = pts; };
    const g = first(RS.vh, RS.hist, RS.valHist, st.vh, st.valHist, st.vhist, null);
    if (Array.isArray(g)) g.forEach((row, i) => { if (!row || typeof row !== "object") return; const d = num(first(row.d, row.day), i), v = row.v || row.vals || row; seats.forEach(s => { const x = v[s]; const val = typeof x === "number" ? x : x && typeof x === "object" ? num(first(x.v, x.value, x.total), NaN) : NaN; if (isFinite(val)) (out[s] = out[s] || []).push({ d, v: val }); }); });
    else if (g && typeof g === "object") seats.forEach(s => addSeries(s, g[s]));
    seats.forEach(s => { if (out[s]) return; const c = rawP(st, s); addSeries(s, first(c.vh, c.vhist, c.valHist, null)); });
    Object.keys(out).forEach(s => out[s].sort((a, b) => a.d - b.d));
    return out;
  }
  const shortE = v => { const a = Math.abs(v), sg = v < 0 ? "−" : ""; return sg + (a >= 1e9 ? (a / 1e9).toFixed(a >= 1e10 ? 0 : 1).replace(".", ",") + " mld" : a >= 1e6 ? (a / 1e6).toFixed(a >= 1e8 ? 0 : a >= 1e7 ? 0 : 1).replace(".", ",") + " M" : a >= 1e3 ? Math.round(a / 1e3) + " k" : String(Math.round(a))); };
  function niceStep(span, n) { const raw = span / Math.max(1, n), p = Math.pow(10, Math.floor(Math.log10(raw || 1))), f = raw / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p; }
  /* grafic linie: valoarea fiecărei companii pe zile (culorile companiilor), etichete la capăt, fără deformare de text */
  function graphSVG(rows, H, w, h, phone) {
    const ser = rows.filter(r => H[r.seat] && H[r.seat].length);
    if (!ser.length) return "";
    let d0 = Infinity, d1 = -Infinity, v0 = 0, v1 = -Infinity;
    ser.forEach(r => H[r.seat].forEach(p => { d0 = Math.min(d0, p.d); d1 = Math.max(d1, p.d); v0 = Math.min(v0, p.v); v1 = Math.max(v1, p.v); }));
    if (d1 <= d0) d1 = d0 + 1; if (v1 <= v0) v1 = v0 + 1;
    const st = niceStep(v1 - v0, phone ? 4 : 5); v0 = Math.floor(v0 / st) * st; v1 = Math.ceil(v1 / st) * st;
    const padL = phone ? 44 : 64, padR = phone ? 12 : 150, padT = 14, padB = 30;
    const X = d => padL + (d - d0) / (d1 - d0) * (w - padL - padR), Y = v => padT + (1 - (v - v0) / (v1 - v0)) * (h - padT - padB);
    const grid = []; for (let v = v0; v <= v1 + st / 2; v += st) grid.push(`<line x1="${padL}" x2="${w - padR}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}" class="${Math.abs(v) < st / 2 ? "z" : ""}"/><text x="${padL - 8}" y="${(Y(v) + 4).toFixed(1)}" text-anchor="end">${shortE(v)}</text>`);
    const dstep = Math.max(1, Math.ceil((d1 - d0) / (phone ? 5 : 10)));
    const xl = []; for (let d = Math.ceil(d0); d <= d1; d += dstep) xl.push(`<text x="${X(d).toFixed(1)}" y="${h - 8}" text-anchor="middle">${d}</text>`);
    const ends = [];
    const lines = ser.map(r => { const pts = H[r.seat]; const dpath = pts.map((p, i) => (i ? "L" : "M") + X(p.d).toFixed(1) + " " + Y(p.v).toFixed(1)).join(" "); const lp = pts[pts.length - 1]; ends.push({ r, x: X(lp.d), y: Y(lp.v), v: lp.v });
      return `<path d="${dpath}" fill="none" stroke="${r.p.color}" stroke-width="${phone ? 2.5 : 3.5}" stroke-linejoin="round" stroke-linecap="round" class="ln"${r.out ? ' stroke-dasharray="6 5" opacity=".6"' : ""}/>`; });
    // etichete la capăt fără suprapunere
    ends.sort((a, b) => a.y - b.y); let last = -1e9; ends.forEach(e => { e.ly = Math.max(e.y, last + (phone ? 0 : 30)); last = e.ly; });
    const lab = ends.map(e => `<circle cx="${e.x.toFixed(1)}" cy="${e.y.toFixed(1)}" r="${phone ? 4 : 6}" fill="${e.r.p.color}" stroke="#0b1626" stroke-width="2"/>` + (phone ? "" : `<text x="${(e.x + 12).toFixed(1)}" y="${(e.ly + 1).toFixed(1)}" class="lb" style="fill:${e.r.p.color}">${esc(e.r.p.name)}</text><text x="${(e.x + 12).toFixed(1)}" y="${(e.ly + 15).toFixed(1)}" class="lv">${shortE(e.v)} €</text>`)).join("");
    return `<svg class="cs-graph" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" data-d0="${d0}" data-d1="${d1}" data-pl="${padL}" data-pr="${padR}"><g class="gr">${grid.join("")}</g><g class="xl">${xl.join("")}<text x="${padL - 8}" y="${h - 8}" text-anchor="end" class="ax">${phone ? "" : "ziua"}</text></g>${lines.join("")}<line class="cx" x1="0" x2="0" y1="${padT}" y2="${h - padB}" style="display:none"/>${lab}</svg>`;
  }
  function achMeta(id) { const D = Dt(); const a = D && Array.isArray(D.ACH) && D.ACH.find(x => x.id === id); return a ? { ic: a.icon || "🏅", n: a.n || id, d: a.d || "" } : { ic: "🏅", n: String(id), d: "" }; }
  function sceneEnd(container, o, h) {
    const S = base(container, "cs-end", o), H = makeHelp(o, h);
    let O = o; const el = S.el; let tab = "val";
    function shell() {
      el.innerHTML = `<div class="cs-end-bg"><i class="cs-beam b1"></i><i class="cs-beam b2"></i></div><div class="cs-end-in">
        <header class="cs-end-h"><h1 data-r="title">Evaluarea finală</h1><p data-r="sub">Se adună tot ce valorează fiecare companie…</p></header>
        <nav class="cs-tabs" data-r="tabs"><button data-tab="val" class="on">📊 Evaluare</button><button data-tab="pod">🏆 Podium</button><button data-tab="gr" data-r="grtab">📈 Evoluția valorii</button><button data-tab="ach">🏅 Realizări</button><button data-tab="st">🧮 Statistici</button><button data-tab="replay" class="rp">↻ Reia animația</button></nav>
        <section class="cs-pane" data-p="val"><div class="cs-vt-wrap"><table class="cs-vtab" data-r="vtab"></table></div></section>
        <section class="cs-pane" data-p="pod" hidden><div class="cs-podium" data-r="pod"></div></section>
        <section class="cs-pane" data-p="gr" hidden><div class="cs-grbox"><div class="cs-grh"><b>Valoarea companiilor, zi cu zi</b><small class="cs-muted">aceeași formulă ca evaluarea finală</small></div><div class="cs-grc" data-r="gr"></div><div class="cs-grleg" data-r="grleg"></div><div class="cs-grtip" data-r="grtip"></div></div></section>
        <section class="cs-pane" data-p="ach" hidden><div class="cs-achs" data-r="ach"></div></section>
        <section class="cs-pane" data-p="st" hidden><div class="cs-stats" data-r="st"></div></section></div>`;
    }
    const R = k => q(el, `[data-r="${k}"]`);
    function show(t) { tab = t; qa(el, "[data-tab]").forEach(b => b.classList.toggle("on", b.dataset.tab === t)); qa(el, "[data-p]").forEach(p => p.hidden = p.dataset.p !== t); if (t === "gr") drawGraph(); }
    let gen = 0, GR = null; // GR = { rows, hist } pentru grafic
    function drawGraph() {
      const box = R("gr"); if (!box || !GR) return;
      const phone = el.classList.contains("cs-phone");
      const w = Math.max(280, Math.floor(box.clientWidth || (el.clientWidth - 40))), hh = phone ? Math.round(Math.min(380, w * 0.95)) : Math.round(clamp(w * 0.42, 260, clamp((el.clientHeight || 800) - 340, 260, 600)));
      setH(box, graphSVG(GR.rows, GR.hist, w, hh, phone) || '<p class="cs-muted">Istoricul valorii nu e disponibil pentru partida asta.</p>');
      setH(R("grleg"), GR.rows.filter(r => GR.hist[r.seat]).map(r => { const pts = GR.hist[r.seat], lv = pts[pts.length - 1].v, best = pts.reduce((a, p) => p.v > a.v ? p : a, pts[0]);
        return `<span class="cs-gl" style="--c:${r.p.color}"><i></i><b>${esc(r.p.name)}</b><em>${fmtE(lv)}</em>${best.d !== pts[pts.length - 1].d && best.v > lv * 1.02 ? `<small>maxim ${fmtE(best.v)} (ziua ${best.d})</small>` : ""}</span>`; }).join(""));
    }
    function graphHover(e) {
      const svg = e.target.closest && e.target.closest(".cs-graph"), tip = R("grtip"); if (!tip) return;
      if (!svg || !GR) { tip.classList.remove("on"); const c0 = q(el, ".cs-graph .cx"); if (c0) c0.style.display = "none"; return; }
      const r = svg.getBoundingClientRect(), vb = svg.viewBox.baseVal, sx = vb.width / r.width, x = (e.clientX - r.left) * sx;
      const d0 = +svg.dataset.d0, d1 = +svg.dataset.d1, pl = +svg.dataset.pl, pr = +svg.dataset.pr;
      const d = Math.round(d0 + clamp((x - pl) / (vb.width - pl - pr), 0, 1) * (d1 - d0)), cx = pl + (d - d0) / (d1 - d0 || 1) * (vb.width - pl - pr);
      const ln = q(svg, ".cx"); ln.setAttribute("x1", cx); ln.setAttribute("x2", cx); ln.style.display = "";
      const vals = GR.rows.map(rw => { const pts = GR.hist[rw.seat] || [], p = pts.find(z => z.d === d); return p ? { rw, v: p.v } : null; }).filter(Boolean).sort((a, b) => b.v - a.v);
      if (!vals.length) { tip.classList.remove("on"); return; }
      tip.innerHTML = `<b>Ziua ${d}</b>` + vals.map(o => `<span style="--c:${o.rw.p.color}"><i></i>${esc(o.rw.p.name)}<em>${fmtE(o.v)}</em></span>`).join("");
      const br = R("gr").getBoundingClientRect(), left = cx / sx + (r.left - br.left);
      tip.style.left = clamp(left + 14, 0, Math.max(0, br.width - 220)) + "px"; tip.style.top = "8px"; tip.classList.add("on");
    }
    S.on(el, "pointermove", graphHover); S.on(el, "pointerleave", graphHover);
    let grRz = 0; if (W.addEventListener) S.on(W, "resize", () => { clearTimeout(grRz); grRz = setTimeout(() => { if (tab === "gr") drawGraph(); }, 150); });
    function run() {
      const my = ++gen; const T = (fn, ms) => S.t(() => { if (my === gen) fn(); }, ms);
      shell(); const vm = endVM(O.st, O.ctx); const rows = vm.rows;
      // grafic: istoricul + valoarea finală ca ultim punct (dacă ziua finală lipsește)
      const hist = histOf(O.st, rows.map(r => r.seat)), fday = num(O.st && O.st.day, null);
      rows.forEach(r => { const pts = hist[r.seat]; if (!pts || !pts.length) return; const lp = pts[pts.length - 1]; if (fday != null && lp.d < fday && Math.round(lp.v) !== Math.round(r.total)) pts.push({ d: fday, v: r.total }); });
      GR = { rows, hist };
      const hasGr = rows.some(r => (hist[r.seat] || []).length >= 2);
      R("grtab").hidden = !hasGr;
      const maxT = Math.max(1, ...rows.map(r => Math.abs(r.total)));
      R("vtab").innerHTML = `<thead><tr><th></th>${rows.map(r => `<th style="--c:${r.p.color}"><div class="cs-vh">${avatarSVG(r.p.av, 56, "thinking", { ring: r.p.color })}<b>${esc(r.p.name)}</b><small>${esc(r.p.co)}</small>${r.out ? '<em class="bad">faliment</em>' : ""}</div></th>`).join("")}</tr></thead>
        <tbody>${STEP_DEF.map((d, i) => `<tr class="cs-st" data-i="${i}"><td class="cs-stn"><i>${d.ic}</i>${d.n}</td>${rows.map(r => { const v = r.steps[i].v; return `<td class="${v < 0 ? "neg" : v > 0 ? "pos" : ""}" title="${esc(r.steps[i].parts.map(p => p.n + ": " + fmtE(p.v)).join("\n"))}">${i === 0 ? "" : v > 0 ? "+" : ""}${fmtE(v)}</td>`; }).join("")}</tr>`).join("")}
        <tr class="cs-tot"><td class="cs-stn">Valoare finală</td>${rows.map(r => `<td style="--c:${r.p.color}"><b data-tot="${r.seat}">0 €</b><div class="cs-bar"><i data-bar="${r.seat}"></i></div><span class="cs-rk" data-rk="${r.seat}">${r.rank}</span></td>`).join("")}</tr></tbody>`;
      R("sub").textContent = "Se adună tot ce valorează fiecare companie…";
      const run = rows.map(() => 0); const rm = RM(), gap = rm ? 0 : 1100;
      H.sfx("start");
      STEP_DEF.forEach((d, i) => T(() => {
        const tr = q(el, `.cs-st[data-i="${i}"]`); if (tr) tr.classList.add("on"); H.sfx(i ? "coin" : "deal");
        rows.forEach((r, j) => { const from = run[j]; run[j] += r.steps[i].v; countUp(q(el, `[data-tot="${r.seat}"]`), from, run[j], rm ? 0 : 800, fmtE); const bar = q(el, `[data-bar="${r.seat}"]`); if (bar) bar.style.width = clamp(run[j] / maxT, 0, 1) * 100 + "%"; });
      }, 400 + i * gap));
      T(() => {
        q(el, ".cs-tot").classList.add("on"); rows.forEach((r, j) => { countUp(q(el, `[data-tot="${r.seat}"]`), run[j], r.total, rm ? 0 : 600, fmtE); const bar = q(el, `[data-bar="${r.seat}"]`); if (bar) bar.style.width = clamp(r.total / maxT, 0, 1) * 100 + "%"; });
        const w = rows[0]; if (!w) return;
        const meWin = w.seat === O.seat;
        R("title").innerHTML = meWin ? "Ai câștigat! 🏆" : `${esc(w.p.name)} a câștigat!`;
        R("sub").innerHTML = `<b style="color:${w.p.color}">${esc(w.p.co)}</b> e ${gx(w.p.g, "stăpânul", "stăpâna")} cerului, cu o valoare de <b>${fmtE(w.total)}</b>.`;
        H.sfx(meWin ? "win" : (O.seat ? "lose" : "chime")); confettiIn(el);
        T(() => show("pod"), rm ? 400 : 2600);
        if (hasGr) T(() => { if (tab === "pod") show("gr"); }, rm ? 3000 : 9000);
      }, 400 + STEP_DEF.length * gap + 200);
      // podium
      const order = [rows[1], rows[0], rows[2]].filter(Boolean), H2 = { 1: 100, 2: 74, 3: 54 };
      R("pod").innerHTML = `<div class="cs-pods">${order.map(r => `<div class="cs-pod r${r.rank}" style="--c:${r.p.color};--h:${H2[r.rank] || 40}"><div class="cs-pod-av">${r.rank === 1 ? '<span class="cs-crown">👑</span>' : ""}${avatarSVG(r.p.av, r.rank === 1 ? 170 : 130, r.rank === 1 ? "happy" : r.out ? "sad" : "smug", { ring: r.p.color })}</div><b>${esc(r.p.name)}</b><small>${esc(r.p.co)}</small><span class="cs-pod-v">${fmtE(r.total)}</span><div class="cs-pod-b"><span>${r.rank}</span></div></div>`).join("")}</div>
        ${rows.slice(3).map(r => `<div class="cs-pod4" style="--c:${r.p.color}"><span>${r.rank}.</span>${avatarSVG(r.p.av, 44, r.out ? "sad" : "neutral", { ring: r.p.color })}<b>${esc(r.p.name)}</b><small>${esc(r.p.co)}</small><span>${fmtE(r.total)}</span></div>`).join("")}`;
      // realizări
      R("ach").innerHTML = rows.map(r => { const list = (vm.ach[r.seat] || []); return `<div class="cs-achp" style="--c:${r.p.color}"><header>${avatarSVG(r.p.av, 40, "happy", { ring: r.p.color })}<b>${esc(r.p.name)}</b><small>${list.length} ${list.length === 1 ? "realizare" : "realizări"}</small></header><div class="cs-achl">${list.length ? list.map((id, i) => { const a = achMeta(id); return `<div class="cs-ach" style="--d:${i * 60}ms"><i>${a.ic}</i><div><b>${esc(a.n)}</b><small>${esc(a.d)}</small></div></div>`; }).join("") : '<span class="cs-muted">Nicio realizare de data asta.</span>'}</div></div>`; }).join("");
      // statistici
      const D = Dt(), SF = (D && D.STATS_FIELDS) || {};
      const fields = []; rows.forEach(r => { const s = vm.stats[r.seat] || {}; Object.keys(s).forEach(k => { if (typeof s[k] === "number" && fields.indexOf(k) < 0) fields.push(k); }); });
      const lbl = k => { if (STAT_L[k]) return STAT_L[k][0]; const v = SF[k]; let t = typeof v === "string" ? v : v && (v.n || v.d); t = t ? t.split(/[(—:]/)[0].replace(/^€\s*/, "").trim() : k; return t.charAt(0).toUpperCase() + t.slice(1); };
      const money = k => STAT_L[k] ? STAT_L[k][1] === 1 : /rev|cost|profit|cash|eur|money|venit|bani|val|best/i.test(k);
      fields.sort((a, b) => (STAT_L[a] ? STAT_L[a][2] : 99) - (STAT_L[b] ? STAT_L[b][2] : 99));
      R("st").innerHTML = fields.length ? `<table class="cs-sttab"><thead><tr><th></th>${rows.map(r => `<th style="color:${r.p.color}">${esc(r.p.name)}</th>`).join("")}</tr></thead><tbody>${fields.slice(0, 18).map(k => { const vals = rows.map(r => num((vm.stats[r.seat] || {})[k], 0)); const mx = Math.max(...vals); return `<tr><td>${esc(lbl(k))}</td>${vals.map(v => `<td class="${v === mx && mx > 0 ? "best" : ""}">${money(k) ? fmtE(v) : fmtInt(v)}</td>`).join("")}</tr>`; }).join("")}</tbody></table>` : '<p class="cs-muted">Statisticile nu sunt disponibile.</p>';
    }
    S.on(el, "click", e => { const b = e.target.closest("[data-tab]"); if (!b) return; H.sfx("tick"); if (b.dataset.tab === "replay") run(); else show(b.dataset.tab); });
    run();
    return { el, update(n) { O = Object.assign({}, O, n); }, destroy: S.destroy };
  }

  /* ================================================================== AUTO (managerul de scene) */
  function auto(container, o, h) {
    let O = o, cur = null, curName = null, extra = {}, bkSeen = {}, draftLinger = 0, inited = false;
    const H = makeHelp(o, h);
    function want() {
      const st = O.st, ph = phaseOf(st), seat = O.seat;
      if (!st) return null;
      if (ph === "setup") return "setup";
      if (ph === "end" || ph === "over") return "end";
      if (ph === "draft") return "draft";
      if (ph === "nego") return "nego";
      return null;
    }
    function sync() {
      const st = O.st, w = want();
      // draft: lasă dezvăluirea locală 3 s dacă faza a trecut
      if (curName === "draft" && w !== "draft" && !draftLinger && cur && cur.revealed) { draftLinger = -1; }
      if (curName === "draft" && w !== "draft" && !draftLinger) { draftLinger = Date.now(); if (cur.revealLocal) cur.revealLocal(); setTimeout(() => { draftLinger = -1; sync(); }, RM() ? 600 : 3200); return; }
      if (draftLinger > 0 && curName === "draft") return;
      if (w !== curName) { if (cur) cur.destroy(); cur = null; curName = w; draftLinger = 0; if (w) cur = SC[w](container, O, h); }
      else if (cur) cur.update(O);
      // îngheț (doar eu)
      const v = O.view || null, fz = O.seat ? freezeVM(st, O.seat, v || viewOf(O, h, H), H.now()) : null;
      if (fz && fz.frozen && phaseOf(st) === "play") { if (!extra.freeze) extra.freeze = sceneFreeze(container, Object.assign({}, O, { close: () => { if (extra.freeze) { extra.freeze.destroy(); extra.freeze = null; } } }), h); else extra.freeze.update(O); }
      else if (extra.freeze && !extra.freeze.el.classList.contains("melt")) extra.freeze.update(O);
      // faliment (o dată per companie)
      seatsOf(st).forEach(s => { const p = pinfo(st, s, O.ctx); if (p.out && !bkSeen[s]) { bkSeen[s] = 1; if (!inited) return; if (!extra.bk) extra.bk = sceneBankrupt(container, Object.assign({}, O, { victim: s, close: () => { if (extra.bk) { extra.bk.destroy(); extra.bk = null; } } }), h); } });
      inited = true;
    }
    sync();
    return { update(n) { O = Object.assign({}, O, n); sync(); }, destroy() { if (cur) cur.destroy(); Object.values(extra).forEach(x => x && x.destroy()); cur = null; }, active() { return extra.freeze ? "freeze" : extra.bk ? "bankrupt" : curName; } };
  }

  const SC = { setup: sceneSetup, draft: sceneDraft, nego: sceneNego, negoOpen: sceneNegoOpen, bank: sceneBank, freeze: sceneFreeze, bankrupt: sceneBankrupt, end: sceneEnd };
  const CerulScenes = {
    version: 1, ACT_KEY,
    css: () => CSS, inject: injectCSS,
    setup: sceneSetup, draft: sceneDraft, nego: sceneNego, negoOpen: sceneNegoOpen,
    loan: (c, o, h) => sceneNegoOpen(c, Object.assign({}, o, { loan: true }), h),
    bank: sceneBank, freeze: sceneFreeze, bankrupt: sceneBankrupt, bankruptcy: sceneBankrupt, end: sceneEnd, auto,
    PHRASES, phraseText, _vm: { setupVM, draftVM, negoVM, freezeVM, endVM, pinfo, seatsOf, histOf, loanRiskOf, normOpt, parseAmt, fmtInt }
  };

  /* ================================================================== CSS */
  const CSS = `
.cs-root{position:absolute;inset:0;z-index:5;color:#e6f0f6;font-family:var(--body,"Barlow",system-ui,sans-serif);font-size:15px;line-height:1.35;overflow:hidden;-webkit-tap-highlight-color:transparent}
.cs-root *{box-sizing:border-box}.cs-root button{font-family:inherit;color:inherit}
.cs-root h1,.cs-root h2,.cs-root h3{margin:0;font-weight:800;letter-spacing:.01em}
.cs-muted{color:#8fa9bb}.cs-root .ok{color:#7be07b}.cs-root .bad{color:#ff7b7b}.cs-root .gold{color:#ffd35c}
.cs-lbl{font-size:11.5px;letter-spacing:.14em;text-transform:uppercase;color:#8fb0c4;font-weight:700;margin:14px 0 8px}
.cs-btn{font-weight:800;font-size:15px;border-radius:12px;padding:11px 18px;border:1px solid #ffffff22;background:linear-gradient(180deg,#22405e,#183049);cursor:pointer;box-shadow:0 4px 0 #0a1626,0 8px 18px #0006;transition:transform .12s,filter .15s,box-shadow .12s;display:inline-flex;align-items:center;justify-content:center;gap:8px}
.cs-btn:hover:not(:disabled){filter:brightness(1.15);transform:translateY(-1px)}.cs-btn:active:not(:disabled){transform:translateY(3px);box-shadow:0 1px 0 #0a1626,0 4px 10px #0006}
.cs-btn:disabled{opacity:.45;cursor:not-allowed}
.cs-btn.gold{background:linear-gradient(180deg,#ffd76a,#f0a92c);color:#2a1800;border-color:#ffe39a;box-shadow:0 4px 0 #a0640e,0 8px 22px #f0a92c44}
.cs-btn.ok{background:linear-gradient(180deg,#5fe08a,#25a95a);color:#04220f;border-color:#9ff5bb;box-shadow:0 4px 0 #136a35,0 8px 22px #25a95a44}
.cs-btn.bad{background:linear-gradient(180deg,#ff7d6a,#d9433a);color:#2a0603;border-color:#ffb1a6;box-shadow:0 4px 0 #8a1f18,0 8px 22px #d9433a44}
.cs-btn.ghost{background:transparent;box-shadow:none;border-color:#ffffff30}
.cs-btn.small{padding:7px 12px;font-size:13px;border-radius:9px}.cs-btn.big{padding:14px 24px;font-size:17px}
.cs-in{font:inherit;font-size:16px;background:#0b1a2b;color:#e6f0f6;border:1px solid #2c4e6a;border-radius:10px;padding:10px 12px;width:100%;min-width:0}
.cs-in:focus{outline:2px solid #5fd3dc;outline-offset:1px}
.cs-chip{font-size:13px;font-weight:700;border-radius:99px;padding:6px 12px;border:1px solid #2f5574;background:#10263b;cursor:pointer}
.cs-chip:hover,.cs-chip.on{border-color:#ffd35c;color:#ffd35c}
.cs-chips{display:flex;flex-wrap:wrap;gap:6px}
.cs-x2{border:0;background:#ffffff12;width:34px;height:34px;border-radius:50%;font-size:20px;cursor:pointer}.cs-x2:hover{background:#ffffff26}
.cs-seg{display:flex;background:#0b1a2b;border:1px solid #2c4e6a;border-radius:12px;padding:3px;gap:3px}
.cs-seg button{flex:1;border:0;background:transparent;border-radius:9px;padding:8px 10px;font-weight:700;cursor:pointer;color:#a9c3d4}
.cs-seg button.on{background:linear-gradient(180deg,#2d5b82,#1e4060);color:#fff;box-shadow:inset 0 0 0 1px #5fd3dc66}
.cs-spark{position:absolute;width:7px;height:7px;border-radius:50%;pointer-events:none;z-index:50;animation:csSpark .85s ease-out forwards;box-shadow:0 0 8px currentColor}
@keyframes csSpark{to{transform:translate(var(--dx),var(--dy)) scale(.2);opacity:0}}
.cs-conf{position:absolute;top:-20px;width:9px;height:14px;border-radius:2px;z-index:60;pointer-events:none;animation:csConf 3s cubic-bezier(.3,.6,.5,1) forwards}
@keyframes csConf{to{transform:translate(var(--rx),110vh) rotate(720deg)}}
.cs-card{background:linear-gradient(180deg,#132c45f2,#0d2034f2);border:1px solid #2a4d6c;border-radius:20px;padding:20px 22px;box-shadow:0 20px 50px #0008,inset 0 1px 0 #ffffff14;min-width:0}
.cs-card h2{font-size:22px;margin-bottom:4px}
.cs-dots i{display:inline-block;width:6px;height:6px;margin:0 2px;border-radius:50%;background:#8fb0c4;animation:csDot 1.2s infinite}
.cs-dots i:nth-child(2){animation-delay:.2s}.cs-dots i:nth-child(3){animation-delay:.4s}
@keyframes csDot{0%,80%,100%{opacity:.25}40%{opacity:1}}

/* ---------- SETUP ---------- */
.cs-setup{background:radial-gradient(1200px 700px at 20% 0%,#1d4a74 0%,transparent 60%),radial-gradient(1000px 700px at 100% 100%,#2a2150 0%,transparent 60%),linear-gradient(180deg,#0c2440,#081628);overflow:auto}
.cs-sky{position:absolute;inset:0;pointer-events:none;overflow:hidden}
.cs-cloud{position:absolute;width:420px;height:120px;border-radius:99px;background:radial-gradient(closest-side,#ffffff14,transparent);filter:blur(6px);animation:csCloud 60s linear infinite}
.cs-cloud.c1{top:12%;left:-20%}.cs-cloud.c2{top:55%;left:-30%;animation-duration:85s;animation-delay:-30s;transform:scale(1.6)}.cs-cloud.c3{top:80%;left:-25%;animation-duration:70s;animation-delay:-50s}
@keyframes csCloud{to{left:120%}}
.cs-jet{position:absolute;top:7%;left:-260px;width:240px;opacity:.55;animation:csJet 28s linear infinite;filter:drop-shadow(0 6px 10px #0008)}
.cs-jet svg{width:100%;height:auto}
@keyframes csJet{0%{left:-260px;transform:translateY(0)}50%{transform:translateY(-20px)}100%{left:110%;transform:translateY(10px)}}
.cs-setup-in{position:relative;max-width:1720px;margin:0 auto;padding:22px 28px 28px;min-height:100%;display:flex;flex-direction:column;justify-content:center;gap:22px}
.cs-su-head{display:flex;align-items:center;justify-content:space-between;gap:16px}
.cs-brand{display:flex;align-items:center;gap:14px}.cs-globe{font-size:52px;filter:drop-shadow(0 0 18px #5fd3dc66);animation:csSpin 30s linear infinite}
@keyframes csSpin{50%{transform:rotate(12deg)}}
.cs-brand h1{font-family:var(--display,Impact,sans-serif);font-size:54px;line-height:1;letter-spacing:.06em;text-transform:uppercase;background:linear-gradient(180deg,#fff,#ffd35c);-webkit-background-clip:text;background-clip:text;color:transparent}
.cs-brand p{margin:4px 0 0;color:#a9c3d4;font-size:16px}
.cs-su-status{background:#0b1a2bcc;border:1px solid #2c4e6a;border-radius:99px;padding:8px 16px;color:#a9c3d4}
.cs-su-grid{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,1fr) minmax(0,.9fr);gap:18px;align-items:start}
.cs-prof-top{display:flex;gap:18px;align-items:center;margin-top:8px}
.cs-bigav{position:relative;flex:none;width:150px;height:150px;filter:drop-shadow(0 10px 24px #0009)}
.cs-bigav svg{width:150px;height:150px}
.cs-g{position:absolute;bottom:-4px;right:-4px;font-size:12px;background:#0b1a2b;border:1px solid #2c4e6a;border-radius:99px;padding:3px 9px;color:#cfe2ee}
.cs-prof-f{flex:1;display:flex;flex-direction:column;gap:10px;min-width:0}
.cs-prof-f label{font-size:12.5px;color:#a9c3d4;font-weight:700;display:flex;flex-direction:column;gap:5px}
.cs-co-row{display:flex;gap:8px;align-items:center}.cs-co-row>span{flex:none;display:flex}
.cs-sugs{display:flex;flex-wrap:wrap;gap:6px}
.cs-avs{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px}
.cs-av{border:2px solid transparent;background:#0d2136;border-radius:16px;padding:8px 4px 6px;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:4px;transition:transform .15s,border-color .15s,background .15s}
.cs-av svg{width:76px;height:76px;max-width:100%}
.cs-av span{font-size:12px;color:#a9c3d4;font-weight:700}
.cs-av:hover:not(:disabled){transform:translateY(-3px);border-color:#5fd3dc66}
.cs-av.on{border-color:#ffd35c;background:#2a2a1a;box-shadow:0 0 0 4px #ffd35c22,0 10px 20px #0007}.cs-av.on span{color:#ffd35c}
.cs-cols{display:flex;gap:12px;flex-wrap:wrap}
.cs-col{width:52px;height:52px;border-radius:50%;border:3px solid #ffffff22;background:radial-gradient(circle at 35% 30%,#fff7,transparent 40%),var(--c);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:transform .15s;box-shadow:0 6px 14px #0007}
.cs-col:hover:not(:disabled){transform:scale(1.1)}.cs-col.on{border-color:#fff;box-shadow:0 0 0 4px var(--c),0 0 24px var(--c)}
.cs-col:disabled{cursor:not-allowed;opacity:.85;filter:saturate(.6)}.cs-col svg{width:28px;height:28px}
.cs-vt{display:grid;gap:10px}.cs-vt4{grid-template-columns:repeat(2,minmax(0,1fr))}.cs-vt3{grid-template-columns:repeat(3,minmax(0,1fr))}
.cs-vtile{position:relative;text-align:left;border:2px solid #2a4d6c;background:linear-gradient(180deg,#14304b,#0e2238);border-radius:16px;padding:14px 14px 16px;cursor:pointer;display:flex;flex-direction:column;gap:2px;transition:transform .15s,border-color .15s}
.cs-vtile .ic{font-size:26px}.cs-vtile b{font-size:18px}.cs-vtile small{color:#8fb0c4}
.cs-vtile:hover:not(:disabled){transform:translateY(-2px);border-color:#5fd3dc88}
.cs-vtile.on{border-color:#ffd35c;background:linear-gradient(180deg,#3a3418,#1f2a26);box-shadow:0 0 0 4px #ffd35c1c}
.cs-voters{position:absolute;right:10px;top:10px;display:flex}.cs-voters i{margin-right:-6px;display:flex}.cs-voters svg{width:24px;height:24px}
.cs-vres{margin-top:14px;padding:12px 14px;border-radius:12px;background:#0b1a2b;border:1px dashed #2c4e6a;color:#cfe2ee;font-size:14px}
.cs-plist{display:flex;flex-direction:column;gap:10px;margin:10px 0 16px}
.cs-pl{display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:14px;background:#0d2136;border:1px solid #23445f;border-left:5px solid var(--c);transition:background .3s}
.cs-pl.rd{background:linear-gradient(90deg,#14382a,#0d2136)}
.cs-pl-av{flex:none;display:flex}.cs-pl-av svg{width:54px;height:54px}
.cs-pl-t{flex:1;min-width:0;display:flex;flex-direction:column}
.cs-pl-t b{font-size:16px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.cs-pl-t em{font-style:normal;color:#8fb0c4;font-weight:600;font-size:13px}.cs-pl-t em.bot{background:#2a3a55;color:#b9c9ff;border-radius:6px;padding:0 6px;margin-left:4px}
.cs-pl-t span{display:flex;align-items:center;gap:6px;color:#cfe2ee;font-size:13.5px;white-space:nowrap;overflow:hidden}.cs-pl-t span svg{flex:none}
.cs-pl-t small{color:#8fb0c4;font-size:12px}
.cs-pl-s{flex:none;font-weight:800;color:#7be07b}
.cs-go{width:100%;font-size:19px;padding:16px;background:linear-gradient(180deg,#5fe08a,#25a95a);color:#04220f;border-color:#9ff5bb;box-shadow:0 5px 0 #136a35,0 10px 26px #25a95a55}
.cs-go.on{background:linear-gradient(180deg,#2d5b82,#1e4060);color:#cfe2ee;border-color:#5fd3dc66;box-shadow:0 4px 0 #0a1626;font-size:15px}
.cs-tutq{display:flex;flex-direction:column;gap:6px;margin:4px 0 10px}.cs-tutq:empty{display:none}
.cs-tutb{width:100%;font-size:18px;padding:14px;background:linear-gradient(180deg,#ffe07a,#f2b632);color:#2a1a00;border-color:#ffe9a8;box-shadow:0 5px 0 #a8730f,0 10px 26px #f2b63244}
.cs-tutb small{font-weight:600;opacity:.8}.cs-tutd{font-size:12.5px;color:#a9c3d4;text-align:center}
.cs-go.cs-go2{font-size:16px;padding:12px}
.cs-tutchip{display:inline-block;background:rgba(255,211,92,.16);color:#ffd35c;border:1px solid #ffd35c66;border-radius:999px;padding:3px 9px;font-size:13px;white-space:nowrap}.cs-tutchip small{font-weight:600;color:#ffe7a8}
.cs-hint{text-align:center;color:#a9c3d4;font-size:13.5px;margin-top:10px}
.cs-setup.cs-ro .cs-av:disabled,.cs-setup.cs-ro .cs-vtile:disabled{cursor:default;opacity:.75}
@media (max-height:860px){.cs-setup-in{padding-top:12px;gap:12px}.cs-brand h1{font-size:40px}.cs-globe{font-size:40px}.cs-card{padding:14px 18px}.cs-av svg{width:54px;height:54px}.cs-bigav,.cs-bigav svg{width:116px;height:116px}.cs-lbl{margin:10px 0 6px}.cs-col{width:44px;height:44px}.cs-vtile{padding:10px 12px}.cs-vtile .ic{font-size:20px}}
.cs-narrow .cs-su-grid{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}.cs-narrow .cs-crew{grid-column:1/-1}
.cs-phone .cs-setup-in{padding:12px 12px 20px;gap:12px}.cs-phone .cs-su-grid{grid-template-columns:minmax(0,1fr)}
.cs-phone .cs-brand h1{font-size:34px}.cs-phone .cs-brand p{font-size:13px}.cs-phone .cs-globe{font-size:36px}.cs-phone .cs-su-status{display:none}
.cs-phone .cs-card{padding:14px;border-radius:16px}.cs-phone .cs-bigav,.cs-phone .cs-bigav svg{width:96px;height:96px}
.cs-phone .cs-avs{gap:6px}.cs-phone .cs-av{padding:5px 2px}.cs-phone .cs-av span{font-size:10.5px}
.cs-phone .cs-col{width:42px;height:42px}.cs-phone .cs-vtile b{font-size:15px}
.cs-phone .cs-crew .cs-plist{gap:6px}.cs-phone .cs-pl{padding:6px 8px}.cs-phone .cs-pl-av svg{width:40px;height:40px}

/* ---------- DRAFT ---------- */
.cs-draft{background:#06111e}
.cs-felt{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 45%,#1f5a4e 0%,#14403a 40%,#0b2524 75%,#061514 100%)}
.cs-felt::after{content:"";position:absolute;inset:0;background:repeating-radial-gradient(circle at 50% 50%,#ffffff04 0 2px,transparent 2px 5px);mix-blend-mode:overlay}
.cs-dr-in{position:relative;height:100%;display:flex;flex-direction:column;padding:20px 28px;gap:14px}
.cs-dr-head{display:flex;align-items:center;justify-content:space-between;gap:16px}
.cs-dr-head h1{font-family:var(--display,Impact,sans-serif);font-size:42px;letter-spacing:.04em;text-transform:uppercase;color:#fff;text-shadow:0 3px 0 #0006}
.cs-dr-head p{margin:2px 0 0;color:#cfe8df;font-size:17px}.cs-dr-head p .me{color:#ffd35c}
.cs-dr-timer{position:relative;width:86px;height:86px;flex:none}
.cs-dr-timer svg,.cs-fz-ring svg{width:100%;height:100%;transform:rotate(-90deg)}
.cs-dr-timer circle,.cs-fz-ring circle{fill:none;stroke-width:4}.cs-dr-timer .bg,.cs-fz-ring .bg{stroke:#ffffff1c}
.cs-dr-timer .fg{stroke:#ffd35c;stroke-linecap:round;stroke-dasharray:119.4;transition:stroke-dashoffset .2s linear}
.cs-dr-timer b{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:32px;font-weight:800}
.cs-dr-timer.hot .fg{stroke:#ff6b6b}.cs-dr-timer.hot b{color:#ff8b8b;animation:csPulse .5s infinite alternate}
@keyframes csPulse{to{transform:scale(1.12)}}
.cs-order{display:flex;align-items:center;gap:4px;flex-wrap:wrap;justify-content:center;padding:8px 12px;background:#00000038;border-radius:99px;align-self:center;max-width:100%}
.cs-os{position:relative;display:flex;opacity:.92;transition:transform .3s,opacity .3s}.cs-os svg{width:40px;height:40px}
.cs-os.done{opacity:.4;transform:scale(.85)}.cs-os.cur{transform:scale(1.25);opacity:1;filter:drop-shadow(0 0 10px var(--c))}
.cs-os.cur::after{content:"";position:absolute;inset:-5px;border-radius:50%;border:2px solid var(--c);animation:csRing 1.2s infinite}
@keyframes csRing{from{transform:scale(.9);opacity:1}to{transform:scale(1.35);opacity:0}}
.cs-on,.cs-om{position:absolute;right:-4px;bottom:-4px;min-width:18px;height:18px;border-radius:9px;background:#0b1a2b;border:1px solid #ffffff33;font-size:11px;font-weight:800;display:flex;align-items:center;justify-content:center;padding:0 3px}
.cs-oarr{color:#ffffff40;font-style:normal;font-size:18px}
.cs-table{position:relative;flex:1;min-height:0;display:flex;align-items:center;justify-content:center}
.cs-cards{--cw:min(170px,calc((100vw - 120px)/8 - 18px),calc((100vh - 330px)/2.9));display:flex;flex-wrap:wrap;max-width:calc(8 * var(--cw) + 7 * 18px);gap:16px 18px;justify-content:center;perspective:1200px}
.cs-dc{position:relative;width:var(--cw);aspect-ratio:120/170;border:0;padding:0;background:none;cursor:default;transition:transform .25s}
.cs-dc .cs-flip{position:absolute;inset:0;transform-style:preserve-3d;transition:transform .6s cubic-bezier(.3,1.4,.5,1)}
.cs-dc.up .cs-flip{transform:rotateY(180deg)}
.cs-back,.cs-face{position:absolute;inset:0;backface-visibility:hidden;-webkit-backface-visibility:hidden;border-radius:10px;filter:drop-shadow(0 8px 12px #0009)}
.cs-back svg,.cs-face svg{width:100%;height:100%;display:block}
.cs-face{transform:rotateY(180deg)}
.cs-dc.up{--glow:var(--c,#ffffff55)}.cs-dc.up .cs-face{box-shadow:0 0 0 3px var(--c,transparent),0 0 22px var(--c,transparent)}
.cs-dc.missed .cs-face{filter:grayscale(.15) brightness(.92) drop-shadow(0 8px 12px #0009);box-shadow:0 0 0 2px #ffffff55}
.cs-dc.can{cursor:pointer}.cs-dc.can:hover{transform:translateY(-12px) rotate(-1.5deg)}.cs-dc.can .cs-back{box-shadow:0 0 0 2px #ffd35c,0 0 26px #ffd35c66}
.cs-draft.myturn .cs-dc.can{animation:csBob 2.4s ease-in-out infinite;animation-delay:var(--d)}
@keyframes csBob{50%{transform:translateY(-5px)}}
.cs-dc.chosen{transform:translateY(-18px) scale(1.06)}
.cs-dc.deal{animation:csDeal .5s cubic-bezier(.2,1.2,.4,1) both}
@keyframes csDeal{from{transform:translate(0,-60vh) rotate(-20deg);opacity:0}}
.cs-dc.pop{animation:csPop .6s ease}@keyframes csPop{40%{transform:scale(1.15)}}
.cs-by{position:absolute;right:-10px;bottom:-10px;display:flex;z-index:2;filter:drop-shadow(0 3px 6px #000a)}.cs-by svg{width:34px;height:34px}
.cs-eye{position:absolute;left:-8px;top:-8px;font-size:22px;background:#ffd35c;border-radius:50%;width:34px;height:34px;display:flex;align-items:center;justify-content:center;box-shadow:0 0 18px #ffd35c;animation:csPulse .8s infinite alternate}
.cs-dc.wh .cs-back{box-shadow:0 0 0 3px #ffd35c,0 0 30px #ffd35c}
.cs-banner{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%) scale(.6);opacity:0;pointer-events:none;transition:all .5s cubic-bezier(.3,1.5,.5,1)}
.cs-banner span{display:block;font-family:var(--display,Impact,sans-serif);font-size:64px;text-transform:uppercase;letter-spacing:.08em;color:#ffd35c;background:#000a;padding:8px 40px;border-radius:14px;border:2px solid #ffd35c;text-shadow:0 0 20px #ffd35c88;white-space:nowrap}
.cs-banner.on{opacity:1;transform:translate(-50%,-50%) scale(1);animation:csBanOut .6s 2.2s forwards}
@keyframes csBanOut{to{opacity:0;transform:translate(-50%,-160%) scale(.7)}}
.cs-dr-foot{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;min-height:86px}
.cs-mine{background:#00000040;border-radius:14px;padding:8px 14px}
.cs-dr-pls{flex:1;display:flex;flex-wrap:wrap;gap:8px;justify-content:center;align-self:center}
.cs-dpl{display:flex;align-items:center;gap:6px;background:#00000040;border:1px solid #ffffff1a;border-radius:99px;padding:3px 12px 3px 3px;font-size:14px;transition:all .3s}.cs-dpl svg{width:30px;height:30px}.cs-dpl i{font-style:normal;color:#a9c3d4;font-variant-numeric:tabular-nums}
.cs-dpl.cur{border-color:var(--c);box-shadow:0 0 14px color-mix(in srgb,var(--c) 50%,transparent);background:#0006}
.cs-draft.rev .cs-dc.up:not(.missed){opacity:.4;transform:scale(.92);filter:saturate(.5)}.cs-draft.rev .cs-dc.missed{transform:translateY(-6px)}.cs-mine .cs-lbl{margin:0 0 6px}
.cs-mine-c{display:flex;gap:8px;align-items:center;min-height:65px}.cs-mc{display:flex;animation:csPop .5s}
.cs-whisper{display:flex;align-items:flex-end;gap:10px;opacity:0;transform:translateY(20px);transition:all .4s;max-width:560px}
.cs-whisper.on{opacity:1;transform:none}
.cs-wb{background:#fffaf0;color:#1d2230;border-radius:16px 16px 4px 16px;padding:12px 16px;font-size:15px;box-shadow:0 10px 24px #0008}
.cs-cons{flex:none;display:flex}
.cs-phone .cs-dr-in{padding:10px 10px 12px;gap:8px}.cs-phone .cs-dr-head h1{font-size:22px}.cs-phone .cs-dr-head p{font-size:13.5px}
.cs-phone .cs-dr-timer{width:58px;height:58px}.cs-phone .cs-dr-timer b{font-size:22px}
.cs-phone .cs-cards{--cw:calc((100vw - 56px)/4);max-width:calc(4 * var(--cw) + 30px);gap:10px}
.cs-phone .cs-os svg{width:28px;height:28px}.cs-phone .cs-order{border-radius:14px;padding:6px}
.cs-phone .cs-banner span{font-size:34px;padding:6px 18px}.cs-phone .cs-dr-foot{flex-direction:column;align-items:stretch;min-height:0}
.cs-phone .cs-mine-c{min-height:0}.cs-phone .cs-dpl{font-size:12px}.cs-phone .cs-dpl svg{width:22px;height:22px}.cs-phone .cs-mc svg{width:34px;height:auto}.cs-phone .cs-wb{font-size:13px}.cs-phone .cs-cons svg{width:44px;height:44px}
.cs-phone .cs-whisper:not(.on){display:none}

/* ---------- NEGOCIERE (banner) ---------- */
.cs-root.cs-nbanner{inset:auto 0 auto 0;top:70px;height:auto;pointer-events:none;display:flex;justify-content:center;overflow:visible}
.cs-nb{pointer-events:auto;display:flex;align-items:center;gap:12px;padding:8px 18px 8px 8px;border-radius:99px;background:linear-gradient(180deg,#2a2346f2,#1a1631f2);border:1px solid #b9a3ff66;box-shadow:0 12px 30px #0009,0 0 30px #b9a3ff33;animation:csDrop .5s cubic-bezier(.3,1.5,.5,1)}
.cs-nb [data-r=avs]{display:flex}.cs-nb [data-r=avs] svg{width:34px;height:34px}.cs-nb [data-r=avs] svg+svg{margin-left:-8px}
.cs-nb-t{font-weight:800;color:#ffd35c;font-variant-numeric:tabular-nums}
@keyframes csDrop{from{transform:translateY(-40px);opacity:0}}
.cs-phone.cs-nbanner{top:8px;padding:0 8px}.cs-phone .cs-nb{font-size:12.5px;border-radius:16px;padding:6px 10px 6px 6px}.cs-phone .cs-nb .cs-muted{display:none}

/* ---------- NEGOCIERE (birou) ---------- */
.cs-office{background:#0b1626}
.cs-of-bg{position:absolute;inset:0}.cs-of-bg svg{width:100%;height:100%;display:block}
.cs-of-bg:empty{background:linear-gradient(180deg,#3b5b7d 0%,#87a9c3 40%,#d9b48a 58%,#4a3324 62%,#2c1d14 100%)}
.cs-of-shade{position:absolute;inset:0;background:linear-gradient(180deg,#0b1626cc 0%,transparent 18%,transparent 55%,#0b1626aa 100%)}
.cs-of-head{position:absolute;left:0;right:0;top:0;display:flex;align-items:center;gap:18px;padding:16px 24px;z-index:3}
.cs-of-head h1{font-family:var(--display,Impact,sans-serif);font-size:34px;letter-spacing:.05em;text-transform:uppercase;text-shadow:0 3px 10px #000}
.cs-of-sub{flex:1;font-size:16px;text-shadow:0 2px 6px #000;min-width:0}
.cs-of-t{display:flex;align-items:center;gap:8px;font-variant-numeric:tabular-nums}.cs-of-t b{font-size:18px;color:#ffd35c;min-width:48px}
.cs-tbar{width:120px;height:8px;border-radius:4px;background:#0006;overflow:hidden}.cs-tbar i{display:block;height:100%;background:linear-gradient(90deg,#ff6b6b,#ffd35c);transition:width .5s linear}
.cs-x{border:1px solid #ffffff33;background:#0b1626cc;border-radius:10px;padding:8px 14px;font-weight:700;cursor:pointer}.cs-x:hover{background:#3a1a1acc}
.cs-stage{position:absolute;left:0;right:0;top:64px;bottom:130px}
.cs-side{position:absolute;bottom:19%;width:34%;display:flex;flex-direction:column;align-items:center;z-index:1}
.cs-side.me{left:7%}.cs-side.op{right:7%}
.cs-pname{display:none!important}
.cs-pav{width:min(400px,25vw,52vh);aspect-ratio:1;filter:drop-shadow(0 20px 30px #000c)}.cs-pav svg{width:100%;height:100%}
.cs-side.me .cs-pav{animation:csBreath 4s ease-in-out infinite}.cs-side.op .cs-pav{animation:csBreath 4.4s ease-in-out infinite reverse}
@keyframes csBreath{50%{transform:translateY(-4px) scale(1.01)}}
.cs-pname{margin-top:-6px;background:#0b1626e6;border:1px solid #ffffff22;border-radius:12px;padding:5px 14px;text-align:center;display:flex;flex-direction:column}
.cs-pname b{font-size:18px}.cs-pname span{font-size:13px;color:#a9c3d4}
.cs-bub{position:absolute;bottom:100%;max-width:min(360px,90%);background:#fffaf0;color:#1d2230;font-weight:700;font-size:16px;border-radius:18px;padding:12px 16px;box-shadow:0 12px 24px #0009;opacity:0;transform:translateY(10px) scale(.9);transition:all .3s cubic-bezier(.3,1.5,.5,1);pointer-events:none;margin-bottom:8px}
.cs-side.me .cs-bub{left:40%;border-bottom-left-radius:4px}.cs-side.op .cs-bub{right:40%;border-bottom-right-radius:4px}
.cs-bub.on{opacity:1;transform:none}
.cs-desk{position:absolute;z-index:2;left:3%;right:3%;bottom:0;height:29%;display:grid;grid-template-columns:minmax(0,1fr) 70px minmax(0,1fr);gap:14px;padding:16px 22px;border-radius:24px 24px 10px 10px;background:linear-gradient(180deg,#6b4428f0,#4a2d1af0 30%,#3a2214f5);border-top:4px solid #8a5a36;box-shadow:0 -10px 40px #0008,inset 0 2px 0 #c48a5a66}
.cs-tray{background:#1a3a2acc;border:2px solid #0006;border-radius:16px;padding:10px 12px;display:flex;flex-direction:column;min-height:0;box-shadow:inset 0 4px 14px #0008}
.cs-tray.op{background:#2a2a40cc}
.cs-tray-h{font-size:13px;font-weight:700;color:#cfe8df;margin-bottom:8px;display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}.cs-tray-h b{font-size:17px}.cs-tray-h small{color:#a9c3d4}.cs-tray-h em{font-style:normal;margin-left:auto;font-size:11.5px;letter-spacing:.12em;text-transform:uppercase;color:#ffd35c}
.cs-tray-c{display:flex;flex-wrap:wrap;gap:8px;align-content:flex-start;overflow:auto;min-height:0}
.cs-tray-c.slide{animation:csSlide .5s ease}@keyframes csSlide{from{transform:translateY(-14px);opacity:.2}}
.cs-tok{display:inline-flex;align-items:center;gap:6px;background:linear-gradient(180deg,#fffdf6,#e9e1cf);color:#1d2230;border-radius:10px;padding:6px 8px 6px 10px;font-weight:700;font-size:14px;box-shadow:0 4px 0 #0005,0 6px 12px #0006;animation:csTok .35s cubic-bezier(.3,1.5,.5,1)}
.cs-tok i{font-style:normal;font-size:18px}.cs-tok.money{background:linear-gradient(180deg,#d9ffd9,#9be39b)}.cs-tok.spec{background:linear-gradient(180deg,#fff2c0,#f0c850)}.cs-tok.pact{background:linear-gradient(180deg,#eaf6ff,#a8d4f5)}.cs-tok.loan{background:linear-gradient(180deg,#ffe8d0,#f5b880)}
.cs-tok .x{display:none;width:20px;height:20px;border-radius:50%;background:#0002;align-items:center;justify-content:center;cursor:pointer;font-size:14px}
.cs-office.editing .cs-tok .x{display:inline-flex}
@keyframes csTok{from{transform:scale(.5);opacity:0}}
.cs-empty{color:#ffffff70;font-style:italic;font-size:14px}
.cs-mid{display:flex;align-items:center;justify-content:center}.cs-swap{font-size:34px;color:#ffd35c;text-shadow:0 2px 8px #000}
.cs-hs{position:absolute;left:50%;top:38%;transform:translate(-50%,-50%) scale(.3);opacity:0;pointer-events:none;filter:drop-shadow(0 10px 30px #000)}
.cs-hs.on{animation:csHs 2.4s cubic-bezier(.3,1.5,.5,1) forwards}
@keyframes csHs{0%{opacity:0;transform:translate(-50%,-50%) scale(.3)}20%{opacity:1;transform:translate(-50%,-50%) scale(1.15)}30%,40%{transform:translate(-50%,-48%) scale(1)}35%{transform:translate(-50%,-53%) scale(1)}45%,85%{opacity:1;transform:translate(-50%,-50%) scale(1)}100%{opacity:0;transform:translate(-50%,-50%) scale(1)}}
.cs-stamp{position:absolute;left:50%;top:36%;transform:translate(-50%,-50%) rotate(-14deg) scale(3);opacity:0;font-family:var(--display,Impact,sans-serif);font-size:84px;letter-spacing:.1em;color:#ff4b4b;border:8px solid #ff4b4b;border-radius:18px;padding:0 30px;pointer-events:none;text-shadow:0 0 20px #ff4b4b66}
.cs-stamp.on{animation:csStamp 2.6s forwards}
@keyframes csStamp{0%{opacity:0}12%{opacity:1;transform:translate(-50%,-50%) rotate(-14deg) scale(1)}80%{opacity:1;transform:translate(-50%,-50%) rotate(-14deg) scale(1)}100%{opacity:0;transform:translate(-50%,-50%) rotate(-14deg) scale(1)}}
.cs-ctrl{position:absolute;left:0;right:0;bottom:0;height:130px;padding:12px 24px;background:linear-gradient(180deg,#0b1626f0,#081220);border-top:1px solid #ffffff1a;display:grid;grid-template-columns:minmax(0,1fr) auto;grid-template-rows:auto auto;gap:10px 18px;align-items:center}
.cs-add{display:flex;align-items:center;gap:10px;min-width:0}.cs-add .cs-lbl{margin:0;flex:none}
.cs-add>div{display:flex;gap:6px;flex-wrap:wrap}
.cs-ib{border:1px solid #2f5574;background:#10263b;border-radius:10px;padding:7px 10px;font-weight:700;font-size:13.5px;cursor:pointer;display:inline-flex;align-items:center;gap:5px}
.cs-ib i{font-style:normal}.cs-ib:hover:not(:disabled){border-color:#ffd35c;background:#1a3048}.cs-ib:disabled{opacity:.4}
.cs-acts{display:flex;gap:10px;justify-content:flex-end;align-items:center;grid-row:1/3;grid-column:2;flex-wrap:wrap;max-width:520px}
.cs-phr{display:flex;gap:6px;overflow-x:auto;padding-bottom:4px;scrollbar-width:thin;min-width:0;-webkit-mask-image:linear-gradient(90deg,#000 calc(100% - 36px),transparent);mask-image:linear-gradient(90deg,#000 calc(100% - 36px),transparent);padding-right:30px}
.cs-qp{flex:none;border:1px solid #ffffff26;background:#ffffff0d;border-radius:99px;padding:6px 12px;font-size:13px;cursor:pointer;white-space:nowrap}.cs-qp:hover{background:#ffffff22;border-color:#ffd35c}
.cs-pop{position:absolute;inset:0;z-index:20;display:none;align-items:center;justify-content:center;background:#0008}
.cs-pop.on{display:flex}
.cs-popc{width:min(560px,94vw);max-height:80vh;overflow:auto;background:linear-gradient(180deg,#16324e,#0e2238);border:1px solid #2f5574;border-radius:18px;padding:16px 18px;box-shadow:0 30px 60px #000c;display:flex;flex-direction:column;gap:12px;animation:csTok .3s cubic-bezier(.3,1.5,.5,1)}
.cs-popc header{display:flex;align-items:center;justify-content:space-between;font-size:18px}
.cs-popc label{display:flex;flex-direction:column;gap:4px;font-size:13px;color:#a9c3d4;font-weight:700}
.cs-mrow{display:flex;gap:8px;align-items:center}
.cs-cgrid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px}
.cs-cc{display:flex;flex-direction:column;align-items:center;gap:4px;background:#0b1a2b;border-radius:12px;padding:8px 4px}
.cs-cc>div{display:flex;align-items:center;gap:6px}.cs-cc .cs-ib{padding:2px 9px}.cs-cc small{font-size:11px;color:#8fb0c4}
.cs-two{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.cs-list{display:flex;flex-direction:column;gap:5px;max-height:260px;overflow:auto;margin-top:6px}
.cs-li{text-align:left;border:1px solid #2f5574;background:#0b1a2b;border-radius:9px;padding:7px 10px;cursor:pointer;font-size:14px}.cs-li:hover{border-color:#ffd35c}
.cs-narrow .cs-ctrl{height:auto;grid-template-columns:minmax(0,1fr)}.cs-narrow .cs-acts{grid-row:auto;grid-column:auto;flex-direction:row;flex-wrap:wrap}
.cs-narrow .cs-stage{bottom:210px}
.cs-phone .cs-of-head{flex-wrap:wrap;gap:6px 10px;padding:8px 10px}.cs-phone .cs-of-head h1{font-size:20px}.cs-phone .cs-of-sub{order:5;flex-basis:100%;font-size:13px}
.cs-phone .cs-tbar{width:60px}.cs-phone .cs-x{padding:5px 9px;font-size:13px;margin-left:auto}
.cs-phone .cs-stage{top:96px;bottom:250px}
.cs-phone .cs-side{bottom:auto;top:0;width:48%;height:124px;justify-content:flex-start}.cs-phone .cs-side.me{left:2%}.cs-phone .cs-side.op{right:2%}
.cs-phone .cs-pav{width:min(118px,30vw)}.cs-phone .cs-pname b{font-size:14px}.cs-phone .cs-pname span{display:none}
.cs-phone .cs-bub{bottom:auto;top:62px;max-width:150%;font-size:12.5px;padding:7px 10px;z-index:4;margin:0}.cs-phone .cs-side.me .cs-bub{left:4px;right:auto}.cs-phone .cs-side.op .cs-bub{right:4px;left:auto}
.cs-phone .cs-desk{left:6px;right:6px;height:auto;top:118px;bottom:0;grid-template-columns:minmax(0,1fr);grid-template-rows:minmax(0,1fr) minmax(0,1fr);gap:6px;padding:8px;border-radius:16px 16px 6px 6px}.cs-phone .cs-tray{padding:6px 8px}.cs-phone .cs-tray-h{margin-bottom:4px}.cs-phone .cs-tray-h b{font-size:14px}
.cs-phone .cs-mid{display:none}.cs-phone .cs-tok{font-size:12.5px;padding:4px 6px 4px 8px}
.cs-phone .cs-ctrl{height:250px;padding:8px;gap:6px;overflow:auto;align-content:start}
.cs-phone .cs-add{flex-direction:column;align-items:stretch;gap:4px}.cs-phone .cs-ib{padding:5px 7px;font-size:12px}
.cs-phone .cs-acts .cs-btn{flex:1;padding:9px 8px;font-size:13.5px}
.cs-phone .cs-cgrid{grid-template-columns:repeat(3,minmax(0,1fr))}.cs-phone .cs-two{grid-template-columns:1fr}
.cs-phone .cs-stamp{font-size:44px}.cs-phone .cs-hs svg{width:140px;height:140px}
/* ---------- NEGOCIERE: 3–4 la masă, spectatori ---------- */
.cs-seats{position:absolute;top:8px;left:50%;transform:translateX(-50%);z-index:4;display:flex;align-items:center;gap:8px;max-width:calc(100% - 24px);flex-wrap:wrap;justify-content:center}
.cs-seats:empty{display:none}
.cs-seats-l{font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#cfe8df;text-shadow:0 2px 6px #000}
.cs-seat{position:relative;display:inline-flex;align-items:center;gap:7px;padding:4px 12px 4px 4px;border-radius:99px;border:2px solid #ffffff22;background:#0b1626d9;cursor:pointer;text-align:left;box-shadow:0 6px 16px #0008}
.cs-seat svg{width:34px;height:34px;flex:none}.cs-seat span{display:flex;flex-direction:column;line-height:1.1}.cs-seat b{font-size:14px}.cs-seat small{font-size:11px;color:#a9c3d4;min-height:12px}
.cs-seat.on{border-color:var(--c,#ffd35c);background:#16324ef2}.cs-seat.me{cursor:default}.cs-seat.inv{opacity:.6;cursor:default;border-style:dashed}
.cs-seat.all{padding:8px 12px;font-weight:700;font-size:13px}
.cs-office:not(.cs-narrow) .cs-seat.all{display:none}.cs-office:not(.cs-phone) .cs-seats{flex-wrap:nowrap;white-space:nowrap}
.cs-watch .cs-seat,.cs-seat.me{cursor:default}
.cs-sb{position:absolute;top:calc(100% + 6px);left:50%;transform:translateX(-50%) translateY(6px);background:#fffaf0;color:#1d2230;font-weight:700;font-size:13px;font-style:normal;border-radius:12px;padding:6px 10px;white-space:nowrap;max-width:260px;overflow:hidden;text-overflow:ellipsis;box-shadow:0 8px 18px #0009;opacity:0;pointer-events:none;transition:all .3s;z-index:6}
.cs-sb.on{opacity:1;transform:translateX(-50%)}
.cs-deal2{position:absolute;z-index:3;left:50%;transform:translateX(-50%);top:64px;width:min(560px,32%);max-height:calc(71% - 80px);overflow:auto;background:#0b1626e6;border:1px solid #ffffff26;border-radius:16px;padding:10px 12px;box-shadow:0 14px 30px #000a}
.cs-deal2:empty{display:none}
.cs-dealbox{display:none}
.cs-dl-h{font-size:13px;font-weight:700;color:#cfe8df;margin-bottom:6px}
.cs-dl{display:flex;flex-wrap:wrap;align-items:center;gap:6px 8px;padding:6px 0;border-top:1px solid #ffffff14}
.cs-dlw{font-size:14px;white-space:nowrap}.cs-dlw i{font-style:normal;color:#ffd35c;margin:0 2px}
.cs-dlc{display:flex;flex-wrap:wrap;gap:6px}.cs-dl .cs-tok{font-size:13px;padding:4px 8px}
.cs-dl .cs-tok .x,.cs-deal .cs-tok .x{display:none!important}
.cs-dl-st{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}.cs-dl-st span{font-size:12.5px;font-weight:700;padding:3px 9px;border-radius:99px;background:#ffffff14;color:#ffd35c}.cs-dl-st span.ok{background:#1f5a34;color:#bff5c8}
.cs-dl-e{color:#ffffff90;font-style:italic;font-size:14px}
.cs-watch .cs-desk{grid-template-columns:minmax(0,1fr)}
.cs-watch .cs-tray,.cs-watch .cs-mid{display:none}
.cs-watch .cs-dealbox{display:block;overflow:auto;min-height:0;background:#1a3a2acc;border:2px solid #0006;border-radius:16px;padding:10px 14px;box-shadow:inset 0 4px 14px #0008}
.cs-watch .cs-add,.cs-watch .cs-phr{display:none}
.cs-watch .cs-acts{grid-column:1/-1;grid-row:1/3;justify-content:center;max-width:none}
.cs-watchmsg{font-size:17px;font-weight:700;color:#ffd35c;text-align:center;text-shadow:0 2px 6px #000}
.cs-multi .cs-stage{top:64px}
.cs-narrow .cs-deal2{display:none}
.cs-phone.cs-multi .cs-stage{top:168px}.cs-phone .cs-seats{top:-44px;gap:4px;flex-wrap:nowrap;overflow-x:auto;justify-content:flex-start;left:6px;right:6px;transform:none;max-width:none;padding-bottom:2px;scrollbar-width:none}
.cs-phone .cs-seats-l{display:none}.cs-phone .cs-seat{padding:2px 8px 2px 2px;flex:none}.cs-phone .cs-seat svg{width:26px;height:26px}.cs-phone .cs-seat b{font-size:12px}.cs-phone .cs-seat small{font-size:10px}
.cs-phone .cs-sb{display:none}
.cs-phone.cs-watch .cs-ctrl{height:auto;min-height:70px;bottom:0}.cs-phone.cs-watch .cs-stage{bottom:84px}.cs-phone .cs-watchmsg{font-size:14px}

/* ---------- DIALOGURI (bancă, deschidere) ---------- */
.cs-dlg{background:#050c16b8;display:flex;align-items:center;justify-content:center;padding:16px;backdrop-filter:blur(3px);animation:csFade .25s}
@keyframes csFade{from{opacity:0}}
.cs-dlg-c{width:min(640px,100%);max-height:100%;overflow:auto;background:linear-gradient(180deg,#16324e,#0d2034);border:1px solid #2f5574;border-radius:22px;padding:20px 22px;box-shadow:0 40px 80px #000c,inset 0 1px 0 #ffffff1a;display:flex;flex-direction:column;gap:14px;animation:csTok .35s cubic-bezier(.3,1.4,.5,1)}
.cs-dlg-c header{display:flex;align-items:center;gap:12px}.cs-dlg-c header>div:not(.cs-bk-logo){flex:1}.cs-dlg-c h2{font-size:24px}
.cs-dlg-a{display:flex;justify-content:flex-end;gap:10px;flex-wrap:wrap}
.cs-who{display:flex;gap:12px;flex-wrap:wrap}
.cs-whob{flex:1;min-width:130px;border:2px solid #2a4d6c;background:#0d2136;border-radius:16px;padding:12px 8px;display:flex;flex-direction:column;align-items:center;gap:3px;cursor:pointer;position:relative;transition:transform .15s}
.cs-whob svg{width:72px;height:72px}.cs-whob small{color:#8fb0c4}.cs-whob em{position:absolute;top:8px;right:8px;font-style:normal;font-size:11px;background:#2a3a55;color:#b9c9ff;border-radius:6px;padding:0 6px}
.cs-whob:hover{transform:translateY(-2px)}.cs-whob.on{border-color:var(--c);box-shadow:0 0 0 4px color-mix(in srgb,var(--c) 25%,transparent)}
.cs-loanf{display:grid;grid-template-columns:1fr 1fr;gap:10px}.cs-loanf label{display:flex;flex-direction:column;gap:4px;font-size:13px;color:#a9c3d4;font-weight:700}.cs-loanf .cs-chips{grid-column:1/-1}
.cs-bank-c{width:min(760px,100%)}
.cs-bk-logo{font-size:40px;width:60px;height:60px;border-radius:16px;background:linear-gradient(180deg,#ffd76a,#c08a1c);display:flex;align-items:center;justify-content:center;box-shadow:0 6px 16px #0008;flex:none}
.cs-bk-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
.cs-bk-stats>div{background:#0b1a2b;border:1px solid #23445f;border-radius:14px;padding:10px 12px;display:flex;flex-direction:column}
.cs-bk-stats span{font-size:11.5px;letter-spacing:.1em;text-transform:uppercase;color:#8fb0c4;font-weight:700}.cs-bk-stats b{font-size:21px}
.cs-bk-stats .cs-bk-s{grid-column:1/-1;flex-direction:row;align-items:center;gap:12px}
.cs-gauge{flex:1;height:10px;border-radius:5px;background:#ffffff14;overflow:hidden}.cs-gauge i{display:block;height:100%;border-radius:5px}
.cs-warn{grid-column:1/-1;background:#4a1515;border:1px solid #ff6b6b88;color:#ffd0d0;border-radius:12px;padding:10px 12px;font-weight:600}
.cs-bk-new,.cs-bk-loans{background:#0b1a2b88;border:1px solid #23445f;border-radius:16px;padding:14px 16px;display:flex;flex-direction:column;gap:10px}
.cs-bk-new h3,.cs-bk-loans h3{font-size:16px;color:#cfe2ee}
.cs-bk-amt{display:flex;align-items:center;gap:16px}.cs-bk-amt b{font-size:30px;color:#7be07b;min-width:150px;font-variant-numeric:tabular-nums}
.cs-bk-amt input{flex:1;accent-color:#ffd35c;height:28px}
.cs-bk-calc{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;align-items:end}.cs-bk-calc>div{display:flex;flex-direction:column}
.cs-bk-calc span{font-size:12px;color:#8fb0c4}.cs-bk-calc b{font-size:18px}.cs-bk-calc small{grid-column:1/-1}
.cs-loan{display:grid;grid-template-columns:repeat(3,minmax(0,1fr)) auto;gap:10px;align-items:center;background:#0d2136;border:1px solid #23445f;border-left:4px solid #ffd35c;border-radius:12px;padding:10px 12px}
.cs-loan.late{border-left-color:#ff6b6b}.cs-loan>div{display:flex;flex-direction:column}.cs-loan small{color:#8fb0c4;font-size:12px}
.cs-none{padding:6px 2px}
.cs-phone .cs-bk-stats{grid-template-columns:1fr 1fr}.cs-phone .cs-bk-stats b{font-size:17px}.cs-phone .cs-bk-amt b{font-size:22px;min-width:0}
.cs-phone .cs-bk-calc{grid-template-columns:1fr 1fr}.cs-phone .cs-loan{grid-template-columns:1fr 1fr 1fr}.cs-phone .cs-loan-a{grid-column:1/-1}.cs-phone .cs-loan-a .cs-btn{width:100%}
.cs-phone .cs-dlg-c{padding:14px;border-radius:16px}.cs-phone .cs-dlg-c h2{font-size:19px}.cs-phone .cs-loanf{grid-template-columns:1fr}

/* ---------- ÎNGHEȚ ---------- */
.cs-root.cs-freeze{pointer-events:none;z-index:8}
.cs-ice{position:absolute;inset:0;animation:csFade .6s}
.cs-icefb{position:absolute;inset:0;background:radial-gradient(ellipse at center,transparent 35%,#bfe8ff55 70%,#e8f8ffcc 100%);box-shadow:inset 0 0 120px #dff6ff}
.cs-fz-c{position:absolute;left:50%;top:18%;transform:translateX(-50%);pointer-events:auto;text-align:center;background:linear-gradient(180deg,#e9f8ffee,#b9e2f8ee);color:#0d3150;border-radius:22px;padding:16px 26px 18px;box-shadow:0 20px 50px #0a2a4a88,inset 0 1px 0 #fff;border:2px solid #fff;max-width:min(560px,92vw);animation:csTok .5s cubic-bezier(.3,1.5,.5,1)}
.cs-fz-ic{font-size:44px;line-height:1;animation:csSpin 6s linear infinite}
.cs-fz-c h2{font-size:26px;color:#0d3150}.cs-fzby{background:#0d3150;color:#fff;border-radius:6px;padding:0 7px;box-shadow:inset 0 -3px 0 var(--c)}.cs-fz-c p{margin:6px 0 10px;font-size:15px}
.cs-fz-ring{position:relative;width:72px;height:72px;margin:0 auto}.cs-fz-ring .fg{stroke:#2a8fd8;stroke-linecap:round;stroke-dasharray:119.4;transition:stroke-dashoffset .15s linear}.cs-fz-ring .bg{stroke:#0d315022}
.cs-fz-ring b{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:26px}
.cs-brk{position:absolute;inset:0;display:none;align-items:center;justify-content:center;background:#03101ccc;pointer-events:auto}
.cs-brk.on{display:flex}
.cs-brk-c{text-align:center;background:linear-gradient(180deg,#3a1a10,#200c06);border:2px solid #ff8a4c;border-radius:24px;padding:22px 28px;box-shadow:0 0 60px #ff6a2c66;max-width:min(520px,92vw);animation:csTok .4s cubic-bezier(.3,1.5,.5,1)}
.cs-brk-ic{font-size:64px;animation:csPulse .4s infinite alternate}.cs-brk-c h3{font-size:24px;margin:6px 0}.cs-brk-c p{color:#ffd0b8;margin:0 0 12px}
.cs-brk-bar{height:10px;border-radius:5px;background:#ffffff1c;overflow:hidden;margin-bottom:14px}.cs-brk-bar i{display:block;height:100%;background:linear-gradient(90deg,#ff4b2b,#ffd35c);transition:width .15s linear}
.cs-brk-a{display:flex;gap:10px;justify-content:center;flex-wrap:wrap}
.cs-freeze.crack .cs-ice{animation:csShat 1s forwards}.cs-freeze.melt .cs-ice,.cs-freeze.melt .cs-fz-c{animation:csMelt 1.1s forwards}
@keyframes csShat{20%{transform:scale(1.03);filter:brightness(1.6)}100%{transform:scale(1.25);opacity:0;filter:blur(6px)}}
@keyframes csMelt{to{opacity:0;transform:translateY(30px);filter:blur(4px)}}
.cs-phone .cs-fz-c{top:auto;bottom:12px;padding:10px 14px}.cs-phone .cs-fz-c h2{font-size:19px}.cs-phone .cs-fz-c p{font-size:13px}.cs-phone .cs-fz-ic{font-size:30px}

/* ---------- FALIMENT ---------- */
.cs-bkr{background:radial-gradient(ellipse at 50% 30%,#3a1416 0%,#1a0a0e 55%,#07050a 100%);display:flex;align-items:center;justify-content:center;z-index:9;animation:csFade .6s}
.cs-storm{position:absolute;inset:0;overflow:hidden;pointer-events:none}
.cs-storm .r1,.cs-storm .r2{position:absolute;inset:-50%;background:repeating-linear-gradient(105deg,transparent 0 14px,#ffffff0c 14px 15px);animation:csRain .5s linear infinite}
.cs-storm .r2{animation-duration:.8s;opacity:.6}
@keyframes csRain{to{transform:translate(-30px,60px)}}
.cs-storm .flash{position:absolute;inset:0;background:#fff;opacity:0;animation:csFlash 5s 1s infinite}
@keyframes csFlash{0%,92%,100%{opacity:0}93%{opacity:.35}94%{opacity:0}96%{opacity:.2}}
.cs-bkr-c{position:relative;text-align:center;max-width:min(720px,92vw);display:flex;flex-direction:column;align-items:center;gap:10px}
.cs-bkr-av{position:relative;filter:grayscale(.55) drop-shadow(0 20px 30px #000)}.cs-bkr-av>svg{width:200px;height:200px}
.cs-stamp2{position:absolute;left:50%;top:50%;font-family:var(--display,Impact,sans-serif);font-size:54px;letter-spacing:.1em;color:#ff3b3b;border:6px solid #ff3b3b;border-radius:12px;padding:0 18px;transform:translate(-50%,-50%) rotate(-16deg);animation:csStampIn .6s .6s both cubic-bezier(.3,1.6,.5,1);background:#1a0a0e99;white-space:nowrap}
@keyframes csStampIn{from{opacity:0;transform:translate(-50%,-50%) rotate(-16deg) scale(3)}}
.cs-bkr-logo{display:flex;align-items:center;gap:10px;filter:grayscale(1);opacity:.8;font-size:18px;text-decoration:line-through}
.cs-bkr h1{font-family:var(--display,Impact,sans-serif);font-size:48px;text-transform:uppercase;letter-spacing:.05em;color:#ffb0b0}
.cs-bkr p{font-size:17px;color:#e8cfd2;margin:0}
.cs-planes{display:flex;gap:24px;margin:8px 0 12px}.cs-gp{display:block;width:140px;filter:grayscale(1) brightness(.6);animation:csGround 1.4s calc(var(--i)*.25s + .8s) both cubic-bezier(.5,0,.7,1)}.cs-gp svg{width:100%;height:auto}
@keyframes csGround{from{transform:translateY(-120px) rotate(-14deg);opacity:0}70%{transform:translateY(6px) rotate(2deg);opacity:1}}
.cs-phone .cs-bkr-av>svg{width:130px;height:130px}.cs-phone .cs-bkr h1{font-size:30px}.cs-phone .cs-bkr p{font-size:14px}.cs-phone .cs-gp{width:84px}.cs-phone .cs-planes{gap:8px}.cs-phone .cs-stamp2{font-size:30px}

/* ---------- FINAL ---------- */
.cs-end{background:radial-gradient(1200px 700px at 50% -10%,#2a3f7a 0%,transparent 60%),linear-gradient(180deg,#0c1a33,#060d1a);overflow:auto}
.cs-end-bg{position:absolute;inset:0;overflow:hidden;pointer-events:none}
.cs-beam{position:absolute;top:-20%;width:30%;height:140%;background:linear-gradient(180deg,#ffd35c22,transparent 70%);filter:blur(20px);transform-origin:top center;animation:csBeam 9s ease-in-out infinite alternate}
.cs-beam.b1{left:15%;transform:rotate(18deg)}.cs-beam.b2{right:15%;transform:rotate(-18deg);animation-delay:-4s}
@keyframes csBeam{to{transform:rotate(-8deg)}}
.cs-end-in{position:relative;max-width:1500px;margin:0 auto;padding:22px 26px 30px;display:flex;flex-direction:column;gap:14px;min-height:100%}
.cs-end-h{text-align:center}.cs-end-h h1{font-family:var(--display,Impact,sans-serif);font-size:56px;text-transform:uppercase;letter-spacing:.05em;background:linear-gradient(180deg,#fff,#ffd35c);-webkit-background-clip:text;background-clip:text;color:transparent}
.cs-end-h p{margin:2px 0 0;font-size:18px;color:#cfe2ee}
.cs-tabs{display:flex;gap:8px;justify-content:center;flex-wrap:wrap}
.cs-tabs button{border:1px solid #2f5574;background:#10263b;border-radius:99px;padding:8px 16px;font-weight:700;cursor:pointer}.cs-tabs button.on{background:linear-gradient(180deg,#ffd76a,#f0a92c);color:#2a1800;border-color:#ffe39a}.cs-tabs .rp{opacity:.8}
.cs-vt-wrap{overflow-x:auto;border-radius:18px}
.cs-vtab{width:100%;max-width:1400px;margin:0 auto;border-collapse:separate;border-spacing:0;background:#0d2034cc;border:1px solid #2a4d6c;border-radius:18px;overflow:hidden;min-width:560px}
.cs-vtab th,.cs-vtab td{padding:10px 14px;text-align:right;border-bottom:1px solid #ffffff10;font-variant-numeric:tabular-nums}
.cs-vtab th{border-bottom:3px solid var(--c,#2a4d6c);background:#0b1a2b}
.cs-vh{display:flex;flex-direction:column;align-items:flex-end;gap:2px}.cs-vh svg{width:56px;height:56px}.cs-vh b{font-size:17px}.cs-vh small{color:#8fb0c4;font-weight:600}.cs-vh em{font-style:normal;font-size:12px}
.cs-stn{text-align:left!important;font-weight:700;color:#cfe2ee;white-space:nowrap}.cs-stn i{font-style:normal;margin-right:8px}
.cs-st{opacity:.12;transition:opacity .4s,background .6s}.cs-st.on{opacity:1;background:#ffd35c0d}
.cs-st td{font-size:17px}.cs-st td.pos{color:#8ff08f}.cs-st td.neg{color:#ff8b8b}
.cs-tot td{font-size:26px;background:#0b1a2b;position:relative;opacity:.5;transition:opacity .4s}.cs-tot.on td{opacity:1}.cs-tot td b{color:#fff}
.cs-bar{height:8px;border-radius:4px;background:#ffffff12;margin-top:6px;overflow:hidden}.cs-bar i{display:block;height:100%;width:0;background:var(--c);border-radius:4px;transition:width .9s cubic-bezier(.3,1,.5,1);box-shadow:0 0 12px var(--c)}
.cs-rk{display:none}
.cs-podium{display:flex;flex-direction:column;align-items:center;gap:14px;padding-top:10px}
.cs-pods{display:flex;align-items:flex-end;justify-content:center;gap:18px;width:100%;margin-top:40px}
.cs-pod{flex:0 1 260px;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:4px;animation:csRise .9s cubic-bezier(.3,1.3,.5,1) both}
.cs-pod.r1{animation-delay:.5s}.cs-pod.r2{animation-delay:.2s}.cs-pod.r3{animation-delay:0s}
@keyframes csRise{from{transform:translateY(80px);opacity:0}}
.cs-pod-av{position:relative;filter:drop-shadow(0 14px 22px #000b)}.cs-pod.r1 .cs-pod-av svg{width:170px;height:170px}.cs-pod-av svg{width:130px;height:130px}
.cs-crown{position:absolute;left:50%;top:-38px;transform:translateX(-50%);font-size:46px;animation:csBob 2s ease-in-out infinite}
.cs-pod b{font-size:20px}.cs-pod small{color:#a9c3d4}.cs-pod-v{font-size:20px;font-weight:800;color:#ffd35c}
.cs-pod-b{width:100%;height:calc(var(--h) * 2.7px);border-radius:14px 14px 0 0;background:linear-gradient(180deg,color-mix(in srgb,var(--c) 70%,#fff 10%),color-mix(in srgb,var(--c) 40%,#000));box-shadow:inset 0 2px 0 #ffffff55,0 20px 40px #0008;display:flex;justify-content:center;padding-top:10px;min-height:60px}
.cs-pod-b span{font-family:var(--display,Impact,sans-serif);font-size:64px;color:#ffffffdd;text-shadow:0 3px 0 #0005}
.cs-pod4{display:flex;align-items:center;gap:12px;background:#0d2034;border:1px solid #2a4d6c;border-left:5px solid var(--c);border-radius:14px;padding:8px 16px;min-width:min(520px,100%)}.cs-pod4 svg{width:44px;height:44px}.cs-pod4 small{color:#8fb0c4;flex:1}
.cs-achs{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:14px}
.cs-achp{background:#0d2034cc;border:1px solid #2a4d6c;border-top:4px solid var(--c);border-radius:16px;padding:12px 14px}
.cs-achp header{display:flex;align-items:center;gap:10px;margin-bottom:8px}.cs-achp header svg{width:40px;height:40px}.cs-achp header small{margin-left:auto;color:#8fb0c4}
.cs-achl{display:flex;flex-direction:column;gap:6px}
.cs-ach{display:flex;gap:10px;align-items:center;background:#0b1a2b;border-radius:12px;padding:8px 10px;animation:csTok .4s var(--d) both}
.cs-ach>i{font-style:normal;font-size:26px;width:44px;height:44px;display:flex;align-items:center;justify-content:center;border-radius:50%;background:radial-gradient(circle at 35% 30%,#fff6,transparent 50%),linear-gradient(180deg,#ffd76a,#c08a1c);flex:none}
.cs-ach div{display:flex;flex-direction:column}.cs-ach small{color:#8fb0c4}
.cs-sttab{width:100%;border-collapse:collapse;background:#0d2034cc;border-radius:16px;overflow:hidden}
.cs-sttab th,.cs-sttab td{padding:9px 14px;text-align:right;border-bottom:1px solid #ffffff10;font-variant-numeric:tabular-nums}.cs-sttab td:first-child{text-align:left;color:#cfe2ee}
.cs-sttab td.best{color:#ffd35c;font-weight:800}
.cs-phone .cs-end-in{padding:12px 10px 20px}.cs-phone .cs-end-h h1{font-size:30px}.cs-phone .cs-end-h p{font-size:14px}
.cs-phone .cs-vtab{min-width:0}.cs-phone .cs-vtab th,.cs-phone .cs-vtab td{padding:6px 5px}.cs-phone .cs-vh svg{width:34px;height:34px}.cs-phone .cs-vh b{font-size:13px}.cs-phone .cs-vh small{display:none}
.cs-phone .cs-st td{font-size:10.5px}.cs-phone .cs-st td:not(.cs-stn){white-space:nowrap}.cs-phone .cs-stn{width:30%;font-size:11px!important;line-height:1.2}.cs-phone .cs-tot td b{white-space:nowrap}.cs-phone .cs-stn{white-space:normal;font-size:12px}.cs-phone .cs-stn i{display:none}.cs-phone .cs-tot td{font-size:13px}
.cs-phone .cs-pods{gap:6px}.cs-phone .cs-pod-b{height:calc(var(--h) * 1.5px)}.cs-phone .cs-pod-av svg{width:76px;height:76px}.cs-phone .cs-pod.r1 .cs-pod-av svg{width:96px;height:96px}
.cs-phone .cs-pod b{font-size:14px}.cs-phone .cs-pod small{display:none}.cs-phone .cs-pod-v{font-size:13px}.cs-phone .cs-pod-b span{font-size:36px}.cs-phone .cs-crown{font-size:30px;top:-26px}
.cs-phone .cs-tabs button{padding:6px 10px;font-size:13px}.cs-phone .cs-achs{grid-template-columns:1fr}

/* R1 SCENES: gen ales, setări de start, sume formatate, risc împrumut, graficul valorii */
@media (max-height:900px) and (min-width:700px){.cs-votes .cs-vtile{padding:8px 12px 9px}.cs-votes .cs-vtile .ic{font-size:19px}.cs-votes .cs-vtile b{font-size:16px}.cs-votes .cs-lbl{margin:10px 0 6px}.cs-votes .cs-vt{gap:8px}.cs-votes .cs-vres{margin-top:10px;padding:8px 12px;font-size:13px}}
.cs-gsel{display:flex;align-items:center;gap:10px;font-size:13px;color:#a9c3d4;font-weight:700}.cs-gsel .cs-seg{flex:0 0 auto}.cs-gsel .cs-seg button{padding:5px 16px}
.cs-amt{font-variant-numeric:tabular-nums;text-align:right;letter-spacing:.02em}
.cs-riskw{min-height:0;grid-column:1/-1}.cs-riskw:empty{display:none}.cs-loanf>small{grid-column:1/-1}
.cs-risk{display:flex;align-items:center;gap:8px;margin-top:8px;padding:8px 12px;border-radius:10px;font-size:13px;color:#cfe2ee;background:#0b1a2b;border:1px solid #2c4e6a}
.cs-risk i{flex:none;width:10px;height:10px;border-radius:50%;background:#7be07b;box-shadow:0 0 8px currentColor}
.cs-risk.r-mic{border-color:#2f6b4a}.cs-risk.r-mediu{border-color:#8a6a1e}.cs-risk.r-mediu i{background:#ffd35c}.cs-risk.r-mare{border-color:#8a2e2e;background:#2a1216}.cs-risk.r-mare i{background:#ff6b6b}
.cs-grbox{position:relative;background:#0d2034cc;border:1px solid #2a4d6c;border-radius:18px;padding:14px 16px 12px;max-width:1400px;margin:0 auto;width:100%}
.cs-grh{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap;margin-bottom:8px}.cs-grh b{font-size:17px}
.cs-grc{width:100%;min-height:200px}.cs-graph{display:block;width:100%;height:auto;font-variant-numeric:tabular-nums;touch-action:pan-y}
.cs-graph .gr line{stroke:#ffffff14;stroke-width:1}.cs-graph .gr line.z{stroke:#ffffff40}.cs-graph text{fill:#8fb0c4;font-size:12px;font-family:inherit}
.cs-graph .lb{font-size:14px;font-weight:800}.cs-graph .lv{fill:#cfe2ee;font-size:12px}.cs-graph .cx{stroke:#ffffff55;stroke-width:1;stroke-dasharray:3 3}
.cs-graph .ln{filter:drop-shadow(0 0 4px #0008)}
.cs-grleg{display:flex;flex-wrap:wrap;gap:8px 18px;margin-top:10px}
.cs-gl{display:flex;align-items:center;gap:8px;font-size:14px;font-variant-numeric:tabular-nums}.cs-gl i{width:14px;height:4px;border-radius:2px;background:var(--c)}.cs-gl b{color:var(--c)}.cs-gl em{font-style:normal;font-weight:800}.cs-gl small{color:#8fb0c4;font-size:12px}
.cs-grtip{position:absolute;top:8px;left:0;pointer-events:none;opacity:0;transition:opacity .12s;background:#07121fee;border:1px solid #2c4e6a;border-radius:10px;padding:8px 10px;font-size:13px;min-width:180px;display:flex;flex-direction:column;gap:3px;font-variant-numeric:tabular-nums;z-index:2}
.cs-grtip.on{opacity:1}.cs-grtip span{display:flex;align-items:center;gap:6px}.cs-grtip span i{width:8px;height:8px;border-radius:50%;background:var(--c)}.cs-grtip em{font-style:normal;margin-left:auto;padding-left:12px;font-weight:800}
.cs-phone .cs-grbox{padding:10px 8px}.cs-phone .cs-graph text{font-size:10px}.cs-phone .cs-gl{font-size:13px}.cs-phone .cs-gl small{display:none}
.cs-rm *,.cs-rm *::before,.cs-rm *::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}
@media (prefers-reduced-motion:reduce){.cs-root *,.cs-root *::before,.cs-root *::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}}
`;

  if (typeof window !== "undefined") window.CerulScenes = CerulScenes;
  if (typeof module !== "undefined" && module.exports) module.exports = CerulScenes;
})();
