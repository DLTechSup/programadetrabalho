import { normalizar } from "./score";

/**
 * Comparação entre o currículo original e o ajustado, para o visualizador.
 * Como o ajustado reorganiza seções, a comparação é por linha: uma linha
 * cujo conteúdo já existia no original (em qualquer lugar) é "igual";
 * uma parecida com alguma do original é "alterada" (com as palavras marcadas);
 * o resto é "nova". Linhas do original que sumiram são "removidas".
 */

export type TipoPedaco = "igual" | "novo" | "removido";
export interface Pedaco {
  tipo: TipoPedaco;
  texto: string;
}

export type TipoLinha = "igual" | "alterada" | "nova" | "titulo" | "vazia";
export interface LinhaComparada {
  tipo: TipoLinha;
  texto: string;
  /** Para linhas alteradas: a linha do original e as palavras que mudaram. */
  antes?: string;
  pedacos?: Pedaco[];
  /** A linha mudou quase toda: mostrar antes e depois inteiros é mais claro que palavra a palavra. */
  reescrita?: boolean;
}

export interface Comparacao {
  linhas: LinhaComparada[];
  removidas: string[];
  resumo: { alteradas: number; novas: number; removidas: number };
}

const MARCADOR = /^\s*(?:[-*•·▪►✓➢]|\d+[.)])\s+/;

function chave(linha: string): string {
  return normalizar(linha.replace(MARCADOR, ""));
}

function palavras(linha: string): Set<string> {
  return new Set(chave(linha).split(" ").filter((p) => p.length > 2));
}

function semelhanca(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let comuns = 0;
  for (const p of a) if (b.has(p)) comuns++;
  return comuns / Math.max(a.size, b.size);
}

/** Diferença palavra a palavra (LCS), mantendo pontuação e espaços. */
export function diffPalavras(antes: string, depois: string): Pedaco[] {
  const a = antes.replace(MARCADOR, "").split(/(\s+)/).filter(Boolean);
  const b = depois.replace(MARCADOR, "").split(/(\s+)/).filter(Boolean);
  const eq = (x: string, y: string) => normalizar(x) === normalizar(y) && (normalizar(x) !== "" || x === y);
  const n = a.length;
  const m = b.length;
  const tabela = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      tabela[i][j] = eq(a[i], b[j]) ? tabela[i + 1][j + 1] + 1 : Math.max(tabela[i + 1][j], tabela[i][j + 1]);
    }
  }
  const pedacos: Pedaco[] = [];
  const empurrar = (tipo: TipoPedaco, texto: string) => {
    const ultimo = pedacos[pedacos.length - 1];
    if (ultimo && ultimo.tipo === tipo) ultimo.texto += texto;
    else pedacos.push({ tipo, texto });
  };
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (eq(a[i], b[j])) {
      empurrar("igual", b[j]);
      i++;
      j++;
    } else if (tabela[i + 1][j] >= tabela[i][j + 1]) {
      empurrar("removido", a[i++]);
    } else {
      empurrar("novo", b[j++]);
    }
  }
  while (i < n) empurrar("removido", a[i++]);
  while (j < m) empurrar("novo", b[j++]);
  // Espaços isolados entre mudanças ficam neutros.
  return pedacos.map((p) => (p.texto.trim() === "" ? { ...p, tipo: "igual" as const } : p));
}

export function compararCurriculos(original: string, ajustado: string, titulos: (l: string) => boolean): Comparacao {
  const linhasOriginais = original.split("\n").map((l) => l.trim()).filter(Boolean);
  const textoOriginal = ` ${normalizar(original)} `;
  const conjuntos = linhasOriginais.map(palavras);
  const usadas = new Set<number>();

  const linhas: LinhaComparada[] = ajustado.split("\n").map((bruta) => {
    const texto = bruta.trim();
    if (!texto) return { tipo: "vazia", texto };
    if (titulos(texto)) return { tipo: "titulo", texto };
    const k = chave(texto);
    const exata = linhasOriginais.findIndex((l) => chave(l) === k);
    if (exata !== -1) {
      usadas.add(exata);
      return { tipo: "igual", texto };
    }
    // Conteúdo já existente (ex.: frase que estava quebrada em várias linhas).
    if (k.length > 0 && textoOriginal.includes(` ${k} `)) {
      linhasOriginais.forEach((l, i) => {
        if (k.includes(chave(l)) && chave(l).length > 3) usadas.add(i);
      });
      return { tipo: "igual", texto };
    }
    const minhas = palavras(texto);
    let melhor = -1;
    let nota = 0;
    conjuntos.forEach((c, i) => {
      const s = semelhanca(minhas, c);
      if (s > nota) {
        nota = s;
        melhor = i;
      }
    });
    if (melhor !== -1 && nota >= 0.4) {
      usadas.add(melhor);
      const pedacos = diffPalavras(linhasOriginais[melhor], texto);
      const total = pedacos.reduce((n, p) => n + p.texto.length, 0);
      const mudou = pedacos.filter((p) => p.tipo !== "igual").reduce((n, p) => n + p.texto.length, 0);
      return { tipo: "alterada", texto, antes: linhasOriginais[melhor], pedacos, reescrita: mudou / Math.max(total, 1) > 0.55 };
    }
    return { tipo: "nova", texto };
  });

  // Linhas do original que não aparecem mais (títulos antigos não contam).
  const conteudoFinal = ` ${normalizar(ajustado)} `;
  const removidas = linhasOriginais.filter(
    (l, i) => !usadas.has(i) && !titulos(l) && chave(l).length > 3 && !conteudoFinal.includes(` ${chave(l)} `)
  );

  return {
    linhas,
    removidas,
    resumo: {
      alteradas: linhas.filter((l) => l.tipo === "alterada").length,
      novas: linhas.filter((l) => l.tipo === "nova").length,
      removidas: removidas.length,
    },
  };
}
