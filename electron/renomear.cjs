// Execucao de verdade do Renomeador em Massa (fs real). So o processo principal mexe em arquivos.
const fs = require("node:fs");
const path = require("node:path");

/** Renomeia com seguranca: primeiro para nomes temporarios (evita colisao entre nomes novos e antigos).
 * Se algo falhar no meio, desfaz tudo. Devolve [[novo, antigo], ...] para poder desfazer depois. */
function executarRenomeacoesSeguro(pares) {
  const temporarios = [];
  try {
    pares.forEach(({ antigo, novo }, i) => {
      if (path.normalize(antigo).toLowerCase() === path.normalize(novo).toLowerCase()) return;
      const tmp = path.join(path.dirname(antigo), `__ren_tmp_${i}_${path.basename(antigo)}`);
      fs.renameSync(antigo, tmp);
      temporarios.push({ tmp, antigo, novo });
    });
    const feitos = [];
    for (const { tmp, antigo, novo } of temporarios) {
      fs.renameSync(tmp, novo);
      feitos.push([novo, antigo]);
    }
    return feitos;
  } catch (e) {
    for (const { tmp, antigo, novo } of temporarios) {
      try {
        if (fs.existsSync(tmp)) fs.renameSync(tmp, antigo);
        else if (fs.existsSync(novo)) fs.renameSync(novo, antigo);
      } catch {
        /* melhor esforco: tenta restaurar o resto mesmo assim */
      }
    }
    throw e;
  }
}

/** Volta os nomes originais. Lanca erro se algum arquivo sumiu (foi movido/renomeado por fora depois). */
function desfazer(feitos) {
  const faltando = feitos.find(([novo]) => !fs.existsSync(novo));
  if (faltando) throw new Error(`Não achei mais: ${path.basename(faltando[0])}. Os arquivos foram movidos ou renomeados depois.`);
  const tmps = feitos.map(([novo], i) => [novo, path.join(path.dirname(novo), `__des_tmp_${i}__`)]);
  tmps.forEach(([novo, tmp]) => fs.renameSync(novo, tmp));
  tmps.forEach(([, tmp], i) => fs.renameSync(tmp, feitos[i][1]));
  return feitos.length;
}

/** Nomes (so o nome) dos arquivos ja existentes numa pasta -- usado para "continuar numeracao" e detectar conflito. */
function listarPasta(pasta) {
  try {
    return fs.readdirSync(pasta).filter((n) => {
      try {
        return fs.statSync(path.join(pasta, n)).isFile();
      } catch {
        return false;
      }
    });
  } catch {
    return [];
  }
}

/** Dados de um arquivo que a ordenacao pode precisar (mtime + data EXIF se der para ler sem biblioteca extra). */
function infoArquivo(caminho) {
  const st = fs.statSync(caminho);
  return { caminho, nome: path.basename(caminho), mtimeMs: st.mtimeMs, dataFotoMs: lerDataExif(caminho) };
}

/** Le so a tag DateTimeOriginal do EXIF (JPEG), sem biblioteca externa. undefined se nao achar. */
function lerDataExif(caminho) {
  try {
    if (!/\.jpe?g$/i.test(caminho)) return undefined;
    const buf = fs.readFileSync(caminho);
    if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return undefined;
    let i = 2;
    while (i < buf.length - 4) {
      if (buf[i] !== 0xff) break;
      const marcador = buf[i + 1];
      const tam = buf.readUInt16BE(i + 2);
      if (marcador === 0xe1) {
        const bloco = buf.slice(i + 4, i + 2 + tam);
        const data = extrairDateTimeOriginal(bloco);
        if (data) return data;
      }
      if (marcador === 0xda) break; // comeco dos dados da imagem: para de procurar
      i += 2 + tam;
    }
  } catch {
    /* sem EXIF legivel: cai para a data do arquivo */
  }
  return undefined;
}

function extrairDateTimeOriginal(bloco) {
  if (bloco.toString("ascii", 0, 4) !== "Exif") return undefined;
  const base = 6;
  const leEndian = bloco.toString("ascii", base, base + 2) === "II";
  const u16 = (o) => (leEndian ? bloco.readUInt16LE(o) : bloco.readUInt16BE(o));
  const u32 = (o) => (leEndian ? bloco.readUInt32LE(o) : bloco.readUInt32BE(o));
  const ifd0 = base + u32(base + 4);

  function lerIFD(offset) {
    const n = u16(offset);
    for (let j = 0; j < n; j++) {
      const e = offset + 2 + j * 12;
      const tag = u16(e);
      if (tag === 0x8769) return base + u32(e + 8); // ponteiro para o Exif SubIFD
      if (tag === 0x9003) {
        const tipo = u16(e + 2);
        const valOffset = u16(e + 2) && tipo === 2 ? base + u32(e + 8) : e + 8;
        return bloco.toString("ascii", valOffset, valOffset + 19);
      }
    }
    return null;
  }
  const subIfd = lerIFD(ifd0);
  if (typeof subIfd === "string") return paraMs(subIfd);
  if (typeof subIfd === "number") {
    const r = lerIFD(subIfd);
    if (typeof r === "string") return paraMs(r);
  }
  return undefined;
}

function paraMs(texto) {
  const m = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/.exec(texto);
  if (!m) return undefined;
  const [, a, mes, d, h, mi, s] = m.map(Number);
  const t = new Date(a, mes - 1, d, h, mi, s).getTime();
  return Number.isNaN(t) ? undefined : t;
}

module.exports = { executarRenomeacoesSeguro, desfazer, listarPasta, infoArquivo };
