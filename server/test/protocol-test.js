"use strict";
/* Protocol test: starts the server on a temp port + temp data dir, exercises accounts, friends, invites,
   db semantics (versions, update merge, subscriptions, leases), presence, stats recording and restart persistence.
   Run: node test/protocol-test.js */
const { spawn } = require("child_process");
const path = require("path");
const os = require("os");
const fs = require("fs");
const WebSocket = require("ws");

const PORT = 18000 + Math.floor(Math.random() * 1000);
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), "cerul-test-"));
const HTTP = `http://127.0.0.1:${PORT}`, WS = `ws://127.0.0.1:${PORT}`;
let srv, fails = 0, passes = 0;
const ok = (cond, msg) => { if (cond) { passes++; console.log("  ok  " + msg); } else { fails++; console.log("  FAIL " + msg); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));

function start() {
  return new Promise((resolve, reject) => {
    srv = spawn(process.execPath, [path.join(__dirname, "..", "server.js")], { env: Object.assign({}, process.env, { PORT: String(PORT), DATA_DIR: DATA }), stdio: ["ignore", "pipe", "inherit"] });
    srv.stdout.on("data", d => { const s = d.toString(); if (/on :\d+/.test(s)) resolve(); if (process.env.V) process.stdout.write(s); });
    srv.on("exit", c => { if (c) reject(new Error("server exit " + c)); });
  });
}
const stop = () => new Promise(r => { srv.once("exit", r); srv.kill("SIGTERM"); });
async function api(p, body, token) {
  const r = await fetch(HTTP + p, { method: body ? "POST" : "GET", headers: Object.assign({ "content-type": "application/json" }, token ? { authorization: "Bearer " + token } : {}), body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, body: await r.json() };
}
class Client {
  constructor(token) { this.token = token; this.n = 0; this.wait = new Map(); this.events = []; this.peer = "p" + Math.random().toString(36).slice(2, 8); }
  open(table) {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(WS);
      this.ws.on("open", () => this.ws.send(JSON.stringify({ t: "hello", proto: 2, token: this.token, peer: this.peer, table })));
      this.ws.on("message", d => { const m = JSON.parse(d); if (m.t === "welcome") { this.welcome = m; resolve(m); } else if (m.t === "res") { const w = this.wait.get(m.id); if (w) { this.wait.delete(m.id); w(m); } } else this.events.push(m); });
      this.ws.on("error", reject);
    });
  }
  req(op, args) { const id = ++this.n; return new Promise(r => { this.wait.set(id, r); this.ws.send(JSON.stringify(Object.assign({ t: "req", id, op }, args || {}))); }); }
  async ok(op, args) { const r = await this.req(op, args); if (!r.ok) throw new Error(op + ": " + r.code + " " + r.message); return r.r; }
  ev(pred) { return this.events.filter(pred); }
  close() { this.ws.close(); }
}

(async () => {
  await start();
  console.log("server up on", PORT, "data", DATA);
  // --- accounts
  const h = await api("/healthz"); ok(h.status === 200 && h.body.ok, "healthz");
  const ra = await api("/api/register", { username: "Damian", password: "parola123", remember: true });
  ok(ra.status === 200 && ra.body.token && ra.body.user.id.startsWith("a_"), "register Damian");
  const rb = await api("/api/register", { username: "oana", password: "secret77", email: "o@example.com" });
  ok(rb.status === 200, "register oana");
  ok((await api("/api/register", { username: "damian", password: "xxxxxx" })).status === 409, "duplicate username rejected (case-insensitive)");
  ok((await api("/api/login", { username: "damian", password: "gresit" })).status === 401, "wrong password rejected");
  const la = await api("/api/login", { username: "DAMIAN", password: "parola123", remember: true });
  ok(la.status === 200 && la.body.exp - Date.now() > 100 * 864e5, "login with remember-me gives long token");
  const lb = await api("/api/login", { username: "oana", password: "secret77", remember: false });
  ok(lb.status === 200 && lb.body.exp - Date.now() < 2 * 864e5, "login without remember gives short token");
  ok((await api("/api/me", null, la.body.token)).body.user.username === "Damian", "/api/me with token");
  const A = la.body.user, B = lb.body.user;

  // --- ws auth
  const bad = new Client("nope"); const wb = await bad.open(); ok(wb.err === "auth", "ws hello with bad token -> auth error"); bad.close();
  const ca = new Client(la.body.token), cb = new Client(lb.body.token);
  await ca.open(); await cb.open();
  ok(ca.welcome.user.id === A.id, "ws hello identifies account");

  // --- profile
  const pr = await ca.ok("profile.set", { profile: { name: "Damian", co: "Carpați Jet", av: 1, color: 2 } });
  ok(pr.user.profile.co === "Carpați Jet" && pr.user.profile.color === 2, "profile.set");

  // --- friends
  const fr = await ca.ok("friends.request", { username: "oana" }); ok(fr.status === "sent", "friend request sent");
  await sleep(50); ok(cb.ev(e => e.t === "social").length > 0, "oana got social push");
  let fl = await cb.ok("friends.list"); ok(fl.incoming.length === 1 && fl.incoming[0].id === A.id, "oana sees incoming request");
  fl = await cb.ok("friends.respond", { uid: A.id, accept: true }); ok(fl.friends.length === 1 && fl.friends[0].online, "accepted, friend online");
  ok((await ca.req("friends.request", { username: "nimeni" })).code === "not_found", "unknown username -> not_found");

  // --- tables
  const { code } = await ca.ok("create"); ok(/^[A-Z2-9]{5}$/.test(code), "create table " + code);
  ok((await cb.req("enter", { code: "ZZZZZ" })).code === "not_found", "enter unknown code -> not_found");
  const inv = await ca.ok("friends.invite", { uid: B.id, code }); ok(inv.online, "invite sent to online friend");
  await sleep(50); const ie = cb.ev(e => e.t === "invite")[0]; ok(ie && ie.code === code && ie.from.id === A.id, "oana got invite push");
  await cb.ok("enter", { code: ie.code }); ok(true, "oana entered via invite");

  // --- db semantics
  await cb.ok("sub", { kind: "doc", path: "st/x" });
  await cb.ok("sub", { kind: "col", path: "seats" });
  const s1 = await ca.ok("set", { path: "st/x", data: { s: { a: 1, n: { p: 1, q: 2 } } } }); ok(s1.v === 1, "set -> v1");
  const s2 = await ca.ok("update", { path: "st/x", data: { s: { n: { q: 3 }, arr: [1] } } }); ok(s2.v === 2, "update -> v2");
  const g = await cb.ok("get", { path: "st/x" }); ok(g.data.s.a === 1 && g.data.s.n.p === 1 && g.data.s.n.q === 3 && g.data.s.arr[0] === 1, "update deep-merges");
  ok((await ca.req("update", { path: "st/none", data: { a: 1 } })).code === "invalid_argument", "update of missing doc rejected");
  ok((await ca.req("set", { path: "st", data: {} })).code === "invalid_argument", "odd path rejected for doc");
  await sleep(50); ok(cb.ev(e => e.t === "doc" && e.path === "st/x").length === 2, "subscriber got 2 doc events");
  const L1 = await ca.ok("acquire", { path: "seats/x", holder: A.id, ttlMs: 2500 }); ok(L1.acquired, "lease acquired");
  const L2 = await cb.ok("acquire", { path: "seats/x", holder: B.id, ttlMs: 2500 }); ok(!L2.acquired && L2.expiresAt, "lease busy for other holder");
  const L3 = await ca.ok("acquire", { path: "seats/x", holder: A.id, ttlMs: 2500 }); ok(L3.acquired, "same holder re-acquires");
  await ca.ok("release", { path: "seats/x", holder: A.id });
  const L4 = await cb.ok("acquire", { path: "seats/x", holder: B.id, ttlMs: 1 }); ok(L4.acquired, "after release other holder acquires (ttl clamped to 1 s)");
  await sleep(1100); const L5 = await ca.ok("acquire", { path: "seats/x", holder: A.id }); ok(L5.acquired, "lease expires by TTL");
  // resend after reconnect is applied once
  const id = 999; ca.ws.send(JSON.stringify({ t: "req", id, op: "set", path: "st/once", data: { k: 1 } })); await sleep(80);
  const again = await new Promise(r => { ca.wait.set(id, r); ca.ws.send(JSON.stringify({ t: "req", id, op: "set", path: "st/once", data: { k: 1 } })); });
  ok(again.r.v === 1, "duplicate request id not applied twice");

  // --- presence
  await ca.ok("join", { room: "", presence: { name: "Damian" } });
  await cb.ok("join", { room: "", presence: { name: "Oana" } });
  await ca.ok("presence", { room: "", p: { name: "Damian", game: "cerul" } });
  await sleep(80);
  const lastPeers = cb.ev(e => e.t === "peers" && e.room === "").pop();
  ok(lastPeers && lastPeers.peers.length === 2 && lastPeers.peers.some(p => p.by === A.id && p.presence.game === "cerul"), "presence visible to the other peer");
  await ca.ok("join", { room: "g-cerul" }); await ca.ok("emit", { room: "g-cerul", topic: "hi", data: 1 });

  // --- stats: seats + finished game
  await ca.ok("set", { path: "seats/cerul", data: { p1: { owner: A.id, name: "Damian" }, p2: { owner: B.id, name: "Oana" }, p3: { owner: "bot:x", name: "Bot", bot: true } } });
  const endState = { s: { __sid: "g1", __rev: 9, __pl: ["p1", "p2", "p3"], phase: "end", c: { p1: { name: "Damian", co: "Carpați Jet" }, p2: { name: "Oana", co: "Delta Wings" }, p3: { name: "Bot", co: "Bot Air" } },
    res: { win: "p2", day: 30, vals: [{ seat: "p2", total: 9000000 }, { seat: "p1", total: 7000000 }, { seat: "p3", total: 1000 }] }, __end: { winner: "p2", at: Date.now() } } };
  await cb.ok("set", { path: "st/cerul", data: endState });
  await cb.ok("set", { path: "st/cerul", data: endState }); // same game again -> recorded once
  const hA = await ca.ok("h2h.get", { uid: B.id });
  ok(hA.games === 1 && hA.losses === 1 && hA.wins === 0 && hA.best === 7000000 && hA.theirBest === 9000000, "head-to-head recorded once (Damian lost to Oana)");
  const stB = await cb.ok("stats.get"); ok(stB.games === 1 && stB.wins === 1 && stB.best === 9000000 && stB.bestCo === "Delta Wings", "personal stats for Oana");
  fl = await ca.ok("friends.list"); ok(fl.friends[0].h2h.games === 1 && fl.friends[0].table === code, "friend card carries h2h + table");

  // --- logout kills token
  ca.close(); cb.close();
  await api("/api/logout", {}, lb.body.token);
  ok((await api("/api/me", null, lb.body.token)).status === 401, "logout invalidates token");

  // --- restart: everything persisted
  await sleep(1700); await stop(); await start();
  ok((await api("/api/me", null, la.body.token)).status === 200, "remembered token survives restart");
  const c2 = new Client(la.body.token); const w2 = await c2.open(code);
  ok(w2.table === code, "table survives restart");
  const g2 = await c2.ok("get", { path: "st/x" }); ok(g2.v === 2 && g2.data.s.n.q === 3, "docs + versions survive restart");
  const h2 = await c2.ok("h2h.get", { uid: B.id }); ok(h2.games === 1, "h2h survives restart");
  fl = await c2.ok("friends.list"); ok(fl.friends.length === 1 && !fl.friends[0].online, "friends survive restart (oana offline)");
  c2.close();
  await stop();
  console.log(`\n${passes} passed, ${fails} failed`);
  process.exit(fails ? 1 : 0);
})().catch(async e => { console.error(e); try { await stop(); } catch (x) {} process.exit(1); });
