// Índice da pasta raiz: Raiz / Marca / Referência / arquivos. Busca tolerante a erros de fala.
const fsReal = require("node:fs");
const path = require("node:path");
const { normalizar, digitosDoCodigo, melhores, vencedorClaro, similaridade } = require("./texto.cjs");

const IGNORAR_PADRAO = ["nova pasta"];

function pastaValida(nome) {
  return !nome.startsWith(".") && !nome.startsWith("$") && nome.toLowerCase() !== "system volume information" && nome.toLowerCase() !== "desktop.ini";
}

/** Lê Raiz/Marca/Referência (2 níveis). Nunca lança erro. */
async function indexar(raiz, { ignorar = IGNORAR_PADRAO, fs = fsReal } = {}) {
  const ign = new Set(ignorar.map(normalizar));
  const idx = { raiz, marcas: [], totalRefs: 0, quando: Date.now(), erro: "" };
  let nivel1;
  try {
    nivel1 = await fs.promises.readdir(raiz, { withFileTypes: true });
  } catch (e) {
    idx.erro = `Não consegui abrir a pasta raiz (${raiz}).`;
    return idx;
  }
  for (const d of nivel1) {
    if (!d.isDirectory() || !pastaValida(d.name) || ign.has(normalizar(d.name))) continue;
    const marca = { nome: d.name, caminho: path.join(raiz, d.name), refs: [] };
    try {
      const filhos = await fs.promises.readdir(marca.caminho, { withFileTypes: true });
      for (const f of filhos) {
        if (!f.isDirectory() || !pastaValida(f.name)) continue;
        marca.refs.push({ nome: f.name, caminho: path.join(marca.caminho, f.name), marca: marca.nome, marcaCaminho: marca.caminho, digitos: digitosDoCodigo(f.name) });
      }
    } catch {
      /* pasta sem permissão: segue */
    }
    idx.totalRefs += marca.refs.length;
    idx.marcas.push(marca);
  }
  idx.marcas.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  return idx;
}

function acharMarcas(idx, falado) {
  return melhores(falado, idx.marcas, { nome: (m) => m.nome, minimo: 0.82 });
}

/** Pontua uma referência pelo código falado (dígitos) ou, se não houver dígitos, pelo nome. */
function pontuarRef(ref, falado, digitos) {
  if (digitos.length >= 3) {
    const d = ref.digitos;
    if (!d) return 0;
    if (d === digitos) return 1;
    if (d.startsWith(digitos)) return 0.92;
    if (d.endsWith(digitos)) return 0.88;
    if (digitos.length >= 4 && d.includes(digitos)) return 0.8;
    return 0;
  }
  return similaridade(falado, ref.nome);
}

/** Procura referências por código/nome. `marca` (objeto do índice) restringe a busca. */
function acharRefs(idx, falado, marca) {
  const digitos = digitosDoCodigo(falado);
  const base = marca ? marca.refs : idx.marcas.flatMap((m) => m.refs);
  return base
    .map((item) => ({ item, score: pontuarRef(item, falado, digitos) }))
    .filter((r) => r.score >= 0.8)
    .sort((a, b) => b.score - a.score || a.item.nome.length - b.item.nome.length)
    .slice(0, 12);
}

/** Referências com o código idêntico: se houver só uma, não precisa perguntar. */
function vencedorRef(lista) {
  if (!lista.length) return false;
  if (lista.length === 1) return true;
  return lista[0].score === 1 && lista[1].score < 1;
}

async function listarConteudo(dir, fs = fsReal) {
  try {
    const itens = await fs.promises.readdir(dir, { withFileTypes: true });
    return {
      arquivos: itens.filter((i) => !i.isDirectory() && i.name.toLowerCase() !== "thumbs.db" && i.name.toLowerCase() !== "desktop.ini").map((i) => i.name).sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true })),
      pastas: itens.filter((i) => i.isDirectory()).map((i) => i.name).sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true })),
    };
  } catch {
    return { arquivos: [], pastas: [] };
  }
}

/** Busca arquivos/pastas por nome (tolerante) dentro de uma pasta, até `profundidade` níveis. */
async function buscarEm(dir, termo, { profundidade = 3, fs = fsReal, limite = 12 } = {}) {
  const achados = [];
  const digitos = digitosDoCodigo(termo);
  async function andar(d, nivel) {
    let itens;
    try {
      itens = await fs.promises.readdir(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const i of itens) {
      if (!pastaValida(i.name)) continue;
      const cam = path.join(d, i.name);
      const base = path.parse(i.name).name;
      let score = 0;
      if (digitos.length >= 3) {
        const dn = digitosDoCodigo(base);
        score = dn === digitos ? 1 : dn.includes(digitos) ? 0.85 : 0;
      } else {
        const nn = normalizar(base);
        const nt = normalizar(termo);
        score = nn.includes(nt) && nt ? 0.9 : similaridade(termo, base);
      }
      if (score >= 0.8) achados.push({ caminho: cam, nome: i.name, pasta: i.isDirectory(), score });
      if (i.isDirectory() && nivel < profundidade) await andar(cam, nivel + 1);
    }
  }
  await andar(dir, 1);
  return achados.sort((a, b) => b.score - a.score || a.caminho.length - b.caminho.length).slice(0, limite);
}

/** Pastas conhecidas do Windows e atalhos por voz. */
function pastasConhecidas({ HOME, DESKTOP, DOCUMENTS, DOWNLOADS, PICTURES, VIDEOS, MUSIC }) {
  return [
    { falas: ["downloads", "download", "baixados", "meus downloads"], caminho: DOWNLOADS },
    { falas: ["documentos", "meus documentos", "documento"], caminho: DOCUMENTS },
    { falas: ["area de trabalho", "desktop", "mesa"], caminho: DESKTOP },
    { falas: ["imagens", "fotos", "minhas fotos", "figuras"], caminho: PICTURES },
    { falas: ["videos", "meus videos", "filmes"], caminho: VIDEOS },
    { falas: ["musicas", "minhas musicas", "musica"], caminho: MUSIC },
    { falas: ["usuario", "minha pasta", "pasta pessoal"], caminho: HOME },
  ].filter((p) => p.caminho);
}

module.exports = { indexar, acharMarcas, acharRefs, vencedorRef, vencedorClaro, listarConteudo, buscarEm, pastasConhecidas, pastaValida };
