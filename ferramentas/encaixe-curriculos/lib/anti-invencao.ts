import { contemPalavraInteira, normalizar, termoEncontrado } from "./score";
import type { AvisoRevisao, LacunaConfirmada, PalavraChave } from "./tipos";

/**
 * Termos que faltavam no currículo original e que a pessoa NÃO confirmou
 * (confirmar = responder "Sim" e descrever onde e como).
 * Esses termos nunca podem aparecer no currículo ajustado.
 */
export function termosProibidos(
  faltando: PalavraChave[],
  confirmadas: LacunaConfirmada[]
): PalavraChave[] {
  const confirmados = new Set(
    confirmadas.filter((c) => c.descricao.trim().length > 0).map((c) => normalizar(c.termo))
  );
  return faltando.filter((p) => !confirmados.has(normalizar(p.termo)));
}

/** Lista os termos proibidos que aparecem no texto. */
export function encontrarTermosNaoConfirmados(
  texto: string,
  proibidos: PalavraChave[]
): PalavraChave[] {
  const normalizado = normalizar(texto);
  return proibidos.filter((p) => termoEncontrado(normalizado, p));
}

function segmentoContem(segmento: string, proibidos: PalavraChave[]): boolean {
  const normalizado = normalizar(segmento);
  return proibidos.some((p) => termoEncontrado(normalizado, p));
}

/**
 * Remove menções a termos proibidos quando elas estão em listas
 * (ex.: "Habilidades: Excel, Python, SQL"). Frases corridas são mantidas
 * e sinalizadas para revisão, para não apagar informação verdadeira.
 */
export function removerMencoes(texto: string, proibidos: PalavraChave[]): string {
  if (proibidos.length === 0) return texto;
  const linhas: string[] = [];

  for (const linha of texto.split("\n")) {
    if (!segmentoContem(linha, proibidos)) {
      linhas.push(linha);
      continue;
    }
    const prefixo = linha.match(/^(\s*(?:[-*•]\s+)?(?:[^:,;|]{1,40}:\s*)?)/)?.[1] ?? "";
    const corpo = linha.slice(prefixo.length);
    const itens = corpo.split(/\s*[,;|•·]\s*/).filter((s) => s.trim().length > 0);

    // Uma frase corrida sem rótulo ("Área: ...") não é lista: fica para revisão.
    if (itens.length < 2 && !prefixo.includes(":")) {
      linhas.push(linha);
      continue;
    }
    const mantidos = itens.filter((item) => !segmentoContem(item, proibidos));
    if (mantidos.length > 0) linhas.push(prefixo + mantidos.join(", "));
  }

  return linhas.join("\n");
}

function linhaCom(texto: string, teste: (linhaNormalizada: string, linha: string) => boolean) {
  return texto.split("\n").find((l) => teste(normalizar(l), l))?.trim() ?? "";
}

/**
 * Números (métricas, datas, quantidades) presentes no texto ajustado que não
 * aparecem no currículo original nem nas lacunas confirmadas.
 */
export function numerosInventados(texto: string, fontes: string[]): string[] {
  const fonte = fontes.join("\n");
  const numerosFonte = new Set(fonte.match(/\d+/g) ?? []);
  const digitosFonte = fonte.replace(/\D/g, "");
  const novos = new Set<string>();
  for (const n of texto.match(/\d+/g) ?? []) {
    if (!numerosFonte.has(n) && !digitosFonte.includes(n)) novos.add(n);
  }
  return [...novos];
}

/**
 * Validação anti-invenção executada depois da reescrita (seção 5.4).
 * Retorna os avisos que a pessoa precisa revisar; lista vazia = texto aprovado.
 */
export function validarAntiInvencao(params: {
  curriculoAjustado: string;
  curriculoOriginal: string;
  proibidos: PalavraChave[];
  confirmadas: LacunaConfirmada[];
}): AvisoRevisao[] {
  const { curriculoAjustado, curriculoOriginal, proibidos, confirmadas } = params;
  const avisos: AvisoRevisao[] = [];

  for (const p of encontrarTermosNaoConfirmados(curriculoAjustado, proibidos)) {
    const formas = [p.termo, ...p.variantes];
    avisos.push({
      tipo: "termo",
      valor: p.termo,
      trecho: linhaCom(curriculoAjustado, (ln) => formas.some((f) => contemPalavraInteira(ln, f))),
    });
  }

  const fontes = [curriculoOriginal, ...confirmadas.map((c) => c.descricao)];
  for (const n of numerosInventados(curriculoAjustado, fontes)) {
    avisos.push({
      tipo: "numero",
      valor: n,
      trecho: linhaCom(curriculoAjustado, (_, l) => new RegExp(`(^|\\D)${n}(\\D|$)`).test(l)),
    });
  }

  return avisos;
}
