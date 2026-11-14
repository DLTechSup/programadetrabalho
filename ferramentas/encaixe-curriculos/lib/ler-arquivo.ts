import type { EstiloCurriculo } from "./estilo";

/**
 * Lê o currículo enviado como arquivo, inteiramente no navegador.
 * Nada é enviado para servidor algum.
 */

export const TAMANHO_MAXIMO_ARQUIVO = 10 * 1024 * 1024;
export const TIPOS_ACEITOS = ".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain";

export class ErroLeitura extends Error {}

export interface ArquivoLido {
  texto: string;
  /** Identidade visual do arquivo (null para .txt ou se não der para ler). */
  estilo: EstiloCurriculo | null;
}

function extensao(nome: string) {
  return nome.toLowerCase().split(".").pop() ?? "";
}

interface ItemTexto {
  str: string;
  hasEOL?: boolean;
  transform?: number[];
  height?: number;
}

/** Junta os pedaços de texto de uma página do PDF em linhas, respeitando a posição vertical. */
export function montarLinhasPdf(itens: ItemTexto[]): string {
  let texto = "";
  let ultimoY: number | null = null;
  let alturaLinha = 12;
  for (const item of itens) {
    const y = item.transform?.[5];
    if (y !== undefined && ultimoY !== null && Math.abs(y - ultimoY) > 1) {
      if (!texto.endsWith("\n")) texto += "\n";
      // Espaço grande entre linhas costuma separar seções.
      if (Math.abs(y - ultimoY) > alturaLinha * 1.8 && !texto.endsWith("\n\n")) texto += "\n";
    }
    texto += item.str;
    if (item.hasEOL && !texto.endsWith("\n")) texto += "\n";
    if (y !== undefined) ultimoY = y;
    if (item.height) alturaLinha = item.height;
  }
  return texto;
}

async function lerPdf(arquivo: File): Promise<ArquivoLido> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/pdf.worker.min.js`;
  const dados = new Uint8Array(await arquivo.arrayBuffer());
  const tarefa = pdfjs.getDocument({ data: dados });
  let doc;
  try {
    doc = await tarefa.promise;
  } catch (e) {
    if (e instanceof Error && e.name === "PasswordException") {
      throw new ErroLeitura("Esse PDF está protegido por senha. Remova a senha ou cole o texto abaixo.");
    }
    throw new ErroLeitura("Não conseguimos abrir esse PDF. Tente outro arquivo ou cole o texto abaixo.");
  }
  const textos: string[] = [];
  const paginas = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const pagina = await doc.getPage(i);
    if (i <= 2) paginas.push(pagina);
    const conteudo = await pagina.getTextContent();
    textos.push(montarLinhasPdf(conteudo.items as ItemTexto[]));
  }
  let estilo: EstiloCurriculo | null = null;
  try {
    const { estiloDoPdf } = await import("./extrair-estilo");
    estilo = await estiloDoPdf(pdfjs, paginas);
  } catch (e) {
    console.warn("Não foi possível ler o estilo do PDF", e);
  }
  await tarefa.destroy();
  return { texto: textos.join("\n\n"), estilo };
}

async function lerDocx(arquivo: File): Promise<ArquivoLido> {
  const mammoth = await import("mammoth");
  const dados = await arquivo.arrayBuffer();
  let texto: string;
  try {
    texto = (await mammoth.extractRawText({ arrayBuffer: dados })).value;
  } catch {
    throw new ErroLeitura("Não conseguimos abrir esse arquivo do Word. Tente salvar como PDF ou cole o texto abaixo.");
  }
  let estilo: EstiloCurriculo | null = null;
  try {
    const { estiloDoDocx } = await import("./extrair-estilo");
    estilo = await estiloDoDocx(dados);
  } catch (e) {
    console.warn("Não foi possível ler o estilo do Word", e);
  }
  return { texto, estilo };
}

/** Normaliza espaços e quebras de linha do texto extraído. */
export function limparTextoExtraido(texto: string): string {
  return texto
    .replace(/\r/g, "")
    .replace(/ /g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function lerCurriculoDeArquivo(arquivo: File): Promise<ArquivoLido> {
  if (arquivo.size > TAMANHO_MAXIMO_ARQUIVO) {
    throw new ErroLeitura("O arquivo passa de 10 MB. Envie um arquivo menor ou cole o texto abaixo.");
  }
  const ext = extensao(arquivo.name);
  let lido: ArquivoLido;
  if (ext === "pdf" || arquivo.type === "application/pdf") lido = await lerPdf(arquivo);
  else if (ext === "docx") lido = await lerDocx(arquivo);
  else if (ext === "txt" || arquivo.type === "text/plain") lido = { texto: await arquivo.text(), estilo: null };
  else if (ext === "doc") {
    throw new ErroLeitura("Arquivos .doc (Word antigo) não são suportados. Salve como .docx ou PDF, ou cole o texto abaixo.");
  } else {
    throw new ErroLeitura("Formato não suportado. Envie um PDF, Word (.docx) ou .txt, ou cole o texto abaixo.");
  }

  const limpo = limparTextoExtraido(lido.texto);
  if (limpo.length < 50) {
    throw new ErroLeitura(
      "Não encontramos texto nesse arquivo. Se ele for uma imagem ou um PDF digitalizado, copie o texto e cole abaixo."
    );
  }
  return { texto: limpo, estilo: lido.estilo };
}
