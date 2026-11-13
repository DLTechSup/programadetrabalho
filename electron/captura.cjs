// Captura de Tela dentro da Central: atalho com os dois botões do mouse (arma), depois clique e
// arraste com o esquerdo (seleciona). Só roda de verdade no Windows (gancho global de mouse +
// captura de tela); fora do Windows fica desligado sem quebrar o resto do programa.
const { BrowserWindow, Notification, app, clipboard, desktopCapturer, screen, shell } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const { GatilhoCaptura, areaValida, caminhoSemSobrescrever, nomeArquivo, normalizarArea } = require("./captura-nucleo.cjs");

const ARQUIVO_CONFIG = "captura-tela-config.json";
const EH_WINDOWS = process.platform === "win32";

const CONFIG_PADRAO = {
  pastaDestino: "",
  copiarParaAreaTransferencia: true,
  som: true,
  abrirPastaNoAviso: true,
  ativo: true,
  prefixoArquivo: "Captura",
};

let config = { ...CONFIG_PADRAO };
let overlay = null;
let gatilho = null;
let uiohookIniciado = false;
let inicioSelecao = null; // {x, y} em coordenadas absolutas de tela, guardado ao iniciar a seleção
let origemOverlay = { x: 0, y: 0 }; // canto superior esquerdo da área virtual coberta pelo overlay

function caminhoConfig() {
  return path.join(app.getPath("userData"), ARQUIVO_CONFIG);
}

function carregarConfig() {
  try {
    const lido = JSON.parse(fs.readFileSync(caminhoConfig(), "utf-8"));
    config = { ...CONFIG_PADRAO, ...Object.fromEntries(Object.entries(lido).filter(([k]) => k in CONFIG_PADRAO)) };
  } catch {
    config = { ...CONFIG_PADRAO };
  }
  if (!config.pastaDestino) config.pastaDestino = path.join(app.getPath("pictures"), "Capturas de Tela");
  return config;
}

function salvarConfig(novo) {
  config = { ...config, ...novo };
  fs.mkdirSync(path.dirname(caminhoConfig()), { recursive: true });
  fs.writeFileSync(caminhoConfig(), JSON.stringify(config, null, 2), "utf-8");
  return config;
}

function obterConfig() {
  return config;
}

/** Retângulo (em coordenadas absolutas de tela) que cobre todos os monitores. */
function areaDeTodosOsMonitores() {
  const displays = screen.getAllDisplays();
  const esquerda = Math.min(...displays.map((d) => d.bounds.x));
  const topo = Math.min(...displays.map((d) => d.bounds.y));
  const direita = Math.max(...displays.map((d) => d.bounds.x + d.bounds.width));
  const baixo = Math.max(...displays.map((d) => d.bounds.y + d.bounds.height));
  return { x: esquerda, y: topo, width: direita - esquerda, height: baixo - topo };
}

function criarOverlay() {
  const area = areaDeTodosOsMonitores();
  origemOverlay = { x: area.x, y: area.y };
  overlay = new BrowserWindow({
    x: area.x,
    y: area.y,
    width: area.width,
    height: area.height,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    focusable: false,
    resizable: false,
    movable: false,
    show: false,
    webPreferences: { preload: path.join(__dirname, "overlay-preload.cjs") },
  });
  overlay.setIgnoreMouseEvents(true); // a seleção é feita pelo gancho global, não pela janela
  overlay.setAlwaysOnTop(true, "screen-saver");
  overlay.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  overlay.loadFile(path.join(__dirname, "overlay.html"));
  return overlay;
}

function enviarOverlay(canal, payload) {
  if (overlay && !overlay.isDestroyed()) overlay.webContents.send(canal, payload);
}

function destruirOverlay() {
  if (overlay && !overlay.isDestroyed()) overlay.close();
  overlay = null;
}

async function capturarRegiao(area) {
  const displays = screen.getAllDisplays();
  // Escolhe o monitor que contém o centro da seleção (cobre o caso comum de uma seleção dentro de um só monitor).
  const cx = (area.esquerda + area.direita) / 2;
  const cy = (area.topo + area.baixo) / 2;
  const alvo = displays.find((d) => cx >= d.bounds.x && cx < d.bounds.x + d.bounds.width &&
                                     cy >= d.bounds.y && cy < d.bounds.y + d.bounds.height) || displays[0];
  const fontes = await desktopCapturer.getSources({
    types: ["screen"],
    thumbnailSize: { width: Math.round(alvo.bounds.width * alvo.scaleFactor), height: Math.round(alvo.bounds.height * alvo.scaleFactor) },
  });
  const fonte = fontes.find((f) => String(f.display_id) === String(alvo.id)) || fontes[0];
  if (!fonte) return null;
  const imagemTela = fonte.thumbnail;
  const tam = imagemTela.getSize();
  // mapeia a seleção (coordenadas absolutas de tela) para pixels físicos dentro da imagem do monitor escolhido
  const escalaX = tam.width / alvo.bounds.width;
  const escalaY = tam.height / alvo.bounds.height;
  const recorte = {
    x: Math.max(0, Math.round((area.esquerda - alvo.bounds.x) * escalaX)),
    y: Math.max(0, Math.round((area.topo - alvo.bounds.y) * escalaY)),
    width: Math.min(tam.width, Math.round((area.direita - area.esquerda) * escalaX)),
    height: Math.min(tam.height, Math.round((area.baixo - area.topo) * escalaY)),
  };
  if (recorte.width <= 0 || recorte.height <= 0) return null;
  return imagemTela.crop(recorte);
}

async function salvarCaptura(imagem) {
  const pasta = config.pastaDestino;
  fs.mkdirSync(pasta, { recursive: true });
  const nomeBase = nomeArquivo(new Date(), config.prefixoArquivo);
  const nomeFinal = caminhoSemSobrescrever(nomeBase, (n) => fs.existsSync(path.join(pasta, n)));
  const destino = path.join(pasta, nomeFinal);
  fs.writeFileSync(destino, imagem.toPNG());
  if (config.copiarParaAreaTransferencia) clipboard.writeImage(imagem);
  if (config.som) shell.beep();
  try {
    new Notification({ title: "Captura salva", body: nomeFinal, silent: true }).show();
  } catch {
    /* notificações podem não estar disponíveis; a captura já foi salva de qualquer forma */
  }
  if (config.abrirPastaNoAviso) shell.showItemInFolder(destino);
  return destino;
}

function iniciarGatilho() {
  if (!EH_WINDOWS || gatilho) return;
  gatilho = new GatilhoCaptura(
    () => { // ao armar
      if (!config.ativo) return gatilho.cancelar();
      criarOverlay();
      overlay.once("ready-to-show", () => overlay.show());
    },
    (x, y) => { // ao iniciar seleção
      inicioSelecao = { x, y };
      enviarOverlay("captura:iniciar", { x: x - origemOverlay.x, y: y - origemOverlay.y });
    },
    (x, y) => { // ao mover
      enviarOverlay("captura:mover", { x: x - origemOverlay.x, y: y - origemOverlay.y });
    },
    async (x, y) => { // ao finalizar
      destruirOverlay();
      if (!inicioSelecao) return;
      const area = normalizarArea(inicioSelecao.x, inicioSelecao.y, x, y);
      inicioSelecao = null;
      if (!areaValida(area)) return;
      try {
        const imagem = await capturarRegiao(area);
        if (imagem) await salvarCaptura(imagem);
      } catch {
        /* uma falha na captura não deve derrubar o resto da Central */
      }
    },
    () => { // ao cancelar
      inicioSelecao = null;
      destruirOverlay();
    },
  );

  try {
    const { uIOhook } = require("uiohook-napi");
    uIOhook.on("mousedown", (e) => gatilho.clique(e.x, e.y, e.button === 2 ? "direito" : "esquerdo", true));
    uIOhook.on("mouseup", (e) => gatilho.clique(e.x, e.y, e.button === 2 ? "direito" : "esquerdo", false));
    uIOhook.on("mousemove", (e) => gatilho.mover(e.x, e.y));
    uIOhook.start();
    uiohookIniciado = true;
  } catch {
    /* sem o gancho global, a captura por atalho de mouse fica desligada; o resto da Central segue normal */
  }
}

function pararGatilho() {
  if (uiohookIniciado) {
    try {
      require("uiohook-napi").uIOhook.stop();
    } catch {
      /* ok */
    }
    uiohookIniciado = false;
  }
  destruirOverlay();
}

module.exports = { carregarConfig, salvarConfig, obterConfig, iniciarGatilho, pararGatilho };
