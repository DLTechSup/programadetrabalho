// Legenda do Grupo A (foto + marca + referência): separa a marca da referência -- mesma lógica
// do legenda.py original.
import { compactar, detectarMarca } from "./marcas";
import { nomeSeguro } from "./referencia";

export interface Demanda {
  marca: string | null;
  referencia: string | null;
  original: string;
}

export function demandaCompleta(d: Demanda): boolean {
  return !!(d.marca && d.referencia);
}

export function nomePastaDemanda(d: Demanda): string {
  return nomeSeguro(`${d.marca} ${d.referencia}`);
}

/** 'BEIRA RIO 8513.115' -> (BEIRA RIO, 8513.115). Referência = tudo que não é a marca, do jeito que veio. */
export function dividirLegenda(legenda: string, marcas: Record<string, string[]>): Demanda {
  const texto = (legenda || "").replace(/\n/g, " ").replace(/\s+/g, " ").trim();
  if (!texto) return { marca: null, referencia: null, original: "" };
  const marca = detectarMarca(texto, marcas);
  if (marca) {
    const resto = tirarMarca(texto, [...marcas[marca], marca]);
    return { marca: marca.toUpperCase(), referencia: resto || null, original: texto };
  }
  // marca desconhecida: se há um código com número, o que vem antes dele é a marca
  const m = /(?<!\S)(\S*\d\S*(?:\s\S*\d\S*)?)\s*$/.exec(texto);
  if (m && m.index > 0) {
    return { marca: texto.slice(0, m.index).trim().toUpperCase() || null, referencia: m[1].trim(), original: texto };
  }
  return { marca: null, referencia: texto, original: texto };
}

/** Remove da legenda as palavras que formam a marca (tolera acentos, caixa e espaços). */
function tirarMarca(texto: string, apelidos: string[]): string {
  const palavras = texto.split(" ");
  const ordenados = [...apelidos].sort((x, y) => y.length - x.length);
  for (const ap of ordenados) {
    const alvo = compactar(ap);
    for (let i = 0; i < palavras.length; i++) {
      let acumulado = "";
      for (let j = i; j < palavras.length; j++) {
        acumulado += compactar(palavras[j]);
        if (acumulado === alvo) {
          return [...palavras.slice(0, i), ...palavras.slice(j + 1)].join(" ").trim().replace(/^[ \-:.]+|[ \-:.]+$/g, "");
        }
        if (acumulado.length >= alvo.length) break;
      }
    }
  }
  // marca achada por aproximação (erro de digitação): remove as primeiras palavras equivalentes em tamanho
  const nMarca = Math.max(1, apelidos[0].split(" ").length);
  return palavras.slice(nMarca).join(" ").trim().replace(/^[ \-:.]+|[ \-:.]+$/g, "");
}
