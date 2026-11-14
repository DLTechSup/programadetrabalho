import { DICIONARIO } from "../dicionario";
import { normalizar } from "../score";
import { PADROES_ESCRITA, PALAVRAS_ERRADAS } from "./erros-comuns";
import { VerificadorHunspell } from "./hunspell";

/**
 * Revisão de ortografia e escrita do currículo, feita no navegador.
 * O dicionário (VERO, português do Brasil) é baixado do próprio site só quando necessário.
 */

export interface Problema {
  id: string;
  tipo: "ortografia" | "escrita";
  /** Trecho exatamente como está no texto. */
  trecho: string;
  sugestoes: string[];
  explicacao: string;
  ocorrencias: number;
  /** Linha onde aparece pela primeira vez, para dar contexto. */
  contexto: string;
}

export interface Revisao {
  problemas: Problema[];
  palavrasVerificadas: number;
}

let carregando: Promise<VerificadorHunspell> | null = null;

export function carregarVerificador(): Promise<VerificadorHunspell> {
  carregando ??= (async () => {
    const base = `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/dicionario`;
    const [aff, dic] = await Promise.all(
      ["pt-BR.aff", "pt-BR.dic"].map(async (nome) => {
        const resposta = await fetch(`${base}/${nome}`);
        if (!resposta.ok) throw new Error(`Dicionário indisponível (${resposta.status})`);
        return resposta.text();
      })
    );
    return new VerificadorHunspell(aff, dic);
  })().catch((e) => {
    carregando = null;
    throw e;
  });
  return carregando;
}

/** Termos em inglês e de mercado comuns em currículos brasileiros. */
const TERMOS_DE_MERCADO =
  "dashboard dashboards data warehouse business intelligence insight insights feedback feedbacks marketing software hardware design designer startup startups online offline email e-mail know-how skill skills soft hard home office freelancer freela front back end full stack deploy framework frameworks cloud analytics machine learning big pipeline pipelines sprint sprints backlog stakeholder stakeholders kpi kpis okr okrs lean trade inbound outbound sales ads performance compliance report reports job coach coaching mindset customer success team leader head manager trainee junior pleno jr sr linkedin github gmail hotmail outlook whatsapp instagram facebook youtube tiktok google microsoft excel word powerpoint office scrum kanban agile devops frontend backend fullstack mobile web app apps site sites checklist briefing budget benchmarking branding ecommerce e-commerce copywriter social media influencer ux ui api apis bi crm erp sap sql".split(
    " "
  );

function termosConhecidos(extras: string[]): Set<string> {
  const conjunto = new Set<string>(TERMOS_DE_MERCADO);
  for (const e of DICIONARIO) {
    for (const forma of [e.termo, ...e.variantes]) for (const p of normalizar(forma).split(" ")) conjunto.add(p);
  }
  for (const t of extras) for (const p of normalizar(t).split(" ")) if (p) conjunto.add(p);
  return conjunto;
}

/** Mantém a caixa da palavra original: "EXPERIENCIA" -> "EXPERIÊNCIA", "Analise" -> "Análise". */
function mesmaCaixa(original: string, correcao: string): string {
  if (original.length > 1 && original === original.toLocaleUpperCase("pt-BR")) return correcao.toLocaleUpperCase("pt-BR");
  if (/^\p{Lu}/u.test(original)) return correcao.charAt(0).toLocaleUpperCase("pt-BR") + correcao.slice(1);
  return correcao;
}

const PALAVRA = /\p{L}+(?:[-'’]\p{L}+)*/gu;

/** Palavra dentro de e-mail, link ou nome de arquivo? */
function dentroDeEnderecoOuCodigo(linha: string, inicio: number, fim: number): boolean {
  const antes = linha.slice(0, inicio).split(/\s/).pop() ?? "";
  const depois = linha.slice(fim).split(/\s/)[0] ?? "";
  const pedaco = antes + linha.slice(inicio, fim) + depois;
  return /[@/\\]|www\.|\.(com|br|net|org|io)\b|\p{L}\.\p{L}/iu.test(pedaco);
}

function inicioDeFrase(linha: string, inicio: number): boolean {
  const antes = linha.slice(0, inicio).replace(/^\s*(?:[-*•·]\s+)?/, "");
  return antes.trim() === "" || /[.!?:]\s*$/.test(antes);
}

export function revisarTexto(texto: string, verificador: VerificadorHunspell, extras: string[] = []): Revisao {
  const conhecidos = termosConhecidos(extras);
  const porTrecho = new Map<string, Problema>();
  let palavrasVerificadas = 0;

  const registrar = (p: Omit<Problema, "ocorrencias">) => {
    const existente = porTrecho.get(p.id);
    if (existente) existente.ocorrencias++;
    else porTrecho.set(p.id, { ...p, ocorrencias: 1 });
  };

  for (const linha of texto.split("\n")) {
    if (!linha.trim()) continue;

    // Construções de escrita
    for (const padrao of PADROES_ESCRITA) {
      padrao.regex.lastIndex = 0;
      for (const m of linha.matchAll(padrao.regex)) {
        const correcao = padrao.corrigir(m[0], ...m.slice(1));
        if (correcao === m[0]) continue;
        registrar({
          id: `escrita:${padrao.id}:${m[0].toLowerCase()}`,
          tipo: "escrita",
          trecho: m[0],
          sugestoes: [correcao],
          explicacao: padrao.explicacao,
          contexto: linha.trim(),
        });
      }
    }

    // Ortografia, palavra por palavra
    for (const m of linha.matchAll(PALAVRA)) {
      const palavra = m[0];
      const inicio = m.index ?? 0;
      const fim = inicio + palavra.length;
      palavrasVerificadas++;
      const minuscula = palavra.toLocaleLowerCase("pt-BR");

      const comum = PALAVRAS_ERRADAS[minuscula];
      if (comum) {
        const sugestao = mesmaCaixa(palavra, comum);
        registrar({
          id: `ortografia:${minuscula}`,
          tipo: "ortografia",
          trecho: palavra,
          sugestoes: [sugestao],
          explicacao: "Grafia incorreta ou sem acento.",
          contexto: linha.trim(),
        });
        continue;
      }

      if (palavra.length < 3) continue;
      if (conhecidos.has(normalizar(palavra))) continue;
      if (/\p{Lu}/u.test(palavra.slice(1))) continue; // siglas e nomes como "PostgreSQL"
      if (/^\p{Lu}/u.test(palavra) && !inicioDeFrase(linha, inicio)) continue; // nomes próprios
      if (dentroDeEnderecoOuCodigo(linha, inicio, fim)) continue;
      if (verificador.correta(palavra)) continue;
      if (palavra.includes("-") && palavra.split("-").every((p) => p.length < 3 || verificador.correta(p))) continue;

      registrar({
        id: `ortografia:${minuscula}`,
        tipo: "ortografia",
        trecho: palavra,
        sugestoes: verificador.sugerir(palavra).map((sug) => mesmaCaixa(palavra, sug)),
        explicacao: "Palavra não encontrada no dicionário.",
        contexto: linha.trim(),
      });
    }
  }

  return { problemas: [...porTrecho.values()], palavrasVerificadas };
}

/** Troca todas as ocorrências do trecho (palavra inteira) pela correção. */
export function corrigirNoTexto(texto: string, trecho: string, correcao: string): string {
  const escapado = trecho.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Limite de palavra só nas pontas que são letras/números (", mais " começa e termina com pontuação/espaço).
  const antes = /^[\p{L}\p{N}]/u.test(trecho) ? "(?<![\\p{L}\\p{N}])" : "";
  const depois = /[\p{L}\p{N}]$/u.test(trecho) ? "(?![\\p{L}\\p{N}])" : "";
  const re = new RegExp(`${antes}${escapado}${depois}`, "gu");
  return texto.replace(re, correcao);
}
