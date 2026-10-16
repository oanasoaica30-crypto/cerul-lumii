#!/usr/bin/env node
/*
 * Copies ONLY what "Cerul Lumii" needs from the salon (web) project into the desktop app, and builds
 * electron/app/index.html around it:
 *   core.js, games/cerul*.js            (unchanged game code)
 *   index.template.html                 (page markup + shared CSS; the hub's script tags are dropped)
 *   client/shim.js, app.js, app.css     (desktop runtime + UI, from this repo)
 *
 * Usage:  node scripts/sync-game.mjs [path/to/salon]      (default: ../salon, then /home/claude/salon)
 *         node scripts/sync-game.mjs --check               (only regenerate index.html from what is in electron/app)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const APP = path.join(ROOT, "electron", "app");
const args = process.argv.slice(2);
const checkOnly = args.includes("--check");
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, "config.json"), "utf8"));

function findSalon() {
  const cands = [args.find(a => !a.startsWith("--")), path.join(ROOT, "..", "salon"), "/home/claude/salon"].filter(Boolean);
  for (const c of cands) if (fs.existsSync(path.join(c, "core.js")) && fs.existsSync(path.join(c, "games"))) return path.resolve(c);
  throw new Error("nu găsesc proiectul salon (core.js + games/). Dă calea ca argument.");
}
const copy = (from, to) => { fs.mkdirSync(path.dirname(to), { recursive: true }); fs.copyFileSync(from, to); };

fs.mkdirSync(path.join(APP, "games"), { recursive: true });
if (!checkOnly) {
  const SALON = findSalon();
  // remove stale game files, then copy the current ones
  for (const f of fs.readdirSync(path.join(APP, "games"))) fs.unlinkSync(path.join(APP, "games", f));
  const games = fs.readdirSync(path.join(SALON, "games")).filter(f => /^cerul(-[a-z0-9-]+)?\.js$/.test(f)).sort();
  if (!games.includes("cerul.js")) throw new Error("games/cerul.js lipsește în " + SALON);
  for (const g of games) copy(path.join(SALON, "games", g), path.join(APP, "games", g));
  copy(path.join(SALON, "core.js"), path.join(APP, "core.js"));
  copy(path.join(SALON, "index.template.html"), path.join(APP, "index.template.html"));
  console.log(`din ${SALON}: core.js + ${games.length} fișiere cerul*.js`);
}
for (const f of ["shim.js", "app.js", "app.css"]) copy(path.join(ROOT, "client", f), path.join(APP, f));

/* ---- index.html ---- */
const tpl = fs.readFileSync(path.join(APP, "index.template.html"), "utf8");
const cut = tpl.indexOf('<canvas id="fx"');
if (cut < 0) throw new Error('index.template.html: nu găsesc <canvas id="fx"> (s-a schimbat structura?)');
let head = tpl.slice(0, cut), body = tpl.slice(cut);
head = head.replace(/<title>[^<]*<\/title>/, "<title>Cerul Lumii</title>")
  .replace(/<meta name="claude:[^>]*>\s*/g, "")
  .replace(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com[^>]*>\s*/g, ""); // fonts are bundled (fonts/fonts.css)
body = body.replace(/<script src="core\.js"><\/script>\s*/, "").replace(/<!--GAMES-->\s*/, "").replace(/<script>\s*Salon\.boot\(\);?\s*<\/script>\s*/, "")
  .replace(/(<a class="brand"[^>]*>)(<i><\/i>)?[^<]*(<\/a>)/, "$1<i></i>Cerul Lumii$3");
if (/<script/.test(body)) console.warn("atenție: au rămas tag-uri <script> în corpul șablonului");
const games = fs.readdirSync(path.join(APP, "games")).filter(f => f.endsWith(".js")).sort();
const EARLY = ["games/cerul-data.js", "games/cerul-art.js"].filter(f => games.includes(path.basename(f)));
const appCfg = { defaultServer: cfg.defaultServer, early: EARLY, scripts: ["core.js", ...games.map(g => "games/" + g).filter(g => !EARLY.includes(g))] };
const html = `<!doctype html>
<html lang="ro">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'self' file: data: blob:; script-src 'self' file: 'unsafe-inline'; style-src 'self' file: 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' file: data: https://fonts.gstatic.com; img-src 'self' file: data: blob:; media-src 'self' file: data: blob:; connect-src 'self' ws: wss: http: https:">
<!-- GENERAT de scripts/sync-game.mjs — nu edita de mână -->
<link rel="stylesheet" href="fonts/fonts.css">
${head.trim()}
<link rel="stylesheet" href="app.css">
<script>window.__CERUL_APP = ${JSON.stringify(appCfg)};</script>
<script src="shim.js"></script>
</head>
<body>
${body.trim()}
<script src="app.js"></script>
</body>
</html>
`;
fs.writeFileSync(path.join(APP, "index.html"), html);
console.log(`electron/app/index.html: ${appCfg.scripts.length + EARLY.length} scripturi, server implicit ${cfg.defaultServer}`);
