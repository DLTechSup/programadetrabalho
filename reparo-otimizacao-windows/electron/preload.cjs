const { contextBridge, ipcRenderer } = require("electron");

const chamar = (canal) => (...args) => ipcRenderer.invoke(canal, ...args);
const ouvir = (canal) => (cb) => {
  const f = (_e, dados) => cb(dados);
  ipcRenderer.on(canal, f);
  return () => ipcRenderer.removeListener(canal, f);
};

contextBridge.exposeInMainWorld("api", {
  info: chamar("app:info"),
  diagnosticar: chamar("sistema:diagnosticar"),
  escanearLimpeza: chamar("limpeza:escanear"),
  escanearDisco: chamar("disco:escanear"),
  cancelarScan: chamar("disco:cancelar"),
  aoProgressoScan: ouvir("disco:progresso"),
  executar: chamar("tarefas:executar"),
  cancelarExecucao: chamar("tarefas:cancelar"),
  aoProgressoExecucao: ouvir("tarefas:progresso"),
  processos: chamar("memoria:processos"),
  encerrarProcesso: chamar("memoria:encerrar"),
  listarInicializacao: chamar("inicializacao:listar"),
  aplicarInicializacao: chamar("inicializacao:aplicar"),
  testarInternet: chamar("rede:testar"),
  enviarParaLixeira: chamar("arquivos:lixeira"),
  mostrarNaPasta: chamar("shell:mostrar"),
  abrirPasta: chamar("shell:abrirPasta"),
  reiniciarWindows: chamar("sistema:reiniciar"),
  cancelarReinicio: chamar("sistema:cancelarReinicio"),
  salvarRelatorio: chamar("relatorio:salvar"),
});
