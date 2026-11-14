import { lerCurriculo } from "./reescrever-curriculo";
import { calcularMatch, normalizar } from "./score";
import type { PalavraChave } from "./tipos";

/**
 * Dicas para a pessoa melhorar o currículo.
 *
 * Cada dica é uma regra independente na lista REGRAS. Para criar uma nova,
 * basta acrescentar um objeto com `id`, `nome` (o que é verificado) e
 * `verificar`, que devolve `null` quando está tudo certo ou um aviso.
 * As regras só apontam melhorias: nunca sugerem inventar informação.
 */

export type NivelDica = "importante" | "sugestao";

export interface Aviso {
  nivel: NivelDica;
  mensagem: string;
  trechos?: string[];
}

export interface ContextoDicas {
  /** Texto avaliado (o currículo ajustado, se já foi gerado, ou o original). */
  texto: string;
  palavras: PalavraChave[];
}

export interface Regra {
  id: string;
  nome: string;
  verificar: (ctx: ContextoDicas & Derivados) => Aviso | null;
}

export interface ResultadoDica {
  id: string;
  nome: string;
  aviso: Aviso | null;
}

interface Derivados {
  normalizado: string;
  linhas: string[];
  topicos: string[];
  palavrasContadas: number;
  secoes: ReturnType<typeof lerCurriculo>["secoes"];
}

const TOPICO = /^\s*(?:[-*•·▪►✓➢]|\d+[.)])\s+(.*)$/;
const limitar = (itens: string[], n = 3) => itens.slice(0, n).map((t) => (t.length > 120 ? `${t.slice(0, 117)}…` : t));

const VERBOS_FRACOS =
  /^(respons[aá]vel (por|pela|pelo)|auxiliei|auxiliar|auxílio|ajudei|ajudar|ajuda|apoio|apoiar|fazia|fazer|realizava|tarefas|atividades|atua[cç][aã]o|trabalhei com|trabalhava)\b/i;

export const REGRAS: Regra[] = [
  {
    id: "obrigatorios",
    nome: "Requisitos obrigatórios da vaga",
    verificar: ({ texto, palavras }) => {
      const faltando = calcularMatch(texto, palavras).faltando.filter((p) => p.obrigatorio);
      if (faltando.length === 0) return null;
      return {
        nivel: "importante",
        mensagem: `Faltam ${faltando.length} requisito(s) obrigatório(s) da vaga. Se você tem experiência com algum deles, responda "Sim" em "Confirme o que você tem" e conte onde usou.`,
        trechos: faltando.map((p) => p.termo),
      };
    },
  },
  {
    id: "contatos",
    nome: "E-mail e telefone",
    verificar: ({ texto }) => {
      const falta = [
        !/[\w.+-]+@[\w-]+\.[\w.-]+/.test(texto) && "e-mail",
        !/\(?\d{2}\)?\s?9?\d{4}[-.\s]?\d{4}/.test(texto) && "telefone",
      ].filter(Boolean);
      if (!falta.length) return null;
      return { nivel: "importante", mensagem: `Inclua seu ${falta.join(" e ")} no topo do currículo, para o recrutador conseguir falar com você.` };
    },
  },
  {
    id: "linkedin",
    nome: "Perfil no LinkedIn",
    verificar: ({ normalizado }) =>
      /linkedin/.test(normalizado)
        ? null
        : { nivel: "sugestao", mensagem: "Se você tem perfil no LinkedIn atualizado, coloque o link junto dos contatos." },
  },
  {
    id: "secoes",
    nome: "Seções essenciais",
    verificar: ({ secoes }) => {
      const falta = [
        !secoes.experiencia.length && "Experiência",
        !secoes.formacao.length && "Formação",
        !secoes.habilidades.length && "Habilidades",
      ].filter(Boolean) as string[];
      if (!falta.length) return null;
      return {
        nivel: "importante",
        mensagem: `Não encontramos a(s) seção(ões) ${falta.join(", ")}. Se você tem essas informações, inclua com esses títulos, que são os que os sistemas ATS procuram.`,
      };
    },
  },
  {
    id: "tamanho",
    nome: "Tamanho do currículo",
    verificar: ({ palavrasContadas }) => {
      if (palavrasContadas < 150) {
        return {
          nivel: "importante",
          mensagem: `O currículo está curto (${palavrasContadas} palavras). Descreva melhor o que você fazia em cada experiência: atividades, ferramentas e resultados reais.`,
        };
      }
      if (palavrasContadas > 900) {
        return {
          nivel: "sugestao",
          mensagem: `O currículo está longo (${palavrasContadas} palavras, provavelmente mais de 2 páginas). Resuma experiências antigas ou pouco ligadas à vaga.`,
        };
      }
      return null;
    },
  },
  {
    id: "resultados",
    nome: "Resultados com números",
    verificar: ({ topicos }) => {
      if (topicos.length < 2) return null;
      const semNumero = topicos.filter((t) => !/\d/.test(t));
      if (semNumero.length < topicos.length) return null;
      return {
        nivel: "sugestao",
        mensagem:
          "Nenhum tópico mostra resultado em números. Se você tiver números reais (quantidade, porcentagem, prazo, valor, tamanho da equipe), inclua. Nunca estime ou invente.",
        trechos: limitar(semNumero),
      };
    },
  },
  {
    id: "verbos-fracos",
    nome: "Tópicos começando com verbo de ação",
    verificar: ({ topicos }) => {
      const fracos = topicos.filter((t) => VERBOS_FRACOS.test(t.trim()));
      if (!fracos.length) return null;
      return {
        nivel: "sugestao",
        mensagem:
          'Alguns tópicos começam de forma genérica. Comece com o que você fez: "Elaborei", "Implantei", "Negociei", "Atendi", "Coordenei", "Reduzi".',
        trechos: limitar(fracos),
      };
    },
  },
  {
    id: "verbo-repetido",
    nome: "Variedade de verbos",
    verificar: ({ topicos }) => {
      const contagem = new Map<string, number>();
      for (const t of topicos) {
        const verbo = normalizar(t.split(/\s+/)[0] ?? "");
        if (verbo.length > 3) contagem.set(verbo, (contagem.get(verbo) ?? 0) + 1);
      }
      const repetidos = [...contagem].filter(([, n]) => n >= 3);
      if (!repetidos.length) return null;
      return {
        nivel: "sugestao",
        mensagem: "Alguns tópicos começam com o mesmo verbo. Variar deixa o texto mais forte.",
        trechos: repetidos.map(([v, n]) => `"${v}" aparece ${n} vezes`),
      };
    },
  },
  {
    id: "topicos-longos",
    nome: "Tópicos objetivos",
    verificar: ({ topicos }) => {
      const longos = topicos.filter((t) => t.split(/\s+/).length > 35);
      if (!longos.length) return null;
      return {
        nivel: "sugestao",
        mensagem: "Alguns tópicos estão longos. Tente deixar cada um com até 2 linhas, uma ideia por tópico.",
        trechos: limitar(longos, 2),
      };
    },
  },
  {
    id: "primeira-pessoa",
    nome: "Sem pronomes em primeira pessoa",
    verificar: ({ linhas }) => {
      const com = linhas.filter((l) => /\b(eu|meu|minha|meus|minhas)\b/i.test(l));
      if (!com.length) return null;
      return {
        nivel: "sugestao",
        mensagem: 'Evite "eu", "meu" e "minha". Em currículo, o verbo já mostra quem fez.',
        trechos: limitar(com, 2),
      };
    },
  },
  {
    id: "dados-pessoais",
    nome: "Sem dados pessoais desnecessários",
    verificar: ({ linhas }) => {
      const sensiveis = linhas.filter((l) =>
        /\b(cpf|rg|estado civil|casad[oa]|solteir[oa]|divorciad[oa]|data de nascimento|nascid[oa] em|\d{2} anos de idade|idade:|filhos|religi[aã]o|nacionalidade|naturalidade)\b/i.test(l)
      );
      if (!sensiveis.length) return null;
      return {
        nivel: "sugestao",
        mensagem:
          "CPF, RG, estado civil, idade e filhos não são necessários no currículo e podem gerar julgamentos. Proteja seus dados e remova essas informações.",
        trechos: limitar(sensiveis, 2),
      };
    },
  },
  {
    id: "resumo-objetivo",
    nome: "Resumo que mostra o que você já faz",
    verificar: ({ secoes }) => {
      const resumo = secoes.resumo.join(" ").trim();
      if (!resumo || !/^(atuar|busco|buscar|procuro|desejo|pretendo|almejo|obter|conseguir|trabalhar)\b/i.test(resumo)) return null;
      return {
        nivel: "sugestao",
        mensagem:
          'Seu resumo fala do que você quer ("Atuar como…"). Prefira contar em 2 ou 3 linhas o que você já faz e sabe: área, anos de experiência, principais ferramentas.',
        trechos: limitar([resumo], 1),
      };
    },
  },
  {
    id: "datas",
    nome: "Datas nas experiências",
    verificar: ({ secoes }) => {
      const cabecalhos = secoes.experiencia.filter((l) => !TOPICO.test(l) && l.length <= 110 && !/[.;]$/.test(l));
      if (!cabecalhos.length) return null;
      const temAno = cabecalhos.some((l) => /\b(19|20)\d{2}\b/.test(l));
      if (temAno) return null;
      return {
        nivel: "sugestao",
        mensagem: "Suas experiências não têm datas. Inclua o período (ex.: 2021 – atual). Recrutadores e sistemas ATS usam isso para ver seu tempo de experiência.",
      };
    },
  },
  {
    id: "experiencias-antigas",
    nome: "Foco nas experiências recentes",
    verificar: ({ secoes }) => {
      const anoAtual = new Date().getFullYear();
      const antigas = secoes.experiencia.filter((l) => {
        if (TOPICO.test(l) || /\b(atual|atualmente|presente)\b/i.test(l)) return false;
        const anos = (l.match(/\b(19|20)\d{2}\b/g) ?? []).map(Number);
        return anos.length > 0 && Math.max(...anos) < anoAtual - 15;
      });
      if (!antigas.length) return null;
      return {
        nivel: "sugestao",
        mensagem: "Há experiências que terminaram há mais de 15 anos. Você pode resumi-las em uma linha para dar espaço às mais recentes.",
        trechos: limitar(antigas, 2),
      };
    },
  },
  {
    id: "nivel-idioma",
    nome: "Nível dos idiomas",
    verificar: ({ linhas }) => {
      const idiomas = linhas.filter(
        (l) =>
          /\b(ingl[eê]s|espanhol|franc[eê]s|alem[aã]o|italiano|mandarim|japon[eê]s)\b/i.test(l) &&
          !/\b(b[aá]sico|intermedi[aá]rio|avan[cç]ado|fluente|flu[eê]ncia|nativo|t[eé]cnico|leitura|conversa[cç][aã]o|a1|a2|b1|b2|c1|c2)\b/i.test(l)
      );
      if (!idiomas.length) return null;
      return {
        nivel: "sugestao",
        mensagem: "Informe o nível de cada idioma (básico, intermediário, avançado ou fluente).",
        trechos: limitar(idiomas, 2),
      };
    },
  },
  {
    id: "caixa-alta",
    nome: "Texto sem excesso de maiúsculas",
    verificar: ({ linhas }) => {
      const gritando = linhas.filter((l, i) => {
        if (i === 0 || l.length < 25) return false; // nome e títulos curtos podem ser em maiúsculas
        const letras = l.replace(/[^A-Za-zÀ-ÿ]/g, "");
        return letras.length > 20 && letras === letras.toUpperCase();
      });
      if (!gritando.length) return null;
      return {
        nivel: "sugestao",
        mensagem: "Frases inteiras em maiúsculas são mais difíceis de ler. Use maiúsculas só no nome e nos títulos.",
        trechos: limitar(gritando, 2),
      };
    },
  },
];

export function avaliarDicas(ctx: ContextoDicas): ResultadoDica[] {
  const linhas = ctx.texto.split("\n").map((l) => l.trim()).filter(Boolean);
  const secoes = lerCurriculo(ctx.texto).secoes;
  const topicos = secoes.experiencia
    .map((l) => l.match(TOPICO)?.[1] ?? (l.length > 70 || /[.;]$/.test(l) ? l : ""))
    .filter(Boolean);
  const derivados: Derivados = {
    normalizado: normalizar(ctx.texto),
    linhas,
    topicos,
    palavrasContadas: ctx.texto.split(/\s+/).filter(Boolean).length,
    secoes,
  };
  return REGRAS.map((r) => ({ id: r.id, nome: r.nome, aviso: r.verificar({ ...ctx, ...derivados }) }));
}
