// Monitor de Demandas dentro da Central: liga o WhatsApp Web (numa janela própria, para dar pra
// escanear o QR Code), o leitor (electron/monitor/leitor.cjs) e o motor de regras
// (electron/monitor/motor.cjs), e manda os eventos (log, lista, avisos) para a aba da Central.
const { BrowserWindow, Notification, app } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const { Navegador } = require("./monitor/leitor.cjs");
const { Processador } = require("./monitor/motor.cjs");
const { RegistroDoDia } = require("./monitor/registro.cjs");
const { carregarConfig, salvarConfig, carregarRegrasReferencia, carregarMarcasDoArquivo, CONFIG_PADRAO } = require("./monitor/config.cjs");
const { textoDoAviso } = require("./monitor/logica-pura.cjs");

const INTERVALO_CICLO_MS = 6000;

let config = { ...CONFIG_PADRAO };
let nav = null;
let processador = null;
let registro = null;
let timer = null;
let rodando = false;
let janelaPrincipal = null;
let pastaDados = "";

function pastaDadosMonitor() {
  return path.join(pastaDados, "monitor-whatsapp");
}

function enviar(canal, dado) {
  if (janelaPrincipal && !janelaPrincipal.isDestroyed()) janelaPrincipal.webContents.send(canal, dado);
}

function aoEvento(tipo, dado) {
  if (tipo === "log" || tipo === "status") {
    registro?.escrever(tipo === "status" ? `STATUS: ${dado}` : dado);
    enviar("monitor:log", { tipo, texto: dado, quando: Date.now() });
  } else if (tipo === "lista") {
    enviar("monitor:listaMudou", null);
  } else if (tipo === "salvo") {
    enviar("monitor:salvo", dado);
    if (config.notificar) {
      try {
        const [titulo, l1, l2] = textoDoAviso(dado);
        new Notification({ title: titulo, body: `${l1}\n${l2}`, silent: !config.som }).show();
      } catch { /* notificação é só um extra; não pode travar o monitor */ }
    }
  }
}

async function iniciar() {
  if (rodando) return { ok: true };
  if (!config.pastaBase) return { ok: false, erro: "Escolha a pasta onde salvar as demandas antes de iniciar." };
  if (!config.grupos.length) return { ok: false, erro: "Adicione pelo menos um grupo antes de iniciar." };
  try {
    registro = new RegistroDoDia(pastaDadosMonitor());
    nav = new Navegador({ partition: "persist:monitor-whatsapp", show: true });
    await nav.iniciar();
    registro.escrever("Monitor iniciado");
    enviar("monitor:log", { tipo: "log", texto: "Monitor iniciado. Se pedir, escaneie o QR Code na janela do WhatsApp.", quando: Date.now() });

    const regrasRef = carregarRegrasReferencia(pastaDadosMonitor());
    const marcasExtras = carregarMarcasDoArquivo(pastaDadosMonitor());
    processador = new Processador(config, nav, { evento: aoEvento, regrasRef, marcasExtras });

    rodando = true;
    enviar("monitor:estado", { rodando: true });
    timer = setInterval(async () => {
      if (!rodando || !nav?.vivo()) return;
      try {
        await processador.ciclo();
      } catch (e) {
        aoEvento("log", `Erro no ciclo do monitor: ${e.message || e}`);
      }
    }, INTERVALO_CICLO_MS);
    return { ok: true };
  } catch (e) {
    rodando = false;
    return { ok: false, erro: `Não consegui abrir o WhatsApp Web: ${e.message || e}` };
  }
}

function parar() {
  rodando = false;
  if (timer) clearInterval(timer);
  timer = null;
  if (nav) { nav.fechar(); nav = null; }
  processador = null;
  enviar("monitor:estado", { rodando: false });
  return { ok: true };
}

function estado() {
  return { rodando };
}

function listaDoDia(nomeGrupo) {
  if (!processador) return [];
  const lista = processador.listas.get(nomeGrupo);
  return lista ? lista.ordenados() : [];
}

function marcarFeito(nomeGrupo, chave, feito) {
  const lista = processador?.listas.get(nomeGrupo);
  lista?.marcarFeito(chave, feito);
}

function logDeHoje() {
  return registro ? registro.ler() : "";
}

function iniciarModulo({ janela, pastaDadosApp }) {
  janelaPrincipal = janela;
  pastaDados = pastaDadosApp;
  config = carregarConfig(pastaDadosMonitor());
}

function obterConfig() {
  return config;
}

function salvarConfigMonitor(novo) {
  config = { ...config, ...novo };
  salvarConfig(pastaDadosMonitor(), config);
  if (processador) processador.cfg = config;
  return config;
}

function abrirPastaDoDia(nomeGrupo) {
  const { shell } = require("electron");
  const { pastaDoDia } = require("./monitor/armazenamento.cjs");
  try {
    const p = pastaDoDia(config.pastaBase, nomeGrupo);
    shell.openPath(p);
  } catch { /* ok */ }
}

function encerrarTudo() {
  parar();
  try { require("./monitor/ocr.cjs").encerrarMotor(); } catch { /* ok */ }
}

module.exports = {
  iniciarModulo, obterConfig, salvarConfigMonitor, iniciar, parar, estado,
  listaDoDia, marcarFeito, logDeHoje, abrirPastaDoDia, encerrarTudo,
};
