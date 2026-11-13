// Pasta do dia e gravação das fotos (sem duplicar: compara o conteúdo) -- porta
// armazenamento.py, usando a lógica pura compartilhada (logica-pura.cjs).
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { nomePastaGrupo, nomePastaDoDia, extensaoDaFoto, nomeSeguro } = require("./logica-pura.cjs");

function pastaDoDia(base, grupo, dia = new Date()) {
  const p = path.join(base, nomePastaGrupo(grupo), nomePastaDoDia(dia));
  fs.mkdirSync(p, { recursive: true });
  return p;
}

/** Salva em <dia>/<nomePasta>/<prefixo>foto_01.jpg... Pula foto que já está na pasta.
 * Devolve {pasta, novas}. */
function salvarFotos(pastaDia, nomePasta, fotos, prefixo = "") {
  const destino = path.join(pastaDia, nomeSeguro(nomePasta));
  fs.mkdirSync(destino, { recursive: true });
  const existentes = new Set();
  let numero = 0;
  for (const nome of fs.readdirSync(destino)) {
    const caminho = path.join(destino, nome);
    if (!fs.statSync(caminho).isFile()) continue;
    existentes.add(crypto.createHash("sha1").update(fs.readFileSync(caminho)).digest("hex"));
    if (nome.startsWith(`${prefixo}foto_`)) numero++;
  }
  let novas = 0;
  for (const dados of fotos) {
    const buf = Buffer.isBuffer(dados) ? dados : Buffer.from(dados);
    if (buf.length < 3000) continue; // menor que 3 KB = miniatura/ícone, não é foto
    const h = crypto.createHash("sha1").update(buf).digest("hex");
    if (existentes.has(h)) continue;
    numero++;
    const nomeArq = `${prefixo}foto_${String(numero).padStart(2, "0")}${extensaoDaFoto(buf)}`;
    fs.writeFileSync(path.join(destino, nomeArq), buf);
    existentes.add(h);
    novas++;
  }
  return { pasta: destino, novas };
}

/** Acrescenta ao .txt do dia: cada mensagem em sua(s) linha(s), com uma linha em branco entre elas. */
function anexarMensagens(pastaDia, mensagens, nomeArquivo = "mensagens.txt") {
  const arq = path.join(pastaDia, nomeArquivo);
  let conteudo = "";
  for (const linhas of mensagens) {
    for (const linha of linhas) conteudo += linha.replace(/[\r\n]+$/, "") + "\r\n";
    conteudo += "\r\n";
  }
  fs.appendFileSync(arq, conteudo, "utf-8");
  return arq;
}

module.exports = { pastaDoDia, salvarFotos, anexarMensagens };
