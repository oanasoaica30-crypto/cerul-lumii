/* Cerul Lumii — Electron main process (Windows desktop app).
 * - loads app/index.html (local game files + shim), full screen from the start (F11 / Esc / ⛶ toggle)
 * - server URL: --server=wss://… > env CERUL_SERVER > <userData>/config.json > default baked into app/index.html
 * - "Ține-mă minte": the login token is encrypted with Electron safeStorage (Windows DPAPI) in <userData>/session.bin
 * - no auto-update yet (friends download a new installer from the GitHub Release)
 */
"use strict";
const { app, BrowserWindow, ipcMain, Menu, shell, safeStorage } = require("electron");
const path = require("path");
const fs = require("fs");

const MULTI = process.argv.includes("--multi");   // allow 2 copies on one PC (testing two accounts)
if (!MULTI && !app.requestSingleInstanceLock()) { app.quit(); }
app.setAppUserModelId("ro.damian.cerullumii");

const userFile = n => path.join(app.getPath("userData"), n);
function readConfig() { try { return JSON.parse(fs.readFileSync(userFile("config.json"), "utf8")); } catch (e) { return {}; } }
function writeConfig(c) { fs.mkdirSync(app.getPath("userData"), { recursive: true }); fs.writeFileSync(userFile("config.json"), JSON.stringify(c, null, 2)); }
function serverOverride() {
  const arg = process.argv.find(a => a.startsWith("--server="));
  if (arg) return arg.slice(9);
  if (process.env.CERUL_SERVER) return process.env.CERUL_SERVER;
  return readConfig().server || "";
}

let win = null;
function createWindow() {
  win = new BrowserWindow({
    width: 1440, height: 900, minWidth: 980, minHeight: 620,
    fullscreen: true, show: false, backgroundColor: "#06121f",
    title: "Cerul Lumii", icon: path.join(__dirname, "app", "icon.png"), autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: false,
      backgroundThrottling: false, // the host's window runs the game clock even when minimized
    },
  });
  Menu.setApplicationMenu(null);
  win.once("ready-to-show", () => win.show());
  win.loadFile(path.join(__dirname, "app", "index.html"));

  win.webContents.on("before-input-event", (e, input) => {
    if (input.type !== "keyDown") return;
    if (input.key === "F11") { e.preventDefault(); win.setFullScreen(!win.isFullScreen()); }
    if (input.key === "F12" && process.argv.includes("--dev")) { e.preventDefault(); win.webContents.toggleDevTools(); }
    if (input.key === "F5" || (input.control && input.key.toLowerCase() === "r")) { e.preventDefault(); win.webContents.reload(); }
  });
  // links open in the normal browser; the app never navigates away from its own files
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: "deny" }; });
  win.webContents.on("will-navigate", (e, url) => { if (!url.startsWith("file:")) { e.preventDefault(); if (/^https?:/.test(url)) shell.openExternal(url); } });
  win.on("closed", () => { win = null; });
}

/* ---------------- bridge (see preload.js) ---------------- */
ipcMain.on("cerul:getConfig", e => { e.returnValue = { server: serverOverride(), version: app.getVersion() }; });
ipcMain.handle("cerul:setServer", (e, url) => { const c = readConfig(); c.server = String(url || "").trim(); writeConfig(c); return true; });
ipcMain.handle("cerul:fullscreen", (e, on) => { if (win) win.setFullScreen(on === undefined ? !win.isFullScreen() : !!on); return win ? win.isFullScreen() : false; });
ipcMain.handle("cerul:quit", () => app.quit());
ipcMain.handle("cerul:token:save", (e, token) => {
  const data = safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(String(token)) : Buffer.from("plain:" + token);
  fs.mkdirSync(app.getPath("userData"), { recursive: true });
  fs.writeFileSync(userFile("session.bin"), data);
  return true;
});
ipcMain.handle("cerul:token:load", () => {
  try {
    const buf = fs.readFileSync(userFile("session.bin"));
    if (buf.slice(0, 6).toString() === "plain:") return buf.slice(6).toString();
    return safeStorage.decryptString(buf);
  } catch (e) { return null; }
});
ipcMain.handle("cerul:token:clear", () => { try { fs.unlinkSync(userFile("session.bin")); } catch (e) {} return true; });

app.on("second-instance", () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.whenReady().then(createWindow);
app.on("window-all-closed", () => app.quit());
