# API surface: what the game uses from the Artifact runtime, and how the desktop app provides it

The desktop app ships only **Cerul Lumii**: `core.js` plus `games/cerul*.js`, both copied unchanged from
`/home/claude/salon` by `scripts/sync-game.mjs`. Inside claude.ai those files talk to the Artifact runtime
through `window.claude.use("db")` and `window.claude.use("room")`. In the desktop app, `client/shim.js` provides
the same two namespaces over one WebSocket to `server/server.js`. Neither `core.js` nor any `cerul*.js` file is
modified.

Reference for the real runtime: contract 0.2.78 type definitions (`db.d.ts` and `room.d.ts` in the
artifact-capabilities skill).

---

## 1. How core.js reaches the runtime

* At boot (`S.boot`, core.js ~l.1450), core awaits `window.claude.use("db")` and then
  `window.claude.use("room")`. Either one may resolve `null`, and the game then runs without that capability.
  No other capability is used: not `user`, `artifact`, `assets` or anything else.
* **Identity** is `ME = window.__SALON_ME || localStorage["salon-id"]`. The id is per device: a random
  `"u" + 8 chars`, and in test mode it also gets a per-tab suffix. The display name is
  `window.__SALON_NICK || localStorage["salon-nick"]`. The comment in core says it explicitly: *"we do NOT
  use the Claude account as identity"*.
  - **Desktop build:** before core.js loads, `client/app.js` sets `__SALON_ME` to the account id
    (`a_xxxxxxxxxxxx`) and `__SALON_NICK` to the profile name. Identity is therefore the account, not the
    device: two people on one PC each log in with their own account.
* The Cerul files never call `window.claude` themselves. They only use `Salon.register`, the `ctx` API that
  core gives them, and `localStorage` for per-device settings and cache.

## 2. `db` — what core.js uses

### Document paths (all have 2 segments: `<collection>/<doc>`)

| path | written by | content |
|---|---|---|
| `seats/<gameId>` | `claimSeat`, `editSeats`, `maybeAutoSeat`, `syncSeatName`, `migrateLocalSeat`, reset | `{p1..p6: {owner, name, at, bot?, was?, quit?, g?} \| null, __rs?, __rsBy?}`. `owner` is a player id or `bot:<id>…`. |
| `st/<gameId>` | `commitAs` (each move), start/rematch, reset | `{s: state}`. The state carries `__sid` (game id), `__rev`, `__by`, `__t`, `__pl` (seats in the game), and `__end: {winner, at}` at the end. Cerul states are ~10–30 KB. |
| `pt/<gameId>_<seat>` | `setPartAs` (simultaneous / private moves) | `{d: any}` |
| `rs/<gameId>` | „Resetează masa” | `{n, by, kill, at}` |
| `nicks/<id>` | `saveNickDb` (skipped when `__SALON_NICK` is set, as it is on desktop) | `{n, at}` |
| `scores/all`, `scores/day-YYYY-MM-DD` | `recordWin` | `{g: {[gameId]: {[name]: n}}, total: {[name]: n}}` |

### Calls (counted in the current core.js)

* `db.doc(p).get()` returns `{exists, data()}`. Also used as `ref.get()` inside seat edits.
* `db.doc(p).set(obj)` (≈29 calls) is a **full replace** and creates the document if it is missing.
* `db.doc(p).update(obj)` (5 calls) needs the document to exist and **deep-merges nested objects**. Core relies
  on the deep merge. `syncSeatName` does `update({[seat]: {name}})` and must keep `owner`, and `recordWin` does
  `update({g: {[id]: {[key]: n}}})`.
* `db.doc(p).delete()` is used for old daily score documents.
* `db.doc(p).onSnapshot(next, err)` subscribes to `seats/<id>`, `rs/<id>`, `st/<id>` and every
  `pt/<id>_<seat>` while a game is open. Core reads `snap.exists` and `snap.data()`.
* `db.collection("seats").onSnapshot(...)` and `db.collection("scores").onSnapshot(...)` run in the lobby. Core
  reads `snap.docs[].id` and `.data()`, and uses no queries.
* **Leases:** `ref.acquire({holder: ME, ttlMs: 2500})` returns `{acquired}` and is retried with backoff. Core
  uses it to serialize seat edits: acquire, then `get`, `set`, and free. To free the lease, core calls
  `ref.release({holder})` **if it exists**. Otherwise it calls `acquire({holder, ttlMs: 1})`, which the real
  runtime clamps to 1000 ms.
* **Semantics core expects:** last writer wins, with no transactions. Your own writes reach your own
  subscriptions at once. Each write is awaited before the next one to the same path, through core's per-path
  `write()` queue. Core also guards against stale states itself: it compares `__sid`/`__rev`/`__t` and
  rewrites a late, older state.
* **Errors:** core shows a toast for `invalid_argument` (no write permission). Everything else is logged and
  shown as „Nu s-a putut salva”.

### STABILITY (`ctx.net`, `netState()`)

`netTrack` wraps only the `st/` and `pt/` writes. The connection counts as **"off"** when
`navigator.onLine === false`, when a tracked write has been pending for more than 8 s, or when the last
failure is newer than the last success. It counts as **"slow"** when the average latency is over 1.5 s or a
write has been pending for more than 3 s. After a failure, `connTick` probes with `db.doc("seats/<id>").get()`.
Other players' connections come from lobby presence (`net`, `hid`).

**Shim behaviour that matches this:** while the socket is down, write promises stay pending. They are never
rejected, so core sees an old write in flight and marks the connection "off". After the reconnect they are
resent and acknowledged, so `okAt` updates and core goes back to "ok". `test/reconnect.cjs` checks this.

## 3. `room` — what core.js uses

* **Lobby room:** `room.presence({name, game, id: ME, net, hid})` is called on every navigation, net-state
  change and visibility change. `room.onPeers(ch => ch.peers)` is used, and each peer is read through
  `p.sameTab` and `p.presence.{id, game, name, net, hid}`. This gives "Online acum", the "is player X here"
  grace period (`connOf`, `humanHere`), and the bot-takeover grace.
* **Named room (real-time games only):** `room.join("g-" + gameId)` returns `nr`. Core then uses
  `nr.presence({seat, name})`, `nr.presence({st|in: obj, seat})` (the real-time channel, about 30/s),
  `nr.onPeers`, `nr.peers()` and `nr.leave()`. Cerul is `mode: "turn"`, so it does not open a named room, but
  the shim supports one.
* Core does not use `emit`, `on`, `connected`, `onConnection`, `onFollow` or `sendToClaudeSession`. The shim
  implements `emit`, `on`, `connected` and `onConnection` anyway, and leaves out the follow and Claude-session
  APIs.

## 4. How the desktop app implements it

### Shim (`client/shim.js` → `window.claude`, `window.CerulNet`)

* `window.claude.use("db" | "room")` resolves **after the player has chosen a table**, and any other name
  resolves `null`. Core is only booted after that point anyway.
* **db:**
  - `doc` and `collection` refs check paths with the same grammar, segment parity and limits as the real
    runtime, and throw `TypeError` on a bad path.
  - `get`, `set`, `update` (deep merge, document must exist), `delete`, `acquire` and `release` are provided.
  - `onSnapshot` works on documents and collections, with `docChanges()`. One subscription is shared per
    path.
  - `where`, `orderBy` and `limit` are evaluated on the client.
  - **Latency compensation:** your own write is shown at once with `hasPendingWrites: true`. While a write to
    that path is unacknowledged, server echoes for the path are held back. When the last acknowledgement
    arrives, the authoritative server version is applied.
  - Snapshots are deep-frozen.
* **room:**
  - Lobby: `presence(patch)` (null removes a field; the merged object is sent whole, coalesced to ~30/s, with a
    4 KiB limit) and `peers()`, which returns the same frozen array until something changes.
  - `onPeers` delivers `{peers, joined, left, updated}` at most once per frame. The first delivery lists the
    whole room as `joined`.
  - `emit`, `on`, `connected` and `onConnection` are provided, and `join(name)` returns a named room with
    `leave()`.
  - Each peer has `peer` (one open window), `by` (the account id), `isMe`, `sameTab`, `kind: "viewer"` and
    `guest: false`.
* **Transport:**
  - Auto-reconnect backoff runs from 0.5 s to 5 s.
  - Requests are queued while offline and resent in order after `welcome`, with the same request ids, which
    the server de-duplicates. „Creează masă” is the exception: it is never resent.
  - After a reconnect, subscriptions and room joins plus presence are re-asserted.
  - The app pings every 20 s and forces a reconnect after 45 s of silence.
  - If no `welcome` arrives within 2.5 s, the status becomes `waking` and the app shows the banner
    „Se trezește serverul…” for the Render cold start. It also pokes `/healthz`.

### Server (`server/server.js`)

* **HTTP:**
  - `POST /api/register {username, password, email?, name?, remember}` and
    `POST /api/login {username, password, remember}` both return `{token, exp, user}`.
  - `POST /api/logout` (Bearer token) and `GET /api/me` are also available, plus `GET /healthz`.
  - Passwords are hashed with **bcryptjs** (cost 10, pure JS).
  - Tokens are 32 random bytes, and only their SHA-256 hash is stored. They last 180 days with
    „Ține-mă minte” and 24 h without it.
  - Rate limits: login 30 per 10 min per IP and 10 per 15 min per username; register 10 per hour per IP.
* **WebSocket:** `{t:"hello", token, peer, table?}` gets `{t:"welcome", user, table}`. Requests have the form
  `{t:"req", id, op, …}` and get `{t:"res", id, ok, r | code, message}`. The server pushes `doc`, `peers`,
  `msg`, `social`, `invite` and `stats`.
* **Table ops** (a table is a namespace identified by a 5-char code from `A–Z2–9` without I/O/0/1):
  - Tables: `create`, `enter`, `exit`.
  - db: `get`, `list`, `set`, `update`, `delete`, `acquire`, `release`, `sub`, `unsub`.
  - room: `join`, `leave`, `presence`, `emit`.
  - `ping`.
* **db semantics:** every document has a version `v` that is incremented on each write. Writes are
  last-writer-wins in the order they arrive at the server. Documents are limited to 256 KiB and 32 levels of
  nesting, and a table holds at most 5000 documents. Leases are per document as `{holder, exp}`, with TTL
  clamped to 1–600 s; a busy lease returns `{acquired: false, expiresAt}`, and `data` is merged into the
  document on a granted acquire. `release` is an extension the real runtime does not have; core uses it when
  it is present.
* **Presence:** stored per table and per room. A dropped socket keeps its peer for 4 s, so quick reconnects do
  not show as leave and rejoin. Dead sockets are detected by WS ping every 20 s.
* **Account ops:** `me.get`, `profile.set {name, co, av 0–9, color 0–5, g, email}`, `friends.list`
  (`friends[]` with `online`, current `table` and `h2h`, plus `incoming[]`, `outgoing[]` and `invites[]`),
  `friends.request {username}`, `friends.respond {uid, accept}`, `friends.remove {uid}`,
  `friends.invite {uid, code}` (pushes `invite` to the friend and keeps it for 2 h), `invite.dismiss`,
  `stats.get`, and `h2h.get {uid}`.
* **Stats recording:** the server watches writes to `st/<game>`. When the state first carries `__end` for a
  new `__sid`, it reads `seats/<game>` and `__pl` to map seats to **account ids**; bots and unknown owners are
  skipped. It reads `s.res.vals[].total` for company values and `s.c[seat].co` for company names. It then
  records:
  - per player: `games`, `wins`, `draws`, the best company value with its name, and the last 20 games;
  - per pair of human players: `games`, `wins` per player, `draws`, each player's best value, and the last 20
    games.

  A game is never recorded twice. Each table remembers the last 100 recorded `__sid` values.
* **Persistence (swappable, `server/store.js`):** data is kept in memory and changed records are flushed every
  1.5 s and on SIGTERM. The record kinds are `users`, `sessions` (hashed tokens), `h2h` and `tables`; tables
  include all docs and are deleted after 60 idle days. Two backends exist:
  - `FileStore`: `DATA_DIR/<kind>/<key>.json`, written atomically.
  - `PgStore`: used when `DATABASE_URL` is set. It is a single table `cerul_kv(kind, key, data jsonb)` and
    works with Neon or Supabase free Postgres.

  To add another backend, implement `init`, `loadAll`, `save`, `remove` and `close`.

### Differences from the real Artifact runtime (on purpose)

* There are no access rules or sharing levels. Anyone at a table can write any document at that table. The
  table code acts as the key, and a valid account is required.
* `release()` exists.
* `by` is always the account id. There are no guests or agents.
* There are no subscription caps or quotas apart from the size and document limits above.
* Stats trust the clients, just as the scores in core already do. This is fine for friends, but a modified
  client could fake a result.
