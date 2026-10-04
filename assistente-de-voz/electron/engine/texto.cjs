// Tratamento de texto falado em português: normalização, números por extenso,
// códigos de referência e semelhança entre nomes (tolera erros do reconhecimento de voz).

/** minúsculas, sem acento, sem pontuação; mantém letras, dígitos e espaços. */
function normalizar(s) {
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const UNIDADES = { zero: 0, um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, meia: 6, sete: 7, oito: 8, nove: 9 };
const DEZ_A_19 = { dez: 10, onze: 11, doze: 12, treze: 13, catorze: 14, quatorze: 14, quinze: 15, dezesseis: 16, dezessete: 17, dezoito: 18, dezenove: 19 };
const DEZENAS = { vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, sessenta: 60, setenta: 70, oitenta: 80, noventa: 90 };
const CENTENAS = { cem: 100, cento: 100, duzentos: 200, trezentos: 300, quatrocentos: 400, quinhentos: 500, seiscentos: 600, setecentos: 700, oitocentos: 800, novecentos: 900 };

/** "vinte e cinco" -> 25 ; "50" -> 50 ; devolve null se não achar número. */
function extrairNumero(texto) {
  const n = normalizar(texto).replace(/\bpor cento\b/g, "");
  const d = n.match(/\d+/);
  if (d) return parseInt(d[0], 10);
  let total = 0;
  let achou = false;
  let mil = 0;
  for (const p of n.split(" ")) {
    if (p in UNIDADES) (total += UNIDADES[p]), (achou = true);
    else if (p in DEZ_A_19) (total += DEZ_A_19[p]), (achou = true);
    else if (p in DEZENAS) (total += DEZENAS[p]), (achou = true);
    else if (p in CENTENAS) (total += CENTENAS[p]), (achou = true);
    else if (p === "mil") (mil = (total || 1) * 1000), (total = 0), (achou = true);
  }
  return achou ? mil + total : null;
}

const ORDINAIS = { primeiro: 1, primeira: 1, segundo: 2, segunda: 2, terceiro: 3, terceira: 3, quarto: 4, quarta: 4, quinto: 5, quinta: 5, sexto: 6, sexta: 6, setimo: 7, setima: 7, oitavo: 8, oitava: 8, nono: 9, nona: 9, decimo: 10, decima: 10 };
/** número de uma escolha/ordinal: "dois", "2", "segunda", "o terceiro". */
function numeroOuOrdinal(texto) {
  const n = normalizar(texto);
  for (const p of n.split(" ")) if (p in ORDINAIS) return ORDINAIS[p];
  return extrairNumero(n);
}

/**
 * Converte uma fala de referência em dígitos: "oito cinco zero seis ponto dois zero nove",
 * "8506.209", "8.506.209", "8506, 209" -> "8506209". Devolve "" se não houver dígitos.
 */
function digitosDoCodigo(texto) {
  const partes = normalizar(texto).split(" ");
  let out = "";
  for (const p of partes) {
    if (/^\d+$/.test(p)) out += p;
    else if (p in UNIDADES) out += String(UNIDADES[p]);
    else if (p === "oito" || p === "nove") out += String(UNIDADES[p]);
  }
  return out;
}

/** Formata dígitos "8506209" como "8506.209" quando o padrão é 4+3 (usado só para falar). */
function falarCodigo(digitos) {
  return digitos.length === 7 ? `${digitos.slice(0, 4)}.${digitos.slice(4)}` : digitos;
}

function jaro(a, b) {
  if (a === b) return 1;
  const la = a.length;
  const lb = b.length;
  if (!la || !lb) return 0;
  const janela = Math.max(0, Math.floor(Math.max(la, lb) / 2) - 1);
  const ma = new Array(la).fill(false);
  const mb = new Array(lb).fill(false);
  let m = 0;
  for (let i = 0; i < la; i++) {
    const ini = Math.max(0, i - janela);
    const fim = Math.min(lb - 1, i + janela);
    for (let j = ini; j <= fim; j++) {
      if (!mb[j] && a[i] === b[j]) {
        ma[i] = mb[j] = true;
        m++;
        break;
      }
    }
  }
  if (!m) return 0;
  let t = 0;
  let k = 0;
  for (let i = 0; i < la; i++) {
    if (ma[i]) {
      while (!mb[k]) k++;
      if (a[i] !== b[k]) t++;
      k++;
    }
  }
  return (m / la + m / lb + (m - t / 2) / m) / 3;
}

function jaroWinkler(a, b) {
  const j = jaro(a, b);
  let p = 0;
  while (p < 4 && p < a.length && p < b.length && a[p] === b[p]) p++;
  return j + p * 0.1 * (1 - j);
}

/** Chave fonética simples do português (agrupa grafias que soam iguais: kemo/quemo, xuxa/chucha). */
function chaveFonetica(s) {
  let t = normalizar(s).replace(/\s+/g, "");
  t = t
    .replace(/ph/g, "f")
    .replace(/qu/g, "k")
    .replace(/c(?=[ei])/g, "s")
    .replace(/c(?!h)/g, "k")
    .replace(/ch|sh/g, "x")
    .replace(/lh/g, "l")
    .replace(/nh/g, "n")
    .replace(/ss|sc|ç/g, "s")
    .replace(/w/g, "v")
    .replace(/y/g, "i")
    .replace(/z/g, "s")
    .replace(/h/g, "")
    .replace(/(.)\1+/g, "$1");
  return t;
}

/** 0..1: o quanto o texto falado se parece com o nome candidato. */
function similaridade(falado, candidato) {
  const a = normalizar(falado);
  const b = normalizar(candidato);
  if (!a || !b) return 0;
  if (a === b) return 1;
  const ta = a.split(" ");
  const tb = b.split(" ");
  // todas as palavras faladas aparecem no candidato (ex.: "chrome" em "google chrome")
  const todas = ta.every((p) => tb.some((q) => q === p || (p.length >= 4 && q.startsWith(p))));
  let s = 0;
  if (todas) s = Math.max(s, 0.9 - 0.05 * Math.max(0, tb.length - ta.length));
  // o candidato inteiro foi dito (ex.: "abre o beira rio por favor" -> "beira rio")
  if (tb.length >= 1 && tb.every((q) => ta.includes(q)) && ta.length > tb.length) s = Math.max(s, 0.8);
  const ca = a.replace(/\s/g, "");
  const cb = b.replace(/\s/g, "");
  // só compara "escrita parecida" quando os tamanhos são parecidos (senão "chrome" casaria com qualquer "chrome ...")
  if (Math.min(ca.length, cb.length) / Math.max(ca.length, cb.length) >= 0.6) s = Math.max(s, jaroWinkler(ca, cb) * 0.97);
  if (chaveFonetica(a) === chaveFonetica(b)) s = Math.max(s, 0.93);
  // palavra a palavra (ordem diferente / palavra extra)
  if (ta.length > 1 || tb.length > 1) {
    const media = ta.reduce((acc, p) => acc + Math.max(...tb.map((q) => jaroWinkler(p, q))), 0) / ta.length;
    s = Math.max(s, media * 0.9 - 0.05 * Math.max(0, tb.length - ta.length));
  }
  // nomes com várias palavras: cada palavra falada precisa existir (evita "microsoft edge" casar com "microsoft excel")
  if (ta.length > 1 && tb.length > 1) {
    const pior = Math.min(...ta.map((p) => Math.max(...tb.map((q) => jaroWinkler(p, q)))));
    if (pior < 0.8) s = Math.min(s, 0.79);
  }
  return Math.min(1, s);
}

/**
 * Ordena candidatos pelo quanto se parecem com o que foi falado.
 * `nome` extrai o texto de cada candidato. Devolve [{item, score}] com score >= minimo.
 */
function melhores(falado, candidatos, { nome = (x) => x, minimo = 0.82, limite = 8 } = {}) {
  return candidatos
    .map((item) => ({ item, score: similaridade(falado, nome(item)) }))
    .filter((r) => r.score >= minimo)
    .sort((x, y) => y.score - x.score)
    .slice(0, limite);
}

/** Há um vencedor claro? (diferença mínima para o segundo colocado) */
function vencedorClaro(lista, delta = 0.04) {
  if (!lista.length) return false;
  if (lista.length === 1) return true;
  if (lista[0].score >= 0.995 && lista[1].score < 0.995) return true;
  return lista[0].score - lista[1].score >= delta;
}

/** Palavras "de enchimento" que o Whisper inventa em silêncio/ruído. */
const ALUCINACOES = [
  /^(obrigad[oa]|tchau|ate (a )?proxima|e ai|ta|ok|hum|ah|uh|oi)$/,
  /legendas? (pela|por|de) /,
  /amara org/,
  /inscreva[ -]?se/,
  /^(musica|aplausos|risos|som|silencio)$/,
  /^(e )?(isso|entao)$/,
];
function ehRuido(texto) {
  const n = normalizar(texto);
  if (n.length < 2) return true;
  return ALUCINACOES.some((re) => re.test(n));
}

module.exports = {
  normalizar, extrairNumero, numeroOuOrdinal, digitosDoCodigo, falarCodigo,
  jaroWinkler, chaveFonetica, similaridade, melhores, vencedorClaro, ehRuido,
};
