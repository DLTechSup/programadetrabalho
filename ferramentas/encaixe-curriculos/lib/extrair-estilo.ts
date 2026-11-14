import {
  ESTILO_PADRAO,
  ehNegrito,
  familiaDaFonte,
  limparNomeFonte,
  normalizarEstilo,
  type EstiloCurriculo,
} from "./estilo";
import { secaoDoTitulo } from "./reescrever-curriculo";

/** Uma linha do documento original com a aparência do seu texto principal. */
export interface LinhaEstilizada {
  texto: string;
  tamanho: number;
  fonte: string;
  negrito: boolean;
  cor: string;
  centralizada: boolean;
  bordaInferior?: boolean;
}

function moda<T>(valores: Array<[T, number]>, padrao: T): T {
  const pesos = new Map<T, number>();
  for (const [v, p] of valores) pesos.set(v, (pesos.get(v) ?? 0) + p);
  let melhor = padrao;
  let maior = -1;
  for (const [v, p] of pesos) {
    if (p > maior) {
      melhor = v;
      maior = p;
    }
  }
  return melhor;
}

const pareceContato = (t: string) => /@|\d{4}|linkedin|www\.|https?:/i.test(t);

/** Decide o estilo a partir das linhas: nome, títulos de seção e corpo do texto. */
export function estiloDasLinhas(
  linhasBrutas: LinhaEstilizada[],
  origem: "pdf" | "docx",
  margem?: number
): EstiloCurriculo {
  const linhas = linhasBrutas.filter((l) => l.texto.trim());
  if (linhas.length === 0) return { ...ESTILO_PADRAO };

  // Nome: entre as primeiras linhas, a maior que não seja contato.
  const inicio = linhas.slice(0, 4).filter((l) => !pareceContato(l.texto) && !secaoDoTitulo(l.texto));
  const nome = inicio.reduce<LinhaEstilizada | undefined>(
    (maior, l) => (!maior || l.tamanho > maior.tamanho ? l : maior),
    undefined
  );

  const titulos = linhas.filter((l) => secaoDoTitulo(l.texto));
  const corpo = linhas.filter((l) => l !== nome && !titulos.includes(l));
  const peso = (l: LinhaEstilizada) => l.texto.length;

  const tamanhoCorpo = moda(corpo.map((l) => [l.tamanho, peso(l)]), ESTILO_PADRAO.tamanhoCorpo);
  const fonte = moda(
    [...corpo, ...titulos].map((l) => [l.fonte, peso(l)]),
    ESTILO_PADRAO.fonte
  );
  const corTexto = moda(corpo.map((l) => [l.cor, peso(l)]), "#000000");
  const titulo = titulos.length
    ? {
        tamanho: moda(titulos.map((t) => [t.tamanho, 1]), tamanhoCorpo),
        cor: moda(titulos.map((t) => [t.cor, 1]), corTexto),
        negrito: titulos.filter((t) => t.negrito).length * 2 >= titulos.length,
        maiusculo: titulos.every((t) => t.texto === t.texto.toUpperCase()),
        borda: titulos.some((t) => t.bordaInferior),
      }
    : null;

  return normalizarEstilo({
    origem,
    fonte,
    familia: familiaDaFonte(fonte),
    tamanhoCorpo,
    tamanhoNome: nome?.tamanho ?? tamanhoCorpo,
    tamanhoTitulo: titulo?.tamanho ?? tamanhoCorpo,
    corTexto,
    corNome: nome?.cor ?? corTexto,
    corTitulo: titulo?.cor ?? corTexto,
    nomeNegrito: nome?.negrito ?? true,
    tituloNegrito: titulo?.negrito ?? true,
    tituloMaiusculo: titulo?.maiusculo ?? true,
    linhaAbaixoTitulo: titulo?.borda ?? false,
    alinhamentoNome: nome?.centralizada ? "center" : "left",
    margem: margem ?? ESTILO_PADRAO.margem,
  });
}

/* ----------------------------- Word (.docx) ----------------------------- */


function filho(el: Element | null | undefined, nome: string): Element | null {
  if (!el) return null;
  for (const c of Array.from(el.children)) if (c.localName === nome) return c;
  return null;
}

function atributo(el: Element | null, nome: string): string | null {
  if (!el) return null;
  for (const a of Array.from(el.attributes)) {
    if (a.localName === nome || a.name === `w:${nome}`) return a.value;
  }
  return null;
}

/** Descendentes pelo nome local (independe de como o parser trata namespaces). */
function todos(raiz: Document | Element | null | undefined, nome: string): Element[] {
  if (!raiz) return [];
  return Array.from(raiz.getElementsByTagName("*")).filter((e) => e.localName === nome);
}

interface PropsTexto {
  fonte?: string;
  tamanho?: number;
  cor?: string;
  negrito?: boolean;
  maiusculo?: boolean;
}

function lerRPr(rPr: Element | null, tema: { menor?: string; maior?: string }): PropsTexto {
  if (!rPr) return {};
  const p: PropsTexto = {};
  const fontes = filho(rPr, "rFonts");
  if (fontes) {
    const direta = atributo(fontes, "ascii") ?? atributo(fontes, "hAnsi");
    const doTema = atributo(fontes, "asciiTheme") ?? atributo(fontes, "hAnsiTheme");
    p.fonte = direta ?? (doTema?.startsWith("major") ? tema.maior : doTema ? tema.menor : undefined);
  }
  const sz = atributo(filho(rPr, "sz"), "val");
  if (sz) p.tamanho = Number(sz) / 2;
  const cor = atributo(filho(rPr, "color"), "val");
  if (cor) p.cor = cor === "auto" ? "#000000" : `#${cor}`;
  const b = filho(rPr, "b");
  if (b) p.negrito = !["0", "false"].includes(atributo(b, "val") ?? "");
  const caps = filho(rPr, "caps");
  if (caps) p.maiusculo = !["0", "false"].includes(atributo(caps, "val") ?? "");
  return p;
}

export async function estiloDoDocx(dados: ArrayBuffer): Promise<EstiloCurriculo> {
  const { default: JSZip } = await import("jszip");
  const zip = await JSZip.loadAsync(dados);
  const ler = async (caminho: string) => {
    const arquivo = zip.file(caminho);
    return arquivo ? new DOMParser().parseFromString(await arquivo.async("text"), "application/xml") : null;
  };
  const [documento, estilos, temaXml] = await Promise.all([
    ler("word/document.xml"),
    ler("word/styles.xml"),
    ler("word/theme/theme1.xml"),
  ]);
  if (!documento) return { ...ESTILO_PADRAO };

  const tema = {
    menor: todos(todos(temaXml, "minorFont")[0], "latin")[0]?.getAttribute("typeface") ?? undefined,
    maior: todos(todos(temaXml, "majorFont")[0], "latin")[0]?.getAttribute("typeface") ?? undefined,
  };

  // Estilos: padrão do documento, estilos de parágrafo e de caractere (com herança).
  const mapa = new Map<string, Element>();
  let paragrafoPadrao: string | null = null;
  for (const s of Array.from(todos(estilos, "style"))) {
    const id = atributo(s, "styleId");
    if (!id) continue;
    mapa.set(id, s);
    if (atributo(s, "type") === "paragraph" && ["1", "true"].includes(atributo(s, "default") ?? "")) {
      paragrafoPadrao = id;
    }
  }
  const padraoDoc = lerRPr(
    filho(filho(todos(estilos, "docDefaults")[0], "rPrDefault"), "rPr"),
    tema
  );

  const cadeia = (id: string | null, visitados = new Set<string>()): Element[] => {
    if (!id || visitados.has(id)) return [];
    visitados.add(id);
    const s = mapa.get(id);
    if (!s) return [];
    return [...cadeia(atributo(filho(s, "basedOn"), "val"), visitados), s];
  };
  const propsDoEstilo = (id: string | null): PropsTexto =>
    cadeia(id).reduce<PropsTexto>((acc, s) => ({ ...acc, ...lerRPr(filho(s, "rPr"), tema) }), {});
  const pPrDoEstilo = (id: string | null) => cadeia(id).map((s) => filho(s, "pPr"));

  const linhas: LinhaEstilizada[] = [];
  for (const p of todos(documento, "p")) {
    const pPr = filho(p, "pPr");
    const estiloP = atributo(filho(pPr, "pStyle"), "val") ?? paragrafoPadrao;
    const baseP = { ...padraoDoc, ...propsDoEstilo(paragrafoPadrao), ...propsDoEstilo(estiloP) };

    let texto = "";
    let principal: PropsTexto = baseP;
    let maiorTrecho = -1;
    for (const r of todos(p, "r")) {
      const t = todos(r, "t").map((n) => n.textContent ?? "").join("");
      if (!t) continue;
      texto += t;
      const rPr = filho(r, "rPr");
      const props = { ...baseP, ...propsDoEstilo(atributo(filho(rPr, "rStyle"), "val")), ...lerRPr(rPr, tema) };
      if (t.trim().length > maiorTrecho) {
        maiorTrecho = t.trim().length;
        principal = props;
      }
    }
    if (!texto.trim()) continue;

    const pPrs = [...pPrDoEstilo(estiloP), pPr];
    const jc = pPrs.map((x) => atributo(filho(x, "jc"), "val")).filter(Boolean).pop();
    const borda = pPrs.some((x) => {
      const b = filho(filho(x, "pBdr"), "bottom");
      return b && atributo(b, "val") !== "nil" && atributo(b, "val") !== "none";
    });

    linhas.push({
      texto: principal.maiusculo ? texto.toUpperCase() : texto,
      tamanho: principal.tamanho ?? 10,
      fonte: principal.fonte ?? "Times New Roman",
      negrito: !!principal.negrito,
      cor: principal.cor ?? "#000000",
      centralizada: jc === "center",
      bordaInferior: borda,
    });
  }

  const margemTwips = Number(atributo(todos(documento, "pgMar")[0] ?? null, "left"));
  return estiloDasLinhas(linhas, "docx", margemTwips ? margemTwips / 20 : undefined);
}

/* --------------------------------- PDF --------------------------------- */

interface ItemPdf {
  str: string;
  fontName: string;
  transform: number[];
  width: number;
}

type PdfJs = typeof import("pdfjs-dist/legacy/build/pdf.mjs");
type PaginaPdf = Awaited<ReturnType<Awaited<ReturnType<PdfJs["getDocument"]>["promise"]>["getPage"]>>;

/** Lê fonte, tamanho, cor e posição do texto das primeiras páginas do PDF. */
export async function estiloDoPdf(pdfjs: PdfJs, paginas: PaginaPdf[]): Promise<EstiloCurriculo> {
  const linhas: LinhaEstilizada[] = [];
  let margem = Infinity;

  for (const pagina of paginas.slice(0, 2)) {
    const [conteudo, operacoes] = await Promise.all([pagina.getTextContent(), pagina.getOperatorList()]);
    const largura = pagina.view[2] - pagina.view[0];

    // Cor de cada trecho de texto, na ordem em que é desenhado.
    const trechos: Array<{ texto: string; cor: string }> = [];
    let cor = "#000000";
    operacoes.fnArray.forEach((fn, i) => {
      const args = operacoes.argsArray[i];
      if (fn === pdfjs.OPS.setFillRGBColor && typeof args?.[0] === "string") cor = args[0];
      else if (fn === pdfjs.OPS.setFillGray || fn === pdfjs.OPS.setFillTransparent) cor = "#000000";
      else if (fn === pdfjs.OPS.showText || fn === pdfjs.OPS.showSpacedText) {
        const glifos: unknown[] = args?.[0] ?? [];
        const texto = glifos
          .map((g) => (g && typeof g === "object" && "unicode" in g ? String((g as { unicode: string }).unicode) : ""))
          .join("")
          .trim();
        if (texto) trechos.push({ texto, cor });
      }
    });
    const corDaLinha = (texto: string) => {
      const achado = trechos.find((t) => t.texto.length >= 2 && texto.includes(t.texto));
      return achado?.cor ?? moda(trechos.map((t) => [t.cor, t.texto.length]), "#000000");
    };

    const nomeReal = (fontName: string): string => {
      try {
        const f = pagina.commonObjs.get(fontName) as { name?: string } | undefined;
        return f?.name ?? conteudo.styles[fontName]?.fontFamily ?? "";
      } catch {
        return conteudo.styles[fontName]?.fontFamily ?? "";
      }
    };

    // Agrupa os itens em linhas pela posição vertical.
    const grupos: ItemPdf[][] = [];
    for (const item of conteudo.items as ItemPdf[]) {
      if (!item.str?.trim()) continue;
      const y = item.transform[5];
      const ultimo = grupos[grupos.length - 1];
      if (ultimo && Math.abs(ultimo[0].transform[5] - y) <= 2) ultimo.push(item);
      else grupos.push([item]);
    }

    for (const grupo of grupos) {
      const texto = grupo.map((i) => i.str).join(" ").replace(/\s+/g, " ").trim();
      const principal = grupo.reduce((a, b) => (b.str.length > a.str.length ? b : a));
      const inicio = Math.min(...grupo.map((i) => i.transform[4]));
      const fim = Math.max(...grupo.map((i) => i.transform[4] + i.width));
      margem = Math.min(margem, inicio);
      const bruto = nomeReal(principal.fontName);
      linhas.push({
        texto,
        tamanho: Math.abs(principal.transform[3]) || Math.hypot(principal.transform[2], principal.transform[3]),
        fonte: limparNomeFonte(bruto),
        negrito: ehNegrito(bruto),
        cor: corDaLinha(texto),
        centralizada: Math.abs((inicio + fim) / 2 - largura / 2) < largura * 0.06 && fim - inicio < largura * 0.7,
      });
    }
  }

  const estilo = estiloDasLinhas(linhas, "pdf", Number.isFinite(margem) ? margem : undefined);
  // Nomes genéricos ("sans-serif") não identificam a fonte: usa a padrão da família.
  if (/^(sans-serif|serif|monospace)$/i.test(estilo.fonte)) {
    estilo.fonte = estilo.familia === "serif" ? "Times New Roman" : estilo.familia === "mono" ? "Courier" : "Helvetica";
  }
  return estilo;
}
