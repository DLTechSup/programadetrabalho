// Utilitários de arquivos: semáforo, padrões com curinga, medir e apagar com segurança.
const fsReal = require("node:fs");
const path = require("node:path");

class Semaforo {
  constructor(max) {
    this.max = max;
    this.ativos = 0;
    this.fila = [];
  }
  async usar(fn) {
    if (this.ativos >= this.max) await new Promise((r) => this.fila.push(r));
    this.ativos++;
    try {
      return await fn();
    } finally {
      this.ativos--;
      const prox = this.fila.shift();
      if (prox) prox();
    }
  }
}

/** Transforma um segmento com "*" (ex.: thumbcache_*.db) numa expressão regular (sem diferenciar maiúsculas). */
function regexSegmento(seg) {
  const esc = seg.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(`^${esc}$`, "i");
}

/**
 * Expande um padrão dado como lista de segmentos (o 1º é a base absoluta; os demais podem ter "*").
 * Devolve só caminhos que existem. Nunca lança erro.
 */
async function expandir(segmentos, fs = fsReal) {
  let atuais = [segmentos[0]];
  for (const seg of segmentos.slice(1)) {
    const prox = [];
    for (const base of atuais) {
      if (!seg.includes("*")) {
        prox.push(path.join(base, seg));
        continue;
      }
      let nomes = [];
      try {
        nomes = await fs.promises.readdir(base);
      } catch {
        continue;
      }
      const re = regexSegmento(seg);
      for (const n of nomes) if (re.test(n)) prox.push(path.join(base, n));
    }
    atuais = prox;
  }
  const existentes = [];
  for (const c of atuais) {
    try {
      await fs.promises.lstat(c);
      existentes.push(c);
    } catch {
      /* não existe */
    }
  }
  return existentes;
}

/** Soma o tamanho e conta os arquivos de um caminho (arquivo ou pasta), ignorando links simbólicos/junções. */
async function medir(alvo, fs = fsReal, sem = new Semaforo(24)) {
  let st;
  try {
    st = await sem.usar(() => fs.promises.lstat(alvo));
  } catch {
    return { bytes: 0, arquivos: 0 };
  }
  if (st.isSymbolicLink()) return { bytes: 0, arquivos: 0 };
  if (!st.isDirectory()) return { bytes: st.size, arquivos: 1 };
  let nomes;
  try {
    nomes = await sem.usar(() => fs.promises.readdir(alvo));
  } catch {
    return { bytes: 0, arquivos: 0 };
  }
  const partes = await Promise.all(nomes.map((n) => medir(path.join(alvo, n), fs, sem)));
  return partes.reduce((a, p) => ({ bytes: a.bytes + p.bytes, arquivos: a.arquivos + p.arquivos }), { bytes: 0, arquivos: 0 });
}

/** Trava de segurança: nunca opera na raiz do disco (C:\) nem em caminhos vazios/relativos. */
function caminhoApagavel(p) {
  if (typeof p !== "string" || !p) return false;
  const abs = path.resolve(p);
  if (path.parse(abs).root === abs) return false;
  const partes = abs.slice(path.parse(abs).root.length).split(path.sep).filter(Boolean);
  return partes.length >= 1;
}

/** Apaga o item recursivamente, sem lançar erro. Devolve {liberado, ignorados} (itens em uso são pulados). */
async function apagarArvore(alvo, fs = fsReal, sem = new Semaforo(16)) {
  const res = { liberado: 0, ignorados: 0 };
  if (!caminhoApagavel(alvo)) return res;
  let st;
  try {
    st = await sem.usar(() => fs.promises.lstat(alvo));
  } catch {
    return res;
  }
  if (st.isDirectory() && !st.isSymbolicLink()) {
    let nomes = [];
    try {
      nomes = await sem.usar(() => fs.promises.readdir(alvo));
    } catch {
      res.ignorados++;
      return res;
    }
    const partes = await Promise.all(nomes.map((n) => apagarArvore(path.join(alvo, n), fs, sem)));
    for (const p of partes) {
      res.liberado += p.liberado;
      res.ignorados += p.ignorados;
    }
    try {
      await sem.usar(() => fs.promises.rmdir(alvo));
    } catch {
      /* pasta não vazia ou em uso: tudo bem */
    }
    return res;
  }
  try {
    await sem.usar(() => fs.promises.unlink(alvo));
    res.liberado += st.isSymbolicLink() ? 0 : st.size;
  } catch {
    res.ignorados++;
  }
  return res;
}

/** Apaga o CONTEÚDO de uma pasta (mantém a pasta). Se for arquivo, apaga o arquivo. */
async function apagarConteudo(alvo, fs = fsReal) {
  let st;
  try {
    st = await fs.promises.lstat(alvo);
  } catch {
    return { liberado: 0, ignorados: 0 };
  }
  if (!st.isDirectory() || st.isSymbolicLink()) return apagarArvore(alvo, fs);
  let nomes = [];
  try {
    nomes = await fs.promises.readdir(alvo);
  } catch {
    return { liberado: 0, ignorados: 1 };
  }
  const partes = await Promise.all(nomes.map((n) => apagarArvore(path.join(alvo, n), fs)));
  return partes.reduce((a, p) => ({ liberado: a.liberado + p.liberado, ignorados: a.ignorados + p.ignorados }), { liberado: 0, ignorados: 0 });
}

module.exports = { Semaforo, expandir, medir, apagarArvore, apagarConteudo, caminhoApagavel, regexSegmento };
