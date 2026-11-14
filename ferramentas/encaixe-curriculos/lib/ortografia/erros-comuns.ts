/**
 * Erros comuns em currículos que o dicionário sozinho não pega
 * (palavras que existem como outra forma, ex.: "experiencia" é verbo)
 * e construções de escrita. Para incluir um novo, acrescente um item.
 */

/** Palavra errada (minúsculas) -> correção. */
export const PALAVRAS_ERRADAS: Record<string, string> = {
  experiencia: "experiência", experiencias: "experiências", gerencia: "gerência", referencia: "referência",
  referencias: "referências", competencia: "competência", competencias: "competências", eficiencia: "eficiência",
  vivencia: "vivência", vivencias: "vivências", ciencia: "ciência", agencia: "agência", sequencia: "sequência",
  frequencia: "frequência", historia: "história", analise: "análise", analises: "análises", publico: "público",
  numero: "número", numeros: "números", tecnico: "técnico",
  logistica: "logística", comercio: "comércio", servico: "serviço", servicos: "serviços",
  concerteza: "com certeza", derrepente: "de repente", apartir: "a partir", porisso: "por isso", denovo: "de novo",
  menas: "menos", seje: "seja", esteje: "esteja", excessão: "exceção", previlégio: "privilégio",
  impecilho: "empecilho", beneficiente: "beneficente", reinvindicar: "reivindicar", reinvindicação: "reivindicação",
  "auto-estima": "autoestima", "pró-ativo": "proativo", "pró-ativa": "proativa", proativade: "proatividade",
  mussarela: "muçarela", asterístico: "asterisco", cabeleleiro: "cabeleireiro",
  estrupo: "estupro", previnir: "prevenir", deslise: "deslize",
};

export interface PadraoEscrita {
  id: string;
  regex: RegExp;
  corrigir: (trecho: string, ...grupos: string[]) => string;
  explicacao: string;
}

/** Construções comuns de escrita (gramática, crase, conjunções). */
export const PADROES_ESCRITA: PadraoEscrita[] = [
  {
    id: "mas-mais",
    regex: /,\s*mais\s+(?=(?:n[aã]o|o|a|os|as|eu|ele|ela|tamb[eé]m|sempre|isso|foi|era|com|sem|ainda|consegui|aprendi)\b)/giu,
    corrigir: (t) => t.replace(/mais/i, "mas"),
    explicacao: "Conjunção: “mas” indica oposição (= porém); “mais” indica quantidade.",
  },
  {
    id: "ha-tempo",
    regex: /(?<!\b(?:daqui|até|de|em)\s)\ba\s+(\d+|um|uma|dois|duas|tr[eê]s|alguns|algumas|muitos|v[aá]rios)\s+(anos?|meses|m[eê]s|dias?)\b/giu,
    corrigir: (t) => t.replace(/^a/i, "há"),
    explicacao: "Para tempo que já passou, use “há” (verbo haver): “há 5 anos”.",
  },
  {
    id: "ha-atras",
    regex: /\bh[aá]\s+([\p{L}\d]+\s+(?:anos?|meses|dias?))\s+atr[aá]s\b/giu,
    corrigir: (_t, periodo) => `há ${periodo}`,
    explicacao: "“Há” já indica passado; “atrás” fica repetido. Use “há 5 anos” ou “5 anos atrás”.",
  },
  {
    id: "fazem-anos",
    regex: /\bfazem\s+(\d+|alguns|muitos|v[aá]rios)\s+(anos|meses|dias)\b/giu,
    corrigir: (t) => t.replace(/fazem/i, "faz"),
    explicacao: "Com tempo decorrido, “fazer” fica no singular: “faz 3 anos”.",
  },
  {
    id: "houveram",
    regex: /\bhouveram\b/giu,
    corrigir: () => "houve",
    explicacao: "No sentido de “existir” ou “acontecer”, “haver” fica no singular: “houve mudanças”.",
  },
  {
    id: "crase-verbo",
    regex: /\bà\s+(partir|fazer|realizar|trabalhar|nível)\b/giu,
    corrigir: (t, p) => (p.toLowerCase() === "nível" ? "em nível" : `a ${p}`),
    explicacao: "Não há crase antes de verbo nem em “a partir”.",
  },
  {
    id: "as-vezes",
    regex: /\bas\s+vezes\b/giu,
    corrigir: (t) => (t[0] === "A" ? "Às vezes" : "às vezes"),
    explicacao: "“Às vezes” (= de vez em quando) leva crase.",
  },
  {
    id: "a-medida",
    regex: /\ba\s+medida\s+(?=que\b)/giu,
    corrigir: (t) => (t[0] === "A" ? "À medida " : "à medida "),
    explicacao: "“À medida que” (= conforme) leva crase.",
  },
  {
    id: "afim-de",
    regex: /\bafim\s+de\b/giu,
    corrigir: () => "a fim de",
    explicacao: "“A fim de” (= para) é separado; “afim” significa “semelhante”.",
  },
  {
    id: "para-mim-verbo",
    regex: /\bpara\s+mim\s+(?=\p{L}+(?:ar|er|ir)\b)/giu,
    corrigir: () => "para eu ",
    explicacao: "Antes de verbo, use “para eu” (quem faz a ação): “para eu desenvolver”.",
  },
  {
    id: "entre-eu",
    regex: /\bentre\s+eu\s+e\b/giu,
    corrigir: () => "entre mim e",
    explicacao: "Depois de preposição, use “mim”: “entre mim e a equipe”.",
  },
  {
    id: "palavra-repetida",
    regex: /\b(\p{L}{2,})\s+\1\b/giu,
    corrigir: (_t, palavra) => palavra,
    explicacao: "Palavra repetida.",
  },
];
