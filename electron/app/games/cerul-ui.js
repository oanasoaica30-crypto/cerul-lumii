/* Cerul Lumii — interfața principală (HUD) → window.CerulUI
   Doar afișare + interacțiune. Datele vin din CerulLogic.view(); acțiunile pleacă prin helpers.send(action).
   Harta: CerulMap · desene: CerulArt · scene pe tot ecranul: CerulScenes · ghid: CerulGuide · texte: CerulData. */
(function () {
"use strict";
if (typeof window === "undefined") return;
const W = window;
const IC = (n, fb) => { try { return (W.CerulTheme && W.CerulTheme.icon(n)) || fb || ""; } catch (e) { return fb || ""; } }; // iconițe SVG din cerul-theme.js (fallback emoji)
const ACT = "a"; // cheia tipului de acțiune (CERUL.md: câmpul `a`)

/* ---------------- utilitare ---------------- */
const escH = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const num = (x, d) => (typeof x === "number" && isFinite(x)) ? x : (x != null && x !== "" && isFinite(+x) ? +x : (d === undefined ? 0 : d));
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const pick = (o, ...ks) => { if (!o) return undefined; for (const k of ks) if (o[k] !== undefined && o[k] !== null) return o[k]; return undefined; };
const arr = x => Array.isArray(x) ? x : (x && typeof x === "object" ? Object.values(x) : []);
const fold = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const reducedMQ = () => { try { return matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; } };
const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* fără stocare */ } };

function fmtE(n, short) {
  n = Math.round(num(n));
  const D = W.CerulData;
  if (D) { const f = D.fmtEur || D["fmt€"]; if (typeof f === "function") { try { const s = f(n); if (s) return s; } catch (e) { /* rezervă */ } } }
  const a = Math.abs(n), sg = n < 0 ? "−" : "";
  if (a >= 1e6) return sg + (a / 1e6).toFixed(a >= 1e8 ? 0 : a >= 1e7 ? 1 : 2).replace(".", ",") + " M €";
  return sg + String(a).replace(/\B(?=(\d{3})+(?!\d))/g, ".") + " €";
}
const kDay = (n, abs) => { n = Math.round(num(n)); const a = Math.abs(n), sg = abs ? "" : n > 0 ? "+" : n < 0 ? "−" : ""; return sg + (a >= 1e6 ? (a / 1e6).toFixed(2).replace(".", ",").replace(/,?0+$/, "") + " M" : fmtInt(a)) + " €/zi"; };
const fmtDay = n => (num(n) > 0 ? "+" : "") + fmtE(n, true) + "/zi";
const fmtSigned = n => (num(n) > 0 ? "+" : "") + fmtE(n);
const fmtInt = n => String(Math.round(num(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
function hms(ms) { ms = Math.max(0, Math.round(num(ms) / 1000)); const h = Math.floor(ms / 3600), m = Math.floor(ms % 3600 / 60), s = ms % 60; return (h ? h + ":" + String(m).padStart(2, "0") : m) + ":" + String(s).padStart(2, "0"); }
function gdur(min) { min = Math.max(0, Math.round(num(min))); const h = Math.floor(min / 60), m = min % 60; return h ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`; }

/* ---------------- cărți ---------------- */
const RES = {
  apr: { n: "Aprobare", s: "Aprobare", i: "🛂", c: "#2a5aa0" },
  inf: { n: "Infrastructură", s: "Infrastr.", i: "🏗️", c: "#7a5530" },
  ech: { n: "Echipaj", s: "Echipaj", i: "👨‍✈️", c: "#2f7550" },
  comb: { n: "Combustibil", s: "Combust.", i: "⛽", c: "#8a3434" },
  joker: { n: "Joker", s: "Joker", i: "⭐", c: "#d9a520" },
};
const RES_ORDER = ["apr", "inf", "ech", "comb", "joker"];
function resKey(k) {
  const f = fold(k);
  if (f.startsWith("apr")) return "apr"; if (f.startsWith("inf")) return "inf"; if (f.startsWith("ech") || f === "crew") return "ech";
  if (f.startsWith("comb") || f === "fuel") return "comb"; if (f.startsWith("jok") || f === "j") return "joker";
  return null;
}
const SPEC = {
  freeze: { n: "Îngheață timpul", i: "❄️", tgt: "opp", cls: "ice" },
  breaker: { n: "Spărgător de gheață", i: "🔥", tgt: "auto", cls: "fire" },
  rapid: { n: "Construcție rapidă", i: "🚀", tgt: "permit" },
  vip: { n: "Permis VIP", i: "🎟️", tgt: "pair" },
  boom: { n: "Boom de pasageri", i: "📈", tgt: "route" },
  fuelc: { n: "Contract de combustibil", i: "⛽", tgt: "none" },
  spy: { n: "Spion", i: "🔍", tgt: "opp" },
  ad: { n: "Campanie de reclamă", i: "📣", tgt: "none" },
  insure: { n: "Asigurare", i: "🧯", tgt: "auto" },
  slot: { n: "Slot suplimentar", i: "🏛️", tgt: "airport" },
  gift: { n: "Avion cadou", i: "✈️", tgt: "none" },
};
function specKey(k) {
  const f = fold(k);
  if (/ingh|freeze|^frz/.test(f)) return "freeze"; if (/sparg|break|^brk/.test(f)) return "breaker"; if (/rapid|^fast/.test(f)) return "rapid";
  if (/vip/.test(f)) return "vip"; if (/boom/.test(f)) return "boom"; if (/contract|fuelc|fuel/.test(f)) return "fuelc";
  if (/spion|spy/.test(f)) return "spy"; if (/recl|camp|^ad$|advert/.test(f)) return "ad"; if (/asig|insur|^ins$/.test(f)) return "insure";
  if (/slot/.test(f)) return "slot"; if (/cadou|gift/.test(f)) return "gift";
  return null;
}
function specInfo(k) {
  const sk = specKey(k) || k, base = SPEC[sk] || { n: String(k), i: "🃏", tgt: "none" };
  const D = W.CerulData; let d = "";
  try { const c = D && D.CARDS && (D.CARDS[k] || Object.values(D.CARDS).find(x => specKey(x.id) === sk && x.kind === "special")); if (c) { d = c.d || ""; return Object.assign({}, base, { n: c.n || base.n, i: c.icon || base.i, d, sk }); } } catch (e) { /* rezervă */ }
  return Object.assign({}, base, { d, sk });
}
/* ---------------- avioane (generic: N tipuri din CerulLogic.TYPES(), index = ty) ---------------- */
const PT_FB = [
  { id: "t72", n: "Turbo 72", seats: 70, range: 1800, speed: 520, price: 3000000, ckm: 3, crewH: 250, lease: 45000, minSize: 1 },
  { id: "a320", n: "Aero 320", seats: 180, range: 5000, speed: 840, price: 9000000, ckm: 11, crewH: 900, lease: 140000, minSize: 1 },
  { id: "s350", n: "Skyliner 350", seats: 320, range: 14500, speed: 900, price: 24000000, ckm: 15, crewH: 1600, lease: 370000, minSize: 2 },
];
function TYPES() {
  try { const L = W.CerulLogic, a = L && typeof L.TYPES === "function" ? L.TYPES() : null; if (Array.isArray(a) && a.length) return a; } catch (e) { /* rezervă */ }
  return PT_FB;
}
// ordinea de afișare (mic → mare)
function ptOrder() {
  const n = TYPES().length;
  try { const o = (W.CerulLogic && W.CerulLogic.PLANE_ORDER) || (W.CerulData && W.CerulData.PLANE_ORDER); if (Array.isArray(o) && o.length) { const r = o.filter(i => i >= 0 && i < n); for (let i = 0; i < n; i++) if (r.indexOf(i) < 0) r.push(i); return r; } } catch (e) { /* rezervă */ }
  return TYPES().map((t, i) => i).sort((x, y) => num(TYPES()[x].seats) - num(TYPES()[y].seats));
}
function ptIdx(t) {
  const TT = TYPES(), n = TT.length;
  if (typeof t === "number") return t >= 0 && t < n ? t | 0 : 0;
  if (t == null) return 0;
  if (typeof t === "object") return ptIdx(pick(t, "ty", "type", "tid", "id", "k"));
  if (/^\d+$/.test(String(t))) { const i = +t; return i < n ? i : 0; }
  try { const L = W.CerulLogic; if (L && typeof L.normPlaneType === "function") { const i = L.normPlaneType(t); if (i >= 0 && i < n) return i; } } catch (e) { /* rezervă */ }
  const f = fold(t).replace(/[^a-z0-9]/g, "");
  let i = TT.findIndex(x => fold(x.id) === f || fold(x.n).replace(/[^a-z0-9]/g, "") === f);
  if (i >= 0) return i;
  if (/turbo|t72/.test(f)) i = TT.findIndex(x => x.id === "t72"); else if (/aero|a320/.test(f)) i = TT.findIndex(x => x.id === "a320"); else if (/sky|s350/.test(f)) i = TT.findIndex(x => x.id === "s350");
  return i >= 0 ? i : 0;
}
const ptKey = t => String(TYPES()[ptIdx(t)].id);
function ptInfo(t) {
  const i = ptIdx(t), a = TYPES()[i] || TYPES()[0];
  const b = { k: String(a.id), ty: i, n: a.n || a.name || String(a.id), seats: num(a.seats), range: num(a.range), speed: num(a.speed), price: num(a.price),
    ckm: num(pick(a, "ckm", "fuelPerKm")), crewH: num(pick(a, "crewH", "crewPerH")), lease: pick(a, "lease", "leaseDay"), pilot: pick(a, "pilot", "pilotDay"), minSize: num(a.minSize, 1), role: a.role || "", d: "", nCls: "" };
  try { const D = W.CerulData && W.CerulData.AIRCRAFT && W.CerulData.AIRCRAFT[b.k]; if (D) { b.d = D.d || ""; b.nCls = D.nCls || ""; if (!b.role) b.role = D.short || ""; if (!a.n && D.n) b.n = D.n; } } catch (e) { /* rezervă */ }
  b.sh = b.n;
  return b;
}
function nickOf(id, name, t, memo) {
  if (name && name !== t.n && !TYPES().some(x => x.n === name)) return name;
  memo = memo || {}; if (memo[id]) return memo[id];
  let h = 7; String(id).split("").forEach(c => { h = (h * 31 + c.charCodeAt(0)) >>> 0; });
  const used = new Set(Object.values(memo));
  let n = NICK[h % NICK.length];
  for (let k = 0; k < NICK.length && used.has(n); k++) n = NICK[(h + k + 1) % NICK.length];
  if (used.has(n)) n = n + " " + (Object.keys(memo).length + 1);
  return (memo[id] = n);
}
const NICK = ["Carpați", "Dunărea", "Brașov", "Olt", "Siret", "Mureș", "Bucegi", "Ceahlău", "Delta", "Prut", "Retezat", "Someș", "Argeș", "Făgăraș", "Rarău", "Bârsa", "Moldova", "Crișana", "Vrancea", "Danubius"];
/* UI-B (R1): panoul aeroportului, fișa avionului în zbor, filtre + selecție multiplă în flotă */
const UIB_CSS = `
.cl-pop.ap,.cl-pop.pc{width:360px;max-height:calc(100% - 16px);overflow:auto;scrollbar-width:thin}
.cl-psheet .cl-pop.ap,.cl-psheet .cl-pop.pc{width:auto;max-height:none;overflow:visible}
.cl-aph{display:flex;justify-content:space-between;align-items:baseline;gap:8px;margin-top:6px;font-size:11.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--mut)}
.cl-aph b{color:var(--ink);font-size:12.5px;letter-spacing:0}
.cl-aprow{display:flex;align-items:center;gap:8px;width:100%;text-align:left;background:#0c172bcc;border:1px solid var(--line);border-radius:9px;padding:5px 9px;font-size:13px;cursor:pointer;min-height:32px;color:var(--ink)}
.cl-aprow:hover:not(:disabled){border-color:#5b7dbb}.cl-aprow:disabled{cursor:default}
.cl-aprow .g{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cl-aprow .g small{color:var(--mut);font-size:12px;margin-left:4px}
.cl-aprow .n{flex:none;font-variant-numeric:tabular-nums;font-weight:700;white-space:nowrap}
.cl-aprow .n small{font-weight:600;color:var(--mut);font-size:11.5px}
.cl-aprow em{font-style:normal;flex:none;font-size:11px;font-weight:800;color:#ffb36b;border:1px solid #ffb36b66;border-radius:999px;padding:0 6px}
.cl-aplist{display:flex;flex-direction:column;gap:4px}
.cl-apst{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:700;border-radius:9px;padding:5px 9px;background:#0c172b;border:1px solid var(--line)}
.cl-apst i{width:9px;height:9px;border-radius:50%;flex:none;background:#9db0cf}
.cl-apst.over i{background:#ffb36b}.cl-apst.idle i{background:#7fb2ff}.cl-apst.balanced i{background:#5fd38a}
.cl-apst span{color:var(--mut);font-weight:600;margin-left:auto;font-variant-numeric:tabular-nums}
.cl-aptip{font-size:13px;line-height:1.35;border-left:3px solid #7fb2ff;background:#7fb2ff14;border-radius:0 9px 9px 0;padding:6px 9px;font-variant-numeric:tabular-nums}
.cl-aptip b{white-space:nowrap}
.cl-apmore{border-top:1px solid var(--line);margin-top:4px;padding-top:4px}
.cl-apmore>summary{cursor:pointer;font-size:12.5px;color:var(--mut);padding:3px 0;list-style:none}
.cl-apmore>summary::-webkit-details-marker{display:none}
.cl-apmore>summary::before{content:"▸ ";}.cl-apmore[open]>summary::before{content:"▾ ";}
.cl-apmore>div{display:flex;flex-direction:column;gap:6px}
.cl-pcbig{display:flex;align-items:baseline;justify-content:space-between;gap:10px;background:#0c172b;border:1px solid var(--line);border-radius:11px;padding:8px 11px}
.cl-pcbig small{color:var(--mut);font-size:12px}
.cl-pcbig b{font-size:24px;font-variant-numeric:tabular-nums;line-height:1.1}
.cl-pcleg{display:flex;align-items:center;gap:6px;font-size:14px;font-weight:700}
.cl-pcleg .ar{flex:1;height:2px;background:linear-gradient(90deg,#3a5a8f,#7fb2ff);border-radius:2px;position:relative;min-width:24px}
.cl-pcleg .ar i{position:absolute;top:-6px;font-style:normal;font-size:12px;transform:translateX(-50%)}
.cl-pcbtns{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:4px}
.cl-pcbtns .cl-btn{width:100%;justify-content:center;font-size:12.5px;padding:7px 8px}
.cl-pcbtns .cl-btn.wide{grid-column:1/-1}
.cl-pop .row .tn,.cl-aprow .tn{font-variant-numeric:tabular-nums}
.cl-ffil,.cl-bulk,.cl-fempty,.cl-nowl{flex:none}
.cl-ffil{display:flex;gap:5px;overflow-x:auto;scrollbar-width:none;padding:2px 0 4px;margin-top:6px}
.cl-ffil::-webkit-scrollbar{display:none}
.cl-ffil button{flex:none;border:1px solid var(--line2);background:#0c172b;color:#c9d6ee;border-radius:999px;padding:3px 10px;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap}
.cl-ffil button b{font-variant-numeric:tabular-nums;color:var(--mut);margin-left:3px;font-weight:700}
.cl-ffil button.on{background:#e8f0ff;color:#0b1424;border-color:#e8f0ff}.cl-ffil button.on b{color:#33445f}
.cl-ffil button:disabled{opacity:.4;cursor:default}
.cl-fchk{flex:none;width:22px;height:22px;border-radius:6px;border:1.5px solid #4b6694;background:#0b1424;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;padding:0;font-size:13px;line-height:1;color:#0b1424}
.cl-root .cl-fchk.on{background:var(--sel,#8cc2ff);border-color:var(--sel,#8cc2ff);color:#06101f}
.cl-root .cl-fchk.on::after{content:"✓";font-weight:900;font-size:14px;color:#06101f}
.cl-root .cl-pop.ap,.cl-root .cl-pop.pc{background:rgba(8,14,27,.93)}
.cl-root .cl-psheet .cl-pop.ap,.cl-root .cl-psheet .cl-pop.pc{background:transparent}
.cl-pl .h .cl-fchk{margin-right:2px}
.cl-pl.chk{border-color:#7fb2ff;box-shadow:0 0 0 1px #7fb2ff66}
.cl-bulk{position:sticky;top:0;z-index:3;display:flex;flex-wrap:wrap;align-items:center;gap:6px;background:#13254a;border:1px solid #3a5a8f;border-radius:12px;padding:7px 9px;box-shadow:0 8px 18px #0008;margin:4px 0 6px}
.cl-bulk>b{font-size:13px;margin-right:auto;font-variant-numeric:tabular-nums}
.cl-bulk .cl-btn{font-size:12px;padding:5px 9px}
.cl-bulk .sa{background:none;border:0;color:#9fc2ff;font-size:12px;font-weight:700;cursor:pointer;padding:2px 4px;text-decoration:underline}
.cl-fsall{background:none;border:0;color:#9fc2ff;font-size:12px;font-weight:700;cursor:pointer;padding:2px 4px;text-decoration:underline}
.cl-fempty{color:var(--mut);font-size:13px;padding:14px 4px;text-align:center}
.cl-nowl{font-size:13px;color:var(--mut);background:#0c172b;border:1px solid var(--line);border-radius:9px;padding:6px 10px;margin:2px 0 8px}
.cl-nowl b{color:var(--ink)}
.cl-bprev{display:flex;flex-direction:column;gap:3px;font-size:12.5px;color:var(--mut);max-height:180px;overflow:auto;margin-top:6px}
.cl-bprev div{display:flex;justify-content:space-between;gap:8px}.cl-bprev b{color:var(--ink);font-variant-numeric:tabular-nums}
.cl-root.mid .cl-spx{grid-auto-columns:minmax(0,1fr)!important;gap:5px 6px!important}
.cl-root.mid .cl-spx .cl-sc{font-size:11px;padding:3px 7px;gap:4px}.cl-root.mid .cl-spx .cl-sc .ic{font-size:15px}
.cl-root.phone .cl-modal .cl-opt b,.cl-root.phone .cl-modal .cl-opt small{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:1;overflow:hidden;white-space:normal}
.cl-root.phone .cl-modal .cl-opt{padding:7px 10px;font-size:13.5px}
.cl-root.phone .cl-modal .cl-opt .cl-est{flex:none}
.cl-root.phone .cl-pl .cl-chainl{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cl-root.phone .cl-pl .h b{font-size:14px}
.cl-root.phone .cl-pl .h .tg .cl-pilot{max-width:118px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
`;

/* ---------------- stiluri ---------------- */
function css() {
  if (document.getElementById("css-cerul-ui")) return;
  try { const sb = document.createElement("style"); sb.id = "css-cerul-ui-b"; sb.textContent = UIB_CSS; document.head.appendChild(sb); } catch (e) { /* fără stiluri UI-B */ }
  const st = document.createElement("style"); st.id = "css-cerul-ui";
  st.textContent = `
html.cl-on,html.cl-on body{overflow:hidden!important}
.cl-root{--bg:#0b1424;--panel:#111d33;--panel2:#0c172b;--line:#22324f;--line2:#2f4673;--ink:#e8f0ff;--mut:#9db0cf;--me:#ff8a4c;--op:#5fd3dc;--gold:#ffd35c;--ok:#5fd38a;--bad:#ff6b6b;--side:400px;--bot:150px;
  position:fixed;inset:0;z-index:32;display:grid;grid-template-rows:auto minmax(0,1fr) auto auto;color:var(--ink);font:14px/1.35 var(--body,system-ui),"Segoe UI",sans-serif;background:var(--bg);overflow:hidden;-webkit-tap-highlight-color:transparent}
.cl-root *{box-sizing:border-box}
.cl-root button{font-family:inherit;color:inherit}
.cl-root :focus-visible{outline:3px solid var(--gold);outline-offset:2px}
.cl-root .sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
/* ---- bara de sus ---- */
.cl-top{position:relative;z-index:6;display:flex;align-items:center;gap:12px;padding:8px 14px;min-height:64px;min-width:0;background:linear-gradient(#152440,#0f1b31);border-bottom:1px solid var(--line);box-shadow:0 6px 20px #0008}
.cl-tb{display:inline-flex;align-items:center;justify-content:center;gap:6px;background:#1a2b4a;border:1px solid var(--line2);border-radius:10px;padding:9px 13px;font-weight:700;font-size:14px;cursor:pointer;white-space:nowrap;transition:border-color .15s,transform .1s,background .15s;min-height:40px}
.cl-tb:hover{border-color:var(--gold)}.cl-tb:active{transform:scale(.95)}
.cl-tb.gold{background:linear-gradient(#ffd35c,#e9a92a);color:#2a1d00;border-color:#ffd35c}
.cl-tb.on{background:#ffd35c33;border-color:var(--gold)}
.cl-tb:disabled{opacity:.45;cursor:not-allowed}
.cl-tb .ic{font-size:16px;line-height:1}
.cl-co{display:flex;align-items:center;gap:10px;min-width:0;flex:0 1 auto}
.cl-av{width:44px;height:44px;border-radius:50%;flex:none;display:grid;place-items:center;overflow:hidden;background:#1c2a46;border:3px solid var(--c,var(--me));font-size:22px}
.cl-av svg{width:100%;height:100%;display:block}
.cl-co b{font-size:17px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block;max-width:220px}
.cl-co small{display:block;color:var(--mut);font-size:12px;white-space:nowrap}
.cl-stars{color:var(--gold);letter-spacing:1px;font-size:12px}
.cl-stat{background:var(--panel2);border:1px solid var(--line);border-radius:12px;padding:5px 12px;min-width:112px;flex:none}
.cl-stat small{display:block;color:var(--mut);font-size:11px;letter-spacing:.06em;text-transform:uppercase;white-space:nowrap}
.cl-stat b{font-size:19px;white-space:nowrap;font-variant-numeric:tabular-nums}
.cl-stat.neg{border-color:var(--bad);animation:clblink 1.2s ease-in-out infinite}
.cl-stat.neg small{color:#ffb3b3}
.cl-clock{display:flex;align-items:center;gap:10px;background:var(--panel2);border:1px solid #31507f;border-radius:14px;padding:5px 14px 5px 6px;flex:none}
.cl-ring{position:relative;width:44px;height:44px;flex:none}
.cl-ring svg{width:44px;height:44px;transform:rotate(-90deg)}
.cl-ring circle{fill:none;stroke-width:5}.cl-ring .bg{stroke:#26365a}.cl-ring .fg{stroke:var(--gold);stroke-linecap:round;transition:stroke-dashoffset .5s linear}
.cl-ring.night .fg{stroke:#8fb0ff}
.cl-ring i{position:absolute;inset:0;display:grid;place-items:center;font-style:normal;font-size:18px}
.cl-clock small{color:var(--mut);font-size:11px;letter-spacing:.05em;white-space:nowrap;display:block}
.cl-clock b{font-size:18px;white-space:nowrap;font-variant-numeric:tabular-nums}
.cl-clock.paused{border-color:var(--gold)}
.cl-clock.urgent b{color:var(--bad)}
.cl-opps{display:flex;gap:8px;min-width:0;flex:1 1 auto;overflow:hidden;padding:8px 4px;margin:-8px 0}
.cl-op{display:flex;align-items:center;gap:8px;padding:5px 12px 5px 6px;border-radius:12px;border:1px solid var(--line);background:#0c172b99;min-width:0;flex:0 1 auto;position:relative}
.cl-op .cl-av{width:36px;height:36px;border-width:2px;font-size:17px}
.cl-op b{display:block;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:150px}
.cl-op small{display:block;color:var(--mut);font-size:12px;white-space:nowrap}
.cl-op.frozen{border-color:#7fd6ff;box-shadow:0 0 14px #7fd6ff66}
.cl-op.out{opacity:.45;filter:grayscale(.8)}
.cl-op .rk{position:absolute;top:-6px;left:-4px;background:var(--gold);color:#2a1d00;font:800 10px/16px var(--body,system-ui);border-radius:8px;padding:0 5px}
.cl-btns{margin-left:auto;display:flex;gap:8px;flex:none}
.cl-menu{position:absolute;right:12px;top:calc(100% + 4px);z-index:20;background:#101d36f8;border:1px solid var(--line2);border-radius:12px;padding:6px;display:flex;flex-direction:column;gap:4px;box-shadow:0 18px 40px #000b;min-width:210px}
.cl-menu button{justify-content:flex-start;width:100%}
/* ---- mijloc ---- */
.cl-main{position:relative;min-height:0;display:grid;grid-template-columns:minmax(0,1fr) 8px var(--side)}
.cl-root.maponly .cl-main{grid-template-columns:minmax(0,1fr) 0 0}
.cl-root.spect .cl-bot,.cl-root.spect .cl-hsplit,.cl-root.spect .cl-ptabs{display:none}
.cl-root.maponly .cl-side,.cl-root.maponly .cl-split,.cl-root.maponly .cl-bot,.cl-root.maponly .cl-hsplit{display:none}
.cl-mapc{position:relative;min-width:0;min-height:0;overflow:hidden;container-type:inline-size;container-name:clmap;background:radial-gradient(ellipse at 50% 40%,#16365c,#0b1d36 70%)}
.cl-map{position:absolute;inset:0}
.cl-ov{position:absolute;inset:0;pointer-events:none;z-index:3}
.cl-ov>*{pointer-events:auto}
.cl-split{cursor:col-resize;background:linear-gradient(90deg,#0b1424,#1a2b4a,#0b1424);position:relative;touch-action:none}
.cl-split::after{content:"";position:absolute;left:2px;top:50%;width:4px;height:44px;margin-top:-22px;border-radius:2px;background:#4d6ea8}
.cl-split:hover::after,.cl-split.drag::after{background:var(--gold)}
.cl-hsplit{height:8px;cursor:row-resize;background:linear-gradient(#0b1424,#1a2b4a,#0b1424);position:relative;touch-action:none}
.cl-hsplit::after{content:"";position:absolute;top:2px;left:50%;height:4px;width:44px;margin-left:-22px;border-radius:2px;background:#4d6ea8}
.cl-hsplit:hover::after,.cl-hsplit.drag::after{background:var(--gold)}
.cl-side{min-height:0;display:flex;flex-direction:column;background:var(--panel);border-left:1px solid var(--line);container-type:inline-size}
.cl-tabs{display:flex;border-bottom:1px solid var(--line);flex:none;overflow-x:auto;scrollbar-width:none}
.cl-tabs button{flex:1 1 auto;border:0;background:transparent;padding:12px 6px;font-weight:700;font-size:14px;color:var(--mut);cursor:pointer;white-space:nowrap}
.cl-tabs button sup{font-size:10.5px;background:#22324f;border-radius:8px;padding:0 5px;margin-left:3px;color:var(--ink);vertical-align:2px}
@container (max-width:470px){.cl-tabs button:not(.on) .tl{display:none}.cl-tabs button{padding:12px 4px}}
.cl-tabs button:hover{color:var(--ink)}
.cl-tabs button.on{color:var(--ink);box-shadow:inset 0 -3px var(--me)}
.cl-pane{flex:1;min-height:0;overflow:auto;padding:10px;display:flex;flex-direction:column;gap:9px;scrollbar-width:thin}
.cl-pane:focus{outline:none}
/* carduri de avion */
.cl-pl{background:var(--panel2);border:1px solid var(--line);border-radius:12px;padding:10px 12px;transition:border-color .2s,box-shadow .2s;cursor:pointer}
.cl-pl:hover{border-color:#3d5a8a}
.cl-pl.sel{border-color:var(--gold);box-shadow:0 0 0 1px var(--gold)}
.cl-pl.ready{border-color:#5fd38a88;box-shadow:0 0 18px #5fd38a22}
.cl-pl.frz{border-color:#7fd6ff;background:linear-gradient(160deg,#16314a,#0c172b)}
.cl-pl .h{display:flex;justify-content:space-between;align-items:center;gap:6px}
.cl-pl .h b{font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;min-width:0}
.cl-pl .r .pi{flex:none;display:flex;align-items:center;line-height:0;margin-right:6px}.cl-pl .r .pi svg{display:block}
.cl-pl .cl-chainl.ls{white-space:normal}
.cl-pl .h b em{font-style:normal;color:var(--mut);font-weight:600;font-size:13px}
.cl-tag{font-size:11.5px;padding:2px 8px;border-radius:999px;background:#22324f;color:#c4d3ea;white-space:nowrap;flex:none}
.cl-tag.ok{background:#173a2a;color:var(--ok)}.cl-tag.bad{background:#4a1d1d;color:#ffb3b3}
.cl-tag.pil{background:#3a2f12;color:var(--gold)}.cl-tag.ice{background:#163a52;color:#9be2ff}
.cl-bar{height:9px;border-radius:5px;background:#22324f;margin:7px 0 5px;overflow:hidden}
.cl-bar i{display:block;height:100%;border-radius:5px;background:linear-gradient(90deg,var(--me),#ffb36b);transition:width .6s ease}
.cl-bar.air i{background:linear-gradient(90deg,#5fd3dc,#9be8ee)}
.cl-bar.full i{background:linear-gradient(90deg,#3fbf6f,#8de6a8)}
.cl-pl .r{display:flex;justify-content:space-between;align-items:center;gap:8px;color:var(--mut);font-size:13px;min-height:30px}
.cl-pl .r .tx{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cl-pl .h .tg{display:flex;gap:5px;align-items:center;flex:none}
.cl-pl .acts{display:flex;gap:6px;align-items:center;flex:none}
.cl-go{border:0;background:linear-gradient(#5fd38a,#2fa862);color:#04210f!important;border-radius:9px;padding:7px 13px;font-weight:800;font-size:14px;cursor:pointer;white-space:nowrap;box-shadow:0 3px 10px #2fa86255;transition:transform .1s,filter .15s}
.cl-go:hover{filter:brightness(1.1)}.cl-go:active{transform:scale(.95)}
.cl-go:disabled{filter:grayscale(1);opacity:.5;cursor:not-allowed}
.cl-go.big{font-size:16px;padding:10px 18px}
.cl-pilot{border:1px solid var(--line2);background:#0f1d36;border-radius:999px;padding:3px 9px;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;color:var(--mut)!important}
.cl-pilot.on{background:#3a2f12;border-color:#ffd35c88;color:var(--gold)!important}
.cl-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;border:1px solid var(--line2);background:#1a2b4a;border-radius:9px;padding:7px 12px;font-weight:700;font-size:13px;cursor:pointer;white-space:nowrap;transition:border-color .15s,transform .1s;line-height:1.15}
.cl-btn:hover:not(:disabled){border-color:var(--gold)}.cl-btn:active:not(:disabled){transform:scale(.96)}
.cl-btn:disabled{opacity:.45;cursor:not-allowed}
.cl-btn.gold{background:linear-gradient(#ffd35c,#e9a92a);color:#2a1d00!important;border-color:#ffd35c}
.cl-btn.red{background:linear-gradient(#ff8a7a,#d94a3a);color:#2a0303!important;border-color:#ff6b6b}
.cl-btn.ghost{background:transparent}
.cl-btn.sm{padding:4px 9px;font-size:12px;border-radius:8px}
.cl-btn.on{border-color:var(--gold);background:#2d2a14;box-shadow:inset 0 0 0 1px var(--gold)}
.cl-x{border:0;background:#ffffff14;width:30px;height:30px;border-radius:8px;cursor:pointer;font-size:15px;flex:none}
.cl-x:hover{background:#ffffff2a}
.cl-h{display:flex;align-items:center;justify-content:space-between;gap:8px;color:var(--mut);font-size:11.5px;letter-spacing:.08em;text-transform:uppercase;font-weight:700}
.cl-empty{color:var(--mut);text-align:center;padding:16px 8px;font-size:13.5px;line-height:1.5}
.cl-sum{display:flex;gap:6px;flex-wrap:wrap}
.cl-sum span{background:#0c172b;border:1px solid var(--line);border-radius:999px;padding:3px 10px;font-size:12.5px;color:var(--mut)}
.cl-sum span b{color:var(--ink)}
.cl-root.mid .cl-sum{gap:4px}.cl-root.mid .cl-sum span{padding:2px 8px;font-size:12px}
/* rute */
.cl-rt{background:var(--panel2);border:1px solid var(--line);border-radius:12px;padding:9px 12px;cursor:pointer;display:flex;flex-direction:column;gap:4px}
.cl-rt:hover{border-color:#3d5a8a}.cl-rt.sel{border-color:var(--gold)}
.cl-rt .h{display:flex;justify-content:space-between;gap:8px;align-items:center}
.cl-rt .h b{font-size:14.5px}
.cl-rt .m{display:flex;gap:10px;flex-wrap:wrap;color:var(--mut);font-size:12.5px}
.cl-rt .m b{color:var(--ink)}
.pos{color:var(--ok)!important}.neg{color:var(--bad)!important}
/* rapoarte */
.cl-chart{background:var(--panel2);border:1px solid var(--line);border-radius:12px;padding:10px}
.cl-chart svg{width:100%;height:auto;display:block}
.cl-chart text{font:600 11px var(--body,system-ui);fill:#9db0cf}
.cl-leg{display:flex;gap:12px;font-size:12px;color:var(--mut);margin-top:4px;flex-wrap:wrap}
.cl-leg i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:4px;vertical-align:-1px}
.cl-best{display:grid;grid-template-columns:minmax(0,1fr) 110px auto;gap:6px 8px;align-items:center;font-size:13px}
.cl-best .bb{height:8px;border-radius:4px;background:#22324f;overflow:hidden}.cl-best .bb i{display:block;height:100%;background:var(--ok)}
.cl-best .bb i.n{background:var(--bad)}
/* magazin */
.cl-shop{background:var(--panel2);border:1px solid var(--line);border-radius:12px;padding:10px 12px;display:flex;flex-direction:column;gap:6px}
.cl-shop .top{display:flex;align-items:center;gap:10px}
.cl-shop .art{display:flex;align-items:center;justify-content:center;width:120px;height:50px;flex:none;background:radial-gradient(ellipse at 50% 80%,#1d3557,transparent 70%)}
.cl-shop .art svg{height:50px;width:auto;max-width:100%}
.cl-shop .nm{flex:1;min-width:0;display:flex;flex-direction:column;line-height:1.2}
.cl-shop .nm b{font-size:16px}.cl-shop .nm small{color:var(--mut);font-size:12px}.cl-shop .nm .pr{color:var(--gold);font-weight:800;font-size:14px}
.cl-shop .role{font-size:13px;color:#dbe6fa;font-weight:600}
.cl-pspec{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px;font-size:12px;color:var(--mut)}
.cl-pspec span{background:#0c172b;border:1px solid var(--line);border-radius:8px;padding:4px 8px;line-height:1.25}
.cl-pspec b{color:var(--ink);font-size:13.5px;margin-right:4px}.cl-pspec i{display:block;font-style:normal;font-size:11px;color:#8193b1}
.cl-fitr{display:flex;flex-wrap:wrap;gap:4px 6px;align-items:center;font-size:12.5px;color:var(--mut)}
.cl-fitr .lb{color:#c9d6ee;font-weight:700}
.cl-fitr .ch{display:inline-flex;gap:6px;align-items:baseline;background:#0c172b;border:1px solid var(--line);border-radius:999px;padding:2px 9px;max-width:100%}
.cl-fitr .ch .rn{color:var(--ink);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0}
.cl-explain{display:flex;flex-direction:column;gap:4px;font-size:12.5px;color:var(--mut);background:#0c172b;border:1px solid var(--line);border-radius:10px;padding:7px 10px;line-height:1.35}
.cl-explain b{color:var(--ink)}
.cl-legbox{display:grid;grid-template-columns:auto minmax(0,1fr);gap:4px 10px;font-size:12.5px;color:var(--mut);background:#0c172b;border:1px solid var(--line);border-radius:10px;padding:8px 10px;line-height:1.3}
.cl-legbox>b{color:var(--ink);white-space:nowrap}
.cl-sum .cl-qbtn{cursor:pointer;background:#14294a;border:1px solid #2a4570;border-radius:999px;padding:3px 10px;font-size:12.5px;color:#c9d6ee;font-weight:700;font-family:inherit}
.cl-sum .cl-qbtn.on{background:#22406e;color:#fff}
.cl-buyrow{display:flex;flex-direction:column;gap:2px;border-top:1px solid var(--line);padding-top:6px}
.cl-buyrow .cl-btn{width:100%}
.cl-buyrow small{font-size:12px;color:#c9d6ee;line-height:1.3}.cl-buyrow small.cl-why{color:var(--mut)}
.cl-pmen{display:flex;flex-direction:column;gap:6px}
.cl-pmen .cl-opt small{white-space:normal}
.cl-route3{color:var(--ink);font-weight:600}
.cl-chainl{font-size:12.5px;color:var(--mut);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px}
.cl-chainh{font-size:12.5px;color:var(--mut);margin-top:10px;line-height:1.35}.cl-chainh b{color:var(--ink)}
.cl-pmin{background:#0c172b;border:1px solid var(--line);border-radius:10px;padding:10px 12px;margin:6px 0}
.cl-pmin .hd{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;font-size:14px}
.cl-pmin .trk{position:relative;margin:10px 0 2px}.cl-pmin input{width:100%;accent-color:#ffd35c}
.cl-pmin .be{position:absolute;top:-4px;width:3px;height:26px;background:#ff6b6b;border-radius:2px;pointer-events:none;transform:translateX(-1px)}
.cl-pmin .sc{display:flex;justify-content:space-between;font-size:12px;color:var(--mut)}.cl-pmin .bel{color:#ff9a9a;font-weight:700}
.cl-modal.edge{place-items:center end;background:linear-gradient(90deg,transparent 40%,#02070f99);backdrop-filter:none;pointer-events:none}
.cl-modal.edge .cl-mcard{pointer-events:auto;width:min(440px,100%);max-height:calc(100% - 20px)}
.cl-root.phone .cl-modal.edge{place-items:end center;background:linear-gradient(180deg,transparent 35%,#02070f99)}
.cl-root.phone .cl-modal.edge .cl-mcard{max-height:56%}
.cl-eye{display:none;margin-left:6px;padding:0 6px;border-radius:8px;background:#14294a;border:1px solid #2a4570;font-size:14px;cursor:pointer;line-height:1.5;vertical-align:middle}
.cl-root.phone .cl-eye{display:inline-block}
.cl-root.phone .cl-pvhint{display:none}
.cl-apx{display:block;font-size:11.5px;color:#8193b1;line-height:1.3;margin:-3px 0 2px}
.cl-tog{display:flex;gap:8px;align-items:center;font-size:13px;color:var(--mut);margin-top:8px;cursor:pointer}
.cl-tog input{width:18px;height:18px;accent-color:#ffd35c}
.cl-specs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:4px;font-size:11.5px;color:var(--mut);text-align:center}
.cl-specs b{display:block;color:var(--ink);font-size:13px}
.cl-shop .btns{display:flex;gap:6px;flex-wrap:wrap}
.cl-shop .btns .cl-btn{flex:1}
.cl-used{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:8px;align-items:center;background:var(--panel2);border:1px solid var(--line);border-radius:10px;padding:7px 10px;font-size:13px}
.cl-used svg{width:64px;height:auto;display:block}
.cl-used small{display:block;color:var(--mut)}
.cl-seg{display:flex;gap:4px;background:#0c172b;border:1px solid var(--line);border-radius:10px;padding:3px}
.cl-seg button{flex:1;border:0;background:transparent;border-radius:8px;padding:6px 8px;font-weight:700;font-size:13px;color:var(--mut);cursor:pointer}
.cl-seg button.on{background:#22324f;color:var(--ink)}
.cl-seg button{white-space:nowrap}
.cl-seg button sup{font-size:10.5px;background:#22324f;border-radius:8px;padding:0 5px;color:var(--ink);vertical-align:2px}
.cl-seg button.on sup{background:#33476b}
/* investiții */
.cl-inv{background:var(--panel2);border:1px solid var(--line);border-radius:12px;padding:10px 12px;display:flex;flex-direction:column;gap:7px}
.cl-inv .h{display:flex;align-items:center;gap:10px}
.cl-inv .h .ic{width:38px;height:38px;flex:none;border-radius:10px;display:grid;place-items:center;font-size:20px;background:linear-gradient(160deg,#22406e,#152a4a);border:1px solid var(--line2)}
.cl-inv .h .t{flex:1;min-width:0}
.cl-inv .h b{display:block;font-size:15px}
.cl-inv .h small{display:block;color:var(--mut);font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cl-inv .fx{display:flex;flex-wrap:wrap;gap:4px 6px;font-size:12px;color:#c9d6ee}
.cl-inv .fx span{background:#14294a;border:1px solid #2a4570;border-radius:999px;padding:2px 9px}
.cl-inv .fx em{font-style:normal;color:var(--mut);align-self:center}
.cl-inv .ft{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.cl-inv .ft .cl-btn{flex:none}
.cl-inv .rows{display:flex;flex-direction:column;gap:5px}
.cl-inv .er{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:13.5px;font-weight:700}
.cl-inv .er .cl-btn{padding:5px 10px;font-size:12.5px}
.cl-inv .chips{display:flex;flex-wrap:wrap;gap:5px}
.cl-chip{border:1px solid var(--line2);background:#0f1d36;border-radius:999px;padding:3px 10px;font-size:12.5px;font-weight:700;color:var(--mut);cursor:pointer}
.cl-chip.on{border-color:var(--gold);color:var(--ink);background:#2d2a14}
.cl-chip.have{border-color:#3fbf6f88;color:var(--ok);background:#173a2a;cursor:default}
.cl-why{color:var(--mut);font-size:12px}
.cl-done{color:var(--ok);font-weight:800;font-size:13px}
.cl-lvl{display:flex;gap:4px;flex:none}
.cl-lvl i{width:10px;height:10px;border-radius:50%;background:#22324f;border:1px solid #3a5480}
.cl-lvl i.on{background:var(--gold);border-color:var(--gold);box-shadow:0 0 6px #ffd35c88}
/* bursa */
.cl-shr{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:8px;align-items:center;background:var(--panel2);border:1px solid var(--line);border-radius:12px;padding:8px 10px}
.cl-shr .cl-av{width:38px;height:38px;border-width:2px}
.cl-shr b{display:block;font-size:14px}.cl-shr small b{display:inline;font-size:inherit}.cl-shr small{color:var(--mut);font-size:12px}
.cl-shr .own{height:6px;border-radius:3px;background:#22324f;margin-top:4px;overflow:hidden;display:flex}
.cl-shr .own i{display:block;height:100%}
/* ---- jos ---- */
.cl-bot{display:grid;grid-template-columns:minmax(330px,430px) minmax(0,1fr) minmax(300px,470px);gap:14px;padding:10px 16px;height:var(--bot);min-height:0;background:linear-gradient(#0f1b31,#0b1424);border-top:1px solid var(--line)}
.cl-box{background:var(--panel2);border:1px solid var(--line);border-radius:14px;padding:8px 12px;position:relative;min-width:0;min-height:0;display:flex;flex-direction:column;overflow:hidden}
.cl-box>.cl-h{flex:none;margin-bottom:2px;min-height:24px}
.cl-cardsx{display:flex;gap:5px;text-transform:none;letter-spacing:0}
.cl-cardsx .cl-btn{padding:3px 8px;font-size:12px}
.cl-boxb{flex:1;min-height:0;display:flex;gap:8px;align-items:stretch;overflow-x:auto;overflow-y:hidden;scrollbar-width:thin;padding-top:7px}
.cl-box>.cl-h>span:first-child{white-space:nowrap}
.cl-rc{position:relative;flex:0 0 auto;width:clamp(56px,4vw,74px);border-radius:10px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;border:2px solid #ffffff2a;color:#fff;box-shadow:inset 0 1px 0 #ffffff33,0 4px 10px #0008;min-height:60px;max-height:96px;transition:transform .15s}
.cl-rc .ic{font-size:26px;line-height:1.05}
.cl-rc .ic svg{width:30px;height:30px}
.cl-rc span{font-size:11px;font-weight:800;text-shadow:0 1px 2px #0009}
.cl-rc em{position:absolute;top:-8px;right:-8px;background:#fff;color:#111;border-radius:999px;font-style:normal;font-weight:900;font-size:13px;padding:1px 7px;box-shadow:0 2px 6px #0008}
.cl-rc.zero{opacity:.38;filter:saturate(.4)}
.cl-rc.joker{background:linear-gradient(135deg,#ffd35c,#ff6fa8,#5fd3dc)}.cl-rc.joker span{color:#2a1d00;text-shadow:none}
.cl-rc.bump{animation:clbump .6s cubic-bezier(.2,1.7,.4,1)}
@keyframes clbump{40%{transform:scale(1.18) translateY(-4px)}}
.cl-cbtns{display:flex;flex-direction:column;gap:6px;justify-content:center;flex:none;margin-left:auto}
.cl-pm{flex:1 1 0;min-width:190px;max-width:330px;background:#132544;border:1px dashed #4d6ea8;border-radius:12px;padding:5px 10px;font-size:12.5px;display:flex;flex-direction:column;justify-content:space-between;gap:2px;position:relative;cursor:pointer}
.cl-pm.can{border-style:solid;border-color:var(--gold);box-shadow:0 0 16px #ffd35c22}
.cl-pm>*{flex:none}
.cl-pm b{font-size:14px;display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding-right:24px}
.cl-pm .st{color:var(--mut);font-size:11.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cl-pm .mt{color:#ffb3b3;font-weight:700;font-size:12px;white-space:nowrap}
.cl-pm .need{display:flex;gap:3px;flex-wrap:wrap;font-size:16px;line-height:1.1}
.cl-pm .need i{font-style:normal}
.cl-pm .need i.x{opacity:.3;filter:grayscale(1)}
.cl-pm .need i.j{filter:drop-shadow(0 0 3px #ffd35c)}
.cl-pm .ft{display:flex;justify-content:space-between;align-items:center;gap:6px;color:var(--mut);min-width:0}
.cl-pm .ft .need{min-width:0;flex-wrap:nowrap;overflow:hidden}
.cl-pm .ft .cl-btn{flex:none}
.cl-pm .del{position:absolute;right:5px;top:5px;width:22px;height:22px;border-radius:6px;border:0;background:#ffffff10;cursor:pointer;font-size:11px;color:var(--mut)}
.cl-pm .del:hover{background:#ff6b6b44;color:#fff}
.cl-pm .del:disabled{opacity:.35;cursor:not-allowed;background:#ffffff08;color:var(--mut)}
.cl-pm.add{opacity:.75;display:grid;place-items:center;text-align:center;border-style:dashed;background:transparent}
.cl-pm.add:hover{opacity:1;border-color:var(--gold)}
.cl-pm.add:disabled{cursor:not-allowed;opacity:.4}
.cl-sc{position:relative;flex:0 0 auto;width:104px;border-radius:12px;padding:6px 8px;font-size:12px;font-weight:700;color:#fff;background:linear-gradient(160deg,#2b3f7a,#1a2550);border:2px solid #7d9cff66;display:flex;flex-direction:column;gap:2px;text-align:left;cursor:pointer;line-height:1.2}
.cl-sc .ic{font-size:20px;line-height:1}
.cl-root.mid .cl-sc{line-height:1.12;padding:5px 7px}.cl-root.mid .cl-sc .ic{font-size:17px}
.cl-sc u{color:var(--gold);font-weight:700;margin-top:auto}
.cl-sc.ice{background:linear-gradient(160deg,#2f8fc4,#174a75);border-color:#9be2ff77}.cl-sc.fire{background:linear-gradient(160deg,#ff8a4c,#a83a1a);cursor:default}
.cl-sc:disabled{filter:saturate(.35) brightness(.8);cursor:not-allowed}
.cl-sc:disabled u{color:#c9d6ee;text-decoration:none;font-weight:600}
.cl-sc:not(:disabled):hover{transform:translateY(-3px);box-shadow:0 6px 16px #0009}
.cl-spx{display:grid!important;grid-template-columns:none!important;text-align:left!important;grid-template-rows:repeat(2,minmax(0,1fr));grid-auto-flow:column;grid-auto-columns:minmax(132px,1fr);gap:6px 8px!important;align-items:stretch}
.cl-root .cl-spx .cl-sc{width:auto!important;flex-direction:row;align-items:center;gap:6px;padding:3px 9px;font-size:12px;line-height:1.15;border-radius:10px;min-height:0;white-space:normal}
.cl-spx .cl-sc .ic{font-size:17px;flex:none}
.cl-spx .cl-sc u{display:none}
.cl-spx .cl-sc em{top:-7px;right:-6px;font-size:11px}
.cl-spx .cl-sc:not(:disabled):hover{transform:translateY(-1px)}
.cl-sc em{position:absolute;top:-8px;right:-8px;background:#fff;color:#111;border-radius:999px;font-style:normal;font-weight:900;font-size:12px;padding:0 6px}
/* ---- hartă: suprapuneri ---- */
.cl-cons{position:absolute;left:14px;top:14px;display:flex;gap:10px;align-items:flex-start;max-width:min(460px,calc(100% - 90px));transition:opacity .4s,transform .4s;z-index:4}
.cl-cons.hide{opacity:0;transform:translateY(-8px);pointer-events:none}
.cl-cons .cl-av{border-color:var(--gold);cursor:pointer;width:48px;height:48px;background:#fffbe8}
.cl-bubble{position:relative;background:#fffbe8;color:#2a2410;border-radius:14px;padding:9px 34px 9px 12px;font-size:14px;line-height:1.4;box-shadow:0 6px 18px #0008}
.cl-bubble::before{content:"";position:absolute;left:-7px;top:16px;border:7px solid transparent;border-left:0;border-right-color:#fffbe8}
.cl-bubble b{color:#7a4a00}
.cl-bubble .cl-x{position:absolute;right:4px;top:4px;width:24px;height:24px;background:#0000000d;color:#5a4a20;font-size:12px}
.cl-consmini{position:absolute;left:14px;top:14px;width:42px;height:42px;border-radius:50%;border:2px solid var(--gold);background:#fffbe8;cursor:pointer;overflow:hidden;padding:0;z-index:4}
.cl-consmini svg{width:100%;height:100%}
.cl-legend{position:absolute;left:14px;bottom:14px;background:#0f1d36e6;border:1px solid var(--line2);border-radius:10px;padding:6px 11px;font-size:12px;color:var(--mut);display:flex;gap:4px 10px;flex-wrap:wrap;max-width:min(560px,45%)}
.cl-legend i{display:inline-block;width:14px;height:4px;border-radius:2px;vertical-align:3px;margin-right:4px}
.cl-mapbtns{position:absolute;right:14px;top:14px;display:flex;flex-direction:column;gap:6px;z-index:4}
.cl-mapbtns .cl-tb{width:42px;height:42px;padding:0;background:#0f1d36e6}
.cl-evs{position:absolute;left:50%;top:12px;transform:translateX(-50%);display:flex;gap:6px;flex-wrap:wrap;justify-content:center;max-width:60%;z-index:3}
@container clmap (max-width:1320px){.cl-root:not(.phone) .cl-ov.hascons .cl-evs{left:490px;transform:none;justify-content:flex-start;max-width:calc(100% - 560px)}}
@container clmap (max-width:900px){.cl-root:not(.phone) .cl-ov.hascons .cl-evs{left:auto;right:70px;top:14px;justify-content:flex-end;max-width:calc(100% - 560px)}.cl-root:not(.phone) .cl-ov.hascons .cl-ev span{display:none}.cl-root:not(.phone) .cl-ov.hascons .cl-ev.start .sp{display:inline}}
.cl-ev{display:flex;align-items:center;gap:6px;padding:4px 11px 4px 7px;border-radius:999px;background:#0f1d36e6;border:1px solid var(--line2);font-size:12.5px;font-weight:700;cursor:pointer;white-space:nowrap}
.cl-ev.rau{border-color:#ff6b6b88}.cl-ev.bun{border-color:#5fd38a88}
.cl-ev small{color:var(--mut);font-weight:600}
.cl-mcard .cl-evcard p{margin:9px 0;font-size:14px;line-height:1.45}.cl-evcard .pos{color:var(--good,#5fd38a)}
.cl-ev span{max-width:460px;overflow:hidden;text-overflow:ellipsis}.cl-ev .ef{font-style:normal;font-weight:600;color:#c9d6ea}
.cl-ready{position:absolute;right:14px;top:66px;display:flex;flex-direction:column;gap:6px;align-items:flex-end;z-index:4;max-height:calc(100% - 80px);overflow:hidden}
.cl-ready .cl-go{display:flex;align-items:center;gap:8px;box-shadow:0 6px 18px #0009}
.cl-ready .cl-go small{font-weight:700;opacity:.8}
.cl-pop{position:absolute;width:320px;max-width:calc(100% - 20px);background:#0f1d36f4;border:1px solid #3a5a8f;border-radius:14px;padding:12px 14px;box-shadow:0 14px 34px #000b;z-index:6;display:flex;flex-direction:column;gap:6px;animation:clin .22s cubic-bezier(.2,1.3,.4,1) both;backdrop-filter:blur(4px)}
@keyframes clin{from{transform:translateY(10px) scale(.97);opacity:0}}
.cl-pop h4{margin:0;font-size:16px;display:flex;align-items:center;gap:6px;padding-right:30px}
.cl-pop .cl-x{position:absolute;right:8px;top:8px}
.cl-pop .row{display:flex;justify-content:space-between;gap:8px;color:var(--mut);font-size:13.5px}
.cl-pop .row b{color:var(--ink);text-align:right}
.cl-pres{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin:3px 0}
.cl-pres button{border:1px solid var(--line2);background:#1a2b4a;border-radius:10px;padding:6px 7px;font-size:12.5px;font-weight:700;cursor:pointer;text-align:left;line-height:1.25}
.cl-pres button b{display:block;font-size:14px}
.cl-pres button:hover{border-color:#5b7dbb}
.cl-pres button.on{border-color:var(--gold);box-shadow:inset 0 0 0 1px var(--gold)}
.cl-pin{display:flex;gap:6px;align-items:center}
.cl-pin input[type=number]{width:96px;background:#08111f;border:1px solid var(--line2);border-radius:8px;color:var(--ink);padding:6px 8px;font:700 15px var(--body,system-ui)}
.cl-pin input[type=range]{flex:1;accent-color:var(--gold);min-width:60px}
.cl-dir{display:flex;gap:4px}
.cl-dir button{flex:1;border:1px solid var(--line2);background:transparent;border-radius:8px;padding:4px 6px;font-size:12px;font-weight:700;cursor:pointer;color:var(--mut)}
.cl-dir button.on{background:#22324f;color:var(--ink);border-color:#5b7dbb}
.cl-est{display:inline-flex;flex-direction:column;align-items:flex-end;gap:0;flex:none;text-align:right;line-height:1.2;font-variant-numeric:tabular-nums}
.cl-est b{font-size:14px;font-weight:800}
.cl-est small{color:var(--mut);font-size:12px;font-weight:600}
.cl-pop .row.cl-erow{align-items:center;background:#0c172b;border:1px solid var(--line);border-radius:9px;padding:5px 9px;color:var(--mut)}
.cl-pop .cl-est{flex-direction:row;align-items:baseline;gap:8px}
.cl-fit{font-size:13px;color:#c9d6ee;background:#0c172b;border:1px solid var(--line2);border-radius:10px;padding:7px 11px}
.cl-fit::before{content:"ℹ️ "}
.cl-now{font-style:normal;font-size:11px;font-weight:700;color:var(--gold);background:#3a2f12;border-radius:999px;padding:1px 7px;margin-left:4px;vertical-align:1px}
.cl-mut{color:var(--mut)}
.cl-pz{position:absolute;left:50%;top:84px;transform:translateX(-50%);z-index:5;pointer-events:none}
.cl-pz:empty{display:none}
.cl-root.phone .cl-pz{top:50%;transform:translate(-50%,-50%)}
.cl-root.phone .cl-pzc{padding:8px 14px;gap:3px}
.cl-root.phone .cl-pzc b{font-size:18px}
.cl-root.phone .cl-pzc span{font-size:12.5px}
.cl-pzc{pointer-events:auto;display:flex;flex-direction:column;align-items:center;gap:6px;text-align:center;background:#0f1d36f2;border:1.5px solid var(--gold);border-radius:16px;padding:14px 22px;box-shadow:0 16px 40px #000c;max-width:min(380px,calc(100vw - 32px))}
.cl-pzc b{font:900 22px var(--display,system-ui);letter-spacing:.04em;color:var(--gold);text-transform:uppercase}
.cl-pzc b small{font:700 13px var(--body,system-ui);letter-spacing:0;text-transform:none;color:var(--mut)}
.cl-pzc span{color:#c9d6ee;font-size:14px}
.cl-pzc .cl-btn{margin-top:4px;padding:7px 16px;font-size:14px}
.cl-ev.start{border-color:#ffd35caa;background:linear-gradient(90deg,#3a2f12f0,#1d2a17f0);color:#ffe9a8}
.cl-ev.start small{color:#e9cf86}
.cl-sharebar{height:8px;border-radius:4px;background:#22324f;overflow:hidden;display:flex}
.cl-sharebar i{display:block;height:100%}
/* toasturi */
.cl-ov .cl-toasts{position:absolute;right:68px;bottom:14px;z-index:7;display:flex;flex-direction:column;gap:6px;align-items:flex-end;pointer-events:none;width:min(440px,calc(100% - 90px))}
.cl-toast{background:#101d36f5;border:1px solid var(--line2);border-left:4px solid var(--op);border-radius:12px;padding:8px 14px;font-size:14px;box-shadow:0 10px 26px #000b;animation:cltin .3s cubic-bezier(.2,1.3,.4,1) both;max-width:100%;display:flex;gap:8px;align-items:flex-start}
.cl-toast i{font-style:normal;font-size:18px;line-height:1.1}
.cl-toast.good{border-left-color:var(--ok)}.cl-toast.bad{border-left-color:var(--bad)}.cl-toast.gold{border-left-color:var(--gold)}
.cl-toast.out{animation:cltout .35s ease both}
@keyframes cltin{from{opacity:0;transform:translateY(-12px) scale(.96)}}
@keyframes cltout{to{opacity:0;transform:translateY(-8px)}}
.cl-banner{position:absolute;left:50%;top:26%;transform:translateX(-50%);z-index:29;pointer-events:none;padding:12px 26px;border-radius:16px;font:900 clamp(18px,2.4vw,30px) var(--display,system-ui);letter-spacing:.04em;text-transform:uppercase;text-align:center;width:max-content;max-width:min(820px,calc(100% - 24px));box-sizing:border-box;animation:clban 4.2s ease both;color:#fff;background:linear-gradient(90deg,#0f3550,#2a7bb0,#0f3550);box-shadow:0 12px 34px #000a}
.cl-banner small{display:block;font:700 14px var(--body,system-ui);letter-spacing:0;text-transform:none;opacity:.92;margin-top:2px}
.cl-banner.gold{background:linear-gradient(90deg,#6a4a00,#e0a800,#6a4a00)}.cl-banner.red{background:linear-gradient(90deg,#7a1010,#d62a2a,#7a1010)}
@keyframes clban{0%{opacity:0;transform:translate(-50%,-20px) scale(.9)}8%{opacity:1;transform:translate(-50%,0) scale(1.04)}14%{transform:translate(-50%,0) scale(1)}85%{opacity:1}100%{opacity:0;transform:translate(-50%,-10px)}}
@keyframes clblink{50%{box-shadow:0 0 16px #ff6b6b88}}
/* modale */
.cl-modal{position:absolute;inset:0;z-index:40;display:grid;place-items:center;padding:14px;background:#02070fcc;backdrop-filter:blur(3px);animation:clfade .2s both}
@keyframes clfade{from{opacity:0}}
.cl-mcard{position:relative;width:min(620px,100%);max-height:calc(100% - 8px);overflow:auto;background:linear-gradient(180deg,#172a4a,#0f1b31);border:1.5px solid #ffd35c99;border-radius:18px;padding:16px 18px;box-shadow:0 30px 80px #000d;display:flex;flex-direction:column;gap:12px;animation:clin .3s cubic-bezier(.2,1.3,.4,1) both}
.cl-mcard h2{margin:0;font:900 22px var(--display,system-ui);letter-spacing:.03em;text-transform:uppercase;color:var(--gold);padding-right:34px}
.cl-mcard .cl-x{position:absolute;right:12px;top:12px}
.cl-mcard p{margin:0;color:#c9d6ee;line-height:1.45}
.cl-mbtns{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap}
.cl-mbtns .cl-btn{padding:10px 18px;font-size:15px}
.cl-list{display:flex;flex-direction:column;gap:6px}
.cl-opt{display:flex;align-items:center;gap:10px;text-align:left;border:1.5px solid var(--line2);background:#0c172b;border-radius:12px;padding:9px 12px;cursor:pointer;font-size:14px}
.cl-opt:hover:not(:disabled){border-color:#5b7dbb}.cl-opt.on{border-color:var(--gold);background:#2d2a14}
.cl-opt:disabled{opacity:.45;cursor:not-allowed}
.cl-opt small{display:block;color:var(--mut);font-size:12.5px}
.cl-opt .grow{flex:1;min-width:0}
.cl-gis{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px}
.cl-gis .cl-rc{width:auto;min-height:84px;cursor:pointer}
.cl-gis .cl-rc.on{outline:3px solid var(--gold);outline-offset:2px}
.cl-gis .cl-rc .ct{position:absolute;bottom:-9px;left:50%;transform:translateX(-50%);background:var(--gold);color:#2a1d00;border-radius:999px;font-weight:900;font-size:12px;padding:0 7px}
/* scene */
.cl-scene{position:absolute;inset:0;z-index:35;pointer-events:none}
.cl-scene>*{pointer-events:auto}
.cl-scene:empty{display:none}
.cl-fb{position:absolute;inset:0;display:grid;place-items:center;background:#02070fe6;padding:16px;overflow:auto}
.cl-endbar{position:absolute;left:16px;bottom:16px;z-index:38;display:flex;gap:8px;flex-wrap:wrap}
.cl-endbar .cl-tb{box-shadow:0 8px 24px #000a}
.cl-frz{position:absolute;inset:0;z-index:28;pointer-events:none;box-shadow:inset 0 0 120px #7fd6ffaa;border:3px solid #9be2ff88}
.cl-frz b{position:absolute;left:50%;top:84px;transform:translateX(-50%);background:#0e3552ee;border:1px solid #9be2ff;border-radius:999px;padding:6px 16px;font-size:15px;color:#dff6ff;white-space:nowrap}
/* telefon */
.cl-ptabs{display:none}
.cl-handle{display:none}
.cl-root.phone{--bot:0px}
.cl-root.phone .cl-top{flex-wrap:wrap;gap:6px;padding:6px 8px;min-height:0}
.cl-root.phone .cl-co small,.cl-root.phone .cl-co b{display:none}
.cl-root.phone .cl-av{width:36px;height:36px;border-width:2px}
.cl-root.phone .cl-stat{min-width:0;padding:3px 8px;flex:1 1 0}
.cl-root.phone .cl-stat b{font-size:15px}.cl-root.phone .cl-stat small{font-size:9.5px}
.cl-root.phone .cl-stat[data-tut=value],.cl-root.phone .cl-stat[data-tut=debt].zero{display:none}
.cl-root.phone .cl-clock{padding:3px 8px 3px 4px;gap:6px}
.cl-root.phone .cl-ring,.cl-root.phone .cl-ring svg{width:34px;height:34px}.cl-root.phone .cl-ring i{font-size:14px}
.cl-root.phone .cl-clock b{font-size:14px}.cl-root.phone .cl-clock small{font-size:9.5px}
.cl-root.phone .cl-opps{order:5;flex-basis:100%;gap:5px}
.cl-root.phone .cl-op{padding:3px 8px 3px 3px;gap:5px;flex:1 1 0}
.cl-root.phone .cl-op .cl-av{width:28px;height:28px}
.cl-root.phone .cl-op b{font-size:12px;max-width:90px}.cl-root.phone .cl-op small{font-size:11px}
.cl-root.phone .cl-btns{margin-left:0;gap:5px}
.cl-root.phone .cl-btns .cl-tb:not([data-k=menu]){display:none}
.cl-root.phone .cl-tb{padding:6px 9px;min-height:36px}
.cl-root.phone .cl-tb .lb{display:none}
.cl-root.phone .cl-main{grid-template-columns:minmax(0,1fr);grid-template-rows:minmax(0,var(--mh,58%)) minmax(0,1fr)}
.cl-root.phone .cl-split,.cl-root.phone .cl-hsplit,.cl-root.phone .cl-bot{display:none}
.cl-root.phone .cl-side{border-left:0;border-top:1px solid var(--line);border-radius:16px 16px 0 0;box-shadow:0 -10px 30px #000a;position:relative;z-index:5}
.cl-root.phone.sheetbig .cl-main{grid-template-rows:minmax(0,22%) minmax(0,1fr)}
.cl-root.phone .cl-handle{display:block;height:20px;border:0;background:transparent;width:100%;cursor:pointer;position:relative;flex:none}
.cl-root.phone .cl-handle::before{content:"";position:absolute;left:50%;top:7px;width:44px;height:5px;margin-left:-22px;border-radius:3px;background:#ffffff44}
.cl-root.phone .cl-tabs{display:none}
.cl-root.phone .cl-pane{padding:4px 10px 10px}
.cl-root.phone .cl-ptabs{display:flex;gap:2px;padding:4px 4px calc(4px + env(safe-area-inset-bottom,0px));background:#0b1424;border-top:1px solid var(--line)}
.cl-ptabs button{flex:1;display:flex;flex-direction:column;align-items:center;gap:1px;border:0;background:transparent;font-weight:700;font-size:11px;padding:6px 2px;cursor:pointer;border-radius:10px;position:relative;color:var(--mut)!important;min-height:48px}
.cl-ptabs button i{font-style:normal;font-size:20px;line-height:1.1}
.cl-ptabs button.on{background:#ffd35c22;color:var(--gold)!important}
.cl-ptabs .bdg{position:absolute;top:2px;right:calc(50% - 24px);min-width:17px;height:17px;border-radius:9px;background:#2fa862;color:#fff;font-size:10.5px;line-height:17px;padding:0 4px}
.cl-root.phone .cl-cons{left:8px;top:8px;max-width:calc(100% - 64px)}
.cl-root.phone .cl-bubble{font-size:12.5px;padding:7px 30px 7px 10px}
.cl-root.phone .cl-cons .cl-av{width:36px;height:36px}
.cl-root.phone .cl-legend{display:none}
.cl-root.phone .cl-mapbtns{right:8px;top:8px}
.cl-root.phone .cl-mapbtns .cl-tb{width:38px;height:38px}
.cl-root.phone .cl-ready{right:auto;left:8px;top:auto;bottom:8px;align-items:flex-start}
.cl-root.phone .cl-ready .cl-go{font-size:13px;padding:7px 11px}
.cl-psheet .cl-pop .cl-x{top:-4px;right:0}
.cl-psheet .cl-pop{position:relative;width:auto;max-width:none;left:auto!important;top:auto!important;box-shadow:none;border:0;background:transparent;padding:0;animation:none;backdrop-filter:none}
.cl-root.phone .cl-evs{top:auto;bottom:8px;left:auto;right:54px;transform:none;max-width:calc(100% - 200px);justify-content:flex-end}
.cl-ev .sp{display:none;font-style:normal}.cl-root.phone .cl-ev.start .sp{display:inline}
.cl-root.phone .cl-ev{padding:3px 8px 3px 6px;font-size:12px}
.cl-root.phone .cl-ev span{display:none}
.cl-root.phone .cl-ov .cl-toasts{top:56px;bottom:auto;right:auto;width:calc(100% - 66px);left:8px;align-items:flex-start}
.cl-root.phone .cl-toast{font-size:12.5px;padding:6px 10px}
.cl-root.phone .cl-btns [data-k=nego],.cl-root.phone .cl-top>[data-k=salon]{display:none}
.cl-root.phone .cl-ring,.cl-root.phone .cl-ring svg{width:30px;height:30px}
.cl-root.phone .cl-clock{flex:0 1 auto;min-width:0}
.cl-root.phone .cl-clock>div:last-child{min-width:0}
.cl-root.phone .cl-clock small{overflow:hidden;text-overflow:ellipsis;max-width:118px}
.cl-root.phone .cl-stat[data-tut=cash]{flex:1 1 auto}
.cl-root.phone .cl-pbox{display:flex;flex-direction:column;gap:8px}
.cl-root.phone .cl-pbox .cl-boxb{flex-wrap:wrap;overflow:visible;flex:none}
.cl-root.phone .cl-pm{max-width:none;min-width:0;flex-basis:100%;min-height:76px}
.cl-root.phone .cl-pbox .cl-rc{height:80px;flex:1 1 0;width:auto;min-width:0}
.cl-root.phone .cl-pbox .cl-sc{height:92px}
.cl-root.phone .cl-gis{grid-template-columns:repeat(5,minmax(0,1fr));gap:5px}
.cl-root.phone .cl-mcard{padding:14px}
/* lățimi medii */
.cl-root.mid .cl-co small{display:none}
.cl-root.mid .cl-co b{max-width:140px;font-size:15px}
.cl-root.mid .cl-stat{min-width:0;padding:4px 10px}.cl-root.mid .cl-stat b{font-size:16px}
.cl-root.mid .cl-tb .lb{display:none}
.cl-root.mid .cl-tb{padding:8px 10px}
.cl-root.mid .cl-op b{max-width:96px}
.cl-root.mid .cl-op .det,.cl-root.many .cl-op .det{display:none}
.cl-root.many .cl-op .dc,.cl-root.many .cl-op .sc{display:inline}.cl-root.many .cl-op .sf{display:none}
.cl-op .dc,.cl-op .sc{display:none}.cl-root.mid .cl-op .dc,.cl-root.mid .cl-op .sc{display:inline}.cl-root.mid .cl-op .sf{display:none}
.cl-root.mid.many .cl-op .nm{display:none}
.cl-root.mid .cl-stat[data-tut=debt].zero,.cl-root.many .cl-stat[data-tut=debt].zero{display:none}
.cl-root.mid .cl-clock{padding:4px 10px 4px 5px}.cl-root.mid .cl-clock b{font-size:16px}
.cl-root.mid .cl-top{gap:8px;padding:6px 10px}
.cl-root.mid .cl-bot{grid-template-columns:minmax(290px,350px) minmax(0,1fr) minmax(250px,330px);gap:10px;padding:8px 10px}
.cl-root.mid .cl-sc{width:92px;font-size:11.5px}
.cl-root.narrow .cl-op .nm{display:none}
@media (prefers-reduced-motion:reduce){.cl-root *{animation-duration:.01ms!important;animation-iteration-count:1!important;transition:none!important}}
`;
  document.head.appendChild(st);
}

/* ================= R1 UI-A: setări, sunete, numere, încărcare (la nivel de modul) ================= */
// setări pe dispozitiv (localStorage „cerul.set”); alți agenți (harta, vremea) le citesc prin window.CerulSettings
const SET_DEF = { music: .55, sfx: .8, ann: .8, gfx: "auto", wx: true, txt: "m" };
const SETS = Object.assign({}, SET_DEF, lsGet("cerul.set", {}) || {});
const setGet = () => Object.assign({}, SETS);
function setPut(k, v) {
  SETS[k] = v; lsSet("cerul.set", SETS);
  try { W.dispatchEvent(new CustomEvent("cerul-settings", { detail: setGet() })); } catch (e) { /* ignorat */ }
}
W.CerulSettings = W.CerulSettings || { get: setGet, set: setPut, defaults: Object.assign({}, SET_DEF) };
// numere: afișare cu „.” la mii, citire tolerantă („1.250”, „1 250 €”, „1,25 M”, „40k”)
function parseNum(s) {
  if (typeof s === "number") return s;
  let t = String(s == null ? "" : s).toLowerCase().replace(/[€\s ]/g, "").replace(/−/g, "-");
  let mul = 1; const m = t.match(/(k|m|mil|mii)$/); if (m) { mul = m[1] === "k" || m[1] === "mii" ? 1e3 : 1e6; t = t.slice(0, -m[1].length); }
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", "."); else if (/^\-?\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, "");
  const v = parseFloat(t); return isFinite(v) ? v * mul : NaN;
}
const fmtDelta = n => { n = Math.round(num(n)); const a = Math.abs(n); return (n > 0 ? "+" : n < 0 ? "−" : "±") + (a >= 1e6 ? (a / 1e6).toFixed(a >= 1e8 ? 0 : 2).replace(".", ",") + " M" : String(a).replace(/\B(?=(\d{3})+(?!\d))/g, ".")) + " €"; };
// sunete discrete, sintetizate (WebAudio); volumul vine din setări
const ASFX = (() => {
  let ac = null, out = null, gest = false; // AudioContext doar după un gest al utilizatorului (fără avertismente în consolă)
  const ctxA = () => {
    if (!gest) return null;
    if (ac) { if (ac.state === "suspended") ac.resume().catch(() => {}); return ac; }
    try { ac = new (W.AudioContext || W.webkitAudioContext)(); out = ac.createGain(); out.gain.value = .5; out.connect(ac.destination); } catch (e) { ac = null; }
    return ac;
  };
  function tone(type, f1, f2, dur, vol, dt, q) {
    const a = ctxA(); if (!a || a.state !== "running") return;
    const t = a.currentTime + (dt || 0), o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.setValueAtTime(f1, t); if (f2 && f2 !== f1) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(.0002, vol), t + (q || .008)); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + .05);
  }
  function noise(dur, vol, dt, freq) {
    const a = ctxA(); if (!a || a.state !== "running") return;
    const n = Math.floor(a.sampleRate * dur), b = a.createBuffer(1, n, a.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain(), t = a.currentTime + (dt || 0);
    f.type = "bandpass"; f.frequency.value = freq || 3500; g.gain.value = vol; s.buffer = b; s.connect(f); f.connect(g); g.connect(out); s.start(t);
  }
  const S = {
    land(v) { tone("sine", 1175, 1175, .09, .22 * v); tone("sine", 1568, 1568, .16, .18 * v, .07); },
    register(v) { noise(.07, .35 * v, 0, 2500); tone("triangle", 2093, 2093, .5, .2 * v, .08); tone("sine", 2637, 2637, .55, .14 * v, .12); },
    loss(v) { tone("triangle", 220, 165, .32, .26 * v); },
    dingdong(v) { tone("sine", 659, 659, 1.1, .26 * v, 0, .01); tone("sine", 1318, 1318, .6, .05 * v); tone("sine", 523, 523, 1.4, .26 * v, .55, .01); tone("sine", 1046, 1046, .7, .05 * v, .55); },
    event(v) { [523, 659, 784].forEach((f, i) => tone("triangle", f, f, .35, .16 * v, i * .09)); },
    alert(v) { tone("square", 988, 988, .09, .07 * v); tone("square", 988, 988, .09, .07 * v, .16); },
    pop(v) { tone("sine", 660, 990, .08, .16 * v); },
  };
  return {
    unlock: () => { gest = true; ctxA(); },
    play(k) { const s = setGet(), v = clamp(num(k === "dingdong" ? s.ann : s.sfx, .8), 0, 1); if (v < .02 || !S[k]) return; try { S[k](v); } catch (e) { /* fără sunet */ } },
  };
})();
if (typeof document !== "undefined") { try { ["pointerdown", "keydown"].forEach(ev => document.addEventListener(ev, () => ASFX.unlock(), { capture: true, once: true })); } catch (e) { /* ignorat */ } }
// ecranul de încărcare: bară de progres + idei scurte (fapte și scurtături, nu sfaturi)
const LOAD_TIPS = [
  "Space = pauză · F flotă · R rute · B bancă · G ghid",
  "Un pilot decolează singur când are minimul de pasageri.",
  "Hub: taxe de aterizare −50%, +1 slot.",
  "Leasingul devine al tău după destule zile plătite.",
  "Prețurile rivalilor sunt secrete. Spionul le arată o zi.",
  "Două avioane pe aceeași rută își împart pasagerii.",
  "Valoarea companiei decide câștigătorul.",
  "⚙️ Setări: volum, grafică, mărimea textului.",
];
const LOAD_G = ["CerulData", "CerulTune", "CerulLogic", "CerulBot", "CerulArt", "CerulMap", "CerulScenes", "CerulTutorial", "CerulGuide", "CerulUI"];
function loadPct() { return Math.round(100 * LOAD_G.filter(g => W[g]).length / LOAD_G.length); }
function bootHTML(msg, pct, tipI) {
  const p = clamp(num(pct, loadPct()), 0, 100), tip = LOAD_TIPS[num(tipI, Math.floor(Date.now() / 2400)) % LOAD_TIPS.length];
  return `<div class="cl-load" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${p}"><div class="cl-load-in"><h2>Cerul Lumii</h2><p>${escH(msg || "Se încarcă harta lumii și companiile…")}</p>
    <div class="cl-load-bar"><i style="width:${p}%"></i></div><small class="cl-load-tip">${escH(tip)}</small></div></div>`;
}
function cssA() {
  if (typeof document === "undefined" || document.getElementById("css-cerul-ui-a")) return;
  const st = document.createElement("style"); st.id = "css-cerul-ui-a";
  st.textContent = `
.cl-load{position:fixed;inset:0;z-index:80;display:grid;place-items:center;background:radial-gradient(circle at 50% 40%,#16305a,#0b1424 70%);color:#e8f0ff;font:14px/1.4 var(--body,system-ui),sans-serif;transition:opacity .45s ease;pointer-events:none}
.cl-load.out{opacity:0}
.cl-load-in{width:min(420px,calc(100vw - 32px));text-align:center}
.cl-load h2{margin:0 0 6px;font:800 30px var(--display,var(--body,system-ui));letter-spacing:.02em}
.cl-load p{margin:0 0 14px;color:#9db0cf}
.cl-load-bar{height:8px;border-radius:6px;background:#ffffff1a;overflow:hidden}
.cl-load-bar i{display:block;height:100%;border-radius:6px;background:linear-gradient(90deg,#5fd3dc,#ffd35c);transition:width .35s ease}
.cl-load-tip{display:block;margin-top:12px;color:#c9d6ee;min-height:2.6em}
.cl-stat{position:relative}
.cl-dl{display:block;font:700 11px/1.1 var(--body,system-ui);font-style:normal;font-variant-numeric:tabular-nums;white-space:nowrap;color:var(--mut,#9db0cf)}
.cl-dl.up{color:var(--ok,#5fd38a)}.cl-dl.dn{color:var(--bad,#ff6b6b)}
.cl-rkb{position:absolute;top:-10px;right:-6px;font:800 11px/16px var(--body,system-ui);font-style:normal;padding:0 6px;border-radius:8px;background:#0b1424;border:1px solid var(--line2,#2f4673);color:var(--ink,#e8f0ff);white-space:nowrap;font-variant-numeric:tabular-nums}
.cl-rkb .up{color:var(--ok,#5fd38a)}.cl-rkb .dn{color:var(--bad,#ff6b6b)}
.cl-net{display:inline-block;width:9px;height:9px;border-radius:50%;flex:none;border:2px solid #0b1424;box-shadow:0 0 0 1px #0008}
.cl-net.ok{background:#5fd38a}.cl-net.slow{background:#ffc94a}.cl-net.off{background:#ff6b6b}
.cl-op>.cl-net,.cl-co>.cl-net{position:absolute;left:30px;top:2px}.cl-co{position:relative}.cl-co>.cl-net{left:34px;top:0}
.cl-ov .cl-toasts{pointer-events:none}
.cl-ov .cl-toast{pointer-events:auto;cursor:pointer}
.cl-toast .tb{display:flex;gap:6px;margin-top:6px;flex-wrap:wrap}
.cl-toast .tb button{background:#1a2b4a;border:1px solid var(--line2,#2f4673);border-radius:8px;padding:4px 10px;font:700 12.5px var(--body,system-ui);color:var(--ink,#e8f0ff);cursor:pointer}
.cl-toast .tb button.gold{background:linear-gradient(#ffd35c,#e9a92a);color:#2a1d00;border-color:#ffd35c}
.cl-toast span{min-width:0}
.cl-news{position:absolute;left:14px;bottom:58px;z-index:2;max-width:min(460px,38%);display:flex;gap:10px;align-items:flex-start;padding:8px 12px 8px 10px;border-radius:12px;background:#f3ead6;color:#2a2010;box-shadow:0 10px 26px #000a;font:600 13.5px/1.3 Georgia,"Times New Roman",serif;animation:cltin .35s ease both;cursor:pointer}
.cl-news b{display:block;font:800 10.5px/1.2 var(--body,system-ui);letter-spacing:.12em;text-transform:uppercase;color:#7a5a20;margin-bottom:2px}
.cl-news .x{background:none;border:0;color:#7a5a20;font-size:15px;cursor:pointer;padding:0 2px;margin-left:auto}
.cl-rep{position:absolute;left:50%;bottom:14px;transform:translateX(-50%);z-index:2;width:min(360px,calc(100% - 28px));background:#0f1d36f2;border:1px solid var(--line2,#2f4673);border-radius:14px;padding:10px 14px 12px;box-shadow:0 14px 34px #000c;font-size:13px;animation:cltin .35s ease both}
.cl-rep h5{margin:0 0 6px;font:800 13px var(--body,system-ui);display:flex;justify-content:space-between;align-items:center;gap:8px;color:var(--ink,#e8f0ff)}
.cl-rep h5 button{background:none;border:0;color:var(--mut,#9db0cf);font-size:16px;cursor:pointer;padding:2px 4px}
.cl-rep .g{display:grid;grid-template-columns:1fr auto;gap:3px 10px;font-variant-numeric:tabular-nums}
.cl-rep .g span{color:var(--mut,#9db0cf);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cl-rep .g b{text-align:right;white-space:nowrap}
.cl-rep ul{margin:6px 0 0;padding:6px 0 0 16px;border-top:1px solid var(--line,#22324f);color:#c9d6ee;font-size:12.5px}
.cl-rep .pos,.cl-rhead .pos{color:var(--ok,#5fd38a)}.cl-rep .neg,.cl-rhead .neg{color:var(--bad,#ff6b6b)}
.cl-rhead{display:flex;align-items:baseline;flex-wrap:wrap;gap:4px 8px;padding:8px 10px;margin:2px 0 4px;border-radius:10px;background:#ffffff0d;border:1px solid var(--line,#22324f)}
.cl-rhead small{color:var(--mut,#9db0cf);font-size:12px}
.cl-rhead b{font-size:24px;line-height:1.1;font-variant-numeric:tabular-nums;white-space:nowrap}
.cl-rhead .nx{flex-basis:100%;font-size:12.5px;color:var(--mut,#9db0cf)}
.cl-rhead .nx b{font-size:13px}
.cl-rdet{display:flex;flex-direction:column;gap:3px;margin-top:4px;padding-top:6px;border-top:1px solid var(--line,#22324f);font-size:12.5px;color:var(--mut,#9db0cf)}
.cl-rdet .row b{font-size:12.5px}
.cl-pin input.cl-num{width:104px;background:#08111f;border:1px solid var(--line2,#2f4673);border-radius:8px;color:var(--ink,#e8f0ff);padding:6px 8px;font:700 15px var(--body,system-ui);font-variant-numeric:tabular-nums;text-align:right}
.cl-ov .cl-pop{max-height:calc(100% - 16px);overflow:auto;overscroll-behavior:contain}
.cl-ov:has(.cl-pop) .cl-rep{display:none}
.cl-ov:has(.cl-news) .cl-legend{visibility:hidden}
.cl-root.phone .cl-ov:has(.cl-rep) .cl-news{display:none}
.cl-root.phone .cl-rep ul{display:none}
.cl-pnl-w{position:absolute;inset:0;z-index:46;display:grid;place-items:center;background:#0006;pointer-events:auto}
.cl-pnl{width:min(440px,calc(100vw - 32px));max-height:calc(100vh - 40px);overflow:auto;background:#101d36fa;border:1px solid var(--line2,#2f4673);border-radius:16px;padding:16px 18px;box-shadow:0 24px 60px #000c;color:var(--ink,#e8f0ff)}
.cl-pnl h3{margin:0 0 10px;font:800 18px var(--display,var(--body,system-ui));display:flex;justify-content:space-between;align-items:center}
.cl-pnl h3 button{background:none;border:0;color:var(--mut,#9db0cf);font-size:18px;cursor:pointer}
.cl-pnl label,.cl-pnl .r{display:grid;grid-template-columns:120px 1fr 44px;align-items:center;gap:10px;margin:8px 0;font-size:14px}
.cl-pnl .r{grid-template-columns:120px 1fr}
.cl-pnl label output{text-align:right;color:var(--mut,#9db0cf);font-variant-numeric:tabular-nums}
.cl-pnl input[type=range]{width:100%;accent-color:#ffd35c}
.cl-seg{display:flex;gap:4px;flex-wrap:wrap}
.cl-seg button{flex:1;min-width:64px;background:#1a2b4a;border:1px solid var(--line2,#2f4673);border-radius:9px;padding:7px 8px;font:700 13px var(--body,system-ui);color:var(--ink,#e8f0ff);cursor:pointer}
.cl-seg button.on{border-color:#ffd35c;background:#ffd35c26}
.cl-pnl small.n{display:block;color:var(--mut,#9db0cf);font-size:12px;margin-top:6px}
.cl-keys{display:grid;grid-template-columns:auto 1fr;gap:6px 14px;font-size:14px}
.cl-keys kbd{display:inline-block;min-width:28px;text-align:center;padding:2px 7px;border-radius:6px;background:#0b1424;border:1px solid var(--line2,#2f4673);border-bottom-width:3px;font:700 13px var(--body,system-ui)}
.cl-rx{position:absolute;z-index:21;display:flex;gap:4px;flex-wrap:wrap;width:248px;padding:8px;border-radius:12px;background:#101d36f8;border:1px solid var(--line2,#2f4673);box-shadow:0 18px 40px #000b}
.cl-rx button{background:#1a2b4a;border:1px solid var(--line2,#2f4673);border-radius:9px;padding:5px 8px;font:700 13px var(--body,system-ui);color:var(--ink,#e8f0ff);cursor:pointer;min-height:34px}
.cl-rx button:disabled{opacity:.4}
.cl-bub{position:fixed;z-index:47;pointer-events:none;transform:translate(-50%,0);padding:4px 10px;border-radius:12px;background:#fff;color:#1a1a1a;font:700 14px var(--body,system-ui);box-shadow:0 6px 18px #0009;white-space:nowrap;animation:clbub 3.6s ease both}
.cl-bub::before{content:"";position:absolute;left:50%;top:-6px;margin-left:-6px;border:6px solid transparent;border-top:0;border-bottom-color:#fff}
@keyframes clbub{0%{opacity:0;transform:translate(-50%,6px) scale(.8)}10%{opacity:1;transform:translate(-50%,0) scale(1)}80%{opacity:1}100%{opacity:0;transform:translate(-50%,-8px)}}
.cl-root.tx-s .cl-pane,.cl-root.tx-s .cl-pop,.cl-root.tx-s .cl-modw,.cl-root.tx-s .cl-bot{zoom:.92}
.cl-root.tx-l .cl-pane,.cl-root.tx-l .cl-pop,.cl-root.tx-l .cl-modw,.cl-root.tx-l .cl-bot,.cl-root.tx-l .cl-toasts{zoom:1.12}
.cl-root.gfx-low *{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}
.cl-root.gfx-low .cl-toast,.cl-root.gfx-low .cl-banner,.cl-root.gfx-low .cl-news,.cl-root.gfx-low .cl-rep{animation:none!important;box-shadow:none}
.cl-root.phone .cl-news{left:8px;right:56px;top:8px;bottom:auto;max-width:none;font-size:12.5px;z-index:6}
.cl-root.phone .cl-rep{bottom:8px;width:calc(100% - 16px);z-index:6;font-size:12.5px;padding:8px 12px 10px}
.cl-root.phone .cl-dl{font-size:10px}
.cl-root.phone .cl-rkb{top:-6px;right:-4px;font-size:10px;line-height:14px;padding:0 4px}
.cl-root.phone .cl-pnl label{grid-template-columns:96px 1fr 40px}.cl-root.phone .cl-pnl .r{grid-template-columns:96px 1fr}
`;
  document.head.appendChild(st);
}

/* ---------------- morph: actualizează DOM-ul fără să-l recreeze (păstrează focus, tranziții) ---------------- */
const TPL = typeof document !== "undefined" ? document.createElement("template") : null;
function morph(el, html) {
  if (el.__h === html) return; el.__h = html;
  TPL.innerHTML = html;
  syncKids(el, TPL.content);
}
function syncKids(a, b) {
  const an = Array.from(a.childNodes), bn = Array.from(b.childNodes);
  for (let i = 0; i < bn.length; i++) {
    const x = an[i], y = bn[i];
    if (!x) { a.appendChild(y.cloneNode(true)); continue; }
    if (x.nodeType !== y.nodeType || x.nodeName !== y.nodeName || (x.nodeType === 1 && (x.getAttribute("data-key") || "") !== (y.getAttribute("data-key") || ""))) { a.replaceChild(y.cloneNode(true), x); continue; }
    if (x.nodeType === 3 || x.nodeType === 8) { if (x.nodeValue !== y.nodeValue) x.nodeValue = y.nodeValue; continue; }
    syncNode(x, y);
  }
  for (let i = an.length - 1; i >= bn.length; i--) a.removeChild(an[i]);
}
function syncNode(x, y) {
  const ya = y.attributes, xa = x.attributes;
  for (let i = xa.length - 1; i >= 0; i--) { const n = xa[i].name; if (!y.hasAttribute(n)) x.removeAttribute(n); }
  for (let i = 0; i < ya.length; i++) { const n = ya[i].name, v = ya[i].value; if (x.getAttribute(n) !== v) x.setAttribute(n, v); }
  if (x.nodeName === "INPUT") { if (document.activeElement !== x && x.value !== (y.getAttribute("value") || "")) x.value = y.getAttribute("value") || ""; return; }
  if (x.nodeName === "svg" || x.getAttribute("data-raw") != null) { if (x.innerHTML !== y.innerHTML) x.innerHTML = y.innerHTML; return; }
  syncKids(x, y);
}

/* ================================================================================================= */
function mount(root, ctx, helpers) {
  helpers = helpers || {};
  css(); cssA(); try { W.CerulTheme && W.CerulTheme.inject(); } catch (e) { /* fără temă */ }
  const H = {
    Logic: () => helpers.Logic || W.CerulLogic || null, Data: () => helpers.Data || W.CerulData || null, Art: () => helpers.Art || W.CerulArt || null,
    Map: () => helpers.Map || W.CerulMap || null, Scenes: () => helpers.Scenes || W.CerulScenes || null, Guide: () => helpers.Guide || W.CerulGuide || null,
  };
  try { const A = H.Art(); A && A.css && A.css(); } catch (e) { /* fără ART */ }
  const now = () => { try { return helpers.now ? helpers.now() : Date.now(); } catch (e) { return Date.now(); } };
  const sfx = new Proxy({}, { get: (_, k) => () => { if (num(setGet().sfx, .8) < .02) return; try { ctx.sfx && ctx.sfx[k] && ctx.sfx[k](); } catch (e) { /* fără sunet */ } } });
  const T = { timeout: (f, ms) => ctx.timeout ? ctx.timeout(f, ms) : setTimeout(f, ms), interval: (f, ms) => ctx.interval ? ctx.interval(f, ms) : setInterval(f, ms), on: (t, ty, f, o) => ctx.on ? ctx.on(t, ty, f, o) : t.addEventListener(ty, f, o) };
  const reduced = reducedMQ();
  const nameOf = s => { try { return (ctx.nameOf && ctx.nameOf(s)) || (ctx.names && ctx.names[s]) || s; } catch (e) { return s; } };

  /* ---------- schelet ---------- */
  const el = document.createElement("div");
  el.className = "cl-root";
  el.setAttribute("role", "application"); el.setAttribute("aria-label", "Cerul Lumii");
  el.innerHTML = `
  <header class="cl-top" data-tut="top">
    <button class="cl-tb" data-k="salon" title="Înapoi în salon" aria-label="Înapoi în salon">${IC("back", "←")}</button>
    <div class="cl-co" data-tut="company"></div>
    <div class="cl-stat" data-tut="cash"><small>Bani</small><b>—</b></div>
    <div class="cl-stat" data-tut="value"><small>Valoare companie</small><b>—</b></div>
    <div class="cl-stat" data-tut="debt"><small>Credit bancă</small><b>—</b></div>
    <div class="cl-clock" data-tut="clock" role="timer" aria-live="off"><div class="cl-ring"><svg viewBox="0 0 44 44"><circle class="bg" cx="22" cy="22" r="18"/><circle class="fg" cx="22" cy="22" r="18" stroke-dasharray="113.1" stroke-dashoffset="113.1"/></svg><i>☀️</i></div><div><small>ZIUA —</small><b>—</b></div></div>
    <div class="cl-opps" data-tut="opponents" data-tut2="opps"></div>
    <div class="cl-btns">
      <button class="cl-tb gold" data-k="nego" data-tut="btn-nego" title="Negociază cu alt jucător (oprește timpul pentru toți)"><span class="ic">${IC("nego", "🤝")}</span><span class="lb"> Negociază</span></button>
      <button class="cl-tb" data-k="bank" data-tut="btn-bank" title="Bancă: credit și rambursări"><span class="ic">${IC("bank", "🏦")}</span><span class="lb"> Bancă</span></button>
      <button class="cl-tb" data-k="ghiseu" data-tut="btn-ghiseu" title="Ghișeu: schimbă 5 cărți pe una la alegere sau cumpără cărți"><span class="ic">${IC("cards", "🃏")}</span><span class="lb"> Ghișeu</span></button>
      <button class="cl-tb" data-k="guide" data-tut="btn-guide" title="Ghidul ilustrat"><span class="ic">${IC("guide", "📖")}</span><span class="lb"> Ghid</span></button>
      <button class="cl-tb" data-k="menu" title="Mai multe: masă, joc nou, reguli" aria-haspopup="true" aria-label="Meniu">${IC("menu", "⋯")}</button>
      <button class="cl-tb" data-k="fs" title="Ecran complet (F11)" aria-label="Ecran complet">${IC("fullscreen", "⛶")}</button>
    </div>
  </header>
  <main class="cl-main">
    <section class="cl-mapc" data-tut="map" aria-label="Harta lumii">
      <div class="cl-map"></div>
      <div class="cl-ov">
        <div class="cl-evs"></div>
        <div class="cl-consw"></div>
        <div class="cl-mapbtns"><button class="cl-tb" data-k="maponly" data-tut="maponly" title="Doar harta (M)" aria-label="Doar harta">${IC("map", "🗺️")}</button></div>
        <div class="cl-legend"></div>
        <div class="cl-ready"></div>
        <div class="cl-pz"></div>
        <div class="cl-popw"></div>
        <div class="cl-toasts" aria-live="polite"></div>
      </div>
    </section>
    <div class="cl-split" data-tut="splitter" role="separator" aria-orientation="vertical" aria-label="Trage ca să redimensionezi harta" tabindex="0"></div>
    <aside class="cl-side" data-tut="side">
      <button class="cl-handle" data-k="sheet" aria-label="Mărește sau micșorează panoul"></button>
      <nav class="cl-tabs" role="tablist"></nav>
      <div class="cl-pane" role="tabpanel" tabindex="-1"></div>
    </aside>
  </main>
  <div class="cl-hsplit" role="separator" aria-orientation="horizontal" aria-label="Trage ca să redimensionezi zona de jos" tabindex="0"></div>
  <footer class="cl-bot">
    <section class="cl-box" data-tut="cards"><div class="cl-h"><span>Cărțile tale</span><span class="cl-cardsx"></span></div><div class="cl-boxb cl-cards"></div></section>
    <section class="cl-box" data-tut="permits"><div class="cl-h"><span>Permisele tale (max 3) — ce mai lipsește</span></div><div class="cl-boxb cl-perms"></div></section>
    <section class="cl-box" data-tut="specials"><div class="cl-h"><span>Cărți speciale</span></div><div class="cl-boxb cl-specs"></div></section>
  </footer>
  <nav class="cl-ptabs" data-tut="phone-tabs"></nav>
  <div class="cl-frzw"></div>
  <div class="cl-banw"></div>
  <div class="cl-modw"></div>
  <div class="cl-scene"></div>
  <div class="cl-scene2 cl-scene"></div>
  <div class="cl-endbar" hidden></div>`;
  try { root.innerHTML = ""; } catch (e) { /* ignorat */ }
  (root && root.appendChild ? root : document.body).appendChild(el); // position:fixed acoperă tot ecranul
  document.documentElement.classList.add("cl-on");
  const $ = s => el.querySelector(s);
  const E = {
    top: $(".cl-top"), co: $(".cl-co"), cash: $("[data-tut=cash]"), value: $("[data-tut=value]"), debt: $("[data-tut=debt]"), clock: $(".cl-clock"), opps: $(".cl-opps"),
    mapc: $(".cl-mapc"), map: $(".cl-map"), evs: $(".cl-evs"), pz: $(".cl-pz"), consw: $(".cl-consw"), legend: $(".cl-legend"), ready: $(".cl-ready"), popw: $(".cl-popw"),
    tabs: $(".cl-tabs"), pane: $(".cl-pane"), side: $(".cl-side"), cards: $(".cl-cards"), cardsx: $(".cl-cardsx"), perms: $(".cl-perms"), specs: $(".cl-specs"),
    ptabs: $(".cl-ptabs"), toasts: $(".cl-toasts"), banw: $(".cl-banw"), modw: $(".cl-modw"), scene: $(".cl-scene"), scene2: $(".cl-scene2"), frzw: $(".cl-frzw"),
    split: $(".cl-split"), hsplit: $(".cl-hsplit"), endbar: $(".cl-endbar"),
  };

  /* ---------- starea interfeței ---------- */
  const U = {
    tab: lsGet("cerul.tab", "fleet"), ptab: "fleet", sheetBig: false, maponly: false, mode: "",
    selRoute: null, popAt: null, popKind: null, selAp: null, selPlane: null, dir: "ab", draft: {}, shopSeg: "new",
    modal: null, menu: false, consHide: false, consKey: "", consT: 0, tipSeen: "",
    side: clamp(num(lsGet("cerul.side", 400), 400), 300, 760), bot: clamp(num(lsGet("cerul.bot", 150), 150), 112, 340),
    legend: !!lsGet("cerul.legend", false), showBusy: false, errN: null, prevV: null, lastProfit: {}, nicks: {}, seenLog: null, lastDay: null, frozenShown: false, bumped: {},
  };
  let st = ctx.state, V = null, alive = true, lastViewAt = 0;
  const me = () => ctx.me || null;
  // pauză: doar privit (+ negociere dacă LOGIC o permite) — toate acțiunile „de timp” sunt blocate
  const paused = () => !!(V && (V.why === "pause" || (V.clock && V.clock.why === "pause") || (V.legal && V.legal.paused)));
  const canAct = () => !!ctx.me && !ctx.ended && !!V && V.phase === "play" && !V.me.bankrupt && !paused();
  const PAUSE_T = "Jocul e pe pauză — acum poți doar să te uiți.";
  function canNegoNow() {
    if (!ctx.me || ctx.ended || !V || V.phase !== "play" || V.me.bankrupt || V.me.frozen) return false;
    if (V.legal && V.legal.canNego !== undefined) return V.canNego.length > 0;
    return !paused() && V.opps.some(o => !o.bankrupt);
  }

  function send(a) {
    if (!ctx.me || ctx.ended) { sfx.error(); return false; }
    let ok = false;
    try { const r = helpers.send ? helpers.send(a) : 0; ok = r !== false && r !== 0 && r != null; } catch (e) { ok = false; }
    if (!ok) sfx.error();
    T.timeout(() => refresh(true), 60);
    return ok;
  }
  const act = (type, payload) => send(Object.assign({ [ACT]: type }, payload || {}));
  function notify(evn, data) { try { const G = H.Guide(); G && G.notify && G.notify(evn, data); } catch (e) { /* ignorat */ } }

  /* ---------- date: aeroporturi ---------- */
  function apObj(id) {
    if (id && typeof id === "object") return id;
    const D = H.Data(); let a = null;
    try { a = D && ((D.AP && D.AP[id]) || (D.AIRPORTS && D.AIRPORTS.find(x => x.id === id))); } catch (e) { a = null; }
    if (!a && V && V.airports) a = V.airports[id] || null;
    return a || { id, n: String(id || "?") };
  }
  const apName = id => apObj(id).n || id;
  const SIZE_N = ["", "mic", "mediu", "mare"];
  function dist(a, b) {
    const D = H.Data(); try { if (D && D.dist) return D.dist(a, b); } catch (e) { /* rezervă */ }
    const A = apObj(a), B = apObj(b); if (A.lat == null || B.lat == null) return 0;
    const r = Math.PI / 180, x = Math.sin((B.lat - A.lat) * r / 2) ** 2 + Math.cos(A.lat * r) * Math.cos(B.lat * r) * Math.sin((B.lon - A.lon) * r / 2) ** 2;
    return Math.round(12742 * Math.asin(Math.sqrt(x)));
  }
  function line(key, vars) {
    const D = H.Data(); if (!D || typeof D.line !== "function") return "";
    try { const s = D.line(key, vars || {}); return s && !/\{[a-z]+\}/.test(s) ? s : ""; } catch (e) { return ""; }
  }

  /* ---------- adaptorul vederii (tolerant la nume) ---------- */
  function rawView() {
    const Lo = H.Logic(); if (!Lo || !st) return null;
    try { return Lo.view ? Lo.view(st, me(), now()) : null; } catch (e) { if (!U._verr) { U._verr = 1; console.warn("CerulUI: view() a eșuat", e); } return null; }
  }
  function colorOf(c) {
    if (c == null) return null;
    if (typeof c === "string" && c[0] === "#") return c;
    const D = H.Data(); let C = null;
    try { C = D && D.COLORS && (D.COLORS[c] || (D.COLORS.find && D.COLORS.find(x => x.id === c))); } catch (e) { C = null; }
    return (C && (C.hex || C.c)) || ["#ff8a4c", "#5fd3dc", "#b28dff", "#7be07b", "#ff6fa8", "#ffd35c"][num(c) % 6] || null;
  }
  const RIDX = ["apr", "inf", "ech", "comb", "joker"];
  function vec2obj(x) { const o = {}; if (Array.isArray(x)) x.forEach((n, i) => { if (RIDX[i]) o[RIDX[i]] = num(n); }); else if (x && typeof x === "object") for (const k in x) { const rk = resKey(k) || (RIDX[+k] || null); if (rk) o[rk] = (o[rk] || 0) + num(x[k]); } return o; }
  function norm(v) {
    v = v || {};
    const ph = pick(v, "phase") || (st && st.phase) || "play";
    const gtNow = num(pick(v, "gt"), 0);
    const m = (v.co && typeof v.co === "object") ? v.co : (typeof v.me === "object" && v.me) || v.my || {};
    const fr = v.frozen && typeof v.frozen === "object" ? v.frozen : null;
    const shop = pick(v, "shop") || {};
    const meO = {
      seat: me(), name: pick(m, "name") || nameOf(me()), co: pick(m, "co", "company") || ((pick(m, "name") || nameOf(me()) || "") + " Air"),
      color: colorOf(pick(m, "col", "color")) || "#ff8a4c", av: pick(m, "av", "avatar"), g: pick(m, "g"), base: pick(m, "base"),
      stars: num(pick(m, "stars"), 3), rep: pick(m, "rep"), cash: num(pick(m, "cash")), value: num(pick(m, "value")), debt: num(pick(m, "debt")), owes: num(pick(m, "owes")),
      rank: pick(m, "rank"), frozen: !!(fr || m.frozen === true), frozenLeft: fr ? num(fr.left) * 1000 : 0, negDays: pick(m, "negLeft", "negDays"),
      bankrupt: !!pick(m, "out", "bankrupt"), consultant: !!pick(m, "cons", "consultant"), hubs: arr(pick(m, "hubs")), tip: pick(m, "tip"),
      pilotCost: pick(shop, "pilotFee"), consCost: pick(shop, "consFee"), fuelMult: pick(m, "fuelMult"),
    };
    const lines = arr(pick(v.map || {}, "lines"));
    const opps = arr(pick(v, "opp", "opps", "opponents")).map(o => {
      const seat = pick(o, "seat", "s");
      const rids = arr(pick(o, "routes"));
      const routes = rids.map(r => {
        if (r && typeof r === "object") return { id: pick(r, "rid", "id"), a: pick(r, "a"), b: pick(r, "b") };
        const ln = lines.find(l => l.rid === r && l.s === seat); const ab = String(r).split("-");
        return { id: r, a: ln ? ln.a : ab[0], b: ln ? ln.b : ab[1] };
      });
      return {
        seat, name: pick(o, "name") || nameOf(seat), co: pick(o, "co") || "", color: colorOf(pick(o, "col", "color")) || "#5fd3dc", av: pick(o, "av"), g: pick(o, "g"),
        stars: num(pick(o, "stars"), 3), planes: num(pick(o, "planes")), inAir: num(pick(o, "inAir")), rank: pick(o, "rank"), frozen: !!pick(o, "frozen"),
        bankrupt: !!pick(o, "out", "bankrupt"), bot: (() => { try { const i = ctx.seatInfo && ctx.seatInfo(seat); return !!(i && i.bot); } catch (e) { return false; } })(), routes,
        pact: arr(pick(v, "pacts")).some(p => pick(p, "with") === seat),
      };
    });
    const routes = arr(pick(v, "routes")).map(r => {
      const dem = pick(r, "dem"), sh = pick(r, "share"), q = pick(r, "q");
      const dAB = typeof dem === "object" && dem ? num(dem.ab) : num(dem), dBA = typeof dem === "object" && dem ? num(dem.ba) : num(dem);
      const sAB = typeof sh === "object" && sh ? num(sh.ab, 1) : num(sh, 1), sBA = typeof sh === "object" && sh ? num(sh.ba, 1) : num(sh, 1);
      const pl = pick(r, "planes");
      return {
        id: pick(r, "rid", "id"), a: pick(r, "a"), b: pick(r, "b"), dist: num(pick(r, "d", "dist"), 0) || dist(pick(r, "a"), pick(r, "b")),
        demand: dAB + dBA, dem: { ab: dAB, ba: dBA }, share: (dAB + dBA) ? (sAB * dAB + sBA * dBA) / (dAB + dBA) : (sAB + sBA) / 2, shares: { ab: sAB, ba: sBA },
        price: { ab: num(pick(r, "pa")), ba: num(pick(r, "pb")) }, normal: pick(r, "normal"), rec: pick(r, "rec") || null,
        profitToday: pick(r, "netToday") != null ? num(pick(r, "netToday")) : num(pick(r, "today")), flightsToday: num(pick(r, "today")), fixedDay: pick(r, "fixedDay") != null ? num(pick(r, "fixedDay")) : null, p7: pick(r, "p7"), planes: Array.isArray(pl) ? pl.length : num(pl), pids: Array.isArray(pl) ? pl : [],
        wait: q || null, comp: num(pick(r, "comp")), boom: !!pick(r, "boom"), pioneer: !!pick(r, "pio"), closed: !!pick(r, "closed"), building: false,
      };
    });
    const mpl = {}; arr(pick(v.map || {}, "planes")).forEach(p => { mpl[pick(p, "id")] = p; });
    const planes = arr(pick(v, "planes")).map((p, i) => {
      const mode = String(pick(p, "mode") || ["idle", "board", "fly", "ferry"][num(pick(p, "m"))] || "idle");
      const fz = !!pick(p, "frozen"), dly = num(pick(p, "dly"), 0), broken = dly > gtNow + .5;
      const s = fz ? "frozen" : mode === "fly" || mode === "ferry" ? "air" : mode === "board" ? "board" : "idle";
      const t = ptInfo(pick(p, "ty", "type"));
      const mp = mpl[pick(p, "id")] || {}, pos = pick(p, "pos") || {};
      const air = mode === "fly" || mode === "ferry";
      return {
        id: pick(p, "id"), type: t.k, ty: t.ty, tinfo: Object.assign({}, t, { seats: num(pick(p, "seats", "cap"), t.seats), range: num(pick(p, "range"), t.range) }),
        name: nickOf(pick(p, "id"), pick(p, "name"), t, U.nicks), rid: pick(p, "rid"), mode, ferry: mode === "ferry",
        at: air ? pick(p, "fr") : pick(p, "ap"), from: pick(p, "fr"), to: air ? pick(p, "to", "ap") : pick(p, "to"), st: broken && !air && !fz ? "broken" : s,
        pax: num(pick(p, "px")), seats: num(pick(p, "cap", "seats"), t.seats), load: pick(p, "load"), eta: pick(p, "eta"), prog: pick(mp, "prog") != null ? mp.prog : pick(pos, "prog"),
        pilot: !!pick(p, "pil", "pilot"), lease: !!pick(p, "ls"), value: pick(p, "val", "value"), sellVal: pick(p, "sellVal"), pilotFee: pick(p, "pilotFee"), pmin: pick(p, "pilotMinSet") === false ? null : pick(p, "pilotMin", "pmin", "pm"), pminDef: pick(p, "pilotMin"), beN: pick(p, "beN"), sub: !!pick(p, "sub"), via: pick(p, "via"), chain: pick(p, "chain") || null, waitGate: pick(p, "waitGate") || null, leasePaid: pick(p, "leasePaid"), leaseTarget: pick(p, "leaseTarget"), buyoutPrice: pick(p, "buyoutPrice"), daysToOwn: pick(p, "daysToOwn"), age: pick(p, "age"), canDepart: pick(p, "canDepart"),
        ready: !!pick(p, "ready"), readyIn: pick(p, "readyIn"), go: !!pick(p, "go"), frozen: fz, broken, delay: broken ? dly - gtNow : 0, lastProfit: null,
      };
    });
    const cards = pick(v, "cards") || {};
    const hand = vec2obj(pick(cards, "h") || pick(v, "hand") || {});
    const sx = pick(cards, "sx") || {};
    const legal = pick(v, "legal") || {};
    const playL = pick(legal, "play") || {};
    const specials = Object.keys(sx).filter(k => num(sx[k]) > 0).map(k => { const pl = playL[k]; return { k, sk: specKey(k) || k, count: num(sx[k]), canPlay: pl === undefined ? undefined : !!(Array.isArray(pl) ? pl.length : pl), targets: Array.isArray(pl) ? pl : null }; });
    const permits = arr(pick(v, "permits")).map(p => ({
      id: pick(p, "id"), a: pick(p, "a"), b: pick(p, "b"), cost: vec2obj(pick(p, "k", "cost")), miss: vec2obj(pick(p, "miss")), jok: num(pick(p, "jok")),
      canBuild: pick(p, "canBuild"), canFast: !!pick(p, "canFast"), slotCost: num(pick(p, "cost")), slots: arr(pick(p, "slots")), why: pick(p, "why"), cls: pick(p, "cls"),
      dist: num(pick(p, "d", "dist"), 0) || dist(pick(p, "a"), pick(p, "b")),
    }));
    const offer = arr(pick(v, "offer")).map(p => ({ id: pick(p, "id"), a: pick(p, "a"), b: pick(p, "b"), cost: vec2obj(pick(p, "k", "cost")), cls: pick(p, "cls"), dist: num(pick(p, "d"), 0) || dist(pick(p, "a"), pick(p, "b")) }));
    // istoric P&L: din stare (datele mele)
    let pl = arr(pick(v, "pl", "hist"));
    try { const c = st && st.c && me() && st.c[me()]; if (!pl.length && c && Array.isArray(c.hist)) pl = c.hist.map(x => Array.isArray(x) ? { day: x[0], rev: x[1], cost: x[2] } : x); } catch (e) { /* ignorat */ }
    const leaseFee = {}, leaseOwn = {}; arr(pick(shop, "lease")).forEach(x => { leaseFee[ptKey(pick(x, "ty"))] = pick(x, "fee"); leaseOwn[ptKey(pick(x, "ty"))] = pick(x, "daysToOwn", "ownDays", "own"); });
    const shopN = {
      new: arr(pick(shop, "new")).map(x => ({ type: pick(x, "ty"), price: pick(x, "price"), ok: pick(x, "ok"), lease: leaseFee[ptKey(pick(x, "ty"))], own: leaseOwn[ptKey(pick(x, "ty"))], pilot: pick(x, "pilot") })),
      used: arr(pick(shop, "used")).map(x => ({ id: pick(x, "id"), type: pick(x, "ty"), age: pick(x, "ag"), price: pick(x, "pr", "price"), ok: pick(x, "ok") })),
    };
    const bank = pick(v, "bank") || {};
    const shares = arr(pick(v, "shares")).map(r => ({ seat: pick(r, "co", "seat"), price: num(pick(r, "price")), own: num(pick(r, "own")), held: num(pick(r, "held")), mine: num(pick(r, "mine")) }));
    return {
      raw: v, phase: ph, gt: gtNow, me: meO, opps, routes, planes, hand, specials, permits, offer, canDraw: pick(v, "canDraw") != null ? !!v.canDraw : !!pick(legal, "canDraw"),
      maxPermits: num(pick(v, "maxPermits"), 3), shop: shopN, bank: { limit: num(pick(bank, "limit")), rate: pick(bank, "rate"), loans: arr(pick(bank, "loans")).map(l => ({ id: pick(l, "id"), left: num(pick(l, "p", "left")), days: pick(l, "d", "days"), inst: num(pick(l, "inst")) })), terms: arr(pick(bank, "terms")) },
      shares, pl, tip: meO.tip, events: arr(pick(v, "events")), err: pick(v, "err") || null, cardPrice: pick(cards, "buyPrice"), canGhiseu: pick(cards, "canGhiseu"),
      legal, clock: pick(v, "clock") || null, frozenInfo: fr, map: pick(v, "map") || null, spy: pick(v, "spy") || null, log: arr(pick(v, "log")),
      canNego: arr(pick(legal, "canNego")), canBank: pick(legal, "canBank"), canPause: pick(legal, "canPause"), paused: !!pick(v, "paused"), why: pick(v, "why"),
      loans: arr(pick(v, "loans")), pacts: arr(pick(v, "pacts")), discardPenalty: pick(v, "discardPenalty"), hubCost: null, res: pick(v, "res"), hubInfo: pick(v, "hubInfo") || null, region: pick(v, "region") || null,
    };
  }
  function refresh(force) {
    const t = now();
    if (!force && t - lastViewAt < 450) return;
    lastViewAt = t;
    const r = rawView();
    const nv = norm(r || {});
    const pv = V; V = nv;
    try { diffEffects(pv, V); } catch (e) { /* efectele nu blochează */ }
    try { diffA(pv, V); } catch (e) { console.warn("CerulUI: diffA", e); }
    drawAll();
    guideObserve();
  }
  /* ghidul / tutorialul primesc DOAR vederea mea (local, pe acest dispozitiv) — nimic nu pleacă spre ceilalți */
  function guideObserve() {
    const G = H.Guide(); if (!G || !G.observe || !V || !me()) return;
    try {
      const d = V.raw && V.raw.draft, m = V.me, sh = V.shop || { new: [], used: [] };
      const canBuyPlane = sh.new.some(x => x.ok !== false && (num(x.price) <= m.cash || (x.lease != null && num(x.lease) <= m.cash))) || sh.used.some(x => x.ok !== false && num(x.price) <= m.cash);
      G.observe({
        id: me(), phase: V.phase, why: V.why, paused: paused(), frozen: !!m.frozen, bankrupt: !!m.bankrupt, ended: !!ctx.ended,
        me: { co: m.co, name: m.name, av: m.av, color: m.color, base: m.base != null ? apName(m.base) : "" },
        cash: m.cash, routes: V.routes.length, permits: V.permits.length, buildable: V.permits.filter(p => p.canBuild).length, offer: V.offer.length, canDraw: !!V.canDraw,
        hand: RES_ORDER.reduce((a, k) => a + num(V.hand[k]), 0), cardPrice: V.cardPrice, canBuyPlane,
        planes: V.planes.map(p => ({ id: p.id, st: p.st, rid: p.rid, pilot: p.pilot, ferry: p.ferry })), nPlanes: V.planes.length, idle: V.planes.filter(p => p.rid == null && p.st !== "air").length,
        landings: U.landings || 0, lastProfit: U.lastLandP, day: (clockInfo() || {}).day,
        draft: d ? { mine: !!d.mine, reveal: !!d.reveal, myPicks: arr(d.picks && d.picks[me()]).length } : null,
        modal: U.modal ? U.modal.kind : null, tab: U.tab, ptab: U.ptab, phone: el.classList.contains("phone"), popRoute: U.popKind === "route" && U.selRoute != null,
      });
    } catch (e) { /* ghidul nu blochează jocul */ }
  }

  /* ---------- artă ---------- */
  function avatarHTML(av, size, mood, color) {
    const A = H.Art(); if (A && A.avatar && av != null) { try { return A.avatar(av, size || 44, mood || "neutral", { ring: null, bg: true }); } catch (e) { /* rezervă */ } }
    const f = av != null && num(av) >= 5; return `<span aria-hidden="true">${f ? "👩‍✈️" : "🧑‍✈️"}</span>`;
  }
  function planeIco(t, color, sz) { const A = H.Art(); if (A && A.planeIcon) { try { return A.planeIcon(t, color, sz || 48); } catch (e) { /* rezervă */ } } return ""; }
  function planeSide(t, color, w) { const A = H.Art(); if (A && A.planeSide) { try { return A.planeSide(t, color, { w: w || 200 }); } catch (e) { /* rezervă */ } } return `<span style="font-size:34px" aria-hidden="true">✈️</span>`; }
  function resIcon(k) { const A = H.Art(); if (A && A.cardIcon) { try { const s = A.cardIcon(k, 30); if (s) return s; } catch (e) { /* rezervă */ } } return RES[k] ? RES[k].i : "🃏"; }
  function starsTxt(n) { n = clamp(Math.round(num(n, 3) * 2) / 2, 0, 5); let s = ""; for (let i = 1; i <= 5; i++) s += n >= i ? "★" : n >= i - .5 ? "⯪" : "☆"; return s; }

  /* ================= desen ================= */
  function drawAll() {
    if (!alive) return;
    layout();
    drawTop(); try { drawTopA(); } catch (e) { console.warn("CerulUI: drawTopA", e); } drawClock(); drawTabs(); drawPane(); drawBottom(); drawPhoneTabs(); drawOverlay(); drawMap(); drawFreeze(); drawScenes();
  }

  /* ---------- bara de sus ---------- */
  function drawTop() {
    if (!V) return;
    const m = V.me, spect = !me();
    E.co.style.setProperty("--c", m.color);
    morph(E.co, spect ? `<div class="cl-av" style="--c:#9db0cf">👀</div><div><b>Spectator</b><small>vezi doar informațiile publice</small></div>`
      : `<div class="cl-av" style="--c:${m.color}">${avatarHTML(m.av, 44, m.cash < 0 ? "sad" : "neutral")}</div>${netDot(me(), false)}<div><b title="${escH(m.co)}">${escH(m.co)}</b><small>Bază: ${escH(apName(m.base))} · <span class="cl-stars" aria-label="${m.stars} stele">${starsTxt(m.stars)}</span></small></div>`);
    const cashB = E.cash.querySelector("b"), valB = E.value.querySelector("b"), debtB = E.debt.querySelector("b");
    if (spect) { cashB.textContent = "—"; valB.textContent = "—"; debtB.textContent = "—"; }
    else {
      cashB.textContent = fmtE(m.cash); cashB.style.color = m.cash < 0 ? "var(--bad)" : "var(--ok)";
      valB.textContent = fmtE(m.value);
      debtB.textContent = m.debt > 0 ? "−" + fmtE(m.debt) : "0 €"; debtB.style.color = m.debt > 0 ? "var(--bad)" : "var(--mut)";
    }
    E.debt.classList.toggle("zero", !(m.debt > 0));
    E.cash.classList.toggle("neg", m.cash < 0);
    E.cash.querySelector("small").textContent = m.cash < 0 ? `Bani · ${m.negDays != null ? Math.max(0, num(m.negDays)) + " zile să revii" : "pe minus!"}` : "Bani";
    E.cash.title = m.cash < 0 ? "Ai bani pe minus! Ai câteva zile să revii pe plus, altfel intri în faliment." : "Banii companiei";
    // oponenți — DOAR informații publice
    const oh = V.opps.map(o => `<div class="cl-op${o.frozen ? " frozen" : ""}${o.bankrupt ? " out" : ""}" data-opp="${escH(o.seat)}" title="${escH(o.co || o.name)} — ${escH(o.name)}${o.bot ? " (bot)" : ""}">${o.rank != null ? `<span class="rk">#${escH(o.rank)}</span>` : ""}<div class="cl-av" style="--c:${o.color}">${avatarHTML(o.av, 36)}</div>${netDot(o.seat, o.bot)}<div style="min-width:0"><b class="nm" style="color:${o.color}">${escH(o.co || o.name)}</b><small><span class="cl-stars sf">${starsTxt(o.stars)}</span><span class="cl-stars sc">★${Math.round(o.stars)}</span><span class="det"> · ${o.bankrupt ? "faliment" : o.frozen ? "❄️ înghețat" : `${o.inAir} în aer / ${o.planes}`}</span><span class="dc"> ${o.bankrupt ? "💥" : o.frozen ? "❄️" : `✈${o.inAir}/${o.planes}`}</span></small></div></div>`).join("");
    morph(E.opps, oh);
    el.classList.toggle("many", V.opps.length >= 3);
    el.classList.toggle("spect", !me());
    const nb = E.top.querySelector("[data-k=nego]"), bb = E.top.querySelector("[data-k=bank]"), gb = E.top.querySelector("[data-k=ghiseu]");
    const playing = canAct(), pz = paused();
    nb.disabled = !canNegoNow();
    nb.title = pz && nb.disabled ? PAUSE_T : nb.disabled && playing ? "Nu poți deschide acum o negociere (maxim una pe zi)." : "Negociază cu alt jucător (oprește timpul pentru toți)";
    bb.disabled = !playing || V.canBank === false; gb.disabled = !playing || m.frozen;
    bb.title = pz ? PAUSE_T : "Bancă: credit și rambursări"; gb.title = pz ? PAUSE_T : "Ghișeu: schimbă 5 cărți pe una la alegere sau cumpără cărți";
  }
  /* ---------- ceasul ---------- */
  function clockInfo() {
    const Lo = H.Logic(); let c = null;
    try { if (Lo && Lo.clockInfo && st) c = Lo.clockInfo(st, now()); } catch (e) { c = null; }
    return c || (V && V.clock) || null;
  }
  function drawClock() {
    const c = clockInfo(); if (!c) return;
    const day = num(c.day, 1), hh = num(c.hh), mm = num(c.mm), frac = clamp(num(c.dayFrac, (hh * 60 + mm) / 1440), 0, 1);
    const night = c.night != null ? !!c.night : (hh < 6 || hh >= 20);
    const ring = E.clock.querySelector(".cl-ring"), fg = ring.querySelector(".fg");
    fg.setAttribute("stroke-dashoffset", (113.1 * (1 - frac)).toFixed(1));
    ring.classList.toggle("night", night);
    const ic = ring.querySelector("i"); const icn = c.paused ? "⏸" : night ? "🌙" : "☀️"; if (ic.textContent !== icn) ic.textContent = icn;
    const sm = E.clock.querySelector("small"), b = E.clock.querySelector("b");
    const why = c.why === "draft" ? " · DRAFT" : c.why === "nego" ? " · NEGOCIERE" : c.why === "pause" ? " · PAUZĂ" : c.paused ? " · OPRIT" : "";
    const t1 = `ZIUA ${day}${c.monthName ? " · " + String(c.monthName).toUpperCase().slice(0, 3) : ""} · ${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}${why}`;
    if (sm.textContent !== t1) sm.textContent = t1;
    const left = c.left;
    const t2 = left == null || left === Infinity || num(left, -1) < 0 ? "Fără limită" : hms(left) + " rămas";
    if (b.textContent !== t2) b.textContent = t2;
    E.clock.classList.toggle("paused", !!c.paused);
    E.clock.classList.toggle("urgent", left != null && num(left, 1e9) < 5 * 60000 && num(left, -1) >= 0);
    E.clock.title = `Ziua ${day}, ora ${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}` + (c.paused ? " — timpul e oprit" : "");
  }

  /* ---------- panoul din dreapta ---------- */
  const TABS = [
    { k: "fleet", i: IC("plane", "✈️"), n: "Flotă", tut: "tab-fleet" }, { k: "routes", i: IC("routes", "🛣️"), n: "Rute", tut: "tab-routes" }, { k: "reports", i: IC("stats", "📊"), n: "Rapoarte", tut: "tab-reports" },
    { k: "shop", i: IC("shop", "🛒"), n: "Avioane", tut: "tab-shop" }, { k: "invest", i: IC("invest", "🏗️"), n: "Investiții", tut: "tab-invest" }, { k: "shares", i: IC("shares", "📈"), n: "Bursa", tut: "tab-shares" },
  ];
  function drawTabs() {
    if (!V) return;
    if (!me()) { morph(E.tabs, `<button role="tab" aria-selected="true" class="on">🏢 Companii</button>`); return; }
    const cnt = { fleet: V.planes.length, routes: V.routes.length };
    morph(E.tabs, TABS.map(t => `<button role="tab" aria-selected="${U.tab === t.k}" class="${U.tab === t.k ? "on" : ""}" data-tab="${t.k}" data-tut="${t.tut}" title="${t.n} (${TABS.indexOf(t) + 1})">${t.i}<span class="tl"> ${t.n}</span>${cnt[t.k] ? `<sup>${cnt[t.k]}</sup>` : ""}</button>`).join(""));
  }
  function curPaneKey() { return U.mode === "phone" ? U.ptab : U.tab; }
  function drawPane() {
    if (!V) return;
    const k = curPaneKey();
    let h = "";
    if (!me()) { morph(E.pane, publicHTML()); return; }
    if (U.mode === "phone" && U.popKind) { const ph = popupHTML(); if (ph) { morph(E.pane, `<div class="cl-psheet">${ph}</div>`); E.pane.dataset.pk = "pop"; return; } }
    if (k === "fleet") h = fleetHTML(); else if (k === "routes") h = routesHTML(); else if (k === "reports") h = reportsHTML();
    else if (k === "shop") h = shopHTML(); else if (k === "invest") h = investHTML(); else if (k === "shares") h = sharesHTML(); else if (k === "cards") h = phoneCardsHTML(); else if (k === "money") h = moneyHTML();
    if (E.pane.dataset.pk !== k) { E.pane.dataset.pk = k; E.pane.scrollTop = 0; }
    morph(E.pane, h);
  }
  /* flota */
  function otherEnd(p) { const rt = V.routes.find(r => r.id === p.rid); return p.to || (rt ? (rt.a === p.at ? rt.b : rt.a) : ""); }
  function planeState(p) {
    if (p.frozen) return { tag: `<span class="cl-tag ice">❄️ înghețat</span>`, bar: null, txt: "Operațiunile sunt oprite" };
    if (p.st === "broken") return { tag: `<span class="cl-tag bad">🔧 defect · ${escH(apName(p.at))}</span>`, bar: { w: p.seats ? p.pax / p.seats : 0, cls: "" }, txt: `Reparații · întârziere ${gdur(p.delay)} · ${p.pax}/${p.seats} pas.` };
    if (p.st === "air") {
      const prog = p.prog != null ? clamp(num(p.prog), 0, 1) : null;
      if (p.ferry) return { tag: `<span class="cl-tag">zbor gol</span>`, bar: { w: prog != null ? prog : .5, cls: "air" }, txt: `Poziționare → ${escH(apName(p.to))}${p.eta != null ? ` · ${gdur(p.eta)} rămase` : ""}` };
      return { tag: `<span class="cl-tag">în zbor</span>`, bar: { w: prog != null ? prog : .5, cls: "air" }, txt: `→ ${escH(apName(p.to))}${p.eta != null ? ` · ${gdur(p.eta)} rămase` : ""} · ${p.pax}/${p.seats} pas.` };
    }
    if (p.st === "board") {
      const full = p.pax >= p.seats;
      const tag = `<span class="cl-tag">${full ? "plin" : "se îmbarcă"}</span>`;
      let extra = "";
      if (p.go && !p.ready) extra = ` · pleacă în ${gdur(p.readyIn)}`;
      else if (!p.ready && p.readyIn) extra = ` · gata în ${gdur(p.readyIn)}`;
      return { tag, bar: { w: p.seats ? p.pax / p.seats : 0, cls: full ? "full" : "" }, txt: `<b style="color:var(--ink)">${p.pax}/${p.seats}</b> · ${escH(apName(p.at))} → ${escH(apName(otherEnd(p)))}${extra}` };
    }
    return { tag: `<span class="cl-tag">la sol</span>`, bar: null, txt: `Fără rută${p.at ? ` · în hangar la ${escH(apName(p.at))}` : ""}` };
  }
  const pminAPI = () => { const Lo = H.Logic(); return !!(Lo && typeof Lo.flightProfit === "function"); };
  function pminProfit(p, n) { const Lo = H.Logic(); if (!Lo || typeof Lo.flightProfit !== "function" || !st || !me()) return null; try { const r = Lo.flightProfit(st, me(), p.id, n); const v = r && typeof r === "object" ? pick(r, "profit", "p") : r; return v == null || !isFinite(+v) ? null : +v; } catch (e) { return null; } }
  function pminBreak(p) { if (p.beN != null) return num(p.beN) > p.seats ? null : clamp(Math.round(num(p.beN)), 1, p.seats); const Lo = H.Logic(); try { const r = Lo && Lo.flightProfit && Lo.flightProfit(st, me(), p.id, 1); const b = r && typeof r === "object" ? pick(r, "breakEven", "be") : null; if (b != null) return clamp(Math.round(num(b)), 1, p.seats); } catch (e) { /* rezervă */ }
    let lo = 1, hi = p.seats; const f = n => pminProfit(p, n); if (f(hi) == null || f(hi) < 0) return null; if (f(lo) >= 0) return 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (f(m) >= 0) hi = m; else lo = m; } return hi; }
  function pminProfitHTML(p, n) { const v = pminProfit(p, n); return v == null ? "" : `un zbor: <b class="${v >= 0 ? "pos" : "neg"}">${fmtSigned(v)}</b>`; }
  function sellOf(p) { if (p.lease) return null; if (p.sellVal != null) return num(p.sellVal); return p.value != null ? Math.round(num(p.value) * .9) : null; }
  function chainTxt(c) { return c ? `${escH(apName(c.a))} → ${escH(apName(c.b))} → ${escH(apName(c.c))}` : ""; }
  // variantele „cu escală” (LOGIC.chainOptions) — o listă fără dubluri
  function chainOpts(o, onlyRid) {
    const Lo = H.Logic(); if (!Lo || typeof Lo.chainOptions !== "function" || !st || !me()) return [];
    let l = []; try { l = arr(Lo.chainOptions(st, me(), o)); } catch (e) { l = []; }
    const seen = new Set();
    return l.filter(x => { const k = [String(x.rid), String(x.via)].sort().join("|"); if (seen.has(k)) return false; seen.add(k); return onlyRid == null || String(x.rid) === String(onlyRid) || String(x.via) === String(onlyRid); });
  }
  function chainListHTML(pid, list, sRid, sVia) {
    if (!list.length) return "";
    const okL = list.filter(x => x.ok !== false);
    if (!okL.length) return `<div class="cl-chainh"><b>🔀 Cu escală</b> <span class="cl-mut">— nicio variantă pentru acest avion (autonomie prea mică sau aeroport prea mic).</span></div>`;
    list = okL;
    return `<div class="cl-chainh"><b>🔀 Cu escală</b> <span class="cl-mut">— avionul zboară A → B → C și înapoi pe două rute ale tale; ia pasagerii fiecărei rute plus pe cei care merg direct A → C.</span></div><div class="cl-list">${list.map(x => {
      const e0 = x.ok === false ? null : est({ pid, rid: x.rid, via: x.via }), ok = x.ok !== false && !(e0 && !e0.ok), on = sVia != null && String(sRid) === String(x.rid) && String(sVia) === String(x.via);
      const why = x.ok === false ? x.why : e0 && !e0.ok ? e0.why : "";
      return `<button class="cl-opt${on ? " on" : ""}" data-mchain="${escH(x.rid)}" data-via="${escH(x.via)}" ${ok ? "" : "disabled"}><span class="grow"><b>${escH(apName(x.a))} → ${escH(apName(x.b))} → ${escH(apName(x.c))}</b><small>escală în ${escH(apName(x.b))} · ${fmtInt(num(x.d1) + num(x.d2))} km în total${ok && e0 ? (num(e0.through) > 0 ? ` · ~${fmtInt(e0.through)} pasageri/zi direct ${escH(apName(x.a))}–${escH(apName(x.c))}` : num(x.dAC) > 0 && (num(x.d1) + num(x.d2)) / num(x.dAC) >= 1.6 ? " · ocol mare: fără pasageri direcți" : "") : ""}${why ? ` · ${escH(String(why).replace(/\.$/, "").replace(/^./, ch => ch.toLowerCase()))}` : ""}</small></span>${ok ? estHTML(e0) : ""}</button>`;
    }).join("")}</div>`;
  }
  function legendHTML() {
    const pc = V.me.pilotCost;
    return `<div class="cl-legbox" role="note" aria-label="Ce înseamnă stările avioanelor">
      <b>se îmbarcă</b><span>Stă la poartă și urcă pasageri. Pleacă când apeși <b>🛫 Decolează</b> (sau singur, dacă are pilot).</span>
      <b>plin</b><span>Toate locurile sunt ocupate — decolează acum.</span>
      <b>în zbor</b><span>E în aer. Banii pe bilete îi primești la aterizare.</span>
      <b>la sol</b><span>Nu are rută: stă în hangar și nu câștigă nimic. Apasă <b>Atribuie rută</b>.</span>
      <b>🔧 defect</b><span>Se repară; pleacă cu întârziere (reputația scade puțin).</span>
      <b>👨‍✈️ pilot</b><span>Pilot automat${pc ? ` (${fmtE(pc)}/zi)` : " (salariu pe zi)"}: decolează singur când zborul merită. „fără pilot” = decolezi tu.</span>
      <b>cumpărat</b><span>L-ai plătit întreg: e al tău, intră în valoarea companiei, îl poți vinde.</span>
      <b>leasing</b><span>Închiriat: plătești chirie zilnic; devine al tău după destule zile plătite sau îl răscumperi oricând din ⋯.</span>
      <b>⋯</b><span>Opțiuni: schimbă ruta, pilot, răscumpără, vinde sau returnează.</span>
    </div>`;
  }
  /* ---------- UI-B: flotă — filtre, selecție multiplă, acțiuni în bloc ---------- */
  const FFIL = [
    { k: "neg", n: "pe minus", f: p => { const d = planeDay(p), lp = U.lastProfit[p.id] != null ? U.lastProfit[p.id] : pick(rawPl(p.id), "lp"); return (d != null && d < 0) || (d == null && lp != null && num(lp) < 0); } },
    { k: "noroute", n: "fără rută", f: p => p.rid == null },
    { k: "sub", n: "sub prag", f: p => !!p.sub },
    { k: "lease", n: "în leasing", f: p => !!p.lease },
    { k: "air", n: "în zbor", f: p => p.st === "air" },
    { k: "ground", n: "la sol", f: p => p.st !== "air" },
  ];
  function fleetInit() { if (!U.fsel) U.fsel = new Set(); if (U.ffil == null) U.ffil = String(lsGet("cerul.ffil", "") || ""); const ids = new Set(V.planes.map(p => p.id)); [...U.fsel].forEach(id => { if (!ids.has(id)) U.fsel.delete(id); }); }
  function fleetFiltered() { fleetInit(); const F = FFIL.find(f => f.k === U.ffil); return V.planes.filter(p => !F || F.f(p)); }
  function fleetFilterHTML() {
    if (V.planes.length < 2) return "";
    return `<div class="cl-ffil" role="group" aria-label="Filtre flotă"><button class="${!U.ffil ? "on" : ""}" data-ffil="" aria-pressed="${!U.ffil}">toate<b>${V.planes.length}</b></button>${FFIL.map(f => { const c = V.planes.filter(f.f).length, on = U.ffil === f.k; return `<button class="${on ? "on" : ""}" data-ffil="${f.k}" aria-pressed="${on}" ${!c && !on ? "disabled" : ""}>${f.n}<b>${c}</b></button>`; }).join("")}</div>`;
  }
  function selPlanes() { fleetInit(); return V.planes.filter(p => U.fsel.has(p.id)); }
  function bulkBarHTML() {
    const S = selPlanes(), vis = fleetFiltered();
    if (!S.length) return vis.length > 1 ? `<div style="display:flex;justify-content:flex-end;margin:-2px 0 4px"><button class="cl-fsall" data-fall>Selectează ${U.ffil ? "filtrul" : "toate"} (${vis.length})</button></div>` : "";
    const can = canAct() && !V.me.frozen, onR = S.filter(p => p.rid != null), pil = onR.filter(p => p.pilot);
    const allVis = vis.length && vis.every(p => U.fsel.has(p.id));
    return `<div class="cl-bulk" role="toolbar" aria-label="Acțiuni pentru avioanele selectate"><b>${S.length} ${S.length === 1 ? "selectat" : "selectate"}</b><button class="sa" data-fall>${allVis ? "deselectează filtrul" : `toate (${vis.length})`}</button><button class="sa" data-fnone>niciunul</button>
      <span style="flex-basis:100%;height:0"></span>
      <button class="cl-btn sm" data-bulk="pilotOn" ${!can || onR.length === pil.length ? "disabled" : ""}>👨‍✈️ Pilot pornit</button>
      <button class="cl-btn sm" data-bulk="pilotOff" ${!can || !pil.length ? "disabled" : ""}>Pilot oprit</button>
      <button class="cl-btn sm" data-bulk="pmin" ${!can || !pil.length ? "disabled" : ""} title="${pil.length ? "" : "Doar pentru avioanele cu pilot"}">🎚️ Minim</button>
      <button class="cl-btn sm" data-bulk="route" ${!can || !V.routes.length ? "disabled" : ""}>🛣️ Mută pe rută</button>
      <button class="cl-btn sm" data-bulk="price" ${!can || !onR.length ? "disabled" : ""}>🏷️ Preț</button></div>`;
  }
  function bulkSupported() { const Lo = H.Logic(); try { return !!(Lo && ((typeof Lo.hasAction === "function" && Lo.hasAction("bulk")) || (Lo.ACT && Lo.ACT.bulk) || (Lo.ACTIONS && (Array.isArray(Lo.ACTIONS) ? Lo.ACTIONS.includes("bulk") : Lo.ACTIONS.bulk)))); } catch (e) { return false; } }
  function sendMany(acts) { // aplică multe acțiuni deodată: `bulk` (atomic) dacă LOGIC îl are, altfel una câte una
    acts = acts.filter(Boolean); if (!acts.length) return 0;
    if (acts.length > 1 && acts.length <= 80 && bulkSupported()) return act("bulk", { acts: acts.map(a => Object.assign({ t: a[ACT] }, a)) }) ? acts.length : 0; // LOGIC-1: sub-acțiunile poartă și cheia `t`
    let ok = 0; for (const a of acts) if (send(a)) ok++; return ok;
  }
  function bulkAction(k) {
    const S = selPlanes(); if (!S.length) return;
    if (k === "pilotOn" || k === "pilotOff") {
      const on = k === "pilotOn", L = S.filter(p => p.rid != null && !!p.pilot !== on);
      const n = sendMany(L.map(p => ({ [ACT]: "pilot", pid: p.id, on })));
      if (n) { sfx.select(); toast(`${on ? "Pilot pornit" : "Pilot oprit"} pe ${n} ${n === 1 ? "avion" : "avioane"}.`, "", "👨‍✈️"); if (on) notify("pilotOn"); }
      return;
    }
    if (k === "pmin") { openModal("bulkmin", { pct: 60 }); return; }
    if (k === "route") { openModal("bulkroute", { sel: null }); return; }
    if (k === "price") { openModal("bulkprice", { mode: "rec" }); return; }
  }
  function bulkPriceOf(r, mode) { // prețul nou pentru o rută (ambele sensuri), după butonul ales
    const rc = recOf(r), cur = Math.round((r.price.ab + r.price.ba) / 2);
    const v = mode === "rec" ? rc.rec : mode === "normal" ? rc.normal : mode === "cheap" ? rc.cheap : mode === "premium" ? rc.premium : cur * (1 + num(mode) / 100);
    return clamp(Math.round(v), 1, Math.round(rc.normal * 10));
  }
  function fleetHTML() {
    if (!me()) return `<div class="cl-empty">Ești spectator — flota fiecărei companii e privată.</div>`;
    const ps = V.planes;
    if (!ps.length) return `<div class="cl-empty">Nu ai niciun avion.<br>Cumpără unul din tabul <b>🛒 Avioane</b>.</div>`;
    const order = { board: 0, idle: 1, broken: 2, frozen: 3, air: 4 };
    fleetInit();
    const sorted = fleetFiltered().sort((a, b) => (order[a.st] - order[b.st]) || ((b.seats ? b.pax / b.seats : 0) - (a.seats ? a.pax / a.seats : 0)) || String(a.id).localeCompare(String(b.id)));
    const inAir = ps.filter(p => p.st === "air").length, waiting = ps.filter(p => p.st === "board" && !p.pilot).length;
    let firstGo = true, firstPil = true, firstAs = true, firstPl = true;
    const can = canAct() && !V.me.frozen;
    const cards = sorted.map(p => {
      const s = planeState(p);
      const go = (p.st === "board" || p.st === "broken") && !p.pilot;
      let goBtn = "";
      if (go) {
        const queued = p.go && !p.ready;
        goBtn = `<button class="cl-go" data-go="${escH(p.id)}" ${!can || queued || p.canDepart === false && !p.ready && p.go ? "disabled" : ""} ${firstGo ? `data-tut="btn-depart"` : ""} title="${queued ? "Pleacă automat când se termină îmbarcarea" : p.ready ? `Pleacă acum cu ${p.pax} pasageri` : "Pleacă imediat ce se termină îmbarcarea minimă (45 min)"}">${queued ? "⏳ Pleacă curând" : "🛫 Decolează"}</button>`;
        firstGo = false;
      }
      const pil = p.rid != null ? `<button class="cl-pilot${p.pilot ? " on" : ""}" data-pilot="${escH(p.id)}" ${!can ? "disabled" : ""} ${firstPil ? `data-tut="pilot"` : ""} aria-pressed="${p.pilot}" title="${p.pilot ? "Pilotul decolează singur când avionul e plin sau zborul e profitabil. Apasă ca să-l concediezi." : `Angajează un pilot: avionul pleacă singur${V.me.pilotCost ? ` (${fmtE(V.me.pilotCost)}/zi)` : " (salariu pe zi)"}`}">👨‍✈️ ${p.pilot ? `pilot${p.pmin != null ? ` · min ${num(p.pmin)}/${p.seats}` : ""}${p.sub ? " · sub prag" : ""}` : "fără pilot"}</button>` : "";
      if (p.rid != null) firstPil = false;
      const asg = p.st === "idle" ? `<button class="cl-btn sm" data-assign="${escH(p.id)}" ${!can ? "disabled" : ""} ${firstAs ? `data-tut="assign"` : ""}>Atribuie rută</button>` : "";
      if (p.st === "idle") firstAs = false;
      const prof = U.lastProfit[p.id] != null && p.st !== "board" ? `<span class="cl-tag ${U.lastProfit[p.id] >= 0 ? "ok" : "bad"}">${fmtSigned(U.lastProfit[p.id])}</span>` : "";
      const tut = firstPl ? ` data-tut="plane"` : ""; firstPl = false;
      const ck = U.fsel.has(p.id);
      return `<div class="cl-pl${U.selPlane === p.id ? " sel" : ""}${ck ? " chk" : ""}${go && p.ready && p.pax >= p.seats * .8 ? " ready" : ""}${p.frozen ? " frz" : ""}" data-plane="${escH(p.id)}" data-key="p${escH(p.id)}" tabindex="0" aria-label="${escH(p.tinfo.n)} ${escH(p.name)}"${tut}>
        <div class="h"><button class="cl-fchk${ck ? " on" : ""}" data-fsel="${escH(p.id)}" role="checkbox" aria-checked="${ck}" aria-label="Selectează ${escH(p.name)}" title="Selectează pentru acțiuni în bloc"></button><b>${escH(p.tinfo.n)} „${escH(p.name)}”${p.lease && p.daysToOwn == null ? ` <em>· leasing</em>` : ""}</b><span class="tg">${pil}${s.tag}</span></div>
        ${s.bar ? `<div class="cl-bar ${s.bar.cls}" role="progressbar" aria-label="${p.st === "air" ? "Progresul zborului" : "Pasageri îmbarcați"}" aria-valuenow="${Math.round(s.bar.w * 100)}" aria-valuemin="0" aria-valuemax="100"><i style="width:${(clamp(s.bar.w, 0, 1) * 100).toFixed(1)}%"></i></div>` : `<div style="height:6px"></div>`}
        ${p.lease && p.daysToOwn != null ? (() => { const fr = num(p.leaseTarget) > 0 ? clamp(num(p.leasePaid) / num(p.leaseTarget), 0, 1) : 0; return `<div class="cl-chainl ls" title="Chiria plătită se adună; când ajunge la ținta de ${fmtE(p.leaseTarget)} avionul devine al tău">📄 Leasing: <b class="cl-route3">al tău în ${num(p.daysToOwn)} ${num(p.daysToOwn) === 1 ? "zi" : "zile"}</b> (${Math.round(fr * 100)}% plătit)${p.buyoutPrice != null ? ` · răscumpără acum cu ${fmtE(p.buyoutPrice)}` : ""}</div><div class="cl-bar" style="height:3px;margin-top:2px"><i style="width:${(fr * 100).toFixed(1)}%;background:#ffd35c"></i></div>`; })() : ""}
        ${p.waitGate ? `<div class="cl-chainl" style="color:#ffd35c">⏳ așteaptă poartă liberă${typeof p.waitGate === "string" ? ` la ${escH(apName(p.waitGate))}` : p.to ? ` la ${escH(apName(p.to))}` : ""}</div>` : ""}
        ${p.chain ? `<div class="cl-chainl">🔀 cu escală: <span class="cl-route3">${chainTxt(p.chain)}</span></div>` : ""}
        <div class="r">${goBtn || asg ? "" : `<span class="pi" data-raw aria-hidden="true">${planeIco(p.tinfo.k, V.me.color, 48)}</span>`}<span class="tx">${s.txt}</span><span class="acts">${prof}${goBtn}${asg}<button class="cl-btn sm ghost" data-pmenu="${escH(p.id)}" aria-label="Opțiuni avion: rută, pilot, vânzare" title="Opțiuni: schimbă ruta, pilot, vinde / returnează">⋯</button></span></div>
      </div>`;
    }).join("");
    const idle = ps.filter(p => p.st === "idle").length;
    return `<div class="cl-sum" data-tut="fleet"><span>Total <b>${ps.length}</b></span><span>În aer <b>${inAir}</b></span><span title="Avioane la poartă fără pilot: decolează doar când apeși tu">Așteaptă 🛫 de la tine <b>${waiting}</b></span>${idle ? `<span title="Fără rută — nu câștigă nimic">Fără rută <b class="neg">${idle}</b></span>` : ""}<span>Cu pilot <b>${ps.filter(p => p.pilot).length}</b></span><button class="cl-qbtn${U.legend ? " on" : ""}" data-legend aria-expanded="${!!U.legend}">${U.legend ? "✕ Închide" : "❓ Ce înseamnă?"}</button></div>${U.legend ? legendHTML() : ""}${fleetFilterHTML()}${bulkBarHTML()}${cards || `<div class="cl-fempty">Niciun avion în filtrul „${escH((FFIL.find(f => f.k === U.ffil) || {}).n || "")}”. <button class="cl-btn sm ghost" data-ffil="${escH(U.ffil)}">Arată toate</button></div>`}`;
  }
  function publicHTML() {
    const list = V.opps.slice().sort((a, b) => num(a.rank, 9) - num(b.rank, 9));
    return `<div style="font-size:12.5px;color:var(--mut)">Ești spectator: vezi doar informațiile publice. Prețurile, profiturile și cărțile fiecărei companii sunt private.</div>` + list.map(o => `<div class="cl-shr" data-key="pu${escH(o.seat)}"><div class="cl-av" style="--c:${o.color}">${avatarHTML(o.av, 38)}</div><div style="min-width:0"><b style="color:${o.color}">${escH(o.co || o.name)}</b><small>${escH(o.name)} · <span class="cl-stars">${starsTxt(o.stars)}</span><br>${o.routes.length === 1 ? "1 rută" : o.routes.length + " rute"} · ${o.planes === 1 ? "1 avion" : o.planes + " avioane"} · ${o.inAir} în aer${o.frozen ? " · ❄️ înghețată" : ""}${o.bankrupt ? " · 💥 faliment" : ""}</small></div><b style="font-size:20px;color:var(--gold)">${o.rank != null ? "#" + escH(o.rank) : ""}</b></div>`).join("");
  }
  /* rute */
  function routeLoad(r) { const ps = V.planes.filter(p => p.rid === r.id && p.st === "board"); if (!ps.length) return r.load; return ps.reduce((a, p) => a + p.pax, 0) / Math.max(1, ps.reduce((a, p) => a + p.seats, 0)); }
  function routesHTML() {
    if (!me()) return `<div class="cl-empty">Ești spectator — prețurile și profiturile rutelor sunt private.</div>`;
    if (!V.routes.length) return `<div class="cl-empty">Nu ai încă nicio rută.<br>Trage un <b>permis</b> (jos), adună cărțile cerute și apasă <b>Construiește</b>.</div>`;
    const tot = V.routes.reduce((a, r) => a + r.profitToday, 0);
    return `<div class="cl-sum"><span>Rute <b>${V.routes.length}</b></span><span>Profit azi <b class="${tot >= 0 ? "pos" : "neg"}">${fmtSigned(tot)}</b></span></div>` + V.routes.slice().sort((a, b) => b.profitToday - a.profitToday).map(r => {
      const ld = routeLoad(r);
      return `<div class="cl-rt${U.selRoute === r.id ? " sel" : ""}" data-route="${escH(r.id)}" data-key="r${escH(r.id)}" tabindex="0" role="button" aria-label="Ruta ${escH(apName(r.a))} – ${escH(apName(r.b))}">
        <div class="h"><b>${escH(apName(r.a))} ⇄ ${escH(apName(r.b))}</b><span class="cl-tag ${r.profitToday >= 0 ? "ok" : "bad"}">${fmtSigned(r.profitToday)}</span></div>
        <div class="m"><span>${fmtInt(r.dist)} km</span><span>Cerere <b>${fmtInt(r.demand)}/zi</b></span><span>Cota ta <b>${Math.round(r.share * 100)}%</b></span>${r.comp ? `<span>⚔️ ${r.comp} rivali</span>` : ""}</div>
        <div class="m"><span>Preț <b>${fmtE(r.price.ab)}</b>${r.price.ba !== r.price.ab ? ` / <b>${fmtE(r.price.ba)}</b>` : ""}</span><span>✈️ <b>${r.planes}</b></span>${ld != null ? `<span>Încărcare <b>${Math.round(num(ld) * 100)}%</b></span>` : ""}${r.boom ? `<span>📈 boom</span>` : ""}${r.pioneer ? `<span>🏅 pionier</span>` : ""}${r.building ? `<span>🏗️ în construcție</span>` : ""}</div>
      </div>`;
    }).join("");
  }
  /* rapoarte */
  function reportsHTML() {
    if (!me()) return `<div class="cl-empty">Rapoartele sunt private.</div>`;
    const pl = V.pl.map(d => ({ day: pick(d, "day", "d"), rev: num(pick(d, "rev", "revenue", "in")), cost: num(pick(d, "cost", "costs", "out")), profit: pick(d, "profit", "p") != null ? num(pick(d, "profit", "p")) : num(pick(d, "rev", "revenue", "in")) - num(pick(d, "cost", "costs", "out")) })).slice(-14);
    let chart = "";
    if (pl.length) {
      const Wd = 360, Hh = 170, pad = 40, maxV = Math.max(1, ...pl.map(d => Math.max(d.rev, d.cost, Math.abs(d.profit))));
      // profitul poate fi negativ: zona sub 0 rezervată pentru linia de profit
      const minV = Math.min(0, ...pl.map(d => d.profit)), bw = (Wd - pad - 6) / pl.length, sc = (Hh - 40) / (maxV - minV), y0 = Hh - 22 + minV * sc;
      let bars = "", pts = [];
      pl.forEach((d, i) => {
        const x = pad + i * bw;
        bars += `<rect x="${(x + bw * .12).toFixed(1)}" y="${(y0 - d.rev * sc).toFixed(1)}" width="${(bw * .36).toFixed(1)}" height="${(d.rev * sc).toFixed(1)}" rx="2" fill="#5fd3dc"><title>Ziua ${d.day}: venituri ${fmtE(d.rev)}</title></rect>`;
        bars += `<rect x="${(x + bw * .5).toFixed(1)}" y="${(y0 - d.cost * sc).toFixed(1)}" width="${(bw * .36).toFixed(1)}" height="${(d.cost * sc).toFixed(1)}" rx="2" fill="#ff6b6b" opacity=".85"><title>Ziua ${d.day}: costuri ${fmtE(d.cost)}</title></rect>`;
        pts.push(`${(x + bw / 2).toFixed(1)},${(y0 - d.profit * sc).toFixed(1)}`);
        if (pl.length <= 10 || i % 2 === 0) bars += `<text x="${(x + bw / 2).toFixed(1)}" y="${Hh - 6}" text-anchor="middle">${escH(d.day)}</text>`;
      });
      const grid = (minV < 0 ? [minV / maxV, 0, .5, 1] : [0, .5, 1]).map(f => `<line x1="${pad}" x2="${Wd}" y1="${(y0 - maxV * f * sc).toFixed(1)}" y2="${(y0 - maxV * f * sc).toFixed(1)}" stroke="#22324f"/><text x="${pad - 4}" y="${(y0 - maxV * f * sc + 4).toFixed(1)}" text-anchor="end">${escH(axisFmt(maxV * f))}</text>`).join("");
      chart = `<div class="cl-chart"><div class="cl-h"><span>Profit pe zile (ultimele ${pl.length})</span><span>${fmtSigned(pl[pl.length - 1].profit)} ieri</span></div><svg viewBox="0 0 ${Wd} ${Hh}" role="img" aria-label="Grafic venituri și costuri pe zile">${grid}${bars}<polyline points="${pts.join(" ")}" fill="none" stroke="#ffd35c" stroke-width="2.5" stroke-linejoin="round"/>${pts.map(p => `<circle cx="${p.split(",")[0]}" cy="${p.split(",")[1]}" r="3" fill="#ffd35c"/>`).join("")}</svg><div class="cl-leg"><span><i style="background:#5fd3dc"></i>venituri</span><span><i style="background:#ff6b6b"></i>costuri</span><span><i style="background:#ffd35c"></i>profit</span></div></div>`;
    } else chart = `<div class="cl-chart cl-empty">Graficul apare după prima zi încheiată.</div>`;
    const rs = V.routes.slice().sort((a, b) => b.profitToday - a.profitToday), mx = Math.max(1, ...rs.map(r => Math.abs(r.profitToday)));
    const best = rs.length ? `<div class="cl-chart"><div class="cl-h" style="margin-bottom:6px"><span>Cele mai bune rute azi</span></div><div class="cl-best">${rs.slice(0, 8).map(r => `<span>${escH(apName(r.a))} – ${escH(apName(r.b))}</span><div class="bb"><i class="${r.profitToday < 0 ? "n" : ""}" style="width:${(Math.abs(r.profitToday) / mx * 100).toFixed(0)}%"></i></div><b class="${r.profitToday >= 0 ? "pos" : "neg"}">${fmtSigned(r.profitToday)}</b>`).join("")}</div></div>` : "";
    const tot = pl.reduce((a, d) => a + d.profit, 0);
    const cons = consultantRow();
    return `<div class="cl-sum"><span>Valoare <b>${fmtE(V.me.value)}</b></span><span>Profit ${pl.length} zile <b class="${tot >= 0 ? "pos" : "neg"}">${fmtSigned(tot)}</b></span>${V.me.rank != null ? `<span>Locul aproximativ <b>#${escH(V.me.rank)}</b></span>` : ""}</div>${chart}${best}${cons}`;
  }
  function axisFmt(n) { n = Math.round(n); if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(".", ",") + " M"; if (Math.abs(n) >= 1e3) return Math.round(n / 1e3) + " k"; return String(n); }
  function consultantRow() {
    const on = V.me.consultant;
    return `<div class="cl-chart" style="display:flex;gap:10px;align-items:center"><div class="cl-av" style="--c:var(--gold);width:46px;height:46px;background:#fffbe8">${consArt(46)}</div><div style="flex:1;min-width:0"><b>Consultant</b><div style="color:var(--mut);font-size:12.5px">${on ? "Îți dă sfaturi la 1–2 zile și uneori îți șoptește o carte din draft." : `Sfaturi personalizate${V.me.consCost ? ` · ${fmtE(V.me.consCost)}/zi` : " · cost pe zi"}`}</div></div><button class="cl-btn sm ${on ? "" : "gold"}" data-cons="${on ? 0 : 1}" ${!canAct() ? "disabled" : ""}>${on ? "Concediază" : "Angajează"}</button></div>`;
  }
  function consArt(sz) { const A = H.Art(); if (A && A.consultant) { try { return A.consultant(sz, "happy"); } catch (e) { /* rezervă */ } } return `<span style="font-size:${Math.round(sz * .55)}px">🧑‍💼</span>`; }
  /* magazin avioane */
  // „Pe rutele tale”: pe ce rute ale MELE poate zbura un tip nou + estimarea (CerulLogic.estimate)
  const FITC = new Map();
  function fitRoutes(ty) {
    const key = ty + "|" + V.routes.map(r => r.id).join(",") + "|" + num(st && st.day) + "|" + Math.floor(now() / 5000);
    if (FITC.has(key)) return FITC.get(key);
    const t = ptInfo(ty), ok = []; let far = 0, bad = 0;
    for (const r of V.routes) {
      if (r.dist > t.range) { far++; continue; }
      const e = est({ type: ty, rid: r.id });
      if (e && !e.ok) { bad++; continue; }
      ok.push({ r, e });
    }
    ok.sort((x, y) => num(y.e && y.e.profit, -1e12) - num(x.e && x.e.profit, -1e12));
    const out = { ok, far, bad, n: V.routes.length };
    if (FITC.size > 60) FITC.clear(); FITC.set(key, out);
    return out;
  }
  // zile de chirie până devine al tău: preț nou × ownMult / chiria pe zi (LOGIC: leaseInfo)
  function ownD(x, price, fee) { const v = pick(x || {}, "own", "daysToOwn", "ownDays"); if (v != null && num(v) > 0) return Math.round(num(v)); const om = num(pick((W.CerulTune || {}).lease || {}, "ownMult"), 1.15); return price > 0 && num(fee) > 0 ? Math.ceil(price * om / num(fee)) : null; }
  function fitHTML(ty) {
    const f = fitRoutes(ty);
    if (!f.n) return `<div class="cl-fitr"><span class="lb">Pe rutele tale:</span> <span class="cl-mut">încă nu ai rute.</span></div>`;
    if (!f.ok.length) return `<div class="cl-fitr"><span class="lb">Pe rutele tale:</span> <span class="neg">nu poate zbura pe niciuna</span> <small class="cl-mut">(${f.far ? "prea lungi" : ""}${f.far && f.bad ? ", " : ""}${f.bad ? "aeroporturi prea mici" : ""})</small></div>`;
    const top = f.ok.slice(0, 2).map(({ r, e }) => `<span class="ch"><span class="rn">${escH(apName(r.a))}–${escH(apName(r.b))}</span>${e && e.ok ? `${e.load != null ? `<small>~${Math.round(e.load * 100)}% plin</small>` : ""}${e.profit != null ? `<b class="${e.profit >= 0 ? "pos" : "neg"}">${fmtDay(e.profit)}</b>` : ""}` : ""}</span>`).join("");
    return `<div class="cl-fitr"><span class="lb">Pe rutele tale: zboară pe ${f.ok.length} din ${f.n}${f.ok.length > 2 ? " · cele mai bune:" : ":"}</span>${top}</div>`;
  }
  function shopHTML() {
    if (!me()) return `<div class="cl-empty">Doar jucătorii pot cumpăra avioane.</div>`;
    const sh = V.shop, cash = V.me.cash, can = canAct();
    const seg = `<div class="cl-seg" role="tablist"><button class="${U.shopSeg === "new" ? "on" : ""}" data-seg="new">Noi & leasing</button><button class="${U.shopSeg === "used" ? "on" : ""}" data-seg="used">Second-hand${arr(pick(sh, "used")).length ? ` <sup>${arr(pick(sh, "used")).length}</sup>` : ""}</button><button class="${U.shopSeg === "sell" ? "on" : ""}" data-seg="sell">Vinde</button></div>`;
    let body = "";
    if (U.shopSeg === "new") {
      const byTy = {}; arr(pick(sh, "new", "types")).forEach(x => { byTy[ptIdx(pick(x, "type", "k", "id"))] = x; });
      const rsh = (V.raw && V.raw.shop) || {}, maxL = pick(rsh, "maxLeased"), nL = num(pick(rsh, "leased"));
      const tune = W.CerulTune || {}, sellM = num(pick(tune.planes || {}, "sellMult"), .9), retD = num(pick(tune.lease || {}, "returnFeeDays"), 3);
      const leaseFull = maxL != null && nL >= num(maxL);
      let first = true;
      body = `<div class="cl-explain"><div><b>💶 Cumperi</b> — plătești tot prețul acum; avionul e al tău, intră în valoarea companiei și îl poți vinde oricând (~${Math.round(sellM * 100)}% din valoarea de atunci).</div><div><b>📄 Leasing</b> — 0 € acum, plătești o chirie în fiecare zi; devine al tău după destule zile plătite sau îl răscumperi oricând. Îl poți returna (costă ${retD} zile de chirie).${maxL != null ? ` Ai ${nL}/${num(maxL)} în leasing.` : ""}</div></div>` + ptOrder().map(ty => {
        const x = byTy[ty] || {}, t = ptInfo(ty), price = num(pick(x, "price"), t.price || 0), lease = pick(x, "lease") != null ? pick(x, "lease") : t.lease;
        const tut = first ? ` data-tut="shop-new"` : ""; first = false;
        const ckm = Math.round(t.ckm * num(V.me.fuelMult, 1) + (t.speed ? t.crewH / t.speed : 0));
        const miss = price - cash, buyWhy = !can ? (paused() ? PAUSE_T : "Acum nu poți cumpăra.") : miss > 0 ? `Îți lipsesc ${fmtE(miss)}` : x.ok === false ? "Nu poți cumpăra acum" : "";
        const leaseWhy = !can ? buyWhy : leaseFull ? `Ai deja ${num(maxL)} avioane în leasing (maximul)` : "";
        return `<div class="cl-shop" data-key="n${escH(t.k)}">
          <div class="top"><div class="art" data-raw>${planeSide(t.k, V.me.color, 160)}</div><div class="nm"><b>${escH(t.n)}</b>${t.nCls ? `<small>${escH(t.nCls)}</small>` : ""}<span class="pr">${fmtE(price)}</span></div></div>
          ${t.role ? `<div class="role">${escH(t.role)}</div>` : ""}
          <div class="cl-pspec"><span><b>${t.seats}</b>locuri<i>pasageri pe zbor</i></span><span><b>${fmtInt(t.range)} km</b>rază<i>cea mai lungă rută</i></span><span><b>${t.speed} km/h</b>viteză<i>mai rapid = mai multe zboruri/zi</i></span><span><b>~${fmtInt(ckm)} €</b>cost pe km<i>combustibil + echipaj</i></span></div>
          ${t.minSize >= 2 ? `<div class="cl-why">⚠️ Nu aterizează pe aeroporturi mici.</div>` : ""}
          ${fitHTML(ty)}
          <div class="btns"><button class="cl-btn gold" data-buy="${ty}"${tut} ${buyWhy ? "disabled" : ""} title="${escH(buyWhy || "Plătești acum, avionul e al tău")}">💶 Cumpără · ${fmtE(price)}</button>${lease != null ? `<button class="cl-btn" data-lease="${ty}" ${leaseWhy ? "disabled" : ""} title="${escH(leaseWhy || "0 € acum, chirie zilnică")}">📄 Leasing · ${fmtE(lease, true)}/zi</button>` : ""}</div>
          ${lease != null ? `<small class="cl-why">📄 Leasing ${fmtE(lease)}/zi${(() => { const lr = V.raw && V.raw.leaseRamp; return lr && num(lr.today, 1) < 1 ? ` · <b>azi doar ${fmtE(Math.round(num(lease) * num(lr.today)))}/zi (${Math.round(num(lr.today) * 100)}%)</b>, chiria întreagă din ziua ${num(lr.fullFrom)}` : ""; })()}${ownD(x, price, lease) ? ` · devine al tău după ~${ownD(x, price, lease)} zile` : ""} · îl poți răscumpăra oricând</small>` : ""}
          ${buyWhy && can ? `<small class="cl-why">Cumpărare: ${escH(buyWhy)}${leaseWhy ? "" : " — leasingul merge fără bani acum."}</small>` : ""}${leaseWhy && can && leaseFull ? `<small class="cl-why">Leasing: ${escH(leaseWhy)}</small>` : ""}</div>`;
      }).join("");
    } else if (U.shopSeg === "used") {
      const used = arr(pick(sh, "used"));
      body = used.length ? `<div style="font-size:12.5px;color:var(--mut)">Mai ieftine, dar mai vechi: se strică mai des (întârzieri → reputație). Piața se reînnoiește săptămânal.</div>` + used.map(u => {
        const t = ptInfo(pick(u, "type", "k")), price = num(pick(u, "price"));
        return `<div class="cl-used" data-key="u${escH(pick(u, "id"))}"><span data-raw>${planeSide(t.k, "#9aa7bd", 64)}</span><div><b>${escH(t.n)}</b><small>${t.role ? escH(t.role) + "<br>" : ""}${pick(u, "age") != null ? `${escH(pick(u, "age"))} zile vechime · ` : ""}${pick(u, "wear", "cond") != null ? `uzură ${Math.round(num(pick(u, "wear", "cond")) * 100)}% · ` : ""}${t.seats} locuri</small></div><button class="cl-btn gold sm" data-buyused="${escH(pick(u, "id"))}" data-type="${t.ty}" ${!can || cash < price ? "disabled" : ""}>${fmtE(price)}</button></div>`;
      }).join("") : `<div class="cl-empty">Nu e niciun avion second-hand acum. Revino săptămâna viitoare.</div>`;
    } else {
      body = V.planes.length ? `<div style="font-size:12.5px;color:var(--mut)">Primești ~90% din valoarea de acum (avioanele pierd ~0,4% pe zi). Avioanele în leasing se returnează (costă câteva zile de chirie).</div>` + V.planes.map(p => `<div class="cl-used" data-key="s${escH(p.id)}"><span data-raw>${planeSide(p.type, V.me.color, 64)}</span><div><b>${escH(p.tinfo.n)} „${escH(p.name)}”</b><small>${p.age != null ? `${escH(p.age)} zile · ` : ""}${p.st === "air" ? "în zbor (poți vinde după aterizare)" : p.rid != null ? "pe rută" : "în hangar"}</small></div><button class="cl-btn sm red" data-sell="${escH(p.id)}" ${!can || p.st === "air" ? "disabled" : ""}>${p.lease ? "Returnează" : sellOf(p) != null ? "Vinde · " + fmtE(sellOf(p)) : "Vinde"}</button></div>`).join("") : `<div class="cl-empty">Nu ai avioane de vândut.</div>`;
    }
    return seg + body;
  }
  /* investiții (joc târziu) — V.raw.invest de la LOGIC */
  const pctS = (x, sg) => `${sg}${Math.round(num(x) * 100)}%`;
  function invBtn(attrs, price, ok, why, lbl) {
    const can = canAct() && ok !== false && (price == null || V.me.cash >= num(price));
    const t = !canAct() ? (paused() ? PAUSE_T : "Acum nu poți investi.") : why || (price != null && V.me.cash < num(price) ? "Nu ai destui bani" : "");
    return `<button class="cl-btn gold" ${attrs} ${can ? "" : "disabled"}${t ? ` title="${escH(t)}"` : ""}>${lbl}${price != null ? ` · ${fmtE(price)}` : ""}</button>`;
  }
  function investHTML() {
    if (!me()) return `<div class="cl-empty">Investițiile companiilor sunt private.</div>`;
    const I = V.raw && V.raw.invest;
    if (!I) return `<div class="cl-empty">Investițiile nu sunt disponibile în această partidă.</div>`;
    const b = I.base || {}, t = I.term || {}, eco = arr(I.eco), m = I.mnt || {};
    const vm = num(I.valueMult, .5);
    const dots = (n, mx) => `<span class="cl-lvl" aria-label="nivel ${n} din ${mx}">${Array.from({ length: mx }, (_, i) => `<i class="${i < n ? "on" : ""}"></i>`).join("")}</span>`;
    const why = (o, ok) => !ok && o.why ? `<small class="cl-why">${escH(o.why)}</small>` : "";
    const lvl = num(b.lvl), bmax = num(b.max, 3);
    const baseC = `<div class="cl-inv" data-key="ivb"><div class="h"><span class="ic">🛫</span><div class="t"><b>Extinde baza</b><small>${escH(apName(V.me.base))} · nivel ${lvl}/${bmax}</small></div>${dots(lvl, bmax)}</div>
      <div class="fx"><span>${pctS(b.demand, "+")} cerere pe rutele din bază</span><span>+${num(b.slots, 1)} slot</span><span>${pctS(b.fee, "−")} taxe la bază</span><em>per nivel</em></div>
      <div class="ft">${b.price != null ? invBtn(`data-inv="base"`, b.price, b.ok, b.why, `Nivelul ${lvl + 1}`) : `<span class="cl-done">✓ Nivel maxim</span>`}${b.price != null ? why(b, b.ok) : ""}</div></div>`;
    const have = arr(t.have), cand = arr(t.cand), tmax = num(t.max, 3);
    const tsel = U.invAp && cand.includes(U.invAp) ? U.invAp : cand[0];
    const termC = `<div class="cl-inv" data-key="ivt"><div class="h"><span class="ic">🏢</span><div class="t"><b>Terminal propriu</b><small>pe un aeroport mare unde ai slot · ${have.length}/${tmax}</small></div>${dots(have.length, tmax)}</div>
      <div class="fx"><span>${pctS(t.share, "+")} cotă de piață pe rutele de acolo</span><span>+${String(num(t.stars, .15)).replace(".", ",")} ★ reputație</span></div>
      ${have.length ? `<div class="chips">${have.map(a => `<span class="cl-chip have">✓ ${escH(apName(a))}</span>`).join("")}</div>` : ""}
      ${have.length < tmax && cand.length ? `<div class="chips" role="group" aria-label="Alege aeroportul">${cand.map(a => `<button class="cl-chip${a === tsel ? " on" : ""}" data-invap="${escH(a)}">${escH(apName(a))}</button>`).join("")}</div>` : ""}
      <div class="ft">${have.length >= tmax ? `<span class="cl-done">✓ Toate terminalele</span>` : invBtn(`data-inv="term" data-ap="${escH(tsel || "")}"`, t.price, t.ok && !!tsel, t.why, tsel ? `Terminal ${escH(apName(tsel))}` : "Terminal")}${have.length < tmax ? why(t, t.ok) : ""}</div></div>`;
    const ecoC = `<div class="cl-inv" data-key="ive"><div class="h"><span class="ic">🌿</span><div class="t"><b>Flotă eco</b><small>motoare noi, pe tip de avion</small></div></div>
      <div class="fx"><span>${pctS((eco[0] || {}).fuel, "−")} combustibil pentru tipul ales</span></div>
      <div class="rows">${ptOrder().map(i => eco.find(e => num(e.ty) === i)).filter(Boolean).map(e => `<div class="er"><span class="nm">${escH(ptInfo(e.ty).n)}</span>${e.have ? `<span class="cl-done">✓ eco</span>` : invBtn(`data-inv="eco" data-ty="${num(e.ty)}"`, e.price, e.ok, e.why, "Modernizează")}</div>`).join("")}</div></div>`;
    const mntC = `<div class="cl-inv" data-key="ivm"><div class="h"><span class="ic">🔧</span><div class="t"><b>Centru de mentenanță</b><small>o singură dată</small></div></div>
      <div class="fx"><span>${pctS(m.maint, "−")} întreținere</span><span>${pctS(m.breakdown, "−")} defecțiuni</span>${m.dep != null ? `<span>${pctS(m.dep, "−")} uzură</span>` : ""}</div>
      <div class="ft">${m.have ? `<span class="cl-done">✓ Construit</span>` : invBtn(`data-inv="mnt"`, m.price, m.ok, m.why, "Construiește")}${m.have ? "" : why(m, m.ok)}</div></div>`;
    const HI = V.hubInfo, hitems = HI ? arr(HI.items) : [], hsel = hitems.find(x => x.ap === U.hubAp) || hitems.find(x => x.ok) || hitems[0];
    const hubC = HI ? `<div class="cl-inv" data-key="ivh"><div class="h"><span class="ic">🔁</span><div class="t"><b>Hub</b><small>pe un aeroport unde ai slot · ${arr(HI.have).length}/${num(HI.max, 3)}</small></div>${dots(arr(HI.have).length, num(HI.max, 3))}</div>
      <div class="fx"><span>−${Math.round((1 - num(hsel ? hsel.fee : .5, .5)) * 100)}% taxe de aterizare acolo</span><span>+${Math.round((num(hsel ? hsel.transit : 1.5, 1.5) - 1) * 100)}% pasageri în tranzit</span><span>+${num(hsel ? hsel.slots : 1, 1)} slot</span></div>
      ${arr(HI.have).length ? `<div class="chips">${arr(HI.have).map(a => `<span class="cl-chip have">✓ ${escH(apName(a))}</span>`).join("")}</div>` : ""}
      ${hitems.length ? `<div class="chips" role="group" aria-label="Alege aeroportul hubului">${hitems.map(x => `<button class="cl-chip${hsel && x.ap === hsel.ap ? " on" : ""}" data-hubap="${escH(x.ap)}">${escH(apName(x.ap))} · ${fmtE(x.price, true)}</button>`).join("")}</div>` : ""}
      <div class="ft">${hsel ? invBtn(`data-hub="${escH(hsel.ap)}"`, hsel.price, hsel.ok !== false, hsel.why, `Hub ${escH(apName(hsel.ap))}`) : `<span class="cl-why">${num(HI.left, 1) <= 0 ? "Ai toate huburile" : "Cumpără întâi un slot (sau construiește o rută) pe un aeroport"}</span>`}${hsel && hsel.ok === false && hsel.why ? why(hsel, false) : ""}</div></div>` : "";
    return `<div class="cl-sum"><span>Investit <b>${fmtE(num(I.spent))}</b></span><span>Valoare acum <b>${fmtE(num(I.value, num(I.spent)))}</b></span><span class="cl-mut" style="font-size:12px">−${Math.round(num(I.decay, .02) * 100)}%/zi, minim ${Math.round(vm * 100)}%</span></div>` + baseC + hubC + termC + ecoC + mntC;
  }
  /* bursa */
  function sharesHTML() {
    const rows = V.shares;
    const head = `<div style="font-size:12.5px;color:var(--mut);line-height:1.45">Fiecare companie are 100 de acțiuni. Poți cumpăra până la 49 din acțiunile altei companii (preț = valoarea companiei / 100, +2% comision). Proprietarul le poate răscumpăra. La final, acțiunile valorează același procent din valoarea finală.</div>`;
    if (!rows.length) return head + `<div class="cl-empty">Bursa nu are încă date.</div>`;
    return head + rows.map(r => {
      const seat = r.seat, isMe = seat === me(), o = isMe ? V.me : (V.opps.find(x => x.seat === seat) || {});
      const price = r.price, mine = r.own, can = canAct() && !o.bankrupt;
      const canBuy = isMe ? r.held > 0 : mine < 49;
      const txt = isMe ? `${r.held} acțiuni sunt la alții · le poți răscumpăra` : `ai <b style="color:var(--ink)">${mine}</b> / max 49${r.held ? ` · ${r.held} la alți jucători` : ""}`;
      const bar = isMe ? `<div class="own"><i style="width:${100 - r.held}%;background:${V.me.color}"></i><i style="width:${r.held}%;background:#5b6b88"></i></div>` : `<div class="own"><i style="width:${mine}%;background:${V.me.color}"></i><i style="width:${r.held}%;background:#5b6b88"></i><i style="width:${Math.max(0, 100 - mine - r.held)}%;background:${o.color || "#888"}"></i></div>`;
      return `<div class="cl-shr" data-key="sh${escH(seat)}"><div class="cl-av" style="--c:${o.color || "#888"}">${avatarHTML(o.av, 38)}</div><div style="min-width:0"><b>${escH(o.co || o.name || nameOf(seat))}${isMe ? " (tu)" : ""}</b><small>${fmtE(price)} / acțiune · ${txt}</small>${bar}</div>
        <div style="display:flex;flex-direction:column;gap:4px"><button class="cl-btn sm gold" data-shbuy="${escH(seat)}" ${!can || !canBuy || V.me.cash < price * 1.02 ? "disabled" : ""}>${isMe ? "Răscumpără" : "Cumpără"}</button>${isMe ? "" : `<button class="cl-btn sm" data-shsell="${escH(seat)}" ${!can || mine <= 0 ? "disabled" : ""}>Vinde</button>`}</div></div>`;
    }).join("");
  }
  /* telefon: cărți + permise + speciale; bani */
  function phoneCardsHTML() {
    return `<div class="cl-pbox"><div class="cl-h"><span>Cărțile tale</span><span class="cl-cardsx">${cardsExtraHTML(true)}</span></div><div class="cl-boxb">${cardsHTML()}</div>
      <div class="cl-h"><span>Permise (max ${V.maxPermits})</span></div><div class="cl-boxb" data-tut="permits">${permitsHTML()}</div>
      <div class="cl-h"><span>Cărți speciale</span></div><div class="cl-boxb" data-tut="specials">${specialsHTML()}</div></div>`;
  }
  function moneyHTML() {
    const m = V.me, can = canAct();
    return `<div class="cl-sum"><span>Bani <b class="${m.cash < 0 ? "neg" : "pos"}">${fmtE(m.cash)}</b></span><span>Valoare <b>${fmtE(m.value)}</b></span><span>Credit <b>${m.debt > 0 ? "−" + fmtE(m.debt) : "0 €"}</b></span></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <button class="cl-btn gold" data-k="nego" ${!canNegoNow() ? "disabled" : ""}>🤝 Negociază</button><button class="cl-btn" data-k="bank" ${!can ? "disabled" : ""}>🏦 Bancă</button>
        <button class="cl-btn" data-k="ghiseu" ${!can ? "disabled" : ""}>🃏 Ghișeu</button><button class="cl-btn" data-k="guide">📖 Ghid</button>
        <button class="cl-btn" data-k="table">👥 Masă</button><button class="cl-btn" data-k="rules">❓ Reguli</button>
      </div>
      <div class="cl-seg"><button class="${U.mtab !== "shares" && U.mtab !== "invest" ? "on" : ""}" data-mtab="rep">📊 Rapoarte</button><button class="${U.mtab === "invest" ? "on" : ""}" data-mtab="invest" data-tut="tab-invest">🏗️ Investiții</button><button class="${U.mtab === "shares" ? "on" : ""}" data-mtab="shares">📈 Bursa</button></div>
      ${U.mtab === "shares" ? sharesHTML() : U.mtab === "invest" ? investHTML() : reportsHTML()}`;
  }

  /* ---------- jos: cărți, permise, speciale ---------- */
  function cardsHTML() {
    const h = V.hand;
    return RES_ORDER.map(k => {
      const n = num(h[k]), r = RES[k];
      return `<div class="cl-rc ${k === "joker" ? "joker" : ""}${n ? "" : " zero"}${U.bumped[k] ? " bump" : ""}" style="${k === "joker" ? "" : `background:linear-gradient(160deg,${r.c},${shade(r.c, -.35)})`}" title="${r.n}: ai ${n}" data-key="c${k}"><span class="ic" data-raw>${resIcon(k)}</span><span>${r.s}</span><em>${n}</em></div>`;
    }).join("");
  }
  function cardsExtraHTML(btns) {
    if (!btns) return "";
    const can = canAct() && !V.me.frozen, pr = V.cardPrice;
    return `<button class="cl-btn sm" data-k="ghiseu" ${!can ? "disabled" : ""} title="Schimbă 5 cărți normale pe una la alegere">🃏 Ghișeu</button><button class="cl-btn sm" data-buycard ${!can || (pr != null && V.me.cash < pr) ? "disabled" : ""} title="Cumpără o carte aleatorie${pr != null ? " cu " + fmtE(pr) : ""} (prețul crește la fiecare carte cumpărată în aceeași zi)">💶 ${pr != null ? fmtE(pr, true) : "Cumpără"}</button>`;
  }
  function shade(hex, k) { const A = H.Art(); if (A && A.shade) { try { return A.shade(hex, k); } catch (e) { /* rezervă */ } } return hex; }
  function buildPlan(p) {
    // ce cărți folosim: tipurile cerute din mână, golurile umplute cu Joker
    const cost = {}; for (const k in p.cost) { const rk = resKey(k) || k; cost[rk] = (cost[rk] || 0) + num(p.cost[k]); }
    const have = Object.assign({}, V.hand), use = {}, icons = []; let miss = 0, jUsed = 0;
    for (const k of ["apr", "inf", "ech", "comb"]) {
      const need = num(cost[k]); if (!need) continue;
      const h = Math.min(need, num(have[k])); if (h) use[k] = h;
      for (let i = 0; i < h; i++) icons.push({ k, ok: 1 });
      for (let i = h; i < need; i++) { if (num(have.joker) - jUsed > 0) { jUsed++; icons.push({ k, j: 1 }); } else { miss++; icons.push({ k, x: 1 }); } }
    }
    if (num(cost.joker)) { for (let i = 0; i < num(cost.joker); i++) { if (num(have.joker) - jUsed > 0) { jUsed++; icons.push({ k: "joker", ok: 1 }); } else { miss++; icons.push({ k: "joker", x: 1 }); } } }
    if (jUsed) use.joker = jUsed;
    if (p.missing && typeof p.missing === "object") { let m2 = 0; for (const k in p.missing) m2 += num(p.missing[k]); if (!jUsed) miss = Math.max(miss, m2 - num(have.joker)); }
    const out = RIDX.map(k => num(use[k]));
    return { use: out, icons, miss, jUsed, missTypes: icons.filter(i => i.x).map(i => i.k) };
  }
  function permitsHTML() {
    const ps = V.permits, can = canAct() && !V.me.frozen;
    let firstB = true;
    const cards = ps.map(p => {
      const pl = buildPlan(p), ok = p.canBuild != null ? !!p.canBuild && pl.miss === 0 : pl.miss === 0;
      const needH = pl.icons.map(i => `<i class="${i.x ? "x" : i.j ? "j" : ""}" title="${RES[i.k].n}${i.x ? " — lipsește" : i.j ? " — acoperit cu Joker" : ""}">${i.j ? "⭐" : RES[i.k].i}</i>`).join("");
      const missTxt = pl.miss ? (pl.miss > 1 ? `lipsesc ${pl.miss} cărți` : "lipsește 1 carte") : (p.canBuild === false ? (p.why || "nu se poate acum") : pl.jUsed ? `cu ${pl.jUsed} ⭐ Joker` : "ai toate cărțile");
      const slotBad = p.slots.some(x => x && x.ok === false);
      const btn = ok ? `<button class="cl-btn sm gold" data-build="${escH(p.id)}" ${!can ? "disabled" : ""} ${firstB ? `data-tut="btn-build"` : ""} title="Construiește ruta${pl.jUsed ? ` (folosești ${pl.jUsed} Joker)` : ""}${p.slotCost ? ` · sloturi ${fmtE(p.slotCost)}` : ""}">→ Construiește</button>` : `<small class="mt">${missTxt}</small>`;
      if (ok) firstB = false;
      const tip = `${apName(p.a)} → ${apName(p.b)} · ${fmtInt(p.dist)} km${p.cls ? " · " + p.cls : ""} — ${missTxt}${p.slotCost ? ` · sloturi ${fmtE(p.slotCost)}` : ""}${p.why ? " · " + p.why : ""}`;
      return `<div class="cl-pm${ok ? " can" : ""}" data-permit="${escH(p.id)}" data-key="pm${escH(p.id)}" title="${escH(tip)}">
        <button class="del" data-discard="${escH(p.id)}" aria-label="Renunță la permis" title="${can ? "Renunță (penalizare mică)" : "Acum nu poți renunța la permis"}" ${!can ? "disabled" : ""}>✕</button>
        <b>${escH(apName(p.a))} → ${escH(apName(p.b))}<span class="cl-eye" role="button" data-pv="${escH(p.a)}|${escH(p.b)}" aria-label="Arată ruta pe hartă">👁</span></b>
        <div class="ft"><div class="need" aria-label="Cărți necesare">${needH}</div>${btn}</div>
        <small class="st">${ok ? missTxt : `${fmtInt(p.dist)} km`}${p.slotCost ? ` · slot ${fmtE(p.slotCost, true)}` : ""}${slotBad ? " · ⚠️ slot ocupat" : ""}</small></div>`;
    }).join("");
    let add = "";
    if (ps.length < V.maxPermits) add = `<button class="cl-pm add" data-draw data-tut="btn-draw" ${!can || !V.canDraw ? "disabled" : ""}><span><b style="padding:0">＋ Trage permis</b><span style="color:var(--mut)">(ai loc pentru încă ${V.maxPermits - ps.length})</span></span></button>`;
    if (V.offer.length) add = `<button class="cl-pm add can" data-offer style="opacity:1"><span><b style="padding:0">🎟️ Alege permisele</b><span style="color:var(--mut)">${V.offer.length} oferite — păstrează cel puțin unul</span></span></button>`;
    return cards + add || `<div class="cl-empty">—</div>`;
  }
  function specialsHTML() {
    const sp = V.specials;
    if (!sp.length) return `<div class="cl-empty" style="padding:6px;text-align:left">Nicio carte specială. Le poți primi la draftul de la sfârșitul zilei sau cu noroc (6%).</div>`;
    const can = canAct() && !V.me.frozen;
    return sp.map(s => {
      const inf = specInfo(s.k);
      if (inf.tgt === "auto") return `<div class="cl-sc ${inf.sk === "breaker" ? "fire" : ""}" style="cursor:help" title="${escH(inf.d || (inf.sk === "breaker" ? "Se folosește când cineva te îngheață: ai 5 secunde să confirmi." : "Se folosește automat când te lovește un eveniment negativ."))}" data-key="s${inf.sk}"><span class="ic">${inf.i}</span>${escH(inf.n)}<u style="color:#ffe7c4;text-decoration:none">automat</u>${s.count > 1 ? `<em>${s.count}</em>` : ""}</div>`;
      const dis = !can || s.canPlay === false;
      return `<button class="cl-sc ${inf.cls || ""}" data-play="${escH(s.k)}" ${dis ? "disabled" : ""} title="${escH(inf.d || inf.n)}${dis ? " — acum nu se poate folosi" : ""}" data-key="s${inf.sk}"><span class="ic">${inf.i}</span>${escH(inf.n)}<u>${dis ? "indisponibil" : "Folosește"}</u>${s.count > 1 ? `<em>${s.count}</em>` : ""}</button>`;
    }).join("");
  }
  function drawBottom() {
    if (!V || U.mode === "phone") return;
    morph(E.cards, me() ? cardsHTML() : `<div class="cl-empty">Cărțile jucătorilor sunt private.</div>`);
    morph(E.cardsx, me() ? cardsExtraHTML(true) : "");
    morph(E.perms, me() ? permitsHTML() : "");
    morph(E.specs, me() ? specialsHTML() : "");
    // cărți speciale compacte (2 rânduri) când nu încap ca plăcuțe mari
    const bw = E.specs.clientWidth || 0, nsp = V.specials.length;
    E.specs.classList.toggle("cl-spx", nsp > 0 && (U.mode === "mid" ? nsp > 3 : nsp * 112 > bw + 4));
  }
  /* ---------- telefon: bara de taburi ---------- */
  const PTABS = [{ k: "fleet", i: IC("plane", "✈️"), n: "Flotă", tut: "tab-fleet" }, { k: "routes", i: IC("routes", "🛣️"), n: "Rute", tut: "tab-routes" }, { k: "cards", i: IC("cards", "🃏"), n: "Cărți", tut: "cards" }, { k: "shop", i: IC("shop", "🛒"), n: "Avioane", tut: "tab-shop" }, { k: "money", i: IC("cash", "💰"), n: "Bani", tut: "tab-reports" }];
  function drawPhoneTabs() {
    if (!V || U.mode !== "phone") return;
    const ready = V.planes.filter(p => p.st === "board" && !p.pilot).length, canB = V.permits.filter(p => buildPlan(p).miss === 0).length;
    const bd = { fleet: ready, cards: canB + (V.offer.length ? 1 : 0) };
    morph(E.ptabs, PTABS.map(t => `<button class="${U.ptab === t.k ? "on" : ""}" data-ptab="${t.k}" data-tut="${t.tut}" aria-pressed="${U.ptab === t.k}"><i ${t.k === "cards" ? `data-tut="permits"` : t.k === "money" ? `data-tut="btn-bank"` : ""}>${t.i}</i><span ${t.k === "cards" ? `data-tut="specials"` : t.k === "money" ? `data-tut="tab-shares"` : ""}>${t.n}</span>${bd[t.k] ? `<span class="bdg">${bd[t.k]}</span>` : ""}</button>`).join(""));
  }

  /* ---------- suprapuneri pe hartă ---------- */
  function drawOverlay() {
    if (!V) return;
    // pauză: un singur mesaj clar pe hartă (butoanele de acțiune sunt dezactivate)
    const pz = paused() && V.phase === "play";
    const pzBy = pz ? (() => { try { const s = st && st.pz && st.pz.s; return s ? (s === me() ? "tine" : (V.opps.find(o => o.seat === s) || {}).name || nameOf(s)) : ""; } catch (e) { return ""; } })() : "";
    morph(E.pz, pz ? `<div class="cl-pzc" role="status"><b>⏸ Pauză${pzBy ? ` <small>·&nbsp;cerută&nbsp;de ${escH(pzBy)}</small>` : ""}</b><span>Poți doar să te uiți${V.canNego.length ? " sau să negociezi" : ""}.</span>${me() && V.canPause !== false ? `<button class="cl-btn sm gold" data-k="pause">▶️ Continuă</button>` : ""}</div>` : "");
    // evenimente active (+ bonusul de start)
    const sb = startBonus();
    morph(E.evs, (sb ? `<div class="cl-ev start" data-key="evstart" tabindex="0" title="Start de companie: taxele de aeroport și leasingul costă cu ${sb.pct}% mai puțin în zilele 1–${sb.last}."><i>🌱</i><span>Start de companie: −${sb.pct}% taxe, zilele 1–${sb.last}</span><em class="sp">−${sb.pct}% taxe</em><small>${sb.left === 1 ? "ultima zi" : `încă ${sb.left} zile`}</small></div>` : "") + V.events.slice(0, sb ? 4 : 5).map(ev => {
      const e = evInfo(ev), lt = evLeftTxt(e), head = e.chip || (e.n + (e.where ? " · " + e.where : ""));
      return `<div class="cl-ev ${e.mood}" data-evi="${V.events.indexOf(ev)}" role="button" title="${escH(head + (e.ef ? ": " + e.ef : "") + (lt ? " (" + lt + ")" : "") + "\n" + e.txt)}" tabindex="0"><i>${e.icon}</i><span>${escH(head)}${e.ef ? `<em class="ef">: ${escH(e.ef)}</em>` : ""}</span>${lt ? `<small>${escH(lt)}</small>` : ""}</div>`;
    }).join(""));
    // legenda
    const oc = V.opps.filter(o => !o.bankrupt).map(o => `<span><i style="background:${o.color}"></i>${escH(o.co || o.name)}</span>`).join("");
    morph(E.legend, `${me() ? `<span><i style="background:${V.me.color}"></i>rutele tale</span>` : ""}${oc}${oc ? `<span title="Vezi doar traseele rivalilor; prețurile și profiturile lor sunt private">🔒 rivali: doar traseul</span>` : ""}<span><i style="background:repeating-linear-gradient(90deg,#ccc 0 4px,transparent 4px 7px)"></i>în construcție</span><span>🌙 noapte</span>`);
    // consultant
    drawConsultant();
    // avioane care așteaptă „Decolează” (vizibile mereu, mai ales în „doar harta” și pe telefon)
    const ready = me() ? V.planes.filter(p => p.st === "board" && !p.pilot && p.canDepart !== false && p.pax > 0).sort((a, b) => b.pax / b.seats - a.pax / a.seats) : [];
    const showReady = U.maponly || U.mode === "phone" || (U.tab !== "fleet");
    morph(E.ready, showReady ? ready.slice(0, U.mode === "phone" ? 2 : 4).map(p => `<button class="cl-go" data-go="${escH(p.id)}" data-key="g${escH(p.id)}" ${!canAct() || V.me.frozen ? "disabled" : ""} title="${escH(p.tinfo.sh)} „${escH(p.name)}” la ${escH(apName(p.at))}">🛫 ${escH(p.name)} <small>${p.pax}/${p.seats}</small></button>`).join("") : "");
    // popup
    drawPopup();
    E.top.querySelector("[data-k=maponly]") || 0;
    const mo = el.querySelector("[data-k=maponly]"); mo.classList.toggle("on", U.maponly); mo.setAttribute("aria-pressed", U.maponly); mo.title = U.maponly ? "Arată panourile (M)" : "Doar harta (M)";
  }
  /* „Start de companie” — din vedere (orice formă rezonabilă) sau din CerulTune + ziua curentă */
  function startBonus() {
    if (!V || !me() || V.phase !== "play" && V.phase !== "nego") return null;
    const r = V.raw || {}, co = (r.co && typeof r.co === "object") ? r.co : {};
    const day = num(pick(r, "day"), num((clockInfo() || {}).day, 1));
    const has = "startBonus" in co;
    let sb = has ? co.startBonus : pick(co, "start", "sb", "newco");
    if (sb == null && !has) sb = pick(r, "start", "startBonus", "startB");
    if (has && !sb) return null;
    let left = null, pct = 50, last = 10;
    const T = W.CerulTune, tk = T && T.start && T.start.bonusDays != null ? T.start : null;
    if (tk) { last = num(tk.bonusDays, 10); const m = pick(tk, "bonusFeeMult"); if (m != null && num(m) < 1) pct = Math.round((1 - num(m)) * 100); }
    if (sb && typeof sb === "object") {
      const u = pick(sb, "until", "to", "end", "last", "lastDay"); if (u != null) last = num(u, last);
      left = pick(sb, "left", "days", "daysLeft"); if (left == null && u != null) left = num(u) - day + 1;
      const m = pick(sb, "mult", "m", "feeMult"); if (m != null && num(m) < 1) pct = Math.round((1 - num(m)) * 100);
      const pc = pick(sb, "pct", "off", "cut"); if (pc != null) pct = num(pc) <= 1 ? Math.round(num(pc) * 100) : Math.round(num(pc));
      if (pick(sb, "on", "active") === false) return null;
    } else if (typeof sb === "number") { left = sb; }
    else if (sb === true) left = Math.max(1, last - day + 1);
    else if (sb == null && tk) left = last - day + 1;
    if (left == null || num(left) <= 0) return null;
    return { left: Math.ceil(num(left)), pct, last };
  }
  function evInfo(ev) {
    const k = pick(ev, "k", "id"), D = H.Data(); let def = null;
    try { def = D && D.EVENTS && D.EVENTS.find(x => x.id === k); } catch (e) { def = null; }
    const neg = pick(ev, "neg") != null ? !!ev.neg : def ? (def.neg || def.mood === "rau") : false;
    const where = pick(ev, "tgName") || "";
    let txt = pick(ev, "txt", "d") || (def && def.d) || "";
    txt = String(txt).replace(/\{[a-z]+\}/g, where);
    return { key: (pick(ev, "id") != null ? ev.id : k) + "|" + (pick(ev, "tg") || ""), n: pick(ev, "n") || (def && def.n) || "Eveniment", icon: pick(ev, "icon") || (def && def.icon) || "📰", mood: neg ? "rau" : "bun", txt, where: where || pick(ev, "loc") || "", left: pick(ev, "left"),
      leftMin: pick(ev, "leftMin"), chip: pick(ev, "chip") || "", ef: pick(ev, "ef") || (def && def.ef) || "" };
  }
  function evLeftTxt(e) { // timpul rămas în unități naturale
    if (e.leftMin != null && isFinite(+e.leftMin)) { const m = Math.max(0, Math.round(+e.leftMin)); if (m < 60) return `încă ${Math.max(1, m)} min`; const h = Math.floor(m / 60), r = Math.round((m % 60) / 10) * 10; return r && r < 60 ? `încă ${h} h ${r} min` : `încă ${r >= 60 ? h + 1 : h} h`; }
    if (e.left == null) return ""; const d = num(e.left); return d <= 1 ? "azi" : `încă ${d} zile`;
  }
  function drawConsultant() {
    const tip = V.tip, txt = tip ? (typeof tip === "string" ? tip : pick(tip, "text", "t", "msg")) : "";
    const ov = E.consw.parentNode;
    if (!me() || !V.me.consultant || !txt) { morph(E.consw, ""); ov.classList.remove("hascons"); return; }
    const key = typeof tip === "object" && tip ? String(pick(tip, "day", "id", "k") || "") + txt : txt;
    if (key !== U.consKey) { U.consKey = key; U.consHide = false; U.consT = now(); sfx.ping(); }
    if (!U.consHide && now() - U.consT > (U.mode === "phone" ? 9000 : 40000)) U.consHide = true;
    ov.classList.toggle("hascons", !U.consHide);
    if (U.consHide) { morph(E.consw, `<button class="cl-consmini" data-cons-show title="Ultimul sfat al consultantului" aria-label="Arată sfatul consultantului" data-tut="consultant">${consArt(42)}</button>`); return; }
    morph(E.consw, `<div class="cl-cons" data-tut="consultant" role="status"><div class="cl-av" data-cons-hide title="Ascunde">${consArt(48)}</div><div class="cl-bubble"><b>Consultantul tău:</b> „${escH(txt)}”<button class="cl-x" data-cons-hide aria-label="Închide sfatul">✕</button></div></div>`);
  }
  /* popup rută / aeroport / rută rivală */
  function recOf(r) {
    const Lo = H.Logic(); let rc = null;
    const d = U.dir === "ba" ? "ba" : "ab";
    try { if (Lo && Lo.recommend) rc = Lo.recommend(st, me(), r.id, d); } catch (e) { rc = null; }
    rc = rc || r.rec || {};
    const normal = num(pick(rc, "normal", "n"), 0) || num(r.normal, 0) || Math.round(60 + r.dist * .1);
    return { cheap: num(pick(rc, "cheap", "ieftin"), Math.round(normal * .75)), normal, premium: num(pick(rc, "premium"), Math.round(normal * 1.4)), rec: num(pick(rc, "rec", "best"), normal), estLoad: pick(rc, "estLoad", "load"), weak: !!pick(rc, "weak") };
  }
  function drawPopup() {
    if (U.mode === "phone") { morph(E.popw, ""); if (V) drawPane(); return; }
    morph(E.popw, popupHTML());
    placePopup();
  }
  function popupHTML() {
    if (!V || U.selRoute == null && U.selAp == null && U.popKind !== "opp" && U.popKind !== "plane") return "";
    let h = "";
    if (U.popKind === "route" && U.selRoute != null) {
      const r = V.routes.find(x => x.id === U.selRoute);
      if (!r) { U.selRoute = null; return ""; }
      const rc = recOf(r), dir = U.dir, cur = dir === "ba" ? r.price.ba : r.price.ab;
      if (U.draft.rid !== r.id || U.draft.dir !== dir) U.draft = { rid: r.id, dir, p: cur };
      const p = Math.round(num(U.draft.p, cur)), from = dir === "ba" ? r.b : r.a, to = dir === "ba" ? r.a : r.b;
      const presets = [["cheap", "💸 Ieftin", rc.cheap], ["normal", "Normal", rc.normal], ["premium", "💎 Premium", rc.premium]];
      const minP = Math.max(1, Math.round(rc.normal * .3)), maxP = Math.round(rc.normal * 3);
      const share = clamp(dir === "both" ? r.share : r.shares[dir], 0, 1), dem = dir === "both" ? r.demand : r.dem[dir], dirty = p !== cur;
      const estL = estLoadAt(r, rc, p), pe = estRoute(r, dir, p);
      h = `<div class="cl-pop" data-tut="route-popup" role="dialog" aria-label="Ruta ${escH(apName(r.a))} – ${escH(apName(r.b))}">
        <button class="cl-x" data-popclose aria-label="Închide">✕</button>
        <h4>✈️ ${escH(apName(from))} → ${escH(apName(to))}</h4>
        <div class="cl-dir" role="group" aria-label="Direcția"><button class="${dir === "ab" ? "on" : ""}" data-dir="ab">${escH(apName(r.a))} →</button><button class="${dir === "ba" ? "on" : ""}" data-dir="ba">← ${escH(apName(r.b))}</button><button class="${dir === "both" ? "on" : ""}" data-dir="both">⇄ ambele</button></div>
        ${(() => { // titlul mare: câștigul net pe zi al rutei la prețurile de acum (toate avioanele mele de pe ea)
          const en = estRoute(r, "both"), v = en && en.profit != null ? en.profit : r.planes ? null : 0;
          return `<div class="cl-rhead" data-tut="route-net"><small>Ruta asta:</small><b class="${num(v != null ? v : r.profitToday) >= 0 ? "pos" : "neg"}">${v != null ? fmtSigned(v) + "/zi" : fmtSigned(r.profitToday) + " azi"}</b><small>(net)</small>${!r.planes ? `<div class="nx">Niciun avion pe rută.</div>` : en && en.load != null ? `<div class="nx">~${Math.round(en.load * 100)}% plin · ${r.planes} ${r.planes === 1 ? "avion" : "avioane"}</div>` : ""}</div>`;
        })()}
        <div class="row">Prețul tău <b>${fmtE(cur)}${dir === "both" && r.price.ba !== r.price.ab ? ` / ${fmtE(r.price.ba)}` : ""}</b></div>
        <div class="cl-pres" data-tut="price-presets">${presets.map(([k, n, v]) => `<button data-preset="${Math.round(v)}" class="${Math.abs(cur - v) < 1 ? "on" : ""}" ${!canAct() ? "disabled" : ""}>${n}<b>${fmtE(v)}</b></button>`).join("")}</div>
        <div class="cl-pin" data-tut="price"><input class="cl-num" type="text" inputmode="numeric" autocomplete="off" value="${fmtInt(p)}" data-pinput aria-label="Preț bilet în euro"><span>€</span><input type="range" min="${minP}" max="${maxP}" step="1" value="${clamp(p, minP, maxP)}" data-prange aria-label="Glisor preț"></div>
        <button class="cl-btn ${dirty ? "gold" : ""}" data-papply ${!canAct() || !dirty ? "disabled" : ""}>${dirty ? `Aplică ${fmtE(p)}${dir === "both" ? " pe ambele direcții" : ""}` : "Prețul e aplicat"}</button>
        ${pe && dirty ? `<div class="row cl-erow" data-tut="price-est"><span style="white-space:nowrap">La ${fmtE(p)}: ruta</span>${estHTML(Object.assign({}, pe, { profit: pe.profit }))}</div>` : estL != null && dirty ? `<div class="row">La ${fmtE(p)} <b>~${Math.round(estL * 100)}% plin (estimare)</b></div>` : ""}
        ${me() ? `<button class="cl-btn ${r.planes === 0 ? "gold" : "ghost sm"}" data-putplane="${escH(r.id)}" ${!canAct() ? "disabled" : ""}>${r.planes === 0 ? "✈️ Pune un avion pe rută" : "＋ Încă un avion pe rută"}</button>` : ""}
        <div class="cl-rdet">
        <div class="row">Pasageri/zi${dir === "both" ? " (ambele sensuri)" : ""} <b>${fmtInt(dem)} (tu ${Math.round(share * 100)}%)</b></div>
        <div class="cl-sharebar" title="Cota ta din cerere"><i style="width:${(share * 100).toFixed(0)}%;background:${V.me.color}"></i><i style="width:${((1 - share) * 100).toFixed(0)}%;background:#3a4a66"></i></div>
        <div class="row">Recomandat <b style="color:var(--gold)">${fmtE(rc.rec)}${rc.estLoad != null && num(rc.estLoad) >= .4 ? ` · ~${Math.round(num(rc.estLoad) * 100)}% plin` : rc.estLoad != null ? ` <small class="cl-mut" style="font-weight:600" title="Prea multe locuri pentru cererea de aici">· cerere mică</small>` : ""}</b></div>
        <div class="row" title="Venitul de azi minus zborurile de azi și partea scursă din costurile fixe ale avioanelor de pe rută (întreținere, leasing, piloți).">Profit azi (net) <b class="${r.profitToday >= 0 ? "pos" : "neg"}">${fmtSigned(r.profitToday)}</b></div>${r.fixedDay ? `<div class="row">zboruri ${fmtSigned(r.flightsToday)} · avioane −${fmtE(r.fixedDay)}/zi</div>` : ""}
        <div class="row">Avioane pe rută <b>${r.planes} · ${fmtInt(r.dist)} km</b></div>
        ${r.wait ? `<div class="row">Așteaptă în ${escH(apName(r.a))} <b>${fmtInt(num(pick(r.wait, "ab")))} pas.</b></div><div class="row">Așteaptă în ${escH(apName(r.b))} <b>${fmtInt(num(pick(r.wait, "ba")))} pas.</b></div>` : ""}
        ${r.comp ? `<div class="row">Rivali pe rută <b>⚔️ ${r.comp}</b></div>` : ""}${r.closed ? `<div class="row" style="color:var(--bad)">⛔ Rută închisă temporar (eveniment)</div>` : ""}
        </div>
      </div>`;
    } else if (U.popKind === "opp" && U.oppRoute) {
      const o = U.oppRoute, op = V.opps.find(x => x.seat === o.seat) || {};
      const spy = V.spy && V.spy.target === o.seat && String(V.spy.rid) === String(o.id) ? { price: V.spy.pa === V.spy.pb ? V.spy.pa : `${V.spy.pa}/${V.spy.pb}`, profit: V.spy.today } : null;
      h = `<div class="cl-pop" role="dialog"><button class="cl-x" data-popclose aria-label="Închide">✕</button><h4><span style="color:${op.color || "#5fd3dc"}">●</span> ${escH(apName(o.a))} – ${escH(apName(o.b))}</h4>
        <div class="row">Companie <b>${escH(op.co || op.name || "rival")}</b></div><div class="row">Distanță <b>${fmtInt(dist(o.a, o.b))} km</b></div>
        ${spy ? `<div class="row">🔍 Preț (spion) <b>${typeof spy.price === "string" ? escH(spy.price) + " €" : fmtE(spy.price)}</b></div><div class="row">🔍 Profit azi <b>${fmtSigned(pick(spy, "profit"))}</b></div>` : `<div class="row" style="color:var(--mut)">Prețurile și profitul rivalilor sunt private. (🔍 Spionul le arată o zi.)</div>`}</div>`;
    } else if (U.popKind === "ap" && U.selAp != null) {
      const a = apObj(U.selAp), myR = V.routes.filter(r => r.a === a.id || r.b === a.id), isBase = V.me.base === a.id, hub = V.me.hubs.includes(a.id);
      const presence = isBase || hub || myR.length > 0;
      const tags = arr(a.tags).map(t => { const D = H.Data(); const tg = D && D.TAGS && D.TAGS[t]; return `<span class="cl-tag">${tg ? tg.icon + " " : ""}${escH(tg ? tg.n : t)}</span>`; }).join(" ");
      const MA = V.map && V.map.airports && V.map.airports[a.id];
      const AP = me() ? apPanelData(a.id) : null, busy = !!(AP && (AP.planes.length || AP.waiting.length || AP.opts.length));
      const moreOpen = U.apMoreFor === a.id ? !!U.apMore : !busy;
      h = `<div class="cl-pop ap" role="dialog" aria-label="Aeroport ${escH(a.n)}"><button class="cl-x" data-popclose aria-label="Închide">✕</button><h4>🛬 ${escH(a.n)}${a.c ? ` <small style="color:var(--mut);font-weight:600">${escH(a.c)}</small>` : ""}</h4>
        <div class="row">Aeroport <b>${SIZE_N[a.size] || "—"}${isBase ? " · baza ta" : ""}${hub ? " · hubul tău" : ""}</b></div>
        ${tags ? `<div style="display:flex;gap:4px;flex-wrap:wrap">${tags}</div>` : ""}
        ${AP ? apPanelHTML(a, AP) : ""}
        <details class="cl-apmore" ${moreOpen ? "open" : ""}><summary data-apmore="${escH(a.id)}">Sloturi, porți, hub${a.size >= 3 ? ", terminal" : ""}</summary><div>
        ${MA ? `<div class="row">Sloturi <b>${num(MA.slots)}/${num(MA.cap)} companii${MA.mine ? " · ai slot ✓" : num(MA.slots) >= num(MA.cap) ? " · plin" : ""}</b></div><small class="cl-apx">Câte companii pot opera aici. Când e plin, nimeni nou nu mai intră.</small>` : ""}
        ${MA && MA.gates && typeof MA.gates === "object" ? (() => { const g = MA.gates, bc = g.byCompany || g.by || {}, mine = num(bc[me()] != null ? bc[me()] : 0); return `<div class="row">Porți <b>${num(g.used)}/${num(g.total)} ocupate${me() ? ` (tu ${mine})` : ""}</b></div><small class="cl-apx">${V.me.base === a.id ? "La baza ta avioanele tale nu ocupă porți. " : ""}Fiecare avion la sol ocupă o poartă. Când sunt toate ocupate, avioanele care vor să vină aici așteaptă la plecare.</small>`; })() : ""}
        ${me() ? apBuyHTML(a) : ""}</div></details>
      </div>`;
    } else if (U.popKind === "plane" && U.selPlane != null) {
      h = planeCardHTML();
    }
    return h;
  }
  // butoanele de cumpărat pe aeroport: slot, hub, terminal — fiecare cu preț, efect într-un rând și motivul când e blocat
  function hubItem(ap) {
    const HI = V.hubInfo; let it = HI ? arr(HI.items).find(x => x.ap === ap) : null;
    const Lo = H.Logic();
    if (!it && Lo && typeof Lo.hubInfo === "function" && st && me()) { try { it = Lo.hubInfo(st, me(), ap); } catch (e) { it = null; } }
    return it || null;
  }
  function apBuyHTML(a) {
    const MA = (V.map && V.map.airports && V.map.airports[a.id]) || null, ca = canAct(), cash = V.me.cash, rsh = (V.raw && V.raw.shop) || {};
    const lock = !ca ? (paused() ? "Jocul e pe pauză" : "Acum nu poți cumpăra") : "";
    const money = pr => pr > cash ? `Îți lipsesc ${fmtE(pr - cash)}` : "";
    const rowB = (attrs, lbl, pr, fx, why) => `<div class="cl-buyrow"><button class="cl-btn" ${attrs} ${why ? "disabled" : ""}>${lbl}${pr != null ? ` · ${fmtE(pr)}` : ""}</button><small>${fx}</small>${why ? `<small class="cl-why">🔒 ${escH(why)}</small>` : ""}</div>`;
    let h = "";
    const mine = !!(MA && MA.mine) || V.me.base === a.id || V.me.hubs.includes(a.id) || V.routes.some(r => r.a === a.id || r.b === a.id);
    // slot
    if (!mine) {
      const pr = pick(arr(rsh.slotPrice), a.size) != null ? num(arr(rsh.slotPrice)[a.size]) : null, full = MA && num(MA.slots) >= num(MA.cap);
      h += rowB(`data-slotbuy="${escH(a.id)}" data-pr="${pr == null ? "" : pr}"`, "🎫 Cumpără slot", pr, "Dreptul de a opera aici: îți trebuie pentru rute, hub sau terminal. Sloturile sunt limitate — cine le ia primul, le are.", lock || (full ? "Aeroport plin — niciun slot liber" : pr != null ? money(pr) : ""));
    }
    // hub
    const isHub = V.me.hubs.includes(a.id);
    if (isHub) h += `<div class="row">Hub <b class="pos">✓ al tău</b></div>`;
    else {
      const it = hubItem(a.id), HI = V.hubInfo;
      const pr = it ? num(it.price) : pick(arr(rsh.hubPrice), a.size) != null ? num(arr(rsh.hubPrice)[a.size]) : null;
      const fee = it && it.fee != null ? num(it.fee) : .5, tr = it && it.transit != null ? num(it.transit) : 1.5, sl = it && it.slots != null ? num(it.slots) : 1;
      const fx = `Taxe de aterizare −${Math.round((1 - fee) * 100)}% aici, +${Math.round((tr - 1) * 100)}% pasageri în tranzit (cei care schimbă avionul aici), +${sl} slot.`;
      const why = lock || (it ? (it.ok === false ? it.why || "Nu poți acum" : "") : !mine ? "Ai nevoie de un slot aici (cumpără-l mai sus)" : HI && num(HI.left, 1) <= 0 ? `Ai deja ${num(HI.max, 3)} huburi (maximul)` : pr != null ? money(pr) : "");
      h += rowB(`data-hub="${escH(a.id)}"`, "🔁 Cumpără hub", pr, fx, why);
    }
    // terminal (doar aeroporturi mari)
    const I = V.raw && V.raw.invest, t = I && I.term;
    if (t && a.size >= 3) {
      if (arr(t.have).includes(a.id)) h += `<div class="row">Terminal propriu <b class="pos">✓ al tău</b></div>`;
      else {
        const why = lock || (arr(t.have).length >= num(t.max, 3) ? `Ai deja ${num(t.max, 3)} terminale` : !arr(t.cand).includes(a.id) ? "Ai nevoie de un slot aici" : money(num(t.price)) || (t.ok === false && t.why ? t.why : ""));
        h += rowB(`data-inv="term" data-ap="${escH(a.id)}"`, "🏢 Terminal propriu", num(t.price), `+${Math.round(num(t.share, .2) * 100)}% cotă de piață pe rutele tale de aici și +${String(num(t.stars, .15)).replace(".", ",")} ★ reputație.`, why);
      }
    }
    return h;
  }
  /* ---------- UI-B: panoul aeroportului — avioanele tale la sol, pasageri care așteaptă, stare, O sugestie (cifre), rute posibile ---------- */
  function rawPl(id) { return arr(V && V.raw && V.raw.planes).find(x => String(x.id) === String(id)) || {}; }
  function stPl(id) { return (st && Array.isArray(st.pl) && st.pl.find(x => String(x.id) === String(id))) || {}; }
  function myTypes() { const s = new Set(V.planes.map(p => p.tinfo.ty)); if (!s.size) arr(V.shop.new).forEach(x => s.add(ptIdx(x.type))); return [...s].filter(x => x != null && x >= 0); }
  function bestTypeEst(o) { // cel mai bun tip (dintre cele pe care le ai) pentru o rută / escală → {profit, ty}
    let best = null;
    for (const ty of myTypes()) { const e = est(Object.assign({ type: ty }, o)); if (e && e.ok && e.profit != null && (!best || e.profit > best.profit)) best = { profit: e.profit, ty, load: e.load }; }
    return best;
  }
  function planeDay(p) { // profit/zi al unui avion (LOGIC-1 `pday`, altfel estimarea gratuită)
    const R = rawPl(p.id), v = pick(R, "pday", "profitDay", "pd");
    if (v != null) return num(v);
    if (p.rid == null) return null;
    const e = p.chain ? est({ pid: p.id, rid: arr(p.chain.r)[0], via: arr(p.chain.r)[1] }) : est({ pid: p.id, rid: p.rid });
    return e && e.ok && e.profit != null ? e.profit : null;
  }
  function apPanelData(ap) {
    const Lo = H.Logic(); let L = null;
    const RP = V.raw && (V.raw.apPanel || V.raw.airportPanel);
    if (RP && typeof RP === "object") L = RP[ap] || (RP.ap === ap ? RP : null);
    if (!L && Lo && st && me()) for (const fn of ["airportInfo", "airportPanel", "apPanel"]) { if (typeof Lo[fn] !== "function") continue; try { L = Lo[fn](st, me(), ap, now()); } catch (e) { L = null; } if (L) break; }
    L = L && typeof L === "object" ? L : {};
    const gt = V.gt;
    // avioanele mele la sol aici
    let planes = arr(L.ground || L.planes).map(x => { const id = pick(x, "pid", "id"), p = V.planes.find(y => String(y.id) === String(id)); return p ? { p, to: pick(x, "to", "dest") || (p.rid != null ? otherEnd(p) : null), pax: num(pick(x, "boarded", "pax", "px"), p.pax), seats: num(pick(x, "seats", "cap"), p.seats), wait: pick(x, "waitMin", "wait"), sub: !!pick(x, "sub") || p.sub } : null; }).filter(Boolean);
    if (!L.planes && !L.ground) planes = V.planes.filter(p => p.at === ap && p.st !== "air").map(p => { const s0 = stPl(p.id); return { p, to: p.rid != null ? otherEnd(p) : null, pax: p.pax, seats: p.seats, wait: (p.st === "board" || p.st === "broken") && s0.t0 != null ? Math.max(0, gt - num(s0.t0)) : null, sub: p.sub }; });
    // pasageri care așteaptă, pe fiecare rută de aici
    let waiting = arr(L.waiting || L.wait).map(x => ({ rid: pick(x, "rid"), to: pick(x, "to"), n: pick(x, "q", "n", "pax") != null ? num(pick(x, "q", "n", "pax")) : null, crowd: pick(x, "crowd", "routeCrowd") || null }));
    if (!L.waiting && !L.wait) waiting = V.routes.filter(r => r.a === ap || r.b === ap).map(r => ({ rid: r.id, to: r.a === ap ? r.b : r.a, n: r.wait ? num(pick(r.wait, r.a === ap ? "ab" : "ba")) : null, crowd: null }));
    waiting.forEach(w => {
      const r = V.routes.find(x => String(x.id) === String(w.rid)); w.r = r || null; if (!w.to && r) w.to = r.a === ap ? r.b : r.a;
      if (!w.crowd) { const rr = arr(V.raw && V.raw.routes).find(x => String(pick(x, "rid", "id")) === String(w.rid)); w.crowd = (rr && pick(rr, "routeCrowd", "crowd")) || null; }
    });
    // starea aeroportului pentru mine
    let status = pick(L, "status");
    if (!status) {
      const idle = planes.filter(x => x.p.st === "idle").length, slow = planes.filter(x => x.p.st === "board" && x.pax < x.seats * .5 && num(x.wait) > 180).length;
      status = idle ? "idle" : slow >= 2 ? "over" : planes.length || waiting.length ? "balanced" : null;
    }
    const statusN = pick(L, "statusN") || null;
    // rute posibile: permisele tale cu un capăt aici + escale prin aeroport (cu €/zi)
    let opts = arr(L.options || L.opts || L.routes).map(x => ({ kind: pick(x, "kind") || (pick(x, "via") ? "chain" : "permit"), rid: pick(x, "rid"), via: pick(x, "via"), a: pick(x, "a"), b: pick(x, "b"), c: pick(x, "c"), profit: pick(x, "profitDay", "profit", "pd") != null ? num(pick(x, "profitDay", "profit", "pd")) : null, id: pick(x, "id", "permitId") }));
    if (!L.options && !L.opts && !L.routes) {
      const Lr = H.Logic();
      V.permits.filter(p => p.a === ap || p.b === ap).forEach(p => { const rid = Lr && Lr.ridOf ? Lr.ridOf(p.a, p.b) : [p.a, p.b].sort().join("-"); const b = bestTypeEst({ rid }); opts.push({ kind: "permit", id: p.id, rid, a: p.a === ap ? p.a : p.b, b: p.a === ap ? p.b : p.a, profit: b ? b.profit : null }); });
      chainOpts({}).filter(x => x.b === ap).forEach(x => { const b = bestTypeEst({ rid: x.rid, via: x.via }); if (b) opts.push({ kind: "chain", rid: x.rid, via: x.via, a: x.a, b: x.b, c: x.c, profit: b.profit }); });
      opts.sort((x, y) => num(y.profit, -1e12) - num(x.profit, -1e12));
    }
    // O singură sugestie, cu cifre
    let tip = pick(L, "hint", "tip", "suggest", "suggestion");
    if (tip && typeof tip === "object") tip = pick(tip, "txt", "t", "text");
    if (!tip) {
      const idleP = planes.find(x => x.p.st === "idle");
      const crowd = waiting.map(w => ({ w, n: num(w.n) })).sort((x, y) => y.n - x.n)[0];
      if (idleP) {
        let best = null;
        for (const r of V.routes) { if (r.dist > idleP.p.tinfo.range) continue; const e = est({ pid: idleP.p.id, rid: r.id }); if (e && e.ok && e.profit != null && (!best || e.profit > best.e.profit)) best = { r, e }; }
        if (best && best.e.profit > 0) tip = { html: `„${escH(idleP.p.name)}” stă: pune-l pe <b>${escH(apName(best.r.a))}–${escH(apName(best.r.b))}</b> ≈ <b class="pos">${kDay(best.e.profit)}</b>`, pid: idleP.p.id };
      } else if (status !== "over" && crowd && crowd.w.r && crowd.n >= 60) {
        const b = bestTypeEst({ rid: crowd.w.r.id });
        if (b && b.profit > 0) tip = { html: `+1 avion pe <b>${escH(apName(ap))}–${escH(apName(crowd.w.to))}</b> ≈ <b class="pos">${kDay(b.profit)}</b> · ${fmtInt(crowd.n)} pas. așteaptă`, rid: crowd.w.r.id };
      } else if (status === "over") {
        const n = planes.filter(x => x.p.st === "board" && x.pax < x.seats * .5).length, o = opts.find(x => x.kind === "chain" && num(x.profit) > 0);
        if (n >= 2) tip = { html: `${n} avioane stau pe jumătate goale${o ? `: mută 1 pe <b>${escH(apName(o.a))} → ${escH(apName(o.b))} → ${escH(apName(o.c))}</b> ≈ <b class="pos">${kDay(o.profit)}</b>` : ""}`, rid: o ? o.rid : null };
      }
    }
    if (tip && typeof tip === "string") { const g = pick(pick(L, "hint") || {}, "gain"); tip = escH(tip).replace(/([+−-]?\d[\d.]*(?:,\d+)?\s?(?:k|M)?\s?€(?:\/zi)?)/g, "<b>$1</b>"); tip = { html: tip, gain: g }; }
    return { planes, waiting, status, statusN, tip, opts: opts.filter(o => o.kind !== "route") };
  }
  function apPanelHTML(a, D) {
    const ST = { over: ["over", "Prea multe avioane"], balanced: ["balanced", "Echilibrat"], idle: ["idle", "Avioane libere"] }[D.status] || null;
    if (ST && D.statusN) ST[1] = D.statusN;
    const totW = D.waiting.reduce((s, w) => s + num(w.n), 0);
    let h = "";
    if (ST) h += `<div class="cl-apst ${ST[0]}"><i></i>${ST[1]}<span>${D.planes.length} ${D.planes.length === 1 ? "avion" : "avioane"} · ${fmtInt(totW)} pas.</span></div>`;
    if (D.tip) h += `<div class="cl-aptip">💡 ${typeof D.tip === "string" ? escH(D.tip) : D.tip.html}</div>`;
    if (D.planes.length) {
      h += `<div class="cl-aph">Avioanele tale aici <b>${D.planes.length}</b></div><div class="cl-aplist">${D.planes.slice(0, 6).map(x => {
        const p = x.p, w = x.wait != null ? ` · ⏱ ${gdur(x.wait)}` : "";
        return `<button class="cl-aprow" data-appl="${escH(p.id)}"><span class="g"><b>„${escH(p.name)}”</b><small>${x.to ? `→ ${escH(apName(x.to))}` : "fără rută"}${w}</small></span>${x.sub ? `<em>sub prag</em>` : ""}<span class="n">${p.st === "idle" ? `<small>la sol</small>` : `${fmtInt(x.pax)}<small>/${fmtInt(x.seats)}</small>`}</span></button>`;
      }).join("")}${D.planes.length > 6 ? `<small class="cl-mut">+${D.planes.length - 6} în flotă</small>` : ""}</div>`;
    }
    if (D.waiting.length) {
      h += `<div class="cl-aph">Pasageri care așteaptă <b>${fmtInt(totW)}</b></div><div class="cl-aplist">${D.waiting.map(w => {
        const cr = w.crowd, np = num(pick(cr || {}, "planes", "n")), sg = pick(cr || {}, "suggested", "ideal");
        const crowdTxt = cr ? ` · ${np} ${np === 1 ? "avion" : "avioane"}${sg != null && num(sg) !== np ? ` (ideal ${num(sg)})` : ""}` : w.r ? ` · ${w.r.planes} ${w.r.planes === 1 ? "avion" : "avioane"}` : "";
        return `<button class="cl-aprow" ${w.r ? `data-route="${escH(w.r.id)}"` : "disabled"}><span class="g">→ ${escH(apName(w.to))}<small>${crowdTxt}${w.r ? ` · azi ${fmtSigned(w.r.profitToday)}` : ""}</small></span><span class="n">${w.n != null ? `${fmtInt(w.n)} <small>pas.</small>` : "—"}</span></button>`;
      }).join("")}</div>`;
    }
    if (D.opts.length) {
      h += `<div class="cl-aph">Rute posibile de aici</div><div class="cl-aplist">${D.opts.slice(0, 5).map(o => {
        const lbl = o.kind === "chain" ? `${escH(apName(o.a))} → ${escH(apName(o.b))} → ${escH(apName(o.c))}` : `${escH(apName(o.a))} – ${escH(apName(o.b))}`;
        const attrs = o.kind === "chain" && o.rid != null ? `data-putplane="${escH(o.rid)}"` : o.kind === "permit" && o.id != null ? `data-permit="${escH(o.id)}"` : o.rid != null && V.routes.some(r => String(r.id) === String(o.rid)) ? `data-route="${escH(o.rid)}"` : "disabled";
        return `<button class="cl-aprow" ${attrs}><span class="g">${lbl}<small>${o.kind === "chain" ? "cu escală" : o.kind === "permit" ? "permis" : "rută"}</small></span><span class="n ${num(o.profit) >= 0 ? "pos" : "neg"}">${o.profit != null ? kDay(o.profit) : "—"}</span></button>`;
      }).join("")}</div>`;
    }
    if (!h) h = `<div class="cl-mut" style="font-size:12.5px">Nu ai avioane, rute sau permise aici.</div>`;
    return h;
  }
  /* ---------- UI-B: fișa avionului în zbor (click pe avion pe hartă) ---------- */
  function planeCardHTML() {
    const p = V.planes.find(x => String(x.id) === String(U.selPlane));
    if (!p) { U.popKind = null; return ""; }
    const Lo = H.Logic(); let PC = null;
    try { PC = Lo && typeof Lo.planeCard === "function" && st && me() ? Lo.planeCard(st, me(), p.id, now()) : null; } catch (e) { PC = null; }
    const R = Object.assign({}, rawPl(p.id), PC || {}), air = p.st === "air", ca = canAct() && !V.me.frozen;
    const pax = num(pick(R, "px", "fpax"), p.pax), seats = p.seats || 1;
    const from = air ? (p.from || p.at) : p.at, to = p.to || otherEnd(p);
    const rt = V.routes.find(r => r.id === p.rid);
    let rev = pick(R, "rev", "frev", "rv") != null ? num(pick(R, "rev", "frev", "rv")) : null;
    if (rev == null && rt && from) rev = pax * (rt.a === from ? rt.price.ab : rt.price.ba);
    const fprof = pick(R, "net", "flightNet", "fprof"), cost = pick(R, "cost", "fcost");
    const pday = PC && pick(PC, "profitDay", "profitDayEst") != null ? num(pick(PC, "profitDay", "profitDayEst")) : planeDay(p), prog = p.prog != null ? clamp(num(p.prog), 0, 1) : null;
    const state = air ? (p.ferry ? "zbor gol (poziționare)" : "în zbor") : p.st === "board" ? "la îmbarcare" : p.st === "broken" ? "defect" : p.st === "frozen" ? "înghețat" : "la sol";
    const big = fprof != null ? { l: "Profit pe acest zbor", v: num(fprof) } : { l: air ? "Bilete pe acest zbor" : "Bilete vândute până acum", v: rev };
    return `<div class="cl-pop pc" role="dialog" aria-label="Avion ${escH(p.tinfo.n)} ${escH(p.name)}"><button class="cl-x" data-popclose aria-label="Închide">✕</button>
      <h4>✈️ ${escH(p.tinfo.n)} „${escH(p.name)}”</h4>
      <div class="cl-pcleg"><span>${escH(apName(from))}</span><span class="ar">${prog != null && air ? `<i style="left:${(prog * 100).toFixed(0)}%">✈</i>` : ""}</span><span>${escH(apName(to))}</span></div>
      <div class="row">Stare <b>${state}${air && p.eta != null ? ` · aterizează în ${gdur(p.eta)}${pick(R, "etaClock") ? ` (${escH(pick(R, "etaClock"))})` : ""}` : ""}${p.st === "board" && p.readyIn ? ` · gata în ${gdur(p.readyIn)}` : ""}</b></div>
      <div class="cl-pcbig"><small>${big.l}</small><b class="${big.v == null ? "" : big.v >= 0 ? "pos" : "neg"}">${big.v == null ? "—" : fmtE(big.v)}</b></div>
      <div class="row">Pasageri la bord <b class="tn">${fmtInt(pax)}/${fmtInt(seats)} · ${Math.round(pax / seats * 100)}%</b></div>
      <div class="cl-bar${pax >= seats ? " full" : ""}" style="height:5px"><i style="width:${(clamp(pax / seats, 0, 1) * 100).toFixed(1)}%"></i></div>
      ${cost != null ? `<div class="row">Bilete − cost zbor <b class="tn">${rev != null ? fmtE(rev) : "—"} − ${fmtE(Math.abs(num(cost)))}</b></div>` : ""}
      <div class="row">Rută <b>${p.chain ? `escală ${chainTxt(p.chain)}` : rt ? `${escH(apName(rt.a))} ⇄ ${escH(apName(rt.b))}` : "fără rută"}</b></div>
      <div class="row">Profit pe zi <b class="tn ${pday == null ? "" : pday >= 0 ? "pos" : "neg"}">${pday == null ? "—" : kDay(pday)}</b></div>
      ${p.pilot ? `<div class="row">Pilot <b>min ${num(p.pmin != null ? p.pmin : p.pminDef)}/${seats}${p.sub ? " · sub prag" : ""}</b></div>` : ""}
      <div class="cl-pcbtns">
        <button class="cl-btn" data-assign="${escH(p.id)}" data-afocus="chain" ${!ca ? "disabled" : ""}>🔀 Prelungește escala</button>
        <button class="cl-btn" data-assign="${escH(p.id)}" ${!ca ? "disabled" : ""}>🛣️ Schimbă ruta</button>
        ${p.pilot ? `<button class="cl-btn wide" data-pminopen="${escH(p.id)}" ${!ca ? "disabled" : ""}>🎚️ Minimul pilotului · ${num(p.pmin != null ? p.pmin : p.pminDef)}/${seats}</button>` : p.rid != null ? `<button class="cl-btn wide" data-pilot="${escH(p.id)}" ${!ca ? "disabled" : ""}>👨‍✈️ Angajează pilot și setează minimul</button>` : ""}
      </div>
      ${air ? `<small class="cl-apx" style="margin:0">Ruta nouă se aplică după aterizare.</small>` : ""}
      <button class="cl-btn sm ghost" data-pcfleet="${escH(p.id)}">Vezi în flotă</button>
    </div>`;
  }
  /* avertizarea gratuită (NU e consultant): doar profit/zi + % plin, din CerulLogic.estimate */
  const ESTC = new Map();
  function est(o) {
    const Lo = H.Logic(); if (!Lo || typeof Lo.estimate !== "function" || !st || !me()) return null;
    const key = JSON.stringify(o) + "|" + num(st.mv) + "|" + num(st.day) + "|" + Math.floor(num(V && V.gt) / 20);
    if (ESTC.has(key)) return ESTC.get(key);
    let r = null;
    try { r = Lo.estimate(st, me(), o); } catch (e) { r = null; }
    let out = null;
    if (r && typeof r === "object") {
      const pf = pick(r, "profitDay", "profit", "pd"), ld = pick(r, "load", "lf");
      if (pf != null || ld != null || r.ok === false) out = { profit: pf != null ? num(pf) : null, load: ld != null ? clamp(num(ld), 0, 1) : null, ok: r.ok !== false, why: r.why || "" };
    }
    if (ESTC.size > 400) ESTC.clear(); ESTC.set(key, out);
    return out;
  }
  // estimare pe toată ruta (suma avioanelor mele de pe ea) la un preț ipotetic
  function estRoute(r, dir, price) {
    const ps = V.planes.filter(p => p.rid === r.id); if (!ps.length) return null;
    let profit = 0, load = null, any = false;
    for (const p of ps) { const e = est({ pid: p.id, rid: r.id, dir: dir === "both" ? undefined : dir, price }); if (!e || !e.ok) continue; any = true; if (e.profit != null) profit += e.profit; if (e.load != null) load = e.load; }
    return any ? { profit, load, ok: true } : null;
  }
  function estHTML(e, cls) {
    if (!e) return "";
    if (!e.ok) return e.why ? `<span class="cl-est"><small>${escH(e.why)}</small></span>` : "";
    return `<span class="cl-est${cls ? " " + cls : ""}">${e.profit != null ? `<b class="${e.profit >= 0 ? "pos" : "neg"}">${fmtDay(e.profit)}</b>` : ""}${e.load != null ? `<small>~${Math.round(e.load * 100)}% plin</small>` : ""}</span>`;
  }
  // o singură linie neutră: alt tip de avion de-al meu ar aduce clar mai mult pe ruta asta
  function betterFit(o) {
    const Lo = H.Logic(); if (!Lo || typeof Lo.betterFit !== "function" || !st || !me()) return "";
    let b = null; try { b = Lo.betterFit(st, me(), o); } catch (e) { b = null; }
    if (!b) return "";
    const p = b.pid != null ? V.planes.find(x => String(x.id) === String(b.pid)) : null;
    const nm = p ? `${p.tinfo.n} „${p.name}”` : (b.name || ptInfo(pick(b, "ty", "type")).n);
    return `<div class="cl-fit">${escH(nm)} ar fi mai potrivit aici.</div>`;
  }
  function estLoadAt(r, rc, p) {
    if (rc.estLoad == null || !rc.rec) return null;
    const eps = 1.8, f = Math.pow(Math.max(1, p) / rc.rec, -eps);
    return clamp(num(rc.estLoad) * f, 0, 1);
  }

  /* ---------- harta ---------- */
  let mapApi = null, mapTried = false, fbMap = null;
  const seatColor = s => { if (s === me()) return V.me.color; const o = V.opps.find(x => x.seat === s); if (o) return o.color; try { return colorOf(st.c[s].col) || "#9db0cf"; } catch (e) { return "#9db0cf"; } };
  const mrid = (s, rid) => (s === me() ? "m" : s) + "|" + rid;
  function mapVM() {
    const Lo = H.Logic(), myC = V.me.color, routes = [], planes = [];
    const lines = V.map ? arr(V.map.lines) : [];
    if (lines.length) lines.forEach(l => { const mine = l.s === me() || !!l.mine; routes.push({ id: mrid(mine ? me() : l.s, l.rid), a: l.a, b: l.b, color: mine ? myC : seatColor(l.s), mine, state: "built", label: mine && U.selRoute === l.rid ? priceLabel(l.rid) : undefined }); });
    else {
      V.routes.forEach(r => routes.push({ id: mrid(me(), r.id), a: r.a, b: r.b, color: myC, mine: true, state: "built" }));
      V.opps.forEach(o => { if (!o.bankrupt) o.routes.forEach(r => { if (r.a && r.b) routes.push({ id: mrid(o.seat, r.id), a: r.a, b: r.b, color: o.color, mine: false, state: "built" }); }); });
    }
    if (me()) V.permits.forEach(p => routes.push({ id: "pm|" + p.id, a: p.a, b: p.b, color: myC, mine: true, state: buildPlan(p).miss === 0 ? "building" : "permit" }));
    // avioane: poziția = funcție de timpul jocului (animație lină fără commit-uri)
    const frozenOf = s => s === me() ? V.me.frozen : !!(V.opps.find(o => o.seat === s) || {}).frozen;
    const pls = st && Array.isArray(st.pl) ? st.pl : null;
    if (pls && Lo && Lo.planePos) {
      pls.forEach(pl => {
        if (!pl || (st.c && st.c[pl.s] && st.c[pl.s].out)) return;
        const air = pl.m === 2 || pl.m === 3, mine = pl.s === me(), cap = (V.planes.find(x => x.id === pl.id) || {}).seats || ptInfo(pl.ty).seats;
        const fz = frozenOf(pl.s);
        const base = { id: pl.id, type: num(pl.ty), color: seatColor(pl.s), mine, frozen: fz };
        if (mine) { const vp = V.planes.find(x => x.id === pl.id); if (vp) Object.assign(base, { typeName: vp.tinfo.n, name: vp.name, pax: num(pl.px), seats: vp.seats }); } // tooltip pe hartă: „Aero 320 „Mureș” · 142/180 pas.”
        if (air) planes.push(Object.assign(base, { state: "air", posFn: gt => { try { return Lo.planePos(st, pl, fz ? V.gt : gt); } catch (e) { return null; } } }));
        else if (pl.rid || mine) planes.push(Object.assign(base, { state: "ground", at: pl.ap, load: mine && pl.m === 1 ? clamp(num(pl.px) / Math.max(1, cap), 0, 1) : undefined }));
      });
    } else if (V.map && V.map.planes) {
      arr(V.map.planes).forEach(p => { const air = p.mode === "fly" || p.mode === "ferry"; planes.push({ id: p.id, type: num(p.ty), color: seatColor(p.s), mine: p.s === me(), state: air ? "air" : "ground", pos: { lat: p.lat, lon: p.lon, heading: p.hd }, prog: p.prog, frozen: !!p.frz }); });
    }
    const marks = [];
    if (V.me.base) marks.push({ id: V.me.base, color: myC, kind: "base" });
    V.me.hubs.forEach(h => { if (h !== V.me.base) marks.push({ id: h, color: myC, kind: "hub" }); });
    const pres = new Set(); V.routes.forEach(r => { pres.add(r.a); pres.add(r.b); });
    pres.forEach(id => { if (id !== V.me.base && !V.me.hubs.includes(id)) marks.push({ id, color: myC, kind: "presence" }); });
    let hl = new Set(); V.permits.forEach(p => { hl.add(p.a); hl.add(p.b); }); if (U.modal && U.modal.kind === "offer") V.offer.forEach(p => { hl.add(p.a); hl.add(p.b); });
    const PV = U.preview; // previzualizare permis (hover): linie punctată evidențiată + cele două aeroporturi pulsând
    if (PV) { routes.push({ id: "pv|" + PV.a + "|" + PV.b, a: PV.a, b: PV.b, color: "#ffd35c", mine: true, state: "building", label: `${apName(PV.a)} – ${apName(PV.b)} · ${fmtInt(PV.d)} km` }); hl = new Set([PV.a, PV.b]); }
    let selected = null;
    if (U.popKind === "route" && U.selRoute != null) selected = { kind: "route", id: mrid(me(), U.selRoute) };
    else if (U.popKind === "opp" && U.oppRoute) selected = { kind: "route", id: mrid(U.oppRoute.seat, U.oppRoute.id) };
    else if (U.popKind === "ap" && U.selAp) selected = { kind: "airport", id: U.selAp };
    else if (U.selPlane != null) selected = { kind: "plane", id: U.selPlane };
    if (PV) selected = { kind: "route", id: "pv|" + PV.a + "|" + PV.b };
    const c = V.clock || {}, baseAp = apObj(V.me.base || (V.opps[0] && null));
    return {
      clock: () => { try { return Lo && Lo.gameTimeAt ? Lo.gameTimeAt(st, now()) : V.gt; } catch (e) { return V.gt; } },
      utcOffsetMin: Math.round(num(baseAp && baseAp.tz, 0) * 60), month: c.month != null ? c.month : undefined, me: me(),
      marks, highlight: [...hl].filter(Boolean), routes, planes, selected, events: V.events || [],
    };
  }
  function priceLabel(rid) { const r = V.routes.find(x => x.id === rid); return r ? (r.price.ab === r.price.ba ? fmtE(r.price.ab) : `${fmtE(r.price.ab)} / ${fmtE(r.price.ba)}`) : undefined; }
  function ensureMap() {
    if (mapApi || mapTried) return;
    const M = H.Map();
    if (!M || !M.create) { if (!fbMap) fbMap = fallbackMap(E.map); return; }
    mapTried = true;
    if (fbMap) { fbMap.destroy(); fbMap = null; }
    try {
      mapApi = M.create(E.map, {
        controls: true, fit: "world", quality: setGet().gfx || "auto",
        onFullscreen: () => topKey("fs"),
        onClick: (hit, ev) => onMapHit(hit, ev),
        onView: () => placePopup(),
        onPlaneClick: (pid, hit, ev) => { try { onMapPlane(pid, hit && hit.x != null && hit.y != null ? { x: hit.x, y: hit.y } : evXY(ev)); } catch (e) { /* ignorat */ } },
      });
      T.timeout(() => { const c = E.map.querySelector(".cm-ctl"); if (c) c.setAttribute("data-tut", "map-zoom"); }, 50);
    } catch (e) { console.warn("CerulUI: CerulMap.create a eșuat", e); mapApi = null; fbMap = fallbackMap(E.map); }
  }
  let lastVmKey = "";
  /* previzualizarea unui permis pe hartă (hover / 👁 pe telefon) */
  function permitAt(t) {
    let n;
    if ((n = t.closest("[data-pv]"))) { const [a, b] = n.dataset.pv.split("|"); return a && b ? { a, b } : null; }
    if ((n = t.closest(".cl-pm[data-permit]"))) { const p = V.permits.find(x => String(x.id) === n.dataset.permit); return p ? { a: p.a, b: p.b } : null; }
    if ((n = t.closest("[data-osel]"))) { const p = V.offer.find(x => String(x.id) === n.dataset.osel); return p ? { a: p.a, b: p.b } : null; }
    if ((n = t.closest(".cs-dc[data-i]"))) { const d = V.raw && V.raw.draft, c = d && arr(d.cards)[+n.dataset.i], k = c && (c.c || c.got); if (k && typeof k === "object" && k.a && k.b) return { a: k.a, b: k.b }; }
    return null;
  }
  function previewOn(pv) {
    if (!pv || !V) return;
    if (U.preview && U.preview.a === pv.a && U.preview.b === pv.b) { if (U.pvT) { clearTimeout(U.pvT); U.pvT = null; } return; }
    if (U.pvT) { clearTimeout(U.pvT); U.pvT = null; }
    U.preview = { a: pv.a, b: pv.b, d: dist(pv.a, pv.b) }; drawMap();
    try {
      if (mapApi && mapApi.project && mapApi.fitAirports) {
        const A = apObj(pv.a), B = apObj(pv.b), pa = mapApi.project(A.lat, A.lon), pb = mapApi.project(B.lat, B.lon), v = mapApi.view ? mapApi.view() : null;
        const inside = q => q.visible && v && q.x > 50 && q.y > 50 && q.x < v.w - 50 && q.y < v.h - 50;
        if (!inside(pa) || !inside(pb) || Math.hypot(pa.x - pb.x, pa.y - pb.y) < 170) { if (!U.pvView && v) U.pvView = v; mapApi.fitAirports([pv.a, pv.b], 130); }
      }
    } catch (e) { /* hartă fără API */ }
  }
  function previewOff() {
    if (!U.preview || U.pvT) return;
    U.pvT = setTimeout(() => {
      U.pvT = null; U.preview = null; if (!alive) return; drawMap();
      const v = U.pvView; U.pvView = null;
      try { if (v && mapApi && mapApi.focus) mapApi.focus(v.lat, v.lon, v.zoom, { dur: 600 }); } catch (e) { /* ignorat */ }
    }, 220);
  }
  function drawMap(force) {
    if (!V) return;
    ensureMap();
    const vm = mapVM();
    try {
      if (mapApi && mapApi.update) mapApi.update(vm);
      else if (fbMap) fbMap.update(vm);
    } catch (e) { if (!U._merr) { U._merr = 1; console.warn("CerulUI: map.update a eșuat", e); } }
  }
  function onMapHit(hit, ev) {
    if (!hit) { closePop(); return; }
    const at = hit.x != null ? { x: hit.x, y: hit.y } : evXY(ev);
    if (hit.kind === "airport") onMapAirport(hit.id, at);
    else if (hit.kind === "route") onMapRoute(hit.id, at, hit.item);
    else if (hit.kind === "plane") onMapPlane(hit.id, at);
  }
  function evXY(ev) {
    if (!ev) return null; const mr = E.mapc.getBoundingClientRect();
    if (ev.clientX != null) return { x: ev.clientX - mr.left, y: ev.clientY - mr.top };
    if (ev.x != null && ev.y != null) return { x: ev.x, y: ev.y };
    return null;
  }
  function onMapRoute(id, at, item) {
    const sid = String(id);
    if (sid.startsWith("pm|")) { const p = V.permits.find(x => String(x.id) === sid.slice(3)); if (p) { sfx.tick(); toast(`Permis ${apName(p.a)} → ${apName(p.b)}: ${buildPlan(p).miss ? "îți mai lipsesc cărți" : "poți construi!"}`, "", "🎟️"); } return; }
    const [s, rid] = sid.includes("|") ? [sid.slice(0, sid.indexOf("|")), sid.slice(sid.indexOf("|") + 1)] : ["m", sid];
    if (s === "m") { const r = V.routes.find(x => String(x.id) === rid); if (r) { selectRoute(r.id, at, true); return; } }
    const op = V.opps.find(o => o.seat === s); let a = item && item.a, b = item && item.b;
    if (!a) { const rr = op && op.routes.find(x => String(x.id) === rid); if (rr) { a = rr.a; b = rr.b; } else { const ab = rid.split("-"); a = ab[0]; b = ab[1]; } }
    U.popKind = "opp"; U.oppRoute = { seat: s, id: rid, a, b }; U.selRoute = null; U.selAp = null; U.popAt = at; U.popAnchor = { kind: "route", id: sid };
    sfx.tick(); drawOverlay(); drawMap();
  }
  function onMapAirport(id, at) { U.popKind = "ap"; U.selAp = id; U.selRoute = null; U.popAt = at; U.popAnchor = { kind: "airport", id }; sfx.tick(); drawOverlay(); drawMap(); }
  function onMapPlane(id, at) {
    const p = V && V.planes.find(x => String(x.id) === String(id));
    if (!p) { const o = st && st.pl && st.pl.find(x => String(x.id) === String(id)); if (o && !(U.lastPlaneT && now() - U.lastPlaneT < 250)) { U.lastPlaneT = now(); const op = V.opps.find(x => x.seat === o.s); toast(`Avion ${op ? op.co || op.name : "rival"} · ${ptInfo(o.ty).n}`, "", "✈️"); } return; }
    openPlaneCard(p.id, at);
  }
  // UI-B: fișa avionului (popup pe hartă; pe telefon în panoul de jos)
  function openPlaneCard(id, at) {
    if (U.popKind === "plane" && String(U.selPlane) === String(id) && U.lastPlaneT && now() - U.lastPlaneT < 250) return; // onClick + onPlaneClick pentru același click
    U.lastPlaneT = now();
    U.popKind = "plane"; U.selPlane = id; U.selRoute = null; U.selAp = null; U.oppRoute = null; U.popAnchor = null;
    U.popAt = at || U.lastPtr || null;
    sfx.select(); drawOverlay(); drawMap(); if (U.mode === "phone") drawPane();
  }
  try { T.on(E.mapc, "pointerdown", ev => { U.lastPtr = evXY(ev); }, { passive: true }); } catch (e) { /* ignorat */ }
  function selectRoute(id, at, fromMap) {
    U.popKind = "route"; U.selRoute = id; U.selAp = null; U.popAt = at || null; U.popAnchor = { kind: "route", id: mrid(me(), id) }; U.dir = "ab"; U.draft = {};
    sfx.select(); drawAll();
    const r = V.routes.find(x => x.id === id);
    if (r && !fromMap && mapApi) { try { if (mapApi.fitAirports) mapApi.fitAirports([r.a, r.b], 120); } catch (e) { /* ignorat */ } }
  }
  function closePop() { if (U.selRoute == null && U.selAp == null && U.popKind == null) return; U.selRoute = null; U.selAp = null; U.popKind = null; U.oppRoute = null; U.popAnchor = null; drawOverlay(); drawMap(); }
  function placePopup() {
    const pop = E.popw.firstElementChild; if (!pop || U.mode === "phone") return;
    const mr = E.mapc.getBoundingClientRect(); let ax = null;
    if (U.popAnchor && mapApi && mapApi.anchor) { try { const a = mapApi.anchor(U.popAnchor.kind, U.popAnchor.id); if (a && a.visible !== false && a.x != null) ax = a; } catch (e) { ax = null; } }
    if (!ax) ax = U.popAt;
    let x = mr.width - pop.offsetWidth - 70, y = 70;
    if (ax) { x = ax.x + 26; y = ax.y - 70; if (x + pop.offsetWidth > mr.width - 64) x = ax.x - pop.offsetWidth - 26; }
    x = clamp(x, 8, Math.max(8, mr.width - pop.offsetWidth - 64)); y = clamp(y, 8, Math.max(8, mr.height - pop.offsetHeight - 8));
    pop.style.left = Math.round(x) + "px"; pop.style.top = Math.round(y) + "px";
  }

  /* hartă de rezervă (până sosește CerulMap): proiecție echirectangulară simplă pe canvas */
  function fallbackMap(host) {
    const cv = document.createElement("canvas"); cv.style.cssText = "position:absolute;inset:0;width:100%;height:100%"; host.appendChild(cv);
    let vm = null, hits = [];
    const proj = (lat, lon, w, h) => ({ x: (lon + 180) / 360 * w, y: (90 - lat) / 180 * h * 1.25 - h * .12 });
    function draw() {
      const r = host.getBoundingClientRect(), dpr = Math.min(2, W.devicePixelRatio || 1);
      if (!r.width) return;
      cv.width = r.width * dpr; cv.height = r.height * dpr; const g = cv.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, r.width, r.height);
      g.strokeStyle = "#ffffff10"; for (let lo = -180; lo <= 180; lo += 30) { const p = proj(0, lo, r.width, r.height); g.beginPath(); g.moveTo(p.x, 0); g.lineTo(p.x, r.height); g.stroke(); }
      for (let la = -60; la <= 80; la += 20) { const p = proj(la, 0, r.width, r.height); g.beginPath(); g.moveTo(0, p.y); g.lineTo(r.width, p.y); g.stroke(); }
      hits = []; if (!vm) return;
      const D = H.Data(), aps = (D && D.AIRPORTS) || [];
      aps.forEach(a => { const p = proj(a.lat, a.lon, r.width, r.height); g.fillStyle = "#ffffff55"; g.beginPath(); g.arc(p.x, p.y, 1.5 + (a.size || 1), 0, 7); g.fill(); hits.push({ k: "ap", id: a.id, x: p.x, y: p.y }); });
      vm.routes.forEach(rt => {
        const A = apObj(rt.a), B = apObj(rt.b); if (A.lat == null || B.lat == null) return;
        const p = proj(A.lat, A.lon, r.width, r.height), q = proj(B.lat, B.lon, r.width, r.height), mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2 - Math.hypot(q.x - p.x, q.y - p.y) * .18;
        const sel = vm.selected && vm.selected.id === rt.id;
        g.strokeStyle = rt.color; g.globalAlpha = rt.mine ? (rt.state === "permit" ? .45 : 1) : .5; g.lineWidth = rt.mine ? (sel ? 6 : 3.5) : 2; g.setLineDash(rt.state !== "built" ? [8, 6] : []);
        g.beginPath(); g.moveTo(p.x, p.y); g.quadraticCurveTo(mx, my, q.x, q.y); g.stroke(); g.globalAlpha = 1; g.setLineDash([]);
        hits.push({ k: "rt", id: rt.id, x: (p.x + 2 * mx + q.x) / 4, y: (p.y + 2 * my + q.y) / 4, info: rt });
      });
      const base = (vm.marks.find(m => m.kind === "base") || {}).id, myc = (vm.marks[0] || {}).color || "#ff8a4c";
      [...new Set(vm.marks.map(m => m.id).concat(vm.highlight))].forEach(id => { const A = apObj(id); if (A.lat == null) return; const p = proj(A.lat, A.lon, r.width, r.height); g.fillStyle = id === base ? myc : "#fff"; g.strokeStyle = "#0b1d36"; g.lineWidth = 3; g.beginPath(); g.arc(p.x, p.y, id === base ? 8 : 6, 0, 7); g.stroke(); g.fill(); g.font = "600 12px system-ui"; g.lineWidth = 3; g.strokeText(A.n, p.x + 10, p.y + 4); g.fillText(A.n, p.x + 10, p.y + 4); });
    }
    const onClick = e => { const r = host.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top; let best = null, bd = 18; hits.forEach(h => { const d = Math.hypot(h.x - x, h.y - y); if (d < bd) { bd = d; best = h; } }); if (!best) { closePop(); return; } if (best.k === "rt") onMapRoute(best.id, { x, y }, best.info); else onMapAirport(best.id, { x, y }); };
    cv.addEventListener("click", onClick);
    let ro = null; try { ro = new ResizeObserver(() => draw()); ro.observe(host); } catch (e) { /* fără RO */ }
    return { update(v) { vm = v; draw(); }, destroy() { try { ro && ro.disconnect(); } catch (e) { /* ignorat */ } cv.remove(); } };
  }

  /* ---------- înghețare (overlay propriu dacă scenele nu-l arată) ---------- */
  function drawFreeze() {
    if (!V) return;
    const f = me() && V.me.frozen && !(sceneApi && sceneApi.active && sceneApi.active() === "freeze");
    morph(E.frzw, f ? `<div class="cl-frz">${(() => { const A = H.Art(); try { return A && A.iceOverlay ? A.iceOverlay() : ""; } catch (e) { return ""; } })()}<b>❄️ Compania ta e înghețată${V.me.frozenLeft ? ` · ${Math.ceil(V.me.frozenLeft / 1000)} s` : ""}</b></div>` : "");
  }

  /* ---------- scene pe tot ecranul (CerulScenes) ---------- */
  let sceneApi = null, userScene = null;
  function sceneOpts() { return { st, seat: me(), ctx, view: V && V.raw, now }; }
  function sceneHelpers() { return Object.assign({}, helpers, { Logic: H.Logic(), Data: H.Data(), Art: H.Art(), send: a => send(a), now, sfx: ctx.sfx, fx: ctx.fx }); }
  function drawScenes() {
    const S = H.Scenes();
    if (S && S.auto) {
      try {
        if (!sceneApi) sceneApi = S.auto(E.scene, sceneOpts(), sceneHelpers());
        else sceneApi.update && sceneApi.update(sceneOpts());
      } catch (e) { if (!U._serr) { U._serr = 1; console.warn("CerulUI: CerulScenes.auto a eșuat", e); } }
    } else fallbackScene();
    if (userScene && userScene.h && userScene.h.update) { try { userScene.h.update(sceneOpts()); } catch (e) { /* ignorat */ } }
    if (userScene && V && V.phase !== "play") closeUserScene();
    const end = !!(V && V.phase === "end");
    if (E.endbar.hidden === end) E.endbar.hidden = !end;
    if (end && !E.endbar.firstChild) E.endbar.innerHTML = `<button class="cl-tb gold" data-k="rematch">🔁 Revanșă</button><button class="cl-tb" data-k="lobby">👥 Schimbă jucătorii</button><button class="cl-tb" data-k="salon">← Salon</button>`;
  }
  function sceneBusy() {
    if (userScene) return true;
    try { const a = sceneApi && sceneApi.active ? sceneApi.active() : null; if (a && a !== "freeze") return true; /* negocierea: biroul acoperă ecranul și pentru cei care doar privesc */ } catch (e) { /* ignorat */ }
    return !!E.scene.querySelector(".cl-fb");
  }
  function openUserScene(name, extra) {
    const S = H.Scenes(); closeUserScene();
    if (!S || typeof S[name] !== "function") return false;
    try {
      const o = Object.assign(sceneOpts(), extra || {}, { onClose: () => closeUserScene(), close: () => closeUserScene() });
      userScene = { name, h: S[name](E.scene2, o, sceneHelpers()) };
      return true;
    } catch (e) { console.warn("CerulUI: scena " + name + " a eșuat", e); closeUserScene(); return false; }
  }
  function closeUserScene() { if (!userScene) return; const u = userScene; userScene = null; try { u.h && u.h.destroy && u.h.destroy(); } catch (e) { /* ignorat */ } E.scene2.innerHTML = ""; }
  /* rezerve minime când CerulScenes lipsește */
  let fbKey = "";
  function fallbackScene() {
    if (!V) return;
    const ph = V.phase; let h = "";
    if (ph === "setup") {
      const ready = st && st.ready && me() && st.ready[me()];
      h = `<div class="cl-fb"><div class="cl-mcard"><h2>Cerul Lumii — pregătire</h2><p>Se încarcă ecranul de profil…</p>${me() ? `<div class="cl-mbtns"><button class="cl-btn gold" data-fbready ${ready ? "disabled" : ""}>${ready ? "Gata ✓" : "Sunt gata"}</button></div>` : ""}</div></div>`;
    } else if (ph === "draft") h = `<div class="cl-fb" style="background:#02070fb0"><div class="cl-mcard"><h2>Sfârșitul zilei — draft</h2><p>Se alege câte o carte, pe rând…</p>${me() ? `<div class="cl-gis">${Array.from({ length: 10 }, (_, i) => `<button class="cl-rc" style="background:#1a2b4a" data-fbpick="${i}">🂠</button>`).join("")}</div>` : ""}</div></div>`;
    else if (ph === "nego") h = `<div class="cl-banner" style="animation:none;top:90px">🤝 ${escH((V.raw && V.raw.nego && V.raw.nego.busy) || "Negociere în curs…")}<small>Timpul e oprit pentru toți</small></div>`;
    else if (ph === "end") h = `<div class="cl-fb"><div class="cl-mcard"><h2>Final</h2><p>Partida s-a încheiat.</p></div></div>`;
    if (h === fbKey) return; fbKey = h; E.scene.innerHTML = h;
  }

  /* ---------- modale proprii ---------- */
  function openModal(kind, data) { U.modal = { kind, data: data || {} }; U.menu = false; sfx.pop(); drawModal(); }
  function closeModal() { U.modal = null; E.modw.innerHTML = ""; }
  function drawModal() {
    const M = U.modal; if (!M) { E.modw.innerHTML = ""; return; }
    let h = "";
    let edge = false;
    const box = (title, body, btns, wide) => `<div class="cl-modal${edge ? " edge" : ""}" data-mbg><div class="cl-mcard" role="dialog" aria-modal="true" aria-label="${escH(title)}" style="${wide ? "width:min(820px,100%)" : ""}"><button class="cl-x" data-mclose aria-label="Închide">✕</button><h2>${title}</h2>${body}${btns ? `<div class="cl-mbtns">${btns}</div>` : ""}</div></div>`;
    if (M.kind === "ev") { // fișa unui eveniment: ce, cui, efect, cât durează, ce poți face
      const ev = arr(V.events).find(x => x.k === M.data.k && x.id === M.data.id); if (!ev) { closeModal(); return; }
      const e = evInfo(ev), lt = evLeftTxt(e), D = H.Data(), def = (D && D.EVENTS && D.EVENTS.find(x => x.id === ev.id)) || {};
      const tt = pick(ev, "tt"), loc = pick(ev, "loc") || e.where, mine = tt === "company" && me() && pick(ev, "tg") === V.me.seat;
      const who = tt === "company" ? (mine ? "<b>Compania ta</b>" : `Compania <b>${escH(loc)}</b>`) : tt === "airport" ? `Aeroportul <b>${escH(loc)}</b>` : tt === "region" ? `Regiunea <b>${escH(loc)}</b>` : tt === "cont" ? `Continentul <b>${escH(loc)}</b>` : tt === "tag" ? `Destinațiile de tip <b>${escH(loc)}</b>` : "<b>Toate companiile</b>";
      const eff = pick(ev, "eff") || def.eff || (e.ef ? e.ef.charAt(0).toUpperCase() + e.ef.slice(1) + "." : "");
      const tl = lt ? lt.replace(/^încă /, "") : "";
      const other = tt === "company" && !mine;
      const fix = other ? (e.mood === "rau" ? "Nu te afectează pe tine. Profită: rivalul pierde pasageri pe rutele voastre comune." : "Nu te afectează direct; rivalul câștigă pasageri pe rutele voastre comune — ține prețurile competitive.")
        : String(pick(ev, "fix") || def.fix || "").replace(/\{t\}/g, tl || "curând");
      const dur = e.leftMin != null ? `Mai durează <b>${escH(tl)}</b> (timp de joc).` : num(e.left) <= 1 ? "Ține <b>până la sfârșitul zilei</b>." : `Mai durează <b>${num(e.left)} zile</b>, inclusiv azi.`;
      h = box(`${e.icon} ${escH(e.chip || e.n)}`, `<div class="cl-evcard">
        <p>📍 ${who}${ev.ex ? ` · <span class="pos">🛡️ tu ești protejat de Asigurare</span>` : ""}</p>
        <p>${e.mood === "rau" ? "📉" : "📈"} ${escH(eff)}</p>
        <p>⏱️ ${dur}</p>
        ${fix ? `<p><b>Ce poți face:</b> ${escH(fix)}</p>` : ""}</div>`, `<button class="cl-btn ghost" data-mclose>Închide</button>`);
    } else if (M.kind === "assign") {
      const p = V.planes.find(x => x.id === M.data.pid); if (!p) { closeModal(); return; }
      const t = p.tinfo;
      const rs = V.routes.slice().sort((a, b) => (a.dist <= t.range ? 0 : 1) - (b.dist <= t.range ? 0 : 1));
      let anyEst = false;
      const opts = rs.map(r => {
        const e0 = est({ pid: p.id, rid: r.id }), ok = r.dist <= t.range && !(e0 && !e0.ok), e = ok ? e0 : null; if (e) anyEst = true;
        const right = !ok ? "" : e ? estHTML(e) : `<span class="cl-est"><b class="${r.profitToday >= 0 ? "pos" : "neg"}">${fmtSigned(r.profitToday)}</b><small>azi</small></span>`;
        return `<button class="cl-opt${M.data.sel === r.id && M.data.via == null ? " on" : ""}" data-msel="${escH(r.id)}" ${ok ? "" : "disabled"}><span class="grow"><b>${escH(apName(r.a))} ⇄ ${escH(apName(r.b))}${p.rid === r.id && !p.chain ? ` <em class="cl-now">acum</em>` : ""}</b><small>${fmtInt(r.dist)} km · ${r.planes === 1 ? "1 avion" : r.planes + " avioane"}${ok ? "" : e0 && e0.why ? ` · ${escH(String(e0.why).replace(/\.$/, "").replace(/^./, ch => ch.toLowerCase()))}` : ` · prea departe (rază ${fmtInt(t.range)} km)`}</small></span>${right}</button>`;
      }).join("");
      const fit = M.data.sel != null && M.data.via == null ? betterFit({ pid: p.id, rid: M.data.sel }) : "";
      const chains = chainListHTML(p.id, chainOpts({ pid: p.id }), M.data.via != null ? M.data.sel : null, M.data.via);
      const curR = V.routes.find(x => x.id === p.rid), eNow = p.chain ? est({ pid: p.id, rid: arr(p.chain.r)[0], via: arr(p.chain.r)[1] }) : curR ? est({ pid: p.id, rid: curR.id }) : null;
      const nowL = `<div class="cl-nowl" style="display:flex;justify-content:space-between;align-items:center;gap:8px"><span>acum: <b>${p.chain ? chainTxt(p.chain) : curR ? `${escH(apName(curR.a))} ⇄ ${escH(apName(curR.b))}` : "fără rută"}</b>${p.st === "air" ? " · ✈️ în zbor" : ""}</span>${eNow && eNow.ok ? estHTML(eNow) : ""}</div>`;
      h = box(`Atribuie ruta · ${escH(t.sh)} „${escH(p.name)}”`, `${nowL}<p>Avionul face naveta pe ruta aleasă. Rază: <b>${fmtInt(t.range)} km</b>, ${t.seats} locuri.${anyEst ? ` <span class="cl-mut">Estimare: profit pe zi și cât de plin zboară.</span>` : ""}</p><div class="cl-list">${opts || `<div class="cl-empty">Nu ai rute încă. Construiește una din permise.</div>`}</div>${fit}${chains}`,
        `${p.rid != null ? `<button class="cl-btn" data-unassign="${escH(p.id)}" ${!canAct() ? "disabled" : ""}>Scoate de pe rută</button>` : ""}<button class="cl-btn ghost" data-mclose>Renunță</button><button class="cl-btn gold" data-massign ${M.data.sel == null || !canAct() ? "disabled" : ""}>Atribuie</button>`);
    } else if (M.kind === "putplane") {
      const r = V.routes.find(x => x.id === M.data.rid); if (!r) { closeModal(); return; }
      const free = p => p.st === "idle" || (p.rid == null && p.st !== "air");
      const nFree = V.planes.filter(free).length, showAll = !!U.showBusy;
      const whyTxt = w => escH(String(w).replace(/\.$/, "").replace(/^./, ch => ch.toLowerCase()));
      // fiecare avion: estimarea aici; pentru cele ocupate și profitul de acum → câștig/pierdere netă dacă îl muți
      const rows = V.planes.filter(p => showAll || free(p)).map(p => {
        const here = est({ pid: p.id, rid: r.id }), fly = r.dist <= p.tinfo.range && !(here && !here.ok);
        if (!fly) return { p, fly, why: r.dist > p.tinfo.range ? `rază prea mică (${fmtInt(p.tinfo.range)} km)` : here && here.why ? whyTxt(here.why) : "nu poate zbura aici" };
        const already = p.rid === r.id && !p.chain;
        const cur = !free(p) && !already ? (p.chain ? est({ pid: p.id, rid: p.chain.r[0], via: p.chain.r[1] }) : p.rid != null ? est({ pid: p.id, rid: p.rid }) : null) : null;
        const hp = here && here.profit != null ? here.profit : 0, gain = cur && cur.ok && cur.profit != null ? hp - cur.profit : free(p) ? hp : null;
        return { p, fly, here, cur, already, gain, hp };
      });
      const ok = rows.filter(x => x.fly).sort((a, b) => (a.already ? 1 : 0) - (b.already ? 1 : 0) || num(b.gain, -1e12) - num(a.gain, -1e12)), no = rows.filter(x => !x.fly);
      const optHTML = x => {
        const p = x.p, air = p.st === "air", curR = V.routes.find(y => y.id === p.rid);
        const where = p.chain ? `escala ${chainTxt(p.chain)}` : curR ? `${escH(apName(curR.a))}–${escH(apName(curR.b))}` : "";
        let l2;
        if (x.already) l2 = "zboară deja pe această rută";
        else if (free(p)) l2 = `liber · ${p.seats} locuri`;
        else {
          const cp = x.cur && x.cur.ok && x.cur.profit != null ? x.cur.profit : null;
          l2 = `acum ${cp != null ? `<b class="${cp >= 0 ? "pos" : "neg"}">${kDay(cp)}</b>` : "—"} pe ${where}`
            + (x.gain != null ? ` → <b class="${x.gain >= 0 ? "pos" : "neg"}">${x.gain >= 0 ? "câștigi" : "pierzi"} ${kDay(Math.abs(x.gain), 1)}</b>` : "");
        }
        if (air && !x.already) l2 += " · ✈️ după aterizare";
        return `<button class="cl-opt${M.data.sel === p.id ? " on" : ""}" data-psel="${escH(p.id)}" ${x.already ? "disabled" : ""}><span class="grow"><b>${escH(p.tinfo.n)} „${escH(p.name)}”</b><small>${l2}</small></span>${estHTML(x.here)}</button>`;
      };
      const opts = ok.map(optHTML).join("") + (no.length ? `<details class="cl-nofly"><summary class="cl-mut" style="cursor:pointer;font-size:12.5px;padding:6px 2px">Nu pot zbura aici (${no.length})</summary>${no.map(x => `<div class="cl-opt" style="opacity:.6;cursor:default"><span class="grow"><b>${escH(x.p.tinfo.n)} „${escH(x.p.name)}”</b><small>${x.why}</small></span></div>`).join("")}</details>` : "");
      const nBusy = V.planes.length - nFree, nFreeOk = rows.filter(x => x.fly && free(x.p)).length;
      // avion nou: tipul cu cel mai bun profit/zi care zboară ruta (cu salariul pilotului); doar dacă bate clar orice opțiune existentă
      const rsh = (V.raw && V.raw.shop) || {}, lz = {}; arr(pick(rsh, "lease")).forEach(x => { lz[ptIdx(pick(x, "ty", "type"))] = pick(x, "fee"); });
      let bestNew = null;
      for (const x of arr(pick(rsh, "new"))) {
        const ty = ptIdx(pick(x, "ty", "type")); if (num(pick(x, "range"), 0) < r.dist) continue;
        const e = est({ type: ty, rid: r.id }); if (!e || !e.ok || e.profit == null) continue;
        const w = e.profit - num(pick(x, "pilot"), 0);
        if (!bestNew || w > bestNew.w) bestNew = { ty, w, name: pick(x, "name") || ptInfo(ty).n, price: num(pick(x, "price")), lease: lz[ty] };
      }
      const bestHave = ok.filter(x => !x.already && x.gain != null).reduce((m, x) => Math.max(m, x.gain), -Infinity);
      const showNew = bestNew && bestNew.w > 0 && (!nFreeOk || bestNew.w > Math.max(0, bestHave) * 1.25 + 10000);
      const newHint = showNew ? `<div class="row" style="display:flex;gap:8px;align-items:center;margin-top:8px"><span style="flex:1;font-size:13px">Un <b>${escH(bestNew.name)}</b> nou ar face ~<b class="pos">${fmtDay(bestNew.w)}</b> aici <span class="cl-mut">(preț ${fmtE(bestNew.price)}${bestNew.lease != null ? ` / leasing ${fmtE(bestNew.lease, true)}/zi` : ""})</span></span><button class="cl-btn sm gold" data-mbuyty="${bestNew.ty}">🛒 Cumpără</button></div>` : "";
      const tog = nBusy ? `<label class="cl-tog"><input type="checkbox" data-showbusy ${showAll ? "checked" : ""}> Arată și avioanele ocupate (le muți de pe ruta lor) · ${nBusy}</label>` : "";
      // 🔀 escale care folosesc ruta asta: avioane libere, pe o rută care atinge X sau Y, ori pe o escală (o înlocuiești)
      const touches = rid => { const R = V.routes.find(y => y.id === rid); return !!R && (R.a === r.a || R.a === r.b || R.b === r.a || R.b === r.b); };
      const chRows = [];
      for (const p of V.planes) {
        if (!(free(p) || p.chain || (p.rid != null && touches(p.rid)))) continue;
        const cur = free(p) ? null : p.chain ? est({ pid: p.id, rid: p.chain.r[0], via: p.chain.r[1] }) : est({ pid: p.id, rid: p.rid });
        const cp = cur && cur.ok && cur.profit != null ? cur.profit : null;
        for (const x of chainOpts({ pid: p.id }, r.id)) {
          if (x.ok === false) continue;
          if (p.chain && [String(x.rid), String(x.via)].sort().join("|") === p.chain.r.map(String).sort().join("|")) continue; // e deja escala lui
          const e = est({ pid: p.id, rid: x.rid, via: x.via }); if (!e || !e.ok || e.profit == null) continue;
          chRows.push({ p, x, e, cp, gain: e.profit - (cp != null ? cp : 0) });
        }
      }
      chRows.sort((a, b) => b.gain - a.gain);
      const chShow = U.allChains ? chRows : chRows.slice(0, 5);
      const chains = chRows.length ? `<div class="cl-chainh"><b>🔀 Cu escală (avioane de-ale tale din apropiere)</b> <span class="cl-mut">— avionul zboară A → B → C și înapoi; maximum o escală.</span></div><div class="cl-list">${chShow.map(y => {
        const p = y.p, x = y.x, on = M.data.sel === p.id && String(M.data.crid) === String(x.rid) && String(M.data.via) === String(x.via);
        const now = free(p) ? "acum liber" : `${p.chain ? "înlocuiește escala · " : ""}acum ${y.cp != null ? `<b class="${y.cp >= 0 ? "pos" : "neg"}">${kDay(y.cp)}</b>` : "—"}`;
        return `<button class="cl-opt${on ? " on" : ""}" data-mchain="${escH(x.rid)}" data-via="${escH(x.via)}" data-cpid="${escH(p.id)}"><span class="grow"><b>${escH(p.tinfo.sh || p.tinfo.n)} „${escH(p.name)}”: ${escH(apName(x.a))} → ${escH(apName(x.b))} → ${escH(apName(x.c))}</b><small>${now} → cu escală <b class="${y.e.profit >= 0 ? "pos" : "neg"}">${kDay(y.e.profit)}</b> (<b class="${y.gain >= 0 ? "pos" : "neg"}">${y.gain >= 0 ? "+" : "−"}${kDay(Math.abs(y.gain), 1)}</b>)${p.st === "air" ? " · ✈️ după aterizare" : ""}</small></span></button>`;
      }).join("")}</div>${chRows.length > 5 ? `<button class="cl-btn sm ghost" data-allch>${U.allChains ? "Arată mai puține" : `Arată toate (${chRows.length})`}</button>` : ""}` : "";
      h = box(`Avion pentru ${escH(apName(r.a))} ⇄ ${escH(apName(r.b))}`, `<p>Ruta are <b>${fmtInt(r.dist)} km</b>. ${nFreeOk ? "Alege un avion; în dreapta vezi profitul estimat pe zi aici și cât de plin zboară." : nFree ? `<b class="neg">Niciun avion liber nu ajunge la ${fmtInt(r.dist)} km.</b>` : ""}</p>${nFree || showAll ? `<div class="cl-list">${opts || `<div class="cl-empty">Niciun avion.</div>`}</div>` : `<div class="cl-empty">Niciun avion liber.<br>Cumpără sau ia în leasing unul potrivit pentru ${fmtInt(r.dist)} km.</div>`}${tog}${newHint}${chains}`,
        `<button class="cl-btn${nFreeOk ? "" : " gold"}" data-mclose2>🛒 Cumpără avion</button><button class="cl-btn gold" data-passign ${M.data.sel == null || !canAct() ? "disabled" : ""}>Atribuie</button>`);
    } else if (M.kind === "pilotmin") {
      const p = V.planes.find(x => x.id === M.data.pid); if (!p) { closeModal(); return; }
      const seats = Math.max(1, p.seats), pc = p.pilotFee != null ? p.pilotFee : V.me.pilotCost;
      if (M.data.be === undefined) M.data.be = pminBreak(p);
      if (M.data.n == null) M.data.n = clamp(M.data.be != null ? M.data.be : Math.ceil(seats * .6), 1, seats);
      const n = clamp(num(M.data.n), 1, seats), be = M.data.be;
      h = box(`👨‍✈️ ${M.data.hire ? "Angajează pilot" : "Minimul de pasageri"} · ${escH(p.tinfo.n)} „${escH(p.name)}”`, `${M.data.hire && pc ? `<p>Salariu: <b>${fmtE(pc)}/zi</b>. Pilotul decolează singur, nu mai trebuie să apeși 🛫.</p>` : ""}
        <p>Pilotul pleacă când are minim <b>N</b> pasageri; dacă vin mai mulți curând, așteaptă să se umple (până la plin).</p>
        <div class="cl-pmin"><div class="hd"><span>Pleacă la minim <b data-pminv>${n}</b> pasageri</span><span data-pminp>${pminProfitHTML(p, n)}</span></div>
        <div class="trk"><input type="range" min="1" max="${seats}" step="1" value="${n}" data-pmin aria-label="Minimul de pasageri">${be != null ? `<i class="be" style="left:calc(${((be - 1) / Math.max(1, seats - 1) * 100).toFixed(1)}% * (1 - 18px / 100%) + 9px)" title="Prag de profit"></i>` : ""}</div>
        <div class="sc"><span>1</span>${be != null ? `<span class="bel">prag: ${be} pas.</span>` : ""}<span>${seats} (plin)</span></div></div>
        <p class="cl-mut" style="font-size:12.5px">Profitul e pentru un singur zbor cu N pasageri, la prețul tău de acum.${be != null ? " Sub prag zborul pierde bani." : p.beN != null && num(p.beN) > seats ? ` <span class="neg">La prețul de acum zborul pierde bani chiar și plin — crește prețul.</span>` : ""}</p>`,
        `<button class="cl-btn ghost" data-mclose>Renunță</button><button class="cl-btn gold" data-pminok ${!canAct() ? "disabled" : ""}>${M.data.hire ? `Angajează · min ${n}` : `Setează · min ${n}`}</button>`);
    } else if (M.kind === "pmenu") {
      const p = V.planes.find(x => x.id === M.data.pid); if (!p) { closeModal(); return; }
      const cur = V.routes.find(x => x.id === p.rid), ca = canAct(), air = p.st === "air";
      const eNow = cur && !p.chain ? est({ pid: p.id, rid: cur.id }) : p.chain ? est({ pid: p.id, rid: arr(p.chain.r)[0], via: arr(p.chain.r)[1] }) : null;
      const sv = sellOf(p), pc = p.pilotFee != null ? p.pilotFee : V.me.pilotCost, retD = num(pick((W.CerulTune || {}).lease || {}, "returnFeeDays"), 3);
      const lfee = (V.shop.new.find(x => ptIdx(x.type) === p.tinfo.ty) || {}).lease;
      const row = (attrs, ic, t, d, dis, cls) => `<button class="cl-opt${cls ? " " + cls : ""}" ${attrs} ${dis ? "disabled" : ""}><span style="font-size:22px">${ic}</span><span class="grow"><b>${t}</b><small>${d}</small></span></button>`;
      h = box(`${escH(p.tinfo.n)} „${escH(p.name)}”`, `<div style="display:flex;justify-content:center" data-raw>${planeSide(p.tinfo.k, V.me.color, 260)}</div>
        <div class="cl-sum"><span>${p.seats} locuri</span><span>rază ${fmtInt(p.tinfo.range)} km</span><span>${p.tinfo.speed} km/h</span>${p.age != null ? `<span>${num(p.age) < 1 ? "nou" : "vechime " + escH(p.age) + (num(p.age) === 1 ? " zi" : " zile")}</span>` : ""}${p.lease ? "<span>leasing</span>" : p.value != null ? `<span>valoare <b>${fmtE(p.value)}</b></span>` : ""}</div>
        ${p.tinfo.role ? `<p class="cl-mut" style="margin:6px 0 0">${escH(p.tinfo.role)}</p>` : ""}
        <div class="row" style="display:flex;justify-content:space-between;gap:8px;margin:8px 0;font-size:13.5px;color:var(--mut)"><span>Acum: <b style="color:var(--ink)">${p.chain ? `cu escală ${chainTxt(p.chain)}` : cur ? `${escH(apName(cur.a))} ⇄ ${escH(apName(cur.b))}` : "fără rută (nu câștigă nimic)"}</b></span>${eNow && eNow.ok ? estHTML(eNow) : ""}</div>
        <div class="cl-pmen">
          ${row(`data-assign="${escH(p.id)}"`, "🛣️", p.rid != null ? "Schimbă ruta" : "Atribuie rută", air ? "Poți după aterizare." : `Alegi ${p.rid != null ? "altă" : "o"} rută (sau una cu escală). Dacă e departe, zboară întâi gol până acolo.`, !ca || air)}
          ${row(`data-pilot="${escH(p.id)}"`, "👨‍✈️", p.pilot ? "Concediază pilotul" : `Angajează pilot${pc ? ` · ${fmtE(pc)}/zi` : ""}`, p.rid == null ? "Întâi pune avionul pe o rută." : p.pilot ? "Apoi decolezi tu, cu 🛫 Decolează." : "Decolează singur când zborul merită; nu mai trebuie să apeși tu.", !ca || p.rid == null)}
          ${p.pilot ? row(`data-pminopen="${escH(p.id)}"`, "🎚️", `Setează minimul de pasageri${p.pmin != null ? ` · acum ${num(p.pmin)}/${p.seats}` : ""}`, "Pilotul pleacă abia când are cel puțin atâția pasageri.", !ca) : ""}
          ${p.lease && p.buyoutPrice != null ? row(`data-buyout="${escH(p.id)}"`, "🔑", `Răscumpără · ${fmtE(p.buyoutPrice)}`, `Avionul devine al tău acum și scapi de chirie${p.daysToOwn != null ? ` (altfel, al tău automat peste ${num(p.daysToOwn)} zile de chirie)` : ""}.${V.me.cash < num(p.buyoutPrice) ? ` <span class="neg">Îți lipsesc ${fmtE(num(p.buyoutPrice) - V.me.cash)}.</span>` : ""}`, !ca || V.me.cash < num(p.buyoutPrice)) : ""}
          ${row(`data-sell="${escH(p.id)}"`, p.lease ? "📄" : "💶", p.lease ? `Returnează${lfee != null ? ` · ${fmtE(lfee * retD)}` : ""}` : `Vinde${sv != null ? ` · primești ${fmtE(sv)}` : ""}`, air ? "Poți după aterizare." : p.lease ? `Scapi de chirie; plătești ${retD} zile de chirie la returnare.` : "Primești banii acum; avionul dispare din flotă.", !ca || air, "danger")}
        </div>`, `<button class="cl-btn ghost" data-mclose>Închide</button>`);
    } else if (M.kind === "offer") {
      const sel = M.data.sel || (M.data.sel = new Set());
      const room = V.maxPermits - V.permits.length;
      edge = true;
      h = box("Alege permisele", `<p>Păstrează <b>cel puțin unul</b> (ai loc pentru ${room}). Cele nealese se întorc în teanc.</p><div class="cl-list">${V.offer.map(o => { const id = pick(o, "id"), a = pick(o, "a", "from"), b = pick(o, "b", "to"), cost = pick(o, "cost", "need") || {}; const icons = Object.keys(cost).map(k => (RES[resKey(k)] || { i: "🃏" }).i.repeat(num(cost[k]))).join(""); return `<button class="cl-opt${sel.has(id) ? " on" : ""}" data-osel="${escH(id)}"><span style="font-size:20px">${sel.has(id) ? "✅" : "⬜"}</span><span class="grow"><b>${escH(apName(a))} → ${escH(apName(b))}</b><small>${fmtInt(num(pick(o, "dist"), 0) || dist(a, b))} km · cost: ${icons || "—"}${pick(o, "slotCost") ? ` · sloturi ${fmtE(pick(o, "slotCost"))}` : ""}</small></span><span class="cl-eye" role="button" data-pv="${escH(a)}|${escH(b)}" aria-label="Arată ruta pe hartă">👁</span></button>`; }).join("")}</div><p class="cl-mut cl-pvhint" style="font-size:12.5px">Ține mouse-ul pe un permis ca să vezi ruta pe hartă.</p>`,
        `<button class="cl-btn gold" data-okeep ${!canAct() || sel.size < 1 || sel.size > Math.max(1, room) ? "disabled" : ""}>Păstrează ${sel.size || ""}</button>`);
    } else if (M.kind === "ghiseu") {
      const give = M.data.give || (M.data.give = {}), tot = Object.values(give).reduce((a, b) => a + b, 0);
      const types = ["apr", "inf", "ech", "comb"];
      h = box("🃏 Ghișeu", `<p>Alege <b>5 cărți normale</b> pe care le dai (Jokerii nu se schimbă), apoi tipul pe care îl primești.</p>
        <div class="cl-gis">${types.map(k => { const n = num(V.hand[k]), g = num(give[k]); return `<button class="cl-rc${g ? " on" : ""}${n ? "" : " zero"}" style="background:linear-gradient(160deg,${RES[k].c},${shade(RES[k].c, -.35)})" data-give="${k}" ${n ? "" : "disabled"} aria-label="${RES[k].n}: dai ${g} din ${n}"><span class="ic" data-raw>${resIcon(k)}</span><span>${RES[k].s}</span><em>${n}</em>${g ? `<span class="ct">−${g}</span>` : ""}</button>`; }).join("")}<button class="cl-btn sm ghost" data-give0 style="align-self:center">Resetează</button></div>
        <p>Dai: <b>${tot}/5</b> → primești:</p><div class="cl-seg">${types.map(k => `<button class="${M.data.get === k ? "on" : ""}" data-get="${k}">${RES[k].i} ${RES[k].s}</button>`).join("")}</div>
        <hr style="border:0;border-top:1px solid var(--line);margin:4px 0"><p>Sau cumpără o carte aleatorie cu bani${V.cardPrice != null ? `: <b>${fmtE(V.cardPrice)}</b> (prețul crește ×1,6 la fiecare carte cumpărată azi)` : ""}. Cărțile speciale nu se pot cumpăra.</p>`,
        `<button class="cl-btn" data-buycard ${!canAct() || (V.cardPrice != null && V.me.cash < V.cardPrice) ? "disabled" : ""}>💶 Cumpără o carte</button><button class="cl-btn gold" data-gok ${!canAct() || tot !== 5 || !M.data.get ? "disabled" : ""}>Schimbă 5 → 1</button>`);
    } else if (M.kind === "target") {
      const inf = specInfo(M.data.card), tg = inf.tgt;
      let list = "";
      if (tg === "opp") list = V.opps.map(o => { const dis = o.bankrupt || (inf.sk === "freeze" && (o.frozen || o.pact)); return `<button class="cl-opt${M.data.sel === o.seat ? " on" : ""}" data-tsel="${escH(o.seat)}" ${dis ? "disabled" : ""}><span class="cl-av" style="--c:${o.color};width:38px;height:38px">${avatarHTML(o.av, 38)}</span><span class="grow"><b>${escH(o.co || o.name)}</b><small>${escH(o.name)} · ${o.planes === 1 ? "1 avion" : o.planes + " avioane"}${o.frozen ? " · deja înghețat" : ""}${o.pact ? " · aveți pact" : ""}</small></span></button>`; }).join("");
      else if (tg === "route") list = V.routes.map(r => `<button class="cl-opt${M.data.sel === r.id ? " on" : ""}" data-tsel="${escH(r.id)}"><span class="grow"><b>${escH(apName(r.a))} ⇄ ${escH(apName(r.b))}</b><small>cerere ${fmtInt(r.demand)}/zi · cota ta ${Math.round(r.share * 100)}%</small></span></button>`).join("") || `<div class="cl-empty">Nu ai rute.</div>`;
      else if (tg === "airport") { const set = new Set(); V.permits.forEach(p => { set.add(p.a); set.add(p.b); }); V.routes.forEach(r => { set.add(r.a); set.add(r.b); }); const tl = (V.specials.find(x => x.sk === inf.sk) || {}).targets; list = [...set].map(id => { const a = apObj(id), ok = !tl || tl.includes(id); return `<button class="cl-opt${M.data.sel === id ? " on" : ""}" data-tsel="${escH(id)}" ${ok ? "" : "disabled"}><span class="grow"><b>${escH(a.n)}</b><small>aeroport ${SIZE_N[a.size] || ""}${ok ? "" : " · nu e nevoie de slot aici"}</small></span></button>`; }).join("") || `<div class="cl-empty">Niciun aeroport potrivit.</div>`; }
      else if (tg === "permit") list = V.permits.map(p => { const pl = buildPlan(p), ok = p.canFast || pl.miss <= 1; return `<button class="cl-opt${M.data.sel === p.id ? " on" : ""}" data-tsel="${escH(p.id)}" ${ok ? "" : "disabled"}><span class="grow"><b>${escH(apName(p.a))} → ${escH(apName(p.b))}</b><small>${pl.miss ? (pl.miss > 1 ? `îți lipsesc ${pl.miss} cărți` : "îți lipsește 1 carte") : "ai toate cărțile — economisești una"}</small></span></button>`; }).join("") || `<div class="cl-empty">Nu ai permise deschise.</div>`;
      else if (tg === "pair") {
        const net = new Set([V.me.base, ...V.me.hubs]); V.routes.forEach(r => { net.add(r.a); net.add(r.b); });
        const D = H.Data(), all = ((D && D.AIRPORTS) || []).slice().sort((x, y) => String(x.n).localeCompare(String(y.n), "ro"));
        const f = fold(M.data.q || "");
        list = `<p>1) Pleci din rețeaua ta:</p><div style="display:flex;gap:6px;flex-wrap:wrap">${[...net].filter(Boolean).map(id => `<button class="cl-btn sm${M.data.sel === id ? " on" : ""}" data-tsel="${escH(id)}">${escH(apName(id))}</button>`).join("")}</div>`;
        if (M.data.sel) list += `<p>2) Destinația (oricare aeroport în raza unui avion):</p><input class="cl-q" data-tq placeholder="Caută oraș…" value="${escH(M.data.q || "")}" style="background:#08111f;border:1px solid var(--line2);border-radius:8px;color:var(--ink);padding:7px 10px;font-size:14px"><div class="cl-list" style="max-height:240px;overflow:auto">${all.filter(a => a.id !== M.data.sel && (!f || fold(a.n).includes(f) || fold(a.id).includes(f))).slice(0, 40).map(a => `<button class="cl-opt${M.data.b === a.id ? " on" : ""}" data-tb="${escH(a.id)}"><span class="grow"><b>${escH(a.n)}</b><small>${escH(a.c || "")} · ${fmtInt(dist(M.data.sel, a.id))} km</small></span></button>`).join("")}</div>`;
      }
      if (tg === "opp" && inf.sk === "spy" && M.data.sel != null) {
        const o = V.opps.find(x => x.seat === M.data.sel);
        list += `<p style="margin-top:6px">Ce rută a lui ${escH(o ? o.co || o.name : "")} spionezi?</p>` + ((o && o.routes) || []).map(r => { const id = pick(r, "id", "rid"); return `<button class="cl-opt${M.data.rid === id ? " on" : ""}" data-trid="${escH(id)}"><span class="grow"><b>${escH(apName(pick(r, "a")))} – ${escH(apName(pick(r, "b")))}</b></span></button>`; }).join("");
      }
      h = box(`${inf.i} ${escH(inf.n)}`, `<p>${escH(inf.d || "")}</p><div class="cl-list">${list}</div>`, `<button class="cl-btn ghost" data-mclose>Renunță</button><button class="cl-btn gold" data-tok ${!canAct() || M.data.sel == null || (tg === "pair" && !M.data.b) || (inf.sk === "spy" && M.data.rid == null) ? "disabled" : ""}>Folosește</button>`);
    } else if (M.kind === "bulkmin") { // UI-B: minimul pilotului pe mai multe avioane (procent din locuri)
      const L = selPlanes().filter(p => p.pilot), pct = clamp(num(M.data.pct, 60), 5, 100);
      if (!L.length) { closeModal(); return; }
      const nOf = p => clamp(Math.ceil(Math.max(1, p.seats) * pct / 100), 1, Math.max(1, p.seats));
      h = box(`🎚️ Minimul pilotului · ${L.length} ${L.length === 1 ? "avion" : "avioane"}`, `<p>Fiecare pilot pleacă când are cel puțin <b>${pct}%</b> din locuri ocupate.</p>
        <div class="cl-pin"><input type="range" min="5" max="100" step="5" value="${pct}" data-bpct aria-label="Procent din locuri"><b style="min-width:52px;text-align:right">${pct}%</b></div>
        <div class="cl-bprev">${L.map(p => `<div><span>${escH(p.tinfo.n)} „${escH(p.name)}”</span><b>min ${fmtInt(nOf(p))}/${fmtInt(p.seats)}</b></div>`).join("")}</div>`,
        `<button class="cl-btn ghost" data-mclose>Renunță</button><button class="cl-btn gold" data-bminok ${!canAct() ? "disabled" : ""}>Aplică pe ${L.length}</button>`);
    } else if (M.kind === "bulkroute") { // UI-B: mută avioanele selectate pe o rută
      const S = selPlanes();
      if (!S.length) { closeModal(); return; }
      const opts = V.routes.map(r => { const ok = S.filter(p => r.dist <= p.tinfo.range && !(p.rid === r.id && !p.chain)); return `<button class="cl-opt${String(M.data.sel) === String(r.id) ? " on" : ""}" data-bsel="${escH(r.id)}" ${ok.length ? "" : "disabled"}><span class="grow"><b>${escH(apName(r.a))} ⇄ ${escH(apName(r.b))}</b><small>${fmtInt(r.dist)} km · ${r.planes} ${r.planes === 1 ? "avion" : "avioane"} acum${ok.length < S.length ? ` · ${S.length - ok.length} nu ajung / sunt deja aici` : ""}</small></span><span class="cl-est"><b>${ok.length}/${S.length}</b><small>se mută</small></span></button>`; }).join("");
      h = box(`🛣️ Mută ${S.length} ${S.length === 1 ? "avion" : "avioane"} pe o rută`, `<p>Avioanele în zbor se mută după aterizare. Cele cu rază prea mică rămân unde sunt.</p><div class="cl-list">${opts}</div>`,
        `<button class="cl-btn ghost" data-mclose>Renunță</button><button class="cl-btn gold" data-brok ${M.data.sel == null || !canAct() ? "disabled" : ""}>Atribuie</button>`);
    } else if (M.kind === "bulkprice") { // UI-B: preț pe rutele avioanelor selectate (ambele sensuri)
      const rids = [...new Set(selPlanes().map(p => p.rid).filter(x => x != null))], rs = V.routes.filter(r => rids.some(x => String(x) === String(r.id)));
      if (!rs.length) { closeModal(); return; }
      const mode = M.data.mode || "rec", B = [["rec", "Recomandat"], ["normal", "Normal"], ["-10", "−10%"], ["-5", "−5%"], ["5", "+5%"], ["10", "+10%"]];
      h = box(`🏷️ Preț pe ${rs.length} ${rs.length === 1 ? "rută" : "rute"}`, `<p>Se aplică pe ambele sensuri ale rutelor pe care zboară avioanele selectate.</p>
        <div class="cl-seg" style="flex-wrap:wrap">${B.map(([k, n]) => `<button class="${mode === k ? "on" : ""}" data-bpm="${k}">${n}</button>`).join("")}</div>
        <div class="cl-bprev">${rs.map(r => { const np = bulkPriceOf(r, mode), cur = r.price.ab === r.price.ba ? fmtE(r.price.ab) : `${fmtE(r.price.ab)} / ${fmtE(r.price.ba)}`; return `<div><span>${escH(apName(r.a))} ⇄ ${escH(apName(r.b))}</span><b>${cur} → ${fmtE(np)}</b></div>`; }).join("")}</div>`,
        `<button class="cl-btn ghost" data-mclose>Renunță</button><button class="cl-btn gold" data-bpok ${!canAct() ? "disabled" : ""}>Aplică pe ${rs.length}</button>`);
    } else if (M.kind === "confirm") {
      h = box(M.data.title, `<p>${M.data.text}</p>`, `<button class="cl-btn ghost" data-mclose>Nu</button><button class="cl-btn ${M.data.danger ? "red" : "gold"}" data-mconfirm>${M.data.yes || "Da"}</button>`);
    } else if (M.kind === "shares") {
      const n = num(M.data.n, 1), seat = M.data.seat, row = V.shares.find(r => r.seat === seat) || {}, price = num(row.price), o = V.opps.find(x => x.seat === seat) || (seat === me() ? V.me : {});
      const max = Math.max(1, M.data.buy ? (seat === me() ? num(row.held) : 49 - num(row.own)) : num(row.own));
      h = box(`${M.data.buy ? "Cumpără" : "Vinde"} acțiuni · ${escH(o.co || o.name || "")}`, `<p>Preț: <b>${fmtE(price)}</b> / acțiune${M.data.buy ? " (+2% comision)" : ""}.</p><div class="cl-pin"><input type="range" min="1" max="${max}" value="${clamp(n, 1, max)}" data-shn><b style="min-width:40px;text-align:right">${clamp(n, 1, max)}</b></div><p>Total: <b>${fmtE(price * clamp(n, 1, max) * (M.data.buy ? 1.02 : 1))}</b></p>`, `<button class="cl-btn ghost" data-mclose>Renunță</button><button class="cl-btn gold" data-shok ${!canAct() ? "disabled" : ""}>${M.data.buy ? "Cumpără" : "Vinde"}</button>`);
    } else if (M.kind === "bankfb") {
      const lim = num(pick(V.bank, "limit", "max")), amt = clamp(num(M.data.amt, Math.min(lim, 2e6)), 0, Math.max(0, lim)), days = M.data.days || 20;
      const loans = arr(pick(V.bank, "loans"));
      h = box("🏦 Bancă", `<p>Limită de credit: <b>${fmtE(lim)}</b>. Rata se plătește zilnic, cu dobândă. Rambursarea anticipată e gratuită.</p>
        <div class="cl-pin"><input type="range" min="0" max="${Math.max(0, Math.round(lim / 1e5) * 1e5)}" step="100000" value="${amt}" data-bamt><b style="min-width:90px;text-align:right">${fmtE(amt)}</b></div>
        <div class="cl-seg">${(V.bank.terms.map(x => num(typeof x === "object" && x ? pick(x, "d", "days") : x)).filter(x => x > 0).length ? V.bank.terms.map(x => num(typeof x === "object" && x ? pick(x, "d", "days") : x)).filter(x => x > 0) : [10, 20, 30]).map(d => `<button class="${days === d ? "on" : ""}" data-bdays="${d}">${d} zile</button>`).join("")}</div>
        ${loans.length ? `<div class="cl-list">${loans.map(l => `<div class="cl-opt"><span class="grow"><b>${fmtE(pick(l, "left", "rest", "amount"))} rămas</b><small>${escH(pick(l, "days", "daysLeft") || "")} zile · rată ${fmtE(pick(l, "inst", "rate") || 0)}/zi</small></span><button class="cl-btn sm" data-repay="${escH(pick(l, "id"))}" data-amt="${num(pick(l, "left", "rest", "amount"))}">Rambursează</button></div>`).join("")}</div>` : ""}`,
        `<button class="cl-btn ghost" data-mclose>Închide</button><button class="cl-btn gold" data-bok ${!canAct() || amt <= 0 ? "disabled" : ""}>Ia credit</button>`);
    } else if (M.kind === "negofb") {
      h = box("🤝 Negociază", `<p>Cu cine vrei să negociezi? Timpul se oprește pentru toți cât durează discuția (max. 2 minute). Poți deschide o negociere pe zi.</p><div class="cl-list">${V.opps.filter(o => !o.bankrupt).map(o => `<button class="cl-opt${M.data.sel === o.seat ? " on" : ""}" data-nsel="${escH(o.seat)}"><span class="cl-av" style="--c:${o.color};width:38px;height:38px">${avatarHTML(o.av, 38)}</span><span class="grow"><b>${escH(o.co || o.name)}</b><small>${escH(o.name)}${o.bot ? " · bot" : ""}</small></span></button>`).join("")}</div>`,
        `<button class="cl-btn" data-nok="loan" ${M.data.sel == null ? "disabled" : ""}>💶 Cere împrumut</button><button class="cl-btn gold" data-nok="nego" ${M.data.sel == null ? "disabled" : ""}>🤝 Deschide negocierea</button>`);
    }
    const sx = E.modw.querySelector(".cl-mcard"), sc = sx ? sx.scrollTop : 0;
    E.modw.innerHTML = h;
    const nx = E.modw.querySelector(".cl-mcard"); if (nx) nx.scrollTop = sc;
  }

  /* ---------- meniu, toasturi, bannere ---------- */
  function drawMenu() {
    let m = E.top.querySelector(".cl-menu");
    if (!U.menu) { if (m) m.remove(); return; }
    if (!m) { m = document.createElement("div"); m.className = "cl-menu"; m.setAttribute("role", "menu"); E.top.appendChild(m); }
    m.innerHTML = `<button class="cl-tb" data-k="table" role="menuitem">${IC("people", "👥")} <span>Masă (locuri, boți)</span></button><button class="cl-tb" data-k="newgame" role="menuitem">↻ <span>Joc nou</span></button><button class="cl-tb" data-k="resettable" role="menuitem">🔄 <span>Resetează masa</span></button><button class="cl-tb" data-ua="settings" role="menuitem">${IC("settings", "⚙️")} <span>Setări</span></button>${U.mode === "phone" && me() ? `<button class="cl-tb" data-ua="rx" role="menuitem">😀 <span>Reacții</span></button>` : ""}${U.mode !== "phone" ? `<button class="cl-tb" data-ua="keys" role="menuitem">${IC("keyboard", "⌨")} <span>Scurtături (?)</span></button>` : ""}<button class="cl-tb" data-k="rules" role="menuitem">❓ <span>Reguli</span></button><button class="cl-tb" data-k="guide" role="menuitem">${IC("guide", "📖")} <span>Ghid ilustrat</span></button><button class="cl-tb" data-k="maponly" role="menuitem">${IC("map", "🗺️")} <span>${U.maponly ? "Arată panourile" : "Doar harta"} (M)</span></button>${me() && V && (V.canPause || V.why === "pause") ? `<button class="cl-tb" data-k="pause" role="menuitem">${V.why === "pause" ? "▶️ <span>Continuă jocul</span>" : "⏸ <span>Pauză pentru toți</span>"}</button>` : ""}${U.mode === "phone" ? `<button class="cl-tb" data-k="salon" role="menuitem">← <span>Înapoi în salon</span></button><button class="cl-tb" data-k="fs" role="menuitem">⛶ <span>Ecran complet</span></button>` : ""}${me() && canAct() ? `<button class="cl-tb" data-k="resign" role="menuitem" style="color:#ffb3b3">🏳️ <span>Abandonează compania</span></button>` : ""}`;
  }
  // toast scurt: max 3 pe ecran, dispare singur, clic = acțiunea lui (sau închide); o = {key, ms, btns:[{l,f,gold}], onClick}
  function dropToast(t) { if (!t || t.__out) return; t.__out = 1; t.classList.add("out"); T.timeout(() => t.remove(), 380); }
  function toast(text, kind, icon, o) {
    if (!text) return null; o = o || {};
    if (o.key) { const old = E.toasts.querySelector(`[data-tkey="${CSS.escape(String(o.key))}"]`); if (old) old.remove(); }
    const t = document.createElement("div"); t.className = "cl-toast " + (kind || ""); t.setAttribute("role", "status");
    if (o.key) t.dataset.tkey = o.key;
    t.innerHTML = `<i>${icon || (kind === "bad" ? "⚠️" : kind === "good" ? "✅" : kind === "gold" ? "💰" : "✈️")}</i><span>${escH(text)}${o.btns && o.btns.length ? `<span class="tb">${o.btns.map((b, i) => `<button data-tbi="${i}" class="${b.gold ? "gold" : ""}">${escH(b.l)}</button>`).join("")}</span>` : ""}</span>`;
    t.addEventListener("click", ev => {
      ev.stopPropagation();
      const b = ev.target.closest && ev.target.closest("[data-tbi]");
      try { if (b && o.btns[+b.dataset.tbi]) o.btns[+b.dataset.tbi].f(); else if (o.onClick) o.onClick(); } catch (er) { console.warn("CerulUI: toast", er); }
      dropToast(t);
    });
    E.toasts.appendChild(t);
    const live = Array.from(E.toasts.children).filter(x => !x.__out);
    for (let i = 0; i < live.length - 3; i++) live[i].remove();
    T.timeout(() => dropToast(t), o.ms || (o.btns ? 8000 : kind === "bad" ? 5200 : 4200));
    return t;
  }
  function banner(title, sub, tone) {
    const b = document.createElement("div"); b.className = "cl-banner " + (tone || ""); b.innerHTML = `${escH(title)}${sub ? `<small>${escH(sub)}</small>` : ""}`;
    E.banw.innerHTML = ""; E.banw.appendChild(b); T.timeout(() => b.remove(), 4300);
  }
  function burst(target, amount) {
    const A = H.Art(); if (!target) return;
    const r = target.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
    if (A && A.moneyBurst && !reduced) { try { A.moneyBurst(x, y, amount, { container: el, color: amount >= 0 ? "#5fd38a" : "#ff6b6b" }); return; } catch (e) { /* rezervă */ } }
    try { ctx.fx && ctx.fx.float && ctx.fx.float({ x, y }, fmtSigned(amount), amount >= 0 ? "#5fd38a" : "#ff6b6b"); } catch (e) { /* ignorat */ }
  }

  /* ---------- efecte la schimbări (sunete, toasturi, bani) ---------- */
  function diffEffects(a, b) {
    if (!b) return;
    // erori de la LOGIC (st.err[me] = {n, msg})
    const er = b.err;
    if (er && pick(er, "n") !== U.errN) { if (U.errN !== null && a) { toast(pick(er, "msg") || "Acțiunea nu a fost permisă.", "bad"); sfx.error(); } U.errN = pick(er, "n"); }
    else if (!er && U.errN === null) U.errN = undefined;
    if (!a) { U.lastDay = (clockInfo() || {}).day; U.seenLog = b.log.length ? Math.max(...b.log.map(l => num(l.id))) : 0; return; }
    const g = V.me.g || (num(V.me.av) >= 5 ? "f" : "m"), vars = { p: V.me.name, g };
    // avioane: decolări, aterizări (profit = diferența de profit al rutei), defecțiuni
    const pa = {}; a.planes.forEach(p => pa[p.id] = p);
    const rDelta = {}; b.routes.forEach(r => { const o = a.routes.find(x => x.id === r.id); if (o) rDelta[r.id] = r.flightsToday - o.flightsToday; }); // profitul unui zbor = diferența venit − zbor (fără costurile fixe care curg continuu)
    b.planes.forEach(p => {
      const o = pa[p.id];
      if (!o) { if (a.planes.length || b.planes.length > 1) { sfx.powerup(); toast(`Avion nou în flotă: ${p.tinfo.n} „${p.name}”.`, "good", "🛬"); notify("planeBought"); } return; }
      if (o.st !== "air" && p.st === "air" && !p.ferry) { if (p.pilot) sfx.whoosh(); }
      if (o.st === "air" && p.st !== "air") {
        const d = p.rid != null ? rDelta[p.rid] : null;
        if (!o.ferry && p.rid != null) { U.landings = (U.landings || 0) + 1; U.lastLandP = d; }
        if (!o.ferry && d != null && d !== 0) {
          U.lastProfit[p.id] = d; rDelta[p.rid] = 0;
          ASFX.play(d < 0 ? "loss" : d >= Math.max(40000, num(V.me.value) * .004) ? "register" : "land");
          const card = E.pane.querySelector(`[data-plane="${CSS.escape(String(p.id))}"]`);
          burst(card && card.offsetParent ? card : E.cash, d);
          if (d < 0) toast(`„${p.name}” a aterizat la ${apName(p.at || p.to)} pe pierdere: ${fmtSigned(d)}.`, "bad", "📉");
        } else sfx.tock();
      }
      if (!o.frozen && p.frozen) sfx.splash();
      if (o.st !== "broken" && p.st === "broken") { sfx.buzz(); toast(`„${p.name}” are o defecțiune — întârziere de ${gdur(p.delay)}.`, "bad", "🔧"); }
      if (p.st === "board" && !p.pilot && !p.go && o.pax < p.seats && p.pax >= p.seats) { sfx.ping(); toast(`„${p.name}” e plin la ${apName(p.at)} — apasă „Decolează”!`, "gold", "🛫"); }
    });
    // rute noi
    b.routes.filter(r => !a.routes.some(x => x.id === r.id)).forEach(r => { sfx.horn(); banner("Rută nouă!", `${apName(r.a)} ⇄ ${apName(r.b)}`, "gold"); if (!b.planes.some(p => p.st === "idle")) toast(`Ruta ${apName(r.a)} – ${apName(r.b)} e gata. Cumpără un avion sau mută unul pe ea.`, "good", "🛣️"); else toast(`Ruta ${apName(r.a)} – ${apName(r.b)} e gata. Atribuie-i un avion din hangar!`, "good", "🛣️"); notify("built"); });
    // cărți primite
    RES_ORDER.forEach(k => { if (num(b.hand[k]) > num(a.hand[k])) { U.bumped[k] = 1; T.timeout(() => { delete U.bumped[k]; }, 700); } });
    if (b.specials.reduce((x, y) => x + y.count, 0) > a.specials.reduce((x, y) => x + y.count, 0)) sfx.chime();
    // scenele pe tot ecranul (draft / negociere / final) stau SUB modale (z 35 < 40): închide modalele de joc când încep,
    // iar oferta de permise se (re)deschide abia când jocul curge din nou.
    const sceneOn = x => x.why === "draft" || x.why === "nego" || x.why === "end" || x.why === "setup";
    if (sceneOn(b) && !sceneOn(a) && U.modal && U.modal.kind !== "confirm") closeModal();
    if (b.offer.length && !sceneOn(b) && (!a.offer.length || sceneOn(a)) && !U.modal) { sfx.deal(); openModal("offer"); if (!a.offer.length) notify("permitDrawn"); }
    if (!b.offer.length && a.offer.length && U.modal && U.modal.kind === "offer") closeModal();
    if (b.permits.length > a.permits.length) notify("permitKept");
    const spA = num(a.raw && a.raw.invest && a.raw.invest.spent), spB = num(b.raw && b.raw.invest && b.raw.invest.spent);
    if (spB > spA && a.raw && a.raw.invest) { sfx.horn(); toast(`Investiție finalizată: ${fmtE(spB - spA)}.`, "good", "🏗️"); }
    // pauză pornită / oprită: butoanele din modalul deschis își schimbă starea
    if ((a.why === "pause") !== (b.why === "pause")) { if (U.modal && U.modal.kind !== "confirm") drawModal(); sfx.tock(); }
    // bani pe minus
    if (b.me.cash < 0 && a.me.cash >= 0) { sfx.alarm(); banner("Bani pe minus!", `Ai ${b.me.negDays != null ? b.me.negDays + " zile" : "câteva zile"} să revii pe plus. Ia un credit sau vinde ceva.`, "red"); }
    // oponenți (doar informații publice)
    b.opps.forEach(o => { const p = a.opps.find(x => x.seat === o.seat); if (!p) return; if (!p.frozen && o.frozen) { sfx.splash(); toast(`${o.co || o.name} e înghețată!`, "", "❄️"); } if (!p.bankrupt && o.bankrupt) toast(`${o.co || o.name} a dat faliment.`, "bad", "💥"); if (o.routes.length > p.routes.length) sfx.tock(); });
    // evenimente noi
    const seen = new Set(a.events.map(e => evInfo(e).key));
    b.events.forEach(ev => { const e = evInfo(ev); if (seen.has(e.key)) return; ASFX.play("dingdong"); T.timeout(() => ASFX.play(e.mood === "rau" ? "alert" : "event"), 1500); banner(`${e.icon} ${e.n}`, e.txt, e.mood === "rau" ? "red" : "gold"); });
    // jurnal public → replici amuzante (CerulData.LINES)
    const maxId = b.log.length ? Math.max(...b.log.map(l => num(l.id))) : 0;
    if (U.seenLog != null) b.log.filter(l => num(l.id) > U.seenLog).slice(-3).forEach(l => logToast(l));
    U.seenLog = Math.max(num(U.seenLog), maxId);
    // zi nouă
    const c = clockInfo(); if (c && U.lastDay != null && num(c.day) > num(U.lastDay)) { sfx.start(); toast(`Începe ziua ${c.day}.`, "", "🌅"); notify("dayEnd"); U.lastProfit = {}; }
    if (c) U.lastDay = c.day;
    if (b.phase !== a.phase) { if (b.phase === "draft") sfx.shuffle(); if (b.phase === "play" && a.phase === "setup") { sfx.start(); banner("Decolăm!", "Construiește rute, cumpără avioane, umple-le cu pasageri.", "gold"); T.timeout(() => { const G = H.Guide(); if (G && G.autoOpen && me() && !helpers.auto && !W.__CERUL_AUTO) { try { G.autoOpen(el, Object.assign({}, helpers, { Art: H.Art(), Data: H.Data() })); } catch (e) { /* ignorat */ } } }, 2500); } }
  }
  function logToast(l) {
    const who = s => s === me() ? V.me : V.opps.find(o => o.seat === s) || {};
    const P = who(l.s), O = who(l.o);
    const vars = { p: P.name || nameOf(l.s), o: O.name || (l.o ? nameOf(l.o) : ""), c: P.co || "", g: P.g || (num(P.av) >= 5 ? "f" : "m"), og: O.g || (num(O.av) >= 5 ? "f" : "m"), x: l.x ? apName(l.x) : "", y: l.y ? apName(l.y) : "", a: l.x ? apName(l.x) : "", b: l.y ? apName(l.y) : "", r: l.x && l.y ? `${apName(l.x)}–${apName(l.y)}` : "", n: l.n != null ? l.n : "" };
    if (typeof l.x === "string" && /^[a-z]/.test(l.x)) { const inf = specInfo(l.x); vars.card = inf.n; }
    const txt = line(l.k, vars) || (l.k === "negoInvite" ? `📨 ${vars.p} ${l.o === me() ? "te invită" : (vars.og === "f" ? "o invită pe " : "îl invită pe ") + vars.o} la masa negocierii` : l.k === "negoJoin" ? `🤝 ${vars.p} a venit la masa negocierii` : "");
    if (l.k === "rivalIn" && rivalToast(l)) return;
    if (txt) toast(txt, l.s === me() ? "good" : "", l.s === me() ? "🗞️" : "📰");
  }
  /* ================= R1 UI-A: bara de sus (delte, loc, conexiune), raport, ziar, reacții, anulare, setări ================= */
  const A_ = { made: false, rxSeen: null, rxAt: 0, newsKey: null, newsT: 0, repDay: null, rp: {}, rpDay: null, undoKey: null, panel: null };
  function ensureA() {
    if (A_.made) return; A_.made = true;
    [E.cash, E.value].forEach(s => { if (s && !s.querySelector(".cl-dl")) { const i = document.createElement("i"); i.className = "cl-dl"; s.appendChild(i); } });
    if (E.value && !E.value.querySelector(".cl-rkb")) { const r = document.createElement("em"); r.className = "cl-rkb"; r.hidden = true; E.value.appendChild(r); }
    const bt = E.top.querySelector(".cl-btns"), mb = bt && bt.querySelector("[data-k=menu]");
    if (bt && mb) {
      const rx = document.createElement("button"); rx.className = "cl-tb"; rx.dataset.ua = "rx"; rx.title = "Reacții (le văd toți)"; rx.setAttribute("aria-label", "Reacții"); rx.innerHTML = `<span class="ic">😀</span>`;
      const sg = document.createElement("button"); sg.className = "cl-tb"; sg.dataset.ua = "settings"; sg.title = "Setări: volum, grafică, text"; sg.setAttribute("aria-label", "Setări"); sg.innerHTML = `<span class="ic">${IC("settings", "⚙️")}</span>`;
      bt.insertBefore(rx, mb); bt.insertBefore(sg, mb);
    }
    const ov = el.querySelector(".cl-ov");
    if (ov) { A_.news = document.createElement("div"); A_.news.className = "cl-newsw"; ov.appendChild(A_.news); A_.rep = document.createElement("div"); A_.rep.className = "cl-repw"; ov.appendChild(A_.rep); }
    A_.pw = document.createElement("div"); A_.pw.className = "cl-pnlw"; el.appendChild(A_.pw);
    applySettings();
  }
  function applySettings() {
    const s = setGet();
    el.classList.toggle("tx-s", s.txt === "s"); el.classList.toggle("tx-l", s.txt === "l");
    const low = s.gfx === "low" || (s.gfx === "auto" && (reduced || num(W.devicePixelRatio, 1) < 1.1 && num(navigator.hardwareConcurrency, 8) <= 2));
    el.classList.toggle("gfx-low", low); el.classList.toggle("gfx-high", s.gfx === "high");
    try { mapApi && mapApi.setQuality && mapApi.setQuality(["auto", "low", "high"].includes(s.gfx) ? s.gfx : "auto"); } catch (e) { /* hartă fără calitate */ }
    const mv = document.getElementById("musVol");
    if (mv && Math.abs(num(mv.value) - num(s.music)) > .01) { mv.value = s.music; try { mv.dispatchEvent(new Event("input", { bubbles: true })); } catch (e) { /* ignorat */ } }
  }
  // conexiune (STABILITY): ctx.conn / ctx.net / ctx.presence → „ok” | „slow” | „off”
  function connOf(s) {
    const c = ctx.conn || ctx.net || ctx.presence || helpers.conn; if (!c) return null;
    let v = null; try { v = typeof c === "function" ? c(s) : c[s]; } catch (e) { v = null; }
    if (v && typeof v === "object") v = pick(v, "q", "st", "state", "status");
    if (v === true) return "ok"; if (v === false) return "off"; v = String(v == null ? "" : v).toLowerCase();
    return /^(ok|on|good|green|conn|online|live)/.test(v) ? "ok" : /slow|lag|weak|yellow|late/.test(v) ? "slow" : /off|disc|lost|gone|red|away/.test(v) ? "off" : null;
  }
  const NET_T = { ok: "conectat", slow: "conexiune lentă", off: "deconectat" };
  function netDot(s, bot) { if (bot) return ""; const c = connOf(s); return c ? `<i class="cl-net ${c}" title="${NET_T[c]}" aria-label="${NET_T[c]}"></i>` : ""; }
  // delte față de ieri: LOGIC-2 (view.deltas / me.d) sau, în rezervă, instantaneul de la începutul zilei văzut aici
  function deltasA() {
    const r = V.raw || {}, m = (r.me && typeof r.me === "object" ? r.me : null) || (r.co && typeof r.co === "object" ? r.co : {}) || {};
    const d = pick(r, "deltas", "delta") || pick(m, "deltas", "delta", "dy");
    if (d && typeof d === "object") return { cash: pick(d, "cash", "c"), value: pick(d, "value", "v"), rank: pick(d, "rank", "r") };
    const day = num((clockInfo() || {}).day, 0), cur = { cash: V.me.cash, value: V.me.value, rank: V.me.rank };
    if (!A_.yd || A_.yd.seat !== me()) A_.yd = { seat: me(), day, base: null };
    if (A_.yd.day !== day) { A_.yd = { seat: me(), day, base: A_.yd.last || cur }; }
    A_.yd.last = cur;
    const b = A_.yd.base; if (!b) return null;
    return { cash: cur.cash - b.cash, value: cur.value - b.value, rank: b.rank != null && cur.rank != null ? num(b.rank) - num(cur.rank) : null }; // rank: + = ai urcat (ca LOGIC-2)
  }
  function drawTopA() {
    if (!V) return; ensureA();
    const spect = !me(), d = spect ? null : deltasA();
    [[E.cash, d && d.cash], [E.value, d && d.value]].forEach(([s, v]) => {
      const i = s && s.querySelector(".cl-dl"); if (!i) return;
      const t = v == null ? "" : (num(v) > 0 ? "▲ " : num(v) < 0 ? "▼ " : "") + fmtDelta(v) + " față de ieri";
      if (i.textContent !== t) i.textContent = t; i.className = "cl-dl" + (v == null ? "" : num(v) > 0 ? " up" : num(v) < 0 ? " dn" : "");
    });
    const rb = E.value && E.value.querySelector(".cl-rkb");
    if (rb) {
      const rk = V.me.rank, dr = d && d.rank != null ? num(d.rank) : 0; // rank: + = ai urcat, − = ai coborât
      const h = spect || rk == null ? "" : `#${rk}${dr ? ` <span class="${dr > 0 ? "up" : "dn"}">${dr > 0 ? "▲" : "▼"}${Math.abs(dr)}</span>` : ""}`;
      if (rb.__h !== h) { rb.__h = h; rb.innerHTML = h; rb.hidden = !h; rb.title = rk != null ? `Locul ${rk} după valoare${dr ? (dr > 0 ? ` · ai urcat ${dr}` : ` · ai coborât ${-dr}`) : ""}` : ""; }
    }
    undoA(); rxBubbles(); newsA();
    const R = V.raw && V.raw.report;
    if (R && typeof R === "object" && R.day != null && V.why !== "draft" && V.why !== "setup" && V.phase !== "end") {
      if (String(A_.repSeen) !== String(R.day)) { A_.repSeen = R.day; reportA(R.day); }
    }
  }
  /* ---- anulare (LOGIC-2: view.undo {left|until, txt, id}) ---- */
  function undoA() {
    const u = V.raw && (V.raw.undo || (V.raw.me && V.raw.me.undo));
    const box = E.toasts.querySelector('[data-tkey="undo"]');
    if (!u || !me() || (u.ok === false)) { if (box) dropToast(box); A_.undoKey = null; return; }
    const key = String(pick(u, "id", "until", "n", "at") != null ? pick(u, "id", "until", "n", "at") : JSON.stringify(u.what || u.k || "u"));
    if (A_.undoKey !== key) { A_.undoKey = key; const lm = num(pick(u, "leftMs", "ms"), NaN), l = num(u.left, NaN), un = num(u.until, NaN); A_.undoEnd = now() + (isFinite(lm) ? lm : isFinite(l) ? l * 1000 : isFinite(un) && un > 1e12 ? un - Date.now() : 8000); }
    const left = Math.ceil((A_.undoEnd - now()) / 1000);
    if (left <= 0) { if (box) dropToast(box); return; }
    const lbl = `↩ Anulează (${left} s)`;
    if (!box || box.dataset.ukey !== key) {
      const what = pick(u, "txt", "label", "what", "k"); const t = toast(typeof what === "string" && what.length > 3 ? what : "Acțiune făcută.", "", "↩", { key: "undo", ms: Math.max(1500, A_.undoEnd - now()), btns: [{ l: lbl, gold: true, f: () => { if (act("undo", u.id != null ? { id: u.id } : {})) { ASFX.play("pop"); toast("Anulat.", "good", "↩"); } } }] });
      if (t) t.dataset.ukey = key;
    } else { const b = box.querySelector(".tb button"); if (b && b.textContent !== lbl) b.textContent = lbl; }
  }
  /* ---- reacții (LOGIC-2: action react {e}; view.reacts [{s,e,t}]) ---- */
  const RX_DEF = ["👍", "👏", "😂", "😮", "😬", "🔥", "Bravo!", "Noroc!", "Hai, mă!", "Ups…"];
  const rxList = () => { const D = H.Data(), Lo = H.Logic(); const l = (Lo && Lo.REACTS) || (D && (D.REACTS || D.REACTIONS)); return Array.isArray(l) && l.length ? l.map(x => typeof x === "object" ? (x.e || x.t || x.n) : x).filter(Boolean) : RX_DEF; };
  function rxBubbles() {
    const list = arr(V.raw && (V.raw.reacts || V.raw.reactions)), kOf = x => pick(x, "id") != null ? "i" + x.id : `${pick(x, "s")}|${pick(x, "t", "at")}|${pick(x, "e")}`;
    if (!A_.rxSeen) A_.rxSeen = new Set();    list.forEach(x => {
      const k = kOf(x); if (A_.rxSeen.has(k)) return; A_.rxSeen.add(k);
      const tt = num(pick(x, "t", "at"), 0); if (tt > 1e12 && Date.now() - tt > 6000) return; // doar cele proaspete
      const s = pick(x, "s"), e = String(pick(x, "e") || ""); if (!e) return;
      const anchor = s === me() ? E.co : E.opps.querySelector(`[data-opp="${CSS.escape(String(s))}"]`);
      const r = anchor && anchor.offsetParent ? anchor.getBoundingClientRect() : E.top.getBoundingClientRect();
      const b = document.createElement("div"); b.className = "cl-bub"; b.textContent = e.slice(0, 24);
      b.style.left = clamp(r.left + Math.min(r.width, 120) / 2 + 20, 60, (W.innerWidth || 800) - 60) + "px"; b.style.top = (r.bottom + 6) + "px";
      el.appendChild(b); T.timeout(() => b.remove(), 3700); if (s !== me()) ASFX.play("pop");
    });
    if (A_.rxSeen.size > 200) A_.rxSeen = new Set(Array.from(A_.rxSeen).slice(-80));
  }
  function rxMenu(btn) {
    let m = el.querySelector(".cl-rx"); if (m) { m.remove(); return; }
    m = document.createElement("div"); m.className = "cl-rx"; m.setAttribute("role", "menu");
    const wait = now() - A_.rxAt < 3000;
    m.innerHTML = rxList().map(x => `<button data-ua="rxsend" data-e="${escH(x)}" role="menuitem" ${wait || !me() ? "disabled" : ""}>${escH(x)}</button>`).join("");
    const r = btn.getBoundingClientRect(), er = el.getBoundingClientRect();
    m.style.top = (r.bottom - er.top + 6) + "px"; m.style.left = clamp(r.left - er.left - 100, 8, er.width - 256) + "px";
    el.appendChild(m);
  }
  /* ---- ziarul de dimineață (LOGIC-2: view.news) ---- */
  function newsA() {
    if (!A_.news) return;
    const n = V.raw && pick(V.raw, "news", "headline", "paper");
    const txt = typeof n === "string" ? n : n && pick(n, "h", "t", "txt", "title");
    const key = txt ? (n && n.day != null ? n.day : "") + "|" + txt : null;
    if (!key || V.why === "draft" || V.why === "setup") { if (!key) morph(A_.news, ""); return; }
    if (key !== A_.newsKey) {
      A_.newsKey = key; A_.newsT = now(); if (lsGet("cerul.news", "") === key) { A_.newsT = 0; morph(A_.news, ""); return; }
      ASFX.play("dingdong");
    }
    const show = A_.newsT && now() - A_.newsT < 16000;
    morph(A_.news, show ? `<div class="cl-news" data-ua="newsx" role="status"><div><b>Gazeta Cerului${n && n.day != null ? " · ziua " + escH(n.day) : ""}</b>${escH(txt)}</div><button class="x" data-ua="newsx" aria-label="Închide">✕</button></div>` : "");
  }
  /* ---- raportul de sfârșit de zi (LOGIC-2: view.report) ---- */
  function trackDayA() { // rezervă: profitul pe rute văzut azi
    const day = num((clockInfo() || {}).day, 0);
    if (A_.rpDay !== day) { A_.rpPrev = A_.rp; A_.rp = {}; A_.rpDay = day; }
    V.routes.forEach(r => { A_.rp[r.id] = { v: r.profitToday, a: r.a, b: r.b }; });
  }
  function reportA(day) {
    if (!A_.rep || !me()) return;
    const R = V.raw && pick(V.raw, "report", "dayReport", "rep");
    let best = null, worst = null, dV = null, dC = null, dR = null, facts = [];
    const rt = x => { if (!x) return null; const rid = pick(x, "rid", "id"), r = V.routes.find(y => String(y.id) === String(rid)); const ends = x.a && x.b ? [x.a, x.b] : r ? [r.a, r.b] : String(rid || "").split("-"); return { n: ends[1] ? `${apName(ends[0])} – ${apName(ends[1])}` : String(pick(x, "n") || rid || ""), v: num(pick(x, "v", "net", "profit", "eur")) }; };
    if (R && typeof R === "object") {
      best = rt(R.best); worst = rt(R.worst); dV = pick(R, "dValue", "value"); dC = pick(R, "dCash", "cash"); dR = pick(R, "dRank", "rank");
      facts = arr(R.facts || R.changed).map(f => typeof f === "string" ? f : pick(f, "t", "txt")).filter(Boolean).slice(0, 3);
    } else {
      const p = A_.rpPrev || {}, ks = Object.keys(p); if (!ks.length) return;
      ks.sort((x, y) => p[y].v - p[x].v); const f = k => ({ n: `${apName(p[k].a)} – ${apName(p[k].b)}`, v: p[k].v });
      best = f(ks[0]); worst = ks.length > 1 ? f(ks[ks.length - 1]) : null;
      const d = deltasA() || {}; dV = d.value; dC = d.cash; dR = d.rank;
    }
    const cls = v => num(v) >= 0 ? "pos" : "neg", rkT = v => v == null || !num(v) ? "la fel" : num(v) > 0 ? `▲ ${num(v)}` : `▼ ${-num(v)}`;
    const rows = [best ? [`Cea mai bună: ${best.n}`, `<b class="${cls(best.v)}">${fmtSigned(best.v)}</b>`] : null, worst && (!best || worst.n !== best.n) ? [`Cea mai slabă: ${worst.n}`, `<b class="${cls(worst.v)}">${fmtSigned(worst.v)}</b>`] : null,
      dV != null ? ["Valoare", `<b class="${cls(dV)}">${fmtDelta(dV)}</b>`] : null, dC != null ? ["Bani", `<b class="${cls(dC)}">${fmtDelta(dC)}</b>`] : null, dR != null ? ["Loc în clasament", `<b>${rkT(dR)}</b>`] : null].filter(Boolean);
    if (!rows.length) return;
    A_.repDay = day;
    morph(A_.rep, `<div class="cl-rep" role="status" aria-label="Raportul zilei"><h5><span>📋 Ziua ${escH(day)} — raport</span><button data-ua="repx" aria-label="Închide raportul">✕</button></h5><div class="g">${rows.map(([a, b]) => `<span title="${escH(a)}">${escH(a)}</span>${b}`).join("")}</div>${facts.length ? `<ul>${facts.map(f => `<li>${escH(f)}</li>`).join("")}</ul>` : ""}</div>`);
    T.timeout(() => { if (A_.repDay === day) morph(A_.rep, ""); }, 22000);
  }
  /* ---- efecte noi la schimbări (apelat din diffEffects) ---- */
  function affectsMe(ev) {
    if (pick(ev, "mine", "me", "you") === true) return true;
    if (ev.s != null && ev.s === me()) return true;
    const aps = new Set([V.me.base].concat(V.me.hubs)); V.routes.forEach(r => { aps.add(r.a); aps.add(r.b); });
    const tg = pick(ev, "tg", "ap", "loc"); if (tg != null && aps.has(tg)) return true;
    const rid = pick(ev, "rid"); return rid != null && V.routes.some(r => String(r.id) === String(rid));
  }
  function diffA(a, b) {
    if (!a || !b || !me()) return;
    trackDayA();
    const pa = {}; a.planes.forEach(p => pa[p.id] = p);
    b.planes.forEach(p => { const o = pa[p.id]; if (o && !o.sub && p.sub) { ASFX.play("alert"); toast(`„${p.name}”: minimul pilotului e sub prag${p.beN != null ? ` (${fmtInt(p.beN)} pas.)` : ""}.`, "bad", "⚠️", { key: "sub" + p.id, btns: [{ l: "Setează minimul", f: () => openModal("pilotmin", { pid: p.id, hire: false, n: p.pmin != null ? num(p.pmin) : null }) }] }); } });
    if (b.me.cash < 0 && a.me.cash >= 0) toast(`Bani pe minus: ${fmtE(b.me.cash)}.`, "bad", "🔻", { key: "neg", btns: [{ l: "Bancă", f: () => topKey("bank") }] });
    const seen = new Set(a.events.map(e => evInfo(e).key));
    b.events.forEach(ev => { const e = evInfo(ev); if (seen.has(e.key) || !affectsMe(ev)) return; toast(`Te afectează: ${e.n}${e.where ? " · " + e.where : ""}.`, e.mood === "rau" ? "bad" : "good", e.icon); });
    const c = clockInfo(), d0 = num(a.raw && a.raw.day, NaN), d1 = num(b.raw && b.raw.day, NaN);
    if (!(b.raw && b.raw.report) && ((isFinite(d0) && isFinite(d1) && d1 > d0) || (c && A_.lastDay != null && num(c.day) > A_.lastDay))) reportA(isFinite(d0) && d1 > d0 ? d0 : A_.lastDay);
    if (c) A_.lastDay = num(c.day);
  }
  function rivalToast(l) {
    const rid = pick(l, "rid"), r = V.routes.find(x => String(x.id) === String(rid)); if (!r || l.who === me()) return false;
    const o = V.opps.find(x => x.seat === pick(l, "who", "s")) || {}, sb = pick(l, "shareBefore"), sa = pick(l, "shareAfter");
    ASFX.play("alert");
    toast(`${o.co || o.name || "Un rival"} a intrat pe ${apName(r.a)} – ${apName(r.b)}${sb != null && sa != null ? `: cota ta ${Math.round(num(sb) * 100)}% → ${Math.round(num(sa) * 100)}%` : ""}.`, "bad", "⚔️",
      { key: "rival" + rid, ms: 9000, onClick: () => selectRoute(r.id), btns: [{ l: "Schimbă prețul", f: () => selectRoute(r.id) }, { l: "+1 avion", gold: true, f: () => { if (canAct()) openModal("putplane", { rid: r.id }); } }] });
    return true;
  }
  /* ---- panouri: setări și scurtături ---- */
  function panelA(kind) {
    A_.panel = kind; if (!A_.pw) return;
    if (!kind) { A_.pw.innerHTML = ""; return; }
    const s = setGet(), seg = (k, opts) => `<div class="cl-seg" role="group">${opts.map(([v, n]) => `<button data-ua="set" data-sk="${k}" data-sv="${escH(JSON.stringify(v))}" class="${s[k] === v ? "on" : ""}" aria-pressed="${s[k] === v}">${n}</button>`).join("")}</div>`;
    const vol = (k, n) => `<label>${n}<input type="range" min="0" max="1" step="0.05" value="${num(s[k], .8)}" data-uavol="${k}"><output>${Math.round(num(s[k], .8) * 100)}%</output></label>`;
    const body = kind === "settings"
      ? `<h3><span>⚙️ Setări</span><button data-ua="pclose" aria-label="Închide">✕</button></h3>${vol("music", "Muzică")}${vol("sfx", "Efecte")}${vol("ann", "Anunțuri")}
        <div class="r"><span>Grafică</span>${seg("gfx", [["auto", "Auto"], ["low", "Simplă"], ["high", "Bogată"]])}</div>
        <div class="r"><span>Vreme și nori</span>${seg("wx", [[true, "Da"], [false, "Nu"]])}</div>
        <div class="r"><span>Mărimea textului</span>${seg("txt", [["s", "Mic"], ["m", "Normal"], ["l", "Mare"]])}</div>
        <small class="n">Se salvează doar pe acest dispozitiv.</small>${U.mode !== "phone" ? `<button class="cl-btn ghost sm" data-ua="keys" style="margin-top:10px">⌨ Scurtături de taste</button>` : ""}`
      : `<h3><span>⌨ Scurtături</span><button data-ua="pclose" aria-label="Închide">✕</button></h3><div class="cl-keys">
        <kbd>Space</kbd><span>Pauză / continuă (dacă ai voie)</span><kbd>F</kbd><span>Flotă</span><kbd>R</kbd><span>Rute</span><kbd>B</kbd><span>Bancă</span><kbd>G</kbd><span>Ghid</span>
        <kbd>M</kbd><span>Doar harta</span><kbd>1–6</kbd><span>Filele din dreapta</span><kbd>Esc</kbd><span>Închide fereastra de sus</span><kbd>?</kbd><span>Lista asta</span></div>`;
    A_.pw.innerHTML = `<div class="cl-pnl-w" data-ua="pbg"><div class="cl-pnl" role="dialog" aria-modal="true" aria-label="${kind === "settings" ? "Setări" : "Scurtături"}">${body}</div></div>`;
    const f = A_.pw.querySelector(".cl-pnl button, .cl-pnl input"); f && f.focus && f.focus();
  }
  function uaClick(n, e) {
    const k = n.dataset.ua;
    if (k === "pbg") { if (e.target === n) { panelA(null); sfx.tick(); } return; }
    if (k !== "rxsend") { const m = el.querySelector(".cl-rx"); if (m && k !== "rx") m.remove(); }
    if (U.menu) { U.menu = false; drawMenu(); }
    if (k === "settings") { sfx.tick(); panelA(A_.panel === "settings" ? null : "settings"); return; }
    if (k === "keys") { sfx.tick(); panelA("keys"); return; }
    if (k === "pclose") { sfx.tick(); panelA(null); return; }
    if (k === "set") { let v = n.dataset.sv; try { v = JSON.parse(v); } catch (er) { /* text */ } setPut(n.dataset.sk, v); applySettings(); sfx.tick(); panelA("settings"); return; }
    if (k === "rx") { rxMenu(n.closest(".cl-menu") ? E.top.querySelector("[data-k=menu]") || n : n); return; }
    if (k === "rxsend") {
      const m = el.querySelector(".cl-rx"); if (m) m.remove();
      if (now() - A_.rxAt < 3000) { toast("Așteaptă puțin între reacții.", "", "⏳"); return; }
      A_.rxAt = now(); if (!act("react", { e: n.dataset.e })) return; ASFX.play("pop"); return;
    }
    if (k === "newsx") { lsSet("cerul.news", A_.newsKey); A_.newsT = 0; morph(A_.news, ""); return; }
    if (k === "repx") { A_.repDay = null; morph(A_.rep, ""); return; }
  }
  // ecranul de încărcare (o dată pe pagină): bară + idei, cât se pornește harta
  if (!W.__clBooted && !helpers.auto && !W.__CERUL_AUTO) {
    W.__clBooted = 1;
    const box = document.createElement("div"); box.innerHTML = bootHTML("Pregătim harta și companiile…", 55); const L = box.firstElementChild; el.appendChild(L);
    let ti = 0; const bar = L.querySelector(".cl-load-bar i"), tip = L.querySelector(".cl-load-tip");
    const iv = T.interval(() => { if (!L.isConnected) return; ti++; tip.textContent = LOAD_TIPS[(Math.floor(Date.now() / 2400) + ti) % LOAD_TIPS.length]; }, 1400);
    T.timeout(() => { bar.style.width = "85%"; }, 60);
    T.timeout(() => { bar.style.width = "100%"; T.timeout(() => { L.classList.add("out"); T.timeout(() => { L.remove(); try { clearInterval(iv); } catch (e) { /* ignorat */ } }, 500); }, 380); }, 650);
  }
  T.on(el, "focusout", e => { const t = e.target; if (t && t.matches && t.matches("[data-pinput]") && U.draft && U.draft.p) t.value = fmtInt(U.draft.p); });
  function keyA(e) { // scurtături PC: Space, F, R, B, G, ?
    const k = e.key, lk = String(k || "").toLowerCase();
    if (k === "?" || (lk === "k" && e.shiftKey)) { panelA(A_.panel === "keys" ? null : "keys"); return true; }
    if (A_.panel) return false;
    if (k === " " || k === "Spacebar") {
      if (e.repeat) { e.preventDefault(); return true; }
      if (!me() || !V) return false; e.preventDefault();
      if (V.canPause || V.why === "pause") topKey("pause"); else { sfx.error(); toast("Pauza nu e permisă acum.", "", "⏸"); }
      return true;
    }
    const tab = { f: "fleet", r: "routes" }[lk];
    if (tab) { if (U.mode === "phone") U.ptab = tab; else { U.tab = tab; lsSet("cerul.tab", tab); } sfx.tick(); notify("tab:" + tab); drawAll(); return true; }
    if (lk === "b") { topKey("bank"); return true; }
    if (lk === "g") { topKey("guide"); return true; }
    return false;
  }
  /* ---------- aranjare (PC / mediu / telefon) ---------- */
  function layout() {
    const w = W.innerWidth || 1200, h = W.innerHeight || 800;
    const mode = w < 760 ? "phone" : w < 1600 ? "mid" : "wide";
    if (mode !== U.mode) {
      U.mode = mode;
      el.classList.toggle("phone", mode === "phone"); el.classList.toggle("mid", mode === "mid");
      if (mode === "phone" && U.tab) U.ptab = ["fleet", "routes", "shop"].includes(U.tab) ? U.tab : "fleet";
      T.timeout(() => { try { mapApi && mapApi.resize && mapApi.resize(); } catch (e) { /* ignorat */ } }, 50);
    }
    el.classList.toggle("narrow", mode === "mid" && w < 1250);
    el.classList.toggle("sheetbig", !!U.sheetBig);
    el.classList.toggle("maponly", !!U.maponly);
    const side = mode === "mid" ? clamp(U.side, 300, Math.min(560, w * .42)) : clamp(U.side, 300, Math.min(760, w * .45));
    el.style.setProperty("--side", Math.round(mode === "mid" && U.side === 400 ? Math.min(360, side) : side) + "px");
    const bot = mode === "mid" && U.bot === 150 ? (h < 800 ? 138 : 146) : clamp(U.bot, 120, Math.min(340, h * .4));
    el.style.setProperty("--bot", Math.round(bot) + "px");
  }
  function toggleMapOnly(v) {
    U.maponly = v == null ? !U.maponly : !!v; sfx.tick(); layout();
    T.timeout(() => { try { mapApi && mapApi.resize && mapApi.resize(); } catch (e) { /* ignorat */ } }, 30);
    drawAll();
  }
  /* splitere */
  function dragSplit(handle, horizontal) {
    T.on(handle, "pointerdown", e => {
      if (U.mode === "phone") return;
      e.preventDefault(); handle.classList.add("drag"); try { handle.setPointerCapture(e.pointerId); } catch (er) { /* ignorat */ }
      const mv = ev => {
        if (horizontal) { const r = el.getBoundingClientRect(); U.side = clamp(r.right - ev.clientX - 4, 280, r.width * .6); }
        else { const r = el.getBoundingClientRect(); U.bot = clamp(r.bottom - ev.clientY - 4, 100, r.height * .5); }
        layout(); try { mapApi && mapApi.resize && mapApi.resize(); } catch (er) { /* ignorat */ }
      };
      const up = () => { handle.classList.remove("drag"); handle.removeEventListener("pointermove", mv); handle.removeEventListener("pointerup", up); handle.removeEventListener("pointercancel", up); lsSet(horizontal ? "cerul.side" : "cerul.bot", Math.round(horizontal ? U.side : U.bot)); };
      handle.addEventListener("pointermove", mv); handle.addEventListener("pointerup", up); handle.addEventListener("pointercancel", up);
    });
    T.on(handle, "keydown", e => {
      const d = (e.key === "ArrowLeft" || e.key === "ArrowUp") ? 1 : (e.key === "ArrowRight" || e.key === "ArrowDown") ? -1 : 0; if (!d) return;
      e.preventDefault(); if (horizontal) U.side = clamp(U.side + d * 30, 280, 900); else U.bot = clamp(U.bot + d * 20, 100, 400);
      lsSet(horizontal ? "cerul.side" : "cerul.bot", U.side); layout(); try { mapApi && mapApi.resize && mapApi.resize(); } catch (er) { /* ignorat */ }
    });
    T.on(handle, "dblclick", () => { if (horizontal) U.side = 400; else U.bot = 150; lsSet(horizontal ? "cerul.side" : "cerul.bot", horizontal ? 400 : 150); layout(); try { mapApi && mapApi.resize && mapApi.resize(); } catch (er) { /* ignorat */ } });
  }
  dragSplit(E.split, true); dragSplit(E.hsplit, false);

  /* ---------- masa (locurile din salon) ---------- */
  function hideBack() { const fb = document.querySelector(".cl-backfloat"); if (fb) fb.remove(); }
  function showTable(msg) {
    el.style.display = "none"; document.documentElement.classList.remove("cl-on"); hideBack();
    const fb = document.createElement("div"); fb.className = "cl-backfloat";
    fb.style.cssText = "position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:40;display:flex;flex-direction:column;align-items:center;gap:8px;max-width:min(92vw,560px)";
    fb.innerHTML = (msg ? `<div style="background:#101a2ef2;border:1px solid #ffd35c;border-radius:12px;padding:10px 14px;color:#fff;font-size:14px;text-align:center;box-shadow:0 8px 28px #000a">${msg}</div>` : "") + `<button class="g-btn primary big" type="button">✈️ Înapoi la joc</button>`;
    fb.querySelector("button").onclick = () => { hideBack(); if (alive) { el.style.display = ""; document.documentElement.classList.add("cl-on"); T.timeout(() => { try { mapApi && mapApi.resize && mapApi.resize(); } catch (e) { /* ignorat */ } }, 30); } };
    document.body.appendChild(fb); W.scrollTo(0, 0);
  }

  /* ---------- clicuri ---------- */
  function onClick(e) {
    const t = e.target;
    if (U.menu && !t.closest(".cl-menu") && !t.closest("[data-k=menu]")) { U.menu = false; drawMenu(); }
    const q = s => t.closest(s);
    let n;
    if ((n = q("[data-ua]"))) { uaClick(n, e); return; }
    if ((n = q("[data-pv]"))) { e.stopPropagation(); const pv = permitAt(n); if (U.pvStick && U.preview && pv && U.preview.a === pv.a && U.preview.b === pv.b) { U.pvStick = false; U.pvTouch = false; previewOff(); } else { U.pvStick = true; U.pvTouch = true; previewOn(pv); } sfx.tick(); return; }
    if (U.pvStick) { U.pvStick = false; U.pvTouch = false; previewOff(); }
    if ((n = q("[data-k]"))) { topKey(n.dataset.k); return; }
    if ((n = q("[data-tab]"))) { U.tab = n.dataset.tab; lsSet("cerul.tab", U.tab); sfx.tick(); notify("tab:" + U.tab); drawAll(); return; }
    if ((n = q("[data-ptab]"))) { const k = n.dataset.ptab; if (U.popKind) { U.popKind = null; U.selRoute = null; U.selAp = null; U.oppRoute = null; U.ptab = k; drawMap(); } else if (U.ptab === k) U.sheetBig = !U.sheetBig; else { U.ptab = k; } sfx.tick(); notify("tab:" + k); layout(); drawAll(); T.timeout(() => { try { mapApi && mapApi.resize && mapApi.resize(); } catch (er) { /* ignorat */ } }, 40); return; }
    if (q("[data-legend]")) { U.legend = !U.legend; lsSet("cerul.legend", U.legend); sfx.tick(); drawPane(); return; }
    if ((n = q("[data-seg]"))) { U.shopSeg = n.dataset.seg; sfx.tick(); drawPane(); return; }
    if ((n = q("[data-mtab]"))) { U.mtab = n.dataset.mtab; sfx.tick(); drawPane(); return; }
    // modale
    if (U.modal && onModalClick(t, e)) return;
    // popup
    if (q("[data-popclose]")) { closePop(); sfx.tick(); return; }
    // UI-B: panoul aeroportului / fișa avionului
    if ((n = q("[data-apmore]"))) { e.preventDefault(); const d = n.closest("details"); U.apMoreFor = n.dataset.apmore; U.apMore = !(d && d.open); sfx.tick(); drawPopup(); return; }
    if ((n = q("[data-appl]"))) { openPlaneCard(parseId(n.dataset.appl)); return; }
    if ((n = q("[data-pcfleet]"))) { const id = parseId(n.dataset.pcfleet); closePop(); U.selPlane = id; U.ffil = ""; if (U.mode === "phone") U.ptab = "fleet"; else { U.tab = "fleet"; if (U.maponly) toggleMapOnly(false); } drawAll(); T.timeout(() => { const c = E.pane.querySelector(`[data-plane="${CSS.escape(String(id))}"]`); c && c.scrollIntoView({ block: "nearest", behavior: reduced ? "auto" : "smooth" }); }, 30); return; }
    // UI-B: flotă — filtre, selecție multiplă, acțiuni în bloc
    if ((n = q("[data-ffil]"))) { U.ffil = U.ffil === n.dataset.ffil ? "" : n.dataset.ffil; lsSet("cerul.ffil", U.ffil); sfx.tick(); drawPane(); return; }
    if ((n = q("[data-fsel]"))) { e.stopPropagation(); const id = parseId(n.dataset.fsel); if (U.fsel.has(id)) U.fsel.delete(id); else U.fsel.add(id); sfx.tick(); drawPane(); return; }
    if ((n = q("[data-fall]"))) { const ids = fleetFiltered().map(p => p.id), all = ids.every(id => U.fsel.has(id)); ids.forEach(id => all ? U.fsel.delete(id) : U.fsel.add(id)); sfx.tick(); drawPane(); return; }
    if (q("[data-fnone]")) { U.fsel.clear(); sfx.tick(); drawPane(); return; }
    if ((n = q("[data-bulk]"))) { bulkAction(n.dataset.bulk); return; }
    if ((n = q("[data-dir]"))) { U.dir = n.dataset.dir; U.draft = {}; sfx.tick(); drawPopup(); return; }
    if ((n = q("[data-preset]"))) { const p = +n.dataset.preset; U.draft.p = p; applyPrice(p); return; }
    if (q("[data-papply]")) { applyPrice(Math.round(num(U.draft.p))); return; }
    if ((n = q(".cl-ev[data-evi]"))) { const ev = arr(V.events)[+n.dataset.evi]; if (ev) openModal("ev", { k: ev.k, id: ev.id }); return; }
    if ((n = q("[data-putplane]"))) { openModal("putplane", { rid: parseId(n.dataset.putplane) }); return; }
    if ((n = q("[data-hub]"))) { const ap = n.dataset.hub, it = hubItem(ap), A = apObj(ap), pr = it ? num(it.price) : num(arr((V.raw.shop || {}).hubPrice)[A.size]); confirmBox("Cumpără hub", `Hub la <b>${escH(apName(ap))}</b> pentru <b>${fmtE(pr)}</b>.<br>Taxe de aterizare mai mici aici, mai mulți pasageri în tranzit prin acest oraș și un slot în plus.`, () => { if (act("hub", { ap })) { sfx.coin(); toast(`Hub nou: ${apName(ap)}.`, "good", "🔁"); } }, "Cumpără · " + fmtE(pr)); return; }
    if ((n = q("[data-buyout]"))) { const id = parseId(n.dataset.buyout), p = V.planes.find(x => x.id === id); if (!p) return; confirmBox("Răscumpără avionul", `<b>${escH(p.tinfo.n + " „" + p.name + "”")}</b> devine al tău pentru <b>${fmtE(p.buyoutPrice)}</b>. Nu mai plătești chirie și intră în valoarea companiei.`, () => { if (act("buyout", { pid: id })) { sfx.coin(); toast(`„${p.name}” e acum al tău.`, "good", "🔑"); } }, "Răscumpără"); return; }
    if ((n = q("[data-slotbuy]"))) { const ap = n.dataset.slotbuy, pr = n.dataset.pr; confirmBox("Cumpără slot", `Slot la <b>${escH(apName(ap))}</b>${pr ? ` pentru <b>${fmtE(+pr)}</b>` : ""}. Îți dă dreptul să operezi aici (rute, hub, terminal).`, () => { if (act("slot", { ap })) sfx.coin(); }, "Cumpără"); return; }
    // consultant
    if (q("[data-cons-hide]")) { U.consHide = true; sfx.tick(); drawConsultant(); return; }
    if (q("[data-cons-show]")) { U.consHide = false; U.consT = now(); sfx.tick(); drawConsultant(); return; }
    if ((n = q("[data-cons]"))) { if (act("consultant", { on: n.dataset.cons === "1" })) sfx[n.dataset.cons === "1" ? "chime" : "tick"](); return; }
    // flotă
    if ((n = q("[data-go]"))) { const id = parseId(n.dataset.go); if (act("depart", { pid: id })) { sfx.whoosh(); notify("departed"); const p = V.planes.find(x => x.id === id); if (p) toast(line("depart", { t: p.name, x: apName(p.at), y: apName(p.to), p: V.me.name }) || `„${p.name}” decolează cu ${p.pax} pasageri.`, "", "🛫"); } return; }
    if ((n = q("[data-pminopen]"))) { const id = parseId(n.dataset.pminopen), p = V.planes.find(x => x.id === id); if (p) openModal("pilotmin", { pid: id, hire: false, n: p.pmin != null ? num(p.pmin) : p.pminDef != null ? num(p.pminDef) : null }); return; }
    if ((n = q("[data-pilot]")) && pminAPI()) { const id = parseId(n.dataset.pilot), p = V.planes.find(x => x.id === id); if (p && !p.pilot) { openModal("pilotmin", { pid: id, hire: true, n: null }); return; } }
    if ((n = q("[data-pilot]"))) { const id = parseId(n.dataset.pilot), p = V.planes.find(x => x.id === id); if (p && act("pilot", { pid: id, on: !p.pilot })) { sfx.select(); if (!p.pilot) notify("pilotOn"); if (U.modal) closeModal(); } return; }
    if ((n = q("[data-assign]"))) { const p0 = V.planes.find(x => x.id === parseId(n.dataset.assign)) || {}; openModal("assign", { pid: parseId(n.dataset.assign), sel: p0.chain ? arr(p0.chain.r)[0] : p0.rid, via: p0.chain ? arr(p0.chain.r)[1] : null, focus: n.dataset.afocus || null }); if (n.dataset.afocus === "chain") T.timeout(() => { const c = E.modw.querySelector(".cl-chainh"); c && c.scrollIntoView({ block: "start", behavior: reduced ? "auto" : "smooth" }); }, 40); return; }
    if ((n = q("[data-pmenu]"))) { openModal("pmenu", { pid: parseId(n.dataset.pmenu) }); return; }
    if ((n = q("[data-plane]"))) { const id = parseId(n.dataset.plane); U.selPlane = U.selPlane === id ? null : id; sfx.select(); const p = V.planes.find(x => x.id === id); if (p && p.rid != null && U.selPlane != null) { U.popKind = "route"; U.selRoute = p.rid; U.popAt = null; U.dir = "ab"; U.draft = {}; } drawAll(); return; }
    if ((n = q("[data-route]"))) { selectRoute(parseId(n.dataset.route)); return; }
    // magazin
    if ((n = q("[data-buy]"))) { const t2 = ptInfo(n.dataset.buy); confirmBox("Cumpără avion", `Cumperi un <b>${escH(t2.n)}</b> nou cu <b>${fmtE(t2.price)}</b>? Apare în hangar la baza ta; apoi atribuie-i o rută.`, () => { if (act("buyPlane", { type: ptIdx(n.dataset.buy) })) sfx.coin(); }, "Cumpără · " + fmtE(t2.price)); return; }
    if ((n = q("[data-lease]"))) { const t2 = ptInfo(n.dataset.lease), fee = (V.shop.new.find(x => ptIdx(x.type) === t2.ty) || {}).lease; const lf = fee != null ? fee : t2.lease; confirmBox("Leasing", `Iei un <b>${escH(t2.n)}</b> în leasing: plătești <b>0 € acum</b> și <b>${fmtE(lf)} pe zi</b> cât timp îl ții${(() => { const lr = V.raw && V.raw.leaseRamp; return lr && num(lr.today, 1) < 1 ? ` (azi doar ${fmtE(Math.round(num(lf) * num(lr.today)))}, ${Math.round(num(lr.today) * 100)}%; chiria întreagă din ziua ${num(lr.fullFrom)})` : ""; })()}. Îl poți returna oricând (costă câteva zile de chirie).`, () => { if (act("buyPlane", { type: ptIdx(n.dataset.lease), lease: true })) sfx.coin(); }, "Ia în leasing"); return; }
    if ((n = q("[data-buyused]"))) { if (act("buyPlane", { type: ptIdx(n.dataset.type), used: parseId(n.dataset.buyused) })) sfx.coin(); return; }
    if ((n = q("[data-sell]"))) { const id = parseId(n.dataset.sell), p = V.planes.find(x => x.id === id); confirmBox(p && p.lease ? "Returnează avionul" : "Vinde avionul", `Sigur ${p && p.lease ? "returnezi" : "vinzi"} <b>${escH(p ? p.tinfo.sh + " „" + p.name + "”" : "avionul")}</b>${p && p.value != null && !p.lease ? ` pentru <b>${fmtE(p.value)}</b>` : ""}?`, () => { if (act("sellPlane", { pid: id })) sfx.coin(); }, p && p.lease ? "Returnează" : "Vinde", true); return; }
    if ((n = q("[data-hubap]"))) { U.hubAp = n.dataset.hubap; sfx.select(); drawPane(); return; }
    if ((n = q("[data-invap]"))) { U.invAp = n.dataset.invap; sfx.select(); drawPane(); return; }
    if ((n = q("[data-inv]"))) { invest(n.dataset.inv, n.dataset.ap, n.dataset.ty); return; }
    if ((n = q("[data-shbuy]"))) { openModal("shares", { seat: n.dataset.shbuy, buy: true, n: 1 }); return; }
    if ((n = q("[data-shsell]"))) { openModal("shares", { seat: n.dataset.shsell, buy: false, n: 1 }); return; }
    // cărți / permise / speciale
    if (q("[data-buycard]")) { if (act("buyCard")) sfx.deal(); return; }
    if (q("[data-draw]")) { if (act("drawPermits")) { sfx.deal(); } return; }
    if (q("[data-offer]")) { openModal("offer"); return; }
    if ((n = q("[data-discard]"))) { const id = parseId(n.dataset.discard), p = V.permits.find(x => x.id === id); confirmBox("Renunți la permis?", `Permisul <b>${escH(p ? apName(p.a) + " → " + apName(p.b) : "")}</b> se pierde${V.discardPenalty ? ` și plătești <b>${fmtE(V.discardPenalty)}</b>` : " (penalizare mică)"}. Eliberezi un loc pentru un permis nou.`, () => { if (act("discardPermit", { id })) sfx.wrong(); }, "Renunță la permis", true); return; }
    if ((n = q("[data-build]"))) { const id = parseId(n.dataset.build), p = V.permits.find(x => x.id === id); if (!p) return; if (act("build", { permitId: id })) { sfx.horn(); notify("built"); } return; }
    if ((n = q("[data-permit]"))) { const p = V.permits.find(x => x.id === parseId(n.dataset.permit)); if (p) { try { const A = apObj(p.a), B = apObj(p.b); mapApi && mapApi.focus && A.lat != null && mapApi.focus((A.lat + B.lat) / 2, (A.lon + B.lon) / 2); } catch (er) { /* ignorat */ } sfx.tick(); } return; }
    if ((n = q("[data-play]"))) { playSpecial(n.dataset.play); return; }
    if ((n = q("[data-opp]"))) { sfx.tick(); return; }
    // rezerve scene
    if (q("[data-fbready]")) { act("ready"); return; }
    if ((n = q("[data-fbpick]"))) { act("pick", { i: +n.dataset.fbpick }); return; }
  }
  function invest(k, ap, ty) {
    const I = (V.raw && V.raw.invest) || {};
    const D = {
      base: () => ({ t: "Extinde baza", d: `Extinzi baza din <b>${escH(apName(V.me.base))}</b> la nivelul ${num((I.base || {}).lvl) + 1}`, pr: (I.base || {}).price, a: {} }),
      term: () => ({ t: "Terminal propriu", d: `Construiești un terminal propriu la <b>${escH(apName(ap))}</b>`, pr: (I.term || {}).price, a: { ap } }),
      eco: () => ({ t: "Flotă eco", d: `Modernizezi toate avioanele <b>${escH(ptInfo(+ty).n)}</b>`, pr: (arr(I.eco)[+ty] || {}).price, a: { ty: +ty } }),
      mnt: () => ({ t: "Centru de mentenanță", d: "Construiești un centru de mentenanță", pr: (I.mnt || {}).price, a: {} }),
    }[k];
    if (!D) return;
    const o = D();
    confirmBox(o.t, `${o.d} pentru <b>${fmtE(o.pr)}</b>.<br><span style="color:var(--mut)">Investițiile valorează cât ai plătit, apoi pierd treptat ${Math.round(num(I.decay, .02) * 100)}% pe zi, până la minim ${Math.round(num(I.valueMult, .5) * 100)}%.</span>`, () => { if (act("invest", Object.assign({ k }, o.a))) { sfx.powerup(); notify("invest"); } }, "Investește");
  }
  function parseId(s) { if (s == null) return s; return /^-?\d+$/.test(s) ? +s : s; }
  function confirmBox(title, text, yes, yesLbl, danger) { openModal("confirm", { title, text, yes: yesLbl, danger, fn: yes }); }
  function applyPrice(p) {
    const r = V.routes.find(x => x.id === U.selRoute); if (!r || !p) return;
    p = clamp(Math.round(p), 1, Math.round(recOf(r).normal * 10));
    if (act("price", { rid: r.id, dir: U.dir, p })) { sfx.coin(); notify("priceSet"); toast(`Preț nou ${apName(U.dir === "ba" ? r.b : r.a)} ${U.dir === "both" ? "⇄" : "→"} ${apName(U.dir === "ba" ? r.a : r.b)}: ${fmtE(p)}.`, "", "🏷️"); }
    U.draft = { rid: r.id, dir: U.dir, p }; drawPopup();
  }
  function playSpecial(k) {
    const inf = specInfo(k);
    if (inf.tgt === "none") { confirmBox(`${inf.i} ${inf.n}`, escH(inf.d || "Folosești cartea acum?"), () => { if (act("play", { card: k })) sfx.powerup(); }, "Folosește"); return; }
    if (inf.tgt === "auto") return;
    openModal("target", { card: k });
  }
  function onModalClick(t) {
    const M = U.modal, q = s => t.closest(s); let n;
    if (q("[data-mclose]") || (t.matches && t.matches("[data-mbg]"))) { closeModal(); sfx.tick(); return true; }
    if (M.kind === "confirm" && q("[data-mconfirm]")) { const f = M.data.fn; closeModal(); try { f && f(); } catch (e) { /* ignorat */ } return true; }
    if (M.kind === "assign") {
      if ((n = q("[data-msel]"))) { M.data.sel = parseId(n.dataset.msel); M.data.via = null; sfx.select(); drawModal(); return true; }
      if ((n = q("[data-mchain]"))) { M.data.sel = parseId(n.dataset.mchain); M.data.via = parseId(n.dataset.via); sfx.select(); drawModal(); return true; }
      if (q("[data-massign]")) { if (act("assign", M.data.via != null ? { pid: M.data.pid, rid: M.data.sel, via: M.data.via } : { pid: M.data.pid, rid: M.data.sel })) { sfx.place(); notify("assigned"); } closeModal(); return true; }
      if ((n = q("[data-unassign]"))) { if (act("unassign", { pid: parseId(n.dataset.unassign) })) sfx.tock(); closeModal(); return true; }
    }
    if (M.kind === "offer") {
      if ((n = q("[data-osel]"))) { const id = parseId(n.dataset.osel), s = M.data.sel; if (s.has(id)) s.delete(id); else s.add(id); sfx.select(); drawModal(); return true; }
      if (q("[data-okeep]")) { if (act("keepPermits", { ids: [...M.data.sel] })) { sfx.write(); notify("permitKept"); } closeModal(); return true; }
    }
    if (M.kind === "ghiseu") {
      if ((n = q("[data-give]"))) { const k = n.dataset.give, g = M.data.give, tot = Object.values(g).reduce((a, b) => a + b, 0); if (num(g[k]) < num(V.hand[k]) && tot < 5) g[k] = num(g[k]) + 1; else g[k] = 0; sfx.tick(); drawModal(); return true; }
      if (q("[data-give0]")) { M.data.give = {}; drawModal(); return true; }
      if ((n = q("[data-get]"))) { M.data.get = n.dataset.get; sfx.select(); drawModal(); return true; }
      if (q("[data-gok]")) {
        const give = RIDX.map(k => num(M.data.give[k]));
        if (act("ghiseu", { give, get: RIDX.indexOf(M.data.get) })) { sfx.deal(); toast("Schimb făcut la ghișeu.", "good", "🃏"); } closeModal(); return true;
      }
      if (q("[data-buycard]")) { if (act("buyCard")) sfx.deal(); T.timeout(drawModal, 300); return true; }
    }
    if (M.kind === "target") {
      if ((n = q("[data-tsel]"))) { M.data.sel = parseId(n.dataset.tsel); M.data.rid = null; M.data.b = null; sfx.select(); drawModal(); return true; }
      if ((n = q("[data-tb]"))) { M.data.b = n.dataset.tb; sfx.select(); drawModal(); return true; }
      if ((n = q("[data-trid]"))) { M.data.rid = parseId(n.dataset.trid); sfx.select(); drawModal(); return true; }
      if (q("[data-tok]")) {
        const inf = specInfo(M.data.card), a = { card: M.data.card };
        if (inf.tgt === "opp") a.target = M.data.sel; if (inf.tgt === "route") a.rid = M.data.sel; if (inf.tgt === "airport") a.ap = M.data.sel; if (M.data.rid != null) a.rid = M.data.rid;
        if (inf.tgt === "permit") a.permitId = M.data.sel; if (inf.tgt === "pair") { a.x = M.data.sel; a.y = M.data.b; }
        if (act("play", a)) { sfx[inf.sk === "freeze" ? "laser" : "powerup"](); } closeModal(); return true;
      }
    }
    if (M.kind === "shares") { if (q("[data-shok]")) { const n2 = num(M.data.n, 1); if (act("shares", M.data.buy ? { co: M.data.seat, n: n2, buy: true } : { co: M.data.seat, n: n2, sell: true })) sfx.coin(); closeModal(); return true; } }
    if (M.kind === "bankfb") {
      if ((n = q("[data-bdays]"))) { M.data.days = +n.dataset.bdays; drawModal(); return true; }
      if (q("[data-bok]")) { if (act("bank", { amount: num(M.data.amt, 0), days: M.data.days || 20 })) { sfx.coin(); notify("bank"); } closeModal(); return true; }
      if ((n = q("[data-repay]"))) { if (act("repay", { id: parseId(n.dataset.repay), amount: num(n.dataset.amt) })) sfx.coin(); return true; }
    }
    if (M.kind === "negofb") {
      if ((n = q("[data-nsel]"))) { M.data.sel = n.dataset.nsel; sfx.select(); drawModal(); return true; }
      if ((n = q("[data-nok]"))) { if (act("negoOpen", { with: M.data.sel, loan: n.dataset.nok === "loan" })) { sfx.ping(); notify("nego"); } closeModal(); return true; }
    }
    if (M.kind === "putplane") {
      if ((n = q("[data-psel]"))) { M.data.sel = parseId(n.dataset.psel); M.data.via = null; M.data.crid = null; sfx.select(); drawModal(); return true; }
      if ((n = q("[data-mchain]"))) { if (n.dataset.cpid != null) M.data.sel = parseId(n.dataset.cpid); M.data.crid = parseId(n.dataset.mchain); M.data.via = parseId(n.dataset.via); sfx.select(); drawModal(); return true; }
      if (q("[data-allch]")) { U.allChains = !U.allChains; drawModal(); return true; }
      if (q("[data-showbusy]")) { U.showBusy = !U.showBusy; drawModal(); return true; }
      if (q("[data-passign]")) { if (act("assign", M.data.via != null ? { pid: M.data.sel, rid: M.data.crid, via: M.data.via } : { pid: M.data.sel, rid: M.data.rid })) { sfx.place(); notify("assigned"); } closeModal(); return true; }
      if (q("[data-mclose2]")) { closeModal(); U.tab = "shop"; U.ptab = "shop"; if (U.maponly) toggleMapOnly(false); drawAll(); return true; }
      if ((n = q("[data-mbuyty]"))) { const k = ptInfo(n.dataset.mbuyty).k; closeModal(); U.tab = "shop"; U.ptab = "shop"; U.shopSeg = "new"; if (U.maponly) toggleMapOnly(false); drawAll();
        setTimeout(() => { const el = E.pane && E.pane.querySelector(`[data-key="n${CSS.escape(String(k))}"]`); if (!el) return; try { el.scrollIntoView({ block: "center", behavior: "smooth" }); } catch (e) { el.scrollIntoView(); } el.style.outline = "2px solid var(--gold)"; el.style.outlineOffset = "2px"; setTimeout(() => { el.style.outline = ""; }, 2600); }, 60); return true; }
    }
    if (M.kind === "pilotmin" && q("[data-pminok]")) { const pid = M.data.pid, n2 = Math.round(num(M.data.n, 1)), p = V.planes.find(x => x.id === pid); let ok = true; if (M.data.hire && p && !p.pilot) { ok = !!act("pilot", { pid, on: true }); if (ok) notify("pilotOn"); } if (ok && act("pilotMin", { pid, n: n2 })) sfx.select(); closeModal(); return true; }
    if (M.kind === "bulkmin" && q("[data-bminok]")) { const pct = clamp(num(M.data.pct, 60), 5, 100), L = selPlanes().filter(p => p.pilot); const k = sendMany(L.map(p => ({ [ACT]: "pilotMin", pid: p.id, n: clamp(Math.ceil(Math.max(1, p.seats) * pct / 100), 1, Math.max(1, p.seats)) }))); if (k) { sfx.select(); toast(`Minim ${pct}% din locuri pe ${k} ${k === 1 ? "avion" : "avioane"}.`, "", "🎚️"); } closeModal(); return true; }
    if (M.kind === "bulkroute") {
      if ((n = q("[data-bsel]"))) { M.data.sel = parseId(n.dataset.bsel); sfx.select(); drawModal(); return true; }
      if (q("[data-brok]")) { const r = V.routes.find(x => String(x.id) === String(M.data.sel)); if (r) { const L = selPlanes().filter(p => r.dist <= p.tinfo.range && !(p.rid === r.id && !p.chain)); const k = sendMany(L.map(p => ({ [ACT]: "assign", pid: p.id, rid: r.id }))); if (k) { sfx.place(); notify("assigned"); toast(`${k} ${k === 1 ? "avion mutat" : "avioane mutate"} pe ${apName(r.a)}–${apName(r.b)}.`, "", "🛣️"); } } closeModal(); return true; }
    }
    if (M.kind === "bulkprice") {
      if ((n = q("[data-bpm]"))) { M.data.mode = n.dataset.bpm; sfx.tick(); drawModal(); return true; }
      if (q("[data-bpok]")) { const rids = [...new Set(selPlanes().map(p => p.rid).filter(x => x != null))], rs = V.routes.filter(r => rids.some(x => String(x) === String(r.id))); const k = sendMany(rs.map(r => ({ [ACT]: "price", rid: r.id, dir: "both", p: bulkPriceOf(r, M.data.mode || "rec") }))); if (k) { sfx.coin(); notify("priceSet"); toast(`Preț nou pe ${k} ${k === 1 ? "rută" : "rute"}.`, "", "🏷️"); } closeModal(); return true; }
    }
    if (M.kind === "pmenu") return false;
    if (t.closest(".cl-mcard")) return true;
    return false;
  }
  function topKey(k) {
    const btn = id => { const b = document.getElementById(id); if (b && !b.hidden) { b.click(); return true; } return false; };
    if (k === "salon") {
      sfx.tick();
      const go = () => { if (!btn("backBtn") && helpers.leave) helpers.leave(); };
      const st = ctx.state || {}, my = me();
      let others = 0;
      try { others = (ctx.players || []).filter(s => s !== my && (() => { const i = ctx.seatInfo && ctx.seatInfo(s); return i && !i.bot; })()).length; } catch (e) { others = 0; }
      const host = !!(helpers.isHost && helpers.isHost());
      if (my && st.phase && st.phase !== "end") {
        confirmBox("Ieși în salon?", !others ? "Ești singurul om la masă: dacă ieși, partida se oprește până revii (boții nu joacă fără tine)."
          : (host ? "Tu ții acum simularea partidei; o preia alt jucător în câteva secunde. " : "") + "Compania ta rămâne în joc, dar avioanele tale fără pilot nu mai decolează până revii.", go, "Ies", true);
        return;
      }
      go(); return;
    }
    if (k === "menu") { U.menu = !U.menu; sfx.tick(); drawMenu(); return; }
    U.menu = false; drawMenu();
    if (k === "table") { sfx.tick(); showTable(); return; }
    if (k === "newgame") {
      sfx.tick();
      const b = document.getElementById("newGameBtn");
      if (!b || b.hidden) { showTable("Ca să repornești jocul, ia-ți întâi locul la masă, apoi apasă „Joc nou”."); return; }
      confirmBox("Joc nou?", "Partida curentă se oprește pentru toți jucătorii și începe una nouă.", () => { if (helpers.restart) helpers.restart(); else b.click(); }, "Joc nou", true);
      return;
    }
    if (k === "resettable") { sfx.tick(); if (helpers.resetTable) helpers.resetTable(); else { const rb = document.getElementById("resetTableBtn"); if (rb) rb.click(); else showTable(); } return; }
    if (k === "rematch") { sfx.tick(); if (!btn("rematchBtn") && helpers.restart) helpers.restart(); return; }
    if (k === "lobby") { sfx.tick(); if (!btn("lobbyBtn")) showTable(); return; }
    if (k === "pause") { const on = !(V && V.why === "pause"); if (act("pause", { on })) sfx.tock(); return; }
    if (k === "rules") { sfx.tick(); btn("rulesBtn"); return; }
    if (k === "fs") { sfx.tick(); try { if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); else document.documentElement.requestFullscreen().catch(() => {}); } catch (er) { /* fără API */ } T.timeout(() => { layout(); try { mapApi && mapApi.resize && mapApi.resize(); } catch (e) { /* ignorat */ } }, 300); return; }
    if (k === "maponly") { toggleMapOnly(); return; }
    if (k === "sheet") { U.sheetBig = !U.sheetBig; sfx.tick(); layout(); T.timeout(() => { try { mapApi && mapApi.resize && mapApi.resize(); } catch (e) { /* ignorat */ } }, 40); return; }
    if (k === "guide") { sfx.tick(); const G = H.Guide(); if (G && G.open) { try { G.open(el, Object.assign({}, helpers, { Art: H.Art(), Data: H.Data() }), { tutorial: false }); } catch (e) { console.warn("CerulUI: ghidul a eșuat", e); } } else toast("Ghidul se încarcă…", "", "📖"); return; }
    if (k === "nego" && canNegoNow()) { if (!openUserScene("negoOpen", { loan: false })) openModal("negofb", {}); return; }
    if (!canAct()) { sfx.error(); if (paused()) toast(PAUSE_T, "", "⏸"); else if (V && V.phase === "nego" && V.raw && V.raw.nego && V.raw.nego.busy) toast(V.raw.nego.busy, "", "🤝"); return; }
    if (k === "nego") { if (!openUserScene("negoOpen", { loan: false })) openModal("negofb", {}); return; }
    if (k === "bank") { notify("bank"); if (!openUserScene("bank")) openModal("bankfb", {}); return; }
    if (k === "ghiseu") { openModal("ghiseu", {}); return; }
    if (k === "resign") { confirmBox("Abandonezi?", "Compania ta iese din joc (ca la faliment). Ceilalți continuă.", () => act("resign"), "Abandonează", true); return; }
  }
  T.on(el, "click", onClick);
  T.on(el, "pointerover", e => { if (e.pointerType === "touch" || !V) return; const pv = permitAt(e.target); if (pv) previewOn(pv); else if (U.preview && !U.pvTouch) previewOff(); });
  T.on(el, "pointerout", e => { if (e.pointerType === "touch" || !V || !U.preview || U.pvTouch) return; const to = e.relatedTarget; if (!to || !permitAt(to)) previewOff(); });
  // telefon: ține apăsat pe un permis (sau 👁) → previzualizare; ridici degetul → dispare
  T.on(el, "touchstart", e => { if (!V) return; const pv = permitAt(e.target); if (!pv) return; if (e.target.closest("[data-pv]")) return; U.pvHold = setTimeout(() => { U.pvTouch = true; previewOn(pv); }, 380); }, { passive: true });
  T.on(el, "touchend", () => { clearTimeout(U.pvHold); if (U.pvTouch && !U.pvStick) { U.pvTouch = false; previewOff(); } }, { passive: true });
  T.on(el, "touchcancel", () => { clearTimeout(U.pvHold); if (U.pvTouch && !U.pvStick) { U.pvTouch = false; previewOff(); } }, { passive: true });
  T.on(el, "input", e => {
    const t = e.target;
    if (t.matches("[data-uavol]")) { const k = t.dataset.uavol, v = clamp(num(t.value), 0, 1); setPut(k, v); const o = t.parentNode.querySelector("output"); if (o) o.textContent = Math.round(v * 100) + "%"; if (k === "music") applySettings(); else ASFX.play(k === "ann" ? "dingdong" : "land"); return; }
    if (t.matches("[data-pinput]")) { const pv = parseNum(t.value); if (!isFinite(pv) || pv <= 0) return; U.draft.p = Math.round(pv); const r = el.querySelector("[data-prange]"); if (r) r.value = U.draft.p; refreshPopupApply(); return; }
    if (t.matches("[data-prange]")) { U.draft.p = Math.round(num(t.value)); const i = el.querySelector("[data-pinput]"); if (i) i.value = fmtInt(U.draft.p); refreshPopupApply(); return; }
    if (t.matches("[data-tq]") && U.modal) { U.modal.data.q = t.value; const pos = t.selectionStart; drawModal(); const q2 = E.modw.querySelector("[data-tq]"); if (q2) { q2.focus(); try { q2.setSelectionRange(pos, pos); } catch (er) { /* ignorat */ } } return; }
    if (t.matches("[data-shn]") && U.modal) { U.modal.data.n = +t.value; drawModal(); const s = E.modw.querySelector("[data-shn]"); s && s.focus(); return; }
    if (t.matches("[data-bpct]") && U.modal && U.modal.kind === "bulkmin") { U.modal.data.pct = +t.value; drawModal(); const s = E.modw.querySelector("[data-bpct]"); s && s.focus(); return; }
    if (t.matches("[data-pmin]") && U.modal && U.modal.kind === "pilotmin") { const M = U.modal, p = V.planes.find(x => x.id === M.data.pid); M.data.n = +t.value; const q2 = s2 => E.modw.querySelector(s2); if (q2("[data-pminv]")) q2("[data-pminv]").textContent = M.data.n; if (p && q2("[data-pminp]")) q2("[data-pminp]").innerHTML = pminProfitHTML(p, M.data.n); const ok = q2("[data-pminok]"); if (ok) ok.textContent = (M.data.hire ? "Angajează · min " : "Setează · min ") + M.data.n; return; }
    if (t.matches("[data-bamt]") && U.modal) { U.modal.data.amt = +t.value; drawModal(); const s = E.modw.querySelector("[data-bamt]"); s && s.focus(); return; }
  });
  function refreshPopupApply() { const pv = E.popw.__h; E.popw.__h = null; drawPopup(); if (!pv) return; }
  T.on(el, "keydown", e => {
    if (e.key === "Enter" && e.target.matches && e.target.matches("[data-pinput]")) { e.preventDefault(); const pv = parseNum(e.target.value); if (isFinite(pv) && pv > 0) applyPrice(Math.round(pv)); return; }
    if ((e.key === "Enter" || e.key === " ") && e.target.matches && e.target.matches("[data-route]")) { e.preventDefault(); selectRoute(parseId(e.target.dataset.route)); }
    if ((e.key === "Enter" || e.key === " ") && e.target.matches && e.target.matches("[data-plane]")) { e.preventDefault(); e.target.click(); }
  });
  T.on(document, "keydown", e => {
    if (!alive || el.style.display === "none") return;
    if (/input|select|textarea/i.test((e.target && e.target.tagName) || "") || e.ctrlKey || e.metaKey || e.altKey) { if (e.key === "Escape" && e.target.blur) e.target.blur(); return; }
    if (sceneBusy()) { if (e.key === "Escape") { const x = [...el.querySelectorAll(".cs-pop.on .cs-x2, .cs-dlg .cs-x2")].filter(b => b.offsetParent).pop(); if (x) x.click(); } return; } // QA: Esc închide și fereastra de bancă / dialogurile scenelor
    if (e.key === "Escape") { if (A_.panel) { panelA(null); return; } { const rx = el.querySelector(".cl-rx"); if (rx) { rx.remove(); return; } } if (U.modal) { closeModal(); return; } if (U.menu) { U.menu = false; drawMenu(); return; } if (U.popKind) { closePop(); return; } if (U.maponly) { toggleMapOnly(false); } return; }
    if (e.key === "m" || e.key === "M") { toggleMapOnly(); return; }
    if (keyA(e)) return;
    const i = "123456".indexOf(e.key); if (i >= 0 && U.mode !== "phone") { U.tab = TABS[i].k; lsSet("cerul.tab", U.tab); sfx.tick(); drawAll(); }
  });
  T.on(W, "resize", () => { layout(); drawAll(); });

  /* ---------- buclă: ceas + date vii ---------- */
  T.interval(() => {
    if (!alive) return;
    if (!root.isConnected && api) { api.destroy(); return; }
    drawClock();
    refresh(false);
  }, 250);

  function render(c) {
    if (c) ctx = c;
    if (!alive) return;
    st = ctx.state;
    if (!st) return;
    refresh(true);
  }
  let api = null;
  layout();
  render(ctx);
  T.timeout(() => { layout(); try { mapApi && mapApi.resize && mapApi.resize(); } catch (e) { /* ignorat */ } drawAll(); }, 120);
  // ghidul se deschide automat la prima partidă
  T.timeout(() => { const G = H.Guide(); if (G && G.autoOpen && me() && V && V.phase === "play" && !helpers.auto && !W.__CERUL_AUTO) { try { G.autoOpen(el, Object.assign({}, helpers, { Art: H.Art(), Data: H.Data() })); } catch (e) { /* ignorat */ } } }, 1500);

  return (api = {
    el, render,
    destroy() {
      if (!alive) return; alive = false;
      try { sceneApi && sceneApi.destroy && sceneApi.destroy(); } catch (e) { /* ignorat */ }
      closeUserScene();
      try { mapApi && mapApi.destroy && mapApi.destroy(); } catch (e) { /* ignorat */ }
      try { fbMap && fbMap.destroy(); } catch (e) { /* ignorat */ }
      el.remove(); hideBack();
      if (!document.querySelector(".cl-root")) document.documentElement.classList.remove("cl-on");
    },
    _ui: U, _view: () => V, toast, banner,
  });
}

W.CerulUI = { mount, css, version: 1, bootHTML: (msg, pct) => { cssA(); return bootHTML(msg, pct == null ? loadPct() : pct); }, settings: () => setGet(), parseNum, sfx: ASFX };
})();
