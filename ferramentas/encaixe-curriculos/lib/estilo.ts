/**
 * Identidade visual do currículo enviado (fonte, tamanhos, cores, alinhamento),
 * usada para gerar o currículo ajustado com a mesma cara do original,
 * sempre em uma coluna para continuar legível pelos sistemas ATS.
 */

export type FamiliaFonte = "sans" | "serif" | "mono";

export interface EstiloCurriculo {
  origem: "pdf" | "docx" | "padrao";
  fonte: string;
  familia: FamiliaFonte;
  tamanhoCorpo: number;
  tamanhoNome: number;
  tamanhoTitulo: number;
  corTexto: string;
  corNome: string;
  corTitulo: string;
  nomeNegrito: boolean;
  tituloNegrito: boolean;
  tituloMaiusculo: boolean;
  linhaAbaixoTitulo: boolean;
  alinhamentoNome: "left" | "center";
  /** Margens em pontos (1 cm ≈ 28,35 pt). */
  margem: number;
}

export const ESTILO_PADRAO: EstiloCurriculo = {
  origem: "padrao",
  fonte: "Helvetica",
  familia: "sans",
  tamanhoCorpo: 10.5,
  tamanhoNome: 11,
  tamanhoTitulo: 11,
  corTexto: "#000000",
  corNome: "#000000",
  corTitulo: "#000000",
  nomeNegrito: true,
  tituloNegrito: true,
  tituloMaiusculo: true,
  linhaAbaixoTitulo: false,
  alinhamentoNome: "left",
  margem: 56.69,
};

const limitar = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** Mantém o estilo dentro de limites que continuam legíveis e aceitos por ATS. */
export function normalizarEstilo(e: Partial<EstiloCurriculo> & Pick<EstiloCurriculo, "origem">): EstiloCurriculo {
  const base = { ...ESTILO_PADRAO, ...e };
  const corpo = limitar(round(base.tamanhoCorpo), 9, 12.5);
  return {
    ...base,
    fonte: base.fonte.trim() || ESTILO_PADRAO.fonte,
    tamanhoCorpo: corpo,
    tamanhoNome: limitar(round(base.tamanhoNome), corpo, 28),
    tamanhoTitulo: limitar(round(base.tamanhoTitulo), corpo, 18),
    corTexto: corLegivel(base.corTexto),
    corNome: corLegivel(base.corNome),
    corTitulo: corLegivel(base.corTitulo),
    margem: limitar(base.margem, 28, 90),
  };
}

function round(v: number) {
  return Math.round(v * 2) / 2;
}

/** Cores muito claras (quase brancas) ficam ilegíveis no papel branco: usa preto. */
export function corLegivel(cor: string): string {
  const hex = /^#?([0-9a-f]{6})$/i.exec(cor.trim())?.[1];
  if (!hex) return "#000000";
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const luminancia = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  // Contraste mínimo de 4.5:1 sobre branco.
  return 1.05 / (luminancia + 0.05) >= 4.5 ? `#${hex.toLowerCase()}` : "#000000";
}

/** "ABCDEF+Calibri-Bold" -> "Calibri"; "TimesNewRomanPSMT" -> "Times New Roman". */
export function limparNomeFonte(nome: string): string {
  let n = nome.replace(/^[A-Z]{6}\+/, "");
  n = n.replace(/[-,](Bold|Italic|Oblique|Regular|Roman|Semibold|SemiBold|Light|Medium|Black|Heavy|Book|Demi|BoldItalic|BoldMT|MT|PSMT|PS)+.*$/i, "");
  n = n.replace(/(PSMT|MT|PS)$/, "");
  n = n.replace(/([a-z])([A-Z])/g, "$1 $2").trim();
  return n || nome;
}

export function familiaDaFonte(nome: string, dica?: string): FamiliaFonte {
  const n = `${nome} ${dica ?? ""}`.toLowerCase();
  if (/courier|mono|consolas|cousine|menlo/.test(n)) return "mono";
  if (/sans/.test(n)) return "sans";
  if (/times|georgia|garamond|cambria|caladea|book ?antiqua|palatino|serif|minion|baskerville|merriweather|lora|playfair|tinos|gelasio|bodoni|didot|century/.test(n)) {
    return "serif";
  }
  return "sans";
}

export function ehNegrito(nomeFonte: string): boolean {
  return /bold|black|heavy|semibold|demi/i.test(nomeFonte);
}

/**
 * Fontes gratuitas equivalentes (métrica compatível ou mesma família) para o PDF.
 * Chave: nome normalizado da fonte original. Valor: pacote do Fontsource.
 */
const EQUIVALENTES: Record<string, string> = {
  calibri: "carlito",
  carlito: "carlito",
  cambria: "caladea",
  caladea: "caladea",
  georgia: "gelasio",
  garamond: "eb-garamond",
  "eb garamond": "eb-garamond",
  "open sans": "open-sans",
  lato: "lato",
  montserrat: "montserrat",
  roboto: "roboto",
  raleway: "raleway",
  poppins: "poppins",
  "source sans pro": "source-sans-3",
  "source sans 3": "source-sans-3",
  nunito: "nunito",
  merriweather: "merriweather",
  lora: "lora",
  "pt sans": "pt-sans",
  "pt serif": "pt-serif",
  "work sans": "work-sans",
  ubuntu: "ubuntu",
  "noto sans": "noto-sans",
  inter: "inter",
  "playfair display": "playfair-display",
  "segoe ui": "open-sans",
  verdana: "noto-sans",
  tahoma: "noto-sans",
  "century gothic": "poppins",
};

export function pacoteFonteEquivalente(fonte: string): string | null {
  return EQUIVALENTES[fonte.toLowerCase().replace(/\s+/g, " ").trim()] ?? null;
}

/** Fontes padrão do PDF usadas quando não há equivalente disponível. */
export function fontePadraoPdf(familia: FamiliaFonte): { normal: string; negrito: string } {
  if (familia === "serif") return { normal: "Times-Roman", negrito: "Times-Bold" };
  if (familia === "mono") return { normal: "Courier", negrito: "Courier-Bold" };
  return { normal: "Helvetica", negrito: "Helvetica-Bold" };
}

/** Descrição curta para mostrar na tela, ex.: "Calibri 11 pt, títulos em azul". */
export function descreverEstilo(e: EstiloCurriculo): string {
  const partes = [`${e.fonte} ${String(e.tamanhoCorpo).replace(".", ",")} pt`];
  if (e.corTitulo !== "#000000") partes.push(`títulos na cor ${e.corTitulo.toUpperCase()}`);
  if (e.alinhamentoNome === "center") partes.push("nome centralizado");
  if (e.linhaAbaixoTitulo) partes.push("linha abaixo dos títulos");
  return partes.join(", ");
}
