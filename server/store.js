"use strict";
/*
 * Swappable persistence for the Cerul Lumii server.
 *
 * The server keeps everything in memory and writes changed records here (debounced).
 * A record = (kind, key) -> JSON object. Kinds used: "tables", "users", "sessions", "h2h".
 *
 *  - FileStore (default): DATA_DIR/<kind>/<key>.json (atomic write via rename).
 *    Fine on your own PC / a VPS / a Render PAID disk. On Render FREE the disk is wiped
 *    whenever the service sleeps, restarts or redeploys -> use PgStore there.
 *  - PgStore: set DATABASE_URL (free Neon.tech or Supabase Postgres). One table, cerul_kv.
 *
 * Interface (all async): init(), loadAll(kind) -> [{key, doc}], save(kind, key, doc), remove(kind, key), close().
 * To add another backend (SQLite, Redis, ...) implement these five methods and return it from makeStore().
 */
const fs = require("fs");
const path = require("path");

const KEY = /^[A-Za-z0-9_.:@+-]{1,160}$/;
const safeKey = k => KEY.test(k) ? k : "x_" + Buffer.from(String(k)).toString("hex").slice(0, 150);

class FileStore {
  constructor(dir) { this.dir = dir; this.kind = "file:" + dir; }
  async init() { fs.mkdirSync(this.dir, { recursive: true }); }
  async loadAll(kind) {
    const d = path.join(this.dir, kind); fs.mkdirSync(d, { recursive: true });
    const out = [];
    for (const f of fs.readdirSync(d)) {
      if (!f.endsWith(".json")) continue;
      try { const doc = JSON.parse(fs.readFileSync(path.join(d, f), "utf8")); out.push({ key: doc.__key || f.slice(0, -5), doc }); }
      catch (e) { console.error("[store] cannot read", kind, f, e.message); }
    }
    return out;
  }
  async save(kind, key, doc) {
    const d = path.join(this.dir, kind), file = path.join(d, safeKey(key) + ".json"), tmp = file + "." + process.pid + ".tmp";
    await fs.promises.mkdir(d, { recursive: true });
    await fs.promises.writeFile(tmp, JSON.stringify(Object.assign({ __key: key }, doc)));
    await fs.promises.rename(tmp, file);
  }
  async remove(kind, key) { try { await fs.promises.unlink(path.join(this.dir, kind, safeKey(key) + ".json")); } catch (e) {} }
  async close() {}
}

class PgStore {
  constructor(url) {
    let pg;
    try { pg = require("pg"); } catch (e) { throw new Error("DATABASE_URL is set but the 'pg' package is missing (npm i pg)"); }
    this.pool = new pg.Pool({ connectionString: url, max: 4, ssl: /sslmode=disable|localhost|127\.0\.0\.1/.test(url) ? false : { rejectUnauthorized: false } });
    this.kind = "postgres";
  }
  async init() {
    await this.pool.query(`CREATE TABLE IF NOT EXISTS cerul_kv (kind text NOT NULL, key text NOT NULL, data jsonb NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (kind, key))`);
  }
  async loadAll(kind) {
    const r = await this.pool.query("SELECT key, data FROM cerul_kv WHERE kind = $1", [kind]);
    return r.rows.map(row => ({ key: row.key, doc: row.data }));
  }
  async save(kind, key, doc) {
    await this.pool.query(
      "INSERT INTO cerul_kv (kind, key, data, updated_at) VALUES ($1, $2, $3, now()) ON CONFLICT (kind, key) DO UPDATE SET data = EXCLUDED.data, updated_at = now()",
      [kind, key, JSON.stringify(doc)]);
  }
  async remove(kind, key) { await this.pool.query("DELETE FROM cerul_kv WHERE kind = $1 AND key = $2", [kind, key]); }
  async close() { try { await this.pool.end(); } catch (e) {} }
}

function makeStore() {
  if (process.env.DATABASE_URL) return new PgStore(process.env.DATABASE_URL);
  return new FileStore(process.env.DATA_DIR || path.join(__dirname, "data"));
}

module.exports = { makeStore, FileStore, PgStore };
