const { contextBridge, ipcRenderer } = require("electron");

const chamar = (canal) => (...args) => ipcRenderer.invoke(canal, ...args);
const ouvir = (canal) => (cb) => {
  const f = (_e, dados) => cb(dados);
  ipcRenderer.on(canal, f);
  return () => ipcRenderer.removeListener(canal, f);
};

contextBridge.exposeInMainWorld("api", {
  info: chamar("app:info"),
  obterConfig: chamar("config:obter"),
  salvarConfig: chamar("config:salvar"),
  ouvir: chamar("voz:ouvir"),
  estado: chamar("voz:estado"),
  dormir: chamar("voz:dormir"),
  acordar: chamar("voz:acordar"),
  statusAtalho: chamar("atalho:status"),
  aoAtencao: ouvir("escuta:atencao"),
  escolherPasta: chamar("pastas:escolher"),
  reindexar: chamar("pastas:reindexar"),
  resumoPastas: chamar("pastas:resumo"),
  listarProgramas: chamar("programas:listar"),
  escolherArquivo: chamar("arquivo:escolher"),
  statusModelo: chamar("modelo:status"),
  baixarModelo: chamar("modelo:baixar"),
  cancelarModelo: chamar("modelo:cancelar"),
  aoProgressoModelo: ouvir("modelo:progresso"),
  aoAlternarEscuta: ouvir("escuta:alternar"),
  sair: chamar("app:sair"),
  esconder: chamar("app:esconder"),
});
