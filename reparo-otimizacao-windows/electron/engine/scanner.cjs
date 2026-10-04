// Scanner do disco: percorre a unidade inteira e descobre o que mais ocupa espaço.
const fsReal = require("node:fs");
const path = require("node:path");
const { Semaforo } = require("./fsutil.cjs");

const TIPOS = {
  videos: ["mp4", "mkv", "avi", "mov", "wmv", "flv", "webm", "m4v", "mpg", "mpeg", "ts", "3gp"],
  imagens: ["jpg", "jpeg", "png", "gif", "bmp", "tif", "tiff", "webp", "heic", "raw", "cr2", "nef", "psd"],
  audio: ["mp3", "wav", "flac", "aac", "ogg", "m4a", "wma"],
  documentos: ["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "csv", "odt", "ods", "rtf"],
  compactados: ["zip", "rar", "7z", "gz", "tar", "bz2", "xz", "cab"],
  imagensDisco: ["iso", "img", "wim", "esd", "vhd", "vhdx", "vmdk", "vdi", "ova", "bin"],
  programas: ["exe", "msi", "msix", "appx", "dll", "sys", "msp"],
  logsDumps: ["log", "dmp", "etl", "tmp", "bak", "old", "chk"],
  bancos: ["db", "sqlite", "mdf", "ldf", "bak", "sql", "pst", "ost"],
};
const MAPA_EXT = new Map();
for (const [tipo, exts] of Object.entries(TIPOS)) for (const e of exts) if (!MAPA_EXT.has(e)) MAPA_EXT.set(e, tipo);

function tipoDe(nome) {
  const i = nome.lastIndexOf(".");
  if (i < 0) return "outros";
  return MAPA_EXT.get(nome.slice(i + 1).toLowerCase()) || "outros";
}

/**
 * Percorre `raiz` e devolve: árvore de pastas (com os maiores filhos), maiores arquivos e totais por tipo.
 * Links simbólicos e junções são ignorados (evita loops e contagem dupla).
 */
async function escanearDisco(raiz, opcoes = {}) {
  const {
    fs = fsReal,
    onProgresso = () => {},
    cancelado = () => false,
    topArquivos = 80,
    tamanhoMinArquivo = 10 * 1024 * 1024,
    profundidadeArvore = 4,
    filhosPorPasta = 30,
    concorrencia = 32,
  } = opcoes;

  const sem = new Semaforo(concorrencia);
  const inicio = Date.now();
  const estado = { arquivos: 0, pastas: 0, bytes: 0, erros: 0, atual: raiz, ultimoAviso: 0 };
  let maiores = [];
  const porTipo = {};

  const avisar = (forcar) => {
    const agora = Date.now();
    if (forcar || agora - estado.ultimoAviso > 200) {
      estado.ultimoAviso = agora;
      onProgresso({ arquivos: estado.arquivos, pastas: estado.pastas, bytes: estado.bytes, atual: estado.atual });
    }
  };

  const aparar = () => {
    maiores.sort((a, b) => b.bytes - a.bytes);
    if (maiores.length > topArquivos) maiores.length = topArquivos;
  };

  async function visitar(dir, nome, nivel) {
    const no = { nome, caminho: dir, bytes: 0, arquivos: 0, filhos: [] };
    if (cancelado()) return no;
    estado.atual = dir;
    estado.pastas++;
    let itens;
    try {
      itens = await sem.usar(() => fs.promises.readdir(dir, { withFileTypes: true }));
    } catch {
      estado.erros++;
      return no;
    }
    const tarefas = [];
    for (const it of itens) {
      if (cancelado()) break;
      const cam = path.join(dir, it.name);
      if (it.isSymbolicLink()) continue;
      if (it.isDirectory()) {
        tarefas.push(visitar(cam, it.name, nivel + 1));
      } else {
        tarefas.push(
          (async () => {
            let st;
            try {
              st = await sem.usar(() => fs.promises.lstat(cam));
            } catch {
              estado.erros++;
              return null;
            }
            if (st.isSymbolicLink()) return null;
            const tipo = tipoDe(it.name);
            const t = (porTipo[tipo] ||= { bytes: 0, arquivos: 0 });
            t.bytes += st.size;
            t.arquivos++;
            estado.arquivos++;
            estado.bytes += st.size;
            if (st.size >= tamanhoMinArquivo) {
              maiores.push({ caminho: cam, nome: it.name, pasta: dir, bytes: st.size, modificado: st.mtimeMs, tipo });
              if (maiores.length > topArquivos * 4) aparar();
            }
            avisar(false);
            return st.size;
          })(),
        );
      }
    }
    const res = await Promise.all(tarefas);
    for (const r of res) {
      if (r == null) continue;
      if (typeof r === "number") {
        no.bytes += r;
        no.arquivos++;
      } else {
        no.bytes += r.bytes;
        no.arquivos += r.arquivos;
        no.filhos.push(r);
      }
    }
    // Poda: guarda só as pastas maiores e só até a profundidade pedida (economiza memória em discos enormes).
    if (nivel >= profundidadeArvore) {
      no.filhos = [];
    } else if (no.filhos.length > filhosPorPasta) {
      no.filhos.sort((a, b) => b.bytes - a.bytes);
      no.filhos.length = filhosPorPasta;
    } else {
      no.filhos.sort((a, b) => b.bytes - a.bytes);
    }
    return no;
  }

  const arvore = await visitar(raiz, raiz, 0);
  aparar();
  avisar(true);
  return {
    raiz,
    totalBytes: arvore.bytes,
    arquivos: estado.arquivos,
    pastas: estado.pastas,
    erros: estado.erros,
    duracaoMs: Date.now() - inicio,
    cancelado: !!cancelado(),
    arvore,
    maiores,
    porTipo,
  };
}

module.exports = { escanearDisco, tipoDe, TIPOS };
