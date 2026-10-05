// Demonstração no navegador: usa o cérebro de verdade (ativação, troca de nome, escolhas) com ações simuladas
// sobre uma estrutura de pastas de exemplo. Serve para ver e testar a interface sem Windows nem microfone.
// @ts-ignore (módulo CommonJS do motor)
import * as cerebroMod from "../../electron/engine/cerebro.cjs";
// @ts-ignore
import * as textoMod from "../../electron/engine/texto.cjs";
import type { Api, Config, EstadoAtual, ExemplosGrupo } from "./types";

const { criarCerebro } = (cerebroMod as any).default ?? cerebroMod;
const { melhores, digitosDoCodigo, vencedorClaro } = (textoMod as any).default ?? textoMod;

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));
const MARCAS: Record<string, string[]> = {
  "BEIRA RIO": ["4182.224", "8246.1212", "8367.871", "8367.872", "8367.875", "8367.878", "8506.209", "8519.101", "8519.110", "BEIRA RIO 8407.137"],
  BEBECE: ["4182.224", "8506.209"],
  MOLEKINHA: ["2083.1122", "2342.120"],
  MOLEKINHO: ["2433.100", "2636.115"],
  ACTVITTA: [], Adrun: [], BIAGGIO: [], CONVERSE: [], DAKOTA: [], KENNER: [], LUPO: [], MODARE: [],
};

const EXEMPLOS: ExemplosGrupo[] = [
  { titulo: "Marcas e referências", itens: ["Abre a marca Beira Rio", "Abre a marca Beira Rio, referência 8506 ponto 209", "Abre a referência 8506.209 da Beira Rio", "Pesquisa a referência 8367", "Lista os arquivos", "Volta uma pasta", "Fecha as pastas"] },
  { titulo: "Programas", itens: ["Abre o WhatsApp", "Abre o zap web", "Abre o Excel", "Fecha o Chrome"] },
  { titulo: "Navegador (Chrome, Edge, Firefox)", itens: ["Próxima aba", "Aba anterior", "Vai para a aba 3", "Vai para a aba do YouTube", "Nova aba", "Fecha a aba", "Pesquisa no Google preço do dólar"] },
  { titulo: "Janelas", itens: ["Troca de janela", "Vai para o Excel", "Minimiza essa janela", "Mostra a área de trabalho"] },
  { titulo: "Volume e mídia", itens: ["Aumenta o volume", "Abaixa o volume", "Volume em 30", "Mudo", "Pausa", "Próxima música"] },
  { titulo: "O próprio assistente", itens: ["Seu nome agora é Assistente", "Pode dormir", "Cancela", "Ajuda"] },
];

export function criarApiDemo(): Api {
  let cfg: Config = {
    nomeAtivacao: "Jarvis", variantes: [], pastaRaiz: "D:\\Users\\LiraDanilo\\Desktop\\LANÇAMENTOS", ignorar: ["Nova pasta"],
    aliases: [{ falas: ["zap web", "whatsapp web"], tipo: "caminho", destino: "C:\\Users\\Lira\\Desktop\\WhatsApp Web.lnk" }],
    falarRespostas: true, janelaConversaSeg: 8, escutaAposAtivarSeg: 10, modelo: "base", microfoneId: "", filtrosDoNavegador: false, sensibilidade: 5, iniciarComWindows: false, minimizarParaBandeja: true,
  };
  const config = { get: () => cfg, set: (p: Partial<Config>) => (cfg = { ...cfg, ...p }) };
  const ctx: { marca: string | null; ref: string | null } = { marca: null, ref: null };
  const marcasLista = Object.keys(MARCAS).map((nome) => ({ nome }));

  const acoes = {
    async executar(it: any): Promise<any> {
      await espera(250);
      const escolher = (pergunta: string, ops: { rotulo: string; intent: any }[]) => ({ ok: true, escolha: { pergunta, opcoes: ops.slice(0, 6) }, fala: "" });
      const abrirRef = (marca: string, ref: string) => {
        ctx.marca = marca;
        ctx.ref = ref;
        return { ok: true, fala: `Abrindo ${ref} da ${marca}. Tem 3 arquivos.` };
      };
      switch (it.tipo) {
        case "abrir_marca": {
          const r = melhores(it.marca, marcasLista, { nome: (m: any) => m.nome });
          if (!r.length) return { ok: false, fala: `Não achei a marca ${it.marca}.` };
          if (!vencedorClaro(r)) return escolher(`Achei ${r.length} marcas parecidas.`, r.map((x: any) => ({ rotulo: x.item.nome, intent: { ...it, marca: x.item.nome } })));
          const nome = r[0].item.nome;
          if (it.ref) return acoes.executar({ tipo: "abrir_ref", ref: it.ref, marca: nome });
          ctx.marca = nome;
          ctx.ref = null;
          return { ok: true, fala: `Abrindo a marca ${nome}. Tem ${MARCAS[nome].length} referências.` };
        }
        case "abrir_ref": {
          const marca = it.marca || ctx.marca;
          const dig = digitosDoCodigo(it.ref);
          const todas = marca ? [[marca, MARCAS[marca] ?? []] as const] : Object.entries(MARCAS);
          const achados = todas.flatMap(([m, refs]) => refs.filter((r) => digitosDoCodigo(r).startsWith(dig) || digitosDoCodigo(r) === dig).map((r) => ({ m, r })));
          if (!achados.length) return { ok: false, fala: `Não achei a referência ${it.ref}.` };
          const exato = achados.filter((a) => digitosDoCodigo(a.r) === dig);
          if (exato.length === 1) return abrirRef(exato[0].m, exato[0].r);
          if (achados.length === 1) return abrirRef(achados[0].m, achados[0].r);
          const unica = new Set(achados.map((a) => a.m)).size === 1;
          return escolher(`Achei ${achados.length} referências.`, achados.map((a) => ({ rotulo: unica ? a.r : `${a.m} — ${a.r}`, intent: { tipo: "abrir_ref", ref: a.r, marca: a.m } })));
        }
        case "pesquisar":
          return ctx.marca && it.destino !== "web" ? acoes.executar({ tipo: "abrir_ref", ref: it.termo, marca: ctx.marca }) : { ok: true, fala: `Pesquisando ${it.termo} no Google.` };
        case "listar_arquivos":
          return ctx.ref ? { ok: true, fala: "3 arquivos: frente, costas, ficha tecnica." } : { ok: false, fala: "Não tem nenhuma pasta aberta." };
        case "abrir": return { ok: true, fala: `Abrindo ${it.alvo}.` };
        case "fechar_programa": return { ok: true, fala: `Fechando ${it.nome}.` };
        case "aba": return { ok: true, fala: { proxima: "Próxima aba.", anterior: "Aba anterior.", nova: "Nova aba.", fechar: "Aba fechada.", numero: `Aba ${it.n}.`, nome: `Procurando a aba ${it.nome}.`, reabrir: "Reabri a última aba fechada." }[it.op as string] ?? "Feito." };
        case "janela": return { ok: true, fala: "Feito." };
        case "volume": return { ok: true, fala: it.op === "mudo" ? "Som desligado." : `Volume em ${it.valor ?? 40} por cento.` };
        case "pasta_acima": return { ok: true, fala: "Abrindo BEIRA RIO." };
        case "fechar_pasta": return { ok: true, fala: "Pasta fechada." };
      }
      return { ok: true, fala: "Feito (demonstração)." };
    },
  };
  const cerebro = criarCerebro({ config, acoes });
  let ouvintes: (() => void)[] = [];

  return {
    demo: true,
    info: async () => ({ versao: "1.0.0", plataforma: "demo", exemplos: EXEMPLOS, pastaModelos: "" }),
    obterConfig: async () => cfg,
    salvarConfig: async (p) => config.set(p),
    ouvir: (t, origem) => cerebro.ouvir(t, { origem }),
    estado: async (): Promise<EstadoAtual> => ({ ...cerebro.estado(), contexto: { marca: ctx.marca, ref: ctx.ref, pasta: null } }),
    dormir: async () => cerebro.dormir(),
    escolherPasta: async () => "D:\\Users\\LiraDanilo\\Desktop\\LANÇAMENTOS",
    reindexar: async () => ({ marcas: Object.keys(MARCAS).length, referencias: Object.values(MARCAS).flat().length, erro: "" }),
    resumoPastas: async () => ({ raiz: cfg.pastaRaiz, erro: "", total: Object.values(MARCAS).flat().length, marcas: Object.entries(MARCAS).map(([nome, r]) => ({ nome, refs: r.length })) }),
    listarProgramas: async () => [
      { nome: "Google Chrome", tipo: "app", id: "x" }, { nome: "Microsoft Edge", tipo: "app", id: "x" }, { nome: "Mozilla Firefox", tipo: "app", id: "x" },
      { nome: "WhatsApp", tipo: "app", id: "x" }, { nome: "WhatsApp Web", tipo: "arquivo", caminho: "C:\\Users\\Lira\\Desktop\\WhatsApp Web.lnk" },
      { nome: "Microsoft Excel", tipo: "app", id: "x" }, { nome: "Microsoft Word", tipo: "app", id: "x" }, { nome: "Bloco de Notas", tipo: "app", id: "x" }, { nome: "Calculadora", tipo: "app", id: "x" },
    ],
    escolherArquivo: async () => "C:\\Programas\\app.exe",
    statusModelo: async () => ({ chave: cfg.modelo, pronto: false, baixando: false }),
    baixarModelo: async () => ({ ok: false, erro: "Indisponível no modo demonstração." }),
    cancelarModelo: async () => {},
    aoProgressoModelo: () => () => {},
    aoAlternarEscuta: (cb) => {
      ouvintes.push(cb);
      return () => (ouvintes = ouvintes.filter((x) => x !== cb));
    },
    sair: async () => {},
    esconder: async () => {},
  };
}
