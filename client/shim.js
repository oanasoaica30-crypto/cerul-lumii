/* Cerul Lumii desktop — runtime shim.
 *
 * Gives the UNCHANGED game code (core.js + games/cerul*.js) the same `window.claude.use("db" | "room")`
 * API it gets inside a claude.ai Artifact (see API_SURFACE.md), but backed by our own WebSocket server:
 *   - db:   doc/collection refs, get/set/update/delete, onSnapshot (doc + collection, with latency
 *           compensation for own writes), where/orderBy/limit (client side), acquire/release leases.
 *   - room: lobby presence/onPeers/peers/emit/on/connected/onConnection + join(name) named rooms.
 * Transport: one WebSocket, auto-reconnect with backoff, requests queued while offline and RESENT after
 * reconnect (the server applies a resent write once), subscriptions/rooms/presence re-asserted on reconnect.
 * Offline behaviour matches core.js "STABILITY" logic (ctx.net): while disconnected, write promises stay
 * pending -> core sees a write "in flight" > 8 s and marks the connection "off"; when the socket is back the
 * queued writes are acknowledged and core goes back to "ok".
 *
 * Also exposes window.CerulNet for the desktop UI (accounts, friends, tables).
 */
(function () {
"use strict";
const W = window;
const rid = n => { let s = ""; const a = "abcdefghijklmnopqrstuvwxyz0123456789"; const r = crypto.getRandomValues(new Uint8Array(n)); for (let i = 0; i < n; i++) s += a[r[i] % 36]; return s; };
const clone = o => o === undefined ? undefined : JSON.parse(JSON.stringify(o));
const isObj = o => o !== null && typeof o === "object" && !Array.isArray(o);
function deepFreeze(o) { if (o && typeof o === "object" && !Object.isFrozen(o)) { Object.freeze(o); for (const k in o) deepFreeze(o[k]); } return o; }
function deepMerge(base, patch) { const out = isObj(base) ? Object.assign({}, base) : {}; for (const k of Object.keys(patch)) { const v = patch[k]; out[k] = isObj(v) && isObj(out[k]) ? deepMerge(out[k], v) : clone(v); } return out; }
const parentOf = p => p.slice(0, p.lastIndexOf("/"));
const SEG = /^[A-Za-z0-9_\-.~:@+]{1,200}$/;
function checkPath(p, wantDoc) {
  if (typeof p !== "string" || !p) throw new TypeError("path must be a non-empty string");
  const segs = p.split("/");
  if (segs.length > 16) throw new TypeError("path has more than 16 segments");
  for (const s of segs) if (!SEG.test(s) || s === "." || s === "..") throw new TypeError("bad path segment '" + s + "'");
  if (wantDoc && segs.length % 2) throw new TypeError("document path needs an even number of segments (got " + segs.length + ")");
  if (!wantDoc && !(segs.length % 2)) throw new TypeError("collection path needs an odd number of segments (got " + segs.length + ")");
  return p;
}
const dbErr = (code, message) => Object.assign(new Error(message || code), { code, message: message || code });
const later = fn => setTimeout(fn, 0);

/* ======================= transport ======================= */
const Net = {
  url: "", token: "", peer: "k" + rid(16), uid: null, user: null,
  ws: null, welcomed: false, table: null, status: "idle", backoff: 500, n: 0,
  pending: new Map(),      // id -> {msg, resolve, reject, tableScoped}
  listeners: {},           // event -> Set(fn)
  lastMsgAt: 0, wakeT: 0, everWelcomed: false,
  on(ev, fn) { (this.listeners[ev] || (this.listeners[ev] = new Set())).add(fn); return () => this.listeners[ev].delete(fn); },
  emit(ev, a) { (this.listeners[ev] || []).forEach(f => { try { f(a); } catch (e) { console.error(e); } }); },
  setStatus(s) { if (s !== this.status) { this.status = s; this.emit("status", s); } },
  httpBase() { return this.url.replace(/^ws/, "http").replace(/\/+$/, ""); },
  configure(o) { Object.assign(this, o); },
  connect() {
    if (this.ws && this.ws.readyState <= 1) return;
    if (!this.url || !this.token) return;
    this.setStatus(this.everWelcomed ? "reconnecting" : "connecting");
    clearTimeout(this.wakeT);
    // Render free tier sleeps: if we are not in after 2.5 s, say "Se trezește serverul…" and poke /healthz
    this.wakeT = setTimeout(() => { if (!this.welcomed) { this.setStatus("waking"); fetch(this.httpBase() + "/healthz", { cache: "no-store" }).catch(() => {}); } }, 2500);
    let ws;
    try { ws = new WebSocket(this.url); } catch (e) { this.scheduleReconnect(); return; }
    this.ws = ws;
    ws.onopen = () => { ws.send(JSON.stringify({ t: "hello", proto: 2, token: this.token, peer: this.peer, table: this.table })); };
    ws.onmessage = ev => { this.lastMsgAt = Date.now(); let m; try { m = JSON.parse(ev.data); } catch (e) { return; } this.onMsg(m); };
    ws.onclose = ev => {
      if (this.ws !== ws) return;
      this.ws = null; const was = this.welcomed; this.welcomed = false;
      if (was) { this.emit("connection", false); }
      if (ev.code === 4001) { this.setStatus("auth"); this.emit("auth"); return; } // logged out elsewhere
      if (this.status !== "auth") { this.setStatus(navigator.onLine === false ? "offline" : (this.status === "waking" ? "waking" : "reconnecting")); this.scheduleReconnect(); }
    };
    ws.onerror = () => {};
  },
  scheduleReconnect() {
    clearTimeout(this.rcT);
    this.rcT = setTimeout(() => this.connect(), this.backoff);
    this.backoff = Math.min(5000, this.backoff * 1.6);
  },
  kick() { // force a fresh socket (network came back, or the socket went silent)
    if (this.ws) { try { this.ws.close(); } catch (e) {} } else { clearTimeout(this.rcT); this.backoff = 500; this.connect(); }
  },
  onMsg(m) {
    if (m.t === "welcome") {
      clearTimeout(this.wakeT);
      if (m.err === "auth") { this.setStatus("auth"); this.emit("auth"); try { this.ws.close(); } catch (e) {} return; }
      this.welcomed = true; this.everWelcomed = true; this.backoff = 500;
      this.user = m.user; this.uid = m.user.id;
      if (this.table && m.table !== this.table) { this.emit("tableLost", { code: this.table, err: m.err }); }
      this.setStatus("online");
      // order: queued requests (writes first, in order), then re-assert subscriptions and rooms
      [...this.pending.entries()].sort((a, b) => a[0] - b[0]).forEach(([id, p]) => {
        if (p.sent && p.noResend) { this.pending.delete(id); p.reject(dbErr("unavailable", "Conexiunea s-a întrerupt. Încearcă din nou.")); return; }
        p.sent = true; this.ws.send(JSON.stringify(p.msg)); });
      this.emit("welcome", m);
      if (m.table) this.emit("connection", true);
      return;
    }
    if (m.t === "res") {
      const p = this.pending.get(m.id); if (!p) return;
      this.pending.delete(m.id);
      if (m.ok) p.resolve(m.r); else p.reject(dbErr(m.code, m.message));
      return;
    }
    this.emit(m.t, m);
  },
  /* send a request; queued while offline, resent after reconnect, never times out (like a pending db write) */
  request(op, args, opts) {
    const id = ++this.n, msg = Object.assign({ t: "req", id, op }, args || {});
    return new Promise((resolve, reject) => {
      const p = { msg, resolve, reject, noResend: !!(opts && opts.noResend), sent: false };
      this.pending.set(id, p);
      if (this.welcomed && this.ws && this.ws.readyState === 1) { p.sent = true; this.ws.send(JSON.stringify(msg)); }
    });
  },
  /* account HTTP api */
  async api(path, body) {
    const r = await fetch(this.httpBase() + path, { method: body ? "POST" : "GET", headers: Object.assign({ "content-type": "application/json" }, this.token ? { authorization: "Bearer " + this.token } : {}), body: body ? JSON.stringify(body) : undefined });
    let j = {}; try { j = await r.json(); } catch (e) {}
    if (!r.ok) throw dbErr(j.code || ("http_" + r.status), j.message || ("Eroare " + r.status));
    return j;
  },
  async createTable() { const r = await this.request("create", null, { noResend: true }); this.table = r.code; this.emit("connection", true); return r.code; },
  async enterTable(code) { const r = await this.request("enter", { code }); this.table = r.code; this.emit("connection", true); return r.code; },
  connected() { return this.welcomed && !!this.table; },
};
// a socket that stays silent for 45 s is dead (sleeping laptop, NAT drop): reconnect. Ping every 20 s.
setInterval(() => {
  if (!Net.welcomed) return;
  if (Date.now() - Net.lastMsgAt > 45000) { Net.kick(); return; }
  Net.request("ping").catch(() => {});
}, 20000);
W.addEventListener("online", () => { if (!Net.welcomed) Net.kick(); });
W.addEventListener("offline", () => { Net.setStatus("offline"); });

/* ======================= db ======================= */
const cache = new Map();     // doc path -> {exists, data, v}       (server-confirmed)
const overlay = new Map();   // doc path -> {exists, data}           (own writes not yet acknowledged)
const pendN = new Map();     // doc path -> number of own writes in flight
const docSubs = new Map();   // doc path -> {ls:Set, known, last}
const colSubs = new Map();   // collection path -> {ls:Set, known}
const subscribedDoc = p => docSubs.has(p) || colSubs.has(parentOf(p));
const effective = p => overlay.has(p) ? overlay.get(p) : (cache.get(p) || { exists: false, data: undefined, v: 0 });

function makeDocSnap(path, e, pending) {
  const data = e.exists ? deepFreeze(clone(e.data)) : undefined;
  return Object.freeze({ id: path.slice(path.lastIndexOf("/") + 1), exists: !!e.exists, data: () => data, metadata: Object.freeze({ fromCache: false, hasPendingWrites: !!pending }), _json: e.exists ? JSON.stringify(e.data) : "\u0000" });
}
function colDocs(col) {
  const paths = new Set();
  for (const p of cache.keys()) if (parentOf(p) === col) paths.add(p);
  for (const p of overlay.keys()) if (parentOf(p) === col) paths.add(p);
  return [...paths].sort((a, b) => a.slice(a.lastIndexOf("/") + 1) < b.slice(b.lastIndexOf("/") + 1) ? -1 : 1)
    .map(p => ({ p, e: effective(p) })).filter(x => x.e.exists);
}
let flushQ = null; const dirtyPaths = new Set();
function notify(path) {
  dirtyPaths.add(path);
  if (!flushQ) flushQ = later(() => { flushQ = null; const ps = [...dirtyPaths]; dirtyPaths.clear(); const cols = new Set();
    for (const p of ps) { deliverDoc(p); cols.add(parentOf(p)); }
    for (const c of cols) deliverCol(c); });
}
function deliverDoc(path) {
  const s = docSubs.get(path); if (!s || !s.known) return;
  const snap = makeDocSnap(path, effective(path), (pendN.get(path) || 0) > 0);
  if (s.last && s.last._json === snap._json) return;
  s.last = snap;
  s.ls.forEach(l => { try { l.next(snap); } catch (e) { console.error(e); } });
}
function deliverCol(col) {
  const s = colSubs.get(col); if (!s || !s.known) return;
  const pending = colDocs(col).some(x => (pendN.get(x.p) || 0) > 0);
  const all = colDocs(col).map(x => makeDocSnap(x.p, x.e, (pendN.get(x.p) || 0) > 0));
  s.ls.forEach(l => {
    const docs = applyQuery(all, l.q);
    const key = docs.map(d => d.id + "=" + d._json).join("\n");
    if (l.lastKey === key) return;
    const prev = l.prevDocs || [];
    l.lastKey = key; l.prevDocs = docs;
    const snap = querySnap(docs, prev, pending);
    try { l.next(snap); } catch (e) { console.error(e); }
  });
}
function querySnap(docs, prev, pending) {
  const changes = [];
  const pi = new Map(prev.map((d, i) => [d.id, i])), ni = new Map(docs.map((d, i) => [d.id, i]));
  prev.forEach((d, i) => { if (!ni.has(d.id)) changes.push({ type: "removed", doc: d, oldIndex: i, newIndex: -1 }); });
  docs.forEach((d, i) => { if (!pi.has(d.id)) changes.push({ type: "added", doc: d, oldIndex: -1, newIndex: i }); else if (prev[pi.get(d.id)]._json !== d._json) changes.push({ type: "modified", doc: d, oldIndex: pi.get(d.id), newIndex: i }); });
  return Object.freeze({ docs, size: docs.length, empty: !docs.length, docChanges: () => changes, metadata: Object.freeze({ fromCache: false, hasPendingWrites: !!pending }) });
}
function applyQuery(docs, q) {
  if (!q) return docs;
  let out = docs.filter(d => q.where.every(([f, op, v]) => { const x = d.data()[f];
    switch (op) { case "==": return x === v; case "!=": return x !== v; case "<": return x < v; case "<=": return x <= v; case ">": return x > v; case ">=": return x >= v;
      case "in": return Array.isArray(v) && v.includes(x); case "not-in": return Array.isArray(v) && !v.includes(x); case "array-contains": return Array.isArray(x) && x.includes(v); default: return false; } }));
  if (q.order) { const [f, dir] = q.order; out = out.slice().sort((a, b) => { const x = a.data()[f], y = b.data()[f]; if (x === undefined) return 1; if (y === undefined) return -1; return (x < y ? -1 : x > y ? 1 : 0) * (dir === "desc" ? -1 : 1); }); }
  if (q.limit) out = out.slice(0, q.limit);
  return out;
}
Net.on("doc", m => { cache.set(m.path, { exists: m.exists, data: m.data, v: m.v }); if (!(pendN.get(m.path) > 0)) notify(m.path); });
function applySubResult(kind, path, r) {
  if (kind === "doc") cache.set(path, { exists: r.exists, data: r.data, v: r.v });
  else { for (const p of [...cache.keys()]) if (parentOf(p) === path && !r.docs.some(d => d.path === p)) cache.delete(p); r.docs.forEach(d => cache.set(d.path, { exists: true, data: d.data, v: d.v })); }
}
function serverSub(kind, path) {
  const s = kind === "doc" ? docSubs.get(path) : colSubs.get(path);
  Net.request("sub", { kind, path }).then(r => {
    applySubResult(kind, path, r); s.known = true;
    if (kind === "doc") deliverDoc(path); else deliverCol(path);
  }, e => { s.ls.forEach(l => { if (l.err) try { l.err(e); } catch (x) {} }); });
}
// after a reconnect, re-subscribe everything (the server forgot our subscriptions)
Net.on("welcome", m => { if (!m.table) return; for (const p of docSubs.keys()) serverSub("doc", p); for (const p of colSubs.keys()) serverSub("col", p); });

async function writeOp(op, path, data, optimistic) {
  const known = subscribedDoc(path);
  if (known && optimistic) {
    pendN.set(path, (pendN.get(path) || 0) + 1);
    overlay.set(path, optimistic(effective(path)));
    notify(path);
  }
  try { await Net.request(op, { path, data }); }
  finally {
    if (known && optimistic) {
      const n = (pendN.get(path) || 1) - 1;
      if (n <= 0) { pendN.delete(path); overlay.delete(path); } else pendN.set(path, n);
      notify(path);
    }
  }
}
function docRef(path) {
  checkPath(path, true);
  const ref = {
    id: path.slice(path.lastIndexOf("/") + 1), path,
    async get() { const r = await Net.request("get", { path }); return makeDocSnap(path, r, false); },
    set(data) {
      if (!isObj(data)) return Promise.reject(dbErr("invalid_argument", "body must be an object"));
      return writeOp("set", path, clone(data), () => ({ exists: true, data: clone(data) }));
    },
    update(data) {
      if (!isObj(data)) return Promise.reject(dbErr("invalid_argument", "body must be an object"));
      return writeOp("update", path, clone(data), e => e.exists ? { exists: true, data: deepMerge(e.data, data) } : e);
    },
    delete() { return writeOp("delete", path, undefined, () => ({ exists: false })); },
    acquire(o) { o = o || {}; return Net.request("acquire", { path, holder: String(o.holder || ""), ttlMs: o.ttlMs, data: o.data }); },
    release(o) { o = o || {}; return Net.request("release", { path, holder: String(o.holder || "") }).then(() => {}); },
    onSnapshot(next, err) {
      if (typeof next !== "function") throw new TypeError("onSnapshot needs a function");
      let s = docSubs.get(path);
      const l = { next, err };
      if (!s) { s = { ls: new Set(), known: false, last: null }; docSubs.set(path, s); s.ls.add(l); serverSub("doc", path); }
      else { s.ls.add(l); if (s.known) later(() => { if (s.ls.has(l)) { const snap = makeDocSnap(path, effective(path), (pendN.get(path) || 0) > 0); s.last = snap; next(snap); } }); }
      return () => { if (!s.ls.delete(l)) return; if (!s.ls.size) { docSubs.delete(path); Net.request("unsub", { kind: "doc", path }).catch(() => {}); } };
    },
    collection(sub) { return colRef(path + "/" + sub); },
  };
  return Object.freeze(ref);
}
function query(path, q) {
  const Q = {
    where(f, op, v) { if (q.where.length >= 10) throw new TypeError("at most 10 filters"); return query(path, Object.assign({}, q, { where: q.where.concat([[f, op, v]]) })); },
    orderBy(f, dir) { return query(path, Object.assign({}, q, { order: [f, dir || "asc"] })); },
    limit(n) { return query(path, Object.assign({}, q, { limit: Math.max(1, Math.min(1000, n | 0)) })); },
    async get() { const r = await Net.request("list", { path }); const docs = applyQuery(r.docs.map(d => makeDocSnap(d.path, d, false)), q); return querySnap(docs, [], false); },
    onSnapshot(next, err) {
      if (typeof next !== "function") throw new TypeError("onSnapshot needs a function");
      let s = colSubs.get(path);
      const l = { next, err, q };
      if (!s) { s = { ls: new Set(), known: false }; colSubs.set(path, s); s.ls.add(l); serverSub("col", path); }
      else { s.ls.add(l); if (s.known) later(() => deliverCol(path)); }
      return () => { if (!s.ls.delete(l)) return; if (!s.ls.size) { colSubs.delete(path); Net.request("unsub", { kind: "col", path }).catch(() => {}); } };
    },
  };
  return Q;
}
function colRef(path) {
  checkPath(path, false);
  const base = query(path, { where: [], order: null, limit: 0 });
  return Object.freeze(Object.assign({}, base, {
    path,
    doc(id) { return docRef(path + "/" + (id || rid(20))); },
    async add(data) { const r = docRef(path + "/" + rid(20)); await r.set(data); return r; },
  }));
}
const DB = Object.freeze({ doc: docRef, collection: colRef });

/* ======================= room ======================= */
const rooms = new Map(); // name -> room state
function roomState(name) {
  let r = rooms.get(name);
  if (!r) { r = { name, joined: false, me: {}, peers: Object.freeze([]), raw: [], peersL: new Set(), connL: new Set(), topicL: new Map(), sendT: 0, delivered: null, frameT: 0, alive: true }; rooms.set(name, r); }
  return r;
}
function buildPeers(r) {
  const prev = new Map(r.peers.map(p => [p.peer, p]));
  const list = r.raw.map(x => {
    const mine = x.peer === Net.peer;
    const pres = mine ? r.me : (x.presence || {});
    const old = prev.get(x.peer), pj = JSON.stringify(pres);
    if (old && old._pj === pj) return old;
    return Object.freeze({ peer: x.peer, by: x.by || null, isMe: x.by === Net.uid, sameTab: mine, kind: "viewer", guest: false,
      presence: deepFreeze(clone(pres)), updatedAt: Date.now(), _pj: pj });
  });
  if (r.joined && !list.some(p => p.sameTab)) list.push(Object.freeze({ peer: Net.peer, by: Net.uid, isMe: true, sameTab: true, kind: "viewer", guest: false, presence: deepFreeze(clone(r.me)), updatedAt: Date.now(), _pj: JSON.stringify(r.me) }));
  r.peers = Object.freeze(list);
  scheduleDeliver(r);
}
function scheduleDeliver(r) {
  if (r.frameT) return;
  r.frameT = setTimeout(() => {
    r.frameT = 0; if (!r.alive) return;
    const now = r.peers, before = r.delivered || [];
    const bm = new Map(before.map(p => [p.peer, p])), nm = new Map(now.map(p => [p.peer, p]));
    const change = { peers: now, joined: now.filter(p => !bm.has(p.peer)), left: before.filter(p => !nm.has(p.peer)), updated: now.filter(p => bm.has(p.peer) && bm.get(p.peer) !== p) };
    r.delivered = now;
    if (!change.joined.length && !change.left.length && !change.updated.length) return;
    r.peersL.forEach(l => { try { l.fn(change); } catch (e) { console.error(e); } });
  }, 16);
}
Net.on("peers", m => { const r = rooms.get(m.room); if (!r) return; r.raw = m.peers || []; buildPeers(r); });
Net.on("msg", m => { const r = rooms.get(m.room); if (!r) return; const set = r.topicL.get(m.topic); if (!set) return;
  const msg = Object.freeze({ topic: m.topic, data: m.data, peer: m.peer, by: m.by || null, isMe: m.by === Net.uid, sameTab: m.peer === Net.peer, kind: "viewer", guest: false });
  set.forEach(fn => { try { fn(msg); } catch (e) { console.error(e); } }); });
Net.on("welcome", m => { if (!m.table) return; for (const r of rooms.values()) if (r.joined) Net.request("join", { room: r.name, presence: r.me }).catch(() => {}); });
Net.on("connection", on => { for (const r of rooms.values()) r.connL.forEach(fn => { try { fn(on && r.joined); } catch (e) {} }); });

function roomApi(r, named) {
  const TOPIC = /^[a-z][a-z0-9_.-]{0,47}$/;
  const api = {
    emit(topic, data) {
      if (!TOPIC.test(String(topic))) return Promise.reject(dbErr("invalid_argument", "bad topic"));
      if (!Net.connected()) return Promise.resolve(); // dropped while disconnected, like the platform
      return Net.request("emit", { room: r.name, topic, data }).then(() => {});
    },
    on(topic, handler) {
      if (typeof handler !== "function") throw new TypeError("handler must be a function");
      let set = r.topicL.get(topic); if (!set) r.topicL.set(topic, set = new Set());
      set.add(handler); return () => set.delete(handler);
    },
    presence(patch) {
      if (!isObj(patch)) return Promise.reject(dbErr("invalid_argument", "patch must be an object"));
      const next = Object.assign({}, r.me);
      for (const k of Object.keys(patch)) { if (patch[k] === null) delete next[k]; else next[k] = clone(patch[k]); }
      if (new TextEncoder().encode(JSON.stringify(next)).length > 4096) return Promise.reject(dbErr("invalid_argument", "presence over 4 KiB"));
      r.me = next; buildPeers(r); // applied locally at once
      if (!r.sendT) r.sendT = setTimeout(() => { r.sendT = 0; if (r.joined && Net.welcomed) Net.request("presence", { room: r.name, p: r.me }).catch(() => {}); }, 33);
      return Promise.resolve();
    },
    peers() { return r.peers; },
    onPeers(fn) {
      if (typeof fn !== "function") throw new TypeError("handler must be a function");
      const l = { fn }; r.peersL.add(l);
      // first delivery: the room so far, all as "joined"
      Promise.resolve().then(() => { if (r.peersL.has(l) && r.peers.length) { try { fn({ peers: r.peers, joined: r.peers, left: [], updated: [] }); } catch (e) { console.error(e); } } });
      return () => r.peersL.delete(l);
    },
    connected() { return Net.connected() && r.joined; },
    onConnection(fn) { r.connL.add(fn); Promise.resolve().then(() => { if (r.connL.has(fn)) fn(api.connected()); }); return () => r.connL.delete(fn); },
  };
  if (named) {
    api.name = r.name;
    api.leave = () => { r.alive = false; r.joined = false; rooms.delete(r.name); return Net.request("leave", { room: r.name }).then(() => {}, () => {}); };
  } else {
    api.join = async name => {
      name = String(name);
      if (!/^[A-Za-z0-9_.:-]{1,120}$/.test(name)) throw dbErr("invalid_argument", "bad room name");
      const ex = rooms.get(name); if (ex && ex.joined && ex.api) return ex.api;
      const nr = roomState(name); nr.alive = true;
      await Net.request("join", { room: name, presence: nr.me });
      nr.joined = true; nr.api = Object.freeze(roomApi(nr, true)); buildPeers(nr);
      return nr.api;
    };
  }
  return api;
}
let lobbyApi = null;
function lobby() {
  if (lobbyApi) return lobbyApi;
  const r = roomState(""); r.joined = true;
  Net.request("join", { room: "", presence: r.me }).catch(() => {});
  lobbyApi = Object.freeze(roomApi(r, false)); return lobbyApi;
}

/* ======================= window.claude ======================= */
let readyResolve; const tableReady = new Promise(r => { readyResolve = r; });
Net.tableReady = () => readyResolve();
const memo = {};
W.claude = Object.freeze({
  use(name) {
    if (memo[name]) return memo[name];
    if (name === "db") return (memo[name] = tableReady.then(() => DB));
    if (name === "room") return (memo[name] = tableReady.then(() => lobby()));
    return Promise.resolve(null);
  },
});
W.CerulNet = Net;
W.CerulNet._debug = { cache, overlay, rooms, docSubs, colSubs };
})();
