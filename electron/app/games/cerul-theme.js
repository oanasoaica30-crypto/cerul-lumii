/* Cerul Lumii — tema vizuală comună: variabile CSS, fonturi, culorile companiilor, harta și setul de iconițe SVG.
   window.CerulTheme = { icon, ic, fromEmoji, ICONS, COMPANY, MAP, TOKENS, inject }
   inject() pune foaia de stil la SFÂRȘITUL <head> (după css-cerul-ui / scenes / guide), deci aceleași selectoare câștigă aici. */
(function () {
"use strict";
var W = typeof window !== "undefined" ? window : globalThis;
var D = typeof document !== "undefined" ? document : null;

/* ---------------- culorile companiilor (aceleași id-uri/indici ca CerulData.COLORS → salvările vechi rămân corecte) ---------------- */
var COMPANY = [
  { id: 0, n: "Portocaliu", hex: "#ff7a1f", light: "#ffb27a", dark: "#a8420a" },
  { id: 1, n: "Turcoaz", hex: "#1ee3cf", light: "#93f5ea", dark: "#0a7d72" },
  { id: 2, n: "Magenta", hex: "#ff4fb0", light: "#ffa9d9", dark: "#a3166a" },
  { id: 3, n: "Verde lime", hex: "#a3ec3c", light: "#d4f7a3", dark: "#4e7d12" },
  { id: 4, n: "Galben lămâie", hex: "#ffe83a", light: "#fff3a0", dark: "#8f7f00" },
  { id: 5, n: "Lavandă", hex: "#c29cff", light: "#e2d1ff", dark: "#5e3cae" }
];
try {
  var DC = W.CerulData && W.CerulData.COLORS;
  if (Array.isArray(DC)) DC.forEach(function (c, i) { var t = COMPANY[i]; if (t && c) { c.hex = t.hex; c.light = t.light; c.dark = t.dark; c.n = t.n; } });
} catch (e) { /* fără date */ }

/* ---------------- harta ---------------- */
var MAP = {
  oceanDay: { deep: "#12507f", mid: "#1d6fa6", shelf: "#3ba0c9" },
  oceanNight: { deep: "#08213f", mid: "#0e3360", shelf: "#1b5a86" },
  landDay: { low: "#6f9a4e", dry: "#c7b07a", high: "#9b8a6a", snow: "#eef3f7", coast: "rgba(255,255,255,.35)" },
  landNightMul: 0.55, vignette: 0.25,
  label: "#ffffff", labelHalo: "rgba(4,10,22,.85)"
};

var TOKENS = {
  bg: "#060c18", panel: "#0a1222", panel2: "#101a2e", glass: "rgba(9,16,30,.72)",
  line: "rgba(255,255,255,.07)", line2: "rgba(255,255,255,.14)",
  ink: "#eef3fb", mut: "#9aa8c0", dim: "#6c7a93",
  gold: "#f6b93b", gold2: "#e8961a", goldInk: "#231500", sel: "#8cc2ff", ok: "#34d58a", bad: "#ff5c5c", warn: "#ffb86b",
  font: '"Inter",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif',
  display: '"Sora","Inter Display","Inter",system-ui,-apple-system,"Segoe UI",sans-serif'
};

/* ---------------- iconițe (24×24, contur, currentColor) ---------------- */
var P = {
  plane: '<path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z"/>',
  routes: '<circle cx="5" cy="18" r="2.2"/><circle cx="19" cy="6" r="2.2"/><path d="M7.2 18c6 0 3.6-12 9.6-12"/>',
  stats: '<path d="M4 20h16M7 16v-4M12 16V7M17 16v-6"/>',
  shop: '<path d="M5.5 7.5h13l-1.2 12.5H6.7z"/><path d="M9 7.5V6a3 3 0 0 1 6 0v1.5"/>',
  invest: '<path d="M3 21h18M5 21V10l7-5.5 7 5.5v11"/><path d="M9.5 21v-5h5v5"/>',
  bank: '<path d="M3 9.5 12 4l9 5.5"/><path d="M5 10v8M9.7 10v8M14.3 10v8M19 10v8M3 21h18"/>',
  cards: '<rect x="8" y="3" width="12" height="16" rx="2"/><path d="M5 6.5V19a2.5 2.5 0 0 0 2.5 2.5H16"/>',
  guide: '<path d="M4 19V5a2 2 0 0 1 2-2h13v15H6a2 2 0 0 0-2 2 2 2 0 0 0 2 2h13"/><path d="M9 7h6"/>',
  nego: '<path d="M4 4.5h11a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H9l-4 3v-3H4a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1z"/><path d="M19 9h1a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-1v3l-4-3h-4"/>',
  pause: '<path d="M8.5 5v14M15.5 5v14"/>',
  play: '<path d="M7 4.5 19 12 7 19.5z"/>',
  settings: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
  hub: '<circle cx="12" cy="12" r="2.6"/><path d="M12 9.4V5M12 14.6V19M9.4 12H5M14.6 12H19"/><circle cx="12" cy="3.6" r="1.4"/><circle cx="12" cy="20.4" r="1.4"/><circle cx="3.6" cy="12" r="1.4"/><circle cx="20.4" cy="12" r="1.4"/>',
  terminal: '<path d="M2.5 20.5h19M4.5 20.5v-8h15v8M8 12.5V9h8v3.5M12 9V4.5M10 4.5h4"/><path d="M8 16.5h.01M12 16.5h.01M16 16.5h.01"/>',
  slot: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  gate: '<path d="M6 21V4h12v17M3 21h18"/><path d="M14.5 12.5h.01"/>',
  pilot: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="2.2"/><path d="M12 3.5v6.3M4.6 16.3l5.5-3.2M19.4 16.3l-5.5-3.2"/>',
  fuel: '<path d="M4 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16M3 21h12M7 7.5h4"/><path d="M14 10h2a2 2 0 0 1 2 2v4a1.5 1.5 0 0 0 3 0V8.5L18 5.5"/>',
  warning: '<path d="M12 3.5 21.5 20h-19z"/><path d="M12 10v4.5M12 17.2h.01"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.8h.01"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  close: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', minus: '<path d="M5 12h14"/>',
  back: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  arrowUp: '<path d="M12 19V5M6 11l6-6 6 6"/>', arrowDown: '<path d="M12 5v14M6 13l6 6 6-6"/>',
  up: '<path d="m6 15 6-6 6 6"/>', down: '<path d="m6 9 6 6 6-6"/>',
  menu: '<path d="M5 12h.01M12 12h.01M19 12h.01" stroke-width="3.2"/>',
  fullscreen: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  map: '<path d="M3 6.5 9 4l6 2.5L21 4v13.5L15 20l-6-2.5L3 20z"/><path d="M9 4v13.5M15 6.5V20"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  cash: '<rect x="2.5" y="6" width="19" height="12" rx="2"/><circle cx="12" cy="12" r="2.6"/><path d="M6 9.5v5M18 9.5v5"/>',
  value: '<path d="m3 17 6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
  debt: '<rect x="2.5" y="5" width="19" height="14" rx="2"/><path d="M2.5 10h19M6.5 15h4"/>',
  star: '<path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.8z"/>',
  freeze: '<path d="M12 2.5v19M3.8 7.2l16.4 9.6M3.8 16.8l16.4-9.6"/><path d="m9.5 4 2.5 2 2.5-2M9.5 20l2.5-2 2.5 2"/>',
  fire: '<path d="M12 21.5c3.9 0 6.5-2.8 6.5-6.5 0-4.6-4.5-6.6-4.5-11-3 1.8-4.8 4.6-4.8 7.5-1-.8-1.7-1.9-1.9-3.5-1.8 1.8-1.8 4.5-1.8 7 0 3.7 2.6 6.5 6.5 6.5z"/>',
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  keyboard: '<rect x="2.5" y="6" width="19" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8"/>',
  sound: '<path d="M4 9.5v5h3.5L13 19V5L7.5 9.5z"/><path d="M16.5 9a4 4 0 0 1 0 6M19 6.5a7.5 7.5 0 0 1 0 11"/>',
  mute: '<path d="M4 9.5v5h3.5L13 19V5L7.5 9.5z"/><path d="m16.5 9.5 5 5M21.5 9.5l-5 5"/>',
  people: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20a6 6 0 0 1 12 0"/><path d="M16 4.8a3.2 3.2 0 0 1 0 6.4M21 20a6 6 0 0 0-3.6-5.5"/>',
  shares: '<path d="M3.5 3.5v17h17"/><path d="m7.5 14.5 3.5-4 3 3 5-6"/>',
  trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5a3 3 0 0 0 3.2 4M16 6h3a3 3 0 0 1-3.2 4M12 13v4M8 21h8M10 17h4"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7.5a4 4 0 0 1 8 0V11"/>',
  wrench: '<path d="M14.5 3.6a5 5 0 0 0-4.3 6.9L3.3 17.4l3.3 3.3 6.9-6.9a5 5 0 0 0 6.9-4.3l-3 3-3.2-.8-.8-3.2z"/>',
  consultant: '<circle cx="12" cy="7.5" r="3.8"/><path d="M4.5 21a7.5 7.5 0 0 1 15 0"/><path d="m12 13 1.4 2.2L12 20l-1.4-4.8z"/>',
  ticket: '<path d="M3 8.5a2 2 0 0 0 2-2h14a2 2 0 0 0 2 2v1.8a1.7 1.7 0 0 0 0 3.4v1.8a2 2 0 0 0-2 2H5a2 2 0 0 0-2-2v-1.8a1.7 1.7 0 0 0 0-3.4z"/><path d="M14.5 6.5v11" stroke-dasharray="1.6 2"/>',
  globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5a13 13 0 0 1 0 17M12 3.5a13 13 0 0 0 0 17"/>',
  event: '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.8 2H4.2z"/><path d="M10 21h4"/>',
  company: '<path d="M4 21V5.5L12 3v18M12 9h8v12M2.5 21h19"/><path d="M7.5 8h1.5M7.5 12h1.5M7.5 16h1.5M15.5 13h1.5M15.5 17h1.5"/>',
  swap: '<path d="M6 7.5h14M16 3.5l4 4-4 4M18 16.5H4M8 12.5l-4 4 4 4"/>',
  lease: '<path d="M6 2.5h9l5 5v14H6z"/><path d="M14.5 2.5V8H20M9 13h8M9 17h5.5"/>',
  chain: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3A4 4 0 0 0 13 5.3l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  flag: '<path d="M5 21V4M5 4.5h12l-2.5 4 2.5 4H5"/>',
  coin: '<circle cx="12" cy="12" r="8.5"/><path d="M14.8 9.2a3.4 3.4 0 1 0 0 5.6M8 11h5M8 13h5"/>',
  spectator: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>',
  sell: '<path d="M20.5 13 13 20.5a1.5 1.5 0 0 1-2.1 0L3.5 13V3.5H13l7.5 7.4a1.5 1.5 0 0 1 0 2.1z"/><path d="M8 8h.01"/>',
  crown: '<path d="M3.5 8 7.5 12l4.5-6.5 4.5 6.5 4-4-1.7 10.5H5.2z"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'
};
var ALIAS = { fleet: "plane", reports: "stats", ghiseu: "cards", pax: "people", seats: "people", money: "cash", loan: "debt", settingsGear: "settings", dots: "menu", x: "close", left: "back", right: "arrowRight", rank: "trophy", time: "clock", broken: "wrench", ice: "freeze", stopover: "chain", pioneer: "flag", building: "invest", stock: "shares", bell: "event", user: "consultant", price: "ticket" };
var EMOJI = { "✈️": "plane", "✈": "plane", "🛣️": "routes", "📊": "stats", "🛒": "shop", "🏗️": "invest", "📈": "shares", "🏦": "bank", "🃏": "cards", "📖": "guide", "🤝": "nego", "⏸": "pause", "⏸️": "pause", "▶️": "play", "▶": "play", "⚙️": "settings", "⚙": "settings", "⛽": "fuel", "⚠️": "warning", "⚠": "warning", "ℹ️": "info", "✅": "check", "✔": "check", "✕": "close", "✖": "close", "×": "close", "⋯": "menu", "⛶": "fullscreen", "🗺️": "map", "☀️": "sun", "🌙": "moon", "💶": "cash", "💰": "cash", "⭐": "star", "★": "star", "❄️": "freeze", "🔥": "fire", "↩": "undo", "⌨": "keyboard", "🔊": "sound", "🔇": "mute", "👥": "people", "🏆": "trophy", "📅": "calendar", "👀": "eye", "👁️": "eye", "🔒": "lock", "🔧": "wrench", "🎫": "ticket", "🌍": "globe", "🌐": "globe", "🔔": "event", "📣": "event", "🏢": "company", "⇄": "swap", "📄": "lease", "🔗": "chain", "🔀": "chain", "🚩": "flag", "🏅": "flag", "🪙": "coin", "🛂": "gate", "🚪": "gate", "🕒": "clock", "⏱️": "clock", "👨‍✈️": "pilot", "🧑‍✈️": "pilot", "🏷️": "sell", "👑": "crown", "🛫": "terminal", "📍": "hub" };
function icon(name, o) {
  o = o || {};
  var k = P[name] ? name : ALIAS[name];
  if (!k || !P[k]) return "";
  var sz = o.size == null ? "1em" : (typeof o.size === "number" ? o.size + "px" : String(o.size));
  var t = o.title ? String(o.title).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }) : "";
  return '<svg class="cl-i cl-i-' + k + (o.cls ? " " + o.cls : "") + '" viewBox="0 0 24 24" width="' + sz + '" height="' + sz + '" fill="none" stroke="currentColor" stroke-width="' + (o.stroke || 1.9) + '" stroke-linecap="round" stroke-linejoin="round" ' + (t ? 'role="img" aria-label="' + t + '"><title>' + t + "</title>" : 'aria-hidden="true">') + P[k] + "</svg>";
}
function ic(name, fb) { return icon(name) || fb || ""; }
function fromEmoji(e) { return EMOJI[String(e || "").trim()] || null; }

/* ---------------- CSS ---------------- */
var VARS = "--bg:#060c18;--panel:#0a1222;--panel2:#101a2e;--glass:rgba(9,16,30,.76);--glass-strong:rgba(10,17,32,.93);--line:rgba(255,255,255,.07);--line2:rgba(255,255,255,.14);--ink:#eef3fb;--mut:#9aa8c0;--dim:#6c7a93;--gold:#f6b93b;--gold2:#e8961a;--gold-ink:#231500;--sel:#8cc2ff;--ok:#34d58a;--bad:#ff5c5c;--good:#34d58a;--warn:#ffb86b;--r-s:8px;--r-m:12px;--r-l:16px;--sh-1:0 2px 8px rgba(0,0,0,.35);--sh-2:0 14px 40px rgba(0,0,0,.55);--body:" + TOKENS.font + ";--display:" + TOKENS.display + ";--cl-font:" + TOKENS.font + ";--cl-font-display:" + TOKENS.display + ";";
var CSS = [
":root{--cl-ocean-day-deep:#12507f;--cl-ocean-day-mid:#1d6fa6;--cl-ocean-day-shelf:#3ba0c9;--cl-ocean-night-deep:#08213f;--cl-ocean-night-mid:#0e3360;--cl-ocean-night-shelf:#1b5a86;--cl-land-low:#6f9a4e;--cl-land-dry:#c7b07a;--cl-land-high:#9b8a6a;--cl-land-snow:#eef3f7;--cl-glass:rgba(9,16,30,.72);--cl-gold:#f6b93b;--cl-sel:#8cc2ff;--cl-ok:#34d58a;--cl-bad:#ff5c5c}",
".cl-root,.cs-root,.cg-ov,.ct-root{" + VARS + "font-variant-numeric:tabular-nums;font-feature-settings:'tnum' 1,'cv11' 1}",
".cl-root{font-family:var(--body);letter-spacing:-.003em}",
".cl-i{display:inline-block;flex:none;vertical-align:-.14em;overflow:visible}",
".cl-num{font-size:1.25em;font-weight:750;font-variant-numeric:tabular-nums;letter-spacing:-.01em}.cl-dimx{color:var(--dim);font-size:.86em}",
".cl-glass{background:var(--glass);-webkit-backdrop-filter:blur(14px) saturate(1.3);backdrop-filter:blur(14px) saturate(1.3);border:1px solid var(--line2)}",
".cl-root :focus-visible{outline:2px solid var(--sel);outline-offset:2px;border-radius:6px}",
/* bara de sus */
".cl-top{background:linear-gradient(180deg,rgba(10,18,34,.97),rgba(8,14,27,.95));border-bottom:1px solid var(--line);box-shadow:0 8px 24px rgba(0,0,0,.45);gap:14px;padding:9px 16px}",
".cl-tb{background:rgba(255,255,255,.05);border:1px solid var(--line2);border-radius:var(--r-m);font-weight:600;transition:background .15s,border-color .15s,transform .1s}",
".cl-tb:hover{border-color:rgba(255,255,255,.3);background:rgba(255,255,255,.09)}",
".cl-tb.on{background:rgba(140,194,255,.14);border-color:var(--sel)}",
".cl-tb .ic{display:inline-flex;font-size:18px;opacity:.95}",
".cl-top .cl-tb.gold{background:rgba(255,255,255,.05);color:var(--ink);border-color:var(--line2)}",
".cl-top .cl-tb.gold:hover{background:rgba(255,255,255,.09);border-color:rgba(255,255,255,.3)}",
".cl-tb.gold{background:linear-gradient(180deg,var(--gold),var(--gold2));color:var(--gold-ink);border-color:transparent}",
".cl-co b{font-weight:700;letter-spacing:-.01em}",
".cl-co small{color:var(--dim)}",
".cl-av{background:#16233c}",
".cl-stars{color:#e9c46a}",
".cl-stat{background:rgba(255,255,255,.035);border:1px solid var(--line);border-radius:var(--r-m);padding:6px 14px}",
".cl-stat small{color:var(--dim);font-size:10.5px;font-weight:600;letter-spacing:.08em}",
".cl-stat b{font-size:20px;font-weight:750;letter-spacing:-.01em}",
".cl-stat[data-tut=value] small{padding-right:18px}.cl-rkb{background:#121c30;border-color:var(--line2)}",
".cl-clock{background:rgba(255,255,255,.035);border:1px solid var(--line);border-radius:var(--r-m)}",
".cl-clock small{color:var(--dim);font-weight:600}",
".cl-clock b{font-weight:750}",
".cl-ring .bg{stroke:rgba(255,255,255,.1)}.cl-ring .fg{stroke:#ffd58a}",
".cl-clock.paused{border-color:var(--sel)}",
".cl-op{background:rgba(255,255,255,.03);border:1px solid var(--line);border-radius:var(--r-m)}",
".cl-op small{color:var(--dim)}",
".cl-op .rk{background:#e8eef9;color:#0a1222}",
".cl-menu{background:var(--glass-strong);-webkit-backdrop-filter:blur(16px) saturate(1.3);backdrop-filter:blur(16px) saturate(1.3);border:1px solid var(--line2);border-radius:var(--r-l);box-shadow:var(--sh-2)}",
".cl-menu .cl-tb{gap:10px}.cl-menu .cl-i{font-size:17px;opacity:.85}",
".cl-tb>.cl-i{font-size:18px}",
/* mijloc */
".cl-mapc{background:radial-gradient(ellipse at 50% 40%,#1d6fa6,#12507f 75%)}",
".cl-split{background:var(--panel);border-left:1px solid var(--line)}.cl-split::after{background:rgba(255,255,255,.18)}.cl-split:hover::after,.cl-split.drag::after{background:var(--sel)}",
".cl-hsplit{background:var(--panel);border-top:1px solid var(--line)}.cl-hsplit::after{background:rgba(255,255,255,.18)}.cl-hsplit:hover::after,.cl-hsplit.drag::after{background:var(--sel)}",
".cl-side{background:var(--panel);border-left:1px solid var(--line)}",
".cl-tabs{border-bottom:1px solid var(--line);padding:0 6px;gap:2px}",
".cl-tabs button{display:inline-flex;align-items:center;justify-content:center;gap:7px;font-weight:600;font-size:13.5px;color:var(--mut);padding:13px 8px;border-radius:0}",
".cl-tabs button .cl-i{font-size:17px}",
".cl-tabs button sup{background:rgba(255,255,255,.1);color:var(--ink);font-weight:600}",
".cl-tabs button.on{color:var(--ink);box-shadow:inset 0 -2px var(--sel)}",
".cl-pane{padding:12px;gap:10px}",
/* carduri */
".cl-pl,.cl-rt,.cl-shop,.cl-inv,.cl-shr,.cl-chart,.cl-used{background:var(--panel2);border:1px solid var(--line);border-radius:var(--r-m);box-shadow:var(--sh-1)}",
".cl-pl{padding:12px 14px}.cl-rt{padding:11px 14px}.cl-shop,.cl-inv{padding:12px 14px;gap:8px}",
".cl-pl:hover,.cl-rt:hover{border-color:rgba(255,255,255,.18)}",
".cl-pl.sel,.cl-rt.sel{border-color:var(--sel);box-shadow:0 0 0 1px var(--sel),var(--sh-1)}",
".cl-pl.ready{border-color:rgba(52,213,138,.5);box-shadow:0 0 18px rgba(52,213,138,.12)}",
".cl-pl .h b,.cl-rt .h b{font-weight:700;letter-spacing:-.01em}",
".cl-pl .r,.cl-rt .m{color:var(--mut)}",
".cl-tag{background:rgba(255,255,255,.07);color:#c9d4e6;font-weight:600}",
".cl-tag.pil{background:rgba(140,194,255,.12);color:#cfe4ff}",
".cl-tag.ok{background:rgba(52,213,138,.14)}.cl-tag.bad{background:rgba(255,92,92,.15)}",
".cl-bar{background:rgba(255,255,255,.08);height:6px;border-radius:4px}.cl-bar i{border-radius:4px}",
".cl-pilot{background:rgba(255,255,255,.04);border-color:var(--line2)}",
".cl-pilot.on{background:rgba(140,194,255,.14);border-color:rgba(140,194,255,.55);color:#cfe4ff!important}",
".cl-sum span{background:rgba(255,255,255,.04);border:1px solid var(--line)}",
".cl-sum .cl-qbtn{background:rgba(255,255,255,.06);border-color:var(--line2);color:#d6deeb}.cl-sum .cl-qbtn.on{background:rgba(140,194,255,.18);color:#fff}",
".cl-h{color:var(--dim);font-size:11px;letter-spacing:.1em;font-weight:700}",
".cl-shop .nm b{font-size:16.5px;font-weight:700}.cl-shop .nm .pr{color:var(--ink);font-size:15px;font-weight:750}",
".cl-shop .art{background:radial-gradient(ellipse at 50% 80%,rgba(140,194,255,.12),transparent 70%)}",
".cl-pspec span,.cl-fitr .ch,.cl-explain,.cl-legbox,.cl-pmin,.cl-fit,.cl-seg{background:rgba(255,255,255,.035);border-color:var(--line)}",
".cl-pspec b{font-size:14px}",
".cl-seg button.on{background:rgba(255,255,255,.1)}",
".cl-inv .h .ic{background:rgba(140,194,255,.1);border:1px solid var(--line2);color:#cfe4ff}",
".cl-inv .fx span{background:rgba(255,255,255,.05);border-color:var(--line)}",
".cl-chip{background:rgba(255,255,255,.04);border-color:var(--line2)}.cl-chip.on{border-color:var(--sel);background:rgba(140,194,255,.14);color:var(--ink)}",
".cl-chip.have{background:rgba(52,213,138,.12)}",
".cl-lvl i{background:rgba(255,255,255,.1);border-color:rgba(255,255,255,.2)}.cl-lvl i.on{background:var(--sel);border-color:var(--sel);box-shadow:0 0 6px rgba(140,194,255,.6)}",
".cl-now{background:rgba(140,194,255,.15);color:#cfe4ff}",
".cl-shr .own,.cl-sharebar,.cl-best .bb{background:rgba(255,255,255,.08)}",
".cl-chart text{fill:#8f9db5}",
/* butoane */
".cl-btn{background:rgba(255,255,255,.06);border:1px solid var(--line2);border-radius:10px;font-weight:650;padding:8px 13px}",
".cl-btn:hover:not(:disabled){border-color:rgba(255,255,255,.32);background:rgba(255,255,255,.1)}",
".cl-btn.gold{background:linear-gradient(180deg,var(--gold),var(--gold2));color:var(--gold-ink)!important;border-color:transparent;box-shadow:0 4px 14px rgba(246,185,59,.25)}",
".cl-btn.gold:hover:not(:disabled){filter:brightness(1.06);border-color:transparent;background:linear-gradient(180deg,#ffc95a,var(--gold))}",
".cl-btn.red{background:linear-gradient(180deg,#ff7a6e,#d9443a);border-color:transparent}",
".cl-btn.ghost{background:transparent}",
".cl-btn.sm{padding:5px 10px;font-size:12.5px}",
".cl-btn.on{border-color:var(--sel);background:rgba(140,194,255,.14);box-shadow:inset 0 0 0 1px var(--sel)}",
".cl-go{background:linear-gradient(180deg,var(--gold),var(--gold2));color:var(--gold-ink)!important;box-shadow:0 4px 14px rgba(246,185,59,.25);border-radius:10px}",
".cl-x{background:rgba(255,255,255,.07);border-radius:9px;color:var(--mut)}.cl-x:hover{background:rgba(255,255,255,.15);color:var(--ink)}",
/* jos */
".cl-bot{background:var(--panel);border-top:1px solid var(--line);gap:14px;padding:10px 16px}",
".cl-box{background:var(--panel2);border:1px solid var(--line);border-radius:var(--r-l)}",
".cl-pm{background:rgba(255,255,255,.035);border:1px dashed rgba(255,255,255,.2);border-radius:var(--r-m)}",
".cl-pm.can{border-style:solid;border-color:rgba(246,185,59,.75);box-shadow:0 0 16px rgba(246,185,59,.12)}",
".cl-pm .del{background:rgba(255,255,255,.06)}",
".cl-sc{background:linear-gradient(160deg,#25365e,#18223f);border:1px solid rgba(160,185,255,.28)}",
".cl-sc u{color:#cfe4ff}",
/* peste hartă: sticlă */
".cl-pop,.cl-legend,.cl-ev,.cl-toast,.cl-pzc,.cl-mapbtns .cl-tb,.cl-cons .cl-bubble+*{-webkit-backdrop-filter:blur(14px) saturate(1.3);backdrop-filter:blur(14px) saturate(1.3)}",
".cl-pop{background:var(--glass-strong);border:1px solid var(--line2);border-radius:var(--r-l);box-shadow:var(--sh-2);padding:14px 16px;gap:8px}",
".cl-pop h4{font-size:16.5px;font-weight:700;letter-spacing:-.01em}",
".cl-pop .row{color:var(--mut);font-size:13px}",
".cl-pop .row.cl-erow{background:rgba(255,255,255,.04);border-color:var(--line)}",
".cl-pres button{background:rgba(255,255,255,.05);border-color:var(--line2)}.cl-pres button:hover{border-color:rgba(255,255,255,.3)}",
".cl-pres button.on{border-color:var(--sel);box-shadow:inset 0 0 0 1px var(--sel);background:rgba(140,194,255,.12)}",
".cl-pin input[type=number],.cl-root input[type=text],.cl-root input[type=number]{background:rgba(0,0,0,.35);border:1px solid var(--line2);border-radius:9px;color:var(--ink)}",
".cl-pin input[type=range],.cl-pmin input,.cl-tog input{accent-color:var(--sel)}",
".cl-dir button{border-color:var(--line2)}.cl-dir button.on{background:rgba(255,255,255,.1);border-color:rgba(255,255,255,.35)}",
".cl-legend{background:var(--glass);border:1px solid var(--line2);border-radius:var(--r-m);color:#c3cede}",
".cl-mapbtns .cl-tb{background:var(--glass);border-color:var(--line2)}",
".cl-ev{background:var(--glass);border:1px solid var(--line2)}",
".cl-ev.start{background:linear-gradient(90deg,rgba(56,44,14,.82),rgba(22,32,20,.82));border-color:rgba(246,185,59,.55)}",
".cl-toast{background:var(--glass-strong);border:1px solid var(--line2);border-left-width:3px;border-radius:var(--r-m);box-shadow:var(--sh-2)}",
".cl-pzc{background:var(--glass-strong);border:1px solid var(--line2);border-radius:var(--r-l)}",
".cl-pzc b{font:800 21px var(--display);letter-spacing:-.01em;text-transform:none;color:var(--ink)}",
".cl-banner{font:800 clamp(18px,2.2vw,28px) var(--display);letter-spacing:-.01em;text-transform:none;border-radius:var(--r-l);background:rgba(10,20,40,.8);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);border:1px solid var(--line2)}",
".cl-banner.gold{background:linear-gradient(90deg,rgba(90,62,0,.88),rgba(150,104,10,.88),rgba(90,62,0,.88))}.cl-banner.red{background:linear-gradient(90deg,rgba(110,16,16,.9),rgba(170,36,36,.9),rgba(110,16,16,.9))}",
/* modale */
".cl-modal{background:rgba(3,7,15,.66);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px)}",
".cl-mcard{background:linear-gradient(180deg,rgba(20,31,54,.97),rgba(11,19,35,.97));border:1px solid var(--line2);border-radius:20px;padding:20px 22px;gap:14px;box-shadow:0 30px 80px rgba(0,0,0,.7)}",
".cl-mcard h2{font:800 21px/1.2 var(--display);letter-spacing:-.01em;text-transform:none;color:var(--ink)}",
".cl-mcard p{color:#c3cede}",
".cl-opt{background:rgba(255,255,255,.035);border:1px solid var(--line2);border-radius:var(--r-m)}",
".cl-opt:hover:not(:disabled){border-color:rgba(255,255,255,.3)}.cl-opt.on{border-color:var(--sel);background:rgba(140,194,255,.12)}",
/* telefon */
".cl-root.phone .cl-top{gap:6px;padding:6px 8px}",
".cl-root.phone .cl-stat{padding:3px 8px}.cl-root.phone .cl-stat b{font-size:15px}.cl-root.phone .cl-stat small{font-size:9.5px}",
".cl-root.phone .cl-ptabs{background:var(--panel)}",
".cl-ptabs button i{display:inline-flex;font-size:21px}",
".cl-ptabs button.on{background:rgba(140,194,255,.13);color:#cfe4ff!important}",
".cl-root.phone .cl-side{background:var(--panel)}",
".cl-root.mid .cl-stat{padding:4px 10px}.cl-root.mid .cl-stat b{font-size:16px}",
/* scene (doar CSS) */
".cs-root h1,.cs-root h2,.cs-root h3{font-family:var(--display);letter-spacing:-.01em}",
".cs-brand h1,.cs-end-h h1{font-family:var(--display);font-weight:800;letter-spacing:-.015em;text-transform:none;background:linear-gradient(180deg,#fff,#cfe4ff);-webkit-background-clip:text;background-clip:text}",
".cs-banner span{font-family:var(--display);font-weight:800;text-transform:none;letter-spacing:-.01em}",
".cs-av.on{border-color:var(--sel);background:rgba(140,194,255,.12);box-shadow:0 0 0 4px rgba(140,194,255,.18),0 10px 20px rgba(0,0,0,.45)}.cs-av.on span{color:#cfe4ff}",
".cs-vtile.on{border-color:var(--sel);background:linear-gradient(180deg,rgba(140,194,255,.16),rgba(140,194,255,.05));box-shadow:0 0 0 3px rgba(140,194,255,.16)}",
".cs-chip:hover,.cs-chip.on{border-color:var(--sel);color:#cfe4ff}",
".cs-ib:hover:not(:disabled),.cs-li:hover,.cs-qp:hover{border-color:rgba(255,255,255,.35)}",
".cs-bk-amt input{accent-color:var(--sel)}",
/* ghid */
".cg-ov{font-family:var(--body)}",
".cg-brand .cg-bico{background:rgba(140,194,255,.14);color:#cfe4ff;box-shadow:none;border:1px solid rgba(140,194,255,.3)}",
".cg-brand b{font:800 20px/1.1 var(--display);letter-spacing:-.01em;text-transform:none}"
].join("\n");

var FONT_HREF = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Sora:wght@600;700;800&display=swap";
function inject() {
  if (!D || !D.head) return;
  if (!D.getElementById("cerul-theme-fonts")) {
    try { var l = D.createElement("link"); l.id = "cerul-theme-fonts"; l.rel = "stylesheet"; l.href = FONT_HREF; D.head.appendChild(l); } catch (e) { /* offline: rămâne fallback-ul de sistem */ }
  }
  var st = D.getElementById("css-cerul-theme");
  if (!st) { st = D.createElement("style"); st.id = "css-cerul-theme"; st.textContent = CSS; }
  if (st !== D.head.lastElementChild) D.head.appendChild(st); // mereu ultima foaie → câștigă la egalitate de specificitate
}
if (D) { try { inject(); } catch (e) { /* ignorat */ } }

/* forma citită de cerul-map.js (MAP_THEME) la construirea texturilor */
var MAPTEX = {
  ocean: ["#13457a", "#1a5a97", "#1e66a6", "#1a5a96", "#134679"],
  shelf: ["rgba(52,150,200,.40)", "rgba(70,178,216,.48)", "rgba(110,206,228,.58)"],
  back: "#123f74", pole: "12,40,78",
  landFilter: "contrast(1.16) saturate(1.2) brightness(1.08)"
};
W.CerulTheme = { map: MAPTEX, icon: icon, ic: ic, fromEmoji: fromEmoji, ICONS: Object.keys(P).concat(Object.keys(ALIAS)), COMPANY: COMPANY, MAP: MAP, TOKENS: TOKENS, inject: inject, CSS: CSS };
if (typeof module !== "undefined" && module.exports) module.exports = W.CerulTheme;
})();
