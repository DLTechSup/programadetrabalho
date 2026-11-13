const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("overlay", {
  aoIniciar: (cb) => ipcRenderer.on("captura:iniciar", (_e, pos) => cb(pos)),
  aoMover: (cb) => ipcRenderer.on("captura:mover", (_e, pos) => cb(pos)),
});
