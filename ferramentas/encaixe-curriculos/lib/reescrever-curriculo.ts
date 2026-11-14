import { calcularMatch, contemPalavraInteira, normalizar } from "./score";
import { removerMencoes, termosProibidos, validarAntiInvencao } from "./anti-invencao";
import type { LacunaConfirmada, PalavraChave, ResultadoReescrita } from "./tipos";

/**
 * Reescreve o currículo no formato ATS sem IA, usando apenas o que já está
 * no texto original e as lacunas confirmadas pela pessoa:
 * reorganiza nas seções padrão, ordena experiências, padroniza tópicos com
 * verbos de ação e troca sinônimos pelo termo exato da vaga.
 */

type Secao = "resumo" | "experiencia" | "formacao" | "habilidades" | "certificacoes" | "outros";

const TITULOS_CV: Array<[Secao, string[]]> = [
  ["resumo", ["resumo", "resumo profissional", "perfil", "perfil profissional", "objetivo", "objetivo profissional", "objetivos", "sobre mim", "sobre", "apresentacao", "sumario", "summary", "about", "about me", "profile"]],
  ["experiencia", ["experiencia", "experiencias", "experiencia profissional", "experiencias profissionais", "historico profissional", "trajetoria profissional", "atuacao profissional", "carreira", "experience", "work experience", "projetos", "projetos relevantes"]],
  ["formacao", ["formacao", "formacao academica", "escolaridade", "educacao", "education", "formacao escolar"]],
  ["habilidades", ["habilidades", "competencias", "conhecimentos", "conhecimentos tecnicos", "habilidades tecnicas", "habilidades e competencias", "competencias tecnicas", "skills", "hard skills", "soft skills", "ferramentas", "tecnologias", "conhecimentos em informatica", "informatica"]],
  ["certificacoes", ["certificacoes", "certificados", "certificacoes e cursos", "cursos e certificacoes", "cursos", "cursos complementares", "cursos extracurriculares", "idiomas", "languages", "qualificacoes", "certificacoes e idiomas", "idiomas e certificacoes", "licencas e certificados"]],
  ["outros", ["informacoes adicionais", "informacoes complementares", "voluntariado", "trabalho voluntario", "atividades extracurriculares", "premios", "premiacoes", "publicacoes", "interesses", "outras informacoes"]],
];

const MAPA_TITULOS = new Map<string, Secao>(TITULOS_CV.flatMap(([s, ts]) => ts.map((t) => [t, s] as const)));

export function secaoDoTitulo(linha: string): Secao | null {
  const limpa = linha.replace(/^[#*\s]+|[:：*\s]+$/g, "");
  if (!limpa || limpa.length > 45 || /\d/.test(limpa)) return null;
  return MAPA_TITULOS.get(normalizar(limpa)) ?? null;
}

const MARCADOR = /^\s*(?:[-*•·▪►✓➢>o]|\d+[.)])\s+/;

const RE_EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/;
const RE_TELEFONE = /(?:\+?55\s?)?\(?\d{2}\)?\s?9?\d{4}[-.\s]?\d{4}/;
const RE_URL = /(?:https?:\/\/|www\.)\S+|(?:linkedin|github|behance)\.com\/\S+/i;
const RE_LOCAL = /^[A-Za-zÀ-ÿ' ]{2,40}\s*[,/-]\s*[A-Z]{2}$/;

function ehContato(t: string) {
  return RE_EMAIL.test(t) || RE_TELEFONE.test(t) || RE_URL.test(t) || RE_LOCAL.test(t.trim());
}

function pareceNome(t: string) {
  const palavras = t.trim().split(/\s+/);
  return (
    t.length <= 60 && palavras.length >= 1 && palavras.length <= 6 && !/\d|@/.test(t) && !/[.!?:]$/.test(t)
  );
}

const RE_FORMACAO =
  /gradua[cç][aã]o|graduad[ao]|bacharel|licenciatura|tecn[oó]logo|universidade|faculdade|\bmba\b|p[oó]s[- ]?gradua|mestrado|doutorado|ensino m[eé]dio|ensino superior|t[eé]cnico em|forma[cç][aã]o em|\busp\b|\bunicamp\b|\bunesp\b|\bpuc\b|\bfgv\b/i;
const RE_CERTIFICACAO = /certifica|certificado|\bcurso\b|cursos|ingl[eê]s|espanhol|franc[eê]s|alem[aã]o|italiano|idioma|flu[eê]ncia/i;
const RE_ROTULO_HABILIDADES = /^(conhecimentos?|habilidades|compet[eê]ncias|ferramentas|skills|tecnologias)\b[^:]{0,30}:\s*/i;

interface Blocos {
  nome: string;
  contatos: string[];
  secoes: Record<Secao, string[]>;
  semTitulos: boolean;
}

function vazio(): Record<Secao, string[]> {
  return { resumo: [], experiencia: [], formacao: [], habilidades: [], certificacoes: [], outros: [] };
}

/** Separa cabeçalho (nome e contatos) em fragmentos e devolve o que não é contato. */
function lerCabecalho(linhas: string[], blocos: Blocos): string[] {
  const sobras: string[] = [];
  for (const linha of linhas) {
    for (const fragmento of linha.split(/\s+[|•·–—-]\s+|\s{3,}|\t/)) {
      const f = fragmento.trim();
      if (!f) continue;
      // "Estado civil: casada", "Nascimento: …": informação curta do cabeçalho, não resumo.
      if (/^[^:]{2,25}:\s*\S/.test(f) && f.length <= 60) {
        blocos.contatos.push(f);
        continue;
      }
      if (ehContato(f) && f.length > 60) {
        // Contato colado a texto corrido: separa o contato do resto.
        let resto = f;
        for (const re of [RE_EMAIL, RE_URL, RE_TELEFONE]) {
          const achado = resto.match(re);
          if (achado) {
            blocos.contatos.push(achado[0]);
            resto = resto.replace(achado[0], " ");
          }
        }
        resto = resto.replace(/^[\s.,;|-]+/, "").trim();
        if (resto) sobras.push(resto);
      } else if (ehContato(f)) blocos.contatos.push(f);
      else if (!blocos.nome && pareceNome(f)) blocos.nome = f;
      else sobras.push(f);
    }
  }
  return sobras;
}

function dividirFrases(texto: string): string[] {
  return texto
    .split(/(?<=[.!?])\s+(?=[A-ZÀ-Ý0-9])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Currículo sem títulos de seção: classifica frase a frase. */
function classificarFrases(frases: string[], blocos: Blocos) {
  frases.forEach((frase, i) => {
    const semPonto = frase.replace(/[.;]$/, "");
    if (i === 0 && semPonto.length <= 40 && !/\d/.test(semPonto) && semPonto.split(" ").length <= 5) {
      blocos.contatos.push(semPonto);
    } else if (RE_ROTULO_HABILIDADES.test(frase)) {
      blocos.secoes.habilidades.push(frase.replace(RE_ROTULO_HABILIDADES, ""));
    } else if (RE_FORMACAO.test(frase) && !/\b(atuo|atuei|trabalh|respons[aá]vel)/i.test(frase)) {
      blocos.secoes.formacao.push(frase);
    } else if (RE_CERTIFICACAO.test(frase) && frase.length < 160) {
      blocos.secoes.certificacoes.push(frase);
    } else {
      blocos.secoes.experiencia.push(frase);
    }
  });
}

export function lerCurriculo(texto: string): Blocos {
  const linhas = texto
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.replace(/\s+$/, ""))
    .filter((l) => l.trim());

  const blocos: Blocos = { nome: "", contatos: [], secoes: vazio(), semTitulos: false };
  const cabecalho: string[] = [];
  let atual: Secao | null = null;

  for (const linha of linhas) {
    const t = linha.trim();
    const titulo = secaoDoTitulo(t);
    if (titulo) {
      atual = titulo;
      continue;
    }
    // "Habilidades: Excel, SQL" na mesma linha.
    const inline = t.match(/^([^:]{3,40}):\s*(.+)$/);
    const tituloInline = inline ? secaoDoTitulo(inline[1]) : null;
    if (tituloInline && inline) {
      atual = tituloInline;
      blocos.secoes[atual].push(inline[2]);
      continue;
    }
    if (atual) blocos.secoes[atual].push(t);
    else cabecalho.push(t);
  }

  const temTitulos = Object.values(blocos.secoes).some((s) => s.length > 0);
  if (temTitulos) {
    const sobras = lerCabecalho(cabecalho, blocos);
    if (sobras.length) blocos.secoes.resumo.unshift(...sobras);
  } else {
    blocos.semTitulos = true;
    const [primeira = "", ...resto] = cabecalho;
    const sobras = lerCabecalho([primeira], blocos);
    classificarFrases(dividirFrases([...sobras, ...resto].join(" ")), blocos);
  }
  return blocos;
}

/* ---------- Verbos de ação ---------- */

const VERBOS: Record<string, string> = {
  elaboracao: "Elaborei", desenvolvimento: "Desenvolvi", criacao: "Criei", implantacao: "Implantei",
  implementacao: "Implementei", gerenciamento: "Gerenciei", analise: "Analisei", acompanhamento: "Acompanhei",
  controle: "Controlei", coordenacao: "Coordenei", organizacao: "Organizei", planejamento: "Planejei",
  execucao: "Executei", treinamento: "Treinei", emissao: "Emiti", lancamento: "Lancei", conciliacao: "Conciliei",
  monitoramento: "Monitorei", realizacao: "Realizei", conducao: "Conduzi", lideranca: "Liderei",
  automacao: "Automatizei", automatizacao: "Automatizei", otimizacao: "Otimizei", estruturacao: "Estruturei",
  definicao: "Defini", revisao: "Revisei", mapeamento: "Mapeei", integracao: "Integrei", construcao: "Construí",
  producao: "Produzi", prospeccao: "Prospectei", supervisao: "Supervisionei", negociacao: "Negociei",
  gestao: "Geri", atualizacao: "Atualizei", preparacao: "Preparei", manutencao: "Mantive", validacao: "Validei",
  padronizacao: "Padronizei", apuracao: "Apurei", confeccao: "Confeccionei", redacao: "Redigi",
};

const ARTIGO: Record<string, string> = { de: "", do: "o ", da: "a ", dos: "os ", das: "as " };

/** "Elaboração de relatórios" -> "Elaborei relatórios". */
export function comVerboDeAcao(item: string): { texto: string; mudou: boolean } {
  const m = item.match(/^([A-Za-zÀ-ÿ]+)\s+(de|do|da|dos|das)\s+(.+)$/i);
  if (m) {
    const verbo = VERBOS[normalizar(m[1])];
    if (verbo) return { texto: `${verbo} ${ARTIGO[m[2].toLowerCase()]}${m[3]}`, mudou: true };
  }
  const p = item.match(/^participa[cç][aã]o\s+(em|no|na|nos|nas)\s+(.+)$/i);
  if (p) {
    const prep: Record<string, string> = { em: "de", no: "do", na: "da", nos: "dos", nas: "das" };
    return { texto: `Participei ${prep[p[1].toLowerCase()]} ${p[2]}`, mudou: true };
  }
  return { texto: item, mudou: false };
}

function maiuscula(t: string) {
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/* ---------- Experiência ---------- */

const RE_ANO = /\b(19[6-9]\d|20[0-4]\d)\b/g;
const RE_ANO_TESTE = /\b(19[6-9]\d|20[0-4]\d)\b/;
const RE_ATUAL = /\b(atual|atualmente|presente|hoje|o momento|current|now)\b/i;

interface Entrada {
  cabecalho: string[];
  itens: string[];
}

const temData = (linha: string) => RE_ANO_TESTE.test(linha) || RE_ATUAL.test(linha);

function ehCabecalhoDeExperiencia(linha: string, proxima?: string): boolean {
  if (MARCADOR.test(linha)) return false;
  if (linha.length > 110 || /[.;]$/.test(linha)) return false;
  if (temData(linha) || linha.includes(" | ")) return true;
  // Cargo numa linha e empresa/período na seguinte.
  return linha.length <= 70 && !!proxima && !MARCADOR.test(proxima) && temData(proxima) && proxima.length <= 110;
}

function agruparExperiencias(linhas: string[]): Entrada[] {
  const entradas: Entrada[] = [];
  let atual: Entrada | null = null;
  linhas.forEach((linha, i) => {
    const cab = ehCabecalhoDeExperiencia(linha, linhas[i + 1]);
    if (cab && (!atual || atual.itens.length > 0)) {
      atual = { cabecalho: [linha], itens: [] };
      entradas.push(atual);
    } else if (cab && atual && atual.cabecalho.length < 3) {
      atual.cabecalho.push(linha);
    } else {
      if (!atual) {
        atual = { cabecalho: [], itens: [] };
        entradas.push(atual);
      }
      atual.itens.push(linha.replace(MARCADOR, ""));
    }
  });
  return entradas;
}

function recencia(e: Entrada): number | null {
  const texto = e.cabecalho.join(" ");
  if (RE_ATUAL.test(texto)) return 9999;
  const anos = texto.match(RE_ANO);
  return anos ? Math.max(...anos.map(Number)) : null;
}

/* ---------- Sinônimos -> termo da vaga ---------- */

const ACENTOS: Record<string, string> = {
  a: "[aáàâãä]", e: "[eéèêë]", i: "[iíìîï]", o: "[oóòôõö]", u: "[uúùûü]", c: "[cç]",
};

function regexSemAcento(forma: string): RegExp {
  const corpo = [...normalizar(forma).replace(/ /g, "\u0000")]
    .map((ch) => (ch === "\u0000" ? "[\\s\\-./]+" : ACENTOS[ch] ?? ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
    .join("");
  return new RegExp(`(?<![\\p{L}\\p{N}.@/#+-])${corpo}(?![\\p{L}\\p{N}@#+]|[.-][\\p{L}\\p{N}])`, "giu");
}

function trocarSinonimos(
  linhas: string[],
  original: string,
  encontradas: PalavraChave[],
  mudancas: string[]
): string[] {
  let resultado = linhas;
  const corpo = normalizar(original);
  for (const p of encontradas) {
    if (contemPalavraInteira(corpo, p.termo)) continue; // o original já usa o termo exato
    for (const variante of p.variantes) {
      if (normalizar(variante).length < 3) continue;
      const re = regexSemAcento(variante);
      let usado = "";
      resultado = resultado.map((l) =>
        l.replace(re, (achado) => {
          usado ||= achado;
          return p.termo;
        })
      );
      if (usado) {
        mudancas.push(`Termo '${p.termo}' usado no lugar de '${usado}'`);
        break;
      }
    }
  }
  return resultado;
}

/* ---------- Montagem ---------- */

function listarItens(linhas: string[]): string[] {
  return linhas
    .map((l) => l.replace(MARCADOR, "").replace(RE_ROTULO_HABILIDADES, ""))
    .flatMap((l) => (l.length <= 160 ? l.split(/\s*[,;|•·]\s*/) : [l]))
    .map((i) => i.replace(/[.;]+$/, "").trim())
    .filter(Boolean);
}

/** Termo no meio da frase: "Atendimento ao cliente" -> "atendimento ao cliente"; "Power BI" e "Excel" ficam. */
export function termoNaFrase(termo: string): string {
  const palavras = termo.split(" ");
  if (palavras.length < 2 || /\p{Lu}/u.test(termo.slice(1))) return termo;
  return termo.charAt(0).toLocaleLowerCase("pt-BR") + termo.slice(1);
}

function juntarLista(itens: string[]): string {
  if (itens.length <= 1) return itens.join("");
  return `${itens.slice(0, -1).join(", ")} e ${itens[itens.length - 1]}`;
}

export function reescreverCurriculo(params: {
  curriculo: string;
  palavras: PalavraChave[];
  confirmadas: LacunaConfirmada[];
}): ResultadoReescrita {
  const { curriculo, palavras } = params;
  const { encontradas, faltando } = calcularMatch(curriculo, palavras);
  const confirmadas = params.confirmadas.filter(
    (c) => c.descricao.trim() && faltando.some((f) => normalizar(f.termo) === normalizar(c.termo))
  );
  const proibidos = termosProibidos(faltando, confirmadas);
  const categoriaDe = (termo: string) => palavras.find((p) => normalizar(p.termo) === normalizar(termo))?.categoria;

  const blocos = lerCurriculo(curriculo);
  const s = blocos.secoes;
  const mudancas: string[] = [];

  // Experiência
  const entradas = agruparExperiencias([...s.experiencia]);
  const anos = entradas.map(recencia);
  if (entradas.length > 1 && anos.every((a) => a !== null)) {
    const ordenadas = entradas
      .map((e, i) => ({ e, i, a: anos[i] as number }))
      .sort((x, y) => y.a - x.a || x.i - y.i);
    if (ordenadas.some((o, i) => o.i !== i)) mudancas.push("Experiências ordenadas da mais recente para a mais antiga");
    entradas.splice(0, entradas.length, ...ordenadas.map((o) => o.e));
  }
  let verbos = 0;
  const linhasExperiencia: string[] = [];
  entradas.forEach((e, i) => {
    if (i > 0) linhasExperiencia.push("");
    if (e.cabecalho.length) linhasExperiencia.push(e.cabecalho.join(" | "));
    for (const item of e.itens) {
      const { texto, mudou } = comVerboDeAcao(item.replace(/[;]+$/, ""));
      if (mudou) verbos++;
      linhasExperiencia.push(`- ${maiuscula(texto)}`);
    }
  });
  if (verbos) mudancas.push(`${verbos} tópico(s) de experiência começando com verbo de ação`);

  // Lacunas confirmadas: cursos/certificações ou experiência complementar.
  const certConfirmadas: string[] = [];
  const habConfirmadas: string[] = [];
  for (const c of confirmadas) {
    const categoria = categoriaDe(c.termo);
    if (categoria === "certificacao_idioma" || RE_CERTIFICACAO.test(c.descricao) || RE_FORMACAO.test(c.descricao)) {
      certConfirmadas.push(`${c.termo}: ${c.descricao}`);
    } else {
      linhasExperiencia.push(...(linhasExperiencia.length ? [""] : []), `Experiência com ${c.termo}: ${c.descricao}`);
    }
    if (categoria !== "certificacao_idioma") habConfirmadas.push(c.termo);
  }
  if (confirmadas.length) {
    mudancas.push(`Incluído o que você confirmou: ${juntarLista(confirmadas.map((c) => c.termo))}`);
  }

  // Outras informações: cursos/idiomas vão para certificações; o resto, para experiência.
  for (const l of s.outros) {
    if (RE_CERTIFICACAO.test(l)) s.certificacoes.push(l);
    else linhasExperiencia.push(`- ${l.replace(MARCADOR, "")}`);
  }

  // Habilidades: termos da vaga primeiro, depois o que já estava no currículo.
  const originais = listarItens(s.habilidades);
  const vistos = new Set<string>();
  const habilidades: string[] = [];
  const adicionar = (item: string) => {
    const n = normalizar(item);
    if (!n || vistos.has(n)) return;
    vistos.add(n);
    habilidades.push(item);
  };
  const tecnicas = encontradas.filter((p) => p.categoria !== "certificacao_idioma");
  tecnicas.forEach((p) => {
    adicionar(p.termo);
    p.variantes.forEach((v) => vistos.add(normalizar(v)));
  });
  habConfirmadas.forEach(adicionar);
  originais.forEach(adicionar);
  if (tecnicas.length) mudancas.push("Seção Habilidades reorganizada com os termos da vaga primeiro");

  // Resumo profissional
  const conhecimentos = [...tecnicas.filter((p) => p.categoria !== "comportamental").map((p) => p.termo), ...habConfirmadas].slice(0, 6);
  const comportamentais = tecnicas.filter((p) => p.categoria === "comportamental").map((p) => p.termo).slice(0, 3);
  let resumo = s.resumo.map((l) => l.replace(MARCADOR, "")).join(" ").trim();
  if (!resumo) {
    const frases = [
      conhecimentos.length ? `Profissional com conhecimentos em ${juntarLista(conhecimentos.map(termoNaFrase))}.` : "",
      comportamentais.length ? `Destaque para ${juntarLista(comportamentais.map((c) => c.toLowerCase()))}.` : "",
    ].filter(Boolean);
    resumo = frases.join(" ");
    if (resumo) mudancas.push("Resumo profissional criado com as competências que já estão no seu currículo");
  } else if (conhecimentos.length) {
    const faltamNoResumo = conhecimentos.filter((t) => !contemPalavraInteira(normalizar(resumo), t)).slice(0, 4);
    if (faltamNoResumo.length) {
      resumo = `${resumo.replace(/[.\s]*$/, ".")} Conhecimentos em ${juntarLista(faltamNoResumo.map(termoNaFrase))}.`;
      mudancas.push("Resumo profissional alinhado à vaga com termos que já aparecem no seu currículo");
    }
  }

  // Certificações e idiomas
  const certificacoes = [...s.certificacoes.map((l) => l.replace(MARCADOR, "")), ...certConfirmadas];

  // Montagem final na ordem fixa.
  const secoes: Array<[string, string[]]> = [
    ["RESUMO PROFISSIONAL", resumo ? [resumo] : []],
    ["EXPERIÊNCIA", linhasExperiencia],
    ["FORMAÇÃO", s.formacao.map((l) => l.replace(MARCADOR, ""))],
    ["HABILIDADES", habilidades.length ? [habilidades.join(", ")] : []],
    ["CERTIFICAÇÕES E IDIOMAS", certificacoes.map((c) => `- ${c}`)],
  ];

  let corpo: string[] = [];
  for (const [titulo, linhas] of secoes) {
    if (!linhas.some((l) => l.trim())) continue;
    corpo.push("", titulo, ...linhas);
  }
  corpo = trocarSinonimos(corpo, curriculo, encontradas, mudancas);

  const cabecalho = [blocos.nome, [...new Set(blocos.contatos)].join(" | ")].filter(Boolean);
  mudancas.unshift("Currículo organizado nas seções padrão lidas por sistemas ATS");
  if (blocos.semTitulos) mudancas.push("Texto corrido separado em seções");

  // Validação anti-invenção (seção 5.4): remove menções em listas e avisa o resto.
  const ajustado = removerMencoes([...cabecalho, ...corpo].join("\n").trim(), proibidos);
  const avisos = validarAntiInvencao({
    curriculoAjustado: ajustado,
    curriculoOriginal: curriculo,
    proibidos,
    confirmadas,
  });

  return { curriculo: ajustado, mudancas: [...new Set(mudancas)], avisos };
}
