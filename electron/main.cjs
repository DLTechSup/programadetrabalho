// Processo principal do Electron: janela, diálogos de arquivo e persistência
// do banco de cores. Toda a lógica de negócio fica no renderer (src/core).
const { app, BrowserWindow, dialog, ipcMain, shell, Menu } = require("electron");
const fs = require("node:fs");
const path = require("node:path");

const ARQUIVO_CORES = "cores_bling.json";
let janela = null;
let ultimaPasta = null;
let pastaRaizScan = null; // só se lê arquivo de dentro da pasta que o usuário escolheu

function caminhoCores() {
  return path.join(app.getPath("userData"), ARQUIVO_CORES);
}

/** Escrita atômica: grava num temporário e renomeia, pra nunca corromper o banco. */
function gravarSeguro(destino, conteudo) {
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  const tmp = `${destino}.tmp`;
  fs.writeFileSync(tmp, conteudo);
  fs.renameSync(tmp, destino);
}

function criarJanela() {
  janela = new BrowserWindow({
    width: 1240,
    height: 820,
    minWidth: 980,
    minHeight: 660,
    show: false,
    title: "GradeFácil",
    backgroundColor: "#0f1420",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  Menu.setApplicationMenu(null);
  janela.once("ready-to-show", () => janela.show());

  // nada de abrir janelas/links externos dentro do app
  janela.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  janela.webContents.on("will-navigate", (e, url) => {
    if (!url.startsWith("file://") && !url.startsWith(process.env.VITE_DEV_SERVER_URL || "\0")) e.preventDefault();
  });

  if (process.env.VITE_DEV_SERVER_URL) janela.loadURL(process.env.VITE_DEV_SERVER_URL);
  else janela.loadFile(path.join(__dirname, "..", "dist", "index.html"));
}

// ---------------------------------------------------------------- IPC
ipcMain.handle("arquivo:abrir", async () => {
  const r = await dialog.showOpenDialog(janela, {
    title: "Selecione o arquivo exportado do Bling",
    defaultPath: ultimaPasta || app.getPath("documents"),
    properties: ["openFile"],
    filters: [
      { name: "Planilhas Excel", extensions: ["xlsx", "xls"] },
      { name: "Todos os arquivos", extensions: ["*"] },
    ],
  });
  if (r.canceled || !r.filePaths[0]) return null;
  const caminho = r.filePaths[0];
  ultimaPasta = path.dirname(caminho);
  return { nome: path.basename(caminho), caminho, dados: fs.readFileSync(caminho) };
});

ipcMain.handle("arquivo:salvar", async (_e, nomeSugerido, dados) => {
  const r = await dialog.showSaveDialog(janela, {
    title: "Salvar planilha pronta para importar",
    defaultPath: path.join(ultimaPasta || app.getPath("documents"), nomeSugerido),
    filters: [{ name: "Planilha Excel", extensions: ["xlsx"] }],
  });
  if (r.canceled || !r.filePath) return null;
  fs.writeFileSync(r.filePath, Buffer.from(dados));
  ultimaPasta = path.dirname(r.filePath);
  return r.filePath;
});

ipcMain.handle("cores:carregar", () => {
  try {
    return fs.readFileSync(caminhoCores(), "utf-8");
  } catch {
    return null;
  }
});
ipcMain.handle("cores:salvar", (_e, json) => {
  gravarSeguro(caminhoCores(), json);
});
ipcMain.handle("cores:caminho", () => caminhoCores());
ipcMain.handle("cores:exportar", async (_e, json) => {
  const r = await dialog.showSaveDialog(janela, {
    title: "Exportar banco de cores",
    defaultPath: path.join(ultimaPasta || app.getPath("documents"), ARQUIVO_CORES),
    filters: [{ name: "JSON", extensions: ["json"] }],
  });
  if (r.canceled || !r.filePath) return null;
  fs.writeFileSync(r.filePath, json, "utf-8");
  return r.filePath;
});
ipcMain.handle("cores:importar", async () => {
  const r = await dialog.showOpenDialog(janela, {
    title: "Importar banco de cores (cores_bling.json)",
    defaultPath: ultimaPasta || app.getPath("documents"),
    properties: ["openFile"],
    filters: [{ name: "JSON", extensions: ["json"] }],
  });
  if (r.canceled || !r.filePaths[0]) return null;
  return fs.readFileSync(r.filePaths[0], "utf-8");
});
/** Percorre raiz/Marca/Referência/arquivo.xlsx (qualquer profundidade) e lista as planilhas. */
function listarPlanilhas(raiz) {
  const achados = [];
  const andar = (dir) => {
    let itens;
    try {
      itens = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const it of itens) {
      const cam = path.join(dir, it.name);
      if (it.isDirectory()) andar(cam);
      else if (/\.xlsx?$/i.test(it.name) && !it.name.startsWith("~$")) {
        const partes = path.relative(raiz, cam).split(path.sep);
        achados.push({
          nome: it.name,
          caminho: cam,
          marca: partes.length > 1 ? partes[0] : "",
          referencia: partes.length > 2 ? partes[1] : "",
        });
      }
    }
  };
  andar(raiz);
  return achados;
}

ipcMain.handle("scan:escolher", async () => {
  const r = await dialog.showOpenDialog(janela, {
    title: "Escolha a pasta raiz (que contém as pastas das marcas)",
    defaultPath: ultimaPasta || app.getPath("documents"),
    properties: ["openDirectory"],
  });
  if (r.canceled || !r.filePaths[0]) return null;
  pastaRaizScan = path.resolve(r.filePaths[0]);
  ultimaPasta = pastaRaizScan;
  return { nome: path.basename(pastaRaizScan), arquivos: listarPlanilhas(pastaRaizScan) };
});

ipcMain.handle("scan:ler", (_e, caminho) => {
  const alvo = path.resolve(String(caminho));
  if (!pastaRaizScan || !alvo.startsWith(pastaRaizScan + path.sep)) throw new Error("Arquivo fora da pasta escolhida.");
  return fs.readFileSync(alvo);
});

ipcMain.handle("shell:mostrar", (_e, caminho) => {
  if (typeof caminho === "string" && fs.existsSync(caminho)) shell.showItemInFolder(caminho);
});
ipcMain.handle("app:versao", () => app.getVersion());

// ---------------------------------------------------------------- ciclo de vida
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (janela) {
      if (janela.isMinimized()) janela.restore();
      janela.focus();
    }
  });
  app.whenReady().then(() => {
    criarJanela();
    app.on("activate", () => BrowserWindow.getAllWindows().length === 0 && criarJanela());
  });
  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}
