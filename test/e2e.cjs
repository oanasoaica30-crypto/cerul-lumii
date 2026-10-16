/* End-to-end test (headless Chromium, 2 players = 2 browser contexts) against a local server and the
   desktop app files served over http. Covers: register x2, "Ține-mă minte" (reload stays logged in),
   friend request + accept, create table, join by CODE, a short Cerul game to the end (fast test hooks +
   Salon._bot), head-to-head stats recorded, then a new table + invite from the in-game HUD + accept.
   Run: PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node test/e2e.cjs            (screenshots -> test/out/) */
"use strict";
const { spawn } = require("child_process");
const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { chromium } = require(process.env.PW || "/opt/npm-tools/node_modules/playwright");

const ROOT = path.resolve(__dirname, "..");
const APP = path.join(ROOT, "electron", "app");
const OUT = path.join(__dirname, "out"); fs.mkdirSync(OUT, { recursive: true });
const SP = 18000 + Math.floor(Math.random() * 900), HP = SP + 1000;
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), "cerul-e2e-"));
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0; const ok = (c, m) => { console.log((c ? "  ok   " : "  FAIL ") + m); if (!c) fails++; };
const t0 = Date.now(); const log = m => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s] ${m}`);

// static server for electron/app
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css", ".woff2": "font/woff2", ".png": "image/png" };
const stat = http.createServer((q, r) => { const f = path.join(APP, decodeURIComponent(q.url.split("?")[0]).replace(/^\/+/, "") || "index.html");
  if (!f.startsWith(APP) || !fs.existsSync(f)) { r.writeHead(404); r.end(); return; } r.writeHead(200, { "Content-Type": MIME[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(r); });

(async () => {
  await new Promise(r => stat.listen(HP, r));
  const srv = spawn(process.execPath, [path.join(ROOT, "server", "server.js")], { env: Object.assign({}, process.env, { PORT: String(SP), DATA_DIR: DATA }), stdio: ["ignore", "pipe", "pipe"] });
  let srvLog = ""; srv.stdout.on("data", d => { srvLog += d; }); srv.stderr.on("data", d => { srvLog += d; });
  for (let i = 0; i < 50 && !/on :\d+/.test(srvLog); i++) await sleep(100);
  const URL0 = `http://127.0.0.1:${HP}/index.html?server=ws://127.0.0.1:${SP}`;
  const GAMEQ = `&cerulspeed=40&cerulauto=1&cerulopts=${encodeURIComponent('{"dur":12}')}`;
  const browser = await chromium.launch({ args: ["--disable-gpu", "--mute-audio"] });
  const errors = [];
  async function player(name) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    page.on("pageerror", e => errors.push(name + ": " + e.message));
    page.on("console", m => { if (m.type() === "error" && !/favicon|fonts\.g|ERR_|net::/.test(m.text())) errors.push(name + " console: " + m.text().slice(0, 200)); });
    return { name, ctx, page };
  }
  const A = await player("A"), B = await player("B");
  try {
    // ---- intro + register
    await A.page.goto(URL0 + GAMEQ);
    await A.page.waitForSelector(".cx-intro", { timeout: 5000 }); ok(true, "intro animation shown");
    await A.page.screenshot({ path: path.join(OUT, "01-intro.png") });
    await A.page.mouse.click(600, 400); // skip
    await A.page.waitForSelector("#cx-af", { timeout: 8000 });
    await A.page.screenshot({ path: path.join(OUT, "02-login.png") });
    async function register(P, user, name, remember) {
      await P.page.click('[data-m="register"]');
      await P.page.fill("#cx-u", user); await P.page.fill("#cx-p", "parola123"); await P.page.fill("#cx-n", name);
      if (!remember) await P.page.uncheck("#cx-rem");
      await P.page.click("#cx-ago");
      await P.page.waitForSelector("#cx-create", { timeout: 15000 });
    }
    await register(A, "damian", "Damian", true); ok(true, "A registered (remember me on) -> lobby");
    await B.page.goto(URL0 + GAMEQ + "&nointro=1");
    await B.page.waitForSelector("#cx-af");
    await register(B, "oana", "Oana", false); ok(true, "B registered (remember me off) -> lobby");
    // ---- remember me: a fresh page load stays logged in
    await A.page.goto(URL0 + GAMEQ + "&nointro=1"); await A.page.waitForSelector("#cx-create", { timeout: 10000 });
    ok(await A.page.$("#cx-af") === null, "A reloads -> still logged in (Ține-mă minte)");
    // ---- profile: company + colour
    await A.page.click("#cx-prof"); await A.page.waitForSelector("#cx-pc");
    await A.page.fill("#cx-pc", "Carpați Jet"); await A.page.click('[data-col="3"]'); await A.page.click('[data-av="2"]');
    await A.page.screenshot({ path: path.join(OUT, "03-profile.png") });
    await A.page.click("#cx-psave"); await sleep(400);
    ok((await A.page.textContent("#cx-prof")).includes("Carpați Jet"), "profile saved (company name)");
    // ---- friends
    await A.page.fill("#cx-addf", "oana"); await A.page.click('#cx-addform button[type="submit"]');
    await B.page.waitForSelector("[data-acc]", { timeout: 8000 }); ok(true, "B sees friend request live");
    await B.page.click("[data-acc]");
    await A.page.waitForSelector('[data-f]', { timeout: 8000 });
    ok((await A.page.textContent(".cx-list")).includes("online"), "A sees B as friend, online");
    await A.page.screenshot({ path: path.join(OUT, "04-lobby-friends.png") });
    // ---- create table + join by code
    await A.page.click("#cx-create");
    await A.page.waitForSelector("#cx-hcode", { timeout: 20000 });
    const code = (await A.page.textContent("#cx-hcode .code")).trim(); ok(/^[A-Z2-9]{5}$/.test(code), "A created table " + code);
    await B.page.fill("#cx-code", code); await B.page.click('#cx-join button[type="submit"]');
    await B.page.waitForSelector("#cx-hcode", { timeout: 20000 }); ok(true, "B joined by code");
    log("both at table, waiting for seats");
    const info = P => P.page.evaluate(() => window.Salon && Salon._info ? Salon._info() : null);
    let ia, ib;
    for (let i = 0; i < 60; i++) { ia = await info(A); ib = await info(B); if (ia && ib && ia.seat && ib.seat) break; await sleep(500); }
    ok(ia && ib && ia.seat && ib.seat && ia.seat !== ib.seat, `seats auto-claimed: A=${ia && ia.seat} B=${ib && ib.seat}`);
    const peersB = await B.page.evaluate(() => { const r = CerulNet._debug.rooms.get(""); return r ? r.peers.filter(p => !p.sameTab).map(p => p.presence.name) : []; });
    ok(peersB.includes("Damian"), "presence: B sees A in the lobby room (" + peersB.join(",") + ")");
    await A.page.screenshot({ path: path.join(OUT, "05-cerul-lobby.png") });
    // ---- start + play to the end with bots
    let started = false;
    for (let i = 0; i < 20 && !started; i++) { for (const P of [A, B]) { try { await P.page.click("#startBtn", { timeout: 800 }); started = true; break; } catch (e) {} } if (!started) await sleep(500); }
    for (let i = 0; i < 20; i++) { ia = await info(A); if (ia && ia.hasState) break; await sleep(300); }
    ok(ia && ia.hasState, "game started (#startBtn)");
    log("playing (speed 40, auto setup, Salon._bot)…");
    let ended = false, shot = false;
    for (let i = 0; i < 900 && !ended; i++) {
      for (const P of [A, B]) await P.page.evaluate(() => { try { Salon._bot(); } catch (e) {} });
      if (i % 10 === 0) { ia = await info(A); ended = !!(ia && ia.ended); if (ia && ia.hasState && (i === 20 || i === 40)) await A.page.screenshot({ path: path.join(OUT, "06-cerul-playing-" + i + ".png") }); }
      await sleep(150);
    }
    log("ended=" + ended);
    ok(ended, "game reached the end");
    await sleep(2500);
    await A.page.screenshot({ path: path.join(OUT, "07-cerul-end.png") });
    // ---- stats
    await A.page.click("#cx-hlob"); await A.page.waitForSelector("#cx-create");
    await sleep(800);
    const statTxt = await A.page.textContent(".cx-stats");
    ok(/^\s*1\s*partide/.test(statTxt.replace(/\s+/g, " ").trim()), "personal stats: 1 game (" + statTxt.replace(/\s+/g, " ").trim().slice(0, 60) + ")");
    const score = await A.page.textContent(".cx-friend .cx-score");
    ok(/^[01]–[01]$/.test(score.trim()) && score.trim() !== "0–0", "head-to-head on friend card: " + score.trim());
    await A.page.click(".cx-friend"); await A.page.waitForSelector(".cx-h2h");
    await A.page.screenshot({ path: path.join(OUT, "08-friend-card.png") });
    await A.page.click(".cx-modal .cx-x");
    // ---- invite flow: A creates a new table (reload), invites B from the HUD; B accepts the toast
    await A.page.click("#cx-create");
    await A.page.waitForSelector("#cx-hcode", { timeout: 25000 });
    const code2 = (await A.page.textContent("#cx-hcode .code")).trim(); ok(code2 !== code, "A switched to new table " + code2);
    await A.page.click("#cx-hinv"); await A.page.waitForSelector("[data-hi]", { timeout: 5000 });
    await A.page.click("[data-hi]");
    await B.page.waitForSelector(".cx-toast button.primary", { timeout: 8000 }); ok(true, "B got the invite toast in game");
    await B.page.screenshot({ path: path.join(OUT, "09-invite-toast.png") });
    await B.page.click(".cx-toast button.primary");
    await B.page.waitForFunction(c => { const e = document.querySelector("#cx-hcode .code"); return e && e.textContent.trim() === c; }, code2, { timeout: 25000 });
    ok(true, "B followed the invite to " + code2);
    for (let i = 0; i < 40; i++) { ia = await info(A); ib = await info(B); if (ia && ib && ia.seat && ib.seat) break; await sleep(500); }
    ok(ia && ib && ia.seat && ib.seat, "both seated at the invited table");
    // ---- real setup scene (auto setup off): the account profile is pre-filled into Cerul's form
    for (const P of [A, B]) await P.page.evaluate(() => { window.__CERUL_AUTO = 0; });
    for (let i = 0; i < 20; i++) { try { await A.page.click("#startBtn", { timeout: 800 }); break; } catch (e) { await sleep(300); } }
    await A.page.waitForFunction(() => !!document.querySelector(".cs-prof"), null, { timeout: 20000 });
    await sleep(2500);
    const pf = await A.page.evaluate(() => { const f = document.querySelector(".cs-prof"); return f && { co: (f.querySelector('[data-f="co"]') || {}).value, av: !!f.querySelector('[data-av="2"].on'), col: !!f.querySelector('[data-col="3"].on') }; });
    ok(pf && pf.co === "Carpați Jet" && pf.av && pf.col, "Cerul setup pre-filled from profile: " + JSON.stringify(pf));
    await A.page.screenshot({ path: path.join(OUT, "10-setup-prefilled.png") });
  } catch (e) { fails++; console.error("ERROR", e.message); try { await A.page.screenshot({ path: path.join(OUT, "err-A.png") }); await B.page.screenshot({ path: path.join(OUT, "err-B.png") }); } catch (x) {} }
  ok(errors.length === 0, "no page errors" + (errors.length ? ": " + errors.slice(0, 5).join(" | ") : ""));
  await browser.close(); srv.kill("SIGTERM"); stat.close();
  if (process.env.V) console.log(srvLog);
  console.log(`\n${fails ? "FAILED: " + fails : "ALL OK"} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  process.exit(fails ? 1 : 0);
})();
