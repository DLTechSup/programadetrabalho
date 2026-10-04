/**
 * Núcleo da automação Bling — port fiel do `nucleo.py` (versão Python/PyQt6).
 * Toda a lógica de leitura, análise de descrição, agrupamento de cores e
 * geração de código/descrição. Sem nenhuma dependência de interface.
 */

export const ESTOQUE_MINIMO = "1,00";
export const ESTOQUE_MAXIMO = "5,00";

export const TAMANHO_MIN = 14;
export const TAMANHO_MAX = 50;
export const TAMANHOS_LETRA = new Set(["PP", "P", "M", "G", "GG", "XG", "XGG", "U", "UN"]);

export const COLUNAS_COPIAR_DO_PAI = [
  "Marca",
  "Peso líquido (Kg)",
  "Peso bruto (Kg)",
  "Largura do produto",
  "Altura do Produto",
  "Profundidade do produto",
  "Volumes",
  "Itens p/ caixa",
  "Data Validade",
  "Descrição Curta",
] as const;

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------
export type Valor = string | number | boolean | Date | null | undefined;
export type Linha = Record<string, Valor>;

/** Equivalente ao DataFrame: colunas na ordem original + linhas. */
export interface Planilha {
  colunas: string[];
  linhas: Linha[];
}

export interface BancoCores {
  por_marca: Record<string, string>;
  generico: Record<string, string>;
}

export interface Analise {
  tamanho: string;
  chave: string;
  sugestao: string;
}

export interface Grupo {
  sugestao: string;
  indices: number[];
  tamanhos: string[];
}

export interface DadosNovoPai {
  codigo?: string;
  descricao?: string;
  marca: string;
  categoria: string;
  peso_liquido: string;
  peso_bruto: string;
  largura: string;
  altura: string;
  profundidade: string;
  volumes: string;
  itens_caixa: string;
  data_validade?: string;
}

// ---------------------------------------------------------------------------
// Utilidades básicas
// ---------------------------------------------------------------------------
export function limpo(valor: Valor): string {
  if (valor === null || valor === undefined) return "";
  if (typeof valor === "number" && Number.isNaN(valor)) return "";
  return String(valor).trim();
}

function faixa(n: number): boolean {
  return n >= TAMANHO_MIN && n <= TAMANHO_MAX;
}

/** Equivalente ao `str.title()` do Python. */
export function titulo(texto: string): string {
  let saida = "";
  let anteriorEraLetra = false;
  for (const ch of texto) {
    const ehLetra = ch.toLowerCase() !== ch.toUpperCase();
    if (ehLetra) {
      saida += anteriorEraLetra ? ch.toLowerCase() : ch.toUpperCase();
      anteriorEraLetra = true;
    } else {
      saida += ch;
      anteriorEraLetra = false;
    }
  }
  return saida;
}

/** Equivalente a `str.isdigit()` (falso para string vazia). */
function soDigitos(texto: string): boolean {
  return texto.length > 0 && /^\d+$/.test(texto);
}

// ---------------------------------------------------------------------------
// Banco de dados de cores (aprendizado incremental)
// ---------------------------------------------------------------------------
export function bancoVazio(): BancoCores {
  return { por_marca: {}, generico: {} };
}

export function normalizarBanco(dados: unknown): BancoCores {
  const d = (dados && typeof dados === "object" ? dados : {}) as Partial<BancoCores>;
  return {
    por_marca: { ...(d.por_marca ?? {}) },
    generico: { ...(d.generico ?? {}) },
  };
}

export function consultarAbreviacao(banco: BancoCores, marca: string, cor: string): string | null {
  const marcaNorm = (marca || "").trim().toUpperCase();
  const corNorm = (cor || "").trim().toLowerCase();
  const chaveMarca = `${marcaNorm}|${corNorm}`;
  if (chaveMarca in banco.por_marca) return banco.por_marca[chaveMarca];
  if (corNorm in banco.generico) return banco.generico[corNorm];
  return null;
}

export function aprenderAbreviacao(banco: BancoCores, marca: string, cor: string, abreviacao: string): void {
  const marcaNorm = (marca || "").trim().toUpperCase();
  const corNorm = (cor || "").trim().toLowerCase();
  banco.por_marca[`${marcaNorm}|${corNorm}`] = abreviacao;
  banco.generico[corNorm] = abreviacao;
}

/** Serializa com chaves ordenadas (igual ao `sort_keys=True` do Python). */
export function serializarBanco(banco: BancoCores): string {
  const ordenar = (o: Record<string, string>) =>
    Object.fromEntries(Object.entries(o).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
  return JSON.stringify({ generico: ordenar(banco.generico), por_marca: ordenar(banco.por_marca) }, null, 2);
}

// ---------------------------------------------------------------------------
// Análise da linha (tamanho + agrupamento de cor)
// ---------------------------------------------------------------------------
function ultimasPalavras(texto: string, k = 2): string {
  const palavras = texto.split(/\s+/).filter(Boolean);
  return palavras.slice(-k).join(" ");
}

/**
 * Fornecedores como a Olympikus usam um padrão limpo:
 * 'REFERENCIA-CODIGOCOR-TAMANHO', ex: '43522987-LUNMHO-38'.
 * `corcode` vem null quando o meio é só número (não é um código de cor de
 * verdade) — mas o tamanho continua sendo aproveitado, por ser confiável.
 */
export function tentarViaCodFornecedor(codFornecedor: Valor): { tamanho: string | null; corcode: string | null } {
  const texto = limpo(codFornecedor);
  const m = /^(.+)-([A-Za-z0-9]{2,10})-(\d{2})$/.exec(texto);
  if (m) {
    const [, , corcode, tamanho] = m;
    if (faixa(parseInt(tamanho, 10))) {
      if (/[A-Za-z]/.test(corcode)) return { tamanho, corcode: corcode.toUpperCase() };
      return { tamanho, corcode: null };
    }
  }
  return { tamanho: null, corcode: null };
}

/** Se outra linha trouxer o nome da cor por extenso ao lado do código abreviado. */
export function extrairExpansaoCor(descricao: Valor, corcode: string): string | null {
  const texto = limpo(descricao).toUpperCase();
  const pos = texto.indexOf(corcode.toUpperCase());
  if (pos === -1) return null;
  let resto = texto.slice(pos + corcode.length).trim();
  resto = resto.replace(/\b\d{2}\b\s*$/, "").trim();
  resto = resto.replace(/\s{2,}/g, " ");
  if (resto && !soDigitos(resto.replace(/ /g, ""))) return titulo(resto);
  return null;
}

const RE_NUM_LONGO = /\b\d[\d.\-]{2,}\b/g;

/**
 * Reconhece o tamanho e sugere um agrupamento de cor a partir da descrição
 * crua do fornecedor. `chave` serve só para AGRUPAR linhas da mesma cor;
 * `sugestao` é o texto pré-preenchido (sempre editável).
 */
export function analisarDescricao(descricao: Valor): Analise {
  const texto = limpo(descricao);
  if (!texto) return { tamanho: "", chave: "", sugestao: "" };

  // 1. tamanho em par "NN/NN" (calçado infantil), em qualquer posição
  let m = /(?:\bN\s+)?(\d{2}\/\d{2})\b/.exec(texto);
  if (m) {
    const tamanho = m[1];
    let antes = texto.slice(0, m.index).trim();
    let depois = texto.slice(m.index + m[0].length).trim();
    antes = antes.replace(RE_NUM_LONGO, "").trim();
    depois = depois.replace(RE_NUM_LONGO, "").trim();
    if (depois && !soDigitos(depois.replace(/ /g, ""))) {
      return { tamanho, chave: depois.toUpperCase(), sugestao: titulo(depois) };
    }
    return { tamanho, chave: antes.toUpperCase(), sugestao: titulo(ultimasPalavras(antes)) };
  }

  // 2. marcador "TAM.=NN." — cor vem DEPOIS do marcador
  m = /\bTAM\.?\s*=\s*(\d{2})\.?/i.exec(texto);
  if (m && faixa(parseInt(m[1], 10))) {
    const tamanho = m[1];
    let depois = texto.slice(m.index + m[0].length).trim();
    depois = depois.replace(/\b\d[\d.\-]{2,}\b\s*$/, "").trim();
    return { tamanho, chave: depois.toUpperCase(), sugestao: titulo(depois) };
  }

  // 3. "NN=N" (opcionalmente seguido de "COMBn:") — Suzana Santos / Renata Mello
  m = /\b(\d{2})=\d+\b/.exec(texto);
  if (m && faixa(parseInt(m[1], 10))) {
    const tamanho = m[1];
    const depois = texto.slice(m.index + m[0].length).trim();
    const mComb = /^COMB\d*:\s*(.+)$/i.exec(depois);
    const corTexto = mComb ? mComb[1].trim() : depois;
    return { tamanho, chave: corTexto.toUpperCase(), sugestao: titulo(corTexto) };
  }

  // 4. marcador "tam:" / "tam." / "tamanho:" — cor vem ANTES (ou após "CAB")
  m = /\btam\.?a?n?h?o?:?\s*(\d{2})\b/i.exec(texto);
  if (m && faixa(parseInt(m[1], 10))) {
    const tamanho = m[1];
    const antes = texto.slice(0, m.index).trim();
    const depois = texto.slice(m.index + m[0].length).trim();
    let residual = `${antes} ${depois}`.trim();
    residual = residual.replace(/\b\d[\d.,/]{1,}\b/g, "").trim();
    residual = residual.replace(/\s{2,}/g, " ");

    const mCab = /\bCAB\.?E?D?A?L?\.?\s+(.+)$/i.exec(antes);
    let sugestao: string;
    if (mCab) {
      const palavras = mCab[1].trim().split(/\s+/).filter(Boolean);
      while (palavras.length && /^[\d.,/]+$/.test(palavras[palavras.length - 1])) palavras.pop();
      sugestao = palavras.length ? titulo(palavras.join(" ")) : titulo(residual);
    } else {
      sugestao = residual ? titulo(residual) : "";
    }
    return { tamanho, chave: residual.toUpperCase(), sugestao };
  }

  const tokens = texto.split(/\s+/).filter(Boolean);
  if (tokens.length) {
    const ultimo = tokens[tokens.length - 1];

    // 5. último token = tamanho numérico (2 dígitos) ou em letra (P/M/G/GG/U...)
    if ((/^\d{2}$/.test(ultimo) && faixa(parseInt(ultimo, 10))) || TAMANHOS_LETRA.has(ultimo.toUpperCase())) {
      const tamanho = TAMANHOS_LETRA.has(ultimo.toUpperCase()) ? ultimo.toUpperCase() : ultimo;
      let antes = texto.slice(0, texto.length - ultimo.length).trim();
      antes = antes.replace(RE_NUM_LONGO, "").trim();
      antes = antes.replace(/\s{2,}/g, " ");
      return { tamanho, chave: antes.toUpperCase(), sugestao: titulo(ultimasPalavras(antes)) };
    }

    // 6. 4 dígitos colados = par sem barra (ex: "3334" -> "33/34")
    if (/^\d{4}$/.test(ultimo)) {
      const a = parseInt(ultimo.slice(0, 2), 10);
      const b = parseInt(ultimo.slice(2), 10);
      if (faixa(a) && faixa(b) && (b - a === 0 || b - a === 1)) {
        const tamanho = `${a}/${b}`;
        let antes = texto.slice(0, texto.length - ultimo.length).trim();
        antes = antes.replace(RE_NUM_LONGO, "").trim();
        antes = antes.replace(/\s{2,}/g, " ");
        return { tamanho, chave: antes.toUpperCase(), sugestao: titulo(ultimasPalavras(antes)) };
      }
    }
  }

  return { tamanho: "", chave: texto.toUpperCase(), sugestao: "" };
}

/** Sugestão só com números/pontuação não é nome de cor — melhor deixar vazio. */
function sugestaoValida(sugestao: string): string {
  if (!sugestao || !sugestao.trim()) return "";
  if (!/[A-Za-zÀ-ÿ]/.test(sugestao)) return "";
  return sugestao;
}

export interface AnaliseLinha extends Analise {
  veioCodFornecedor: boolean;
}

/**
 * Combina as duas estratégias: tenta primeiro o 'Cód. no fornecedor' e cai
 * para a análise da Descrição quando não bate, ou quando o código do meio
 * não é uma cor válida (só número).
 */
export function analisarLinha(descricao: Valor, codFornecedor: Valor): AnaliseLinha {
  const { tamanho: tamanhoCf, corcode } = tentarViaCodFornecedor(codFornecedor);

  if (tamanhoCf && corcode) {
    const sugestao = sugestaoValida(extrairExpansaoCor(descricao, corcode) ?? titulo(corcode));
    return { tamanho: tamanhoCf, chave: corcode, sugestao, veioCodFornecedor: true };
  }

  const d = analisarDescricao(descricao);
  const sugestao = sugestaoValida(d.sugestao);
  if (tamanhoCf && !d.tamanho) {
    return { tamanho: tamanhoCf, chave: d.chave || tamanhoCf, sugestao, veioCodFornecedor: false };
  }
  return { tamanho: d.tamanho, chave: d.chave, sugestao, veioCodFornecedor: false };
}

/** Remove prefixos/sufixos residuais tipo 'Cor:' ou ';Tamanho:37'. */
export function limparNomeCor(texto: Valor): string {
  let t = limpo(texto);
  t = t.replace(/^cor\s*:\s*/i, "");
  t = t.replace(/\s*;?\s*tamanho\s*:.*$/i, "");
  return t.replace(/^[ ;:]+|[ ;:]+$/g, "");
}

// ---------------------------------------------------------------------------
// Operações sobre a planilha
// ---------------------------------------------------------------------------
function definir(planilha: Planilha, indice: number, coluna: string, valor: Valor): void {
  if (!planilha.colunas.includes(coluna)) planilha.colunas.push(coluna);
  planilha.linhas[indice][coluna] = valor;
}

/** Normaliza a coluna Código (vazios viram ""), como o app original fazia ao abrir. */
export function normalizarCodigos(planilha: Planilha): void {
  if (!planilha.colunas.includes("Código")) planilha.colunas.unshift("Código");
  for (const linha of planilha.linhas) linha["Código"] = limpo(linha["Código"]);
}

/**
 * Retorna o índice da linha do PAI, ou null. Prioriza a linha que já tem
 * 'Código' preenchido (variações sempre começam com Código em branco).
 * Marca+Categoria só entram como critério auxiliar.
 */
export function detectarLinhaPai(planilha: Planilha): number | null {
  const { linhas } = planilha;
  const comCodigo: number[] = [];
  linhas.forEach((l, i) => {
    if (limpo(l["Código"])) comCodigo.push(i);
  });
  if (comCodigo.length === 1) return comCodigo[0];
  if (comCodigo.length > 1) {
    for (const i of comCodigo) {
      if (limpo(linhas[i]["Marca"]) && limpo(linhas[i]["Categoria do produto"])) return i;
    }
    return comCodigo[0];
  }
  for (let i = 0; i < linhas.length; i++) {
    if (limpo(linhas[i]["Marca"]) && limpo(linhas[i]["Categoria do produto"])) return i;
  }
  return null;
}

/**
 * Adiciona uma nova linha de PAI. Código e Descrição ficam em branco de
 * propósito — o Código do PAI é o que dá origem ao SKU das variações.
 */
export function criarLinhaPai(planilha: Planilha, dados: DadosNovoPai): number {
  const nova: Linha = {};
  for (const c of planilha.colunas) nova[c] = null;
  nova["Marca"] = dados.marca;
  nova["Categoria do produto"] = null; // categoria fica só nos filhos
  nova["Peso líquido (Kg)"] = dados.peso_liquido;
  nova["Peso bruto (Kg)"] = dados.peso_bruto;
  nova["Largura do produto"] = dados.largura;
  nova["Altura do Produto"] = dados.altura;
  nova["Profundidade do produto"] = dados.profundidade;
  nova["Volumes"] = dados.volumes;
  nova["Itens p/ caixa"] = dados.itens_caixa;
  nova["GTIN/EAN"] = "";
  nova["GTIN/EAN da Embalagem"] = "";
  nova["Estoque mínimo"] = ESTOQUE_MINIMO;
  nova["Estoque máximo"] = ESTOQUE_MAXIMO;
  if (dados.data_validade) nova["Data Validade"] = dados.data_validade;
  if (dados.codigo) nova["Código"] = dados.codigo;
  if (dados.descricao) nova["Descrição"] = dados.descricao;
  for (const c of Object.keys(nova)) if (!planilha.colunas.includes(c)) planilha.colunas.push(c);
  planilha.linhas.push(nova);
  return planilha.linhas.length - 1;
}

/**
 * Preenche todas as colunas 'de apoio' (peso, dimensões, marca, categoria,
 * estoque, validade, descrição curta) nas linhas filhas, a partir do PAI.
 */
export function processarVariacoes(
  planilha: Planilha,
  linhaPaiIdx: number,
  categoria: string,
  log: (mensagem: string) => void = () => {},
): Planilha {
  const paiRow = planilha.linhas[linhaPaiIdx];
  const pai: Record<string, Valor> = {};
  for (const c of COLUNAS_COPIAR_DO_PAI) pai[c] = paiRow[c] ?? null;
  const codigoPai = limpo(paiRow["Código"]);

  definir(planilha, linhaPaiIdx, "Categoria do produto", null);
  definir(planilha, linhaPaiIdx, "Estoque mínimo", ESTOQUE_MINIMO);
  definir(planilha, linhaPaiIdx, "Estoque máximo", ESTOQUE_MAXIMO);

  let total = 0;
  for (let i = 0; i < planilha.linhas.length; i++) {
    if (i === linhaPaiIdx) continue;
    definir(planilha, i, "Categoria do produto", categoria);
    for (const c of COLUNAS_COPIAR_DO_PAI) definir(planilha, i, c, pai[c]);
    definir(planilha, i, "Estoque mínimo", ESTOQUE_MINIMO);
    definir(planilha, i, "Estoque máximo", ESTOQUE_MAXIMO);
    if (codigoPai) definir(planilha, i, "Código Pai", codigoPai);
    total++;
  }

  log(`${total} variação(ões) preenchida(s) com os dados do PAI.`);
  if (codigoPai) {
    log(`Código Pai preenchido em todas as variações: ${codigoPai}`);
  } else {
    log("O PAI ainda não tem 'Código' preenchido — gere o código do PAI antes de gerar os SKUs das variações.");
  }
  return planilha;
}

export interface ResultadoAgrupamento {
  analisadas: Map<number, Analise>;
  grupos: Map<string, Grupo>;
}

/** Analisa todas as linhas filhas e agrupa por cor detectada. */
export function agruparVariacoes(planilha: Planilha, linhaPaiIdx: number): ResultadoAgrupamento {
  const analisadas = new Map<number, Analise>();
  const grupos = new Map<string, Grupo>();
  planilha.linhas.forEach((row, i) => {
    if (i === linhaPaiIdx) return;
    const r = analisarLinha(row["Descrição"], row["Cód. no fornecedor"]);
    analisadas.set(i, { tamanho: r.tamanho, chave: r.chave, sugestao: r.sugestao });
    let grupo = grupos.get(r.chave);
    if (!grupo) {
      grupo = { sugestao: r.sugestao, indices: [], tamanhos: [] };
      grupos.set(r.chave, grupo);
    }
    grupo.indices.push(i);
    grupo.tamanhos.push(r.tamanho || "?");
    if (r.veioCodFornecedor && r.sugestao.length > grupo.sugestao.length) grupo.sugestao = r.sugestao;
  });
  return { analisadas, grupos };
}

/** Ordena tamanhos como o app original: por comprimento e depois alfabético. */
export function tamanhosOrdenados(tamanhos: string[]): string[] {
  return [...new Set(tamanhos)].sort((a, b) => a.length - b.length || (a < b ? -1 : a > b ? 1 : 0));
}

/** SKU de uma variação: CódigoPai + abreviação da cor + tamanho. */
export function montarCodigo(codigoPai: string, abreviacao: string, tamanho: string): string {
  return `${codigoPai}${(abreviacao || "").trim().toUpperCase()}${tamanho}`;
}

/** Descrição de uma variação no formato aceito pelo Bling. */
export function montarDescricao(cor: string, tamanho: string): string {
  return `Cor:${limparNomeCor(cor)};Tamanho:${tamanho}`;
}

/**
 * Aplica as cores confirmadas pelo usuário ({chave: [cor, abreviação]}) e
 * escreve Código/Descrição em cada linha filha.
 * Retorna o total preenchido e as linhas (número da linha no Excel) sem tamanho.
 */
export function gerarCodigoEDescricao(
  planilha: Planilha,
  analisadas: Map<number, Analise>,
  grupos: Map<string, Grupo>,
  codigoPai: string,
  coresPorGrupo: Map<string, [string, string]>,
  bancoCores: BancoCores,
  marca: string,
): { total: number; linhasSemTamanho: number[] } {
  let total = 0;
  const linhasSemTamanho: number[] = [];
  for (const [chave, [corBruta, abrevBruta]] of coresPorGrupo) {
    const cor = limparNomeCor(corBruta);
    const abrev = (abrevBruta || "").trim().toUpperCase();
    if (!cor || !abrev) continue;
    aprenderAbreviacao(bancoCores, marca, cor, abrev);
    for (const i of grupos.get(chave)!.indices) {
      const tamanho = analisadas.get(i)!.tamanho;
      if (!tamanho) {
        linhasSemTamanho.push(i + 2);
        continue;
      }
      definir(planilha, i, "Código", montarCodigo(codigoPai, abrev, tamanho));
      definir(planilha, i, "Descrição", montarDescricao(cor, tamanho));
      total++;
    }
  }
  return { total, linhasSemTamanho };
}
