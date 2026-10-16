/* Cerul Lumii desktop — app shell: intro, account (login / register / "Ține-mă minte"), lobby
   (create / join by code / invites, profile, friends, stats), then boots the unchanged game
   (core.js + games/cerul*.js) at the chosen table, with a small in-game HUD.
   Needs shim.js (window.CerulNet + window.claude) loaded first. */
(function () {
"use strict";
const W = window, D = document, Net = W.CerulNet;
const CFG = W.__CERUL_APP || {};
const DESK = W.cerulDesktop || null;           // Electron preload bridge (absent in a plain browser)
const QS = new URLSearchParams(location.search);
const $ = (s, r) => (r || D).querySelector(s);
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const ls = { get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };
const ss = { get(k, d) { try { const v = sessionStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { if (v == null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) {} } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const fmtMoney = v => v == null ? "—" : (Math.abs(v) >= 1e9 ? (v / 1e9).toFixed(2).replace(".", ",") + " mld €" : Math.abs(v) >= 1e6 ? (v / 1e6).toFixed(1).replace(".", ",") + " mil €" : Math.round(v).toLocaleString("ro-RO") + " €");
const fmtDate = t => { const d = new Date(t); return d.toLocaleDateString("ro-RO", { day: "numeric", month: "short" }) + " " + d.toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" }); };

/* ---------------- config ---------------- */
const DEFAULT_SERVER = CFG.defaultServer || "wss://cerul-lumii-server.onrender.com";
function serverUrl() {
  let u = QS.get("server") || (DESK && DESK.server) || ls.get("cerul-server", "") || DEFAULT_SERVER;
  u = String(u).trim().replace(/\/+$/, "");
  if (/^https?:/.test(u)) u = u.replace(/^http/, "ws");
  if (!/^wss?:\/\//.test(u)) u = "wss://" + u;
  return u;
}
// test hooks (never used by the desktop app itself): fast game / auto setup / game options
if (QS.get("cerulspeed")) W.__CERUL_SPEED = +QS.get("cerulspeed");
if (QS.get("cerulauto")) W.__CERUL_AUTO = 1;
if (QS.get("cerulopts")) { try { W.__CERUL_OPTS = JSON.parse(QS.get("cerulopts")); } catch (e) {} }

/* ---------------- token storage ("Ține-mă minte") ---------------- */
// remember = encrypted on disk via Electron safeStorage (Windows DPAPI); else only for this window session
const Tok = {
  async load() {
    const s = ss.get("cerul-token", null); if (s) return { token: s, remember: false };
    if (DESK && DESK.token) { try { const t = await DESK.token.load(); if (t) return { token: t, remember: true }; } catch (e) {} return null; }
    const t = ls.get("cerul-token", null); return t ? { token: t, remember: true } : null;
  },
  async save(token, remember) {
    if (remember) { ss.set("cerul-token", null); if (DESK && DESK.token) await DESK.token.save(token); else ls.set("cerul-token", token); }
    else ss.set("cerul-token", token);
  },
  async clear() { ss.set("cerul-token", null); try { localStorage.removeItem("cerul-token"); } catch (e) {} if (DESK && DESK.token) { try { await DESK.token.clear(); } catch (e) {} } },
};

/* ---------------- DOM roots ---------------- */
let shell, statusEl, toasts, hud, banner;
function mountRoots() {
  shell = D.createElement("div"); shell.className = "cx-shell"; shell.innerHTML = `<div class="cx-stars"></div><div id="cx-view"></div>`; D.body.appendChild(shell);
  statusEl = D.createElement("div"); statusEl.className = "cx-status"; statusEl.hidden = true; D.body.appendChild(statusEl);
  toasts = D.createElement("div"); toasts.className = "cx-toasts"; D.body.appendChild(toasts);
  banner = D.createElement("div"); banner.className = "cx-banner"; banner.hidden = true; D.body.appendChild(banner);
}
const view = () => $("#cx-view", shell);
function showStatus(html) { if (!html) { statusEl.hidden = true; return; } statusEl.innerHTML = html; statusEl.hidden = false; }
function toast(html, actions, ms) {
  const t = D.createElement("div"); t.className = "cx-toast"; t.innerHTML = html + (actions ? `<div class="cx-row"></div>` : "");
  if (actions) actions.forEach(([label, cls, fn]) => { const b = D.createElement("button"); b.className = "cx-btn small " + (cls || ""); b.textContent = label; b.onclick = () => { t.remove(); fn && fn(); }; $(".cx-row", t).appendChild(b); });
  toasts.appendChild(t); setTimeout(() => t.remove(), ms || (actions ? 20000 : 4000));
}
function modal(html, onMount) {
  const m = D.createElement("div"); m.className = "cx-modal"; m.innerHTML = `<div class="cx-card" role="dialog" aria-modal="true"><button class="cx-x" aria-label="Închide">×</button>${html}</div>`;
  const close = () => m.remove();
  m.addEventListener("click", e => { if (e.target === m || e.target.classList.contains("cx-x")) close(); });
  D.body.appendChild(m); if (onMount) onMount(m, close); return close;
}
const GLOBE = `<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="#04201e" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18"/></svg>`;
const BRAND = `<div class="cx-brand"><div class="glo">${GLOBE}</div><b>Cerul <span>Lumii</span></b></div>`;

/* ---------------- server status (cold start) ---------------- */
Net.on("status", s => {
  if (s === "waking") showStatus(`<span class="cx-spin"></span> Se trezește serverul… (după o pauză durează 30–60 de secunde)`);
  else if (s === "offline") showStatus(`<span class="cx-dot off"></span> Nu ai internet. Reîncerc singur…`);
  else if (s === "online" || s === "auth" || s === "idle") showStatus("");
  updateConn();
});
async function apiCall(path, body) {
  let slow = setTimeout(() => showStatus(`<span class="cx-spin"></span> Se trezește serverul… (după o pauză durează 30–60 de secunde)`), 2500);
  try { return await Net.api(path, body); }
  catch (e) { if (e instanceof TypeError) throw Object.assign(new Error("Nu pot ajunge la server. Verifică internetul (sau adresa serverului)."), { code: "network" }); throw e; }
  finally { clearTimeout(slow); showStatus(""); }
}

/* ---------------- intro ---------------- */
const PLANE = `<svg viewBox="0 0 400 130" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="cxb" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#c9d6e6"/></linearGradient></defs>
<path d="M18 62 C40 50 300 44 352 52 C378 56 392 66 388 74 C384 82 362 86 330 86 L70 88 C40 88 20 80 18 62Z" fill="url(#cxb)"/>
<path d="M30 60 L8 18 L40 18 L96 58Z" fill="#ff6a2a"/><path d="M150 76 L250 76 L196 122 L170 122Z" fill="#dfe8f3"/><path d="M165 60 L230 60 L205 40 L188 40Z" fill="#c9d6e6"/>
<path d="M352 56 C366 58 376 62 380 66 L356 66Z" fill="#1b2b44"/><g fill="#1b2b44">${Array.from({ length: 16 }, (_, i) => `<rect x="${110 + i * 14}" y="60" width="7" height="7" rx="2"/>`).join("")}</g>
<path d="M18 66 C80 70 300 70 386 70" stroke="#22e0d0" stroke-width="4" fill="none"/><rect x="186" y="96" width="34" height="12" rx="6" fill="#9fb2c9"/></svg>`;
function intro() {
  return new Promise(resolve => {
    if (QS.get("nointro") || ss.get("cerul-next", null)) return resolve();
    const el = D.createElement("div"); el.className = "cx-intro";
    el.innerHTML = `<div class="sun"></div><div class="trail"></div><div class="ground"></div><div class="runway">${Array.from({ length: 12 }, (_, i) => `<i style="left:${i * 12}vw"></i>`).join("")}</div>
      <div class="plane">${PLANE}</div><div class="logo"><h1>CERUL <span>LUMII</span></h1><p>Construiește cea mai valoroasă companie aeriană din lume</p></div>
      <div class="hint">Apasă orice tastă sau dă click ca să sari</div>`;
    D.body.appendChild(el);
    let done = false;
    const end = fast => { if (done) return; done = true; D.removeEventListener("keydown", onKey, true); if (fast) el.classList.add("skip"); setTimeout(() => { el.remove(); resolve(); }, fast ? 260 : 0); };
    const onKey = e => { e.preventDefault(); end(true); };
    el.addEventListener("click", () => end(true)); D.addEventListener("keydown", onKey, true);
    setTimeout(() => end(false), 4400);
  });
}

/* ---------------- script loading (game) ---------------- */
const loaded = new Set();
function loadScript(src) {
  if (loaded.has(src)) return Promise.resolve(); loaded.add(src);
  return new Promise((res, rej) => { const s = D.createElement("script"); s.src = src; s.async = false; s.onload = res; s.onerror = () => rej(new Error("nu pot încărca " + src)); D.body.appendChild(s); });
}
const early = Promise.all((CFG.early || []).map(loadScript)).catch(e => console.warn(e)); // art + data: avatars/colours in the lobby

/* ---------------- avatars / colours (from the game's own art) ---------------- */
const COLORS = () => (W.CerulData && W.CerulData.COLORS) || [{ id: 0, n: "Portocaliu", hex: "#ff6a2a" }, { id: 1, n: "Turcoaz", hex: "#22e0d0" }, { id: 2, n: "Roz", hex: "#ff5ca8" }, { id: 3, n: "Verde lime", hex: "#9be14a" }, { id: 4, n: "Galben", hex: "#ffd447" }, { id: 5, n: "Violet", hex: "#b48cff" }];
const AVATARS = () => (W.CerulData && W.CerulData.AVATARS) || Array.from({ length: 10 }, (_, i) => ({ id: i, g: i < 5 ? "m" : "f", name: ["Victor", "Andrei", "Kwame", "Hiro", "Matei", "Ioana", "Elena", "Amara", "Mei", "Sofia"][i] }));
const colHex = c => (COLORS()[c | 0] || COLORS()[0]).hex;
function avatarHTML(p, cls) {
  p = p || {}; let inner = "";
  if (W.CerulArt && W.CerulArt.avatar) { try { inner = W.CerulArt.avatar(p.av | 0, 80, "happy", {}); } catch (e) { inner = ""; } }
  if (!inner) inner = esc(String(p.name || "?").slice(0, 1).toUpperCase());
  return `<span class="cx-av ${cls || ""}" style="--cc:${colHex(p.color)}">${inner}</span>`;
}

/* ======================= state ======================= */
const App = { me: null, stats: null, social: { friends: [], incoming: [], outgoing: [], invites: [] }, booted: false, table: null, screen: "" };
const recentKey = () => "cerul-recent-" + (App.me ? App.me.id : "");
function rememberTable(code) { const l = ls.get(recentKey(), []).filter(x => x.code !== code); l.unshift({ code, at: Date.now() }); ls.set(recentKey(), l.slice(0, 6)); }

/* ======================= auth screen ======================= */
function showAuth(msg) {
  App.screen = "auth"; shell.hidden = false; if (hud) hud.hidden = true;
  let mode = "login";
  const render = () => {
    view().innerHTML = `<div class="cx-auth"><div class="cx-card">
      ${BRAND}
      <div class="cx-tabs"><button data-m="login" class="${mode === "login" ? "on" : ""}">Intră în cont</button><button data-m="register" class="${mode === "register" ? "on" : ""}">Cont nou</button></div>
      <form id="cx-af" autocomplete="on">
        <label class="cx-lbl" for="cx-u">Nume de utilizator</label><input id="cx-u" class="cx-in" name="username" autocomplete="username" maxlength="20" required spellcheck="false" placeholder="ex. damian">
        <label class="cx-lbl" for="cx-p">Parolă</label><input id="cx-p" class="cx-in" type="password" name="password" autocomplete="${mode === "login" ? "current-password" : "new-password"}" required minlength="6" placeholder="${mode === "login" ? "" : "cel puțin 6 caractere"}">
        ${mode === "register" ? `<label class="cx-lbl" for="cx-n">Numele afișat în joc</label><input id="cx-n" class="cx-in" maxlength="16" placeholder="ex. Damian">
        <label class="cx-lbl" for="cx-e">Email (opțional — pentru resetarea parolei, mai târziu)</label><input id="cx-e" class="cx-in" type="email" autocomplete="email" placeholder="nume@exemplu.ro">` : ""}
        <label class="cx-chk"><input type="checkbox" id="cx-rem" checked> Ține-mă minte pe acest calculator</label>
        <div class="cx-err" id="cx-aerr">${esc(msg || "")}</div>
        <button class="cx-btn primary big" id="cx-ago" type="submit">${mode === "login" ? "Intră" : "Creează contul"}</button>
      </form>
      <div class="cx-foot">Server: ${esc(serverUrl().replace(/^wss?:\/\//, ""))} · <a id="cx-srv">schimbă</a>${DESK ? ` · <a id="cx-quit">Ieși din joc</a>` : ""}</div>
    </div></div>`;
    view().querySelectorAll("[data-m]").forEach(b => b.onclick = () => { mode = b.dataset.m; msg = ""; render(); });
    $("#cx-srv").onclick = editServer;
    if ($("#cx-quit")) $("#cx-quit").onclick = () => DESK.quit();
    $("#cx-u").focus();
    $("#cx-af").onsubmit = async e => {
      e.preventDefault();
      const btn = $("#cx-ago"), err = $("#cx-aerr"); btn.disabled = true; err.textContent = "";
      const body = { username: $("#cx-u").value.trim(), password: $("#cx-p").value, remember: $("#cx-rem").checked };
      if (mode === "register") { body.name = $("#cx-n").value.trim(); body.email = $("#cx-e").value.trim(); }
      try {
        const r = await apiCall(mode === "login" ? "/api/login" : "/api/register", body);
        await Tok.save(r.token, body.remember);
        await startSession(r.token);
      } catch (x) { err.textContent = x.message || "Nu a mers. Încearcă din nou."; btn.disabled = false; }
    };
  };
  render();
}
function editServer() {
  modal(`<h3 class="cx-h">Adresa serverului</h3><p class="cx-sub">Lasă câmpul gol ca să revii la serverul implicit.</p>
    <input class="cx-in" id="cx-sv" value="${esc(serverUrl())}" spellcheck="false"><div class="cx-row" style="margin-top:14px"><button class="cx-btn primary" id="cx-svok">Salvează</button></div>`, (m, close) => {
    $("#cx-svok", m).onclick = async () => {
      const v = $("#cx-sv", m).value.trim();
      if (DESK && DESK.setServer) await DESK.setServer(v); else ls.set("cerul-server", v);
      close(); location.reload();
    };
  });
}

/* ======================= session ======================= */
async function startSession(token) {
  Net.configure({ url: serverUrl(), token });
  const ok = Net.welcomed ? true : Net.status === "auth" ? false : await new Promise(resolve => {
    const offW = Net.on("welcome", () => { offW(); offA(); resolve(true); });
    const offA = Net.on("auth", () => { offW(); offA(); resolve(false); });
    Net.connect();
  });
  if (!ok) { await Tok.clear(); showAuth("Sesiunea a expirat. Intră din nou în cont."); return; }
  App.me = Net.user;
  if (!startSession.wired) {
    startSession.wired = true;
    Net.on("social", () => refreshSocial());
    Net.on("stats", () => { refreshStats(); refreshSocial(); });
    Net.on("invite", m => { refreshSocial(); onInvite(m); });
    Net.on("auth", async () => { await Tok.clear(); location.reload(); });
    Net.on("tableLost", m => { toast(`Masa <b>${esc(m.code)}</b> nu mai există pe server.`); });
  }
  await Promise.all([refreshSocial(), refreshStats()]);
  // after a reload for switching tables, go straight to the chosen table
  const next = ss.get("cerul-next", null); ss.set("cerul-next", null);
  if (next && next.code) { try { await enterTable(next.code); return; } catch (e) { showLobby(); toast(esc(e.message)); return; } }
  showLobby();
}
async function refreshSocial() { try { App.social = await Net.request("friends.list"); } catch (e) {} if (App.screen === "lobby") renderLobby(); renderHudPop(); }
async function refreshStats() { try { const r = await Net.request("me.get"); App.me = r.user; App.stats = r.stats; } catch (e) {} if (App.screen === "lobby") renderLobby(); }
async function logout() {
  try { await Net.api("/api/logout", {}); } catch (e) {}
  await Tok.clear(); location.reload();
}

/* ======================= lobby ======================= */
function showLobby() { App.screen = "lobby"; shell.hidden = false; if (hud) hud.hidden = true; renderLobby(); }
function renderLobby() {
  const me = App.me, p = me.profile, st = App.stats || { games: 0, wins: 0, best: 0, recent: [] }, so = App.social;
  const recent = ls.get(recentKey(), []);
  const keep = { code: ($("#cx-code") || {}).value || "", add: ($("#cx-addf") || {}).value || "" };
  view().innerHTML = `<div class="cx-wrap">
    <div class="cx-top">${BRAND}
      <div class="cx-row">
        <button class="cx-me" id="cx-prof" title="Editează profilul">${avatarHTML(p)}<span style="text-align:left"><span class="nm">${esc(p.name)}</span><br><span class="co" style="--cc:${colHex(p.color)}">${esc(p.co || "—")}</span></span></button>
        ${DESK ? `<button class="cx-btn ghost small" id="cx-fs" title="Ecran complet / fereastră (F11)">⛶</button>` : ""}
        <button class="cx-btn ghost small" id="cx-out">Ieșire din cont</button>
        ${DESK ? `<button class="cx-btn ghost small danger" id="cx-quit">Închide jocul</button>` : ""}
      </div></div>
    <div class="cx-grid">
      <div>
        ${App.booted && App.table ? `<div class="cx-card" style="margin-bottom:14px"><div class="cx-row" style="justify-content:space-between"><span>Ești la masa <b class="cx-chip">${esc(App.table)}</b></span><button class="cx-btn primary" id="cx-back">Înapoi la masă</button></div></div>` : ""}
        <div class="cx-play">
          <div class="cx-card"><h3 class="cx-h">Creează masă</h3><p class="cx-sub">Primești un cod scurt. Îl dai prietenilor sau îi inviți direct din listă.</p><button class="cx-btn warm big" id="cx-create">✈ Creează masă</button></div>
          <div class="cx-card"><h3 class="cx-h">Intră cu cod</h3><p class="cx-sub">Scrie codul de 5 caractere primit de la prieten.</p>
            <form id="cx-join" class="cx-row" style="flex-wrap:nowrap"><input id="cx-code" class="cx-in cx-codein" maxlength="5" placeholder="ABCDE" autocomplete="off" spellcheck="false" value="${esc(keep.code)}"><button class="cx-btn primary" type="submit" style="padding:14px 18px">Intră</button></form></div>
        </div>
        <div id="cx-jerr" class="cx-err"></div>
        ${so.invites.length ? `<div class="cx-sect">Invitații</div>` + so.invites.map(i => `<div class="cx-invite">${avatarHTML(i.from.profile, "sm")}<div class="tx"><b>${esc(i.from.name)}</b> te invită la masa <b>${esc(i.code)}</b><br><small class="cx-muted">${fmtDate(i.at)}</small></div><button class="cx-btn primary small" data-inv="${esc(i.code)}">Intră</button><button class="cx-btn ghost small" data-dis="${esc(i.code)}" data-from="${esc(i.from.id)}">Ignoră</button></div>`).join("") : ""}
        ${recent.length ? `<div class="cx-sect">Mesele tale recente</div><div class="cx-chips">${recent.map(r => `<button class="cx-chip" data-code="${esc(r.code)}" title="${fmtDate(r.at)}">${esc(r.code)}</button>`).join("")}</div>` : ""}
        <div class="cx-card" style="margin-top:18px"><h3 class="cx-h">Statisticile mele</h3>
          <div class="cx-stats"><div class="cx-stat"><b>${st.games}</b><span>partide</span></div><div class="cx-stat"><b>${st.wins}</b><span>victorii</span></div><div class="cx-stat"><b>${st.games ? Math.round(st.wins / st.games * 100) : 0}%</b><span>rata de victorie</span></div><div class="cx-stat"><b style="font-size:16px">${fmtMoney(st.best || null)}</b><span>cea mai valoroasă companie${st.bestCo ? " (" + esc(st.bestCo) + ")" : ""}</span></div></div>
          ${gamesList(st.recent, me.id)}</div>
      </div>
      <div class="cx-card"><h3 class="cx-h">Prieteni</h3>
        <form id="cx-addform" class="cx-row" style="flex-wrap:nowrap"><input id="cx-addf" class="cx-in" placeholder="Adaugă după numele de utilizator" spellcheck="false" maxlength="20" value="${esc(keep.add)}"><button class="cx-btn" type="submit">Adaugă</button></form>
        <div id="cx-ferr" class="cx-err" style="min-height:0"></div>
        ${so.incoming.length ? `<div class="cx-sect">Cereri de prietenie</div>` + so.incoming.map(u => `<div class="cx-invite" style="border-color:var(--cx-line2);background:#0b1d36">${avatarHTML(u.profile, "sm")}<div class="tx"><b>${esc(u.name)}</b> <small class="cx-muted">@${esc(u.username)}</small></div><button class="cx-btn primary small" data-acc="${esc(u.id)}">Acceptă</button><button class="cx-btn ghost small" data-dec="${esc(u.id)}">Refuză</button></div>`).join("") : ""}
        <div class="cx-sect">Lista ta (${so.friends.length})</div>
        <div class="cx-list">${so.friends.length ? so.friends.map(f => `<button class="cx-friend" data-f="${esc(f.id)}">${avatarHTML(f.profile, "sm")}<span class="tx"><b>${esc(f.name)}</b><small><span class="cx-dot ${f.online ? "on" : ""}"></span> ${f.online ? (f.table ? "online · la masa " + esc(f.table) : "online") : "offline"} · @${esc(f.username)}</small></span><span class="cx-score" title="victorii–înfrângeri între voi"><b>${f.h2h.wins}</b>–<i>${f.h2h.losses}</i></span></button>`).join("") : `<div class="cx-empty">Încă nu ai prieteni aici. Cere-le numele de utilizator și adaugă-i.</div>`}</div>
        ${so.outgoing.length ? `<div class="cx-sect">Cereri trimise</div>` + so.outgoing.map(u => `<div class="cx-empty">⏳ ${esc(u.name)} (@${esc(u.username)})</div>`).join("") : ""}
      </div>
    </div>
    <div class="cx-foot">Conectat ca @${esc(me.username)} · server ${esc(serverUrl().replace(/^wss?:\/\//, ""))} · <a id="cx-srv">schimbă</a></div>
  </div>`;
  const v = view();
  $("#cx-prof", v).onclick = editProfile;
  $("#cx-out", v).onclick = logout;
  $("#cx-srv", v).onclick = editServer;
  if ($("#cx-quit", v)) $("#cx-quit", v).onclick = () => DESK.quit();
  if ($("#cx-fs", v)) $("#cx-fs", v).onclick = () => DESK.toggleFullscreen();
  if ($("#cx-back", v)) $("#cx-back", v).onclick = backToGame;
  $("#cx-create", v).onclick = async e => { e.target.disabled = true; try { await switchTable(null); } catch (x) { $("#cx-jerr").textContent = x.message; e.target.disabled = false; } };
  $("#cx-join", v).onsubmit = async e => { e.preventDefault(); const c = $("#cx-code").value.trim().toUpperCase(); if (c.length < 4) { $("#cx-jerr").textContent = "Codul are 5 caractere."; return; } try { await switchTable(c); } catch (x) { $("#cx-jerr").textContent = x.message; } };
  v.querySelectorAll("[data-code]").forEach(b => b.onclick = () => switchTable(b.dataset.code).catch(x => { $("#cx-jerr").textContent = x.message; }));
  v.querySelectorAll("[data-inv]").forEach(b => b.onclick = () => { Net.request("invite.dismiss", { code: b.dataset.inv }).catch(() => {}); switchTable(b.dataset.inv).catch(x => { $("#cx-jerr").textContent = x.message; }); });
  v.querySelectorAll("[data-dis]").forEach(b => b.onclick = async () => { await Net.request("invite.dismiss", { code: b.dataset.dis, from: b.dataset.from }).catch(() => {}); refreshSocial(); });
  v.querySelectorAll("[data-acc]").forEach(b => b.onclick = async () => { App.social = await Net.request("friends.respond", { uid: b.dataset.acc, accept: true }); renderLobby(); });
  v.querySelectorAll("[data-dec]").forEach(b => b.onclick = async () => { App.social = await Net.request("friends.respond", { uid: b.dataset.dec, accept: false }); renderLobby(); });
  v.querySelectorAll("[data-f]").forEach(b => b.onclick = () => friendCard(b.dataset.f));
  $("#cx-addform", v).onsubmit = async e => {
    e.preventDefault(); const u = $("#cx-addf").value.trim(); if (!u) return;
    try { const r = await Net.request("friends.request", { username: u }); $("#cx-addf").value = ""; toast(r.status === "friends" ? `Acum sunteți prieteni cu <b>${esc(u)}</b>.` : `Cerere trimisă către <b>${esc(u)}</b>.`); refreshSocial(); }
    catch (x) { $("#cx-ferr").textContent = x.message; }
  };
}
function gamesList(recent, myId) {
  if (!recent || !recent.length) return `<div class="cx-empty" style="margin-top:10px">Nicio partidă terminată încă.</div>`;
  return `<div class="cx-sect">Ultimele partide</div><div class="cx-games">${recent.slice(0, 8).map(g => {
    const mine = g.players.find(p => p.id === myId); const win = g.winner && g.winner.id === myId;
    const cls = g.draw ? "draw" : win ? "win" : "lose";
    return `<div class="cx-game"><span class="w ${cls}">${g.draw ? "Egal" : win ? "Victorie" : "Înfrângere"}</span><span class="pl">${g.players.map(p => esc(p.name) + (p.value != null ? " " + fmtMoney(p.value) : "")).join(" · ")}</span><span class="cx-muted">${fmtDate(g.at)}</span></div>`; }).join("")}</div>`;
}
async function friendCard(uid) {
  let h; try { h = await Net.request("h2h.get", { uid }); } catch (e) { toast(esc(e.message)); return; }
  const f = App.social.friends.find(x => x.id === uid) || h.friend;
  modal(`<div class="cx-row" style="gap:14px">${avatarHTML(f.profile, "lg")}<div><h3 class="cx-h" style="margin:0">${esc(f.name)}</h3><div class="cx-muted">@${esc(f.username)} · ${esc(f.profile.co || "")}</div>
      <div style="margin-top:4px"><span class="cx-dot ${f.online ? "on" : ""}"></span> ${f.online ? (f.table ? "online · la masa " + esc(f.table) : "online") : "offline"}</div></div></div>
    <div class="cx-sect">Între voi doi</div>
    <div class="cx-h2h"><div><div class="big"><b>${h.wins}</b></div><div class="cx-muted">victoriile tale</div></div><div class="cx-muted">${h.games} partide${h.draws ? " · " + h.draws + " egal" : ""}${h.other ? " · " + h.other + " câștigate de alții" : ""}</div><div><div class="big"><i>${h.losses}</i></div><div class="cx-muted">victoriile lui/ei</div></div></div>
    <div class="cx-stats" style="grid-template-columns:1fr 1fr"><div class="cx-stat"><b style="font-size:16px">${fmtMoney(h.best || null)}</b><span>cea mai bună companie a ta (între voi)</span></div><div class="cx-stat"><b style="font-size:16px">${fmtMoney(h.theirBest || null)}</b><span>cea mai bună a lui/ei</span></div></div>
    ${gamesList(h.recent, App.me.id)}
    <div class="cx-row" style="margin-top:16px">${App.table ? `<button class="cx-btn primary" id="cx-finv">Invită la masa ${esc(App.table)}</button>` : ""}${f.online && f.table && f.table !== App.table ? `<button class="cx-btn" id="cx-fjoin">Intră la masa lui/ei</button>` : ""}<span style="flex:1"></span><button class="cx-btn ghost small danger" id="cx-frm">Șterge din prieteni</button></div>`, (m, close) => {
    if ($("#cx-finv", m)) $("#cx-finv", m).onclick = async () => { await invite(uid); close(); };
    if ($("#cx-fjoin", m)) $("#cx-fjoin", m).onclick = () => { close(); switchTable(f.table).catch(x => toast(esc(x.message))); };
    $("#cx-frm", m).onclick = async () => { if (!confirmInline($("#cx-frm", m))) return; App.social = await Net.request("friends.remove", { uid }); close(); renderLobby(); };
  });
}
function confirmInline(btn) { if (btn.dataset.sure) return true; btn.dataset.sure = "1"; btn.textContent = "Sigur? Apasă din nou"; return false; }
function editProfile() {
  const p = Object.assign({}, App.me.profile);
  modal(`<h3 class="cx-h">Profilul tău</h3><p class="cx-sub">Apar automat când te așezi la o masă (le poți schimba și acolo, doar pentru partida aceea).</p>
    <div class="cx-row" style="gap:16px;align-items:flex-start"><div id="cx-pav"></div><div style="flex:1;min-width:200px">
      <label class="cx-lbl">Numele tău</label><input class="cx-in" id="cx-pn" maxlength="16" value="${esc(p.name)}">
      <label class="cx-lbl">Numele companiei aeriene</label><input class="cx-in" id="cx-pc" maxlength="22" value="${esc(p.co)}" placeholder="ex. Carpați Jet">
      <div class="cx-lbl">Cum să-ți spunem</div><div class="cx-seg" id="cx-pg"><button data-g="m">el</button><button data-g="f">ea</button></div></div></div>
    <div class="cx-lbl">Personajul</div><div class="cx-avs" id="cx-pavs"></div>
    <div class="cx-lbl">Culoarea companiei</div><div class="cx-cols" id="cx-pcols"></div>
    <label class="cx-lbl">Email (opțional)</label><input class="cx-in" id="cx-pe" type="email" value="${esc(App.me.email || "")}">
    <div class="cx-err" id="cx-perr"></div>
    <div class="cx-row"><button class="cx-btn primary" id="cx-psave">Salvează</button></div>`, (m, close) => {
    const draw = () => {
      $("#cx-pav", m).innerHTML = avatarHTML(p, "lg");
      $("#cx-pavs", m).innerHTML = AVATARS().slice(0, 10).map(a => `<button data-av="${a.id}" class="${a.id === p.av ? "on" : ""}">${W.CerulArt && W.CerulArt.avatar ? W.CerulArt.avatar(a.id, 64, "neutral", {}) : ""}${esc(a.name)}</button>`).join("");
      $("#cx-pcols", m).innerHTML = COLORS().map(c => `<button data-col="${c.id}" class="${c.id === p.color ? "on" : ""}" style="--c:${c.hex}" title="${esc(c.n)}"></button>`).join("");
      m.querySelectorAll("#cx-pg button").forEach(b => b.classList.toggle("on", b.dataset.g === p.g));
      m.querySelectorAll("[data-av]").forEach(b => b.onclick = () => { p.av = +b.dataset.av; const a = AVATARS()[p.av]; if (a && a.g) p.g = a.g; draw(); });
      m.querySelectorAll("[data-col]").forEach(b => b.onclick = () => { p.color = +b.dataset.col; draw(); });
      m.querySelectorAll("#cx-pg button").forEach(b => b.onclick = () => { p.g = b.dataset.g; draw(); });
    };
    draw();
    $("#cx-psave", m).onclick = async () => {
      p.name = $("#cx-pn", m).value.trim(); p.co = $("#cx-pc", m).value.trim(); p.email = $("#cx-pe", m).value.trim();
      try { const r = await Net.request("profile.set", { profile: p }); App.me = r.user; close(); renderLobby(); toast("Profil salvat."); if (App.booted) toast("Numele nou apare la masă după ce reintri în joc."); }
      catch (x) { $("#cx-perr", m).textContent = x.message; }
    };
  });
}

/* ======================= tables ======================= */
// the game engine can be booted once per page; another table = reload straight into it
async function switchTable(code) {
  if (App.booted) {
    if (code && code === App.table) { backToGame(); return; }
    if (!code) { code = await Net.createTable(); } // created now, entered after the reload
    ss.set("cerul-next", { code }); location.reload(); return;
  }
  await enterTable(code);
}
async function enterTable(code) {
  showStatus(`<span class="cx-spin"></span> ${code ? "Intru la masa " + esc(code) + "…" : "Pregătesc masa…"}`);
  try { App.table = code ? await Net.enterTable(code) : await Net.createTable(); }
  finally { showStatus(""); }
  rememberTable(App.table);
  await bootGame();
}
async function bootGame() {
  shell.hidden = true; App.screen = "game";
  mountHud();
  if (App.booted) return;
  App.booted = true;
  // identity for the game = the ACCOUNT id (not the device), name = profile name
  W.__SALON_ME = App.me.id; W.__SALON_NICK = App.me.profile.name;
  try { localStorage.removeItem("salon-test"); localStorage.setItem("salon-rules-cerul", "1"); } catch (e) {}
  if (location.hash !== "#cerul") history.replaceState(null, "", "#cerul");
  showStatus(`<span class="cx-spin"></span> Se încarcă Cerul Lumii…`);
  await early;
  for (const s of CFG.scripts || []) await loadScript(s);
  showStatus("");
  Net.tableReady();
  W.Salon.boot();
  watchGameDom();
  D.title = "Cerul Lumii · masa " + App.table;
}
function backToGame() { shell.hidden = true; App.screen = "game"; if (hud) hud.hidden = false; if (location.hash !== "#cerul") location.hash = "#cerul"; }
async function invite(uid) {
  try { const r = await Net.request("friends.invite", { uid, code: App.table }); toast(r.online ? "Invitație trimisă." : "Invitație trimisă. O vede când intră în joc."); }
  catch (e) { toast(esc(e.message)); }
}
function onInvite(m) {
  if (App.table && m.code === App.table) return;
  toast(`${avatarHTML(m.from.profile, "sm")} <b>${esc(m.from.name)}</b> te invită la masa <b>${esc(m.code)}</b>.`,
    [["Intră", "primary", () => { Net.request("invite.dismiss", { code: m.code }).catch(() => {}); switchTable(m.code).catch(x => toast(esc(x.message))); }], ["Mai târziu", "ghost", null]]);
}

/* ======================= in-game HUD ======================= */
function mountHud() {
  if (hud) { hud.hidden = false; return; }
  hud = D.createElement("div"); hud.className = "cx-hud";
  hud.innerHTML = `<div class="pop" hidden></div><div class="pill"><span class="grip" title="Trage ca să muți bara">⋮⋮</span><span class="cx-dot on" id="cx-cdot" title="Conexiune"></span>
    <button id="cx-hcode" title="Copiază codul mesei"><span class="code">${esc(App.table)}</span> ⧉</button>
    <button id="cx-hinv">Invită</button><button id="cx-hlob" title="Prieteni, profil, alte mese">Mese</button>${DESK ? `<button id="cx-hfs" title="Ecran complet / fereastră (F11)">⛶</button>` : ""}</div>`;
  D.body.appendChild(hud);
  $("#cx-hcode", hud).onclick = async () => { try { await navigator.clipboard.writeText(App.table); toast(`Codul <b>${esc(App.table)}</b> e copiat. Trimite-l prietenilor.`); } catch (e) { toast(`Codul mesei: <b>${esc(App.table)}</b>`); } };
  $("#cx-hinv", hud).onclick = () => { const p = $(".pop", hud); p.hidden = !p.hidden; hud.classList.toggle("open", !p.hidden); renderHudPop(); };
  $("#cx-hlob", hud).onclick = () => { $(".pop", hud).hidden = true; hud.classList.remove("open"); showLobby(); };
  if ($("#cx-hfs", hud)) $("#cx-hfs", hud).onclick = () => DESK.toggleFullscreen();
  D.addEventListener("click", e => { if (hud && !hud.contains(e.target)) { $(".pop", hud).hidden = true; hud.classList.remove("open"); } });
  // draggable (the game's own buttons may sit under it); position remembered on this computer
  const place = pos => { if (!pos) return; const r = hud.getBoundingClientRect();
    const x = Math.max(4, Math.min(innerWidth - r.width - 4, pos.x * innerWidth)), y = Math.max(4, Math.min(innerHeight - r.height - 4, pos.y * innerHeight));
    hud.classList.add("moved"); hud.style.left = x + "px"; hud.style.top = y + "px"; hud.classList.toggle("low", y > innerHeight / 2); };
  place(ls.get("cerul-hud-pos", null));
  addEventListener("resize", () => place(ls.get("cerul-hud-pos", null)));
  const grip = $(".grip", hud);
  grip.addEventListener("pointerdown", e => {
    e.preventDefault(); grip.setPointerCapture(e.pointerId); hud.classList.add("drag");
    const r = hud.getBoundingClientRect(), dx = e.clientX - r.left, dy = e.clientY - r.top;
    const mv = ev => place({ x: (ev.clientX - dx) / innerWidth, y: (ev.clientY - dy) / innerHeight });
    const up = ev => { grip.removeEventListener("pointermove", mv); grip.removeEventListener("pointerup", up); hud.classList.remove("drag");
      const rr = hud.getBoundingClientRect(); ls.set("cerul-hud-pos", { x: rr.left / innerWidth, y: rr.top / innerHeight }); };
    grip.addEventListener("pointermove", mv); grip.addEventListener("pointerup", up);
  });
  updateConn();
}
function renderHudPop() {
  if (!hud) return; const p = $(".pop", hud); if (p.hidden) return;
  const fr = App.social.friends;
  p.innerHTML = `<div class="cx-sect" style="margin-top:0">Invită la masa ${esc(App.table)}</div>` + (fr.length ? fr.map(f => `<div class="cx-friend" style="cursor:default">${avatarHTML(f.profile, "sm")}<span class="tx"><b>${esc(f.name)}</b><small><span class="cx-dot ${f.online ? "on" : ""}"></span> ${f.online ? (f.table === App.table ? "e aici" : "online") : "offline"}</small></span>${f.table === App.table ? "" : `<button class="cx-btn small primary" data-hi="${esc(f.id)}">Invită</button>`}</div>`).join("")
    : `<div class="cx-empty">Adaugă prieteni din ecranul „Mese”, sau trimite-le codul mesei: <b>${esc(App.table)}</b></div>`);
  p.querySelectorAll("[data-hi]").forEach(b => b.onclick = async e => { e.stopPropagation(); b.disabled = true; await invite(b.dataset.hi); b.textContent = "Trimis ✓"; });
}
let connBadT = 0;
function updateConn() {
  const dot = hud && $("#cx-cdot", hud);
  const s = Net.status;
  if (dot) dot.className = "cx-dot " + (s === "online" ? "on" : s === "waking" || s === "reconnecting" || s === "connecting" ? "slow" : "off");
  clearTimeout(connBadT);
  if (App.screen === "game" && s !== "online") connBadT = setTimeout(() => { if (Net.status !== "online") { banner.innerHTML = `<span class="cx-spin"></span> ${Net.status === "waking" ? "Se trezește serverul…" : Net.status === "offline" ? "Nu ai internet — mutările se trimit când revine." : "Conexiune pierdută — reconectez…"}`; banner.hidden = false; } }, 2000);
  else banner.hidden = true;
}

/* ======================= game DOM adjustments ======================= */
function watchGameDom() {
  // "← Salon" (back to the hub) becomes "← Mese" (back to our lobby); the hub brand becomes Cerul Lumii
  const fix = () => {
    const b = D.getElementById("backBtn"); if (b && !b.dataset.cx) { b.dataset.cx = "1"; b.textContent = "← Mese"; b.title = "Prieteni, profil, alte mese"; }
    D.querySelectorAll("button").forEach(x => { if (!x.dataset.cx && x.textContent.trim() === "← Salon") { x.dataset.cx = "1"; x.textContent = "← Mese"; } });
    const br = D.querySelector(".topbar .brand"); if (br && !br.dataset.cx) { br.dataset.cx = "1"; br.innerHTML = "<i></i>Cerul Lumii"; br.setAttribute("href", "#cerul"); }
    autofillProfile();
  };
  new MutationObserver(fix).observe(D.body, { childList: true, subtree: true });
  fix();
  W.addEventListener("hashchange", () => { if (!/^#?cerul$/.test(location.hash) && App.booted) { showLobby(); } });
}
// pre-fill the Cerul setup form (company name, avatar, colour) from the account profile, once per setup phase
let afDone = false, afGoneAt = 0;
function autofillProfile() {
  const form = D.querySelector(".cs-prof");
  if (!form) { if (afDone && !afGoneAt) afGoneAt = Date.now(); if (afGoneAt && Date.now() - afGoneAt > 3000) { afDone = false; afGoneAt = 0; } return; }
  afGoneAt = 0; if (afDone) return; afDone = true;
  const p = App.me.profile;
  setTimeout(() => {
    const av = form.querySelector(`[data-av="${p.av}"]:not([disabled])`); if (av && !av.classList.contains("on")) av.click();
    const fresh = D.querySelector(".cs-prof") || form;
    const col = fresh.querySelector(`[data-col="${p.color}"]:not([disabled])`); if (col && !col.classList.contains("on")) col.click();
    const co = (D.querySelector(".cs-prof") || form).querySelector('[data-f="co"]');
    if (co && p.co && co.value !== p.co) { co.value = p.co; co.dispatchEvent(new Event("input", { bubbles: true })); co.dispatchEvent(new Event("change", { bubbles: true })); }
  }, 500);
}
// Esc leaves full screen when nothing on the page used it (an open dialog closes first)
D.addEventListener("keydown", e => {
  if (e.key !== "Escape" || !DESK || e.defaultPrevented) return;
  const dlg = [...D.querySelectorAll('[role="dialog"],[aria-modal="true"],.g-confirm,.cx-modal')].some(x => x.offsetParent !== null);
  if (!dlg) DESK.setFullscreen(false);
});

/* ======================= start ======================= */
async function main() {
  mountRoots();
  shell.hidden = true;
  Net.configure({ url: serverUrl() });
  fetch(Net.httpBase() + "/healthz", { cache: "no-store" }).catch(() => {}); // wake a sleeping server during the intro
  const introP = intro();
  const tok = await Tok.load();
  if (tok) {
    Net.configure({ url: serverUrl(), token: tok.token }); // connect during the intro (wakes a sleeping server)
    Net.connect();
  }
  await introP;
  shell.hidden = false;
  if (!tok) { showAuth(); return; }
  view().innerHTML = `<div class="cx-auth"><div class="cx-card" style="text-align:center">${BRAND}<p class="cx-sub" style="margin-top:18px"><span class="cx-spin" style="display:inline-block;vertical-align:-2px"></span> Mă conectez…</p></div></div>`;
  await startSession(tok.token);
}
W.CerulApp = App;
if (D.readyState === "loading") D.addEventListener("DOMContentLoaded", main); else main();
})();
