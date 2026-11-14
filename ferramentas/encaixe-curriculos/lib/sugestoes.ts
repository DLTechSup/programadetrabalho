import { secaoDoTitulo, termoNaFrase } from "./reescrever-curriculo";
import { calcularMatch, contemPalavraInteira, normalizar } from "./score";
import { fortalecerTopico } from "./verbos";
import type { PalavraChave } from "./tipos";

/**
 * Sugestões comentadas ("Eu faria… porque…") que a pessoa pode aplicar com um clique.
 *
 * Cada sugestão só reescreve, reorganiza ou remove o que JÁ está no currículo:
 * nunca acrescenta experiência, número, data ou habilidade.
 * Para criar um novo tipo, acrescente uma função em GERADORES.
 */

export interface Troca {
  /** Linha atual (exata, sem espaços nas pontas). */
  linha: string;
  /** Novo conteúdo; null remove a linha. Pode ter "\n" para inserir linhas depois. */
  nova: string | null;
}

export interface Sugestao {
  id: string;
  categoria: string;
  titulo: string;
  euFaria: string;
  porque: string;
  trocas: Troca[];
}

export interface ContextoSugestoes {
  texto: string;
  palavras: PalavraChave[];
  cargo: string;
  /** Vaga de nível mais simples: destacar o prático e omitir o que assusta o recrutador. */
  nivelEntrada?: boolean;
  /** Termos que a pessoa não tem: sugestões que os introduzam são descartadas. */
  proibidos?: PalavraChave[];
}

interface Linha {
  texto: string;
  secao: ReturnType<typeof secaoDoTitulo> | "cabecalho";
}

interface Derivado extends ContextoSugestoes {
  linhas: Linha[];
}

type Gerador = (ctx: Derivado) => Sugestao[];

const TOPICO = /^\s*[-*•·]\s+(.*)$/;
const ANO = /\b(19[6-9]\d|20[0-4]\d)\b/g;

function lerLinhas(texto: string): Linha[] {
  let secao: Linha["secao"] = "cabecalho";
  return texto.split("\n").map((bruta) => {
    const t = bruta.trim();
    const titulo = t ? secaoDoTitulo(t) : null;
    if (titulo) secao = titulo;
    return { texto: t, secao: titulo ? null : secao };
  });
}

function juntar(itens: string[]) {
  return itens.length <= 1 ? itens.join("") : `${itens.slice(0, -1).join(", ")} e ${itens[itens.length - 1]}`;
}

const cortar = (t: string, n = 90) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);

/** Cabeçalhos de experiência ("Cargo | Empresa | 2021 - atual"), do mais recente ao mais antigo. */
function cabecalhosDeExperiencia(linhas: Linha[]) {
  return linhas.filter(
    (l) => l.secao === "experiencia" && l.texto && !TOPICO.test(l.texto) && (/\b(19|20)\d{2}\b/.test(l.texto) || /\batual\b/i.test(l.texto))
  );
}

const SENIORIDADE = /\b(jr|j[uú]nior|pleno|pl|s[eê]nior|sr|trainee|estagi[aá]ri[oa]|i{1,3}|iv)\b\.?/gi;

function cargoDoCabecalho(cabecalho: string): string | null {
  const cargo = cabecalho.split(/\s*\|\s*|\s+[-–—]\s+|\s+(?:na|no|em)\s+/)[0]?.trim();
  if (!cargo || /\d/.test(cargo) || cargo.split(/\s+/).length > 7) return null;
  return cargo;
}

const GERADORES: Gerador[] = [
  // 1. Verbos de ação nos tópicos de experiência
  ({ linhas }) =>
    linhas
      .filter((l) => l.secao === "experiencia" && TOPICO.test(l.texto))
      .flatMap((l) => {
        const conteudo = l.texto.match(TOPICO)![1];
        const melhor = fortalecerTopico(conteudo);
        if (!melhor || melhor === conteudo) return [];
        return [
          {
            id: `verbo:${l.texto}`,
            categoria: "Verbos de ação",
            titulo: "Começar o tópico com o que você fez",
            euFaria: `Trocaria “${cortar(conteudo)}” por “${cortar(melhor)}”.`,
            porque:
              "Recrutadores leem só o começo de cada tópico. Começar com um verbo de ação mostra a sua entrega, e não apenas pelo que você respondia. O fato continua o mesmo.",
            trocas: [{ linha: l.texto, nova: `- ${melhor}` }],
          },
        ];
      }),

  // 2. Resumo que fala do que a pessoa quer (fora do modo de nível de entrada) ("Atuar como…") vira resumo do que ela já faz
  ({ linhas, texto, palavras, nivelEntrada }) => {
    if (nivelEntrada) return [];
    const resumo = linhas.filter((l) => l.secao === "resumo" && l.texto);
    const conteudo = resumo.map((l) => l.texto).join(" ");
    if (!conteudo || !/^(atuar|busco|buscar|procuro|desejo|pretendo|almejo|obter|conseguir|trabalhar|fazer parte)\b/i.test(conteudo)) {
      return [];
    }
    const experiencia = normalizar(linhas.filter((l) => l.secao === "experiencia").map((l) => l.texto).join(" "));
    const { encontradas } = calcularMatch(texto, palavras);
    const tecnicas = encontradas.filter((p) => p.categoria === "tecnica" || p.categoria === "ferramenta");
    const naPratica = tecnicas.filter((p) => [p.termo, ...p.variantes].some((f) => contemPalavraInteira(experiencia, f)));
    const outras = tecnicas.filter((p) => !naPratica.includes(p));
    if (!naPratica.length && !outras.length) return [];

    const cargoAtual = cabecalhosDeExperiencia(linhas).map((l) => cargoDoCabecalho(l.texto)).find(Boolean);
    const quem = cargoAtual ?? "Profissional";
    const partes = [
      naPratica.length ? `com experiência em ${juntar(naPratica.slice(0, 5).map((p) => termoNaFrase(p.termo)))}` : "",
      outras.length ? `${naPratica.length ? "e " : "com "}conhecimentos em ${juntar(outras.slice(0, 4).map((p) => termoNaFrase(p.termo)))}` : "",
    ].filter(Boolean);
    const novo = `${quem} ${partes.join(" ")}.`;
    return [
      {
        id: `resumo:${conteudo}`,
        categoria: "Resumo profissional",
        titulo: "Resumo que mostra o que você já faz",
        euFaria: `Trocaria o resumo por: “${novo}”`,
        porque:
          "O resumo é a primeira coisa lida. Frases como “Atuar como…” falam do que você quer; mostrar o que você já faz, com os termos da vaga que estão no seu currículo, prende a atenção e ajuda no filtro do ATS.",
        trocas: resumo.map((l, i) => ({ linha: l.texto, nova: i === 0 ? novo : null })),
      },
    ];
  },

  // 3. Título profissional abaixo do nome, quando o cargo da pessoa é o da vaga
  ({ linhas, cargo, nivelEntrada }) => {
    if (nivelEntrada) return [];
    const cabecalho = linhas.filter((l) => l.secao === "cabecalho" && l.texto);
    if (cabecalho.length < 2) return [];
    const nucleo = (t: string) =>
      normalizar(t.replace(SENIORIDADE, " "))
        .split(" ")
        .filter((p) => p.length > 2);
    const doCargo = new Set(nucleo(cargo));
    if (doCargo.size === 0) return [];
    for (const l of cabecalhosDeExperiencia(linhas)) {
      const meuCargo = cargoDoCabecalho(l.texto);
      if (!meuCargo) continue;
      const palavras = nucleo(meuCargo);
      const comuns = palavras.filter((p) => doCargo.has(p));
      if (comuns.length < Math.min(2, doCargo.size) || comuns.length < palavras.length - 1) continue;
      const titulo = meuCargo.replace(SENIORIDADE, "").replace(/\s{2,}/g, " ").trim();
      if (cabecalho.some((c) => normalizar(c.texto) === normalizar(titulo))) return [];
      const ultimo = cabecalho[cabecalho.length - 1].texto;
      return [
        {
          id: `titulo:${titulo}`,
          categoria: "Cabeçalho",
          titulo: "Título profissional abaixo do nome",
          euFaria: `Colocaria “${titulo}” logo abaixo do seu nome e contatos.`,
          porque:
            "Em um segundo o recrutador vê que você é da área da vaga, e muitos sistemas ATS dão peso ao cargo. O título vem da sua própria experiência, sem exagerar o nível.",
          trocas: [{ linha: ultimo, nova: `${ultimo}\n${titulo}` }],
        },
      ];
    }
    return [];
  },

  // 4. Dados pessoais desnecessários
  ({ linhas }) => {
    const sensivel = /\b(cpf|rg|estado civil|casad[oa]|solteir[oa]|divorciad[oa]|data de nascimento|nascid[oa] em|\d{2} anos de idade|idade:|filhos|religi[aã]o|naturalidade|nacionalidade)\b/i;
    return linhas
      .filter((l) => l.texto && sensivel.test(l.texto))
      .map((l) => {
        // Remove só o trecho com o dado pessoal (entre "|" ou frases), mantendo o resto da linha.
        const partes = l.texto.split(/\s*\|\s*/);
        const restantes = partes
          .map((p) =>
            p
              .split(/(?<=[.;])\s+/)
              .filter((frase) => !sensivel.test(frase))
              .join(" ")
          )
          .filter((p) => p.trim());
        const nova = restantes.length ? restantes.join(" | ") : null;
        return {
          id: `dados:${l.texto}`,
          categoria: "Privacidade",
          titulo: "Tirar dados pessoais desnecessários",
          euFaria: nova ? `Deixaria a linha assim: “${cortar(nova)}”.` : `Removeria a linha “${cortar(l.texto)}”.`,
          porque:
            "CPF, RG, estado civil, idade e filhos não ajudam a conseguir a vaga, expõem seus dados e podem gerar julgamentos. Eles só são pedidos depois, na contratação.",
          trocas: [{ linha: l.texto, nova }],
        };
      });
  },

  // 5. "Eu" fora dos tópicos
  ({ linhas }) =>
    linhas
      .filter((l) => l.texto && !TOPICO.test(l.texto) && /^eu\s+\p{L}/iu.test(l.texto))
      .map((l) => {
        const nova = l.texto.replace(/^eu\s+(\p{L})/iu, (_, c: string) => c.toUpperCase());
        return {
          id: `eu:${l.texto}`,
          categoria: "Escrita",
          titulo: "Sem “eu” no começo da frase",
          euFaria: `Trocaria “${cortar(l.texto)}” por “${cortar(nova)}”.`,
          porque: "Em currículo o verbo já mostra quem fez. Sem o “eu”, o texto fica mais direto e profissional.",
          trocas: [{ linha: l.texto, nova }],
        };
      }),

  // 6. Experiências muito antigas: manter só o cabeçalho
  ({ linhas }) => {
    const limite = new Date().getFullYear() - 15;
    const sugestoes: Sugestao[] = [];
    const exp = linhas.filter((l) => l.secao === "experiencia");
    exp.forEach((l, i) => {
      if (!l.texto || TOPICO.test(l.texto) || /\batual|presente\b/i.test(l.texto)) return;
      const anos = (l.texto.match(ANO) ?? []).map(Number);
      if (!anos.length || Math.max(...anos) >= limite) return;
      const topicos: string[] = [];
      for (const prox of exp.slice(i + 1)) {
        if (!TOPICO.test(prox.texto)) break;
        topicos.push(prox.texto);
      }
      if (!topicos.length) return;
      sugestoes.push({
        id: `antiga:${l.texto}`,
        categoria: "Foco",
        titulo: "Resumir experiência antiga",
        euFaria: `Manteria só “${cortar(l.texto)}” e tiraria os ${topicos.length} tópico(s) abaixo.`,
        porque:
          "Experiências de mais de 15 anos atrás pesam pouco para a vaga e ocupam espaço. Manter cargo, empresa e período mostra a sua trajetória sem alongar o currículo.",
        trocas: topicos.map((t) => ({ linha: t, nova: null })),
      });
    });
    return sugestoes;
  },

  // 7. Lista de habilidades longa demais
  ({ linhas, texto, palavras }) => {
    const linha = linhas.find((l) => l.secao === "habilidades" && l.texto.split(",").length > 18);
    if (!linha) return [];
    const itens = linha.texto.split(/\s*,\s*/);
    const daVaga = new Set(calcularMatch(texto, palavras).encontradas.flatMap((p) => [p.termo, ...p.variantes].map(normalizar)));
    const prioritarios = itens.filter((i) => daVaga.has(normalizar(i)));
    const outros = itens.filter((i) => !daVaga.has(normalizar(i)));
    const mantidos = [...prioritarios, ...outros.slice(0, Math.max(0, 15 - prioritarios.length))];
    return [
      {
        id: `habilidades:${linha.texto}`,
        categoria: "Foco",
        titulo: "Enxugar a lista de habilidades",
        euFaria: `Manteria ${mantidos.length} das ${itens.length} habilidades, começando pelas que a vaga pede.`,
        porque: "Uma lista muito longa esconde o que importa. Recrutadores procuram primeiro os requisitos da vaga.",
        trocas: [{ linha: linha.texto, nova: mantidos.join(", ") }],
      },
    ];
  },
];


/* ------------- Vaga de nível mais simples (evitar "qualificado demais") ------------- */

export const CATEGORIA_NIVEL = "Nível da vaga";

const FORMACAO_AVANCADA = /\b(p[oó]s[- ]?gradua|mba\b|mestrado|doutorado|especializa[cç][aã]o|mestre em|doutor em)/i;
const TOPICO_ESTRATEGICO =
  /\b(estrat[eé]gi|or[cç]amento|budget|diretoria|conselho|board|gest[aã]o de (equipes?|pessoas|times?)|geri (uma )?equipe|liderei|lideran[cç]a de|coordenei (a )?equipe|supervisionei|kpis?|okrs?|p&l|reestrutura|fus[aã]o|aquisi[cç]|governan[cç]a|expans[aã]o|investidores|diretrizes|pol[ií]ticas corporativas)/i;
const HABILIDADES_AVANCADAS =
  /\b(sap|power ?bi|tableau|python|sql|valuation|controladoria|planejamento estrat[eé]gico|gest[aã]o de (equipes|pessoas|projetos)|lideran[cç]a|okrs?|kpis?|ifrs|business intelligence|machine learning|scrum|pmp|mba)\b/i;

/** Competências práticas valorizadas em vagas operacionais, se já estiverem no currículo. */
const PRATICAS: Array<[RegExp, string]> = [
  [/atendimento|atendi|clientes?/i, "atendimento ao cliente"],
  [/organiz/i, "organização"],
  [/estoque|invent[aá]rio/i, "controle de estoque"],
  [/caixa|pagamentos?|troco|recebimento/i, "operação de caixa e pagamentos"],
  [/vendas?|vendi/i, "vendas"],
  [/equipe|time/i, "trabalho em equipe"],
  [/rotinas administrativas|arquiv|documenta|planilhas|excel/i, "rotinas administrativas"],
  [/prazos?|pontual/i, "cumprimento de prazos"],
  [/confer[eê]ncia|confer/i, "conferência de mercadorias"],
  [/limpeza|higien/i, "limpeza e organização do ambiente"],
];

const GERADORES_NIVEL: Gerador[] = [
  // Formação avançada que pode assustar para vagas de entrada
  ({ linhas }) => {
    const alvos = linhas.filter(
      (l) => (l.secao === "formacao" || l.secao === "certificacoes") && l.texto && FORMACAO_AVANCADA.test(l.texto)
    );
    const restantesFormacao = linhas.filter((l) => l.secao === "formacao" && l.texto && !alvos.includes(l));
    if (!alvos.length || !restantesFormacao.length) return [];
    return [
      {
        id: "nivel:formacao",
        categoria: CATEGORIA_NIVEL,
        titulo: "Deixar de fora pós-graduação e MBA",
        euFaria: `Tiraria do currículo: ${alvos.map((a) => `“${cortar(a.texto, 60)}”`).join(", ")}. Sua graduação continua.`,
        porque:
          "Para vagas operacionais, formação muito acima do pedido faz o recrutador achar que você vai sair na primeira oportunidade. Currículo não precisa listar tudo: omitir não é mentir, e você pode falar disso na entrevista.",
        trocas: alvos.map((a) => ({ linha: a.texto, nova: null })),
      },
    ];
  },

  // Tópicos de gestão estratégica: manter o trabalho prático
  ({ linhas }) => {
    const sugestoes: Sugestao[] = [];
    let cabecalho = "";
    let grupo: string[] = [];
    const fechar = () => {
      const estrategicos = grupo.filter((t) => TOPICO_ESTRATEGICO.test(t));
      if (estrategicos.length && estrategicos.length < grupo.length) {
        sugestoes.push({
          id: `nivel:gestao:${cabecalho}`,
          categoria: CATEGORIA_NIVEL,
          titulo: "Destacar o trabalho prático, não a gestão",
          euFaria: `Em “${cortar(cabecalho, 60)}”, manteria os tópicos do dia a dia e tiraria ${estrategicos.length} tópico(s) de estratégia e gestão.`,
          porque:
            "Numa vaga operacional, o recrutador quer ver que você põe a mão na massa. O cargo, a empresa e o período continuam iguais: mudar o título seria inventar.",
          trocas: estrategicos.map((t) => ({ linha: t, nova: null })),
        });
      }
      grupo = [];
    };
    for (const l of linhas.filter((x) => x.secao === "experiencia")) {
      if (TOPICO.test(l.texto)) grupo.push(l.texto);
      else if (l.texto) {
        fechar();
        cabecalho = l.texto;
      }
    }
    fechar();
    return sugestoes;
  },

  // Resumo e objetivo voltados para a vaga
  ({ linhas, texto, cargo }) => {
    const normal = normalizar(texto);
    const praticas = PRATICAS.filter(([re]) => re.test(normal)).map(([, rotulo]) => rotulo).slice(0, 4);
    const resumo = linhas.filter((l) => l.secao === "resumo" && l.texto);
    const titulo = linhas.find((l) => l.texto && secaoDoTitulo(l.texto) === "resumo")?.texto;
    const cargoLimpo = cargo.replace(/\s*[-–|(].*$/, "").trim();
    const partes = [
      praticas.length ? `Profissional com experiência em ${juntar(praticas)}.` : "",
      cargoLimpo && cargoLimpo !== "Vaga" ? `Busco oportunidade como ${cargoLimpo}.` : "",
    ].filter(Boolean);
    if (!partes.length) return [];
    const novo = partes.join(" ");
    if (resumo.map((l) => l.texto).join(" ") === novo) return [];
    const trocas: Troca[] = resumo.length
      ? resumo.map((l, i) => ({ linha: l.texto, nova: i === 0 ? novo : null }))
      : titulo
        ? [{ linha: titulo, nova: `${titulo}\n${novo}` }]
        : [];
    if (!trocas.length) return [];
    return [
      {
        id: `nivel:resumo:${novo}`,
        categoria: CATEGORIA_NIVEL,
        titulo: "Resumo focado no que a vaga pede",
        euFaria: `Trocaria o resumo por: “${novo}”`,
        porque:
          "Um resumo que fala de gestão e estratégia reforça a ideia de “qualificado demais”. Mostrar experiência prática que você já tem e dizer claramente que quer esta vaga tira a dúvida do recrutador.",
        trocas,
      },
    ];
  },

  // Habilidades técnicas avançadas que não têm a ver com a vaga
  ({ linhas, texto, palavras }) => {
    const linha = linhas.find((l) => l.secao === "habilidades" && l.texto.includes(","));
    if (!linha) return [];
    const daVaga = new Set(calcularMatch(texto, palavras).encontradas.flatMap((p) => [p.termo, ...p.variantes].map(normalizar)));
    const itens = linha.texto.split(/\s*,\s*/);
    const avancadas = itens.filter((i) => HABILIDADES_AVANCADAS.test(i) && !daVaga.has(normalizar(i)));
    const mantidas = itens.filter((i) => !avancadas.includes(i));
    if (!avancadas.length || !mantidas.length) return [];
    return [
      {
        id: `nivel:habilidades:${linha.texto}`,
        categoria: CATEGORIA_NIVEL,
        titulo: "Habilidades que a vaga usa",
        euFaria: `Tiraria ${juntar(avancadas.map((a) => `“${a}”`))} e manteria ${juntar(mantidas.slice(0, 5))}${mantidas.length > 5 ? "…" : ""}.`,
        porque: "Ferramentas avançadas que a vaga não pede não ajudam aqui e reforçam o perfil de escritório. Você não perde nada: elas continuam no seu currículo completo.",
        trocas: [{ linha: linha.texto, nova: mantidas.join(", ") }],
      },
    ];
  },
];

export function gerarSugestoes(ctx: ContextoSugestoes): Sugestao[] {
  const derivado: Derivado = { ...ctx, linhas: lerLinhas(ctx.texto) };
  const vistos = new Set<string>();
  const geradores = ctx.nivelEntrada ? [...GERADORES_NIVEL, ...GERADORES] : GERADORES;
  return geradores
    .flatMap((g) => g(derivado))
    .filter((s) => {
      if (vistos.has(s.id)) return false;
      vistos.add(s.id);
      // Regra de ouro: nenhuma sugestão pode introduzir um termo que a pessoa não confirmou.
      if (ctx.proibidos?.length) {
        const novos = s.trocas.map((t) => t.nova ?? "").join("\n");
        const antes = normalizar(s.trocas.map((t) => t.linha).join("\n"));
        const introduz = ctx.proibidos.some((p) =>
          [p.termo, ...p.variantes].some((f) => contemPalavraInteira(normalizar(novos), f) && !contemPalavraInteira(antes, f))
        );
        if (introduz) return false;
      }
      return true;
    });
}

/** Aplica as trocas de uma sugestão ao texto. Trocas cuja linha já não existe são ignoradas. */
export function aplicarSugestao(texto: string, sugestao: Sugestao): string {
  const linhas = texto.split("\n");
  for (const troca of sugestao.trocas) {
    const i = linhas.findIndex((l) => l.trim() === troca.linha);
    if (i === -1) continue;
    if (troca.nova === null) linhas.splice(i, 1);
    else linhas.splice(i, 1, ...troca.nova.split("\n"));
  }
  return linhas.join("\n").replace(/\n{3,}/g, "\n\n");
}

export function aplicarTodas(texto: string, sugestoes: Sugestao[]): string {
  return sugestoes.reduce(aplicarSugestao, texto);
}
