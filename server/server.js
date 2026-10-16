"use strict";
/*
 * Cerul Lumii — game server (accounts, friends, head-to-head stats, game tables).
 *
 * 1) HTTP  /api/register, /api/login, /api/logout, /api/me     (rate-limited, bcrypt passwords, bearer tokens)
 *    HTTP  /healthz                                             (Render health check, wakes the server)
 * 2) WebSocket on the same port: re-implements the two claude.ai Artifact runtime capabilities the game
 *    uses (see ../API_SURFACE.md), scoped to a TABLE ("masă", short code) so several friend groups play apart:
 *      db   — JSON docs at slash paths, versions, last-writer-wins set/update/delete, live subscriptions
 *             (document + collection), short cooperative leases with TTL (+ release).
 *      room — presence per room (lobby "" + named rooms from join(name)), peers, emit/on moments.
 *    plus account ops: profile, friends (request/accept/decline/remove), invites, personal + head-to-head stats.
 *
 * Wire protocol (JSON text frames):
 *   C->S {t:"hello", proto:2, token, peer, table?}     -> {t:"welcome", user, table|null, err?}   (err: "auth" | "no_table" | ...)
 *   C->S {t:"req", id, op, ...args}                    -> {t:"res", id, ok:true, r} | {t:"res", id, ok:false, code, message}
 *   S->C {t:"doc", path, exists, data, v}               subscribed doc (or doc of a subscribed collection) changed
 *   S->C {t:"peers", room, peers:[{peer, by, presence, at}]}
 *   S->C {t:"msg", room, topic, data, peer, by}
 *   S->C {t:"social"}                                   friends/requests/online changed -> client re-reads friends.list
 *   S->C {t:"invite", from:{id, username, name}, code, at}
 *   S->C {t:"stats"}                                    a game of yours was recorded -> client re-reads stats
 */
const http = require("http");
const crypto = require("crypto");
const { WebSocketServer } = require("ws");
const bcrypt = require("bcryptjs");
const { makeStore } = require("./store");

const PORT = +process.env.PORT || 8787;
const VERSION = require("./package.json").version;
const MAX_DOC_BYTES = 256 * 1024;      // same limit as the Artifact db
const MAX_DOCS_PER_TABLE = 5000;
const MAX_CONNS_PER_TABLE = 24;
const MAX_TABLES = +process.env.MAX_TABLES || 3000;
const MAX_USERS = +process.env.MAX_USERS || 5000;
const TABLE_TTL_DAYS = +process.env.TABLE_TTL_DAYS || 60;   // tables untouched this long are deleted
const PEER_GRACE_MS = 4000;            // a dropped socket keeps its presence this long (quick reconnects don't flap)
const FLUSH_MS = 1500;
const TOKEN_DAYS_REMEMBER = 180, TOKEN_HOURS_SESSION = 24;
const CODE_ABC = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I, O, 0, 1
const CODE_LEN = 5;
const RECENT_N = 20;

const store = makeStore();
const tables = new Map();    // code -> Table
const users = new Map();     // uid -> user record
const byName = new Map();    // lowercase username -> uid
const sessions = new Map();  // sha256(token) -> {uid, exp, remember, created}
const h2h = new Map();       // "uidA|uidB" (sorted) -> pair stats
const online = new Map();    // uid -> Set(conn)
const invites = new Map();   // uid -> [{from, code, at}] (memory only, 2 h)
const startedAt = Date.now();

/* ---------------- persistence (debounced, swappable store) ---------------- */
const dirty = { tables: new Set(), users: new Set(), sessions: new Set(), h2h: new Set() };
const removed = { tables: new Set(), users: new Set(), sessions: new Set(), h2h: new Set() };
const mark = (kind, key) => { removed[kind].delete(key); dirty[kind].add(key); };
const unmark = (kind, key) => { dirty[kind].delete(key); removed[kind].add(key); };
const SRC = { tables: k => tables.get(k) && tables.get(k).toJSON(), users: k => users.get(k), sessions: k => sessions.get(k), h2h: k => h2h.get(k) };
let flushing = false;
async function flush() {
  if (flushing) return; flushing = true;
  try {
    for (const kind of Object.keys(dirty)) {
      for (const key of [...dirty[kind]]) { dirty[kind].delete(key); const doc = SRC[kind](key); if (!doc) continue;
        try { await store.save(kind, key, doc); } catch (e) { console.error("[save]", kind, key, e.message); dirty[kind].add(key); } }
      for (const key of [...removed[kind]]) { removed[kind].delete(key); try { await store.remove(kind, key); } catch (e) { console.error("[rm]", kind, key, e.message); } }
    }
  } finally { flushing = false; }
}
async function loadAll() {
  await store.init();
  const cut = Date.now() - TABLE_TTL_DAYS * 864e5;
  for (const { key, doc } of await store.loadAll("users")) { delete doc.__key; users.set(key, doc); byName.set(doc.username, key); }
  for (const { key, doc } of await store.loadAll("sessions")) { delete doc.__key; if (doc.exp > Date.now() && users.has(doc.uid)) sessions.set(key, doc); else store.remove("sessions", key).catch(() => {}); }
  for (const { key, doc } of await store.loadAll("h2h")) { delete doc.__key; h2h.set(key, doc); }
  for (const { key, doc } of await store.loadAll("tables")) {
    if ((doc.touched || 0) < cut) { store.remove("tables", key).catch(() => {}); continue; }
    tables.set(key, new Table(key, doc));
  }
  console.log(`[store] ${store.kind}: ${users.size} user(s), ${sessions.size} session(s), ${tables.size} table(s), ${h2h.size} pair(s)`);
}

/* ---------------- helpers ---------------- */
const SEG = /^[A-Za-z0-9_\-.~:@+]{1,200}$/;
function checkPath(p, wantDoc) {
  if (typeof p !== "string" || !p || p.length > 1000) return "bad path";
  const segs = p.split("/");
  if (segs.length > 16) return "too many segments";
  for (const s of segs) if (!SEG.test(s) || s === "." || s === "..") return "bad segment '" + s + "'";
  if (wantDoc === true && segs.length % 2 !== 0) return "document path needs an even number of segments";
  if (wantDoc === false && segs.length % 2 !== 1) return "collection path needs an odd number of segments";
  return null;
}
const parentOf = p => p.slice(0, p.lastIndexOf("/"));
const isObj = o => o !== null && typeof o === "object" && !Array.isArray(o);
function depth(o, d = 0) { if (d > 32) return d; if (o && typeof o === "object") { let m = d; for (const k in o) m = Math.max(m, depth(o[k], d + 1)); return m; } return d; }
function deepMerge(base, patch) { // nested objects merge recursively; anything else (arrays too) replaces
  const out = isObj(base) ? Object.assign({}, base) : {};
  for (const k of Object.keys(patch)) { const v = patch[k]; out[k] = isObj(v) && isObj(out[k]) ? deepMerge(out[k], v) : v; }
  return out;
}
function newCode() {
  for (let i = 0; i < 200; i++) {
    let c = ""; const b = crypto.randomBytes(CODE_LEN);
    for (let j = 0; j < CODE_LEN; j++) c += CODE_ABC[b[j] % CODE_ABC.length];
    if (!tables.has(c)) return c;
  }
  throw new Error("no free code");
}
const normCode = c => String(c || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
const sha = s => crypto.createHash("sha256").update(String(s)).digest("hex");
class Err extends Error { constructor(code, msg) { super(msg || code); this.code = code; } }
const clip = (s, n) => String(s == null ? "" : s).replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, n);

/* ---------------- accounts ---------------- */
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 10); // same timing for unknown users
const USER_RE = /^[a-z0-9_.-]{3,20}$/;
function publicUser(u) { return u && { id: u.id, username: u.uname || u.username, name: u.profile.name || u.uname || u.username, profile: u.profile }; }
function meUser(u) { return Object.assign(publicUser(u), { email: u.email || "", created: u.created }); }
function newStats() { return { games: 0, wins: 0, draws: 0, best: 0, bestCo: "", recent: [] }; }
function sanitizeProfile(p, u) {
  p = isObj(p) ? p : {};
  const cur = u ? u.profile : {};
  return {
    name: clip(p.name !== undefined ? p.name : cur.name, 16) || (u ? u.uname : "Pilot"),
    co: clip(p.co !== undefined ? p.co : cur.co, 22),
    av: Math.max(0, Math.min(9, (p.av !== undefined ? p.av : cur.av) | 0)),
    color: Math.max(0, Math.min(5, (p.color !== undefined ? p.color : cur.color) | 0)),
    g: (p.g !== undefined ? p.g : cur.g) === "f" ? "f" : "m",
  };
}
function issueToken(uid, remember) {
  const token = crypto.randomBytes(32).toString("base64url");
  const exp = Date.now() + (remember ? TOKEN_DAYS_REMEMBER * 864e5 : TOKEN_HOURS_SESSION * 3600e3);
  const key = sha(token); sessions.set(key, { uid, exp, remember: !!remember, created: Date.now() }); mark("sessions", key);
  return { token, exp };
}
function userOfToken(token) {
  if (!token) return null;
  const key = sha(token), s = sessions.get(key);
  if (!s) return null;
  if (s.exp < Date.now()) { sessions.delete(key); unmark("sessions", key); return null; }
  return users.get(s.uid) || null;
}
// login/register rate limit: per IP and per username (sliding window)
const hits = new Map();
function limited(key, max, windowMs) {
  const now = Date.now(); const arr = (hits.get(key) || []).filter(t => now - t < windowMs);
  arr.push(now); hits.set(key, arr); return arr.length > max;
}
setInterval(() => { const now = Date.now(); for (const [k, a] of hits) if (!a.length || now - a[a.length - 1] > 3600e3) hits.delete(k); }, 600e3).unref();

async function apiRegister(body, ip) {
  if (limited("reg:" + ip, 10, 3600e3)) throw new Err("rate_limited", "Prea multe conturi create de aici. Încearcă mai târziu.");
  const username = String(body.username || "").trim().toLowerCase();
  const password = String(body.password || "");
  if (!USER_RE.test(username)) throw new Err("invalid_argument", "Numele de utilizator: 3–20 caractere, doar litere mici, cifre, punct, minus, _.");
  if (password.length < 6 || password.length > 200) throw new Err("invalid_argument", "Parola trebuie să aibă cel puțin 6 caractere.");
  if (byName.has(username)) throw new Err("taken", "Numele de utilizator e deja folosit.");
  if (users.size >= MAX_USERS) throw new Err("resource_exhausted", "Serverul e plin.");
  const email = clip(body.email, 120);
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Err("invalid_argument", "Adresa de email nu pare corectă.");
  const id = "a_" + crypto.randomBytes(6).toString("hex");
  const u = { id, username, uname: clip(body.username, 20), pass: await bcrypt.hash(password, 10), email, created: Date.now(),
    profile: null, friends: [], inReq: [], outReq: [], stats: newStats() };
  u.profile = sanitizeProfile(Object.assign({ name: clip(body.name, 16) || clip(body.username, 16), co: "", av: crypto.randomInt(10), color: crypto.randomInt(6) }, isObj(body.profile) ? body.profile : {}), null);
  if (!u.profile.co) u.profile.co = (u.profile.name + " Air").slice(0, 22);
  users.set(id, u); byName.set(username, id); mark("users", id);
  const t = issueToken(id, !!body.remember);
  return { token: t.token, exp: t.exp, user: meUser(u) };
}
async function apiLogin(body, ip) {
  const username = String(body.username || "").trim().toLowerCase();
  if (limited("login:" + ip, 30, 600e3) || limited("user:" + username, 10, 900e3)) throw new Err("rate_limited", "Prea multe încercări. Așteaptă câteva minute.");
  const uid = byName.get(username), u = uid && users.get(uid);
  const ok = u ? await bcrypt.compare(String(body.password || ""), u.pass) : (await bcrypt.compare("x", DUMMY_HASH), false);
  if (!ok) throw new Err("auth", "Nume de utilizator sau parolă greșită.");
  hits.delete("user:" + username);
  const t = issueToken(u.id, !!body.remember);
  return { token: t.token, exp: t.exp, user: meUser(u) };
}

/* ---------------- friends / online / invites ---------------- */
const isOnline = uid => !!(online.get(uid) && online.get(uid).size);
function tableOf(uid) { const set = online.get(uid); if (set) for (const c of set) if (c.table) return c.table.code; return null; }
function pushUser(uid, msg) { const set = online.get(uid); if (set) { const s = JSON.stringify(msg); for (const c of set) send(c, s); } }
function pokeFriends(uid) { const u = users.get(uid); if (u) for (const f of u.friends) pushUser(f, { t: "social" }); }
function friendsView(u) {
  const card = id => { const f = users.get(id); if (!f) return null; return Object.assign(publicUser(f), { online: isOnline(id), table: isOnline(id) ? tableOf(id) : null, h2h: pairView(u.id, id) }); };
  const now = Date.now();
  const inv = (invites.get(u.id) || []).filter(i => now - i.at < 2 * 3600e3 && tables.has(i.code));
  invites.set(u.id, inv);
  return {
    friends: u.friends.map(card).filter(Boolean).sort((a, b) => (b.online - a.online) || a.name.localeCompare(b.name)),
    incoming: u.inReq.map(id => users.get(id)).filter(Boolean).map(publicUser),
    outgoing: u.outReq.map(id => users.get(id)).filter(Boolean).map(publicUser),
    invites: inv.map(i => ({ from: publicUser(users.get(i.from)), code: i.code, at: i.at })).filter(i => i.from),
  };
}
const pairKey = (a, b) => a < b ? a + "|" + b : b + "|" + a;
function pairView(me, other) {
  const p = h2h.get(pairKey(me, other));
  if (!p) return { games: 0, wins: 0, losses: 0, draws: 0, best: 0, theirBest: 0, recent: [] };
  const w = p.wins[me] || 0, l = p.wins[other] || 0;
  return { games: p.games, wins: w, losses: l, draws: p.draws || 0, other: Math.max(0, p.games - w - l - (p.draws || 0)),
    best: p.best[me] || 0, theirBest: p.best[other] || 0, recent: p.recent };
}
function addFriend(a, b) {
  const A = users.get(a), B = users.get(b);
  for (const [X, y] of [[A, b], [B, a]]) { if (!X.friends.includes(y)) X.friends.push(y); X.inReq = X.inReq.filter(i => i !== y); X.outReq = X.outReq.filter(i => i !== y); }
  mark("users", a); mark("users", b);
}

/* ---------------- game results -> stats ---------------- */
function maybeRecord(t, path, data) {
  const s = data && data.s; if (!isObj(s) || !isObj(s.__end) || !s.__sid) return;
  const game = path.slice(3), tag = game + ":" + s.__sid;
  if (t.recorded.includes(tag)) return;
  t.recorded.push(tag); if (t.recorded.length > 100) t.recorded.shift();
  const seats = (t.docs.get("seats/" + game) || {}).data || {};
  const seatList = Array.isArray(s.__pl) ? s.__pl : Object.keys(seats).filter(k => /^p[1-6]$/.test(k));
  const vals = {}; if (isObj(s.res) && Array.isArray(s.res.vals)) for (const v of s.res.vals) if (v && v.seat) vals[v.seat] = Math.round(+v.total || 0);
  const winSeat = s.__end.winner;
  const players = [], seen = new Set();
  for (const seat of seatList) {
    const e = seats[seat] || {}; const c = isObj(s.c) && isObj(s.c[seat]) ? s.c[seat] : {};
    const human = !!(e.owner && !e.bot && users.has(e.owner) && !seen.has(e.owner));
    if (human) seen.add(e.owner);
    players.push({ seat, id: human ? e.owner : null, name: clip(c.name || e.name || seat, 16), co: clip(c.co || "", 22), value: vals[seat] !== undefined ? vals[seat] : null, bot: !human, win: seat === winSeat });
  }
  const humans = players.filter(p => p.id);
  if (!humans.length) return;
  const winner = players.find(p => p.win) || null;
  const rec = { at: Date.now(), game, table: t.code, day: isObj(s.res) ? s.res.day || null : null,
    winner: winner ? { id: winner.id, name: winner.name, co: winner.co } : null, draw: winSeat === "draw", players };
  for (const p of humans) {
    const u = users.get(p.id); const st = u.stats || (u.stats = newStats());
    st.games++; if (p.win) st.wins++; if (rec.draw) st.draws++;
    if (p.value != null && p.value > st.best) { st.best = p.value; st.bestCo = p.co; }
    st.recent.unshift(rec); st.recent.length = Math.min(st.recent.length, RECENT_N);
    mark("users", p.id); pushUser(p.id, { t: "stats" });
  }
  for (let i = 0; i < humans.length; i++) for (let j = i + 1; j < humans.length; j++) {
    const a = humans[i], b = humans[j], k = pairKey(a.id, b.id);
    const pr = h2h.get(k) || { a: k.split("|")[0], b: k.split("|")[1], games: 0, wins: {}, draws: 0, best: {}, recent: [] };
    pr.games++;
    if (a.win) pr.wins[a.id] = (pr.wins[a.id] || 0) + 1; else if (b.win) pr.wins[b.id] = (pr.wins[b.id] || 0) + 1; else if (rec.draw) pr.draws++;
    for (const x of [a, b]) if (x.value != null && x.value > (pr.best[x.id] || 0)) pr.best[x.id] = x.value;
    pr.recent.unshift(rec); pr.recent.length = Math.min(pr.recent.length, RECENT_N);
    h2h.set(k, pr); mark("h2h", k);
  }
  console.log(`[stats] ${t.code} ${game}: ${humans.length} human(s), winner ${winner ? winner.name : "-"}`);
}

/* ---------------- tables ---------------- */
class Table {
  constructor(code, saved) {
    this.code = code;
    this.created = (saved && saved.created) || Date.now();
    this.touched = (saved && saved.touched) || Date.now();
    this.owner = (saved && saved.owner) || null;
    this.recorded = (saved && saved.recorded) || [];
    this.docs = new Map(Object.entries((saved && saved.docs) || {}));  // path -> {data, v}
    this.leases = new Map();   // path -> {holder, exp}
    this.conns = new Set();
    this.rooms = new Map();    // room name ("" = lobby) -> Map(peer -> {by, presence, at, conn, gone})
    this.recent = new Map();   // "peer:id" -> response (a write resent after reconnect is applied once)
  }
  toJSON() { return { code: this.code, created: this.created, touched: this.touched, owner: this.owner, recorded: this.recorded, docs: Object.fromEntries(this.docs) }; }
  touch() { this.touched = Date.now(); mark("tables", this.code); }
  snap(path) { const d = this.docs.get(path); return d ? { path, exists: true, data: d.data, v: d.v } : { path, exists: false, v: 0 }; }
  changed(path) {
    const s = this.snap(path), col = parentOf(path);
    const msg = JSON.stringify(Object.assign({ t: "doc" }, s));
    for (const c of this.conns) if (c.subs.has("d:" + path) || c.subs.has("c:" + col)) send(c, msg);
  }
  write(path, data) {
    const prev = this.docs.get(path);
    if (!prev && this.docs.size >= MAX_DOCS_PER_TABLE) throw new Err("quota_exceeded", "too many documents in this table");
    const json = JSON.stringify(data);
    if (Buffer.byteLength(json) > MAX_DOC_BYTES) throw new Err("invalid_argument", "document over 256 KiB");
    if (depth(data) > 32) throw new Err("invalid_argument", "document nested over 32 levels");
    const v = (prev ? prev.v : 0) + 1, body = JSON.parse(json);
    this.docs.set(path, { data: body, v });
    this.touch(); this.changed(path);
    if (path.startsWith("st/")) { try { maybeRecord(this, path, body); } catch (e) { console.error("[stats]", e); } }
    return v;
  }
  room(name) { let r = this.rooms.get(name); if (!r) { r = new Map(); this.rooms.set(name, r); } return r; }
  broadcastPeers(name) {
    const r = this.rooms.get(name); if (!r) return;
    const peers = []; for (const [peer, e] of r) peers.push({ peer, by: e.by, presence: e.presence, at: e.at });
    const msg = JSON.stringify({ t: "peers", room: name, peers });
    const seen = new Set();
    for (const e of r.values()) if (e.conn && !seen.has(e.conn)) { seen.add(e.conn); send(e.conn, msg); }
    if (!r.size) this.rooms.delete(name);
  }
}
function gcTables() {
  const cut = Date.now() - TABLE_TTL_DAYS * 864e5;
  for (const [code, t] of tables) if (!t.conns.size && t.touched < cut) { tables.delete(code); unmark("tables", code); }
  for (const [k, s] of sessions) if (s.exp < Date.now()) { sessions.delete(k); unmark("sessions", k); }
}

/* ---------------- connections ---------------- */
function send(c, msg) { if (c.ws.readyState === 1) c.ws.send(typeof msg === "string" ? msg : JSON.stringify(msg)); }
function attach(c, table) {
  if (c.table === table) return;
  if (table.conns.size >= MAX_CONNS_PER_TABLE) throw new Err("resource_exhausted", "Masa e plină.");
  detach(c, false);
  c.table = table; table.conns.add(c); table.touch();
  for (const [name, r] of table.rooms) { const e = r.get(c.peer); if (e && e.gone && e.by === c.client) { clearTimeout(e.gone); e.gone = null; e.conn = c; c.rooms.add(name); } }
  if (c.client) pokeFriends(c.client);
}
function detach(c, grace) {
  const t = c.table; if (!t) return;
  t.conns.delete(c); c.table = null;
  for (const name of c.rooms) {
    const r = t.rooms.get(name); const e = r && r.get(c.peer);
    if (!e || e.conn !== c) continue;
    e.conn = null;
    const drop = () => { if (r.get(c.peer) === e && !e.conn) { r.delete(c.peer); t.broadcastPeers(name); } };
    if (grace) e.gone = setTimeout(drop, PEER_GRACE_MS); else drop();
  }
  c.rooms.clear(); c.subs.clear();
}
const me = c => users.get(c.client);

const OPS = {
  /* ---- tables ---- */
  create(c) {
    if (tables.size >= MAX_TABLES) throw new Err("resource_exhausted", "Serverul e plin.");
    const code = newCode(), t = new Table(code); t.owner = c.client; tables.set(code, t); t.touch();
    attach(c, t); return { code };
  },
  enter(c, m) {
    const t = tables.get(normCode(m.code));
    if (!t) throw new Err("not_found", "Nu există nicio masă cu acest cod.");
    attach(c, t); return { code: t.code };
  },
  exit(c) { detach(c, false); pokeFriends(c.client); return {}; },
  /* ---- db ---- */
  get(c, m, t) { const e = checkPath(m.path, true); if (e) throw new Err("invalid_argument", e); return t.snap(m.path); },
  list(c, m, t) {
    const e = checkPath(m.path, false); if (e) throw new Err("invalid_argument", e);
    const docs = []; for (const [p, d] of t.docs) if (parentOf(p) === m.path) docs.push({ path: p, exists: true, data: d.data, v: d.v });
    return { docs };
  },
  set(c, m, t) {
    const e = checkPath(m.path, true); if (e) throw new Err("invalid_argument", e);
    if (!isObj(m.data)) throw new Err("invalid_argument", "body must be an object");
    return { v: t.write(m.path, m.data) };
  },
  update(c, m, t) {
    const e = checkPath(m.path, true); if (e) throw new Err("invalid_argument", e);
    if (!isObj(m.data)) throw new Err("invalid_argument", "body must be an object");
    const cur = t.docs.get(m.path); if (!cur) throw new Err("invalid_argument", "update of a missing document");
    return { v: t.write(m.path, deepMerge(cur.data, m.data)) };
  },
  delete(c, m, t) {
    const e = checkPath(m.path, true); if (e) throw new Err("invalid_argument", e);
    if (t.docs.delete(m.path)) { t.touch(); t.changed(m.path); }
    return {};
  },
  acquire(c, m, t) {
    const e = checkPath(m.path, true); if (e) throw new Err("invalid_argument", e);
    const holder = String(m.holder || ""); if (!holder) throw new Err("invalid_argument", "holder required");
    const ttl = Math.max(1000, Math.min(600000, +m.ttlMs || 30000)); // clamped like the Artifact db
    const now = Date.now(), L = t.leases.get(m.path);
    if (L && L.exp > now && L.holder !== holder) return { acquired: false, expiresAt: new Date(L.exp).toISOString() };
    const exp = now + ttl; t.leases.set(m.path, { holder, exp });
    let v = (t.docs.get(m.path) || { v: 0 }).v;
    if (isObj(m.data)) v = t.write(m.path, deepMerge((t.docs.get(m.path) || {}).data, m.data));
    return { acquired: true, version: v, expiresAt: new Date(exp).toISOString(), holder };
  },
  release(c, m, t) { // extension: the Artifact db lets leases lapse; core.js calls release() when it exists
    const L = t.leases.get(m.path); if (L && L.holder === String(m.holder || "")) t.leases.delete(m.path);
    return {};
  },
  sub(c, m, t) {
    const isDoc = m.kind === "doc";
    const e = checkPath(m.path, isDoc); if (e) throw new Err("invalid_argument", e);
    c.subs.add((isDoc ? "d:" : "c:") + m.path);
    return isDoc ? t.snap(m.path) : OPS.list(c, m, t);
  },
  unsub(c, m) { c.subs.delete((m.kind === "doc" ? "d:" : "c:") + m.path); return {}; },
  /* ---- room ---- */
  join(c, m, t) {
    const name = String(m.room || "").slice(0, 120); const r = t.room(name);
    const prev = r.get(c.peer); if (prev && prev.gone) clearTimeout(prev.gone);
    r.set(c.peer, { by: c.client, presence: isObj(m.presence) ? m.presence : (prev ? prev.presence : {}), at: Date.now(), conn: c, gone: null });
    c.rooms.add(name); t.broadcastPeers(name); return {};
  },
  leave(c, m, t) {
    const name = String(m.room || ""); const r = t.rooms.get(name);
    if (r && r.delete(c.peer)) t.broadcastPeers(name);
    c.rooms.delete(name); return {};
  },
  presence(c, m, t) {
    const name = String(m.room || ""); const r = t.rooms.get(name); const e = r && r.get(c.peer);
    if (!e) throw new Err("invalid_argument", "not in room");
    if (!isObj(m.p)) throw new Err("invalid_argument", "presence must be an object");
    if (Buffer.byteLength(JSON.stringify(m.p)) > 4096) throw new Err("invalid_argument", "presence over 4 KiB");
    e.presence = m.p; e.at = Date.now(); t.broadcastPeers(name); return {};
  },
  emit(c, m, t) {
    const name = String(m.room || ""); const r = t.rooms.get(name);
    if (!r || !r.has(c.peer)) throw new Err("invalid_argument", "not in room");
    const msg = JSON.stringify({ t: "msg", room: name, topic: String(m.topic || ""), data: m.data, peer: c.peer, by: c.client });
    const seen = new Set(); for (const e of r.values()) if (e.conn && !seen.has(e.conn)) { seen.add(e.conn); send(e.conn, msg); }
    return {};
  },
  ping() { return { now: Date.now() }; },
  /* ---- account ---- */
  "me.get"(c) { const u = me(c); return { user: meUser(u), stats: u.stats || newStats() }; },
  "profile.set"(c, m) {
    const u = me(c); u.profile = sanitizeProfile(m.profile, u);
    if (isObj(m.profile) && m.profile.email !== undefined) {
      const em = clip(m.profile.email, 120);
      if (em && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) throw new Err("invalid_argument", "Adresa de email nu pare corectă.");
      u.email = em;
    }
    mark("users", u.id); pokeFriends(u.id); return { user: meUser(u) };
  },
  "friends.list"(c) { return friendsView(me(c)); },
  "friends.request"(c, m) {
    const u = me(c); const name = String(m.username || "").trim().toLowerCase();
    const oid = byName.get(name); const o = oid && users.get(oid);
    if (!o) throw new Err("not_found", "Nu există niciun jucător cu acest nume de utilizator.");
    if (o.id === u.id) throw new Err("invalid_argument", "Acela ești tu. 🙂");
    if (u.friends.includes(o.id)) return { status: "friends" };
    if (u.inReq.includes(o.id)) { addFriend(u.id, o.id); pushUser(o.id, { t: "social" }); return { status: "friends" }; } // they had asked already
    if (!u.outReq.includes(o.id)) u.outReq.push(o.id);
    if (!o.inReq.includes(u.id)) o.inReq.push(u.id);
    if (o.inReq.length > 100) o.inReq.shift();
    mark("users", u.id); mark("users", o.id); pushUser(o.id, { t: "social" });
    return { status: "sent" };
  },
  "friends.respond"(c, m) {
    const u = me(c); const o = users.get(String(m.uid || ""));
    if (!o || !u.inReq.includes(o.id)) throw new Err("not_found", "Cererea nu mai există.");
    if (m.accept) addFriend(u.id, o.id);
    else { u.inReq = u.inReq.filter(i => i !== o.id); o.outReq = o.outReq.filter(i => i !== u.id); mark("users", u.id); mark("users", o.id); }
    pushUser(o.id, { t: "social" }); return friendsView(u);
  },
  "friends.remove"(c, m) {
    const u = me(c); const oid = String(m.uid || ""); const o = users.get(oid);
    u.friends = u.friends.filter(i => i !== oid); u.outReq = u.outReq.filter(i => i !== oid); mark("users", u.id);
    if (o) { o.friends = o.friends.filter(i => i !== u.id); o.inReq = o.inReq.filter(i => i !== u.id); mark("users", oid); pushUser(oid, { t: "social" }); }
    return friendsView(u);
  },
  "friends.invite"(c, m) {
    const u = me(c); const oid = String(m.uid || ""); const code = normCode(m.code || (c.table && c.table.code));
    if (!u.friends.includes(oid)) throw new Err("invalid_argument", "Poți invita doar prieteni.");
    if (!tables.has(code)) throw new Err("not_found", "Masa nu există.");
    const list = (invites.get(oid) || []).filter(i => !(i.from === u.id && i.code === code));
    const inv = { from: u.id, code, at: Date.now() }; list.unshift(inv); list.length = Math.min(list.length, 10); invites.set(oid, list);
    pushUser(oid, { t: "invite", from: publicUser(u), code, at: inv.at });
    return { online: isOnline(oid) };
  },
  "invite.dismiss"(c, m) { const u = me(c); invites.set(u.id, (invites.get(u.id) || []).filter(i => !(i.code === normCode(m.code) && (!m.from || i.from === m.from)))); return {}; },
  "stats.get"(c) { return me(c).stats || newStats(); },
  "h2h.get"(c, m) { const u = me(c); const o = users.get(String(m.uid || "")); if (!o) throw new Err("not_found", "Jucător necunoscut."); return Object.assign({ friend: publicUser(o) }, pairView(u.id, o.id)); },
};
const NO_TABLE_OK = new Set(["create", "enter", "exit", "ping", "me.get", "profile.set", "friends.list", "friends.request", "friends.respond", "friends.remove", "friends.invite", "invite.dismiss", "stats.get", "h2h.get"]);
const WRITES = new Set(["set", "update", "delete", "acquire", "release"]);

function onMessage(c, raw) {
  let m; try { m = JSON.parse(raw); } catch (e) { return; }
  const now = Date.now(); c.tokens = Math.min(240, c.tokens + (now - c.tokAt) * 0.12); c.tokAt = now; // 120 msg/s, burst 240
  if (c.tokens < 1) { if (m.t === "req") send(c, { t: "res", id: m.id, ok: false, code: "resource_exhausted", message: "slow down" }); return; }
  c.tokens -= 1;
  if (m.t === "hello") {
    const u = userOfToken(m.token);
    if (!u) { send(c, { t: "welcome", err: "auth", now }); return; }
    if (c.client && c.client !== u.id) return;
    c.client = u.id; c.hello = true;
    c.peer = String(m.peer || crypto.randomBytes(8).toString("hex")).slice(0, 40);
    let set = online.get(u.id); if (!set) online.set(u.id, set = new Set());
    const first = !set.size; set.add(c);
    let table = null, err;
    if (m.table) { const t = tables.get(normCode(m.table)); if (t) { try { attach(c, t); table = t.code; } catch (e) { err = e.code; } } else err = "no_table"; }
    if (first) pokeFriends(u.id);
    send(c, { t: "welcome", user: meUser(u), table, err, now, server: VERSION });
    return;
  }
  if (m.t !== "req" || !c.hello) return;
  const fn = Object.prototype.hasOwnProperty.call(OPS, m.op) ? OPS[m.op] : null;
  if (!fn) return send(c, { t: "res", id: m.id, ok: false, code: "invalid_argument", message: "unknown op" });
  const t = c.table;
  if (!t && !NO_TABLE_OK.has(m.op)) return send(c, { t: "res", id: m.id, ok: false, code: "unavailable", message: "not at a table" });
  const key = WRITES.has(m.op) && t ? c.peer + ":" + m.id : null;
  if (key && t.recent.has(key)) return send(c, t.recent.get(key));
  let res;
  try { res = { t: "res", id: m.id, ok: true, r: fn(c, m, t) }; }
  catch (e) { res = { t: "res", id: m.id, ok: false, code: e.code || "unavailable", message: e.message }; if (!e.code) console.error("[op]", m.op, e); }
  if (key) { t.recent.set(key, res); if (t.recent.size > 600) t.recent.delete(t.recent.keys().next().value); }
  send(c, res);
}

/* ---------------- http ---------------- */
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "content-type, authorization", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Cache-Control": "no-store" };
function json(res, code, obj) { res.writeHead(code, Object.assign({ "Content-Type": "application/json; charset=utf-8" }, CORS)); res.end(JSON.stringify(obj)); }
function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on("data", ch => { size += ch.length; if (size > 16384) { reject(new Err("invalid_argument", "too big")); req.destroy(); } else chunks.push(ch); });
    req.on("end", () => { try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {}); } catch (e) { reject(new Err("invalid_argument", "bad json")); } });
    req.on("error", reject);
  });
}
const ipOf = req => String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "?").split(",")[0].trim();
const bearer = req => { const h = String(req.headers.authorization || ""); return h.startsWith("Bearer ") ? h.slice(7) : ""; };
const server = http.createServer(async (req, res) => {
  const url = req.url.split("?")[0];
  if (req.method === "OPTIONS") { res.writeHead(204, CORS); res.end(); return; }
  try {
    if (url === "/healthz" || url === "/health") {
      let conns = 0; for (const s of online.values()) conns += s.size;
      return json(res, 200, { ok: true, name: "cerul-lumii-server", version: VERSION, uptimeS: Math.round((Date.now() - startedAt) / 1000), users: users.size, tables: tables.size, conns, store: store.kind });
    }
    if (url === "/api/register" && req.method === "POST") return json(res, 200, await apiRegister(await readBody(req), ipOf(req)));
    if (url === "/api/login" && req.method === "POST") return json(res, 200, await apiLogin(await readBody(req), ipOf(req)));
    if (url === "/api/logout" && req.method === "POST") {
      const key = sha(bearer(req)); const s = sessions.get(key);
      if (s) { sessions.delete(key); unmark("sessions", key); for (const c of online.get(s.uid) || []) try { c.ws.close(4001, "logout"); } catch (e) {} }
      return json(res, 200, { ok: true });
    }
    if (url === "/api/me") { const u = userOfToken(bearer(req)); return u ? json(res, 200, { user: meUser(u) }) : json(res, 401, { code: "auth", message: "Sesiunea a expirat." }); }
    if (url === "/") { res.writeHead(200, Object.assign({ "Content-Type": "text/plain; charset=utf-8" }, CORS)); res.end("Cerul Lumii — serverul merge.\n"); return; }
    json(res, 404, { code: "not_found" });
  } catch (e) {
    const code = e.code || "unavailable";
    json(res, { auth: 401, rate_limited: 429, taken: 409, invalid_argument: 400, not_found: 404 }[code] || 500, { code, message: e.message });
    if (!e.code) console.error("[http]", e);
  }
});

/* ---------------- ws ---------------- */
const wss = new WebSocketServer({ server, maxPayload: 1024 * 1024 });
wss.on("connection", ws => {
  const c = { ws, client: null, peer: null, hello: false, table: null, subs: new Set(), rooms: new Set(), tokens: 240, tokAt: Date.now() };
  ws.__dead = false;
  ws.on("message", data => { ws.__dead = false; onMessage(c, data.toString()); });
  ws.on("pong", () => { ws.__dead = false; });
  ws.on("close", () => {
    detach(c, true);
    if (c.client) { const set = online.get(c.client); if (set) { set.delete(c); if (!set.size) { online.delete(c.client); pokeFriends(c.client); } else pokeFriends(c.client); } }
  });
  ws.on("error", () => {});
});
// drop dead sockets (laptop lid closed, Wi-Fi gone) so presence and "online" clear
const hb = setInterval(() => { for (const ws of wss.clients) { if (ws.__dead) { ws.terminate(); continue; } ws.__dead = true; try { ws.ping(); } catch (e) {} } }, 20000);
const flushT = setInterval(flush, FLUSH_MS);
const gcT = setInterval(gcTables, 6 * 3600e3);

async function shutdown(sig) {
  console.log(`[${sig}] saving…`);
  clearInterval(hb); clearInterval(flushT); clearInterval(gcT);
  await flush(); await store.close();
  process.exit(0);
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

loadAll().then(() => server.listen(PORT, () => console.log(`Cerul Lumii server ${VERSION} on :${PORT}`)))
  .catch(e => { console.error("startup failed:", e); process.exit(1); });
