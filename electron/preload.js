/* Cerul Lumii — preload: a tiny, explicit bridge from the page to the main process (window.cerulDesktop). */
"use strict";
const { contextBridge, ipcRenderer } = require("electron");
const cfg = ipcRenderer.sendSync("cerul:getConfig");

contextBridge.exposeInMainWorld("cerulDesktop", {
  server: cfg.server || "",          // "" = use the default baked into app/index.html
  version: cfg.version,
  setServer: url => ipcRenderer.invoke("cerul:setServer", url),
  toggleFullscreen: () => ipcRenderer.invoke("cerul:fullscreen"),
  setFullscreen: on => ipcRenderer.invoke("cerul:fullscreen", !!on),
  quit: () => ipcRenderer.invoke("cerul:quit"),
  token: {
    load: () => ipcRenderer.invoke("cerul:token:load"),
    save: t => ipcRenderer.invoke("cerul:token:save", t),
    clear: () => ipcRenderer.invoke("cerul:token:clear"),
  },
});
