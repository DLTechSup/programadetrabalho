import type { PalavraChave, ResultadoMatch } from "./tipos";

export const PESO_OBRIGATORIO = 3;
export const PESO_DESEJAVEL = 1;

/**
 * Termos cuja pontuação carrega significado. São trocados por tokens
 * antes de remover a pontuação, para "C++" não virar "c".
 */
const TOKENS_ESPECIAIS: Array<[RegExp, string]> = [
  [/c\+\+/g, " cplusplus "],
  [/c#/g, " csharp "],
  [/f#/g, " fsharp "],
  [/(^|[^a-z0-9])\.net\b/g, "$1 dotnet "],
];

/** Minúsculas, sem acentos, sem pontuação e com espaços únicos. */
export function normalizar(texto: string): string {
  let t = texto.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  for (const [padrao, troca] of TOKENS_ESPECIAIS) t = t.replace(padrao, troca);
  return t
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Verifica se `termo` aparece como palavra(s) inteira(s) no texto já normalizado. */
export function contemPalavraInteira(textoNormalizado: string, termo: string): boolean {
  const t = normalizar(termo);
  if (!t) return false;
  return ` ${textoNormalizado} `.includes(` ${t} `);
}

/** Um termo é encontrado se ele ou qualquer variante aparece como palavra inteira. */
export function termoEncontrado(textoNormalizado: string, palavra: PalavraChave): boolean {
  return [palavra.termo, ...palavra.variantes].some((v) => contemPalavraInteira(textoNormalizado, v));
}

export function pesoDe(palavra: PalavraChave): number {
  return palavra.obrigatorio ? PESO_OBRIGATORIO : PESO_DESEJAVEL;
}

/**
 * Compara o currículo com as palavras-chave da vaga.
 * Função pura: mesmos textos e mesmas palavras-chave produzem sempre o mesmo resultado.
 */
export function calcularMatch(curriculo: string, palavras: PalavraChave[]): ResultadoMatch {
  const texto = normalizar(curriculo);
  const encontradas: PalavraChave[] = [];
  const faltando: PalavraChave[] = [];
  let pesoTotal = 0;
  let pesoEncontrado = 0;

  for (const palavra of palavras) {
    const peso = pesoDe(palavra);
    pesoTotal += peso;
    if (termoEncontrado(texto, palavra)) {
      encontradas.push(palavra);
      pesoEncontrado += peso;
    } else {
      faltando.push(palavra);
    }
  }

  const score = pesoTotal === 0 ? 0 : Math.round((pesoEncontrado / pesoTotal) * 100);
  return { score, encontradas, faltando };
}

export type FaixaScore = { rotulo: string; nivel: "baixo" | "medio" | "alto" };

export function faixaDoScore(score: number): FaixaScore {
  if (score >= 75) return { rotulo: "Alto encaixe", nivel: "alto" };
  if (score >= 50) return { rotulo: "Encaixe médio", nivel: "medio" };
  return { rotulo: "Baixo encaixe", nivel: "baixo" };
}
