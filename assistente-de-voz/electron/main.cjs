// Processo principal: janela, bandeja do sistema, protocolo app:// (serve a interface e o modelo de voz)
// e a ponte (IPC) para o motor em electron/engine. O áudio e o reconhecimento de voz ficam na interface.
const { app, BrowserWindow, Tray, Menu, dialog, ipcMain, shell, protocol, net, session, nativeImage } = require("electron");
const { execFile, spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const { criarConfig } = require("./engine/config.cjs");
const { criarAcoes } = require("./engine/acoes.cjs");
const { criarCerebro } = require("./engine/cerebro.cjs");
const { pastasConhecidas } = require("./engine/pastas.cjs");
const programas = require("./engine/programas.cjs");
const janelas = require("./engine/janelas.cjs");
const modelo = require("./engine/modelo.cjs");
const { EXEMPLOS } = require("./engine/comandos.cjs");

protocol.registerSchemesAsPrivileged([{ scheme: "app", privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }]);

let janela = null;
let tray = null;
let saindo = false;
let cancelarDownload = false;
let baixando = false;

const iniciouOculto = process.argv.includes("--oculto");
const MIME = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".wasm": "application/wasm", ".json": "application/json", ".onnx": "application/octet-stream", ".svg": "image/svg+xml", ".png": "image/png", ".txt": "text/plain" };

const pastaDados = () => app.getPath("userData");
const pastaModelos = () => path.join(pastaDados(), "modelos");
let config;
let acoes;
let cerebro;

function iniciarMotor() {
  config = criarConfig(path.join(pastaDados(), "config.json"));
  const dir = (n) => {
    try {
      return app.getPath(n);
    } catch {
      return "";
    }
  };
  acoes = criarAcoes({
    config,
    janelas,
    ignorarPid: process.pid,
    abrirCaminho: (p) => Promise.race([shell.openPath(p), new Promise((r) => setTimeout(() => r("O sistema não respondeu ao abrir."), 8000))]),
    abrirUrl,
    executarProcesso: (arquivo, args) =>
      new Promise((resolve) => {
        const p = spawn(arquivo, args, { detached: true, stdio: "ignore" });
        p.on("error", () => resolve());
        p.unref();
        setTimeout(resolve, 150);
      }),
    listarProgramas: programas.listarInstalados,
    pastasConhecidas: pastasConhecidas({ HOME: dir("home"), DESKTOP: dir("desktop"), DOCUMENTS: dir("documents"), DOWNLOADS: dir("downloads"), PICTURES: dir("pictures"), VIDEOS: dir("videos"), MUSIC: dir("music") }),
  });
  cerebro = criarCerebro({ config, acoes });
}

const EXE_NAVEGADOR = { chrome: "chrome", edge: "msedge", firefox: "firefox", brave: "brave", opera: "opera" };
function abrirUrl(url, navegador) {
  if (!/^https?:\/\//i.test(url)) return Promise.resolve();
  return new Promise((resolve) => {
    const exe = EXE_NAVEGADOR[navegador];
    if (exe && process.platform === "win32") {
      execFile("cmd.exe", ["/c", "start", "", exe, url], { windowsHide: true }, (erro) => {
        if (erro) shell.openExternal(url);
        resolve();
      });
    } else {
      shell.openExternal(url).finally(resolve);
    }
  });
}

// ---------------------------------------------------------------- protocolo app://
function registrarProtocolo() {
  const raizDist = path.join(__dirname, "..", "dist");
  protocol.handle("app", async (req) => {
    const url = new URL(req.url);
    let rel = decodeURIComponent(url.pathname);
    if (rel === "/" || rel === "") rel = "/index.html";
    let arquivo;
    if (rel.startsWith("/modelos/")) arquivo = path.join(pastaModelos(), rel.slice("/modelos/".length));
    else arquivo = path.join(raizDist, rel);
    const base = rel.startsWith("/modelos/") ? pastaModelos() : raizDist;
    const abs = path.resolve(arquivo);
    if (!abs.startsWith(path.resolve(base) + path.sep) || !fs.existsSync(abs) || fs.statSync(abs).isDirectory()) return new Response("Não encontrado", { status: 404 });
    const r = await net.fetch(pathToFileURL(abs).toString());
    const h = new Headers(r.headers);
    h.set("Content-Type", MIME[path.extname(abs).toLowerCase()] || "application/octet-stream");
    // permite WebAssembly com várias threads (Whisper mais rápido)
    h.set("Cross-Origin-Opener-Policy", "same-origin");
    h.set("Cross-Origin-Embedder-Policy", "require-corp");
    h.set("Cross-Origin-Resource-Policy", "same-origin");
    return new Response(r.body, { status: r.status, headers: h });
  });
}

// ---------------------------------------------------------------- janela e bandeja
function criarJanela() {
  janela = new BrowserWindow({
    width: 1180,
    height: 800,
    minWidth: 900,
    minHeight: 640,
    show: false,
    title: "Assistente de Voz",
    backgroundColor: "#0e1116",
    autoHideMenuBar: true,
    icon: path.join(__dirname, "icon.png"),
    webPreferences: { preload: path.join(__dirname, "preload.cjs"), contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: false },
  });
  Menu.setApplicationMenu(null);
  janela.once("ready-to-show", () => {
    if (!iniciouOculto) janela.show();
  });
  janela.on("close", (e) => {
    if (!saindo && config.get().minimizarParaBandeja) {
      e.preventDefault();
      janela.hide();
    }
  });
  janela.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  janela.webContents.on("will-navigate", (e, url) => {
    if (!url.startsWith("app://") && !url.startsWith(process.env.VITE_DEV_SERVER_URL || "\0")) e.preventDefault();
  });
  if (process.env.VITE_DEV_SERVER_URL) janela.loadURL(process.env.VITE_DEV_SERVER_URL);
  else janela.loadURL("app://local/index.html");
}

function criarBandeja() {
  tray = new Tray(nativeImage.createFromPath(path.join(__dirname, "icon.png")).resize({ width: 16, height: 16 }));
  tray.setToolTip("Assistente de Voz");
  const mostrar = () => {
    janela.show();
    janela.focus();
  };
  tray.on("click", mostrar);
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Abrir o assistente", click: mostrar },
      { label: "Pausar / retomar a escuta", click: () => janela.webContents.send("escuta:alternar") },
      { type: "separator" },
      { label: "Sair", click: () => ((saindo = true), app.quit()) },
    ]),
  );
}

const enviar = (canal, dados) => {
  if (janela && !janela.isDestroyed()) janela.webContents.send(canal, dados);
};

// ---------------------------------------------------------------- IPC
ipcMain.handle("app:info", () => ({ versao: app.getVersion(), plataforma: process.platform, exemplos: EXEMPLOS, pastaModelos: pastaModelos() }));
ipcMain.handle("config:obter", () => config.get());
ipcMain.handle("config:salvar", (_e, parcial) => {
  const antes = config.get();
  const nova = config.set(parcial || {});
  if (nova.pastaRaiz !== antes.pastaRaiz || JSON.stringify(nova.ignorar) !== JSON.stringify(antes.ignorar)) acoes.reindexar().catch(() => {});
  if (nova.iniciarComWindows !== antes.iniciarComWindows) app.setLoginItemSettings({ openAtLogin: nova.iniciarComWindows, args: ["--oculto"] });
  return nova;
});

ipcMain.handle("voz:ouvir", (_e, texto, origem, quando) => cerebro.ouvir(String(texto || ""), { origem: origem === "texto" ? "texto" : "voz", quando: Number.isFinite(quando) ? quando : undefined }));
ipcMain.handle("voz:estado", () => ({ ...cerebro.estado(), contexto: acoes.contexto() }));
ipcMain.handle("voz:dormir", () => cerebro.dormir());

ipcMain.handle("pastas:escolher", async () => {
  const r = await dialog.showOpenDialog(janela, { title: "Escolha a pasta raiz (a que contém as pastas das marcas)", properties: ["openDirectory"] });
  if (r.canceled || !r.filePaths[0]) return null;
  return r.filePaths[0];
});
ipcMain.handle("pastas:reindexar", () => acoes.reindexar());
ipcMain.handle("pastas:resumo", async () => {
  const idx = acoes.indiceAtual() || (config.get().pastaRaiz ? (await acoes.reindexar(), acoes.indiceAtual()) : null);
  if (!idx) return null;
  return { raiz: idx.raiz, erro: idx.erro, total: idx.totalRefs, marcas: idx.marcas.map((m) => ({ nome: m.nome, refs: m.refs.length })) };
});
ipcMain.handle("programas:listar", async (_e, forcar) => {
  try {
    return await acoes.programas(!!forcar);
  } catch (e) {
    return { erro: String((e && e.message) || e) };
  }
});
ipcMain.handle("arquivo:escolher", async () => {
  const r = await dialog.showOpenDialog(janela, { title: "Escolha o programa ou atalho", properties: ["openFile"], filters: [{ name: "Programas e atalhos", extensions: ["lnk", "exe", "url", "bat", "cmd"] }, { name: "Todos os arquivos", extensions: ["*"] }] });
  return r.canceled || !r.filePaths[0] ? null : r.filePaths[0];
});

ipcMain.handle("modelo:status", () => {
  const chave = config.get().modelo;
  return { chave, pronto: modelo.modeloPronto(pastaModelos(), chave), baixando };
});
ipcMain.handle("modelo:baixar", async () => {
  if (baixando) return { ok: false, erro: "Já está baixando." };
  baixando = true;
  cancelarDownload = false;
  const chave = config.get().modelo;
  try {
    await modelo.baixarModelo(pastaModelos(), chave, {
      fetchFn: (u) => net.fetch(u),
      onProgresso: (p) => enviar("modelo:progresso", p),
      cancelado: () => cancelarDownload,
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, erro: String((e && e.message) || e) };
  } finally {
    baixando = false;
  }
});
ipcMain.handle("modelo:cancelar", () => {
  cancelarDownload = true;
});
ipcMain.handle("app:sair", () => {
  saindo = true;
  app.quit();
});
ipcMain.handle("app:esconder", () => janela.hide());

// ---------------------------------------------------------------- ciclo de vida
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (janela) {
      janela.show();
      janela.focus();
    }
  });
  app.whenReady().then(() => {
    iniciarMotor();
    registrarProtocolo();
    session.defaultSession.setPermissionRequestHandler((_wc, permissao, cb) => cb(permissao === "media"));
    session.defaultSession.setPermissionCheckHandler((_wc, permissao) => permissao === "media");
    criarJanela();
    criarBandeja();
    app.on("activate", () => janela && janela.show());
  });
  app.on("before-quit", () => (saindo = true));
  app.on("window-all-closed", () => {
    if (saindo || !config.get().minimizarParaBandeja) app.quit();
  });
}
