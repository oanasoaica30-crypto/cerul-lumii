/* Cerul Lumii — CerulArt (Contract F). Original SVG art, no external images.
   Built from scratch-cerul/art/src/*.js (cat in order). All builders return SVG strings. */
(function () {
"use strict";
var CA = {};
var G = (typeof window !== "undefined") ? window : (typeof globalThis !== "undefined" ? globalThis : {});
var HAS_DOM = typeof document !== "undefined";
CA.reduced = !!(HAS_DOM && G.matchMedia && G.matchMedia("(prefers-reduced-motion: reduce)").matches);

var _n = 0;
function uid(p) { _n = (_n + 1) % 1e9; return "ca" + (p || "") + _n.toString(36) + Math.floor(Math.random() * 1296).toString(36); }
function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
function hash(s) { s = String(s || ""); var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function rngFrom(seed) { var a = seed >>> 0 || 1; return function () { a = (a + 0x6D2B79F5) | 0; var t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function noDia(s) { return String(s || "").toLowerCase().replace(/[ăâ]/g, "a").replace(/î/g, "i").replace(/[șş]/g, "s").replace(/[țţ]/g, "t"); }

function parseHex(h) {
  h = String(h || "#888").trim();
  if (h[0] !== "#") return [136, 136, 136];
  if (h.length === 4) h = "#" + h[1] + h[1] + h[2] + h[2] + h[3] + h[3];
  var n = parseInt(h.slice(1, 7), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function toHex(r) { return "#" + r.map(function (v) { v = Math.max(0, Math.min(255, Math.round(v))); return (v < 16 ? "0" : "") + v.toString(16); }).join(""); }
function shade(hex, k) { var c = parseHex(hex), t = k < 0 ? 0 : 255, a = Math.abs(k); return toHex(c.map(function (v) { return v + (t - v) * a; })); }
function mix(a, b, t) { var x = parseHex(a), y = parseHex(b); return toHex(x.map(function (v, i) { return v + (y[i] - v) * t; })); }
function lum(hex) { var c = parseHex(hex); return (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255; }
CA.shade = shade; CA.mix = mix;

/* colour argument: "#hex", index into CerulData.COLORS, or {c|color|hex} */
function col(c, def) {
  if (c == null || c === "") return def || "#ff8a4c";
  if (typeof c === "number") {
    var D = G.CerulData, L = D && D.COLORS;
    var e = L && L[c]; if (e) return typeof e === "string" ? e : (e.c || e.color || e.hex || def || "#ff8a4c");
    return ["#ff8a4c", "#3fb7e8", "#5fd17a", "#c86bff", "#ffd35c", "#ff5d7a"][c % 6];
  }
  if (typeof c === "object") return c.c || c.color || c.hex || def || "#ff8a4c";
  return String(c);
}
CA._col = col;
function svgWrap(vb, w, h, inner, cls, extra) {
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + vb + '" width="' + w + '" height="' + h + '"' + (cls ? ' class="' + cls + '"' : "") + (extra || "") + ' aria-hidden="true">' + inner + "</svg>";
}


/* =========================================================== AVATARS (v2 — fix round 1)
   Bust portraits, viewBox 200×200. One key light from the upper-left for every part (face, hair, clothes, hand):
   flat base colors + a shared shading overlay, so all 10 people read as one consistent cast.
   Proportions: head ≈ 70 wide / 98 tall, neck ≈ 0.55 (m) / 0.44 (f) of face width, shoulders ≈ 2.3× (m) / 2.0× (f) face width. */
var SKIN = {
  light: ["#f4cfb0", "#dfac8a", "#c08a68"]
};
function r1(v) { return Math.round(v * 10) / 10; }
function P() { var s = ""; for (var i = 0; i < arguments.length; i += 2) s += (i ? " " : "") + r1(arguments[i]) + " " + r1(arguments[i + 1]); return s; }

var AV = [
  { id: 0, g: "m", name: "Victor", style: "Magnat sigur pe el", skin: "#e8b48f", hair: "#3b2a20", hs: "slick", temples: "#a8a29c", beard: "short",
    out: "suit3", c1: "#1f2a44", c2: "#d4af37", iris: "#4a3020", bg: ["#2b4a86", "#0f1a36"],
    face: { cw: 35, fw: 33, jw: 31, jy: 119, chw: 13, cy: 135 }, nose: "aquiline", brow: { th: 3.8, arch: 1.5, y: 77 }, mw: 12.5, lipU: 2.4, lipL: 3.2, age: 1, nw: 20, sx: 81 },
  { id: 1, g: "m", name: "Andrei", style: "Fost pilot devenit antreprenor", skin: "#f1c6a5", hair: "#8a5a2b", hs: "messy", aviators: 1, dimples: 1,
    out: "pilotshirt", c1: "#f4f6fa", c2: "#2c4a7a", iris: "#4f6f3a", bg: ["#3a78b8", "#102a4a"],
    face: { cw: 34, fw: 33, jw: 27.5, jy: 118, chw: 10.5, cy: 134 }, nose: "straight", brow: { th: 3.2, arch: 2.5, y: 77 }, mw: 12, lipU: 2.5, lipL: 3.4, nw: 18.5, sx: 80, ear: 1.05 },
  { id: 2, g: "m", name: "Kwame", style: "Elegant și carismatic", skin: "#7a4a2e", hair: "#16110d", hs: "fade", part: 1, beard: "fine",
    out: "suit", bow: 1, velvet: 1, c1: "#5b2a86", c2: "#22e0d0", iris: "#2a170c", bg: ["#2a8a86", "#0a2a2c"],
    face: { cw: 34, fw: 32, jw: 28.5, jy: 122, chw: 12, cy: 138 }, nose: "broad", brow: { th: 3.4, arch: 2, y: 77 }, mw: 13.5, lipU: 3.4, lipL: 4.2, nw: 19.5, sx: 82 },
  { id: 3, g: "m", name: "Hiro", style: "Tehnocrat minimalist", skin: "#f0d0a8", hair: "#121212", hs: "swept", glasses: "round", mono: 1,
    out: "turtleblazer", c1: "#2c3540", c2: "#15161a", iris: "#2b1c12", bg: ["#a33b6f", "#2a0c1f"],
    face: { cw: 33, fw: 32, jw: 26, jy: 118, chw: 9.5, cy: 133 }, nose: "small", brow: { th: 3, arch: 0.8, y: 78 }, mw: 11.5, lipU: 2.4, lipL: 3.2, nw: 17.5, sx: 77 },
  { id: 4, g: "m", name: "Matei", style: "Moșier jovial", skin: "#dca482", hair: "#d2d2d0", hs: "receding", beard: "walrus", rosy: 1, age: 2,
    out: "tweed", c1: "#6b3a1f", c2: "#7da83a", iris: "#4a6a8a", bg: ["#6f8a2a", "#1e2808"],
    face: { cw: 37, fw: 34, jw: 34, jy: 117, chw: 15, cy: 135 }, nose: "bulb", brow: { th: 4.4, arch: 2, y: 76, bushy: 1 }, mw: 13, lipU: 2.2, lipL: 3.4, nw: 21.5, sx: 85, ear: 1.12 },
  { id: 5, g: "f", name: "Ioana", style: "Directoare energică", skin: "#f3c9a8", hair: "#7a3a1e", hs: "bunloose", freckles: 1,
    out: "blazerF", c1: "#b0263c", c2: "#f4efe6", iris: "#4a6b3f", ear: "gold", lips: "#c4454f", bg: ["#c79a2a", "#3a2604"],
    face: { cw: 33.5, fw: 32.5, jw: 24, jy: 116, chw: 8, cy: 131 }, nose: "button", brow: { th: 2.6, arch: 2.6, y: 77 }, mw: 11, lipU: 3, lipL: 4, nw: 14.5, sx: 69 },
  { id: 6, g: "f", name: "Elena", style: "Bancheră rafinată", skin: "#e9bd9a", hair: "#1c1c22", hs: "bob", pearls: 1, mole: 1, age: 1,
    out: "suitF", c1: "#1b2b3a", c2: "#f1ece2", iris: "#3a2a1a", ear: "pearl", lips: "#b4505a", smugBrow: 1, bg: ["#1f8f88", "#06302d"],
    face: { cw: 32, fw: 31, jw: 25.5, jy: 119, chw: 8.5, cy: 134 }, nose: "fine", brow: { th: 2.5, arch: 3.4, y: 77 }, mw: 11, lipU: 2.6, lipL: 3.6, nw: 14, sx: 68 },
  { id: 7, g: "f", name: "Amara", style: "Fondatoare de startup", skin: "#6b3f26", hair: "#15100c", hs: "afro", bandana: "#f4f1ea",
    out: "bomber", c1: "#e2702b", c2: "#ffffff", iris: "#2a170c", ear: "hoop", lips: "#7a3b3a", bg: ["#3a5fc8", "#0d1a48"],
    face: { cw: 34, fw: 32, jw: 27, jy: 115, chw: 10, cy: 130 }, nose: "broadF", brow: { th: 2.8, arch: 2.4, y: 77 }, mw: 12.5, lipU: 3.6, lipL: 4.6, nw: 15, sx: 70 },
  { id: 8, g: "f", name: "Mei", style: "Strategă elegantă", skin: "#f2d4b5", hair: "#0f0f12", hs: "straightbangs", clip: 1, glasses: "thin", mono: 1,
    out: "wrap", c1: "#2f6f5e", iris: "#2b1c12", ear: "stud", lips: "#cf5f6a", bg: ["#d0782a", "#3a1a04"],
    face: { cw: 33, fw: 31.5, jw: 25.5, jy: 117, chw: 9, cy: 131 }, nose: "smallF", brow: { th: 2.4, arch: 1.4, y: 77 }, mw: 10.5, lipU: 2.8, lipL: 3.8, nw: 13.5, sx: 67 },
  { id: 9, g: "f", name: "Sofia", style: "Matriarha aviației", skin: "#e4b28c", hair: "#dcdcdc", hs: "pixie", glasses: "cat", chain: 1, age: 2,
    out: "coat", c1: "#4b2c5e", c2: "#b48cff", iris: "#5b7aa0", ear: "pearl", lips: "#a8505e", bg: ["#6c4aa8", "#1c0f33"],
    face: { cw: 33, fw: 31, jw: 27.5, jy: 118, chw: 10.5, cy: 133 }, nose: "fineLong", brow: { th: 2.4, arch: 3, y: 77 }, mw: 11, lipU: 2.1, lipL: 3.2, nw: 14.5, sx: 66 }
];
function avMeta() {
  var D = G.CerulData, L = D && D.AVATARS;
  return AV.map(function (a, i) {
    var m = L && L[i] || {};
    return { id: a.id, g: m.g || m.gender || a.g, name: m.name || m.n || a.name, style: m.style || m.desc || a.style };
  });
}
Object.defineProperty(CA, "AVATARS", { get: avMeta, enumerable: true });

var MOODS = ["neutral", "happy", "angry", "smug", "thinking", "sad"];
CA.MOODS = MOODS;
function mirror(s) { return '<g transform="translate(200 0) scale(-1 1)">' + s + "</g>"; }

/* ---- geometry ---- */
function geom(a) {
  var f = a.g === "f", F = a.face || {};
  var g = {
    f: f, T: 38, EY: 88, ED: 15,
    cw: F.cw || (f ? 33 : 34.5), fw: F.fw || (f ? 31.5 : 33), jw: F.jw || (f ? 25 : 29), jy: F.jy || 118, chw: F.chw || (f ? 8.5 : 11), cy: F.cy || (f ? 132 : 135),
    nw: a.nw || (f ? 14.5 : 19.5), sx: a.sx || (f ? 68 : 80)
  };
  g.nb = g.nw + (f ? 5 : 6);
  g.ny = f ? 149 : 147;          // neck base (where trapezius starts)
  g.sy = f ? 168 : 166;          // shoulder point height
  var N = { straight: [7.6, 106], aquiline: [8, 107.5], broad: [10.6, 106.5], broadF: [9.4, 105.5], small: [7, 105], smallF: [6.4, 104.5], button: [6.6, 104.5], bulb: [10, 108], fine: [6.6, 105.5], fineLong: [6.8, 106.5] }[a.nose || "straight"] || [7.5, 106];
  g.nosW = N[0]; g.nosY = N[1];
  g.MY = Math.round((g.nosY + g.cy) / 2 + 0.5) - 3.5; // mouth line ≈ 1/3 between nose and chin
  g.mw = a.mw || (f ? 11 : 12.5);
  return g;
}
function headD(g) {
  var c = 100, T = g.T, E = g.EY;
  return "M100 " + T +
    "C" + P(c + g.fw * 0.62, T, c + g.fw, T + 11, c + g.fw + 0.6, T + 27) +
    "C" + P(c + g.fw + 1.2, T + 39, c + g.cw, E - 9, c + g.cw, E + 2) +
    "C" + P(c + g.cw, E + 15, c + g.jw + 3.5, g.jy - 10, c + g.jw, g.jy) +
    "C" + P(c + g.jw - 2.5, g.jy + 6.5, c + g.chw + 4.5, g.cy - 2.5, c + g.chw, g.cy - 0.8) +
    "Q" + P(c, g.cy + 1.8, c - g.chw, g.cy - 0.8) +
    "C" + P(c - g.chw - 4.5, g.cy - 2.5, c - g.jw + 2.5, g.jy + 6.5, c - g.jw, g.jy) +
    "C" + P(c - g.jw - 3.5, g.jy - 10, c - g.cw, E + 15, c - g.cw, E + 2) +
    "C" + P(c - g.cw, E - 9, c - g.fw - 1.2, T + 39, c - g.fw - 0.6, T + 27) +
    "C" + P(c - g.fw, T + 11, c - g.fw * 0.62, T, 100, T) + "Z";
}
function bodyD(g) {
  var L = 100 - g.sx, R = 100 + g.sx, nb = g.nb, ny = g.ny, sy = g.sy;
  return "M" + P(100 - nb, ny - 3) +
    "C" + P(100 - nb - 11, ny + 3, L + 19, sy - 8, L + 5, sy - 2) +
    "C" + P(L - 3, sy + 1, L - 7, sy + 11, L - 7, sy + 25) +
    "L" + P(L - 6, 216, R + 6, 216, R + 7, sy + 25) +
    "C" + P(R + 7, sy + 11, R + 3, sy + 1, R - 5, sy - 2) +
    "C" + P(R - 19, sy - 8, 100 + nb + 11, ny + 3, 100 + nb, ny - 3) + "Z";
}
function neckD(g) {
  var nw = g.nw, ny = g.ny;
  return "M" + P(100 - nw, g.jy - 12) + "C" + P(100 - nw + 0.6, ny - 18, 100 - nw - 0.5, ny - 7, 100 - nw - 8, ny + 1) +
    "L" + P(100 + nw + 8, ny + 1) + "C" + P(100 + nw + 0.5, ny - 7, 100 + nw - 0.6, ny - 18, 100 + nw, g.jy - 12) + "Z";
}

/* ---- shared defs: skin gradient + light overlay ---- */
function lightDefs(id) {
  // one overlay for everything: highlight upper-left, shadow lower-right
  return '<linearGradient id="' + id + 'L" gradientUnits="userSpaceOnUse" x1="58" y1="40" x2="146" y2="120"><stop offset="0" stop-color="#fff" stop-opacity=".16"/><stop offset=".42" stop-color="#fff" stop-opacity="0"/><stop offset=".68" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".26"/></linearGradient>' +
    '<linearGradient id="' + id + 'B" gradientUnits="userSpaceOnUse" x1="20" y1="150" x2="190" y2="205"><stop offset="0" stop-color="#fff" stop-opacity=".12"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/><stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".32"/></linearGradient>' +
    '<linearGradient id="' + id + 'H" gradientUnits="userSpaceOnUse" x1="62" y1="24" x2="140" y2="110"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset=".4" stop-color="#fff" stop-opacity="0"/><stop offset=".62" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".35"/></linearGradient>';
}

/* ---- hair (drawn for a standard head cw=34 and stretched horizontally to the real head width) ---- */
function hairLayers(a, g, H, Hd, Hl, id) {
  var back = "", front = "", hs = a.hs, k = (g.cw / 34).toFixed(3);
  var st = function (d, w, o, c) { return '<path d="' + d + '" fill="none" stroke="' + (c || Hl) + '" stroke-width="' + (w || 1.4) + '" stroke-linecap="round" opacity="' + (o || .5) + '"/>'; };
  var fl = function (d, c, extra) { return '<path d="' + d + '" fill="' + (c || H) + '"' + (extra || "") + "/>"; };
  var ov = function (d) { return '<path d="' + d + '" fill="url(#' + id + 'H)"/>'; };
  if (hs === "slick") {
    var d = "M65.5 86C63 70 63 54 72 42C80 31 92 26 102 26C116 26 128 32 134 43C139 53 138 70 134.5 86L132 86C131.5 76 131 68 128 62C122 56 112 53 100 53C90 53 80 55 73 61C69.5 67 68.5 76 68 86Z";
    front = fl(d) + ov(d) +
      '<path d="M73 61C80 55 90 53 100 53C112 53 122 56 128 62C122 54 112 50 100 50C88 50 78 54 73 61Z" fill="' + Hd + '"/>' +
      st("M76 56C84 44 98 36 116 35", 1.5, .55) + st("M84 53C92 44 106 39 124 41", 1.3, .45) + st("M96 51C104 44 116 43 128 48", 1.2, .4) + st("M70 64C72 52 80 42 92 36", 1.3, .4);
    if (a.temples) front += '<path d="M65.5 86C64 76 64.5 70 66.5 64C68 62 70 62 71.5 63C69.5 69 68.5 77 68.2 86Z" fill="' + a.temples + '"/><path d="M134.5 86C136 76 135.5 70 133.5 64C132 62 130 62 128.5 63C130.5 69 131.5 77 131.8 86Z" fill="' + a.temples + '"/>' +
      st("M67 72q1 -5 3 -8M133 72q-1 -5 -3 -8", 1, .6, "#d8d4cf");
  } else if (hs === "messy") {
    back = fl("M64 92C58 66 66 36 98 30C130 26 144 56 136 92Z", Hd);
    var dm = "M64.5 90C60 70 63 48 74 38C70 30 80 26 86 30C90 22 102 22 106 28C112 22 124 24 126 32C134 32 140 42 137 52C140 64 138 78 135.5 90L133 88C132 78 130 70 126 66C124 70 118 70 116 64C112 70 104 70 102 62C98 70 90 72 86 66C82 72 74 70 72 64C69 70 68 80 67.5 90Z";
    front = fl(dm) + ov(dm) +
      fl("M86 66C88 74 94 76 96 68C94 72 90 72 88 64Z", Hd) + fl("M104 64C106 72 112 74 114 66C112 70 108 70 106 62Z", Hd) +
      st("M76 46q8 -10 18 -6q8 -8 18 -2q8 -4 14 4", 1.6, .6) + st("M72 58q6 -8 14 -6", 1.3, .5) + st("M112 50q10 -2 16 8", 1.3, .5) + st("M90 58q6 -6 12 -2", 1.2, .45);
  } else if (hs === "fade") {
    var dk = "M65.5 84C64 62 74 40 100 38C126 40 136 62 134.5 84C133.5 74 132 66 129 61L128.5 56C120 52.5 110 51.5 100 51.5C90 51.5 80 52.5 71.5 56L71 61C68 66 66.5 74 65.5 84Z";
    var pid = id + "cp";
    front = '<pattern id="' + pid + '" width="3.2" height="3.2" patternUnits="userSpaceOnUse"><circle cx="1.6" cy="1.6" r=".7" fill="' + Hl + '" opacity=".28"/></pattern>' +
      fl(dk) + '<path d="' + dk + '" fill="url(#' + pid + ')"/>' + ov(dk) +
      '<path d="M65.5 84C65.5 76 66.5 70 68.5 65L71 61C69.5 68 68.5 76 68.3 84Z M134.5 84C134.5 76 133.5 70 131.5 65L129 61C130.5 68 131.5 76 131.7 84Z" fill="' + H + '" opacity=".55"/>';
    if (a.part) front += '<path d="M80 43Q84 47 85 54" stroke="' + shade(a.skin, -0.05) + '" stroke-width="1.3" fill="none" opacity=".8" stroke-linecap="round"/>';
  } else if (hs === "swept") {
    back = fl("M63 94C58 62 70 32 102 30C132 30 144 60 137 94Z", Hd);
    var dw = "M64.5 92C60 66 66 40 86 32C100 27 120 28 132 38C140 46 140 66 136 90L133.5 86C133 76 132 68 129 63C124 60 118 59 112 60C104 64 94 70 84 74C78 76 72 78 68 80C67 84 66.8 88 66.8 92Z";
    front = fl(dw) + ov(dw) + fl("M84 74C96 68 108 60 120 58C110 60 98 66 88 66C80 68 74 72 70 78C74 77 79 76 84 74Z", Hd) +
      st("M72 70C86 56 106 46 130 46", 1.6, .55) + st("M70 58C84 44 104 38 126 38", 1.4, .45) + st("M90 64C102 56 114 52 128 53", 1.2, .4);
  } else if (hs === "receding") {
    // bald crown with a soft shine; white hair at the sides and back
    back = fl("M62 96C58 82 60 70 64 62C62 76 64 88 68 98Z", Hd);
    front = '<ellipse cx="90" cy="46" rx="14" ry="6" fill="#fff" opacity=".22" transform="rotate(-16 90 46)"/>' +
      fl("M63.5 96C61 84 61 72 65 62C67 58 70 56 73 57C70 62 69.5 70 70 78C70 84 69 90 68 96Z") +
      fl("M136.5 96C139 84 139 72 135 62C133 58 130 56 127 57C130 62 130.5 70 130 78C130 84 131 90 132 96Z") +
      fl("M66 66C62 60 64 54 70 52C70 58 70 62 68 68Z", Hl) + fl("M134 66C138 60 136 54 130 52C130 58 130 62 132 68Z", H) +
      st("M66 84q-1 -12 4 -22M134 84q1 -12 -4 -22", 1.1, .5, shade(H, -0.25)) + st("M94 40q6 -2 12 0", 1, .35, H);
  } else if (hs === "bunloose") {
    back = fl("M62 100C56 64 70 34 100 32C130 34 144 64 138 100L136 116C134 106 132 98 130 92L70 92C68 98 66 106 64 116Z", Hd) +
      '<circle cx="107" cy="37" r="14" fill="' + Hd + '"/><circle cx="105.5" cy="35" r="13" fill="' + H + '"/>' +
      st("M95 33C100 24 113 24 117 34", 1.3, .55) + st("M96 40C103 33 113 34 117 41", 1.2, .45) + '<path d="M116 27q8 -6 12 2" stroke="' + H + '" stroke-width="2.2" fill="none" stroke-linecap="round"/>';
    var db = "M64.5 92C60 62 74 38 100 37C126 38 140 62 135.5 92C134 78 130 68 124 62C116 56 108 54 100 54C96 58 86 60 78 64C72 70 68 80 67.5 92Z";
    front = fl(db) + ov(db) +
      fl("M66 84C61 98 62 112 67 124C65.5 110 67 98 70.5 88Z") + fl("M134 84C139 98 138 112 133 124C134.5 110 133 98 129.5 88Z") +
      st("M74 62C84 54 96 52 104 54", 1.3, .55) + st("M104 54C118 54 128 62 133 76", 1.3, .5) + st("M82 46C94 40 110 40 122 46", 1.2, .5) + st("M66.5 92q-3 14 1 28", 1.1, .5) + st("M133.5 92q3 14 -1 28", 1.1, .5);
  } else if (hs === "bob") {
    // glossy blunt bob, side part; tucked behind the (viewer's) left ear
    back = fl("M60 96C54 58 72 32 100 32C128 32 146 58 140 96L142 124C142 128 138 129 134 129L66 129C62 129 59 127 60 122Z", Hd);
    var dbo = "M68.5 108C64 92 64 70 70 58C78 42 92 36 104 36C124 36 140 52 140 80L141 124C141 127 139 128 136 128L128 128C130 116 130 100 128 88C126 76 120 66 110 60C100 56 86 58 78 64C74 70 72 86 72 108Z";
    front = fl(dbo) + ov(dbo) +
      '<path d="M86 40C104 34 124 42 134 60C130 52 118 44 104 44C96 44 90 46 86 48Z" fill="#fff" opacity=".18"/>' +
      st("M110 60C122 70 128 88 128 120", 1.3, .35) + st("M118 50C132 62 136 84 136 122", 1.2, .3) + st("M78 64C82 58 92 56 100 56", 1.3, .4) +
      '<path d="M128 128L141 128" stroke="' + shade(H, 0.3) + '" stroke-width="1" opacity=".5"/>';
  } else if (hs === "afro") {
    var da = bumps(100, 64, 58, 50, 20, 4.5, Math.PI * 0.74, Math.PI * 2.26) + "Z";
    back = fl(da) + '<path d="' + da + '" fill="url(#' + id + 'H)"/>';
    for (var i = 0; i < 34; i++) { var r = rngFrom(i * 977 + 3); var ang = Math.PI * (0.78 + 1.44 * r()), rad = 24 + r() * 30; back += '<circle cx="' + r1(100 + Math.cos(ang) * rad) + '" cy="' + r1(64 + Math.sin(ang) * rad * 0.86) + '" r="' + r1(2 + r() * 2.4) + '" fill="none" stroke="' + Hl + '" stroke-width=".8" opacity=".16"/>'; }
    front = fl("M65.5 86C65 66 76 50 100 49C124 50 135 66 134.5 86C132 72 124 62 112 59C104 60 96 60 88 59C76 62 68 72 65.5 86Z");
  } else if (hs === "straightbangs") {
    back = fl("M60 92C54 52 76 30 100 30C124 30 146 52 140 92L148 204L52 204Z", Hd);
    var ds = "M65 96C60 56 78 34 100 34C122 34 140 56 135 96L132.5 74C120 75 108 74 100 72C92 74 80 75 67.5 74Z";
    front = fl(ds) + ov(ds) +
      fl("M65 92C61 130 64 166 58 204L76 204C72 168 70 130 69 98Z") + fl("M135 92C139 130 136 166 142 204L124 204C128 168 130 130 131 98Z") +
      '<path d="M68 74L71 62M79 75L81 60M90 74L91 58M101 72L101 56M112 74L111 58M122 75L120 60M131 74L129 62" stroke="' + Hl + '" stroke-width="1.1" opacity=".3" stroke-linecap="round"/>' +
      '<path d="M78 42C94 36 112 36 124 44" stroke="#fff" stroke-opacity=".2" stroke-width="3" fill="none" stroke-linecap="round"/>' +
      st("M63 120C63 146 64 170 60 198", 1.1, .35) + st("M137 120C137 146 136 170 140 198", 1.1, .35);
  } else if (hs === "pixie") {
    var dp = "M64.5 92C59 66 66 40 90 33C110 28 130 34 137 50C141 62 138 78 135.5 92L133 86C132.5 76 131 68 126 62C120 58 110 58 102 62C94 60 84 64 78 66C72 72 69 80 67.5 92Z";
    front = fl(dp) + ov(dp) +
      fl("M78 66C84 56 96 50 110 52C100 54 92 58 86 66Z", Hl) +
      st("M74 54Q92 36 120 40", 1.5, .7, "#fff") + st("M72 64Q86 48 108 48", 1.3, .55, "#fff") + st("M126 46Q136 56 136 72", 1.3, .5, shade(H, -0.3)) + st("M96 60Q108 54 124 60", 1.2, .5, shade(H, -0.3));
  } else if (hs === "side") {
    var dsd = "M65 90C62 64 70 40 98 35C126 32 140 56 135 90L132.5 86C132 74 128 64 120 58C108 56 92 60 80 58C74 64 70 74 67.5 90Z";
    front = fl(dsd) + ov(dsd) + '<path d="M80 58C90 52 104 50 120 58C108 52 94 50 80 58Z" fill="' + Hd + '"/>' + st("M76 46C90 38 112 38 128 48", 1.4, .55) + st("M84 56C96 46 116 46 128 54", 1.2, .45);
  }
  if (a.bandana) front += '<path d="M65 76Q100 44 135 76L134 84Q100 54 66 84Z" fill="' + a.bandana + '"/><g fill="' + (a.c1 || "#e2702b") + '"><circle cx="78" cy="70" r="1.5"/><circle cx="90" cy="63" r="1.5"/><circle cx="102" cy="61" r="1.5"/><circle cx="114" cy="63" r="1.5"/><circle cx="126" cy="70" r="1.5"/></g><path d="M134 78l9 -7l3 8Z" fill="' + a.bandana + '"/><path d="M65 76Q100 44 135 76" stroke="#000" stroke-opacity=".12" fill="none"/>';
  var tf = function (s) { return s ? '<g transform="translate(100 0) scale(' + k + ' 1) translate(-100 0)">' + s + "</g>" : ""; };
  return { back: tf(back), front: tf(front) };
}
function bumps(cx, cy, rx, ry, n, amp, a0, a1) {
  var pts = [], d;
  for (var i = 0; i <= n; i++) { var t = a0 + (a1 - a0) * i / n; pts.push([cx + Math.cos(t) * rx, cy + Math.sin(t) * ry]); }
  d = "M" + r1(pts[0][0]) + " " + r1(pts[0][1]);
  for (i = 1; i < pts.length; i++) {
    var p = pts[i - 1], q = pts[i], mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2, nx = mx - cx, ny = my - cy, l = Math.sqrt(nx * nx + ny * ny) || 1;
    d += "Q" + r1(mx + nx / l * amp) + " " + r1(my + ny / l * amp) + " " + r1(q[0]) + " " + r1(q[1]);
  }
  return d;
}

/* ---- eyes ---- */
var EYEM = {
  neutral: { up: 6, lo: 4.1, ti: 0, to: 0, lx: 0, ly: 0 },
  happy: { up: 5.2, lo: 1.4, ti: 0, to: 0, lx: 0, ly: 0, smile: 1 },
  angry: { up: 3.6, lo: 3.6, ti: -2.6, to: 1.2, lx: 0, ly: 0.6 },
  smug: { up: 3, lo: 3.2, ti: 0, to: 0, lx: 1.6, ly: 0.4 },
  thinking: { up: 6.2, lo: 3.9, ti: 0, to: 0, lx: -2.6, ly: -2.4 },
  sad: { up: 5, lo: 4.3, ti: 1, to: -2.4, lx: -0.4, ly: 1.6 }
};
function eyePair(a, g, mood, sk, id) {
  var m = EYEM[mood], f = g.f, s = "", W = (a.eyeW || (a.mono ? 8.4 : 8.6)), lidC = "#2a1a12";
  [-1, 1].forEach(function (side) {
    var ex = 100 + side * g.ED, ey = g.EY, o = side; // o: direction of the OUTER corner
    var up = m.up * (a.mono ? 0.9 : 1), lo = m.lo;
    var ti = m.ti, to = m.to;
    if (mood === "smug" && side === 1) up += 0.6;
    var Ox = ex + o * W, Oy = ey + (f ? -0.6 : 0), Ix = ex - o * W * 0.92, Iy = ey + 0.9;
    var upD = "M" + P(Ox, Oy) + "C" + P(ex + o * W * 0.45, ey - (up - to) * 1.33, ex - o * W * 0.4, ey - (up - ti) * 1.33, Ix, Iy);
    var loD = "C" + P(ex - o * W * 0.4, ey + lo * 1.25, ex + o * W * 0.5, ey + lo * 1.2, Ox, Oy);
    var cid = id + "e" + (side < 0 ? "l" : "r");
    // socket shade
    s += '<ellipse cx="' + r1(ex + side * 0.5) + '" cy="' + (ey - 3) + '" rx="' + (W + 3.5) + '" ry="7.5" fill="' + sk[2] + '" opacity=".22"/>';
    s += '<clipPath id="' + cid + '"><path d="' + upD + loD + 'Z"/></clipPath><path d="' + upD + loD + 'Z" fill="#f7f2ec"/>';
    var irx = ex + m.lx, iry = ey + m.ly + 0.3, ir = W * 0.5;
    s += '<g clip-path="url(#' + cid + ')"><circle cx="' + r1(irx) + '" cy="' + r1(iry) + '" r="' + r1(ir) + '" fill="' + a.iris + '"/><circle cx="' + r1(irx) + '" cy="' + r1(iry) + '" r="' + r1(ir) + '" fill="none" stroke="#000" stroke-opacity=".35" stroke-width=".9"/>' +
      '<circle cx="' + r1(irx) + '" cy="' + r1(iry) + '" r="' + r1(ir * 0.46) + '" fill="#0b0806"/>' +
      '<path d="' + upD + '" fill="none" stroke="#000" stroke-opacity=".22" stroke-width="3.4"/></g>' +
      '<circle cx="' + r1(irx - 1.5) + '" cy="' + r1(iry - 1.7) + '" r="1.25" fill="#fff" opacity=".95"/>';
    // upper lid line (+ lashes for women)
    s += '<path d="' + upD + '" fill="none" stroke="' + lidC + '" stroke-width="' + (f ? 2.3 : 1.8) + '" stroke-linecap="round"/>';
    if (f) s += '<path d="M' + P(Ox, Oy) + "q" + P(o * 2.6, -0.6) + " " + P(o * 3.6, -2.6) + '" fill="none" stroke="' + lidC + '" stroke-width="1.5" stroke-linecap="round"/>';
    // crease / fold
    if (!a.mono && mood !== "smug") s += '<path d="M' + P(ex + o * W * 0.85, ey - 2.2) + "C" + P(ex + o * W * 0.4, ey - (up - to) * 1.33 - 3.2, ex - o * W * 0.35, ey - (up - ti) * 1.33 - 3.2, ex - o * W * 0.8, ey - 1.6) + '" fill="none" stroke="' + sk[2] + '" stroke-width="1" opacity=".6"/>';
    else s += '<path d="M' + P(ex - o * W * 0.95, ey + 0.4) + "q" + P(o * 1.6, -1.6) + " " + P(o * 3.4, -2) + '" fill="none" stroke="' + sk[2] + '" stroke-width=".9" opacity=".55"/>';
    // lower lid
    if (m.smile) s += '<path d="M' + P(Ix + o * 1, Iy) + "Q" + P(ex, ey + 3.4) + " " + P(Ox - o * 0.6, Oy + 0.4) + '" fill="none" stroke="' + sk[2] + '" stroke-width="1.3" opacity=".75"/>' +
      '<path d="M' + P(ex - 6, ey + 6.5) + "Q" + P(ex, ey + 9) + " " + P(ex + 6, ey + 6.5) + '" fill="none" stroke="' + sk[2] + '" stroke-width="1" opacity=".45"/>';
    else s += '<path d="M' + P(Ix + o * 1.2, Iy + 0.4) + "C" + P(ex - o * W * 0.35, ey + lo * 1.25, ex + o * W * 0.45, ey + lo * 1.2, Ox - o * 0.4, Oy + 0.3) + '" fill="none" stroke="' + sk[2] + '" stroke-width=".9" opacity=".55"/>';
    // age: bags + crow's feet
    if (a.age) {
      s += '<path d="M' + P(ex - 6, ey + 7.5) + "Q" + P(ex + o * 1, ey + 10.5) + " " + P(ex + o * 7, ey + 6.5) + '" fill="none" stroke="' + sk[2] + '" stroke-width="1" opacity="' + (a.age > 1 ? .6 : .35) + '"/>';
      s += '<path d="M' + P(Ox + o * 2.4, Oy - 1.5) + "l" + P(o * 4, -1.6) + "M" + P(Ox + o * 2.8, Oy + 1) + "l" + P(o * 4.4, 0.6) + (a.age > 1 ? "M" + P(Ox + o * 2.2, Oy + 3.4) + "l" + P(o * 3.6, 2.4) : "") + '" stroke="' + sk[2] + '" stroke-width=".9" stroke-linecap="round" opacity=".6"/>';
    }
  });
  return s;
}

/* ---- brows ---- */
function browPair(a, g, mood, H) {
  var B = a.brow || {}, th = B.th || (g.f ? 2.5 : 3.4), by = B.y || 77, ar = B.arch || 2, s = "";
  var col = lum(H) > 0.6 ? shade(H, -0.42) : lum(H) > 0.35 ? shade(H, -0.25) : shade(H, -0.05);
  [-1, 1].forEach(function (side) {
    var I = { x: 100 + side * 6.5, y: by + 1.5 }, Pk = { x: 100 + side * 17, y: by - ar }, O = { x: 100 + side * 26.5, y: by + 1.5 };
    var di = 0, dp = 0, do_ = 0, dx = 0;
    if (mood === "happy") { di = -2.6; dp = -3; do_ = -2; }
    else if (mood === "angry") { di = 5.2; dp = 1.4; do_ = -1.4; dx = -1.6; }
    else if (mood === "sad") { di = -5; dp = -1.6; do_ = 2.2; }
    else if (mood === "smug") { if (side === 1) { di = -3; dp = -5; do_ = -2.5; } else { di = 1.4; dp = 0.6; do_ = 0.6; } }
    else if (mood === "thinking") { if (side === -1) { di = -3.2; dp = -4; do_ = -1.5; } else { di = 1.6; dp = 0.8; do_ = 0.6; } }
    else if (a.smugBrow && side === 1) { di = -1; dp = -3; do_ = -1.5; }
    I.y += di; I.x += side * dx; Pk.y += dp; O.y += do_;
    var c1 = { x: (I.x + Pk.x) / 2, y: Math.min(I.y, Pk.y) - 0.6 }, c2 = { x: (Pk.x + O.x) / 2 + side * 1, y: Pk.y + 0.4 };
    s += '<path d="M' + P(I.x, I.y) + "Q" + P(c1.x, c1.y, Pk.x, Pk.y) + '" fill="none" stroke="' + col + '" stroke-width="' + th + '" stroke-linecap="round"/>' +
      '<path d="M' + P(Pk.x, Pk.y) + "Q" + P(c2.x, c2.y, O.x, O.y) + '" fill="none" stroke="' + col + '" stroke-width="' + r1(th * 0.68) + '" stroke-linecap="round"/>';
    if (B.bushy) s += '<path d="M' + P(I.x - side * 0.5, I.y + 1) + "l" + P(side * 2, -4) + "M" + P(I.x + side * 4, I.y) + "l" + P(side * 2.5, -4.4) + "M" + P(Pk.x - side * 2, Pk.y + 0.6) + "l" + P(side * 3, -3.6) + "M" + P(Pk.x + side * 3, Pk.y + 0.8) + "l" + P(side * 3.4, -2.6) + '" stroke="' + col + '" stroke-width="1.4" stroke-linecap="round"/>';
  });
  if (mood === "angry") s += '<path d="M97.5 80.5l-.8 5.5M102.5 80.5l.8 5.5" stroke="#000" stroke-opacity=".22" stroke-width="1.1" stroke-linecap="round"/>';
  if (mood === "sad") s += '<path d="M95 72q5 -2 10 0" stroke="#000" stroke-opacity=".12" stroke-width="1" fill="none"/>';
  return s;
}

/* ---- nose ---- */
function noseD(a, g, sk, mood) {
  var w = g.nosW + (mood === "angry" ? 0.8 : 0), y = g.nosY, t = a.nose || "straight", s = "", D = sk[2], DD = shade(sk[2], -0.3);
  // bridge: soft shadow on the right side, highlight on the left
  s += '<path d="M' + P(104.5, g.EY + 1) + "C" + P(105.5, g.EY + 9, 106, y - 9, 100 + w * 0.82, y - 2.6) + '" fill="none" stroke="' + D + '" stroke-width="2.6" stroke-linecap="round" opacity=".32"/>';
  s += '<path d="M' + P(98.6, g.EY + 4) + "L" + P(98.8, y - 6) + '" stroke="#fff" stroke-width="1.8" stroke-linecap="round" opacity=".16"/>';
  if (t === "aquiline") s += '<path d="M' + P(103, g.EY + 6) + "q2.2 3 1.2 6" + '" fill="none" stroke="' + D + '" stroke-width="1.2" opacity=".45"/>';
  // tip + alae
  var tipR = t === "bulb" ? 5.2 : t === "broad" || t === "broadF" ? 4.4 : 3.6;
  if (t === "bulb") s += '<ellipse cx="100.5" cy="' + r1(y - 2) + '" rx="' + r1(tipR + 0.5) + '" ry="' + r1(tipR) + '" fill="#e0706a" opacity=".22"/>';
  s += '<ellipse cx="99.5" cy="' + r1(y - 3) + '" rx="' + r1(tipR * 0.55) + '" ry="' + r1(tipR * 0.45) + '" fill="#fff" opacity=".2"/>';
  s += '<path d="M' + P(100 - w, y - 3.6) + "C" + P(100 - w - 2.6, y - 0.6, 100 - w - 0.8, y + 3.2, 100 - w * 0.5, y + 2.4) + '" fill="none" stroke="' + D + '" stroke-width="1.4" stroke-linecap="round" opacity=".75"/>' +
    '<path d="M' + P(100 + w, y - 3.6) + "C" + P(100 + w + 2.6, y - 0.6, 100 + w + 0.8, y + 3.2, 100 + w * 0.5, y + 2.4) + '" fill="none" stroke="' + D + '" stroke-width="1.6" stroke-linecap="round" opacity=".9"/>';
  // nostrils + underside
  var nr = t === "button" || t === "smallF" ? 1.9 : 2.1;
  s += '<ellipse cx="' + r1(100 - w * 0.44) + '" cy="' + r1(y + 1.6) + '" rx="' + nr + '" ry="1.15" transform="rotate(14 ' + r1(100 - w * 0.44) + " " + r1(y + 1.6) + ')" fill="' + DD + '" opacity=".75"/>' +
    '<ellipse cx="' + r1(100 + w * 0.44) + '" cy="' + r1(y + 1.6) + '" rx="' + nr + '" ry="1.15" transform="rotate(-14 ' + r1(100 + w * 0.44) + " " + r1(y + 1.6) + ')" fill="' + DD + '" opacity=".85"/>';
  s += '<path d="M' + P(100 - w * 0.3, y + 2.8) + "Q" + P(100, y + 4.2, 100 + w * 0.3, y + 2.8) + '" fill="none" stroke="' + D + '" stroke-width="1" opacity=".55"/>';
  s += '<ellipse cx="101.5" cy="' + r1(y + 5.4) + '" rx="' + r1(w * 0.6) + '" ry="1.6" fill="' + D + '" opacity=".22"/>';
  return s;
}

/* ---- mouth ---- */
function mouthD(a, g, mood, sk, idc) {
  var f = g.f, y = g.MY, w = g.mw, up = a.lipU || 2.6, lo = a.lipL || 3.4, s = "";
  var lip = a.lips || mix(sk[1], "#a8484e", g.f ? 0.45 : 0.3), lipD = shade(lip, -0.18), lineC = shade(mix(lip, "#2a0e0e", 0.5), -0.1);
  var dark = "#3a1216", teeth = "#f7f3ec";
  if (mood === "happy") {
    var L = 100 - w - 1.5, R = 100 + w + 1.5, cy = y - 3.2;
    var open = "M" + P(L, cy) + "Q" + P(100, y + 0.6, R, cy) + "Q" + P(100, y + 15, L, cy) + "Z";
    var mid = idc + "hm";
    s += '<clipPath id="' + mid + '"><path d="' + open + '"/></clipPath><path d="' + open + '" fill="' + dark + '"/>' +
      '<g clip-path="url(#' + mid + ')"><path d="M' + P(L, cy - 2) + "L" + P(R, cy - 2) + "L" + P(R - 2, y + 3.4) + "Q" + P(100, y + 5.6, L + 2, y + 3.4) + 'Z" fill="' + teeth + '"/><ellipse cx="100" cy="' + r1(y + 11) + '" rx="' + r1(w * 0.6) + '" ry="4" fill="#c24f58"/></g>';
    s += '<path d="M' + P(L, cy) + "Q" + P(100, y + 0.6 - up * 1.2, R, cy) + "Q" + P(100, y + 0.6, L, cy) + 'Z" fill="' + lipD + '"/>';
    s += '<path d="M' + P(L, cy) + "Q" + P(100, y + 15, R, cy) + "Q" + P(100, y + 15 + lo * 1.3, L, cy) + 'Z" fill="' + lip + '"/>';
    s += '<path d="M' + P(L - 1.5, cy - 2) + "q" + P(1, 1.6, 2.2, 2.2) + "M" + P(R + 1.5, cy - 2) + "q" + P(-1, 1.6, -2.2, 2.2) + '" fill="none" stroke="' + sk[2] + '" stroke-width="1.3" stroke-linecap="round" opacity=".7"/>';
    // smile lines from the nose wings
    if (!a.beard || a.beard === "stache" || a.beard === "walrus") s += '<path d="M' + P(100 - g.nosW - 3, g.nosY + 2) + "Q" + P(L - 4.5, y - 3, L - 2.5, y + 2) + "M" + P(100 + g.nosW + 3, g.nosY + 2) + "Q" + P(R + 4.5, y - 3, R + 2.5, y + 2) + '" fill="none" stroke="' + sk[2] + '" stroke-width="1.1" stroke-linecap="round" opacity=".38"/>';
    return s;
  }
  if (mood === "angry") {
    var L2 = 100 - w - 0.5, R2 = 100 + w + 0.5, yc = y + 3.4;
    var o2 = "M" + P(L2, yc) + "Q" + P(100, y - 5.4, R2, yc) + "Q" + P(100, y + 4.4, L2, yc) + "Z";
    var mid2 = idc + "am";
    s += '<clipPath id="' + mid2 + '"><path d="' + o2 + '"/></clipPath><path d="' + o2 + '" fill="' + dark + '"/><g clip-path="url(#' + mid2 + ')"><rect x="80" y="' + r1(y - 6) + '" width="40" height="5.6" fill="' + teeth + '"/><rect x="80" y="' + r1(y + 0.2) + '" width="40" height="6" fill="#e6e0d6"/>' +
      '<path d="M' + P(94, y - 6, 94, y + 6) + "M" + P(100, y - 6, 100, y + 6) + "M" + P(106, y - 6, 106, y + 6) + '" stroke="#bdb5a8" stroke-width=".7"/></g>';
    s += '<path d="M' + P(L2, yc) + "Q" + P(100, y - 5.4 - up * 1.1, R2, yc) + "Q" + P(100, y - 5.4, L2, yc) + 'Z" fill="' + lipD + '"/>' +
      '<path d="M' + P(L2, yc) + "Q" + P(100, y + 4.4, R2, yc) + "Q" + P(100, y + 4.4 + lo * 1.1, L2, yc) + 'Z" fill="' + lip + '"/>';
    s += '<path d="M' + P(L2 - 1, yc + 1.5) + "l-1.6 2.6M" + P(R2 + 1, yc + 1.5) + 'l1.6 2.6" stroke="' + sk[2] + '" stroke-width="1.2" stroke-linecap="round" opacity=".6"/>';
    return s;
  }
  // closed-mouth moods: corners and center
  var Lx = 100 - w, Rx = 100 + w, Ly = y, Ry = y, cx = 100, cyy = y + 0.8, ul = up, ll = lo;
  if (mood === "smug") { Rx += 2.2; Ry -= 4.4; Ly += 0.4; cx = 101.5; cyy = y + 0.2; }
  else if (mood === "thinking") { Lx = 100 - w * 0.68 - 3; Rx = 100 + w * 0.6 - 3; cx = 97.6; Ly += 0.8; Ry += 0.4; cyy = y + 0.2; ul *= 1.15; ll *= 1.2; }
  else if (mood === "sad") { Ly += 3.6; Ry += 3.6; cyy = y - 0.6; ll *= 1.12; }
  else { Ly -= 0.4; Ry -= 0.4; }
  var mline = "M" + P(Lx, Ly) + "Q" + P(cx, cyy + (mood === "sad" ? -1.6 : 0.6), Rx, Ry);
  // upper lip with cupid's bow
  var uD = "M" + P(Lx, Ly) + "C" + P(Lx + (cx - Lx) * 0.45, Ly - ul * 0.7, cx - 4.4, cyy - ul - 0.4, cx - 2.2, cyy - ul) + "Q" + P(cx, cyy - ul + 1.4, cx + 2.2, cyy - ul) +
    "C" + P(cx + 4.4, cyy - ul - 0.4, Rx - (Rx - cx) * 0.45, Ry - ul * 0.7, Rx, Ry) + "Q" + P(cx, cyy + (mood === "sad" ? -1.6 : 0.6), Lx, Ly) + "Z";
  var lD = "M" + P(Lx, Ly) + "Q" + P(cx, cyy + (mood === "sad" ? -1.6 : 0.6), Rx, Ry) + "C" + P(Rx - (Rx - cx) * 0.35, Ry + ll * 1.2, cx + 4, cyy + ll * 1.35, cx, cyy + ll * 1.35) + "C" + P(cx - 4, cyy + ll * 1.35, Lx + (cx - Lx) * 0.35, Ly + ll * 1.2, Lx, Ly) + "Z";
  s += '<path d="' + uD + '" fill="' + lipD + '"/><path d="' + lD + '" fill="' + lip + '"/>';
  s += '<path d="' + mline + '" fill="none" stroke="' + lineC + '" stroke-width="' + (f ? 1.4 : 1.7) + '" stroke-linecap="round"/>';
  s += '<path d="M' + P(cx - 3.5, cyy + ll * 0.75) + "Q" + P(cx, cyy + ll * 1.05, cx + 3, cyy + ll * 0.75) + '" stroke="#fff" stroke-opacity="' + (f ? .35 : .18) + '" stroke-width="1.1" fill="none" stroke-linecap="round"/>';
  if (mood === "smug") s += '<path d="M' + P(Rx + 1.2, Ry - 2.4) + "q1.8 2.2 .6 4.6" + '" fill="none" stroke="' + sk[2] + '" stroke-width="1.3" stroke-linecap="round" opacity=".75"/>';
  if (mood === "sad") s += '<path d="M' + P(Lx - 1, Ly + 0.4) + "l-1.4 2.4M" + P(Rx + 1, Ry + 0.4) + "l1.4 2.4" + '" stroke="' + sk[2] + '" stroke-width="1.1" stroke-linecap="round" opacity=".6"/><path d="M96 ' + r1(g.cy - 6) + "q4 1.6 8 0" + '" stroke="' + sk[2] + '" stroke-width="1" fill="none" opacity=".5"/>';
  if (mood === "neutral" || mood === "thinking") s += '<path d="M' + P(100 - 4, y + ll * 1.35 + 3.2) + "Q" + P(100, y + ll * 1.35 + 4.6, 104, y + ll * 1.35 + 3.2) + '" fill="none" stroke="' + sk[2] + '" stroke-width="1" opacity=".35"/>';
  return s;
}

/* ---- beards ---- */
function beardD(a, g, H, Hd, mood, id) {
  if (!a.beard) return "";
  var b = a.beard, y = g.MY, s = "";
  if (b === "short" || b === "fine") {
    var cid = id + "bd", hp = headD({ T: g.T, EY: g.EY, cw: g.cw + 1.2, fw: g.fw + 1, jw: g.jw + 1.5, jy: g.jy + 1, chw: g.chw + 1.2, cy: g.cy + (b === "short" ? 3 : 1.6) });
    var Bc = b === "short" ? mix(H, a.skin, 0.12) : H;
    s += '<clipPath id="' + cid + '"><path d="' + hp + '"/></clipPath><g clip-path="url(#' + cid + ')">';
    if (b === "short") {
      var area = "M" + P(100 - g.cw - 4, 95) + "L" + P(100 - g.cw + 1.8, 95) + "C" + P(100 - g.cw + 3.5, 110, 100 - g.mw - 10, y + 3, 100 - g.mw - 2.5, y - 0.5) +
        "C" + P(100 - g.mw + 2, y + 6.5, 100 + g.mw - 2, y + 6.5, 100 + g.mw + 2.5, y - 0.5) + "C" + P(100 + g.mw + 10, y + 3, 100 + g.cw - 3.5, 110, 100 + g.cw - 1.8, 95) +
        "L" + P(100 + g.cw + 4, 95) + "L" + P(100 + g.cw + 4, 152) + "L" + P(100 - g.cw - 4, 152) + "Z";
      s += '<path d="' + area + '" fill="' + Bc + '"/><path d="' + area + '" fill="url(#' + id + 'H)"/>' +
        '<path d="M' + P(100 - g.cw + 1.8, 95) + "C" + P(100 - g.cw + 3.5, 110, 100 - g.mw - 10, y + 3, 100 - g.mw - 2.5, y - 0.5) + "M" + P(100 + g.cw - 1.8, 95) + "C" + P(100 + g.cw - 3.5, 110, 100 + g.mw + 10, y + 3, 100 + g.mw + 2.5, y - 0.5) + '" fill="none" stroke="' + Bc + '" stroke-width="2.2" opacity=".45" stroke-dasharray="1 1.4"/>';
    } else {
      // fine chinstrap along the jaw + small goatee
      var jaw = "M" + P(100 - g.cw + 0.5, 96) + "C" + P(100 - g.cw + 0.5, g.EY + 15, 100 - g.jw - 3.5, g.jy - 10, 100 - g.jw, g.jy) + "C" + P(100 - g.jw + 2.5, g.jy + 6.5, 100 - g.chw - 4.5, g.cy - 2.5, 100 - g.chw, g.cy - 0.8) +
        "Q" + P(100, g.cy + 1.8, 100 + g.chw, g.cy - 0.8) + "C" + P(100 + g.chw + 4.5, g.cy - 2.5, 100 + g.jw - 2.5, g.jy + 6.5, 100 + g.jw, g.jy) + "C" + P(100 + g.jw + 3.5, g.jy - 10, 100 + g.cw - 0.5, g.EY + 15, 100 + g.cw - 0.5, 96);
      s += '<path d="' + jaw + '" fill="none" stroke="' + Bc + '" stroke-width="7"/>' +
        '<path d="M' + P(100 - 6, y + 7) + "Q" + P(100, y + 5, 100 + 6, y + 7) + "L" + P(100 + 8, g.cy + 2) + "L" + P(100 - 8, g.cy + 2) + 'Z" fill="' + Bc + '"/>';
    }
    s += "</g>";
    var mu = mood === "happy" ? -2 : mood === "sad" ? 1.2 : 0, mt = b === "short" ? 0 : 1.2;
    s += '<path d="M' + P(100 - g.mw - 2, y + 0.5 + mu) + "C" + P(100 - g.mw + 1, g.nosY + 3 + mt, 100 - 4, g.nosY + 3.4 + mt, 100, g.nosY + 5.2 + mt) + "C" + P(100 + 4, g.nosY + 3.4 + mt, 100 + g.mw - 1, g.nosY + 3 + mt, 100 + g.mw + 2, y + 0.5 + mu) +
      "C" + P(100 + g.mw - 3, y - 2.4, 100 + 4, y - 3, 100, y - 2.2) + "C" + P(100 - 4, y - 3, 100 - g.mw + 3, y - 2.4, 100 - g.mw - 2, y + 0.5 + mu) + 'Z" fill="' + shade(Bc, -0.08) + '"/>';
    return s;
  }
  if (b === "walrus" || b === "stache") {
    var big = b === "walrus", wd = g.mw + (big ? 6 : 2), dy = big ? 2.4 : 0.8, mu2 = mood === "happy" ? -2.4 : mood === "sad" ? 1.6 : 0;
    s += '<path d="M' + P(100 - wd, y + dy + 3 + mu2) + "C" + P(100 - wd - 1, y - 4, 100 - 8, g.nosY + 1, 100, g.nosY + 3.6) + "C" + P(100 + 8, g.nosY + 1, 100 + wd + 1, y - 4, 100 + wd, y + dy + 3 + mu2) +
      "C" + P(100 + wd - 4, y + dy + 1, 100 + 6, y + dy - 0.4, 100, y + dy - 1.4) + "C" + P(100 - 6, y + dy - 0.4, 100 - wd + 4, y + dy + 1, 100 - wd, y + dy + 3 + mu2) + 'Z" fill="' + H + '"/>';
    s += '<path d="M' + P(100 - wd + 3, y + dy) + "C" + P(100 - wd + 5, y - 2, 100 - 6, g.nosY + 4, 100 - 1, g.nosY + 5) + "M" + P(100 + wd - 3, y + dy) + "C" + P(100 + wd - 5, y - 2, 100 + 6, g.nosY + 4, 100 + 1, g.nosY + 5) +
      "M" + P(100 - 8, y + dy - 0.5) + "l-1 -4M" + P(100 + 8, y + dy - 0.5) + "l1 -4" + '" fill="none" stroke="' + shade(H, -0.3) + '" stroke-width="1" opacity=".55"/>';
    s += '<path d="M' + P(100 - wd + 1, y - 1) + "C" + P(100 - wd + 3, y - 5, 100 - 10, g.nosY + 3, 100 - 3, g.nosY + 4) + '" fill="none" stroke="#fff" stroke-width="1.4" opacity=".35"/>';
    return s;
  }
  return "";
}

/* ---- ears ---- */
function earPair(a, g, sk) {
  var s = "", k = a.ear && typeof a.ear === "number" ? a.ear : 1, top = g.EY - 9, bot = g.nosY + 1.5;
  [-1, 1].forEach(function (o) {
    var x = 100 + o * (g.cw - 1.5), h = (bot - top) * k, t = bot - h, w = 8.6 * k;
    var d = "M" + P(x, t + 3) + "C" + P(x + o * w * 0.5, t - 2.5, x + o * w * 1.15, t + 1, x + o * w * 1.05, t + h * 0.4) + "C" + P(x + o * w, t + h * 0.7, x + o * w * 0.55, t + h + 1.5, x + o * 1.5, t + h) + "Z";
    s += '<path d="' + d + '" fill="' + (o < 0 ? sk[1] : shade(sk[1], -0.06)) + '"/>' +
      '<path d="M' + P(x + o * w * 0.3, t + 3.2) + "C" + P(x + o * w * 0.9, t + 2.5, x + o * w * 0.85, t + h * 0.55, x + o * w * 0.45, t + h * 0.62) + "C" + P(x + o * w * 0.25, t + h * 0.66, x + o * w * 0.55, t + h * 0.82, x + o * w * 0.35, t + h * 0.9) + '" fill="none" stroke="' + sk[2] + '" stroke-width="1.3" stroke-linecap="round"/>' +
      '<ellipse cx="' + r1(x + o * w * 0.42) + '" cy="' + r1(t + h * 0.45) + '" rx="' + r1(w * 0.2) + '" ry="' + r1(h * 0.16) + '" fill="' + sk[2] + '" opacity=".45"/>';
  });
  return s;
}
function earrings(a, g) {
  var e = a.ear, s = "";
  if (!e || typeof e === "number") return "";
  [-1, 1].forEach(function (o) {
    var x = 100 + o * (g.cw + 1.5), y = g.nosY + 1;
    if (e === "pearl") s += '<circle cx="' + r1(x) + '" cy="' + r1(y + 2.5) + '" r="3" fill="#fbf6ea" stroke="#c8bfa8" stroke-width=".6"/><circle cx="' + r1(x - 0.9) + '" cy="' + r1(y + 1.5) + '" r="1" fill="#fff"/>';
    else if (e === "hoop") s += '<ellipse cx="' + r1(x + o * 1) + '" cy="' + r1(y + 9) + '" rx="6.5" ry="8" fill="none" stroke="#e8c04f" stroke-width="2.1"/><path d="M' + P(x - 4, y + 4) + "q-2 4 0 9" + '" stroke="#fff6c8" stroke-width="1" fill="none" opacity=".7"/>';
    else if (e === "gold") s += '<circle cx="' + r1(x) + '" cy="' + r1(y + 1.5) + '" r="2.2" fill="#e8c04f" stroke="#a27f22" stroke-width=".6"/><path d="M' + P(x, y + 3.5) + "l-2 3.4l2 3.6l2 -3.6Z" + '" fill="#e8c04f" stroke="#a27f22" stroke-width=".5"/>';
    else s += '<circle cx="' + r1(x) + '" cy="' + r1(y + 1.5) + '" r="1.9" fill="#e9eef6" stroke="#9aa6b8" stroke-width=".6"/>';
  });
  return s;
}

/* ---- glasses ---- */
function glassesD(a, g) {
  var y = g.EY, gl = a.glasses;
  if (!gl) return "";
  if (gl === "thin") return '<g fill="#cfe8ff" fill-opacity=".1" stroke="#9aa3b2" stroke-width="1.2"><rect x="73.5" y="' + (y - 7.5) + '" width="23" height="15" rx="5"/><rect x="103.5" y="' + (y - 7.5) + '" width="23" height="15" rx="5"/></g><path d="M96.5 ' + (y - 2) + "Q100 " + (y - 4) + " 103.5 " + (y - 2) + "M73.5 " + (y - 4) + "L" + r1(100 - g.cw + 1) + " " + (y - 5) + "M126.5 " + (y - 4) + "L" + r1(100 + g.cw - 1) + " " + (y - 5) + '" stroke="#9aa3b2" stroke-width="1.1" fill="none"/><path d="M76 ' + (y - 4) + "l5 -2M106 " + (y - 4) + 'l5 -2" stroke="#fff" stroke-opacity=".45" stroke-width="1.2" stroke-linecap="round"/>';
  if (gl === "round") return '<g fill="#cfe8ff" fill-opacity=".1" stroke="#22252c" stroke-width="1.8"><circle cx="85" cy="' + (y + 0.5) + '" r="10.5"/><circle cx="115" cy="' + (y + 0.5) + '" r="10.5"/></g><path d="M95.5 ' + (y - 1) + "Q100 " + (y - 4) + " 104.5 " + (y - 1) + "M74.5 " + (y - 1.5) + "L" + r1(100 - g.cw + 1) + " " + (y - 4) + "M125.5 " + (y - 1.5) + "L" + r1(100 + g.cw - 1) + " " + (y - 4) + '" stroke="#22252c" stroke-width="1.6" fill="none"/><path d="M79 ' + (y - 5) + "q3 -3 7 -3M109 " + (y - 5) + 'q3 -3 7 -3" stroke="#fff" stroke-opacity=".45" stroke-width="1.3" fill="none" stroke-linecap="round"/>';
  // cat-eye
  return '<g fill="#ffe7c9" fill-opacity=".1" stroke="#5a2f52" stroke-width="2" stroke-linejoin="round"><path d="M' + P(72, y - 6) + "Q" + P(72, y - 9, 77, y - 8.4) + "L" + P(94, y - 7) + "Q" + P(97, y - 6.4, 96.4, y - 3) + "L" + P(95, y + 3.5) + "Q" + P(93.6, y + 7, 88, y + 7) + "L" + P(81, y + 6.6) + "Q" + P(74, y + 5.4, 72, y - 6) + 'Z"/>' +
    '<path d="M' + P(128, y - 6) + "Q" + P(128, y - 9, 123, y - 8.4) + "L" + P(106, y - 7) + "Q" + P(103, y - 6.4, 103.6, y - 3) + "L" + P(105, y + 3.5) + "Q" + P(106.4, y + 7, 112, y + 7) + "L" + P(119, y + 6.6) + "Q" + P(126, y + 5.4, 128, y - 6) + 'Z"/></g>' +
    '<path d="M' + P(96.4, y - 4.6) + "Q" + P(100, y - 7, 103.6, y - 4.6) + "M" + P(72, y - 6) + "L" + P(100 - g.cw + 0.5, y - 6) + "M" + P(128, y - 6) + "L" + P(100 + g.cw - 0.5, y - 6) + '" stroke="#5a2f52" stroke-width="1.8" fill="none"/>' +
    '<path d="M' + P(71, y - 7.4) + "l-2.4 -2.2M" + P(129, y - 7.4) + 'l2.4 -2.2" stroke="#5a2f52" stroke-width="2" stroke-linecap="round"/><path d="M' + P(76, y - 5) + "l6 -1.4M" + P(107, y - 5) + 'l6 -1.4" stroke="#fff" stroke-opacity=".5" stroke-width="1.2" stroke-linecap="round"/>';
}

/* ---- outfits ---- */
function garment(B, hole, fill, extra) { return '<path d="' + B + (hole ? " " + hole : "") + '" fill-rule="evenodd" fill="' + fill + '"' + (extra || "") + "/>"; }
function armLines(g, c) {
  var L = 100 - g.sx;
  var one = '<path d="M' + P(L + 6, g.sy + 2) + "C" + P(L + 12, g.sy + 16, L + 16, g.sy + 32, L + 17, 214) + '" fill="none" stroke="' + c + '" stroke-width="1.3" opacity=".55"/>';
  return one + mirror(one);
}
function shirtCollar(g, c, line, spread) {
  var nw = g.nw, ny = g.ny, sp = spread || 0;
  var one = '<path d="M' + P(100 - nw - 1.5, ny - 13) + "L" + P(100 - nw - 6 - sp, ny + 3) + "L" + P(100 - 5 + sp * 0.3, ny + 14 - sp) + "L" + P(100 - 1.5, ny - 1) + 'Z" fill="' + c + '" stroke="' + line + '" stroke-width=".8" stroke-linejoin="round"/>';
  return one + mirror(one);
}
function tieD(g, c, len) {
  var ny = g.ny, b = ny + (len || 46);
  return '<path d="M' + P(95.2, ny - 3, 104.8, ny - 3, 106.2, ny + 5, 103, ny + 8, 97, ny + 8, 93.8, ny + 5) + 'Z" fill="' + shade(c, -0.12) + '"/>' +
    '<path d="M' + P(97, ny + 8, 103, ny + 8, 106, b - 4, 100, b + 2, 94, b - 4) + 'Z" fill="' + c + '"/><path d="M' + P(99, ny + 10) + "L" + P(97.5, b - 4) + '" stroke="#fff" stroke-opacity=".22" stroke-width="1.4"/>';
}
function lapelD(g, c, opt) {
  // notch lapel on the viewer's left; mirrored for the right
  opt = opt || {};
  var nb = g.nb, ny = g.ny, bot = opt.bot || 196, shawl = opt.shawl;
  var d = shawl
    ? "M" + P(100 - nb + 3, ny - 6) + "C" + P(100 - nb - 8, ny + 10, 100 - 22, bot - 30, 100 - 3, bot) + "L" + P(100 - 1, bot - 6) + "C" + P(100 - 9, ny + 24, 100 - nb + 1, ny + 6, 100 - nb + 8, ny - 7) + "Z"
    : "M" + P(100 - nb + 3, ny - 6) + "L" + P(100 - nb - 9, ny + 16) + "L" + P(100 - nb - 3, ny + 20) + "L" + P(100 - nb - 12, ny + 30) + "L" + P(100 - 3, bot) + "L" + P(100 - 1, bot - 6) + "C" + P(100 - 9, ny + 24, 100 - nb + 2, ny + 6, 100 - nb + 8, ny - 7) + "Z";
  var one = '<path d="' + d + '" fill="' + (opt.fill || shade(c, -0.08)) + '" stroke="' + shade(c, -0.42) + '" stroke-width=".9" stroke-linejoin="round"/>' +
    '<path d="M' + P(100 - nb + 4, ny - 4) + "C" + P(100 - nb - 4, ny + 12, 100 - 20, bot - 34, 100 - 4, bot - 2) + '" fill="none" stroke="#fff" stroke-opacity=".14" stroke-width="1.2"/>';
  return one + mirror(one);
}
function outfitD(a, g, sk, id) {
  var B = bodyD(g), c1 = a.c1, c2 = a.c2 || "#f2f2f2", s = "", nw = g.nw, nb = g.nb, ny = g.ny, o = a.out;
  var Vhole = function (top, bot, wide) { wide = wide || 0; return "M" + P(100 - nb + 2 - wide, top) + "C" + P(100 - 13 - wide, ny + 18, 100 - 4, bot - 14, 100, bot) + "C" + P(100 + 4, bot - 14, 100 + 13 + wide, ny + 18, 100 + nb - 2 + wide, top) + "Z"; };
  var shade1 = '<path d="' + B + '" fill="url(#' + id + 'B)"/>';
  if (o === "suit3" || o === "tweed" || o === "suit") {
    var shirt = o === "tweed" ? "#f3efe4" : "#f6f7fa", sline = o === "tweed" ? "#c9bfae" : "#c4cad6";
    s += garment(B, "", shirt);
    if (o !== "suit") { // waistcoat
      var vc = o === "tweed" ? "#8a7a3a" : shade(c1, 0.1);
      s += garment(B, Vhole(ny - 2, 178, -4), vc);
      s += '<circle cx="100" cy="186" r="1.6" fill="' + (o === "tweed" ? "#3a2a10" : c2) + '"/><circle cx="100" cy="196" r="1.6" fill="' + (o === "tweed" ? "#3a2a10" : c2) + '"/>';
    }
    s += o === "suit" && a.bow ? "" : tieD(g, c2, o === "suit3" || o === "tweed" ? 32 : 50);
    s += shirtCollar(g, shirt, sline, o === "suit" ? 2 : 0);
    var jfill = c1;
    s += garment(B, Vhole(ny - 5, 198, 2), jfill);
    if (o === "tweed") { var tw = id + "tw"; s += '<pattern id="' + tw + '" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 2.5H5M2.5 0V5" stroke="' + shade(c1, 0.32) + '" stroke-width=".7" opacity=".5"/></pattern>' + garment(B, Vhole(ny - 5, 198, 2), "url(#" + tw + ")"); }
    s += armLines(g, shade(c1, -0.45));
    s += lapelD(g, c1, { shawl: a.velvet, fill: a.velvet ? shade(c1, -0.4) : null });
    if (a.bow) {
      var bw = '<path d="M' + P(100, ny + 1, 88, ny - 6, 86.5, ny + 1.5, 88, ny + 8) + 'Z" fill="' + c2 + '" stroke="' + shade(c2, -0.4) + '" stroke-width=".8" stroke-linejoin="round"/>';
      s += bw + mirror(bw) + '<rect x="96.5" y="' + (ny - 2.5) + '" width="7" height="7" rx="2" fill="' + shade(c2, -0.18) + '"/>';
    }
    if (o === "suit3") s += '<path d="M' + P(134, 178, 147, 175, 145, 181) + 'Z" fill="' + c2 + '"/><path d="M' + P(135, 178, 140, 173, 143, 177) + 'Z" fill="' + shade(c2, 0.3) + '"/>';
    if (o === "tweed") s += '<path d="M' + P(133, 178, 146, 175, 144, 181) + 'Z" fill="#c9302c"/><rect x="' + (100 - g.sx + 22) + '" y="186" width="18" height="9" rx="2" fill="' + shade(c1, -0.3) + '" opacity=".7"/>';
    if (o === "suit" && !a.bow) s += '<path d="M' + P(133, 178, 146, 175, 144, 181) + 'Z" fill="#f4f4f4" opacity=".9"/>';
  } else if (o === "pilotshirt") {
    s += garment(B, "", "#f4f6fa");
    s += '<path d="M100 ' + (ny + 6) + 'L100 216" stroke="#c4cad6" stroke-width="1.1"/><circle cx="100" cy="188" r="1.3" fill="#aab3c2"/><circle cx="100" cy="202" r="1.3" fill="#aab3c2"/>';
    s += tieD(g, c2, 52) + shirtCollar(g, "#ffffff", "#b9c3d1");
    s += armLines(g, "#b9c3d1");
    // epaulettes along the shoulder slope
    var L = 100 - g.sx, ang = Math.atan2(g.sy - 2 - (ny + 2), (L + 6) - (100 - nb - 8)) * 180 / Math.PI;
    var ex = (L + 6 + 100 - nb - 6) / 2, ey = (g.sy - 2 + ny + 1) / 2 + 0.5;
    var ep = '<g transform="translate(' + r1(ex) + " " + r1(ey) + ") rotate(" + r1(ang + 180) + ')"><rect x="-17" y="-4.6" width="34" height="9.2" rx="2" fill="' + c2 + '" stroke="#0d1428" stroke-width=".7"/>' + [0, 1, 2].map(function (i) { return '<rect x="' + (-8 + i * 5.2) + '" y="-3.6" width="2.6" height="7.2" fill="#e8c25a"/>'; }).join("") + '<circle cx="13" cy="0" r="1.6" fill="#e8c25a"/></g>';
    s += ep + mirror(ep);
    s += '<path d="M' + P(118, 176, 138, 176, 138, 194, 118, 194) + 'Z" fill="none" stroke="#b9c3d1" stroke-width="1.1"/><g transform="translate(128 172)"><path d="M-10 0Q-5 -3 0 -1Q5 -3 10 0Q5 2 0 1Q-5 2 -10 0Z" fill="#e8c25a"/><circle r="2" fill="#f6dc8a"/></g>';
  } else if (o === "turtleblazer") {
    s += garment(B, "", c2);
    // turtleneck collar hugging the neck
    var tn = "M" + P(100 - nw - 1.5, g.jy + 2) + "C" + P(100 - nw - 1, ny - 6, 100 - nw - 4, ny + 2, 100 - nw - 7, ny + 4) + "Q" + P(100, ny + 12, 100 + nw + 7, ny + 4) + "C" + P(100 + nw + 4, ny + 2, 100 + nw + 1, ny - 6, 100 + nw + 1.5, g.jy + 2) + "Q" + P(100, g.cy + 6, 100 - nw - 1.5, g.jy + 2) + "Z";
    s += '<path d="' + tn + '" fill="' + shade(c2, 0.1) + '"/>';
    for (var j = 0; j < 4; j++) s += '<path d="M' + P(100 - nw, g.cy + 3 + j * 3.6) + "Q" + P(100, g.cy + 8 + j * 4.2, 100 + nw, g.cy + 3 + j * 3.6) + '" fill="none" stroke="#000" stroke-width=".9" opacity=".45"/>';
    s += garment(B, Vhole(ny - 2, 214, 4), c1);
    s += armLines(g, shade(c1, -0.45));
    s += lapelD(g, c1, { bot: 214 });
  } else if (o === "blazerF" || o === "suitF") {
    // shell / blouse with a modest neckline, blazer over it
    var top = c2, neck = o === "blazerF" ? "M" + P(100 - nw - 4, ny - 2) + "Q" + P(100, ny + 20, 100 + nw + 4, ny - 2) + "Z"
                                    : "M" + P(100 - nw - 3, ny - 2) + "Q" + P(100, ny + 13, 100 + nw + 3, ny - 2) + "Z";
    s += garment(B, neck, top);
    s += '<path d="' + neck.split("Q")[0] + "Q" + neck.split("Q")[1] + '" fill="none" stroke="' + shade(top, -0.2) + '" stroke-width="1"/>';
    s += garment(B, Vhole(ny - 4, o === "blazerF" ? 204 : 200, 3), c1);
    s += armLines(g, shade(c1, -0.45));
    s += lapelD(g, c1, { bot: o === "blazerF" ? 204 : 200 });
    if (a.pearls) { for (var q = 0; q <= 14; q++) { var t = q / 14, px = 100 - nw - 3 + (2 * nw + 6) * t, py = ny - 1 + Math.sin(t * Math.PI) * 9; s += '<circle cx="' + r1(px) + '" cy="' + r1(py) + '" r="1.9" fill="#fbf6ea" stroke="#c8bfa8" stroke-width=".5"/>'; } }
    else s += '<path d="M' + P(100 - nw + 1, ny + 1) + "Q" + P(100, ny + 14, 100 + nw - 1, ny + 1) + '" fill="none" stroke="#e6c15a" stroke-width="1"/><path d="M100 ' + (ny + 8) + 'l-2.2 3.2l2.2 3.6l2.2 -3.6Z" fill="#e6c15a" stroke="#a27f22" stroke-width=".5"/>';
    s += '<path d="M' + P(134, 176) + 'l2.4 -5l3.6 4.4" fill="none" stroke="#d9b35a" stroke-width="1.3"/>';
  } else if (o === "bomber") {
    var crew = "M" + P(100 - nw - 2, ny - 3) + "Q" + P(100, ny + 9, 100 + nw + 2, ny - 3) + "Z";
    s += garment(B, crew, c2) + '<path d="M' + P(100 - nw - 2, ny - 3) + "Q" + P(100, ny + 9, 100 + nw + 2, ny - 3) + '" fill="none" stroke="#dcdcdc" stroke-width="2.6"/>';
    var open = "M" + P(100 - nb - 2, ny - 4) + "C" + P(100 - nb - 2, ny + 20, 100 - 20, 190, 100 - 19, 216) + "L" + P(100 + 19, 216) + "C" + P(100 + 20, 190, 100 + nb + 2, ny + 20, 100 + nb + 2, ny - 4) + "Z";
    s += garment(B, open, c1);
    var rib = '<path d="M' + P(100 - nb - 2, ny - 4) + "C" + P(100 - nb - 2, ny + 20, 100 - 20, 190, 100 - 19, 216) + "L" + P(100 - 26, 216) + "C" + P(100 - 27, 188, 100 - nb - 8, ny + 18, 100 - nb - 8, ny - 1) + 'Z" fill="' + shade(c1, -0.22) + '"/>';
    s += rib + mirror(rib) + '<path d="M' + P(100 - nb - 2, ny - 4) + "Q" + P(100, ny - 12, 100 + nb + 2, ny - 4) + '" fill="none" stroke="' + shade(c1, -0.3) + '" stroke-width="3"/>';
    s += '<path d="M' + P(100 - 22.5, 170) + "L" + P(100 - 22.5, 216) + "M" + P(100 + 22.5, 170) + "L" + P(100 + 22.5, 216) + '" stroke="#c9ced8" stroke-width="1.2" stroke-dasharray="1.2 1.2"/>';
    s += armLines(g, shade(c1, -0.4));
    s += '<rect x="' + (100 + g.sx - 30) + '" y="178" width="3" height="16" rx="1" fill="#c9ced8" transform="rotate(-8 ' + (100 + g.sx - 28) + ' 186)"/>';
  } else if (o === "wrap") {
    var wrapV = "M" + P(100 - nw - 3, ny - 3) + "C" + P(100 - 10, ny + 10, 100 - 3, ny + 20, 100 + 3, ny + 27) + "C" + P(100 + 6, ny + 16, 100 + nw - 1, ny + 4, 100 + nw + 3, ny - 3) + "Z";
    s += garment(B, wrapV, c1);
    s += '<path d="M' + P(100 + nw + 3, ny - 3) + "C" + P(100 + 6, ny + 16, 100 + 2, ny + 24, 100 - 18, 216) + '" fill="none" stroke="' + shade(c1, -0.4) + '" stroke-width="1.4"/>' +
      '<path d="M' + P(100 - nw - 3, ny - 3) + "C" + P(100 - 10, ny + 10, 100 - 3, ny + 20, 100 + 3, ny + 27) + '" fill="none" stroke="' + shade(c1, 0.25) + '" stroke-width="1.6"/>' +
      '<path d="M' + P(100 + nw + 3, ny - 3) + "C" + P(100 + nw + 12, ny + 8, 100 + 20, ny + 22, 100 + 6, ny + 34) + '" fill="none" stroke="' + shade(c1, -0.3) + '" stroke-width="1" opacity=".6"/>';
    s += armLines(g, shade(c1, -0.4));
    s += '<path d="M' + P(100 - 5, ny + 3) + "l5 7l5 -7" + '" fill="none" stroke="#d6dde8" stroke-width=".9" opacity=".0"/>';
  } else if (o === "coat") {
    s += garment(B, "", shade(c1, -0.1));
    s += garment(B, Vhole(ny - 6, 206, 6), c1);
    var col = '<path d="M' + P(100 - nb - 2, ny - 6) + "L" + P(100 - nb - 18, ny + 8) + "L" + P(100 - nb - 12, ny + 30) + "L" + P(100 - 6, 206) + "L" + P(100 - 2, 200) + "C" + P(100 - 10, ny + 26, 100 - nb, ny + 6, 100 - nb + 5, ny - 8) + 'Z" fill="' + shade(c1, -0.15) + '" stroke="' + shade(c1, -0.45) + '" stroke-width="1"/>';
    s += col + mirror(col) + armLines(g, shade(c1, -0.45));
    // silk scarf with tiny planes, knotted at the front
    var sc = "M" + P(100 - nw - 6, g.jy + 6) + "C" + P(100 - nw - 8, ny - 2, 100 - nw - 6, ny + 6, 100 - 6, ny + 10) + "Q" + P(100, ny + 13, 100 + 6, ny + 10) + "C" + P(100 + nw + 6, ny + 6, 100 + nw + 8, ny - 2, 100 + nw + 6, g.jy + 6) + "Q" + P(100, g.cy + 12, 100 - nw - 6, g.jy + 6) + "Z";
    s += '<path d="' + sc + '" fill="' + c2 + '"/><path d="M' + P(100 - 4, ny + 8) + "L" + P(100 - 12, 196) + "L" + P(100 + 2, 198) + "L" + P(100 + 5, ny + 9) + 'Z" fill="' + shade(c2, -0.1) + '"/><path d="M' + P(100 + 2, ny + 9) + "L" + P(100 + 14, 186) + "L" + P(100 + 6, 190) + 'Z" fill="' + shade(c2, -0.22) + '"/>' +
      '<ellipse cx="100" cy="' + (ny + 9) + '" rx="5" ry="4" fill="' + shade(c2, -0.15) + '"/>';
    var pg = function (x, y, r) { return '<path transform="translate(' + x + " " + y + ") rotate(" + r + ')" d="M-3 0L3 0M0 -1.5L-1 1.5M0 -1.5L1 1.5" stroke="#fff" stroke-width="1" stroke-linecap="round" opacity=".85"/>'; };
    s += pg(88, ny + 2, -20) + pg(112, ny + 2, 20) + pg(97, 170, 70) + pg(94, 184, 70) + pg(110, 170, 60);
  }
  s += shade1;
  return s;
}

/* ---- thinking hand: index along the cheek, thumb under the chin, three fingers curled ---- */
function handD(a, g, sk, id) {
  // front view, back of the hand to the viewer: index finger resting on the cheek, thumb under the chin,
  // middle/ring/little finger curled (their knuckles and folded backs visible). Sleeve rises from the bottom.
  var c = a.out === "pilotshirt" ? "#eef1f6" : a.c1, dy = g.cy - 141, dx = (g.jw - 28) * 0.5;
  var S = sk[0], E = shade(sk[2], -0.08), M = mix(sk[0], sk[1], 0.45);
  var hs = function (d, fill, sw) { return '<path d="' + d + '" fill="' + (fill || S) + '" stroke="' + E + '" stroke-width="' + (sw || 1.1) + '" stroke-linejoin="round"/>'; };
  var h = "";
  h += '<path d="M116 216C119 202 122 192 124 184L153 181C156 193 160 204 164 216Z" fill="' + shade(c, -0.04) + '" stroke="' + shade(c, -0.4) + '" stroke-width="1"/>' +
    '<path d="M123 190L154 186.5L153 180L124.4 183.4Z" fill="' + shade(c, -0.16) + '" stroke="' + shade(c, -0.4) + '" stroke-width=".8"/>';
  // back of the hand (wrist → knuckles)
  h += hs("M126 184C124 176 122 168 121 160C120 154 120 150 122 147L151 149C152 157 153 168 152 183Z", M);
  h += '<path d="M131 178C130 170 129 163 128.5 156M139 178C139 170 139 163 139 156M146 178C146.5 171 147 164 147.5 158" fill="none" stroke="' + E + '" stroke-width=".8" opacity=".35"/>';
  // curled fingers (little, ring, middle)
  h += hs("M144.5 151Q144.5 147 148.2 147Q152 147 152 151L152 158Q152 162 148.2 162Q144.5 162 144.5 158Z");
  h += hs("M136.5 148.5Q136.5 144 140.6 144Q144.8 144 144.8 148.5L144.8 159.5Q144.8 164 140.6 164Q136.5 164 136.5 159.5Z");
  h += hs("M128 147Q128 142.5 132.3 142.5Q136.7 142.5 136.7 147L136.7 160.5Q136.7 165 132.3 165Q128 165 128 160.5Z");
  h += '<path d="M129.6 153.6q2.7 1.4 5.4 0M138 153q2.6 1.3 5.2 0M146 153.4q2.2 1.1 4.4 0" fill="none" stroke="' + E + '" stroke-width=".9" opacity=".7"/>' +
    '<path d="M130 145.4q2.3 -1.2 4.6 0M138.4 146.6q2.2 -1.1 4.4 0M146.2 149.4q2 -1 4 0" fill="none" stroke="#fff" stroke-width="1" opacity=".45"/>';
  // index finger up along the cheek (nail at the tip)
  h += '<path d="M127.5 150C127 138 126.6 124 126.4 113" stroke="#000" stroke-opacity=".16" stroke-width="3" fill="none" stroke-linecap="round"/>';
  h += hs("M119 151C118.4 138 118.2 124 118.6 113C118.8 107.6 125.6 107.6 125.8 113C126.4 124 127 138 127.8 151Z");
  h += '<path d="M119.9 113.4C120 110 124.6 110 124.7 113.4L124.8 118C123.4 119 121.2 119 119.9 118Z" fill="' + shade(S, 0.12) + '" stroke="' + E + '" stroke-width=".7"/>' +
    '<path d="M119.4 126q3.6 -1.2 7 0M119.4 138.5q3.8 -1.2 7.6 0" fill="none" stroke="' + E + '" stroke-width=".8" opacity=".6"/>';
  // thumb from the base of the hand, tip tucked under the chin
  h += '<g transform="translate(124 170) rotate(-124)">' + hs("M0 -5.4L25 -4.6Q31 -4.4 31 0Q31 4.4 25 4.6L0 5.4Z") +
    '<path d="M21.5 -3.6Q29 -3.6 29 0Q29 3.6 21.5 3.6Q20.4 0 21.5 -3.6Z" fill="' + shade(S, 0.12) + '" stroke="' + E + '" stroke-width=".7"/><path d="M13 -4.6q-1.4 4.6 0 9.2" fill="none" stroke="' + E + '" stroke-width=".8" opacity=".55"/></g>';
  h += '<path d="M118 146L156 146L156 216L118 216Z" fill="url(#' + id + 'B)" opacity=".7"/>';
  return '<g transform="translate(' + r1(dx) + " " + r1(dy) + ')">' + h + "</g>";
}

/* ---- the portrait ---- */
function skinTones(hex) {
  if (SKIN[hex]) return SKIN[hex];
  hex = hex && hex[0] === "#" ? hex : "#f1c7a6";
  var dark = lum(hex) < 0.42;
  return [shade(hex, dark ? 0.08 : 0.05), shade(hex, -0.1), shade(hex, dark ? -0.3 : -0.26)];
}
function avatarInner(id, mood, opt) {
  id = ((+id || 0) % 10 + 10) % 10;
  var a = opt && opt.cfg || AV[id], g = geom(a), sk = skinTones(a.skin), idc = uid("a");
  mood = MOODS.indexOf(mood) >= 0 ? mood : "neutral";
  var H = a.hair, Hd = shade(H, lum(H) > 0.6 ? -0.2 : -0.25), Hl = lum(H) > 0.5 ? shade(H, 0.4) : shade(H, 0.32);
  var hl = hairLayers(a, g, H, Hd, Hl, idc), hd = headD(g);
  var s = lightDefs(idc);
  s += '<radialGradient id="' + idc + 'sk" cx=".4" cy=".42" r=".7"><stop offset="0" stop-color="' + shade(sk[0], 0.05) + '"/><stop offset=".7" stop-color="' + sk[0] + '"/><stop offset="1" stop-color="' + mix(sk[0], sk[1], 0.6) + '"/></radialGradient>';
  s += hl.back;
  // neck + upper chest (skin), shadow cast by the jaw
  s += '<path d="' + neckD(g) + '" fill="' + sk[1] + '"/>';
  s += '<path d="M' + P(100 - g.nw - 1, g.jy - 6) + "Q" + P(100, g.cy + 16, 100 + g.nw + 1, g.jy - 6) + "L" + P(100 + g.nw + 1, g.jy - 14) + "L" + P(100 - g.nw - 1, g.jy - 14) + 'Z" fill="' + sk[2] + '" opacity=".7"/>';
  s += '<path d="M' + P(100 + g.nw - 5, g.cy) + "C" + P(100 + g.nw - 4, g.ny - 10, 100 + g.nw, g.ny - 4, 100 + g.nw + 6, g.ny) + "L" + P(100 + g.nw + 1, g.jy) + 'Z" fill="' + sk[2] + '" opacity=".35"/>';
  s += '<path d="' + bodyD(g) + '" fill="' + sk[1] + '"/>';
  s += '<path d="M' + P(100 - 4, g.ny + 7) + "Q" + P(100 - 14, g.ny + 3, 100 - g.nb - 12, g.ny + 6) + "M" + P(100 + 4, g.ny + 7) + "Q" + P(100 + 14, g.ny + 3, 100 + g.nb + 12, g.ny + 6) + '" fill="none" stroke="' + sk[2] + '" stroke-width="1.1" opacity=".5"/>' +
    '<path d="M' + P(100 - g.nw + 3, g.ny - 13) + "L" + P(100 - 4, g.ny + 1) + "M" + P(100 + g.nw - 3, g.ny - 13) + "L" + P(100 + 4, g.ny + 1) + '" stroke="' + sk[2] + '" stroke-width=".9" opacity=".2"/>';
  if (a.age > 1) s += '<path d="M' + P(100 - g.nw + 2, g.cy + 8) + "q" + P(g.nw - 2, 3, 2 * g.nw - 4, 0) + '" fill="none" stroke="' + sk[2] + '" stroke-width=".9" opacity=".5"/>';
  s += outfitD(a, g, sk, idc);
  // ears, head, light overlay
  s += earPair(a, g, sk);
  s += '<path d="' + hd + '" fill="url(#' + idc + 'sk)"/>';
  s += '<path d="' + hd + '" fill="url(#' + idc + 'L)"/>';
  s += '<path d="M' + P(100 + g.cw - 6, 66) + "C" + P(100 + g.cw + 1, 84, 100 + g.cw - 1, 104, 100 + g.jw - 2, g.jy - 2) + "C" + P(100 + g.cw - 7, 106, 100 + g.cw - 6, 86, 100 + g.cw - 9, 70) + 'Z" fill="' + sk[2] + '" opacity=".28"/>';
  // cheeks, freckles, age
  var blush = mood === "angry" ? .2 : mood === "happy" || a.rosy ? .24 : g.f ? .14 : .08, bc = mood === "angry" ? "#ff3b30" : "#ff6b6b";
  s += '<ellipse cx="' + r1(100 - g.cw + 11) + '" cy="' + (g.nosY - 1) + '" rx="9" ry="5.5" fill="' + bc + '" opacity="' + blush + '"/><ellipse cx="' + r1(100 + g.cw - 11) + '" cy="' + (g.nosY - 1) + '" rx="9" ry="5.5" fill="' + bc + '" opacity="' + blush + '"/>';
  if (lum(a.skin) > 0.45) s += '<ellipse cx="' + r1(100 - g.cw + 13) + '" cy="' + (g.EY + 11) + '" rx="6" ry="3" fill="#fff" opacity=".12"/>';
  else s += '<ellipse cx="' + r1(100 - g.cw + 13) + '" cy="' + (g.EY + 11) + '" rx="6" ry="3" fill="' + shade(a.skin, 0.35) + '" opacity=".22"/><ellipse cx="96" cy="58" rx="9" ry="4" fill="' + shade(a.skin, 0.35) + '" opacity=".18"/>';
  if (a.freckles) { var fr = rngFrom(51); for (var i = 0; i < 14; i++) { var side = i % 2 ? 1 : -1, fx = 100 + side * (5 + fr() * 14), fy = g.nosY - 10 + fr() * 7; s += '<circle cx="' + r1(fx) + '" cy="' + r1(fy) + '" r="' + r1(0.45 + fr() * 0.35) + '" fill="#b0623e" opacity=".32"/>'; } }
  if (a.age) {
    s += '<path d="M' + P(100 - g.nosW - 2.5, g.nosY + 0.5) + "Q" + P(100 - g.mw - 5, g.MY - 4, 100 - g.mw - 3.5, g.MY + 5) + "M" + P(100 + g.nosW + 2.5, g.nosY + 0.5) + "Q" + P(100 + g.mw + 5, g.MY - 4, 100 + g.mw + 3.5, g.MY + 5) + '" fill="none" stroke="' + sk[2] + '" stroke-width="1.1" stroke-linecap="round" opacity="' + (a.age > 1 ? .55 : .35) + '"/>';
    if (a.age > 1) s += '<path d="M' + P(84, 62) + "q8 -2.4 16 -0.4t16 0M" + P(87, 67.5) + "q7 -2 13 -0.4t13 0" + '" fill="none" stroke="' + sk[2] + '" stroke-width="1" opacity=".55"/>' +
      '<path d="M' + P(100 - g.chw - 7, g.cy - 9) + "q-2 4 1 7M" + P(100 + g.chw + 7, g.cy - 9) + "q2 4 -1 7" + '" fill="none" stroke="' + sk[2] + '" stroke-width="1" opacity=".5"/>';
  }
  if (a.mole) s += '<circle cx="' + r1(100 + g.mw + 3) + '" cy="' + r1(g.MY - 5) + '" r="1.1" fill="#5a3426" opacity=".8"/>';
  s += eyePair(a, g, mood, sk, idc);
  s += browPair(a, g, mood, H);
  s += noseD(a, g, sk, mood);
  s += beardD(a, g, H, Hd, mood, idc);
  s += mouthD(a, g, mood, sk, idc);
  if (a.dimples && (mood === "happy" || mood === "smug" || mood === "neutral")) s += '<path d="M' + P(100 - g.mw - 5, g.MY - 1) + "q-1.2 2.6 0 4.6M" + P(100 + g.mw + 5, g.MY - 1) + "q1.2 2.6 0 4.6" + '" stroke="' + sk[2] + '" stroke-width="1.2" fill="none" stroke-linecap="round" opacity=".7"/>';
  s += earrings(a, g);
  s += hl.front;
  s += glassesD(a, g);
  if (a.aviators) s += '<g transform="translate(0 -38)"><path d="M74 84Q74 78 82 78L92 79Q96 80 95 85Q93 93 85 93Q75 92 74 84Z M126 84Q126 78 118 78L108 79Q104 80 105 85Q107 93 115 93Q125 92 126 84Z" fill="#24374d" stroke="#d4af37" stroke-width="1.5"/><path d="M95 82Q100 79 105 82" stroke="#d4af37" stroke-width="1.5" fill="none"/><path d="M78 82l6 -2M110 82l6 -2" stroke="#9fd0ff" stroke-width="1.5" opacity=".6" stroke-linecap="round"/></g>';
  if (a.clip) s += '<rect x="' + r1(100 + g.cw - 14) + '" y="58" width="14" height="4" rx="2" transform="rotate(-30 ' + r1(100 + g.cw - 7) + ' 60)" fill="#e2e8f0" stroke="#8a95a8" stroke-width=".6"/>';
  if (a.chain) s += '<path d="M72 ' + (g.EY - 6) + "Q" + P(62, g.EY + 30, 76, g.ny + 6) + "M128 " + (g.EY - 6) + "Q" + P(138, g.EY + 30, 124, g.ny + 6) + '" stroke="#d4af37" stroke-width="1" stroke-dasharray="1.5 1.4" fill="none"/>';
  if (a.headset) s += '<path d="M' + P(100 - g.cw - 4, 92) + "C" + P(100 - g.cw - 8, 50, 76, 26, 100, 26) + "C" + P(124, 26, 100 + g.cw + 8, 50, 100 + g.cw + 4, 92) + '" fill="none" stroke="#23262e" stroke-width="5" stroke-linecap="round"/>' +
    '<rect x="' + r1(100 - g.cw - 10) + '" y="80" width="12" height="21" rx="5" fill="#23262e"/><rect x="' + r1(100 + g.cw - 2) + '" y="80" width="12" height="21" rx="5" fill="#23262e"/><rect x="' + r1(100 - g.cw - 8) + '" y="83" width="3.6" height="15" rx="1.8" fill="#e8b84a"/>' +
    '<path d="M' + P(100 - g.cw - 4, 100, 100 - g.cw - 2, 114) + "Q" + P(100 - g.cw, g.MY + 2, 100 - g.mw - 4, g.MY + 1) + '" fill="none" stroke="#23262e" stroke-width="2.4" stroke-linecap="round"/><ellipse cx="' + r1(100 - g.mw - 3) + '" cy="' + r1(g.MY + 1) + '" rx="4" ry="3" fill="#23262e"/>';
  if (mood === "thinking" && !a.noHand) s += handD(a, g, sk, idc);
  if (mood === "sad") s += '<path d="M' + P(100 - g.ED - 4, g.EY + 6) + "q-2.2 4.6 0 6.6q2.6 0 2 -3.8z" + '" fill="#9ad8ff" opacity=".85"/>';
  return s;
}

CA.avatar = function (id, size, mood, opt) {
  opt = opt || {}; size = size || 96;
  var a = AV[((+id || 0) % 10 + 10) % 10];
  var inner = avatarInner(id, mood, opt), bg = "", idc = uid("b"), pre = "", post = "";
  // small sizes (HUD chips): zoom on the face so expressions stay readable
  var zoom = opt.zoom != null ? opt.zoom : size <= 40 ? 1.62 : size <= 64 ? 1.36 : 1.12;
  var zy = zoom > 1.12 ? 102 + 112 * zoom : 204; // small: centre the face (y≈92 → 102)
  inner = '<g transform="translate(100 ' + r1(zy) + ") scale(" + zoom + ") translate(-100 -204)" + '">' + inner + "</g>";
  if (opt.flip) inner = mirror(inner);
  var ring = opt.ring ? col(opt.ring) : null;
  if (opt.bg !== false) {
    bg = '<radialGradient id="' + idc + 'g" cx=".5" cy=".35" r=".75"><stop offset="0" stop-color="' + a.bg[0] + '"/><stop offset="1" stop-color="' + a.bg[1] + '"/></radialGradient>';
    if (ring) bg += '<clipPath id="' + idc + 'c"><circle cx="100" cy="100" r="96"/></clipPath><circle cx="100" cy="100" r="96" fill="url(#' + idc + 'g)"/>';
    else bg += '<clipPath id="' + idc + 'c"><rect x="0" y="0" width="200" height="200" rx="28"/></clipPath><rect width="200" height="200" rx="28" fill="url(#' + idc + 'g)"/>';
    bg += '<g clip-path="url(#' + idc + 'c)"><circle cx="150" cy="40" r="60" fill="#fff" opacity=".06"/><path d="M0 150Q100 120 200 150L200 200L0 200Z" fill="#000" opacity=".12"/></g>';
    pre = '<g clip-path="url(#' + idc + 'c)">'; post = "</g>";
  } else if (ring) {
    bg = '<clipPath id="' + idc + 'c"><circle cx="100" cy="100" r="96"/></clipPath>'; pre = '<g clip-path="url(#' + idc + 'c)">'; post = "</g>";
  }
  var ringS = ring ? '<circle cx="100" cy="100" r="95" fill="none" stroke="' + ring + '" stroke-width="7"/><circle cx="100" cy="100" r="99" fill="none" stroke="#000" stroke-opacity=".35" stroke-width="1.5"/><path d="M30 46A88 88 0 0 1 100 8" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width="2.5" stroke-linecap="round"/>' : "";
  return svgWrap("0 0 200 200", size, size, bg + pre + inner + post + ringS, "ca-av ca-av-" + (MOODS.indexOf(mood) >= 0 ? mood : "neutral"), opt.title ? ' role="img"' : "");
};
CA._avatarInner = avatarInner;

/* =========================================================== AIRCRAFT
   Generic over N types. INDEX = ty from CerulLogic (stable for old saves):
   0 t72 Turbo 72 · 1 a320 Aero 320 · 2 s350 Skyliner 350 · 3 c40 Colibri 40 · 4 r100 Regio 100 · 5 c230 Cometa 230
   Size order (small → big): 3, 0, 4, 1, 5, 2. Unknown ids fall back to the Aero 320 drawing. */
var PLANE_KEYS = ["t72", "a320", "s350", "c40", "r100", "c230"];
var PLANE_NAMES = ["Turbo 72", "Aero 320", "Skyliner 350", "Colibri 40", "Regio 100", "Cometa 230"];
var PLANE_ORDER = [3, 0, 4, 1, 5, 2];
/* relative size in side views (1 = fills the 240×80 box) and the propulsion kind */
var PLANE_SCALE = [0.78, 0.9, 1, 0.66, 0.84, 0.96];
var PLANE_KIND = ["prop", "jet", "jet", "prop", "rear", "jet"];
function ptype(t) {
  if (t == null || t === "") return 1;
  if (typeof t === "number") return isFinite(t) ? Math.max(0, Math.min(PLANE_KEYS.length - 1, t | 0)) : 1;
  if (typeof t === "object") {
    var v = t.type != null ? t.type : (t.ty != null ? t.ty : (t.t != null ? t.t : (t.id != null ? t.id : (t.k != null ? t.k : t.key))));
    if (v != null) return ptype(v);
    var seats = +t.seats;
    if (seats > 0) return seats < 55 ? 3 : seats < 85 ? 0 : seats < 140 ? 4 : seats < 205 ? 1 : seats < 280 ? 5 : 2;
    return 1;
  }
  var s = noDia(t).replace(/\s+/g, "");
  if (/^\d+$/.test(s)) return ptype(+s);
  var i = PLANE_KEYS.indexOf(s); if (i >= 0) return i;
  if (/colibri|c40|navet/.test(s)) return 3;
  if (/regio|r100/.test(s)) return 4;
  if (/cometa|c230|230/.test(s)) return 5;
  if (/sky|350|s3|wide|lung/.test(s)) return 2;
  if (/turbo|72|t7|atr|prop/.test(s)) return 0;
  return 1;
}
CA.planeType = ptype;
CA.PLANES = PLANE_KEYS.map(function (k, i) { return { key: k, ty: i, name: PLANE_NAMES[i], scale: PLANE_SCALE[i], kind: PLANE_KIND[i] }; });
CA.PLANE_ORDER = PLANE_ORDER.slice();
CA.planeKey = function (type) { return PLANE_KEYS[ptype(type)]; };
CA.planeSpec = function (type) { var t = ptype(type); return { key: PLANE_KEYS[t], ty: t, name: PLANE_NAMES[t], scale: PLANE_SCALE[t], kind: PLANE_KIND[t], rank: PLANE_ORDER.indexOf(t) }; };

/* ---- side-view specs, viewBox 240×80, nose RIGHT ----
   F fuselage · fin · stab (T: drawn behind the fuselage at the fin top) · wing · eng {...} · win [x0,x1,y,step,oval]
   doors [[x,dy,h]] · BY livery belly line · top white band y · shY ground-shadow y · logo [x,y,rot] · gloss [x0,x1,y] */
var SIDE = [
  { // 0 Turbo 72 — high-wing twin turboprop, T-tail
    F: "M20 42C22 36 34 32 54 32L184 32C202 32 216 36 226 44C224 51 212 55 194 55L76 55C54 55 36 50 20 42Z",
    fin: "M24 38L16 9L36 9L64 33Z", stab: "M8 7L46 7L44 12L10 12Z", stabT: 1,
    wing: "M98 32L154 32L151 27.5L102 27.5Z",
    eng: { kind: "prop", d: "M132 25.5L157 25.5Q164 25.5 164 30.5Q164 35.5 157 35.5L132 35.5Z", stripe: "M136 30.5L162 30.5", spin: "M164 27.5L170 30.5L164 33.5Z", px: 168, py: 30.5, pr: 13 },
    win: [70, 176, 40, 7, 1], doors: [[186, -4, 12], [62, -3, 11]], cockpit: "M204 37L216 39L221 43L206 42Z",
    BY: 48.5, band: 31, shY: 74, logo: [34, 21, 0], gloss: [60, 190, 33]
  },
  { // 1 Aero 320 — narrow-body twin jet
    F: "M16 40C20 35 34 31 52 31L192 31C210 31 224 37 232 45C228 51 216 55 198 55L66 55C46 55 30 50 16 40Z",
    fin: "M22 36L8 5L26 5L60 32Z", stab: "M10 41L46 42L42 46L14 45Z",
    wing: "M150 50L102 51L80 58L90 58L150 54Z", wingSh: 1,
    eng: { kind: "fan", d: "M124 55L158 55C163 55 165 58 165 61C165 64 163 67 158 67L124 67C121 65 121 57 124 55Z", ix: 165, ey: 55, eh: 12, py: 134, ex: 122 },
    win: [64, 190, 39, 5.4, 0], doors: [[198, -4, 12], [56, -3, 11]], cockpit: "M210 35L223 38L228 43L213 41Z",
    BY: 48.5, band: 31, shY: 74, logo: [30, 19, -8], gloss: [60, 190, 33]
  },
  { // 2 Skyliner 350 — wide-body long-hauler
    F: "M12 39C18 32 34 27 54 27L190 27C212 27 228 35 235 46C229 54 214 59 196 59L70 59C46 59 28 52 12 39Z",
    fin: "M18 35L2 0L22 0L62 28Z", stab: "M6 41L48 42L44 47L10 46Z",
    wing: "M154 53L100 54L70 64L82 65L154 58Z", wingSh: 1, tip: "M70 64L66 56L72 56L82 65Z",
    eng: { kind: "fan", d: "M114 58L158 58C165 58 168 62 168 66.5C168 71 165 75 158 75L114 75C110 72 110 61 114 58Z", ix: 168, ey: 58, eh: 17, py: 134, ex: 112 },
    win: [66, 192, 37, 5.4, 0], doors: [[200, -4, 12], [58, -3, 11]], cockpit: "M207 33C215 33.5 223 37 228.5 42L224 43L209 41.5Z",
    BY: 50, band: 28, shY: 78, logo: [26, 16, -8], gloss: [60, 190, 30]
  },
  { // 3 Colibri 40 — stubby commuter turboprop, high wing, T-tail, belly gear sponson
    F: "M30 41C32 34 44 30 62 30L178 30C196 30 207 35 214 44C211 52 200 56 186 56L80 56C58 56 42 50 30 41Z",
    fin: "M34 37L22 4L40 4L70 31Z", stab: "M12 2L50 2L48 7L14 7Z", stabT: 1,
    wing: "M102 30L152 30L149 25.5L106 25.5Z",
    sponson: "M108 54Q110 63 122 63L142 63Q152 63 154 54Z",
    eng: { kind: "prop", d: "M128 23.5L151 23.5Q158 23.5 158 28.25Q158 33 151 33L128 33Z", stripe: "M131 28.25L156 28.25", spin: "M158 25.5L163.5 28.25L158 31Z", px: 162, py: 28.25, pr: 11.5 },
    win: [76, 172, 39.5, 9.6, 2], doors: [[184, -4.5, 13], [66, -4, 13]], cockpit: "M190 35L204 38L209 42.5L194 41Z",
    BY: 49, band: 30, shY: 75, logo: [38, 17, 0], gloss: [66, 184, 32]
  },
  { // 4 Regio 100 — slim regional jet, engines on the rear fuselage, T-tail
    F: "M18 42C21 36 34 32 54 32L190 32C208 32 221 37 228 45C224 51 213 54 196 54L70 54C48 54 32 49 18 42Z",
    fin: "M26 37L13 3L31 3L64 33Z", stab: "M3 1L45 1L43 6L7 6Z", stabT: 1,
    wing: "M152 50L108 51L88 57L97 57L152 53Z", wingSh: 1,
    eng: { kind: "rear", d: "M58 33L90 33C95 33 97 36 97 38.75C97 41.5 95 44.5 90 44.5L58 44.5C55 42.5 55 35 58 33Z", ix: 97, ey: 33, eh: 11.5, ex: 56, pylon: "M66 44L84 44L82 47L68 47Z" },
    win: [108, 198, 39.5, 5.4, 0], doors: [[205, -4, 12], [101, -3, 11]], cockpit: "M212 36L224 39L229 44L214 42Z",
    BY: 47.5, band: 31.5, shY: 72, logo: [30, 15, -8], gloss: [100, 196, 33.5]
  },
  { // 5 Cometa 230 — long-range stretched narrow-body, big fans, raked winglets, 3 doors
    F: "M6 40C10 34 26 30 46 30L198 30C216 30 229 36 236 45C232 52 219 56 202 56L60 56C38 56 22 51 6 40Z",
    fin: "M13 36L0 1L19 1L54 31Z", stab: "M4 41L42 42L38 47L8 46Z",
    wing: "M156 51L104 52L76 60L88 60L156 55Z", wingSh: 1, tip: "M77 60L70 50.5L74.5 50.5L87 60Z",
    eng: { kind: "fan", d: "M120 56L160 56C166 56 168 59.5 168 63C168 66.5 166 70 160 70L120 70C117 68 117 58 120 56Z", ix: 168, ey: 56, eh: 14, py: 138, ex: 118 },
    win: [62, 196, 38.5, 5.4, 0], doors: [[204, -4, 12], [128, -3, 10], [56, -3, 11]], cockpit: "M214 34L227 37.5L232 43L217 41Z",
    BY: 49.5, band: 30, shY: 76, logo: [24, 15, -8], gloss: [60, 200, 32]
  }
];

function sideG(t, c, idc, simple) {
  var S = SIDE[t] || SIDE[1], E = S.eng;
  var dk = shade(c, -0.35), lt = shade(c, 0.25), BY = S.BY;
  var s = '<linearGradient id="' + idc + 'f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".55" stop-color="#eef2f7"/><stop offset="1" stop-color="#b9c3d1"/></linearGradient>' +
    '<linearGradient id="' + idc + 't" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + lt + '"/><stop offset="1" stop-color="' + dk + '"/></linearGradient>' +
    '<linearGradient id="' + idc + 'e" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4f6fa"/><stop offset=".5" stop-color="#cfd6e0"/><stop offset="1" stop-color="#8d98a8"/></linearGradient>' +
    '<clipPath id="' + idc + 'c"><path d="' + S.F + '"/></clipPath>';
  // ground shadow
  s += '<ellipse cx="124" cy="' + S.shY + '" rx="96" ry="3" fill="#000" opacity=".18"/>';
  if (S.wingSh) s += '<path d="' + S.wing + '" fill="#9aa5b5" transform="translate(6 -3) scale(.98)" opacity=".7"/>';
  s += '<path d="' + S.fin + '" fill="url(#' + idc + 't)"/>';
  if (S.stabT) s += '<path d="' + S.stab + '" fill="url(#' + idc + 't)"/>';
  if (S.sponson) s += '<path d="' + S.sponson + '" fill="' + dk + '"/><path d="' + S.sponson + '" fill="none" stroke="' + shade(c, -0.55) + '" stroke-width=".6"/>';
  s += '<path d="' + S.F + '" fill="url(#' + idc + 'f)"/>';
  // livery: company-colour belly, gold pinstripe, white crown band
  s += '<g clip-path="url(#' + idc + 'c)">' +
    '<path d="M0 ' + (BY - 4) + 'Q130 ' + BY + ' 240 ' + (BY + 1) + 'L240 80L0 80Z" fill="' + c + '"/>' +
    '<path d="M0 ' + (BY - 4) + 'Q130 ' + BY + ' 240 ' + (BY + 1) + '" stroke="' + lt + '" stroke-width="1.6" fill="none"/>' +
    '<path d="M0 ' + (BY - 6.4) + 'Q130 ' + (BY - 2.4) + ' 240 ' + (BY - 1.4) + '" stroke="#ffd35c" stroke-width="1.1" fill="none" opacity=".9"/>' +
    '<rect x="0" y="' + S.band + '" width="240" height="4" fill="#fff" opacity=".7"/>' +
    '<path d="M0 70L240 70L240 80L0 80Z" fill="#000" opacity=".15"/>' +
    '</g>';
  if (!S.stabT) s += '<path d="' + S.stab + '" fill="url(#' + idc + 't)" stroke="' + dk + '" stroke-width=".6"/>';
  if (!simple) {
    // windows
    var W = S.win, w = "", x;
    for (x = W[0]; x <= W[1]; x += W[3]) {
      var near = false;
      for (var d = 0; d < S.doors.length; d++) if (Math.abs(x - S.doors[d][0]) < 5) near = true;
      if (near) continue;
      if (W[4] === 1) w += '<ellipse cx="' + x.toFixed(1) + '" cy="' + W[2] + '" rx="1.8" ry="2.4"/>';
      else if (W[4] === 2) w += '<rect x="' + (x - 2.1).toFixed(1) + '" y="' + (W[2] - 2.6) + '" width="4.2" height="5.2" rx="2"/>';
      else w += '<rect x="' + (x - 1.2).toFixed(1) + '" y="' + (W[2] - 1.8) + '" width="2.4" height="3.4" rx="1.1"/>';
    }
    s += '<g fill="#1c2b46">' + w + "</g>";
    s += '<g fill="none" stroke="#7b8799" stroke-width=".7">' + S.doors.map(function (q) {
      return '<rect x="' + (q[0] - 2.6) + '" y="' + (W[2] + q[1]) + '" width="5.2" height="' + q[2] + '" rx="1.4"/>';
    }).join("") + "</g>";
  } else {
    s += '<path d="M' + S.win[0] + " " + S.win[2] + "L" + S.win[1] + " " + S.win[2] + '" stroke="#1c2b46" stroke-width="2.6" stroke-dasharray="2.6 2.4" opacity=".8"/>';
  }
  s += '<path d="' + S.cockpit + '" fill="#13213a"/><path d="' + S.cockpit + '" fill="none" stroke="#7fb2ff" stroke-width=".5" opacity=".7"/>';
  // tail logo
  s += '<g transform="translate(' + S.logo[0] + " " + S.logo[1] + ") rotate(" + S.logo[2] + ')"><circle r="6.2" fill="none" stroke="#fff" stroke-width="1.5" opacity=".95"/><path d="M-7 2Q0 -6 8 -3Q1 -2 -4 5Z" fill="#fff"/></g>';
  // gloss (before rear engines, which sit on top of the fuselage)
  var gl = '<path d="M' + S.gloss[0] + " " + S.gloss[2] + "L" + S.gloss[1] + " " + S.gloss[2] + '" stroke="#fff" stroke-width="1.2" opacity=".9"/>';
  if (E.kind === "rear") s += gl;
  // wing + engines
  s += '<path d="' + S.wing + '" fill="url(#' + idc + 'e)" stroke="#6d7888" stroke-width=".6"/>';
  if (E.kind === "prop") {
    s += '<path d="' + E.d + '" fill="url(#' + idc + 'e)" stroke="#6d7888" stroke-width=".6"/><path d="' + E.stripe + '" stroke="' + c + '" stroke-width="2"/>' +
      '<path d="' + E.spin + '" fill="#596476"/>';
    s += '<g class="ca-prop"><ellipse cx="' + E.px + '" cy="' + E.py + '" rx="1.8" ry="' + E.pr + '" fill="#e6edf7" opacity=".35"/><path d="M' + E.px + " " + (E.py - E.pr + 0.5) + "L" + E.px + " " + (E.py + E.pr - 0.5) + '" stroke="#2b3443" stroke-width="1.4" opacity=".45"/></g>';
  } else {
    var ey = E.ey, eh = E.eh;
    if (E.kind === "fan") s += '<path d="M' + E.py + " " + (ey - 3) + "L" + (E.py + 14) + " " + (ey - 3) + "L" + (E.py + 12) + " " + ey + "L" + (E.py + 2) + " " + ey + 'Z" fill="#8d98a8"/>';
    else s += '<path d="' + E.pylon + '" fill="#8d98a8" transform="translate(0 -3)"/>';
    s += '<path d="' + E.d + '" fill="url(#' + idc + 'e)" stroke="#6d7888" stroke-width=".6"/>';
    s += '<path d="M' + (E.ix - 16) + " " + (ey + 0.5) + "L" + (E.ix - 16) + " " + (ey + eh - 0.5) + '" stroke="' + c + '" stroke-width="5" opacity=".95"/>';
    s += '<ellipse cx="' + E.ix + '" cy="' + (ey + eh / 2) + '" rx="2.2" ry="' + (eh / 2 - 0.3) + '" fill="#1e2532" stroke="#c9d1dc" stroke-width="1"/>';
    s += '<path d="M' + E.ex + " " + (ey + eh / 2) + "l-6 0" + '" stroke="#4a5363" stroke-width="2"/>';
  }
  if (S.tip) s += '<path d="' + S.tip + '" fill="' + c + '" opacity=".9"/>';
  if (E.kind !== "rear") s += gl;
  return s;
}
function scaleWrap(t, inner, k) {
  var sc = k == null ? PLANE_SCALE[t] : k;
  if (sc >= 0.999) return inner;
  return '<g transform="translate(' + (120 * (1 - sc)).toFixed(2) + " " + (76 * (1 - sc)).toFixed(2) + ") scale(" + sc + ')">' + inner + "</g>";
}

/* planeSide(type, color, {w=240, flip, fit, simple})
   Each type is drawn at its relative size (Colibri 40 smallest … Skyliner 350 fills the box) so sizes compare at a glance.
   {fit:true} draws every type full-size; {simple:true} drops window/door detail (auto when w < 90). */
CA.planeSide = function (type, color, opt) {
  opt = opt || {}; var w = opt.w || 240, t = ptype(type), c = col(color);
  var simple = opt.simple != null ? !!opt.simple : w < 90;
  var inner = scaleWrap(t, sideG(t, c, uid("p"), simple), opt.fit ? 1 : opt.scale);
  if (opt.flip) inner = '<g transform="translate(240 0) scale(-1 1)">' + inner + "</g>";
  return svgWrap("0 0 240 80", w, Math.round(w / 3), inner, "ca-plane ca-plane-" + PLANE_KEYS[t]);
};
CA._planeSideG = function (type, color) { return sideG(ptype(type), col(color), uid("p")); };

/* planeIcon(type, color, size=64, {title}) — compact list icon: simplified side view, milder size scaling
   (0.74…1) so even the smallest type stays legible at 40–64 px. Returns svg width=size, height=size/3. */
CA.planeIcon = function (type, color, size, opt) {
  opt = opt || {}; size = size || 64; var t = ptype(type), c = col(color);
  var k = 0.74 + (PLANE_SCALE[t] - 0.66) / (1 - 0.66) * 0.26;
  var inner = scaleWrap(t, sideG(t, c, uid("i"), size < 120), k);
  return svgWrap("0 0 240 80", size, Math.round(size / 3), inner, "ca-plane ca-picon ca-plane-" + PLANE_KEYS[t],
    opt.title ? ' role="img"' : "").replace(' aria-hidden="true">', opt.title ? "><title>" + esc(opt.title) + "</title>" : ' aria-hidden="true">');
};

/* top view parts, viewBox 100×100, nose UP, centre (50,50). Optional: prop (stroke), nose (y), hi (highlight end y). */
var TOP = [
  { // 0 Turbo 72
    wing: "M54 35L95 37.5Q96 38 96 39L96 43Q96 44 95 44L54 46ZM46 35L5 37.5Q4 38 4 39L4 43Q4 44 5 44L46 46Z",
    stab: "M51 80L67 82L67 86.5L51 86ZM49 80L33 82L33 86.5L49 86Z",
    body: "M50 9C53.5 9 55 14 55 21L55 76L52.5 90L47.5 90L45 76L45 21C45 14 46.5 9 50 9Z",
    eng: "M29 31a3.5 3.5 0 0 1 7 0v14h-7zM64 31a3.5 3.5 0 0 1 7 0v14h-7z",
    prop: "M22 28.5h21M57 28.5h21", fin: "M50 76L50 89", nose: 15, hi: 72
  },
  { // 1 Aero 320
    wing: "M54 37L94 60Q95 61 94.5 62.5L94 64L54 54ZM46 37L6 60Q5 61 5.5 62.5L6 64L46 54Z",
    stab: "M52.5 79L69 87.5L69 90.5L52 87ZM47.5 79L31 87.5L31 90.5L48 87Z",
    body: "M50 5C53.5 5 54.8 10 54.8 17L54.8 79L52.2 94L47.8 94L45.2 79L45.2 17C45.2 10 46.5 5 50 5Z",
    eng: "M31.5 44a3.25 3.25 0 0 1 6.5 0v10h-6.5zM62 44a3.25 3.25 0 0 1 6.5 0v10h-6.5z", fin: "M50 80L50 93", nose: 11, hi: 72
  },
  { // 2 Skyliner 350 — wide body, four engines on the map
    wing: "M55.5 35L95 62Q97.5 64 97 66.5L96 67.5L55.5 54ZM44.5 35L5 62Q2.5 64 3 66.5L4 67.5L44.5 54Z",
    stab: "M53 81L71 90L71 93.5L53 89ZM47 81L29 90L29 93.5L47 89Z",
    body: "M50 2C54.5 2 56.2 8 56.2 15L56.2 80L53 97L47 97L43.8 80L43.8 15C43.8 8 45.5 2 50 2Z",
    eng: "M28.5 45a4 4 0 0 1 8 0v10h-8zM63.5 45a4 4 0 0 1 8 0v10h-8z", fin: "M50 82L50 96", nose: 9, hi: 74
  },
  { // 3 Colibri 40 — small straight wing, two props, short body
    wing: "M54 39L85 40.5Q86 41 86 42L86 45Q86 46 85 46L54 47ZM46 39L15 40.5Q14 41 14 42L14 45Q14 46 15 46L46 47Z",
    stab: "M51 75L64 76.5L64 80.5L51 80ZM49 75L36 76.5L36 80.5L49 80Z",
    body: "M50 20C53.4 20 54.4 24 54.4 30L54.4 70L52 82L48 82L45.6 70L45.6 30C45.6 24 46.6 20 50 20Z",
    eng: "M29 34a3 3 0 0 1 6 0v12.5h-6zM65 34a3 3 0 0 1 6 0v12.5h-6z",
    prop: "M24 32h16M60 32h16", fin: "M50 72L50 81", nose: 25, hi: 68
  },
  { // 4 Regio 100 — modest sweep, engines on the rear fuselage
    wing: "M54 42L88 60Q89 61 88.6 62.5L88 63.5L54 56ZM46 42L12 60Q11 61 11.4 62.5L12 63.5L46 56Z",
    stab: "M52 82L66 88.5L66 91L52 88ZM48 82L34 88.5L34 91L48 88Z",
    body: "M50 8C53.4 8 54.4 13 54.4 19L54.4 76L52 90L48 90L45.6 76L45.6 19C45.6 13 46.6 8 50 8Z",
    eng: "M55.6 65.5a3.3 3.3 0 0 1 6.6 0v11.5h-6.6zM37.8 65.5a3.3 3.3 0 0 1 6.6 0v11.5h-6.6z", fin: "M50 80L50 89", nose: 13, hi: 62
  },
  { // 5 Cometa 230 — long slim body, raked tips, two big fans
    wing: "M54.7 38L92 63Q94 64.5 95.5 67.5L94 68.5L54.7 55ZM45.3 38L8 63Q6 64.5 4.5 67.5L6 68.5L45.3 55Z",
    stab: "M52.7 82L70 90L70 93L52.5 89ZM47.3 82L30 90L30 93L47.5 89Z",
    body: "M50 3C53.8 3 54.9 8 54.9 15L54.9 81L52.2 96L47.8 96L45.1 81L45.1 15C45.1 8 46.2 3 50 3Z",
    eng: "M29.5 44a3.75 3.75 0 0 1 7.5 0v11.5h-7.5zM63 44a3.75 3.75 0 0 1 7.5 0v11.5h-7.5z", fin: "M50 82L50 95", nose: 9, hi: 74
  }
];
function topParts(t) { var P = TOP[t] || TOP[1], o = {}; for (var k in P) o[k] = P[k]; return o; }
function topColors(c, frozen) {
  if (frozen) return { body: "#e6f7ff", wing: "#b8e4fa", eng: "#6fb6dc", line: "#3d8fc0", hi: "#ffffff" };
  return { body: shade(c, 0.12), wing: c, eng: shade(c, -0.5), line: shade(c, -0.62), hi: shade(c, 0.6) };
}
function topG(t, c, frozen) {
  var P = topParts(t), K = topColors(c, frozen), sw = 1.3, n = P.nose;
  var s = '<g stroke="' + K.line + '" stroke-width="' + sw + '" stroke-linejoin="round">' +
    '<path d="' + P.wing + '" fill="' + K.wing + '"/><path d="' + P.stab + '" fill="' + K.wing + '"/>' +
    '<path d="' + P.eng + '" fill="' + K.eng + '"/>' +
    '<path d="' + P.body + '" fill="' + K.body + '"/></g>' +
    '<path d="M50 ' + n + 'L50 ' + P.hi + '" stroke="' + K.hi + '" stroke-width="2" stroke-linecap="round" opacity=".8"/>' +
    '<path d="M47.6 ' + n + 'Q50 ' + (n - 3) + ' 52.4 ' + n + '" stroke="#132036" stroke-width="2.2" fill="none" stroke-linecap="round"/>';
  if (P.prop) s += '<path d="' + P.prop + '" stroke="' + K.line + '" stroke-width="1.6" stroke-linecap="round" opacity=".75"/>';
  if (frozen) s += '<path d="M20 50l6 -3M76 47l6 3M44 22l-4 -2M58 70l4 2" stroke="#fff" stroke-width="1.2" stroke-linecap="round"/>';
  return s;
}
CA.planeTop = function (type, color, opt) {
  opt = opt || {}; var size = opt.size || 48, t = ptype(type), c = col(color);
  var inner = topG(t, c, !!opt.frozen);
  if (opt.heading) inner = '<g transform="rotate(' + (+opt.heading) + ' 50 50)">' + inner + "</g>";
  if (opt.shadow !== false) inner = '<g transform="translate(3 4)" opacity=".25">' + topG(t, "#000000", false).replace(/fill="#[0-9a-f]{6}"/g, 'fill="#000"').replace(/stroke="#[0-9a-f]{6}"/g, 'stroke="none"') + "</g>" + inner;
  return svgWrap("0 0 100 100", size, size, inner, "ca-ptop ca-ptop-" + PLANE_KEYS[t]);
};
var _imgCache = {};
CA.planeImg = function (type, color, size, frozen) {
  if (!HAS_DOM) return null;
  var t = ptype(type), c = col(color); size = Math.round(size || 32);
  var key = t + "|" + c + "|" + size + "|" + (frozen ? 1 : 0);
  if (_imgCache[key]) return _imgCache[key];
  var dpr = Math.min(3, G.devicePixelRatio || 1), cv = document.createElement("canvas");
  cv.width = cv.height = Math.round(size * dpr);
  var g = cv.getContext("2d"); if (!g || typeof Path2D === "undefined") return cv;
  g.scale(size * dpr / 100, size * dpr / 100);
  var P = topParts(t), K = topColors(c, frozen);
  g.lineJoin = "round"; g.lineWidth = 2; g.strokeStyle = K.line;
  var fs = function (d, f, noStroke) { var p = new Path2D(d); g.fillStyle = f; g.fill(p); if (!noStroke) g.stroke(p); };
  g.save(); g.translate(2.5, 3.5); g.globalAlpha = 0.28;
  ["wing", "stab", "body"].forEach(function (k) { fs(P[k], "#000", true); }); g.restore();
  fs(P.wing, K.wing); fs(P.stab, K.wing); fs(P.eng, K.eng); fs(P.body, K.body);
  g.strokeStyle = K.hi; g.lineWidth = 2.6; g.lineCap = "round"; g.globalAlpha = 0.85;
  g.beginPath(); g.moveTo(50, P.nose); g.lineTo(50, P.hi); g.stroke(); g.globalAlpha = 1;
  if (P.prop) { g.strokeStyle = K.line; g.lineWidth = 2; g.stroke(new Path2D(P.prop)); }
  _imgCache[key] = cv; return cv;
};
CA.planeTopPaths = function (type) { return topParts(ptype(type)); };

/* planeMapSprite(type, color, mode="n", dpr=1) -> cached canvas, drop-in for CerulMap's planeSprite():
   same pixel size (ceil(64·dpr·0.75)), nose UP, one merged outline. mode: "n" rival · "m" mine (lighter) · "ice" frozen · "shadow".
   Every type has its own outline and engine layout (props / under-wing fans / rear pods). */
var _mapCache = {};
CA.planeMapSprite = function (type, color, mode, dpr) {
  if (!HAS_DOM) return null;
  var t = ptype(type), c = col(color, "#ffb347"); mode = mode || "n"; dpr = dpr || 1;
  var key = t + "|" + c + "|" + mode + "|" + dpr;
  if (_mapCache[key]) return _mapCache[key];
  var px = Math.ceil(64 * dpr * 0.75), cv = document.createElement("canvas"); cv.width = cv.height = px;
  var g = cv.getContext("2d"); if (!g || typeof Path2D === "undefined") return cv;
  g.scale(px / 100, px / 100);
  var P = topParts(t), parts = [P.wing, P.stab, P.body].map(function (d) { return new Path2D(d); });
  var eng = new Path2D(P.eng), frozen = mode === "ice";
  if (mode === "shadow") {
    g.filter = "blur(" + (2.2 * 100 / 64).toFixed(2) + "px)"; g.fillStyle = "rgba(0,6,20,.55)";
    parts.forEach(function (p) { g.fill(p); }); g.fill(eng); g.filter = "none";
    _mapCache[key] = cv; return cv;
  }
  var mineM = mode === "m";
  var fc = frozen ? "#cdefff" : mineM ? mix(c, "#ffffff", 0.62) : c;
  var dark = frozen ? "#2a7fae" : mix(c, "#081428", mineM ? 0.35 : 0.55);
  var light = frozen ? "#ffffff" : mineM ? "#ffffff" : mix(c, "#ffffff", 0.55);
  if (frozen) { g.save(); g.filter = "blur(4.5px)"; g.fillStyle = "rgba(140,225,255,.9)"; parts.forEach(function (p) { g.fill(p); }); g.restore(); }
  // merged outline: stroke everything thick first, then fill → no inner seams
  g.lineJoin = "round"; g.strokeStyle = dark; g.lineWidth = 6.8;
  parts.forEach(function (p) { g.stroke(p); }); g.stroke(eng);
  g.fillStyle = dark; g.fill(eng);
  var gr = g.createLinearGradient(0, 0, 100, 100); gr.addColorStop(0, light); gr.addColorStop(0.45, fc); gr.addColorStop(1, mix(fc, "#000000", 0.25));
  g.fillStyle = gr; parts.forEach(function (p) { g.fill(p); });
  // engines on top of the wing (rear pods of the Regio sit beside the tail)
  g.fillStyle = dark; g.fill(eng);
  // fuselage highlight & cockpit
  g.strokeStyle = "rgba(255,255,255,.75)"; g.lineWidth = 2.5; g.lineCap = "round";
  g.beginPath(); g.moveTo(50, P.nose); g.lineTo(50, P.hi); g.stroke();
  g.fillStyle = frozen ? "#5bc8f0" : "rgba(10,25,50,.8)"; g.beginPath(); g.ellipse(50, P.nose - 1.5, 3.2, 2.6, 0, 0, Math.PI * 2); g.fill();
  if (P.prop) { g.strokeStyle = "rgba(255,255,255,.85)"; g.lineWidth = 2; g.stroke(new Path2D(P.prop)); }
  if (frozen) {
    g.strokeStyle = "rgba(255,255,255,.95)"; g.lineWidth = 1.8;
    [[22, 47, 5.5], [78, 53, 4.7], [50, 81, 4.7], [38, 22, 3.9]].forEach(function (q) {
      g.beginPath(); for (var a = 0; a < 3; a++) { var r = a * Math.PI / 3; g.moveTo(q[0] - Math.cos(r) * q[2], q[1] - Math.sin(r) * q[2]); g.lineTo(q[0] + Math.cos(r) * q[2], q[1] + Math.sin(r) * q[2]); } g.stroke();
    });
  }
  _mapCache[key] = cv; return cv;
};

/* =========================================================== CARDS */
var CARD = {
  apr:    { name: "Aprobare", sub: "Acte și avize de zbor", c: ["#4f8ff0", "#1b3a8c"], acc: "#9cc5ff" },
  inf:    { short: "Infrastr.", name: "Infrastructură", sub: "Terminale și piste", c: ["#d08a45", "#6a3514"], acc: "#ffd2a0" },
  ech:    { name: "Echipaj", sub: "Piloți și însoțitori", c: ["#3cb57d", "#0f4e33"], acc: "#a8f0c8" },
  comb:   { name: "Combustibil", sub: "Kerosen pentru zboruri", c: ["#e65a55", "#6c1520"], acc: "#ffb3a8" },
  joker:  { name: "Joker", sub: "Ține locul oricărei cărți", c: ["#ffb347", "#c2367a"], acc: "#fff1b0" },
  freeze: { short: "Îngheață", sp: 1, name: "Îngheață timpul", sub: "O companie stă pe loc 30 de secunde", acc: "#7fd6ff" },
  breaker:{ short: "Spărgător", sp: 1, name: "Spărgător de gheață", sub: "Anulează o înghețare", acc: "#ff8a3d" },
  rapid:  { short: "Rapidă", sp: 1, name: "Construcție rapidă", sub: "Construiești cu o carte mai puțin", acc: "#ffb13d" },
  vip:    { short: "Permis VIP", sp: 1, name: "Permis VIP", sub: "Alegi liber orice permis", acc: "#ffd35c" },
  boom:   { short: "Boom", sp: 1, name: "Boom de pasageri", sub: "Cerere ×2 pe o rută, 3 zile", acc: "#5fe08a" },
  fuelc:  { short: "Kerosen −30%", sp: 1, name: "Contract de combustibil", sub: "−30% la combustibil, 5 zile", acc: "#ff6b6b" },
  spy:    { sp: 1, name: "Spion", sub: "Vezi prețul și profitul unei rute", acc: "#b892ff" },
  ad:     { short: "Reclamă", sp: 1, name: "Campanie de reclamă", sub: "+1 stea timp de 7 zile", acc: "#ff7ad1" },
  insure: { sp: 1, name: "Asigurare", sub: "Anulează un eveniment negativ", acc: "#4fd1c5" },
  slot:   { short: "Slot +1", sp: 1, name: "Slot suplimentar", sub: "+1 slot la un aeroport plin", acc: "#9fb4ff" },
  gift:   { short: "Avion cadou", sp: 1, name: "Avion cadou", sub: "Un Turbo 72 gratuit", acc: "#ffd35c" }
};
CA.CARD_KEYS = Object.keys(CARD);
var _ckCache = {};
function ckey(card) {
  if (card == null) return "joker";
  if (typeof card === "object") card = card.k != null ? card.k : card.key != null ? card.key : card.t != null ? card.t : card.type != null ? card.type : card.id != null ? card.id : card.name;
  var raw = String(card);
  if (CARD[raw]) return raw;
  var AL = { aprobare: "apr", infra: "inf", infrastructura: "inf", echipaj: "ech", combustibil: "comb", fastbuild: "rapid", fuel: "fuelc", ads: "ad", insurance: "insure", giftplane: "gift", res_apr: "apr" };
  if (AL[raw]) return AL[raw];
  if (_ckCache[raw]) return _ckCache[raw];
  var EM = [["🛂", "apr"], ["🏗", "inf"], ["✈️‍", "ech"], ["👨‍✈", "ech"], ["👩‍✈", "ech"], ["⭐", "joker"], ["❄", "freeze"], ["🔥", "breaker"], ["🚀", "rapid"], ["🎟", "vip"], ["📈", "boom"], ["🔍", "spy"], ["📣", "ad"], ["🧯", "insure"], ["🏛", "slot"], ["✈", "gift"], ["⛽", "comb"]];
  for (var e = 0; e < EM.length; e++) if (raw.indexOf(EM[e][0]) >= 0 && raw.replace(/[^A-Za-z]/g, "").length < 3) return (_ckCache[raw] = EM[e][1]);
  var s = noDia(raw).replace(/[^a-z0-9]/g, "");
  // look up CerulData.CARDS entry (id → name) if present
  var D = G.CerulData, L = D && D.CARDS, nm = "";
  if (L) {
    var arr = Array.isArray(L) ? L : Object.keys(L).map(function (k) { var o = L[k]; return o && typeof o === "object" ? Object.assign({ id: k }, o) : { id: k, n: o }; });
    for (var i = 0; i < arr.length; i++) { var o = arr[i]; if (o && (String(o.id) === raw || String(o.k) === raw || String(o.key) === raw)) { nm = noDia(o.name || o.n || o.title || "").replace(/[^a-z0-9]/g, ""); break; } }
  }
  var t = s + "|" + nm, r = "joker";
  var tests = [
    ["breaker", /sparg|break|incalz|fire|foc/], ["freeze", /inghet|freez|ice|gheat/], ["rapid", /rapid|fast|quick/], ["vip", /vip/],
    ["boom", /boom|surge/], ["fuelc", /contract|fuelc|fueldeal|fuelcontract/], ["spy", /spion|spy/], ["ad", /reclam|campan|advert|^ad\b|^ad\|/],
    ["insure", /asigur|insur/], ["slot", /slot/], ["gift", /cadou|gift|plane|avion/],
    ["joker", /joker|jok|wild/], ["apr", /aprob|apr|aviz|permit|approval/], ["inf", /infra|^inf/], ["ech", /echip|crew|^ech/], ["comb", /combust|fuel|^comb|kero/]
  ];
  for (var j = 0; j < tests.length; j++) if (tests[j][1].test(t)) { r = tests[j][0]; break; }
  if (r === "joker" && !/jok|wild/.test(t)) {
    var one = { a: "apr", i: "inf", e: "ech", c: "comb", f: "comb", j: "joker" }[s[0]];
    if (s.length <= 2 && one) r = one;
  }
  _ckCache[raw] = r; return r;
}
CA.cardKey = ckey;
CA.cardInfo = function (card) { var k = ckey(card), c = CARD[k]; return { key: k, name: c.name, sub: c.sub, color: c.sp ? c.acc : c.c[0], special: !!c.sp }; };

function star(cx, cy, R, r, n) { var d = ""; n = n || 5; for (var i = 0; i < n * 2; i++) { var a = -Math.PI / 2 + i * Math.PI / n, q = i % 2 ? r : R; d += (i ? "L" : "M") + (cx + Math.cos(a) * q).toFixed(1) + " " + (cy + Math.sin(a) * q).toFixed(1); } return d + "Z"; }
function spark(x, y, r, c) { return '<path d="M' + x + " " + (y - r) + "Q" + x + " " + y + " " + (x + r) + " " + y + "Q" + x + " " + y + " " + x + " " + (y + r) + "Q" + x + " " + y + " " + (x - r) + " " + y + "Q" + x + " " + y + " " + x + " " + (y - r) + 'Z" fill="' + (c || "#fff") + '"/>'; }
function snowflake(cx, cy, r, c, w) {
  var s = "";
  for (var i = 0; i < 6; i++) {
    var a = i * Math.PI / 3, x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
    s += "M" + cx + " " + cy + "L" + x.toFixed(1) + " " + y.toFixed(1);
    var bx = cx + Math.cos(a) * r * 0.6, by = cy + Math.sin(a) * r * 0.6;
    for (var k = -1; k <= 1; k += 2) { var b = a + k * 0.75; s += "M" + bx.toFixed(1) + " " + by.toFixed(1) + "L" + (bx + Math.cos(b) * r * 0.3).toFixed(1) + " " + (by + Math.sin(b) * r * 0.3).toFixed(1); }
  }
  return '<path d="' + s + '" stroke="' + c + '" stroke-width="' + w + '" stroke-linecap="round" fill="none"/>';
}

/* card illustrations, 100×100 box, flat fills (safe at any size) */
var ART = {
  apr: function () {
    return '<g transform="rotate(-10 40 48)"><rect x="16" y="14" width="50" height="68" rx="6" fill="#0f2a6b"/><rect x="16" y="14" width="50" height="68" rx="6" fill="none" stroke="#06143a" stroke-width="2"/>' +
      '<rect x="20" y="14" width="3" height="68" fill="#0a1e52"/>' +
      '<circle cx="42" cy="42" r="12" fill="none" stroke="#f0c75e" stroke-width="2.4"/><path d="M30 42h24M42 30v24M33 35q9 5 18 0M33 49q9 -5 18 0" stroke="#f0c75e" stroke-width="1.4" fill="none"/>' +
      '<rect x="28" y="62" width="28" height="3" rx="1.5" fill="#f0c75e"/><rect x="31" y="69" width="22" height="2.4" rx="1.2" fill="#f0c75e" opacity=".7"/></g>' +
      '<g transform="rotate(14 68 64)"><circle cx="68" cy="64" r="20" fill="#fff" opacity=".9"/><circle cx="68" cy="64" r="20" fill="none" stroke="#e23b48" stroke-width="3.2"/><circle cx="68" cy="64" r="15" fill="none" stroke="#e23b48" stroke-width="1.2" stroke-dasharray="2 2"/>' +
      '<path d="M59 64l6 6l12 -13" stroke="#e23b48" stroke-width="4.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g>';
  },
  inf: function () {
    return '<rect x="6" y="80" width="88" height="7" rx="2" fill="#3a2a1c"/><path d="M10 82L90 82" stroke="#ffd35c" stroke-width="1.4" stroke-dasharray="5 4"/>' +
      '<path d="M8 80L8 60Q28 48 52 56L52 80Z" fill="#9fd8ff"/><path d="M8 60Q28 48 52 56L52 60Q28 53 8 64Z" fill="#e9eef5"/><path d="M16 60v20M24 57v23M32 55v25M40 55v25M48 56v24" stroke="#4d7fa8" stroke-width="1.2"/>' +
      '<path d="M60 80L62 34L72 34L74 80Z" fill="#f1ebe0"/><path d="M68 34L69 80L74 80L72 34Z" fill="#c9bfae"/>' +
      '<path d="M50 22L84 22L80 34L54 34Z" fill="#16314f"/><path d="M54 24L66 24L64 32L57 32Z" fill="#7fd0ff" opacity=".85"/><path d="M68 24L80 24L77 32L68 32Z" fill="#7fd0ff" opacity=".55"/>' +
      '<path d="M52 16L82 16L84 22L50 22Z" fill="#e3dccf"/><path d="M48 34L86 34L84 37L50 37Z" fill="#c9bfae"/>' +
      '<path d="M67 16L67 5" stroke="#c9bfae" stroke-width="2"/><circle cx="67" cy="5" r="2.6" fill="#ff4d4d"/>' +
      '<g transform="translate(22 26) rotate(-12)"><path d="M-12 0L10 -2Q14 -2 14 0Q14 2 10 2L-12 0Z M0 -1L-4 -9L-1 -9L5 -1Z M0 1L-4 9L-1 9L5 1Z M-11 0L-14 -4L-12 -4L-8 0Z" fill="#fff"/></g>';
  },
  ech: function () {
    return '<path d="M12 52Q14 26 50 22Q86 26 88 52Q70 60 50 60Q30 60 12 52Z" fill="#1d2747"/><path d="M18 46Q22 30 50 27Q64 28 74 34Q52 30 30 40Z" fill="#33406a"/>' +
      '<path d="M18 52L82 52L80 66L20 66Z" fill="#0d1328"/><path d="M20 58L80 58" stroke="#f0c75e" stroke-width="2"/><path d="M20 62L80 62" stroke="#f0c75e" stroke-width="1" opacity=".7"/>' +
      '<path d="M18 66Q50 86 82 66Q76 74 50 78Q24 74 18 66Z" fill="#0a0d17"/><path d="M28 70Q50 80 72 70" stroke="#fff" stroke-opacity=".3" stroke-width="1.4" fill="none"/>' +
      '<g transform="translate(50 42)"><path d="M-22 0Q-12 -8 -3 -2L-3 2Q-12 -2 -22 0ZM22 0Q12 -8 3 -2L3 2Q12 -2 22 0Z" fill="#f0c75e"/><path d="M-20 3Q-12 0 -4 4M20 3Q12 0 4 4" stroke="#f0c75e" stroke-width="1.4" fill="none"/><circle r="5.5" fill="#f0c75e"/><circle r="3" fill="#1d2747"/><path d="M0 -2.5L1 0L3 .3L1.2 1.6L1.8 3.6L0 2.4L-1.8 3.6L-1.2 1.6L-3 .3L-1 0Z" fill="#f0c75e"/></g>';
  },
  comb: function () {
    return '<rect x="18" y="82" width="50" height="7" rx="2" fill="#2a1a1a"/>' +
      '<rect x="22" y="16" width="40" height="68" rx="7" fill="#f2f2f2"/><rect x="22" y="16" width="40" height="68" rx="7" fill="none" stroke="#7a1520" stroke-width="2"/><rect x="22" y="50" width="40" height="34" rx="0" fill="#d93a3f"/><path d="M22 77Q22 84 29 84L55 84Q62 84 62 77Z" fill="#b12a32"/>' +
      '<rect x="28" y="23" width="28" height="18" rx="3" fill="#0f2233"/><text x="42" y="36" text-anchor="middle" font-family="ui-monospace,Consolas,monospace" font-size="10" font-weight="700" fill="#7fffc4">88.8</text>' +
      '<path d="M42 56C42 56 34 66 34 71A8 8 0 0 0 50 71C50 66 42 56 42 56Z" fill="#ffd35c"/><path d="M38 71a4 4 0 0 0 4 4" stroke="#fff" stroke-width="1.6" fill="none" opacity=".8"/>' +
      '<path d="M62 30Q80 30 80 48L80 70Q80 78 74 78" stroke="#222" stroke-width="4" fill="none" stroke-linecap="round"/>' +
      '<path d="M66 20L84 20L88 28L82 28L80 38L72 38L72 28L66 28Z" fill="#2b2f36"/><path d="M70 22L82 22" stroke="#fff" stroke-opacity=".3" stroke-width="1.5"/>';
  },
  joker: function () {
    return '<circle cx="50" cy="50" r="38" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="2" stroke-dasharray="3 5"/>' +
      '<path d="' + star(50, 52, 36, 15) + '" fill="#ffd35c" stroke="#b9770e" stroke-width="2.4" stroke-linejoin="round"/>' +
      '<path d="' + star(50, 52, 24, 10) + '" fill="#fff3b8"/>' +
      '<path d="M41 50q3 -4 6 0M53 50q3 -4 6 0" stroke="#7a4a00" stroke-width="2.2" fill="none" stroke-linecap="round"/><path d="M43 58q7 6 14 0" stroke="#7a4a00" stroke-width="2.2" fill="none" stroke-linecap="round"/>' +
      spark(16, 22, 7) + spark(84, 26, 6) + spark(82, 80, 5) + spark(18, 78, 5);
  },
  freeze: function () {
    return '<circle cx="48" cy="54" r="32" fill="#dff4ff"/><circle cx="48" cy="54" r="32" fill="none" stroke="#7fd6ff" stroke-width="5"/>' +
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(function (i) { var a = i * Math.PI / 6; return '<path d="M' + (48 + Math.cos(a) * 25).toFixed(1) + " " + (54 + Math.sin(a) * 25).toFixed(1) + "L" + (48 + Math.cos(a) * 28).toFixed(1) + " " + (54 + Math.sin(a) * 28).toFixed(1) + '" stroke="#3b7fae" stroke-width="2"/>'; }).join("") +
      '<path d="M48 54L48 36M48 54L60 62" stroke="#173a5a" stroke-width="3.4" stroke-linecap="round"/><circle cx="48" cy="54" r="3" fill="#173a5a"/>' +
      '<path d="M14 40Q14 18 48 18Q84 18 82 40L78 40L77 48L74 40L68 40L66 52L62 40L54 40L52 46L49 40L40 40L38 50L35 40L26 40L24 47L22 40Z" fill="#fff" opacity=".92"/>' +
      '<path d="M22 28Q36 20 52 22" stroke="#bfe9ff" stroke-width="2" fill="none" stroke-linecap="round"/>' +
      snowflake(78, 78, 15, "#ffffff", 3.2) + spark(16, 82, 5, "#bfe9ff");
  },
  breaker: function () {
    return '<path d="M50 90C28 90 18 74 22 58C25 46 34 42 34 30C42 36 44 44 44 50C48 40 52 26 64 14C64 30 76 38 78 54C80 72 70 90 50 90Z" fill="#ff5a1f"/>' +
      '<path d="M50 90C36 90 30 80 33 70C35 62 42 58 42 50C48 56 50 62 50 66C54 58 58 50 62 44C64 56 70 62 68 74C66 84 60 90 50 90Z" fill="#ffb02e"/>' +
      '<path d="M50 90C44 90 40 85 42 79C43 74 48 72 48 66C54 72 58 76 58 81C58 86 55 90 50 90Z" fill="#fff1a8"/>' +
      '<g fill="#bfe9ff" stroke="#fff" stroke-width="1.2" stroke-linejoin="round"><path d="M10 34L20 26L24 38Z"/><path d="M80 22L92 30L82 36Z"/><path d="M8 66L16 60L18 72Z"/><path d="M86 62L96 70L84 74Z"/><path d="M26 14L32 8L34 18Z"/></g>' +
      '<path d="M14 46L22 48M84 46L92 44M30 22L34 28M72 22L68 28" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".8"/>';
  },
  rapid: function () {
    return '<g transform="rotate(40 50 50)"><path d="M50 6C62 18 66 34 64 56L36 56C34 34 38 18 50 6Z" fill="#f4f6fa"/><path d="M50 6C56 12 60 20 62 30L38 30C40 20 44 12 50 6Z" fill="#ff4d4d"/>' +
      '<circle cx="50" cy="40" r="7" fill="#1f5fa8" stroke="#c9d6e8" stroke-width="2.4"/><circle cx="48" cy="38" r="2" fill="#fff" opacity=".8"/>' +
      '<path d="M36 46L24 62L36 60Z M64 46L76 62L64 60Z" fill="#ff4d4d"/><rect x="40" y="56" width="20" height="5" rx="1" fill="#8a96a8"/>' +
      '<path d="M41 61Q50 92 59 61Z" fill="#ffb02e"/><path d="M45 61Q50 80 55 61Z" fill="#fff1a8"/></g>' +
      '<path d="M8 74L26 70M12 84L28 78M20 92L32 84" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".55"/>' + spark(84, 14, 6, "#ffd35c") + spark(18, 22, 4);
  },
  vip: function () {
    return '<g transform="rotate(-12 50 50)"><path d="M10 30L90 30L90 42A8 8 0 0 0 90 58L90 70L10 70L10 58A8 8 0 0 0 10 42Z" fill="#ffd35c" stroke="#a8740c" stroke-width="2.4"/>' +
      '<path d="M16 36L84 36L84 64L16 64Z" fill="none" stroke="#a8740c" stroke-width="1.2" stroke-dasharray="3 2"/>' +
      '<path d="M68 30L68 70" stroke="#a8740c" stroke-width="1.6" stroke-dasharray="3 3"/>' +
      '<text x="40" y="58" text-anchor="middle" font-family="Georgia,serif" font-size="21" font-weight="900" fill="#5a3a00">VIP</text>' +
      '<path d="' + star(77, 50, 7, 3) + '" fill="#5a3a00"/></g>' + spark(16, 18, 6) + spark(86, 84, 7, "#fff3b8") + spark(80, 16, 4);
  },
  boom: function () {
    return '<rect x="12" y="62" width="14" height="24" rx="2" fill="#2f8f5b"/><rect x="32" y="50" width="14" height="36" rx="2" fill="#38a86a"/><rect x="52" y="36" width="14" height="50" rx="2" fill="#44c47c"/><rect x="72" y="20" width="14" height="66" rx="2" fill="#5fe08a"/>' +
      '<path d="M10 58L34 40L52 46L80 14" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M68 12L84 10L82 26Z" fill="#fff"/>' +
      '<g fill="#e9fff2"><circle cx="20" cy="30" r="5"/><path d="M12 44Q20 34 28 44Z"/><circle cx="34" cy="22" r="4"/><path d="M28 33Q34 26 40 33Z"/></g>' +
      '<rect x="8" y="86" width="84" height="3" rx="1.5" fill="#fff" opacity=".6"/>';
  },
  fuelc: function () {
    return '<rect x="14" y="24" width="44" height="62" rx="6" fill="#2d6aa0"/><rect x="14" y="24" width="44" height="62" rx="6" fill="none" stroke="#163a5e" stroke-width="2"/>' +
      '<path d="M14 38H58M14 72H58" stroke="#163a5e" stroke-width="3"/><path d="M18 26L18 84" stroke="#fff" stroke-opacity=".25" stroke-width="4"/>' +
      '<ellipse cx="36" cy="24" rx="22" ry="4" fill="#3d82bf"/><circle cx="46" cy="24" r="2.4" fill="#163a5e"/>' +
      '<path d="M36 46C36 46 29 55 29 59A7 7 0 0 0 43 59C43 55 36 46 36 46Z" fill="#ffd35c"/>' +
      '<g transform="rotate(14 70 60)"><path d="M52 44L88 44L94 60L88 76L52 76Z" fill="#ff5a5f" stroke="#8a1820" stroke-width="2" stroke-linejoin="round"/><circle cx="86" cy="60" r="3" fill="#8a1820"/>' +
      '<text x="69" y="65" text-anchor="middle" font-family="system-ui,Segoe UI,sans-serif" font-size="14" font-weight="900" fill="#fff">−30%</text></g>';
  },
  spy: function () {
    return '<path d="M62 64L86 88" stroke="#3b2a55" stroke-width="12" stroke-linecap="round"/><path d="M62 64L86 88" stroke="#7d5bb8" stroke-width="7" stroke-linecap="round"/>' +
      '<circle cx="42" cy="42" r="28" fill="#e8f4ff"/><circle cx="42" cy="42" r="28" fill="none" stroke="#b892ff" stroke-width="7"/>' +
      '<path d="M22 42Q42 24 62 42Q42 60 22 42Z" fill="#fff" stroke="#3b2a55" stroke-width="2"/><circle cx="42" cy="42" r="8" fill="#5b3fa0"/><circle cx="42" cy="42" r="3.5" fill="#120a20"/><circle cx="44.5" cy="39.5" r="1.8" fill="#fff"/>' +
      '<path d="M24 26Q32 18 42 18" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" opacity=".8"/>';
  },
  ad: function () {
    return '<path d="M14 40L30 40L66 18L66 82L30 60L14 60Z" fill="#ff7ad1" stroke="#7a1f5c" stroke-width="2.4" stroke-linejoin="round"/>' +
      '<rect x="8" y="38" width="12" height="24" rx="3" fill="#7a1f5c"/><path d="M30 60L36 82L46 82L42 64Z" fill="#7a1f5c"/>' +
      '<path d="M30 42L64 22" stroke="#fff" stroke-width="2.4" opacity=".55" stroke-linecap="round"/>' +
      '<path d="M76 38Q84 50 76 62M84 30Q96 50 84 70" stroke="#fff" stroke-width="3.4" fill="none" stroke-linecap="round"/>' +
      '<path d="' + star(80, 16, 9, 4) + '" fill="#ffd35c"/>' + spark(90, 84, 5);
  },
  insure: function () {
    return '<path d="M50 8L84 20L84 46C84 68 70 84 50 92C30 84 16 68 16 46L16 20Z" fill="#1f8f86" stroke="#0b4d48" stroke-width="2.4"/>' +
      '<path d="M50 16L76 26L76 46C76 63 66 76 50 83Z" fill="#4fd1c5"/><path d="M50 16L24 26L24 46C24 63 34 76 50 83Z" fill="#33b3a8"/>' +
      '<path d="M34 50L46 62L68 38" stroke="#fff" stroke-width="7" fill="none" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<path d="M28 28L48 21" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".6"/>';
  },
  slot: function () {
    return '<path d="M10 34L50 12L90 34Z" fill="#c9d4f5" stroke="#3a4a80" stroke-width="2" stroke-linejoin="round"/><rect x="12" y="34" width="76" height="6" fill="#aab8e8"/>' +
      '<g fill="#e6ecff"><rect x="18" y="42" width="8" height="34"/><rect x="34" y="42" width="8" height="34"/><rect x="58" y="42" width="8" height="34"/><rect x="74" y="42" width="8" height="34"/></g>' +
      '<g fill="#aab8e8"><rect x="23" y="42" width="3" height="34"/><rect x="39" y="42" width="3" height="34"/><rect x="63" y="42" width="3" height="34"/><rect x="79" y="42" width="3" height="34"/></g>' +
      '<rect x="8" y="76" width="84" height="6" fill="#aab8e8"/><rect x="4" y="82" width="92" height="6" rx="1" fill="#8a9ad4"/>' +
      '<circle cx="50" cy="26" r="5" fill="#3a4a80"/>' +
      '<circle cx="78" cy="62" r="17" fill="#5fe08a" stroke="#0f5a33" stroke-width="2.4"/><text x="78" y="68.5" text-anchor="middle" font-family="system-ui,Segoe UI,sans-serif" font-size="17" font-weight="900" fill="#0b3a20">+1</text>';
  },
  gift: function () {
    return '<rect x="16" y="46" width="68" height="44" rx="4" fill="#e23b48"/><rect x="12" y="36" width="76" height="14" rx="3" fill="#ff5a64"/>' +
      '<rect x="44" y="36" width="12" height="54" fill="#ffd35c"/><path d="M16 60L84 60" stroke="#b12a32" stroke-width="1.4" opacity=".6"/>' +
      '<path d="M50 36C40 22 26 24 30 32C33 38 44 37 50 36ZM50 36C60 22 74 24 70 32C67 38 56 37 50 36Z" fill="#ffd35c" stroke="#a8740c" stroke-width="1.6"/>' +
      '<g transform="translate(66 18) rotate(30) scale(.42) translate(-50 -50)"><path d="M54 37L94 60L94 64L54 54ZM46 37L6 60L6 64L46 54Z M52.5 79L69 87.5L69 90.5L52 87ZM47.5 79L31 87.5L31 90.5L48 87Z" fill="#fff"/><path d="M50 5C53.5 5 54.8 10 54.8 17L54.8 79L52.2 94L47.8 94L45.2 79L45.2 17C45.2 10 46.5 5 50 5Z" fill="#fff"/></g>' +
      spark(18, 18, 6) + spark(90, 46, 4);
  }
};

function wrapText(s, max) {
  var w = String(s).split(" "), lines = [], cur = "";
  w.forEach(function (x) { if ((cur + " " + x).trim().length > max && cur) { lines.push(cur); cur = x; } else cur = (cur + " " + x).trim(); });
  if (cur) lines.push(cur); return lines;
}
var FONT = "system-ui,-apple-system,'Segoe UI',Roboto,sans-serif";

function cardInner(k, opt) {
  var C = CARD[k], id = uid("c"), sp = !!C.sp, s = "", acc = C.acc;
  var c0 = sp ? "#1e3566" : C.c[0], c1 = sp ? "#0a1430" : C.c[1];
  s += '<linearGradient id="' + id + 'b" x1="0" y1="0" x2=".3" y2="1"><stop offset="0" stop-color="' + c0 + '"/><stop offset="1" stop-color="' + c1 + '"/></linearGradient>';
  s += '<radialGradient id="' + id + 'g" cx=".5" cy=".38" r=".5"><stop offset="0" stop-color="' + (sp ? acc : "#ffffff") + '" stop-opacity="' + (sp ? .55 : .35) + '"/><stop offset="1" stop-color="' + (sp ? acc : "#ffffff") + '" stop-opacity="0"/></radialGradient>';
  s += '<linearGradient id="' + id + 's" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".38"/><stop offset=".35" stop-color="#fff" stop-opacity="0"/></linearGradient>';
  if (sp) s += '<linearGradient id="' + id + 'o" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff2b8"/><stop offset=".45" stop-color="#e8b84a"/><stop offset=".7" stop-color="#a9741c"/><stop offset="1" stop-color="#f6d77a"/></linearGradient>';
  s += '<clipPath id="' + id + 'c"><rect x="3" y="3" width="114" height="164" rx="10"/></clipPath>';
  s += '<rect x="1" y="1" width="118" height="168" rx="12" fill="' + (sp ? "url(#" + id + "o)" : shade(c1, -0.35)) + '"/>';
  s += '<rect x="3" y="3" width="114" height="164" rx="10" fill="url(#' + id + 'b)"/>';
  s += '<g clip-path="url(#' + id + 'c)">';
  // decorative globe lines
  s += '<g fill="none" stroke="#fff" stroke-opacity="' + (sp ? .07 : .1) + '" stroke-width="1"><circle cx="60" cy="66" r="52"/><ellipse cx="60" cy="66" rx="26" ry="52"/><ellipse cx="60" cy="66" rx="52" ry="20"/><path d="M8 66H112M60 14V118"/></g>';
  if (sp) for (var i = 0; i < 14; i++) { var r = rngFrom(hash(k) + i * 31); s += '<circle cx="' + (8 + r() * 104).toFixed(1) + '" cy="' + (8 + r() * 104).toFixed(1) + '" r="' + (0.5 + r() * 1.2).toFixed(1) + '" fill="#fff" opacity="' + (0.3 + r() * 0.5).toFixed(2) + '"/>'; }
  s += '<circle cx="60" cy="66" r="50" fill="url(#' + id + 'g)"/>';
  var mini = !!opt.mini;
  var nm = mini ? [C.short || C.name] : wrapText(C.name, 12), two = nm.length > 1;
  var py = mini ? 124 : two ? 106 : 118;
  s += two ? '<g transform="translate(19 21) scale(.82)">' + ART[k]() + "</g>" : '<g transform="translate(' + (mini ? 10 : 15) + ' ' + (mini ? 20 : 22) + ') scale(' + (mini ? 1 : .9) + ')">' + ART[k]() + "</g>";
  // name plate
  s += '<path d="M3 ' + py + 'L117 ' + py + 'L117 167L3 167Z" fill="#000" opacity="' + (sp ? .35 : .22) + '"/>';
  s += '<path d="M3 ' + py + 'L117 ' + py + '" stroke="' + (sp ? "#e8c25a" : "#fff") + '" stroke-opacity="' + (sp ? .9 : .35) + '" stroke-width="1.2"/>';
  var fs = mini ? (nm[0].length > 10 ? 15 : 19) : two ? 12.5 : 14.5;
  nm.forEach(function (ln, i) { s += '<text x="60" y="' + (py + (mini ? 27 : two ? 15 : 18) + i * 14) + '" text-anchor="middle" font-family="' + FONT + '" font-size="' + (!mini && ln.length > 12 ? 11.5 : fs) + '" font-weight="800" fill="#fff" style="paint-order:stroke" stroke="#000" stroke-opacity=".25" stroke-width="2">' + esc(ln) + "</text>"; });
  var sub = mini ? [] : wrapText(opt.text || C.sub, 25).slice(0, 2), sy = py + (two ? 15 : 18) + (nm.length - 1) * 14 + (sub.length > 1 ? 11 : 14);
  sub.forEach(function (ln, i) { s += '<text x="60" y="' + (sy + i * 9.5) + '" text-anchor="middle" font-family="' + FONT + '" font-size="8" font-weight="600" fill="' + (sp ? shade(acc, 0.55) : "#fff") + '" fill-opacity=".9">' + esc(ln) + "</text>"; });
  // gloss
  s += '<path d="M3 3L117 3L117 40Q60 60 3 30Z" fill="url(#' + id + 's)"/>';
  s += "</g>";
  // top label
  if (!mini) s += '<rect x="34" y="7" width="52" height="12" rx="6" fill="#000" opacity=".28"/><text x="60" y="15.6" text-anchor="middle" font-family="' + FONT + '" font-size="6.6" font-weight="800" letter-spacing="1.2" fill="' + (sp ? "#ffe08a" : "#fff") + '">' + (sp ? "SPECIALĂ" : (k === "joker" ? "JOKER" : "RESURSĂ")) + "</text>";
  if (sp) s += '<path d="' + star(14, 14, 6, 2.6) + '" fill="#ffe08a"/><path d="' + star(106, 14, 6, 2.6) + '" fill="#ffe08a"/>';
  s += '<rect x="5.5" y="5.5" width="109" height="159" rx="8" fill="none" stroke="' + (sp ? "#ffe9a8" : "#fff") + '" stroke-opacity="' + (sp ? .55 : .3) + '" stroke-width="1"/>';
  if (opt.count != null && opt.count !== false) s += '<circle cx="104" cy="16" r="12" fill="#fff" stroke="' + shade(c1, -0.2) + '" stroke-width="2"/><text x="104" y="21" text-anchor="middle" font-family="' + FONT + '" font-size="' + (String(opt.count).length > 1 ? 11 : 14) + '" font-weight="900" fill="#111827">' + esc(opt.count) + "</text>";
  if (opt.dim) s += '<rect x="1" y="1" width="118" height="168" rx="12" fill="#0a0f1e" opacity=".55"/>';
  return s;
}
CA.cardFace = function (card, opt) {
  opt = opt || {}; var w = opt.w || 120, k = ckey(card);
  if (opt.mini == null && w < 92) opt = Object.assign({}, opt, { mini: true });
  return svgWrap("0 0 120 170", w, Math.round(w * 170 / 120), cardInner(k, opt), "ca-card ca-card-" + k + (CARD[k].sp ? " ca-card-sp" : ""));
};
CA.cardBack = function (opt) {
  opt = opt || {}; var w = opt.w || 120, id = uid("k"), s = "";
  s += '<linearGradient id="' + id + 'o" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff2b8"/><stop offset=".45" stop-color="#e8b84a"/><stop offset=".7" stop-color="#a9741c"/><stop offset="1" stop-color="#f6d77a"/></linearGradient>';
  s += '<radialGradient id="' + id + 'b" cx=".5" cy=".45" r=".75"><stop offset="0" stop-color="#25407a"/><stop offset=".6" stop-color="#132552"/><stop offset="1" stop-color="#070f26"/></radialGradient>';
  s += '<pattern id="' + id + 'p" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 6H12" stroke="#fff" stroke-opacity=".05" stroke-width="1"/></pattern>';
  s += '<clipPath id="' + id + 'c"><rect x="3" y="3" width="114" height="164" rx="10"/></clipPath>';
  s += '<rect x="1" y="1" width="118" height="168" rx="12" fill="url(#' + id + 'o)"/><rect x="3" y="3" width="114" height="164" rx="10" fill="url(#' + id + 'b)"/>';
  s += '<g clip-path="url(#' + id + 'c)"><rect width="120" height="170" fill="url(#' + id + 'p)"/>';
  for (var i = 0; i < 24; i++) { var a = i * Math.PI / 12; s += '<path d="M60 80L' + (60 + Math.cos(a) * 120).toFixed(1) + " " + (80 + Math.sin(a) * 120).toFixed(1) + '" stroke="#ffd35c" stroke-opacity="' + (i % 2 ? .04 : .08) + '" stroke-width="' + (i % 2 ? 1 : 3) + '"/>'; }
  s += "</g>";
  s += '<rect x="8" y="8" width="104" height="154" rx="7" fill="none" stroke="#e8c25a" stroke-opacity=".75" stroke-width="1.2"/><rect x="11" y="11" width="98" height="148" rx="5" fill="none" stroke="#e8c25a" stroke-opacity=".3" stroke-width=".8" stroke-dasharray="2 2"/>';
  // compass ring + globe
  s += '<circle cx="60" cy="80" r="38" fill="none" stroke="#e8c25a" stroke-width="1.6"/><circle cx="60" cy="80" r="33" fill="#0b1a3d" stroke="#e8c25a" stroke-opacity=".5" stroke-width=".8"/>';
  for (i = 0; i < 32; i++) { var b = i * Math.PI / 16, r1 = i % 4 ? 35.5 : 34; s += '<path d="M' + (60 + Math.cos(b) * r1).toFixed(1) + " " + (80 + Math.sin(b) * r1).toFixed(1) + "L" + (60 + Math.cos(b) * 37.5).toFixed(1) + " " + (80 + Math.sin(b) * 37.5).toFixed(1) + '" stroke="#e8c25a" stroke-width="' + (i % 4 ? .6 : 1.4) + '"/>'; }
  s += '<g fill="none" stroke="#7fb2ff" stroke-opacity=".55" stroke-width="1"><circle cx="60" cy="80" r="24"/><ellipse cx="60" cy="80" rx="11" ry="24"/><ellipse cx="60" cy="80" rx="24" ry="9"/><path d="M36 80H84M60 56V104"/></g>';
  s += '<path d="M60 38L64 76L60 80L56 76Z" fill="#ffd35c"/><path d="M60 122L56 84L60 80L64 84Z" fill="#e8c25a" opacity=".6"/><path d="M18 80L56 76L60 80L56 84Z" fill="#e8c25a" opacity=".6"/><path d="M102 80L64 84L60 80L64 76Z" fill="#e8c25a" opacity=".6"/>';
  s += '<path d="M28 98Q60 46 96 58" stroke="#fff" stroke-width="1.2" stroke-dasharray="3 3" fill="none" opacity=".7"/>';
  s += '<g transform="translate(96 58) rotate(70) scale(.2) translate(-50 -50)">' + topG(1, "#ffffff", false) + "</g>";
  s += '<text x="60" y="140" text-anchor="middle" font-family="Georgia,\'Times New Roman\',serif" font-size="12" font-weight="700" letter-spacing="2.4" fill="#ffe08a">CERUL</text><text x="60" y="152" text-anchor="middle" font-family="Georgia,serif" font-size="8.5" letter-spacing="3.6" fill="#e8c25a">LUMII</text>';
  s += '<text x="60" y="30" text-anchor="middle" font-family="Georgia,serif" font-size="7" letter-spacing="2" fill="#e8c25a" opacity=".85">★ ★ ★</text>';
  s += '<path d="M3 3L117 3L117 40Q60 60 3 30Z" fill="#fff" opacity=".06"/>';
  return svgWrap("0 0 120 170", w, Math.round(w * 170 / 120), s, "ca-card ca-card-back");
};
CA.cardIcon = function (card, size) {
  size = size || 28; var k = ckey(card);
  return svgWrap("0 0 100 100", size, size, ART[k](), "ca-cicon ca-cicon-" + k);
};

/* =========================================================== OFFICE SCENE */
var SKY = {
  day:   ["#3f7fd1", "#7fb5ea", "#cfe6f7", "#f5f0e0"],
  dusk:  ["#141f4a", "#3b3f7a", "#c8607a", "#ffb36b"],
  night: ["#040a1f", "#0b1a3d", "#1b2e5c", "#2c3f70"]
};
function skyline(x0, x1, base, hmin, hmax, colr, seed, lit, litC) {
  var r = rngFrom(seed), x = x0, s = "", win = "";
  while (x < x1) {
    var w = 18 + r() * 46, h = hmin + r() * (hmax - hmin), y = base - h, t = r();
    if (t < 0.15) s += '<path d="M' + x.toFixed(0) + " " + base + "L" + x.toFixed(0) + " " + (y + 14).toFixed(0) + "L" + (x + w / 2).toFixed(0) + " " + y.toFixed(0) + "L" + (x + w).toFixed(0) + " " + (y + 14).toFixed(0) + "L" + (x + w).toFixed(0) + " " + base + 'Z"/>';
    else if (t < 0.25) s += '<rect x="' + x.toFixed(0) + '" y="' + y.toFixed(0) + '" width="' + w.toFixed(0) + '" height="' + h.toFixed(0) + '" rx="' + (w / 2).toFixed(0) + '"/><rect x="' + x.toFixed(0) + '" y="' + (y + w / 2).toFixed(0) + '" width="' + w.toFixed(0) + '" height="' + (h - w / 2).toFixed(0) + '"/>';
    else { s += '<rect x="' + x.toFixed(0) + '" y="' + y.toFixed(0) + '" width="' + w.toFixed(0) + '" height="' + h.toFixed(0) + '"/>'; if (r() < 0.3) s += '<rect x="' + (x + w / 2 - 1).toFixed(0) + '" y="' + (y - 18).toFixed(0) + '" width="2" height="18"/>'; }
    if (lit) for (var yy = y + 8; yy < base - 6; yy += 9) for (var xx = x + 4; xx < x + w - 5; xx += 7) if (r() < lit) win += '<rect x="' + xx.toFixed(0) + '" y="' + yy.toFixed(0) + '" width="3" height="4"/>';
    x += w + r() * 6;
  }
  return '<g fill="' + colr + '">' + s + "</g>" + (win ? '<g fill="' + (litC || "#ffd98a") + '" opacity=".85">' + win + "</g>" : "");
}
CA.office = function (opt) {
  opt = opt || {}; var id = uid("o"), tm = SKY[opt.time] ? opt.time : "dusk", K = SKY[tm], s = "";
  var W = 1600, H = 900, wx0 = 330, wx1 = 1270, wy0 = 70, wy1 = 540, hz = 430;
  s += '<linearGradient id="' + id + 'w" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1d2c50"/><stop offset="1" stop-color="#0c1530"/></linearGradient>';
  s += '<linearGradient id="' + id + 's" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + K[0] + '"/><stop offset=".45" stop-color="' + K[1] + '"/><stop offset=".8" stop-color="' + K[2] + '"/><stop offset="1" stop-color="' + K[3] + '"/></linearGradient>';
  s += '<radialGradient id="' + id + 'sun" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff6d8"/><stop offset=".25" stop-color="#ffd27a" stop-opacity=".9"/><stop offset="1" stop-color="#ff9a5a" stop-opacity="0"/></radialGradient>';
  s += '<linearGradient id="' + id + 'd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6b4429"/><stop offset=".25" stop-color="#4f301b"/><stop offset="1" stop-color="#2e1a0e"/></linearGradient>';
  s += '<linearGradient id="' + id + 'df" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2c190d"/><stop offset="1" stop-color="#140a04"/></linearGradient>';
  s += '<linearGradient id="' + id + 'r" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".16"/><stop offset=".4" stop-color="#fff" stop-opacity="0"/><stop offset=".55" stop-color="#fff" stop-opacity=".08"/><stop offset=".7" stop-color="#fff" stop-opacity="0"/></linearGradient>';
  s += '<radialGradient id="' + id + 'v" cx=".5" cy=".45" r=".75"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".55"/></radialGradient>';
  s += '<radialGradient id="' + id + 'lg" cx=".5" cy="0" r="1"><stop offset="0" stop-color="#ffd98a" stop-opacity=".55"/><stop offset="1" stop-color="#ffd98a" stop-opacity="0"/></radialGradient>';
  s += '<clipPath id="' + id + 'wc"><rect x="' + wx0 + '" y="' + wy0 + '" width="' + (wx1 - wx0) + '" height="' + (wy1 - wy0) + '"/></clipPath>';
  // wall
  s += '<rect width="' + W + '" height="' + H + '" fill="url(#' + id + 'w)"/>';
  s += '<g stroke="#ffffff" stroke-opacity=".035" stroke-width="2">' + [60, 180, 300, 1300, 1420, 1540].map(function (x) { return '<path d="M' + x + ' 0V560"/>'; }).join("") + "</g>";
  s += '<rect x="0" y="0" width="' + W + '" height="26" fill="#0a1128"/><path d="M0 26H1600" stroke="#e8c25a" stroke-opacity=".25" stroke-width="2"/>';
  // window view
  s += '<g clip-path="url(#' + id + 'wc)">';
  s += '<rect x="' + wx0 + '" y="' + wy0 + '" width="' + (wx1 - wx0) + '" height="' + (wy1 - wy0) + '" fill="url(#' + id + 's)"/>';
  if (tm === "night") { var rs = rngFrom(77); for (var i = 0; i < 70; i++) s += '<circle cx="' + (wx0 + rs() * 940).toFixed(0) + '" cy="' + (wy0 + rs() * 300).toFixed(0) + '" r="' + (0.6 + rs() * 1.3).toFixed(1) + '" fill="#fff" opacity="' + (0.3 + rs() * 0.6).toFixed(2) + '"/>'; s += '<circle cx="1110" cy="150" r="26" fill="#f4f1e0"/><circle cx="1120" cy="144" r="24" fill="' + K[0] + '" opacity=".9"/>'; }
  else { s += '<circle cx="1000" cy="' + (tm === "day" ? 160 : 410) + '" r="170" fill="url(#' + id + 'sun)"/><circle cx="1000" cy="' + (tm === "day" ? 160 : 410) + '" r="34" fill="#fff4d0"/>'; }
  s += '<g fill="#fff" opacity="' + (tm === "night" ? .05 : .22) + '"><ellipse cx="520" cy="180" rx="120" ry="16"/><ellipse cx="600" cy="168" rx="70" ry="14"/><ellipse cx="1150" cy="250" rx="110" ry="12"/><ellipse cx="820" cy="300" rx="160" ry="10"/></g>';
  // distant plane + contrail
  s += '<path d="M420 150Q560 120 700 112" stroke="#fff" stroke-opacity=".35" stroke-width="3" fill="none" stroke-linecap="round"/><g transform="translate(700 106) scale(.18) rotate(-4)">' + sideG(1, "#9fb4ff", uid("p")) + "</g>";
  s += skyline(wx0, wx1, hz, 30, 110, tm === "night" ? "#18244a" : mix(K[2], "#2a2f5a", 0.55), 11, tm === "night" ? .25 : 0, "#ffe7a8");
  s += skyline(wx0 - 20, wx1, hz + 8, 20, 70, tm === "night" ? "#0d1530" : mix(K[1], "#141a38", 0.6), 23, tm === "night" ? .35 : .12, "#ffd98a");
  // airfield
  s += '<rect x="' + wx0 + '" y="' + (hz + 6) + '" width="940" height="' + (wy1 - hz) + '" fill="' + (tm === "night" ? "#0d1428" : tm === "day" ? "#5d7a5a" : "#2b3048") + '"/>';
  s += '<path d="M' + wx0 + " " + (hz + 6) + "H" + wx1 + '" stroke="#fff" stroke-opacity=".12"/>';
  s += '<path d="M640 ' + wy1 + 'L780 ' + (hz + 10) + 'L840 ' + (hz + 10) + 'L1060 ' + wy1 + 'Z" fill="' + (tm === "day" ? "#3d4350" : "#1c2132") + '"/>';
  for (i = 0; i < 6; i++) { var t0 = i / 6, t1 = t0 + 0.07, y0 = hz + 10 + (wy1 - hz - 10) * t0 * t0, y1 = hz + 10 + (wy1 - hz - 10) * t1 * t1; s += '<path d="M' + (810 + 40 * t0) + " " + y0.toFixed(0) + "L" + (810 + 40 * t1) + " " + y1.toFixed(0) + '" stroke="#f4f0e0" stroke-width="' + (1 + 5 * t0) + '" opacity=".75"/>'; }
  for (i = 0; i < 12; i++) { var tt = (i + 0.5) / 12, yy = hz + 10 + (wy1 - hz - 10) * tt * tt, xl = 780 - 140 * tt * tt, xr = 840 + 220 * tt * tt; s += '<circle cx="' + xl.toFixed(0) + '" cy="' + yy.toFixed(0) + '" r="' + (1.2 + tt * 2.4).toFixed(1) + '" fill="#ffe08a"/><circle cx="' + xr.toFixed(0) + '" cy="' + yy.toFixed(0) + '" r="' + (1.2 + tt * 2.4).toFixed(1) + '" fill="#ffe08a"/>'; }
  // terminal + tower
  var tc = tm === "day" ? "#dfe6f0" : "#3a4466", gc = tm === "day" ? "#7fb2d8" : "#ffd98a";
  s += '<path d="M370 ' + (hz + 46) + 'L370 ' + (hz + 16) + 'Q470 ' + (hz - 10) + ' 610 ' + (hz + 10) + 'L610 ' + (hz + 46) + 'Z" fill="' + tc + '"/>' +
    '<path d="M378 ' + (hz + 22) + 'Q470 ' + (hz + 0) + ' 602 ' + (hz + 17) + 'L602 ' + (hz + 38) + 'L378 ' + (hz + 38) + 'Z" fill="' + gc + '" opacity="' + (tm === "day" ? .9 : .6) + '"/>';
  for (i = 0; i < 12; i++) s += '<path d="M' + (388 + i * 19) + " " + (hz + 38) + "V" + (hz + 14 - Math.sin((i + 0.5) / 12 * Math.PI) * 8).toFixed(0) + '" stroke="' + tc + '" stroke-width="2.4"/>';
  s += '<path d="M370 ' + (hz + 46) + 'H610" stroke="' + shade(tc, -0.3) + '" stroke-width="3"/>';
  s += '<g transform="translate(470 ' + (hz + 50) + ') scale(.32)">' + sideG(0, "#5fd17a", uid("p")) + "</g>";
  s += '<path d="M1140 ' + (hz + 30) + 'L1146 ' + (hz - 60) + 'L1158 ' + (hz - 60) + 'L1164 ' + (hz + 30) + 'Z" fill="' + (tm === "day" ? "#e6e1d6" : "#2f3858") + '"/><path d="M1130 ' + (hz - 82) + 'L1174 ' + (hz - 82) + 'L1168 ' + (hz - 60) + 'L1136 ' + (hz - 60) + 'Z" fill="#16314f"/><path d="M1136 ' + (hz - 78) + 'L1168 ' + (hz - 78) + 'L1165 ' + (hz - 64) + 'L1139 ' + (hz - 64) + 'Z" fill="#7fd0ff" opacity=".6"/><circle cx="1152" cy="' + (hz - 96) + '" r="3" fill="#ff4d4d"/><path d="M1152 ' + (hz - 82) + 'V' + (hz - 96) + '" stroke="#ccc" stroke-width="2"/>';
  // plane taking off
  s += '<g transform="translate(900 300) rotate(-11) scale(1.05)"><path d="M-260 70Q-120 72 20 50" stroke="#fff" stroke-opacity=".0" fill="none"/>' + sideG(1, opt.planeColor || "#e8b84a", uid("p")) + "</g>";
  s += '<rect x="' + wx0 + '" y="' + wy0 + '" width="' + (wx1 - wx0) + '" height="' + (wy1 - wy0) + '" fill="url(#' + id + 'r)"/>';
  s += "</g>";
  // blinds (top rolled)
  s += '<rect x="' + (wx0 - 6) + '" y="' + (wy0 - 6) + '" width="' + (wx1 - wx0 + 12) + '" height="34" rx="4" fill="#0b1226"/><g stroke="#ffffff" stroke-opacity=".06">' + [0, 1, 2, 3].map(function (k) { return '<path d="M' + wx0 + " " + (wy0 + 2 + k * 6) + "H" + wx1 + '"/>'; }).join("") + "</g>";
  // window frame + mullions
  s += '<g fill="none" stroke="#0a1022" stroke-width="16"><rect x="' + wx0 + '" y="' + wy0 + '" width="' + (wx1 - wx0) + '" height="' + (wy1 - wy0) + '"/></g>';
  s += '<g fill="#0a1022"><rect x="635" y="' + wy0 + '" width="12" height="' + (wy1 - wy0) + '"/><rect x="953" y="' + wy0 + '" width="12" height="' + (wy1 - wy0) + '"/><rect x="' + wx0 + '" y="214" width="' + (wx1 - wx0) + '" height="8"/></g>';
  s += '<g fill="none" stroke="#e8c25a" stroke-opacity=".22" stroke-width="2"><rect x="' + (wx0 - 9) + '" y="' + (wy0 - 9) + '" width="' + (wx1 - wx0 + 18) + '" height="' + (wy1 - wy0 + 18) + '"/></g>';
  s += '<rect x="' + (wx0 - 22) + '" y="' + (wy1 + 6) + '" width="' + (wx1 - wx0 + 44) + '" height="12" rx="3" fill="#121b36"/>';
  // world clocks (left wall)
  [["LONDRA", 0], ["NEW YORK", -5], ["TOKYO", 9]].forEach(function (c, i) {
    var cx = 92 + i * 0, cy = 120 + i * 118, h = (10 + c[1] + 24) % 12;
    s += '<g transform="translate(' + cx + " " + cy + ')"><circle r="40" fill="#0a1128"/><circle r="36" fill="#f3efe4" stroke="#e8c25a" stroke-width="3"/>';
    for (var q = 0; q < 12; q++) { var a = q * Math.PI / 6; s += '<path d="M' + (Math.cos(a) * 29).toFixed(1) + " " + (Math.sin(a) * 29).toFixed(1) + "L" + (Math.cos(a) * 33).toFixed(1) + " " + (Math.sin(a) * 33).toFixed(1) + '" stroke="#1b2440" stroke-width="' + (q % 3 ? 1.4 : 3) + '"/>'; }
    var ha = (h / 12) * Math.PI * 2 - Math.PI / 2, ma = (i * 0.37 % 1) * Math.PI * 2 - Math.PI / 2;
    s += '<path d="M0 0L' + (Math.cos(ha) * 18).toFixed(1) + " " + (Math.sin(ha) * 18).toFixed(1) + '" stroke="#1b2440" stroke-width="4" stroke-linecap="round"/><path d="M0 0L' + (Math.cos(ma) * 27).toFixed(1) + " " + (Math.sin(ma) * 27).toFixed(1) + '" stroke="#1b2440" stroke-width="2.4" stroke-linecap="round"/><circle r="3.4" fill="#c4373a"/>';
    s += '<text y="58" text-anchor="middle" font-family="' + FONT + '" font-size="15" font-weight="800" letter-spacing="2" fill="#e8c25a" opacity=".85">' + c[0] + "</text></g>";
  });
  // floor lamp glow (left)
  s += '<path d="M182 150L268 150L330 560L120 560Z" fill="url(#' + id + 'lg)" opacity=".45"/><rect x="223" y="150" width="4" height="410" fill="#0a0f1f"/><path d="M198 100L252 100L270 150L180 150Z" fill="#e9d7ae"/><path d="M198 100L252 100L254 106L196 106Z" fill="#fff" opacity=".4"/><ellipse cx="225" cy="150" rx="45" ry="5" fill="#fff3c4"/>';
  // bookshelf (right)
  s += '<rect x="1310" y="90" width="250" height="470" fill="#140d08"/><rect x="1318" y="98" width="234" height="454" fill="#2a1a10"/>';
  [190, 290, 390, 490].forEach(function (y, j) { s += '<rect x="1318" y="' + y + '" width="234" height="8" fill="#140d08"/>'; var r = rngFrom(300 + j), x = 1326; while (x < 1530) { var bw = 12 + r() * 16, bh = 50 + r() * 34; if (r() < 0.15) { x += 24; continue; } s += '<rect x="' + x.toFixed(0) + '" y="' + (y - bh).toFixed(0) + '" width="' + bw.toFixed(0) + '" height="' + bh.toFixed(0) + '" rx="2" fill="' + ["#2c4a86", "#7a2b2b", "#2f6b4f", "#b8862e", "#4a3b6b", "#1d2b52"][Math.floor(r() * 6)] + '"/><rect x="' + (x + 3).toFixed(0) + '" y="' + (y - bh + 10).toFixed(0) + '" width="' + (bw - 6).toFixed(0) + '" height="3" fill="#e8c25a" opacity=".6"/>'; x += bw + 2; } });
  s += '<g transform="translate(1500 160)"><circle r="22" fill="#2a7fb8"/><path d="M-14 -10q10 4 8 14q-6 6 -2 14M6 -18q6 10 14 6M4 6q8 -2 10 8" stroke="#5fd17a" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M-26 0A26 26 0 0 1 26 0" stroke="#e8c25a" stroke-width="3" fill="none"/><rect x="-3" y="22" width="6" height="8" fill="#e8c25a"/></g>';
  // plant (right, floor) — leaves
  s += '<g transform="translate(1520 560)">';
  for (i = 0; i < 9; i++) { var la = -Math.PI / 2 + (i - 4) * 0.28, L = 120 + (i % 3) * 30; s += '<path d="M0 0Q' + (Math.cos(la - 0.3) * L * 0.5).toFixed(0) + " " + (Math.sin(la - 0.3) * L * 0.5).toFixed(0) + " " + (Math.cos(la) * L).toFixed(0) + " " + (Math.sin(la) * L).toFixed(0) + "Q" + (Math.cos(la + 0.3) * L * 0.5).toFixed(0) + " " + (Math.sin(la + 0.3) * L * 0.5).toFixed(0) + ' 0 0Z" fill="' + (i % 2 ? "#2f7a4a" : "#3f9a5c") + '"/>'; }
  s += "</g>";
  if (opt.layer === "back") return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice"' + (opt.w ? ' width="' + opt.w + '"' : ' width="100%"') + (opt.h ? ' height="' + opt.h + '"' : ' height="100%"') + ' class="ca-office" aria-hidden="true">' + s + '<rect width="' + W + '" height="' + H + '" fill="url(#' + id + 'v)"/></svg>';
  if (opt.layer === "front") s = s.slice(0, s.indexOf('<rect width="' + W + '"'));
  // desk
  s += '<path d="M40 560L1560 560L1600 640L0 640Z" fill="url(#' + id + 'd)"/>';
  s += '<path d="M40 560L1560 560" stroke="#a87a50" stroke-width="3"/><path d="M380 572L1220 572L1250 600L350 600Z" fill="#fff" opacity=".05"/>';
  s += '<rect x="0" y="640" width="1600" height="260" fill="url(#' + id + 'df)"/><path d="M0 640H1600" stroke="#000" stroke-opacity=".5" stroke-width="4"/><path d="M0 652H1600" stroke="#e8c25a" stroke-opacity=".35" stroke-width="2"/>';
  s += '<g fill="none" stroke="#000" stroke-opacity=".35" stroke-width="3"><rect x="80" y="690" width="420" height="180" rx="8"/><rect x="590" y="690" width="420" height="180" rx="8"/><rect x="1100" y="690" width="420" height="180" rx="8"/></g>';
  s += '<g fill="none" stroke="#fff" stroke-opacity=".05" stroke-width="2"><rect x="84" y="694" width="412" height="172" rx="6"/><rect x="594" y="694" width="412" height="172" rx="6"/><rect x="1104" y="694" width="412" height="172" rx="6"/></g>';
  var gr = rngFrom(5); s += '<g stroke="#000" stroke-opacity=".12" stroke-width="1.4" fill="none">'; for (i = 0; i < 9; i++) { var gy = 574 + i * 7 + gr() * 3; s += '<path d="M' + (40 + gr() * 200).toFixed(0) + " " + gy.toFixed(0) + "Q" + (600 + gr() * 300).toFixed(0) + " " + (gy + (gr() - 0.5) * 8).toFixed(0) + " " + (1300 + gr() * 260).toFixed(0) + " " + gy.toFixed(0) + '"/>'; } s += "</g>";
  s += '<g transform="translate(800 760)"><circle r="34" fill="none" stroke="#e8c25a" stroke-opacity=".5" stroke-width="2"/><path d="M-22 4Q0 -20 24 -8Q2 -6 -12 12Z" fill="#e8c25a" opacity=".55"/></g>';
  // desk props: banker's lamp (left), model plane (right), coffee
  s += '<g transform="translate(110 560)"><ellipse cx="0" cy="0" rx="46" ry="8" fill="#000" opacity=".35"/><rect x="-30" y="-10" width="60" height="10" rx="4" fill="#b8862e"/><rect x="-4" y="-56" width="8" height="48" fill="#c9a24a"/><path d="M-52 -56Q0 -86 52 -56L46 -48L-46 -48Z" fill="#1f6b4a"/><path d="M-46 -50Q0 -74 46 -50" stroke="#fff" stroke-opacity=".25" stroke-width="3" fill="none"/><path d="M-46 -48L46 -48L90 40L-90 40Z" fill="url(#' + id + 'lg)" opacity=".7"/></g>';
  s += '<g transform="translate(1470 560)"><ellipse cx="0" cy="0" rx="50" ry="8" fill="#000" opacity=".35"/><rect x="-26" y="-8" width="52" height="8" rx="3" fill="#20283c"/><rect x="-2" y="-46" width="4" height="40" fill="#8a96a8"/><g transform="translate(-60 -78) scale(.5) rotate(-6 120 40)">' + sideG(2, "#c4373a", uid("p")) + "</g></g>";
  s += '<g transform="translate(560 560)"><ellipse cx="0" cy="0" rx="24" ry="5" fill="#000" opacity=".35"/><path d="M-16 -32L16 -32L13 -2Q0 2 -13 -2Z" fill="#f3efe4"/><path d="M16 -26q12 0 10 10q-2 8 -12 6" fill="none" stroke="#f3efe4" stroke-width="4"/><ellipse cx="0" cy="-32" rx="16" ry="4" fill="#4a2a14"/><path d="M-4 -40q-4 -8 2 -14M5 -42q-4 -8 2 -14" stroke="#fff" stroke-opacity=".3" stroke-width="2" fill="none" stroke-linecap="round"/></g>';
  s += '<rect width="' + W + '" height="' + H + '" fill="url(#' + id + 'v)"/>';
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice"' + (opt.w ? ' width="' + opt.w + '"' : ' width="100%"') + (opt.h ? ' height="' + opt.h + '"' : ' height="100%"') + ' class="ca-office" aria-hidden="true">' + s + "</svg>";
};

/* =========================================================== ICE / FREEZE */
function crystal(seed, n) {
  var r = rngFrom(seed), d = "";
  function br(x, y, a, len, depth) {
    var x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len;
    d += "M" + x.toFixed(1) + " " + y.toFixed(1) + "L" + x2.toFixed(1) + " " + y2.toFixed(1);
    if (depth > 0) {
      var k = 2 + Math.floor(r() * 2);
      for (var i = 1; i <= k; i++) { var t = i / (k + 1), px = x + (x2 - x) * t, py = y + (y2 - y) * t; br(px, py, a + 0.75 + r() * 0.2, len * (0.25 + r() * 0.2), depth - 1); br(px, py, a - 0.75 - r() * 0.2, len * (0.25 + r() * 0.2), depth - 1); }
    }
  }
  for (var i = 0; i < n; i++) { var a = (i / n) * Math.PI / 2 + (r() - 0.5) * 0.2; br(0, 0, a, 120 + r() * 140, 2); }
  return d;
}
CA.iceOverlay = function (opt) {
  opt = opt || {};
  var corner = function (cls, seed) {
    return '<svg class="ca-ice-c ' + cls + '" viewBox="0 0 300 300" aria-hidden="true"><path d="' + crystal(seed, 7) + '" stroke="#ffffff" stroke-opacity=".75" stroke-width="2.2" fill="none" stroke-linecap="round"/><path d="' + crystal(seed + 9, 5) + '" stroke="#bfe9ff" stroke-opacity=".6" stroke-width="1.2" fill="none"/></svg>';
  };
  var flakes = "";
  if (!CA.reduced) for (var i = 0; i < 26; i++) { var r = rngFrom(i * 131 + 7); flakes += '<i class="ca-flake" style="left:' + (r() * 100).toFixed(1) + "%;animation-delay:-" + (r() * 6).toFixed(2) + "s;animation-duration:" + (5 + r() * 5).toFixed(2) + "s;font-size:" + (10 + r() * 18).toFixed(0) + 'px">❄</i>'; }
  var cracks = '<svg class="ca-ice-cr" viewBox="0 0 1600 900" preserveAspectRatio="none" aria-hidden="true"><g fill="none" stroke="#fff" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M0 120L90 150L140 230L230 250L260 330" stroke-opacity=".55" stroke-width="2.5"/><path d="M90 150L120 90M140 230L80 300" stroke-opacity=".4" stroke-width="1.6"/>' +
    '<path d="M1600 700L1500 680L1460 600L1380 590L1340 520" stroke-opacity=".55" stroke-width="2.5"/><path d="M1460 600L1520 560M1380 590L1420 660" stroke-opacity=".4" stroke-width="1.6"/>' +
    '<path d="M1600 80L1530 120L1470 110" stroke-opacity=".45" stroke-width="2"/><path d="M0 820L80 780L120 700" stroke-opacity=".45" stroke-width="2"/></g></svg>';
  return '<div class="ca-ice' + (opt.cls ? " " + opt.cls : "") + '" aria-hidden="true"><div class="ca-ice-frost"></div>' + cracks +
    corner("tl", 3) + corner("tr", 17) + corner("bl", 29) + corner("br", 41) + '<div class="ca-ice-sheen"></div>' + flakes + "</div>";
};

/* =========================================================== CONSULTANT */
var CONS = { id: "c", g: "m", name: "Consultantul", skin: "light", hair: "#6b6f78", hs: "side", out: "suit", c1: "#3a3346", c2: "#e8b84a", bow: 1, iris: "#3f6b45", glasses: "round", beard: "stache", headset: 1, noHand: 1, bg: ["#b8862e", "#2e1d06"] };
CA.consultant = function (size, mood, opt) {
  opt = opt || {}; size = size || 96;
  var idc = uid("q"), inner = avatarInner(0, mood || "neutral", { cfg: CONS });
  inner = '<g transform="translate(100 204) scale(1.12) translate(-100 -204)">' + inner + "</g>";
  // tablet held up in front of the chest
  inner += '<g transform="translate(146 172) rotate(-10)"><rect x="-26" y="-34" width="52" height="70" rx="6" fill="#1b1f2a" stroke="#6b7385" stroke-width="1.6"/><rect x="-21" y="-29" width="42" height="56" rx="2.5" fill="#1f4f94"/>' +
    '<rect x="-17" y="2" width="6" height="20" fill="#5fe08a"/><rect x="-8" y="-6" width="6" height="28" fill="#5fe08a" opacity=".85"/><rect x="1" y="-14" width="6" height="36" fill="#ffd35c"/><rect x="10" y="-22" width="6" height="44" fill="#5fe08a"/>' +
    '<path d="M-17 -20H8" stroke="#fff" stroke-opacity=".7" stroke-width="2.4" stroke-linecap="round"/>' +
    '<g fill="#f1c7a6" stroke="#b97d5a" stroke-width="1"><rect x="-31" y="-8" width="11" height="7" rx="3.5"/><rect x="-32" y="0" width="12" height="7" rx="3.5"/><rect x="-31" y="8" width="11" height="7" rx="3.5"/><rect x="-29" y="16" width="9" height="6" rx="3"/></g></g>';
  if (opt.flip) inner = mirror(inner);
  var bg = "", pre = "", post = "";
  if (opt.bg !== false) {
    bg = '<radialGradient id="' + idc + 'g" cx=".5" cy=".35" r=".75"><stop offset="0" stop-color="' + CONS.bg[0] + '"/><stop offset="1" stop-color="' + CONS.bg[1] + '"/></radialGradient><clipPath id="' + idc + 'c"><circle cx="100" cy="100" r="96"/></clipPath><circle cx="100" cy="100" r="96" fill="url(#' + idc + 'g)"/>';
    pre = '<g clip-path="url(#' + idc + 'c)">'; post = '</g><circle cx="100" cy="100" r="95" fill="none" stroke="#e8c25a" stroke-width="6"/>';
  }
  return svgWrap("0 0 200 200", size, size, bg + pre + inner + post, "ca-av ca-consultant");
};

/* =========================================================== LOGOS */
var GENERIC = /^(air|airways|airline|airlines|aero|avia|aviation|linii|liniile|aeriene|compania|company|sky|cer|fly|wings|jet|express|the|de|si|and|of|lines|international|intl)$/i;
CA.initials = function (name) {
  var w = String(name || "?").trim().split(/[\s\-_.]+/).filter(Boolean);
  var core = w.filter(function (x) { return !GENERIC.test(noDia(x)); });
  if (!core.length) core = w;
  var s = core.length >= 2 ? core[0][0] + core[1][0] : (core[0] || "?").slice(0, core[0] && core[0].length > 3 && w.length > 1 ? 1 : 2);
  if (core.length === 1 && w.length > 1) s = core[0][0] + (w.find(function (x) { return x !== core[0]; }) || "")[0];
  return (s || "?").toUpperCase();
};
CA.logo = function (name, color, size, opt) {
  opt = opt || {}; size = size || 48;
  var c = col(color), h = hash(name || "?"), v = opt.variant != null ? opt.variant % 5 : h % 5, id = uid("l"), ini = esc(CA.initials(name));
  var dk = shade(c, -0.45), lt = shade(c, 0.3), s = "";
  s += '<linearGradient id="' + id + 'g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + lt + '"/><stop offset=".55" stop-color="' + c + '"/><stop offset="1" stop-color="' + dk + '"/></linearGradient>';
  var txt = function (y, fs, fill) { return '<text x="50" y="' + y + '" text-anchor="middle" font-family="' + FONT + '" font-size="' + (ini.length > 1 ? fs : fs * 1.15) + '" font-weight="900" letter-spacing="-1" fill="' + (fill || "#fff") + '" style="paint-order:stroke" stroke="' + dk + '" stroke-width="3" stroke-opacity=".5">' + ini + "</text>"; };
  if (v === 0) {
    s += '<circle cx="50" cy="50" r="46" fill="url(#' + id + 'g)"/><circle cx="50" cy="50" r="46" fill="none" stroke="#fff" stroke-opacity=".9" stroke-width="3"/><circle cx="50" cy="50" r="39" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="1.5"/>' +
      '<path d="M12 62Q50 34 90 40Q56 46 24 74Z" fill="#fff" opacity=".9"/>' + txt(50, 34);
  } else if (v === 1) {
    s += '<path d="M30 8L78 8L94 92L14 92Z" fill="url(#' + id + 'g)" stroke="#fff" stroke-width="3" stroke-linejoin="round"/><path d="M38 70L88 50L92 64L42 84Z" fill="#fff" opacity=".9"/>' + txt(52, 32);
  } else if (v === 2) {
    s += '<circle cx="50" cy="50" r="46" fill="url(#' + id + 'g)"/><g fill="none" stroke="#fff" stroke-opacity=".4" stroke-width="1.6"><ellipse cx="50" cy="50" rx="20" ry="46"/><path d="M4 50H96M10 30H90M10 70H90"/></g>' +
      '<ellipse cx="50" cy="50" rx="48" ry="16" fill="none" stroke="#fff" stroke-width="3" transform="rotate(-24 50 50)"/><g transform="translate(86 30) rotate(60) scale(.16) translate(-50 -50)"><path d="M54 37L94 60L94 64L54 54ZM46 37L6 60L6 64L46 54Z M52.5 79L69 87.5L69 90.5L52 87ZM47.5 79L31 87.5L31 90.5L48 87Z M50 5C53.5 5 54.8 10 54.8 17L54.8 79L52.2 94L47.8 94L45.2 79L45.2 17C45.2 10 46.5 5 50 5Z" fill="#fff"/></g>' + txt(62, 32);
  } else if (v === 3) {
    s += '<path d="M50 4L90 27L90 73L50 96L10 73L10 27Z" fill="url(#' + id + 'g)" stroke="#fff" stroke-width="3" stroke-linejoin="round"/><path d="M24 34L50 20L76 34" stroke="#fff" stroke-width="4" fill="none" stroke-linejoin="round" opacity=".9"/><path d="M30 42L50 31L70 42" stroke="#fff" stroke-width="3" fill="none" stroke-linejoin="round" opacity=".55"/>' + txt(70, 30);
  } else {
    s += '<rect x="6" y="6" width="88" height="88" rx="22" fill="url(#' + id + 'g)"/><rect x="6" y="6" width="88" height="88" rx="22" fill="none" stroke="#fff" stroke-opacity=".85" stroke-width="3"/>' +
      '<path d="M20 34Q34 18 50 30Q66 18 80 34Q66 28 50 40Q34 28 20 34Z" fill="#fff" opacity=".95"/>' + txt(76, 30);
  }
  s += '<path d="M14 26Q40 6 78 14" stroke="#fff" stroke-opacity=".35" stroke-width="3" fill="none" stroke-linecap="round"/>';
  return svgWrap("0 0 100 100", size, size, s, "ca-logo");
};

/* =========================================================== ICONS */
var IC = {
  airport: '<path d="M10 22L11 9h2l1 13Z" fill="#cfd6e3"/><path d="M6 5h12l-2 4H8Z" fill="#2a5fa8"/><path d="M7.5 6h9l-1 2h-7Z" fill="#9fdcff"/><path d="M8 4h8v1H8z" fill="#cfd6e3"/><path d="M12 4V1.5" stroke="#cfd6e3" stroke-width="1"/><circle cx="12" cy="1.5" r="1" fill="#ff4d4d"/><path d="M2 22h20" stroke="#8a96a8" stroke-width="1.6"/>',
  hub: '<circle cx="12" cy="12" r="10" fill="#ffd35c" opacity=".25"/><circle cx="12" cy="12" r="6.5" fill="#ffd35c"/><circle cx="12" cy="12" r="3" fill="#7a4a00"/><g stroke="#ffd35c" stroke-width="1.6" stroke-linecap="round"><path d="M12 1v3M12 20v3M1 12h3M20 12h3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/></g>',
  slot: '<rect x="3" y="4" width="18" height="16" rx="3" fill="#2a5fa8"/><rect x="3" y="4" width="18" height="16" rx="3" fill="none" stroke="#9fdcff" stroke-width="1.2"/><path d="M9 16V8h3.5a2.5 2.5 0 0 1 0 5H9" stroke="#fff" stroke-width="2.2" fill="none" stroke-linejoin="round"/>',
  plane: '<path d="M21 13v-2l-8-5V2.5a1.5 1.5 0 0 0-3 0V6L2 11v2l8-2.5V16l-2 1.5V19l3.5-1 3.5 1v-1.5L13 16v-5.5Z" fill="#e8eef8"/>',
  money: '<rect x="2" y="6" width="20" height="12" rx="2" fill="#2f9e6b"/><rect x="2" y="6" width="20" height="12" rx="2" fill="none" stroke="#a8f0c8" stroke-width="1"/><circle cx="12" cy="12" r="3.4" fill="#a8f0c8"/><text x="12" y="14.2" text-anchor="middle" font-size="5.6" font-weight="900" fill="#0f4e33" font-family="system-ui,sans-serif">€</text>',
  bank: '<path d="M12 2L22 7H2Z" fill="#e8c25a"/><rect x="3" y="8" width="18" height="2" fill="#e8c25a"/><path d="M5 11h2v7H5zM11 11h2v7h-2zM17 11h2v7h-2z" fill="#f3efe4"/><rect x="2" y="19" width="20" height="3" rx="1" fill="#e8c25a"/>',
  cards: '<rect x="3" y="5" width="11" height="15" rx="2" fill="#4f8ff0" transform="rotate(-12 8 12)"/><rect x="9" y="4" width="11" height="15" rx="2" fill="#e65a55" stroke="#fff" stroke-width="1" transform="rotate(10 14 12)"/>',
  permit: '<path d="M5 2h10l4 4v16H5Z" fill="#f3efe4"/><path d="M15 2v4h4" fill="#cfc6b2"/><path d="M8 15Q12 8 16 11" stroke="#2a5fa8" stroke-width="1.6" fill="none" stroke-dasharray="2 1.5"/><circle cx="8" cy="15" r="1.6" fill="#ff8a4c"/><circle cx="16" cy="11" r="1.6" fill="#ff8a4c"/><path d="M8 19h8" stroke="#8a96a8" stroke-width="1.2"/>',
  star: '<path d="' + star(12, 12.6, 10.5, 4.4) + '" fill="#ffd35c" stroke="#b9770e" stroke-width="1" stroke-linejoin="round"/>',
  handshake: '<path d="M1 9l5-3 5 2 2-1 5 1 5 3-2 5-4 3-5 1-4-2-5-4Z" fill="#e8b88a"/><path d="M8 11l4 3 2-1M10 15l3 2M12 9l5 4" stroke="#8a5434" stroke-width="1.2" fill="none" stroke-linecap="round"/><path d="M0 8l4-2 2 8-3 2Z" fill="#2a5fa8"/><path d="M24 8l-4-2-2 8 3 2Z" fill="#c4373a"/>',
  pilot: '<path d="M3 12Q4 4 12 3Q20 4 21 12Z" fill="#1d2747"/><rect x="4" y="11" width="16" height="4" rx="1" fill="#0d1328"/><path d="M5 15Q12 20 19 15" fill="#0a0d17"/><path d="M7 8q5-3 10 0" stroke="#f0c75e" stroke-width="1.4" fill="none"/><circle cx="12" cy="8" r="1.6" fill="#f0c75e"/>',
  fuel: '<path d="M12 2C12 2 5 10.5 5 15a7 7 0 0 0 14 0C19 10.5 12 2 12 2Z" fill="#ffb02e"/><path d="M9 15a3 3 0 0 0 3 3" stroke="#fff" stroke-width="1.6" fill="none" stroke-linecap="round"/>',
  clock: '<circle cx="12" cy="12" r="10" fill="#f3efe4" stroke="#e8c25a" stroke-width="2"/><path d="M12 6v6l4 2" stroke="#1b2440" stroke-width="2" fill="none" stroke-linecap="round"/>',
  sun: '<circle cx="12" cy="12" r="5" fill="#ffd35c"/><g stroke="#ffd35c" stroke-width="2" stroke-linecap="round"><path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3M4.6 4.6l2.1 2.1M17.3 17.3l2.1 2.1M4.6 19.4l2.1-2.1M17.3 6.7l2.1-2.1"/></g>',
  moon: '<path d="M15 3a9 9 0 1 0 6 13A7.5 7.5 0 0 1 15 3Z" fill="#cfd8ff"/><circle cx="9" cy="13" r="1.4" fill="#9fb0e8"/><circle cx="13" cy="17" r="1" fill="#9fb0e8"/>',
  globe: '<circle cx="12" cy="12" r="10" fill="#2a7fb8"/><path d="M5 8q4 1 4 5q-2 3 0 6M14 3q1 4 5 4M13 12q4-1 6 3" stroke="#5fd17a" stroke-width="2.2" fill="none" stroke-linecap="round"/><circle cx="12" cy="12" r="10" fill="none" stroke="#9fdcff" stroke-width="1"/>',
  chart: '<rect x="3" y="14" width="4" height="7" rx="1" fill="#2f8f5b"/><rect x="10" y="9" width="4" height="12" rx="1" fill="#44c47c"/><rect x="17" y="4" width="4" height="17" rx="1" fill="#5fe08a"/><path d="M2 12L9 6l4 2 8-6" stroke="#fff" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>',
  cart: '<path d="M2 3h3l2.5 12h11L21 7H6.5" stroke="#cfd6e3" stroke-width="2" fill="none" stroke-linejoin="round" stroke-linecap="round"/><circle cx="9" cy="19.5" r="1.8" fill="#cfd6e3"/><circle cx="17" cy="19.5" r="1.8" fill="#cfd6e3"/>',
  trophy: '<path d="M7 3h10v5a5 5 0 0 1-10 0Z" fill="#ffd35c"/><path d="M7 5H3.5a3.5 3.5 0 0 0 4 4M17 5h3.5a3.5 3.5 0 0 1-4 4" stroke="#ffd35c" stroke-width="1.8" fill="none"/><path d="M11 13h2v4h-2z" fill="#e8b84a"/><rect x="7" y="17" width="10" height="4" rx="1" fill="#b8862e"/>',
  freeze: snowflake(12, 12, 10, "#9fe3ff", 2).replace("<path", '<path'),
  fire: '<path d="M12 23c-5 0-8-3.5-7-8 .7-3 3-4 3-7 2 1.5 2.5 3.5 2.5 5 1-2.5 2-6 5-9 0 4 3 6 3.5 10 .5 5-2 9-7 9Z" fill="#ff5a1f"/><path d="M12 23c-2.6 0-4-2-3.4-4.3.4-1.7 1.8-2.4 1.8-4.2 1.4 1.3 2 2.6 2 3.6 1-1.4 1.6-2.7 2.3-3.6.6 2.4 1.8 3.6 1.4 5.4-.4 2-1.6 3.1-4.1 3.1Z" fill="#ffd35c"/>',
  shield: '<path d="M12 1.5L21 5v6c0 5.5-3.8 9.6-9 11.5C6.8 20.6 3 16.5 3 11V5Z" fill="#33b3a8"/><path d="M7.5 12l3 3 6-6" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'
};
CA.ICONS = Object.keys(IC);
CA.icon = function (name, size, opt) {
  size = size || 24; var k = IC[name] ? name : (CARD[ckey(name)] && !IC[name] ? null : "plane");
  if (!k) return CA.cardIcon(name, size);
  return svgWrap("0 0 24 24", size, size, IC[k], "ca-ic ca-ic-" + k);
};
CA.stars = function (n, size, opt) {
  size = size || 14; n = Math.max(0, Math.min(5, +n || 0)); var id = uid("s"), s = "";
  s += '<clipPath id="' + id + '"><rect x="0" y="0" width="' + (n * 20) + '" height="20"/></clipPath>';
  var row = function (fill, stroke) { var r = ""; for (var i = 0; i < 5; i++) r += '<path d="' + star(10 + i * 20, 10.6, 9, 3.8) + '" fill="' + fill + '" stroke="' + stroke + '" stroke-width="1" stroke-linejoin="round"/>'; return r; };
  s += row("#ffffff22", "#ffffff40") + '<g clip-path="url(#' + id + ')">' + row("#ffd35c", "#b9770e") + "</g>";
  return svgWrap("0 0 100 20", size * 5, size, s, "ca-stars");
};
CA.handshake = function (size, ca, cb) {
  size = size || 120; var A = col(ca, "#2a5fa8"), B = col(cb, "#c4373a"), sk1 = "#e8b88a", sk2 = "#a8704a", s = "";
  s += '<path d="M0 46L34 34L44 66L6 82Z" fill="' + A + '"/><path d="M34 34L44 66" stroke="#fff" stroke-width="3" opacity=".8"/>';
  s += '<path d="M120 46L86 34L76 66L114 82Z" fill="' + B + '"/><path d="M86 34L76 66" stroke="#fff" stroke-width="3" opacity=".8"/>';
  s += '<path d="M84 36L62 30Q54 30 48 36L40 44Q38 50 44 50L56 44L62 48L74 66L80 62Z" fill="' + sk2 + '" stroke="#5a3420" stroke-width="1.5" stroke-linejoin="round"/>';
  s += '<path d="M36 36L52 32L60 40L72 52Q76 58 70 60L66 58Q70 64 64 66L60 64Q62 70 56 70L52 68Q52 74 46 72L40 66Z" fill="' + sk1 + '" stroke="#8a5434" stroke-width="1.5" stroke-linejoin="round"/>';
  s += '<path d="M58 50l8 8M54 56l6 6M48 60l6 6" stroke="#8a5434" stroke-width="1.4" stroke-linecap="round"/>';
  s += spark(60, 14, 7, "#ffd35c") + spark(30, 20, 4, "#ffd35c") + spark(92, 18, 5, "#ffd35c");
  return svgWrap("0 0 120 90", size, Math.round(size * 0.75), s, "ca-hand");
};
CA.coin = function (size) {
  size = size || 24;
  return svgWrap("0 0 24 24", size, size, '<circle cx="12" cy="12" r="11" fill="#b8862e"/><circle cx="12" cy="11" r="10" fill="#ffd35c"/><circle cx="12" cy="11" r="7.5" fill="none" stroke="#b8862e" stroke-width="1.2"/><text x="12" y="15" text-anchor="middle" font-family="system-ui,sans-serif" font-size="10" font-weight="900" fill="#8a5a00">€</text><path d="M6 7a7 7 0 0 1 6-3" stroke="#fff" stroke-width="1.4" fill="none" stroke-linecap="round" opacity=".8"/>', "ca-coin-svg");
};

/* =========================================================== CSS + DOM helpers */
var CSS = [
".ca-av,.ca-card,.ca-plane,.ca-logo,.ca-ptop{display:inline-block;vertical-align:middle;flex:none}",
".ca-card{filter:drop-shadow(0 6px 10px rgba(0,0,0,.45));border-radius:8%}",
".ca-card-sp{filter:drop-shadow(0 6px 12px rgba(0,0,0,.5)) drop-shadow(0 0 6px rgba(255,211,92,.25))}",
".ca-office{display:block}",
".ca-plane .ca-prop{animation:ca-prop .09s linear infinite;transform-box:fill-box;transform-origin:center}",
"@keyframes ca-prop{0%{opacity:.45}50%{opacity:1}100%{opacity:.45}}",
".ca-ice{position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:30;animation:ca-ice-in .7s ease-out both}",
".ca-ice-frost{position:absolute;inset:0;background:radial-gradient(ellipse at center,rgba(170,225,255,0) 42%,rgba(170,225,255,.28) 68%,rgba(225,246,255,.78) 100%);box-shadow:inset 0 0 clamp(18px,9vmin,90px) rgba(200,240,255,.85),inset 0 0 clamp(5px,2vmin,20px) #fff}",
".ca-ice-cr{position:absolute;inset:0;width:100%;height:100%}",
".ca-ice-c{position:absolute;width:min(30%,340px);height:auto;aspect-ratio:1;filter:drop-shadow(0 0 3px rgba(255,255,255,.8))}",
".ca-ice-c.tl{left:0;top:0}.ca-ice-c.tr{right:0;top:0;transform:scaleX(-1)}.ca-ice-c.bl{left:0;bottom:0;transform:scaleY(-1)}.ca-ice-c.br{right:0;bottom:0;transform:scale(-1,-1)}",
".ca-ice-sheen{position:absolute;inset:-20%;background:linear-gradient(115deg,transparent 40%,rgba(255,255,255,.22) 48%,transparent 56%);animation:ca-sheen 3.2s ease-in-out infinite}",
".ca-flake{position:absolute;top:-30px;color:#fff;font-style:normal;text-shadow:0 0 6px #9fe3ff;opacity:.85;animation:ca-fall 7s linear infinite}",
"@keyframes ca-ice-in{from{opacity:0;transform:scale(1.06)}to{opacity:1;transform:none}}",
"@keyframes ca-sheen{0%{transform:translateX(-60%)}60%,100%{transform:translateX(60%)}}",
"@keyframes ca-fall{from{transform:translateY(-30px) rotate(0)}to{transform:translateY(110vh) rotate(360deg)}}",
".ca-iced{filter:saturate(.35) brightness(1.1) hue-rotate(160deg)}",
".ca-burst{position:fixed;left:0;top:0;width:0;height:0;pointer-events:none;z-index:99999}",
".ca-burst .ca-coin{position:absolute;left:-11px;top:-11px;width:22px;height:22px;animation:ca-coin 1.1s cubic-bezier(.2,.7,.3,1) forwards}",
".ca-burst .ca-coin svg{width:100%;height:100%;display:block}",
"@keyframes ca-coin{0%{transform:translate(0,0) scale(.4) rotate(0);opacity:0}15%{opacity:1}55%{transform:translate(var(--dx),var(--dy)) scale(1) rotate(var(--r));opacity:1}100%{transform:translate(calc(var(--dx)*1.1),calc(var(--dy) + 60px)) scale(.8) rotate(var(--r));opacity:0}}",
".ca-burst-lbl{position:absolute;left:0;top:0;transform:translate(-50%,-50%);white-space:nowrap;font:900 22px/1 system-ui,-apple-system,'Segoe UI',sans-serif;color:#5fe08a;text-shadow:0 2px 0 rgba(0,0,0,.5),0 0 12px rgba(95,224,138,.6);animation:ca-lbl 1.6s ease-out forwards}",
".ca-burst-lbl.neg{color:#ff6b6b;text-shadow:0 2px 0 rgba(0,0,0,.5),0 0 12px rgba(255,107,107,.6)}",
"@keyframes ca-lbl{0%{transform:translate(-50%,-30%) scale(.6);opacity:0}15%{transform:translate(-50%,-80%) scale(1.15);opacity:1}70%{opacity:1}100%{transform:translate(-50%,-260%) scale(1);opacity:0}}",
".ca-confetti{position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:60}",
".ca-confetti i{position:absolute;top:-16px;width:8px;height:14px;border-radius:2px;animation:ca-conf 2.6s cubic-bezier(.3,.6,.5,1) forwards}",
"@keyframes ca-conf{to{transform:translate(var(--dx),110vh) rotate(var(--r));opacity:.9}}",
".ca-idle{animation:ca-breathe 4s ease-in-out infinite;transform-origin:50% 100%}",
"@keyframes ca-breathe{0%,100%{transform:scale(1)}50%{transform:scale(1.012) translateY(-1px)}}",
".ca-happy{animation:ca-hop .6s ease-out}@keyframes ca-hop{30%{transform:translateY(-10px)}60%{transform:translateY(0)}80%{transform:translateY(-3px)}}",
".ca-angry{animation:ca-shake .5s linear}@keyframes ca-shake{20%{transform:translateX(-6px)}40%{transform:translateX(6px)}60%{transform:translateX(-4px)}80%{transform:translateX(4px)}}",
".ca-pop{animation:ca-pop .35s cubic-bezier(.3,1.6,.5,1)}@keyframes ca-pop{from{transform:scale(.6);opacity:0}to{transform:none;opacity:1}}",
".ca-flip{perspective:800px;display:inline-block}.ca-flip>.ca-flip-in{position:relative;transition:transform .6s cubic-bezier(.3,1.3,.5,1);transform-style:preserve-3d}.ca-flip.on>.ca-flip-in{transform:rotateY(180deg)}",
".ca-flip-in>*{backface-visibility:hidden;-webkit-backface-visibility:hidden}.ca-flip-in>.ca-flip-b{position:absolute;inset:0;transform:rotateY(180deg)}",
"@media (prefers-reduced-motion: reduce){.ca-ice,.ca-ice-sheen,.ca-flake,.ca-plane .ca-prop,.ca-idle,.ca-happy,.ca-angry,.ca-pop,.ca-burst .ca-coin,.ca-confetti i{animation:none!important}.ca-burst .ca-coin,.ca-confetti{display:none}.ca-burst-lbl{animation:ca-lbl-r 1.4s ease-out forwards}.ca-flip>.ca-flip-in{transition:none}}",
"@keyframes ca-lbl-r{0%,80%{opacity:1;transform:translate(-50%,-80%)}100%{opacity:0;transform:translate(-50%,-80%)}}"
].join("\n");
CA.css = function () {
  if (!HAS_DOM || document.getElementById("css-cerul-art")) return;
  var st = document.createElement("style"); st.id = "css-cerul-art"; st.textContent = CSS; (document.head || document.documentElement).appendChild(st);
};
function fmtMoney(n) {
  if (typeof n === "string") return n;
  var D = G.CerulData, f = D && (D["fmt€"] || D.fmtE || D.fmtEur || D.fmt);
  var sign = n > 0 ? "+" : n < 0 ? "−" : "";
  if (typeof f === "function") { try { var r = f(Math.abs(n)); return sign + r; } catch (e) { } }
  var a = Math.abs(Math.round(n));
  if (a >= 1e6) return sign + (a / 1e6).toFixed(2).replace(/\.?0+$/, "").replace(".", ",") + " M €";
  return sign + String(a).replace(/\B(?=(\d{3})+(?!\d))/g, ".") + " €";
}
CA.fmtMoney = fmtMoney;
/* money burst at viewport coords (or element centre if x is an Element) */
CA.moneyBurst = function (x, y, amount, opt) {
  if (!HAS_DOM) return;
  CA.css(); opt = opt || {};
  if (x && x.getBoundingClientRect) { var b = x.getBoundingClientRect(); opt = y && typeof y === "object" ? y : opt; amount = typeof y === "object" ? amount : y; x = b.left + b.width / 2; y = b.top + b.height / 2; }
  var el = document.createElement("div"); el.className = "ca-burst"; el.style.left = x + "px"; el.style.top = y + "px";
  var neg = typeof amount === "number" && amount < 0, n = opt.coins != null ? opt.coins : (neg ? 0 : 12), h = "";
  for (var i = 0; i < n; i++) {
    var a = -Math.PI / 2 + (Math.random() - 0.5) * 2.6, d = 50 + Math.random() * 70;
    h += '<span class="ca-coin" style="--dx:' + (Math.cos(a) * d).toFixed(0) + "px;--dy:" + (Math.sin(a) * d).toFixed(0) + "px;--r:" + ((Math.random() - 0.5) * 720).toFixed(0) + "deg;animation-delay:" + (i * 0.02).toFixed(2) + 's">' + CA.coin(22) + "</span>";
  }
  if (amount != null && amount !== "") h += '<div class="ca-burst-lbl' + (neg ? " neg" : "") + '"' + (opt.color ? ' style="color:' + opt.color + '"' : "") + ">" + esc(fmtMoney(amount)) + "</div>";
  el.innerHTML = h; (opt.container || document.body).appendChild(el);
  setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 1800);
  return el;
};
CA.confetti = function (container, opt) {
  if (!HAS_DOM || CA.reduced) return;
  CA.css(); opt = opt || {}; container = container || document.body;
  var el = document.createElement("div"); el.className = "ca-confetti";
  if (container === document.body) el.style.position = "fixed";
  var cols = opt.colors || ["#ffd35c", "#ff8a4c", "#3fb7e8", "#5fd17a", "#ff6fae", "#c86bff", "#fff"], h = "";
  for (var i = 0; i < (opt.n || 70); i++) h += '<i style="left:' + (Math.random() * 100).toFixed(1) + "%;background:" + cols[i % cols.length] + ";--dx:" + ((Math.random() - 0.5) * 200).toFixed(0) + "px;--r:" + ((Math.random() - 0.5) * 1440).toFixed(0) + "deg;animation-delay:" + (Math.random() * 0.6).toFixed(2) + "s;animation-duration:" + (2 + Math.random() * 1.4).toFixed(2) + 's"></i>';
  el.innerHTML = h; container.appendChild(el);
  setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 4200);
  return el;
};
/* DOM convenience: element with flippable card (back → face). el.flip() reveals. */
CA.flipCard = function (card, opt) {
  if (!HAS_DOM) return null;
  CA.css(); opt = opt || {};
  var w = opt.w || 120, d = document.createElement("div"); d.className = "ca-flip" + (opt.open ? " on" : "");
  d.innerHTML = '<div class="ca-flip-in"><div class="ca-flip-a">' + CA.cardBack({ w: w }) + '</div><div class="ca-flip-b">' + (card != null ? CA.cardFace(card, { w: w }) : "") + "</div></div>";
  d.setFace = function (c) { d.querySelector(".ca-flip-b").innerHTML = CA.cardFace(c, { w: w }); };
  d.flip = function (on) { d.classList.toggle("on", on !== false); };
  return d;
};

G.CerulArt = CA;
if (typeof module !== "undefined" && module.exports) module.exports = CA;
})();
