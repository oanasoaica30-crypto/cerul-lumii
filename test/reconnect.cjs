/* Reconnect test: one player at a table, the server restarts (same data), the client shows the
   "Conexiune pierdută" banner, reconnects by itself, keeps its table/seat, and a write made while
   the server was down is delivered after reconnect.
   Run: PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node test/reconnect.cjs */
"use strict";
const { spawn } = require("child_process");
const http = require("http"), fs = require("fs"), path = require("path"), os = require("os");
const { chromium } = require(process.env.PW || "/opt/npm-tools/node_modules/playwright");
const ROOT = path.resolve(__dirname, ".."), APP = path.join(ROOT, "electron", "app");
const SP = 19000 + Math.floor(Math.random() * 400), HP = SP + 500;
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), "cerul-rc-"));
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0; const ok = (c, m) => { console.log((c ? "  ok   " : "  FAIL ") + m); if (!c) fails++; };
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".woff2": "font/woff2", ".png": "image/png" };
const stat = http.createServer((q, r) => { const f = path.join(APP, decodeURIComponent(q.url.split("?")[0]).replace(/^\/+/, ""));
  if (!f.startsWith(APP) || !fs.existsSync(f)) { r.writeHead(404); r.end(); return; } r.writeHead(200, { "Content-Type": MIME[path.extname(f)] || "application/octet-stream" }); fs.createReadStream(f).pipe(r); });
function startServer() {
  return new Promise(res => { const s = spawn(process.execPath, [path.join(ROOT, "server", "server.js")], { env: Object.assign({}, process.env, { PORT: String(SP), DATA_DIR: DATA }), stdio: ["ignore", "pipe", "inherit"] });
    s.stdout.on("data", d => { if (/on :\d+/.test(String(d))) res(s); }); });
}
(async () => {
  await new Promise(r => stat.listen(HP, r));
  let srv = await startServer();
  const browser = await chromium.launch({ args: ["--disable-gpu", "--mute-audio"] });
  const page = await (await browser.newContext({ viewport: { width: 1200, height: 760 } })).newPage();
  const errs = []; page.on("pageerror", e => errs.push(e.message));
  try {
    await page.goto(`http://127.0.0.1:${HP}/index.html?server=ws://127.0.0.1:${SP}&nointro=1`);
    await page.waitForSelector("#cx-af"); await page.click('[data-m="register"]');
    await page.fill("#cx-u", "solo"); await page.fill("#cx-p", "parola123"); await page.click("#cx-ago");
    await page.waitForSelector("#cx-create"); await page.click("#cx-create");
    await page.waitForSelector("#cx-hcode", { timeout: 20000 });
    const code = (await page.textContent("#cx-hcode .code")).trim();
    for (let i = 0; i < 30; i++) { const s = await page.evaluate(() => Salon._info() && Salon._info().seat); if (s) break; await sleep(400); }
    ok(!!(await page.evaluate(() => Salon._info().seat)), "seated at " + code);
    // server goes down
    await new Promise(r => { srv.once("exit", r); srv.kill("SIGTERM"); });
    await sleep(3500);
    ok(await page.evaluate(() => !document.querySelector(".cx-banner").hidden), "banner shown while the server is down");
    // a db write while offline stays pending (core's ctx.net sees it in flight) and is delivered later
    await page.evaluate(() => { window.__w = "pending"; claude.use("db").then(db => db.doc("test/offline").set({ v: 42 })).then(() => { window.__w = "done"; }); });
    await sleep(500);
    ok(await page.evaluate(() => window.__w) === "pending", "write made offline is pending");
    srv = await startServer();
    await page.waitForFunction(() => window.__w === "done", null, { timeout: 15000 });
    ok(true, "offline write delivered after reconnect");
    await page.waitForFunction(() => document.querySelector(".cx-banner").hidden, null, { timeout: 8000 });
    ok(true, "banner gone after reconnect");
    const back = await page.evaluate(() => claude.use("db").then(db => db.doc("test/offline").get()).then(s => s.data().v));
    ok(back === 42, "value is on the server");
    ok(await page.evaluate(() => Salon._info().seat) && (await page.textContent("#cx-hcode .code")).trim() === code, "still at the same table and seat");
  } catch (e) { fails++; console.error("ERROR", e.message); }
  ok(!errs.length, "no page errors " + errs.slice(0, 3).join(" | "));
  await browser.close(); srv.kill("SIGTERM"); stat.close();
  console.log(fails ? `FAILED: ${fails}` : "ALL OK"); process.exit(fails ? 1 : 0);
})();
