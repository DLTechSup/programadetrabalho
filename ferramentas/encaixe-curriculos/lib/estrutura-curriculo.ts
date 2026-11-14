import { TITULOS_SECOES } from "./constantes";
import { normalizar } from "./score";

export type BlocoCurriculo =
  | { tipo: "nome"; texto: string }
  | { tipo: "contato"; texto: string }
  | { tipo: "titulo"; texto: string }
  | { tipo: "topico"; texto: string }
  | { tipo: "paragrafo"; texto: string }
  | { tipo: "espaco" };

const TITULOS = new Set(TITULOS_SECOES.map((t) => normalizar(t)));

function ehTitulo(linha: string): boolean {
  const limpa = linha.replace(/[:#*]/g, "").trim();
  if (TITULOS.has(normalizar(limpa))) return true;
  // Outras linhas curtas totalmente em maiúsculas também são tratadas como título.
  return limpa.length > 2 && limpa.length <= 40 && /^[A-ZÀ-Ü\s&/]+$/.test(limpa);
}

/** Organiza o texto do currículo ajustado em blocos para o PDF. */
export function estruturarCurriculo(texto: string): BlocoCurriculo[] {
  const blocos: BlocoCurriculo[] = [];
  let antesDaPrimeiraSecao = true;
  let nomeDefinido = false;

  for (const bruta of texto.replace(/\r/g, "").split("\n")) {
    const linha = bruta.trim();
    if (!linha) {
      if (blocos.length && blocos[blocos.length - 1].tipo !== "espaco") blocos.push({ tipo: "espaco" });
      continue;
    }
    if (ehTitulo(linha) && nomeDefinido) {
      antesDaPrimeiraSecao = false;
      blocos.push({ tipo: "titulo", texto: linha.replace(/[:#*]/g, "").trim().toUpperCase() });
      continue;
    }
    if (antesDaPrimeiraSecao) {
      blocos.push(nomeDefinido ? { tipo: "contato", texto: linha } : { tipo: "nome", texto: linha });
      nomeDefinido = true;
      continue;
    }
    const topico = linha.match(/^[-*•·]\s+(.*)$/);
    blocos.push(topico ? { tipo: "topico", texto: topico[1] } : { tipo: "paragrafo", texto: linha });
  }
  return blocos;
}

const PERMITIDOS_WINANSI = new Set([..."€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ"]);

/** Mantém apenas caracteres que a fonte Helvetica padrão do PDF consegue representar. */
export function textoSeguroParaPdf(texto: string): string {
  return [...texto]
    .map((c) => {
      const codigo = c.codePointAt(0) ?? 0;
      if (codigo <= 0xff || PERMITIDOS_WINANSI.has(c)) return c;
      if (c === "→") return "->";
      return "";
    })
    .join("");
}

const TITULOS_EXIBICAO: Record<string, string> = {
  "resumo profissional": "Resumo profissional",
  experiencia: "Experiência",
  formacao: "Formação",
  habilidades: "Habilidades",
  "certificacoes e idiomas": "Certificações e idiomas",
};

/** Título de seção em maiúsculas ou no formato "Experiência", conforme o estilo do original. */
export function tituloExibido(titulo: string, maiusculo: boolean): string {
  if (maiusculo) return titulo.toUpperCase();
  const n = normalizar(titulo);
  return TITULOS_EXIBICAO[n] ?? titulo.charAt(0).toUpperCase() + titulo.slice(1).toLowerCase();
}
