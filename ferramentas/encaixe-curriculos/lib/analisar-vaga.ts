import { DICIONARIO, type EntradaDicionario } from "./dicionario";
import { normalizar } from "./score";
import { MAX_PALAVRAS } from "./constantes";
import { CATEGORIAS, type AnaliseVaga, type Categoria, type PalavraChave } from "./tipos";

/**
 * Lê a descrição da vaga e extrai cargo e palavras-chave sem IA:
 * identifica as seções (requisitos, diferenciais, atividades, benefícios…),
 * procura os termos do dicionário e as expressões depois de
 * "experiência com", "conhecimento em", "domínio de" etc.
 * Função pura: o mesmo texto gera sempre o mesmo resultado.
 */

type Contexto = "obrigatorio" | "desejavel" | "atividades" | "ignorar" | "nenhum";

const TITULOS_SECAO: Array<[Contexto, string[]]> = [
  // "desejavel" vem antes para "requisitos desejáveis" não cair em "requisitos".
  [
    "desejavel",
    [
      "requisitos desejaveis", "desejavel", "desejaveis", "diferenciais", "diferencial",
      "sera um diferencial", "sera um plus", "e um plus", "nice to have", "bonus", "pontos extras",
      "seria legal", "vai ser legal",
    ],
  ],
  [
    "obrigatorio",
    [
      "requisitos", "pre requisitos", "requisitos obrigatorios", "qualificacoes", "o que esperamos",
      "o que buscamos", "o que voce precisa", "o que precisa ter", "exigencias", "perfil desejado",
      "perfil que buscamos", "perfil", "voce precisa ter", "must have", "requirements", "qualifications",
      "competencias necessarias", "conhecimentos necessarios", "formacao",
    ],
  ],
  [
    "atividades",
    [
      "responsabilidades", "atividades", "atribuicoes", "o que voce vai fazer", "o que voce fara",
      "principais atividades", "descricao da vaga", "sobre a vaga", "seu dia a dia", "no dia a dia",
      "desafios", "responsibilities", "funcoes",
    ],
  ],
  [
    "ignorar",
    [
      "beneficios", "o que oferecemos", "oferecemos", "sobre a empresa", "sobre nos", "quem somos",
      "remuneracao", "salario", "local de trabalho", "localizacao", "informacoes adicionais",
      "etapas do processo", "jornada", "horario", "benefits", "about us", "nossa cultura",
      "modelo de trabalho", "regime de contratacao", "tipo de contratacao",
    ],
  ],
];

const MARCAS_DESEJAVEL = /\b(desejavel|desejaveis|diferencial|diferenciais|plus|nice to have|bonus)\b/;
const MARCAS_OBRIGATORIO = /\b(obrigatorio|obrigatoria|imprescindivel|indispensavel|necessario|necessaria|essencial|exigido|exigida)\b/;

function tituloDeSecao(linha: string): Contexto | null {
  const semDoisPontos = linha.replace(/[:：]\s*$/, "").trim();
  if (!semDoisPontos || semDoisPontos.length > 60) return null;
  const n = normalizar(semDoisPontos);
  if (n.split(" ").length > 7) return null;
  for (const [contexto, chaves] of TITULOS_SECAO) {
    if (chaves.some((c) => n === c || n.startsWith(`${c} `))) return contexto;
  }
  return null;
}

interface Forma {
  entrada: EntradaDicionario;
  texto: string;
  normalizado: string;
}

const FORMAS: Forma[] = DICIONARIO.flatMap((entrada) =>
  [entrada.termo, ...entrada.variantes].map((texto) => ({ entrada, texto, normalizado: normalizar(texto) }))
)
  .filter((f) => f.normalizado)
  // Formas mais longas primeiro: "vendas consultivas" antes de "vendas".
  .sort((a, b) => b.normalizado.length - a.normalizado.length);

interface Ocorrencia {
  termo: string;
  variantes: string[];
  categoria: Categoria;
  generico: boolean;
  contagem: number;
  contextos: Set<Contexto>;
  ordem: number;
}

const GATILHOS =
  /(?:conhecimentos?|experi[eê]ncias?|viv[eê]ncias?|dom[ií]nio|familiaridade|habilidades?|atua[cç][aã]o|forma[cç][aã]o|certifica[cç][aã]o|flu[eê]ncia|especializa[cç][aã]o)\s+(?:(?:s[oó]lid[ao]s?|pr[aá]tic[ao]s?|comprovad[ao]s?|avan[cç]ad[ao]s?|b[aá]sic[ao]s?|intermedi[aá]ri[ao]s?|pr[eé]vi[ao]s?|t[eé]cnic[ao]s?)\s+)?(?:com|em|de|na|no|nas|nos|do|da|dos|das|sobre)\s+(.+)/i;

const PALAVRAS_VAZIAS = new Set(
  (
    "area areas setor setores ramo segmento funcao funcoes cargo cargos empresa empresas mercado atividades " +
    "atividade ferramentas ferramenta sistemas sistema tecnologias tecnologia rotinas rotina similares similar " +
    "semelhantes afins equivalente equivalentes relacionadas relacionados geral todos todas outras outros " +
    "diversas diversos pelo menos minimo anos ano meses mes etc projetos projeto clientes cliente processos " +
    "processo times equipes equipe trabalho uso utilizacao desenvolvimento gestao"
  ).split(" ")
);

const PREFIXOS_REMOVIVEIS =
  /^(?:(?:o|a|os|as|um|uma|uns|umas|de|do|da|dos|das|em|no|na|nos|nas|com|sobre|pelo|pela|ao|aos)\s+|(?:area|setor|ramo|segmento)\s+(?:de|do|da)\s+)+/i;

function limparCandidato(bruto: string): string {
  return bruto
    .replace(/\(.*?\)/g, " ")
    .split(/\s+(?:no|na|nos|nas|em|para|que|como|visando|voltad[ao]s?|aplicad[ao]s?|utilizando|atrav[eé]s|incluindo|entre outr[ao]s|al[eé]m)\b/i)[0]
    .replace(PREFIXOS_REMOVIVEIS, "")
    .replace(/\s+(?:etc|entre outros|e afins)\.?$/i, "")
    .replace(/[\s.;:!,-]+$/, "")
    .trim();
}

function categoriaDoCandidato(texto: string): Categoria {
  if (/certifica|curso|gradua|forma[cç]/i.test(texto)) return "certificacao_idioma";
  const palavras = texto.split(/\s+/);
  if (palavras.length <= 2 && /^[A-Z0-9]/.test(texto)) return "ferramenta";
  return "tecnica";
}

/** Expressões como "experiência com vendas consultivas" -> "vendas consultivas". */
function expressoesDaLinha(linha: string): string[] {
  const achado = linha.match(GATILHOS);
  if (!achado) return [];
  const trecho = achado[1].split(/[.;:!?]/)[0];
  return trecho
    .split(/,|\s+e\s+|\s+ou\s+|\s+\/\s+|\s+bem como\s+/i)
    .map(limparCandidato)
    .filter((c) => {
      const n = normalizar(c);
      if (!n || n.length < 2) return false;
      const palavras = n.split(" ");
      if (palavras.length > 4) return false;
      if (palavras.every((p) => PALAVRAS_VAZIAS.has(p) || /^\d+$/.test(p) || p.length < 3)) return false;
      if (/\b\d+\s*(anos?|meses?)\b/.test(n)) return false;
      if (PALAVRAS_VAZIAS.has(palavras[0]) && palavras.length === 1) return false;
      return true;
    });
}

const PREFIXOS_CARGO = /^(?:vaga|cargo|posi[cç][aã]o|oportunidade|t[ií]tulo)\s*(?:de|para)?\s*[:\-–—]?\s*/i;

function extrairCargo(linhas: string[]): string {
  for (const linha of linhas.slice(0, 8)) {
    const l = linha.replace(PREFIXOS_CARGO, "").trim();
    if (!l || l.length > 90 || tituloDeSecao(linha)) continue;
    if (/[.!?]$/.test(l) && l.split(" ").length > 8) continue;
    if (/^(sobre|descri[cç][aã]o|somos|a empresa|estamos|buscamos|procuramos)\b/i.test(l)) continue;
    return l.replace(/\s+/g, " ");
  }
  const texto = linhas.join("\n");
  const m = texto.match(/(?:vaga|cargo|oportunidade)\s+(?:de|para)\s+([^\n.,;:]{3,60})/i);
  return m ? m[1].trim() : "Vaga";
}

export function analisarVaga(textoVaga: string): AnaliseVaga {
  const linhas = textoVaga
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const temRequisitos = linhas.some((l) => tituloDeSecao(l) === "obrigatorio");
  const ocorrencias = new Map<string, Ocorrencia>();
  let ordem = 0;
  let contextoAtual: Contexto = "nenhum";

  const registrar = (
    chave: string,
    dados: Omit<Ocorrencia, "contagem" | "contextos" | "ordem">,
    contexto: Contexto
  ) => {
    const atual = ocorrencias.get(chave);
    if (atual) {
      atual.contagem++;
      atual.contextos.add(contexto);
    } else {
      ocorrencias.set(chave, { ...dados, contagem: 1, contextos: new Set([contexto]), ordem: ordem++ });
    }
  };

  for (const linha of linhas) {
    const titulo = tituloDeSecao(linha);
    if (titulo) {
      contextoAtual = titulo;
      continue;
    }
    if (contextoAtual === "ignorar") continue;

    const n = normalizar(linha);
    let contexto = contextoAtual;
    if (MARCAS_DESEJAVEL.test(n)) contexto = "desejavel";
    else if (MARCAS_OBRIGATORIO.test(n)) contexto = "obrigatorio";

    // Termos do dicionário (mais longos primeiro, removendo o trecho já usado).
    let resto = ` ${n} `;
    for (const forma of FORMAS) {
      const alvo = ` ${forma.normalizado} `;
      if (!resto.includes(alvo)) continue;
      resto = resto.split(alvo).join(" # ");
      const e = forma.entrada;
      const chave = normalizar(e.termo);
      const existente = ocorrencias.get(chave);
      registrar(
        chave,
        {
          // Usa a grafia que aparece na vaga como termo principal.
          termo: existente?.termo ?? forma.texto,
          variantes: [e.termo, ...e.variantes].filter((v) => normalizar(v) !== forma.normalizado),
          categoria: e.categoria,
          generico: !!e.generico,
        },
        contexto
      );
    }

    // Expressões fora do dicionário.
    for (const expressao of expressoesDaLinha(linha)) {
      const chave = normalizar(expressao);
      const coberta = FORMAS.some(
        (f) => ` ${chave} `.includes(` ${f.normalizado} `) || ` ${f.normalizado} `.includes(` ${chave} `)
      );
      if (coberta) continue;
      registrar(
        chave,
        { termo: expressao, variantes: [], categoria: categoriaDoCandidato(expressao), generico: false },
        contexto
      );
    }
  }

  const obrigatorioDe = (o: Ocorrencia): boolean => {
    if (o.contextos.has("obrigatorio")) return true;
    if (o.contextos.has("desejavel")) return false;
    // Sem seção de requisitos, o que a vaga cita é tratado como obrigatório.
    return !temRequisitos;
  };

  const candidatas = [...ocorrencias.values()].filter((o) => !o.generico || o.contagem >= 2);

  const escolhidas = candidatas
    .map((o) => ({ o, obrigatorio: obrigatorioDe(o) }))
    .sort((a, b) => Number(b.obrigatorio) - Number(a.obrigatorio) || b.o.contagem - a.o.contagem || a.o.ordem - b.o.ordem)
    .slice(0, MAX_PALAVRAS)
    .sort(
      (a, b) =>
        Number(b.obrigatorio) - Number(a.obrigatorio) ||
        CATEGORIAS.indexOf(a.o.categoria) - CATEGORIAS.indexOf(b.o.categoria) ||
        a.o.ordem - b.o.ordem
    );

  const palavras_chave: PalavraChave[] = escolhidas.map(({ o, obrigatorio }) => ({
    termo: o.termo,
    variantes: o.variantes,
    categoria: o.categoria,
    obrigatorio,
  }));

  return { cargo: extrairCargo(linhas), palavras_chave };
}
