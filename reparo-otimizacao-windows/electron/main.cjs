// Processo principal do Electron: janela e ponte (IPC) para o motor em electron/engine.
// A interface só envia IDs e comandos permitidos; nenhum caminho de limpeza vem do renderer.
const { app, BrowserWindow, dialog, ipcMain, shell, Menu } = require("electron");
const fs = require("node:fs");
const path = require("node:path");

const { ps, executar: executarPrograma } = require("./engine/ps.cjs");
const { escanearDisco } = require("./engine/scanner.cjs");
const { montarEnv, escanearLimpeza } = require("./engine/limpeza.cjs");
const { executar } = require("./engine/executor.cjs");
const sistema = require("./engine/sistema.cjs");
const inicializacao = require("./engine/inicializacao.cjs");
const { testarInternet } = require("./engine/rede.cjs");

let janela = null;
let cancelarScan = false;
let cancelarExec = false;
let ocupado = null; // "scan" | "exec" — evita duas operações pesadas ao mesmo tempo
const arquivosDoScan = new Set(); // só estes arquivos podem ir para a Lixeira

const env = montarEnv();
const ctxTarefas = { env, ps, executar: executarPrograma };

function criarJanela() {
  janela = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 1000,
    minHeight: 680,
    show: false,
    title: "Reparo e Otimização do Windows",
    backgroundColor: "#0d1117",
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
  janela.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  janela.webContents.on("will-navigate", (e, url) => {
    if (!url.startsWith("file://") && !url.startsWith(process.env.VITE_DEV_SERVER_URL || "\0")) e.preventDefault();
  });
  if (process.env.VITE_DEV_SERVER_URL) janela.loadURL(process.env.VITE_DEV_SERVER_URL);
  else janela.loadFile(path.join(__dirname, "..", "dist", "index.html"));
}

const enviar = (canal, dados) => {
  if (janela && !janela.isDestroyed()) janela.webContents.send(canal, dados);
};

async function ehAdministrador() {
  if (process.platform !== "win32") return false;
  const r = await executarPrograma("net.exe", ["session"], { timeout: 8000 });
  return r.ok;
}

// ---------------------------------------------------------------- IPC
ipcMain.handle("app:info", async () => ({
  versao: app.getVersion(),
  plataforma: process.platform,
  admin: await ehAdministrador(),
}));

ipcMain.handle("sistema:diagnosticar", () => sistema.diagnosticar());

ipcMain.handle("limpeza:escanear", () => escanearLimpeza(env));

ipcMain.handle("disco:escanear", async () => {
  if (ocupado) throw new Error("Já existe uma operação em andamento.");
  ocupado = "scan";
  cancelarScan = false;
  arquivosDoScan.clear();
  try {
    const r = await escanearDisco(env.UNIDADE, {
      onProgresso: (p) => enviar("disco:progresso", p),
      cancelado: () => cancelarScan,
    });
    for (const a of r.maiores) arquivosDoScan.add(a.caminho);
    return r;
  } finally {
    ocupado = null;
  }
});
ipcMain.handle("disco:cancelar", () => {
  cancelarScan = true;
});

ipcMain.handle("tarefas:executar", async (_e, ids, opcoes) => {
  if (ocupado) throw new Error("Já existe uma operação em andamento.");
  if (!Array.isArray(ids) || !ids.length) return [];
  ocupado = "exec";
  cancelarExec = false;
  try {
    return await executar(ids.map(String), {
      ctx: ctxTarefas,
      pontoRestauracao: !!(opcoes && opcoes.pontoRestauracao),
      onEvento: (ev) => enviar("tarefas:progresso", ev),
      cancelado: () => cancelarExec,
    });
  } finally {
    ocupado = null;
  }
});
ipcMain.handle("tarefas:cancelar", () => {
  cancelarExec = true;
});

ipcMain.handle("memoria:processos", () => sistema.processos());
ipcMain.handle("memoria:encerrar", (_e, nome, pids) => sistema.encerrar(nome, pids));

ipcMain.handle("inicializacao:listar", () => inicializacao.listar());
ipcMain.handle("inicializacao:aplicar", (_e, itens) => inicializacao.aplicar(itens));

ipcMain.handle("rede:testar", () => testarInternet());

ipcMain.handle("arquivos:lixeira", async (_e, caminhos) => {
  const feitos = [];
  const falhas = [];
  for (const c of caminhos) {
    if (!arquivosDoScan.has(c)) {
      falhas.push(c);
      continue;
    }
    try {
      await shell.trashItem(c);
      arquivosDoScan.delete(c);
      feitos.push(c);
    } catch {
      falhas.push(c);
    }
  }
  return { feitos, falhas };
});

ipcMain.handle("shell:mostrar", (_e, caminho) => {
  if (typeof caminho === "string" && fs.existsSync(caminho)) shell.showItemInFolder(caminho);
});
ipcMain.handle("shell:abrirPasta", (_e, caminho) => {
  if (typeof caminho === "string" && fs.existsSync(caminho)) shell.openPath(caminho);
});

ipcMain.handle("sistema:reiniciar", async () => {
  await executarPrograma("shutdown.exe", ["/r", "/t", "30", "/c", "Reinício solicitado pelo Reparo e Otimização do Windows."]);
});
ipcMain.handle("sistema:cancelarReinicio", async () => {
  await executarPrograma("shutdown.exe", ["/a"]);
});

ipcMain.handle("relatorio:salvar", async (_e, texto) => {
  const r = await dialog.showSaveDialog(janela, {
    title: "Salvar relatório",
    defaultPath: path.join(app.getPath("documents"), `relatorio-reparo-${new Date().toISOString().slice(0, 10)}.txt`),
    filters: [{ name: "Texto", extensions: ["txt"] }],
  });
  if (r.canceled || !r.filePath) return null;
  fs.writeFileSync(r.filePath, "﻿" + String(texto), "utf-8");
  return r.filePath;
});

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
  app.on("window-all-closed", () => app.quit());
}
