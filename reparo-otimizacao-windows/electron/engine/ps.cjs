// Execução de comandos do Windows (PowerShell / programas) de forma segura:
// o script vai em Base64 (-EncodedCommand), então não há problema de aspas/acentos.
const { execFile } = require("node:child_process");

const PRELUDIO =
  "$ProgressPreference='SilentlyContinue';$ErrorActionPreference='Stop';" +
  "[Console]::OutputEncoding=[System.Text.Encoding]::UTF8;$OutputEncoding=[System.Text.Encoding]::UTF8;";

/** Decodifica a saída: programas como sfc.exe/chkdsk escrevem em UTF-16 (com bytes nulos). */
function decodificar(buf) {
  if (!buf || !buf.length) return "";
  let nulos = 0;
  const amostra = Math.min(buf.length, 400);
  for (let i = 0; i < amostra; i++) if (buf[i] === 0) nulos++;
  const texto = nulos > amostra / 4 ? buf.toString("utf16le") : buf.toString("utf8");
  return texto.replace(/^\uFEFF/, "").replace(/\r/g, "");
}

function executar(arquivo, args, { timeout = 120000 } = {}) {
  return new Promise((resolve) => {
    if (process.platform !== "win32") {
      resolve({ ok: false, code: -1, stdout: "", stderr: "Disponível somente no Windows." });
      return;
    }
    execFile(
      arquivo,
      args,
      { encoding: "buffer", windowsHide: true, timeout, maxBuffer: 128 * 1024 * 1024 },
      (erro, stdout, stderr) => {
        const code = erro ? (typeof erro.code === "number" ? erro.code : -1) : 0;
        resolve({
          ok: !erro,
          code,
          stdout: decodificar(stdout).trim(),
          stderr: (decodificar(stderr) || (erro && erro.killed ? "Tempo esgotado." : "")).trim(),
        });
      },
    );
  });
}

function codificar(script) {
  return Buffer.from(PRELUDIO + script, "utf16le").toString("base64");
}

/** Roda um script PowerShell. Lança erro se falhar (com a mensagem do PowerShell). */
async function ps(script, opcoes = {}) {
  const r = await executar(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-EncodedCommand", codificar(script)],
    opcoes,
  );
  if (!r.ok) {
    const msg = (r.stderr || r.stdout || `código ${r.code}`).split("\n").filter(Boolean).slice(0, 3).join(" ");
    const e = new Error(limparErroPS(msg));
    e.code = r.code;
    throw e;
  }
  return r.stdout;
}

/** Remove o ruído do formato de erro do PowerShell em XML (#< CLIXML). */
function limparErroPS(msg) {
  if (!msg.includes("CLIXML")) return msg;
  const m = [...msg.matchAll(/<S S="Error">([^<]*)<\/S>/g)].map((x) => x[1].replace(/_x000D__x000A_/g, " ").trim());
  return m.filter(Boolean).join(" ") || "Falha ao executar o comando.";
}

/** Roda um script e interpreta a saída como JSON. */
async function psJson(script, opcoes) {
  const saida = await ps(script, opcoes);
  const ini = saida.search(/[[{]/);
  if (ini < 0) throw new Error("Resposta inesperada do Windows.");
  return JSON.parse(saida.slice(ini));
}

/** Embute dados JS num script PowerShell sem se preocupar com aspas. */
function dadosPS(nomeVar, valor) {
  const b64 = Buffer.from(JSON.stringify(valor), "utf8").toString("base64");
  return `$${nomeVar} = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${b64}')) | ConvertFrom-Json;`;
}

function arr(x) {
  return x == null ? [] : Array.isArray(x) ? x : [x];
}

module.exports = { executar, ps, psJson, dadosPS, decodificar, codificar, arr, limparErroPS };
