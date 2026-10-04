const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  abrirArquivo: () => ipcRenderer.invoke("arquivo:abrir"),
  salvarArquivo: (nomeSugerido, dados) => ipcRenderer.invoke("arquivo:salvar", nomeSugerido, dados),
  carregarCores: () => ipcRenderer.invoke("cores:carregar"),
  salvarCores: (json) => ipcRenderer.invoke("cores:salvar", json),
  caminhoCores: () => ipcRenderer.invoke("cores:caminho"),
  exportarCores: (json) => ipcRenderer.invoke("cores:exportar", json),
  importarCores: () => ipcRenderer.invoke("cores:importar"),
  mostrarNaPasta: (caminho) => ipcRenderer.invoke("shell:mostrar", caminho),
  escolherPasta: () => ipcRenderer.invoke("scan:escolher"),
  lerDaPasta: (caminho) => ipcRenderer.invoke("scan:ler", caminho),
  versao: () => ipcRenderer.invoke("app:versao"),
});
