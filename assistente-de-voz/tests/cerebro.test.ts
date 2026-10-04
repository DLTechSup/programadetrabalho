import { createRequire } from "node:module";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const req = createRequire(import.meta.url);
const { criarCerebro } = req("../electron/engine/cerebro.cjs");
const { criarAcoes } = req("../electron/engine/acoes.cjs");
const { criarConfig } = req("../electron/engine/config.cjs");

let raiz: string;
let tmp: string;
const mk = (rel: string, arquivo = false) => {
  const p = path.join(raiz, rel);
  if (arquivo) {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, "x");
  } else fs.mkdirSync(p, { recursive: true });
};

beforeAll(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "voz-"));
  raiz = path.join(tmp, "LANÇAMENTOS");
  for (const m of ["ACTVITTA", "BEBECE", "BEIRA RIO", "MOLEKINHA", "MOLEKINHO", "Nova pasta"]) mk(m);
  for (const r of ["8367.871", "8367.872", "8367.875", "8506.209", "8519.101"]) mk(`BEIRA RIO/${r}`);
  mk("BEIRA RIO/8506.209/frente.jpg", true);
  mk("BEIRA RIO/8506.209/ficha tecnica.pdf", true);
  mk("BEBECE/8506.209");
  mk("BEBECE/4182.224");
});
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

interface Chamadas {
  abertos: string[];
  urls: [string, string?][];
  procs: [string, string[]][];
  teclas: [string, any][];
  fechadas: number[][];
  vol: [string, number][];
  mortos: number[][];
}
let c: Chamadas;
let agoraMs: number;
let janelasAbertas: any[];

function montar(cfgInicial: Record<string, unknown> = {}) {
  const config = criarConfig(path.join(tmp, `cfg-${Math.random()}.json`));
  config.set({ pastaRaiz: raiz, ...cfgInicial });
  const janelas = {
    listar: async () => janelasAbertas,
    focar: async () => {},
    mostrar: async () => {},
    fechar: async (h: number[]) => void c.fechadas.push(h),
    matar: async (p: number[]) => void c.mortos.push(p),
    teclas: async (s: string, o: any) => void c.teclas.push([s, o]),
    midia: async () => {},
    volume: async (op: string, v: number) => (c.vol.push([op, v]), { volume: op === "definir" ? v : 40, mudo: false }),
    fecharPastas: async () => 1,
    areaDeTrabalho: async () => {},
  };
  const acoes = criarAcoes({
    config, janelas, agora: () => agoraMs,
    abrirCaminho: async (p: string) => (c.abertos.push(p), ""),
    abrirUrl: async (u: string, n?: string) => void c.urls.push([u, n]),
    executarProcesso: async (f: string, a: string[]) => void c.procs.push([f, a]),
    listarProgramas: async () => [
      { nome: "Google Chrome", tipo: "app", id: "Chrome" },
      { nome: "Microsoft Excel", tipo: "app", id: "Excel" },
      { nome: "WhatsApp", tipo: "app", id: "5319275A.WhatsAppDesktop_cv1g1gvanyjgm!App" },
      { nome: "Zap Web", tipo: "arquivo", caminho: "C:\\Users\\x\\Desktop\\Zap Web.lnk" },
    ],
    pastasConhecidas: [{ falas: ["downloads"], caminho: "C:\\Users\\x\\Downloads" }],
  });
  const cerebro = criarCerebro({ config, acoes, agora: () => agoraMs });
  return { cerebro, config, acoes };
}
const dizer = (cer: any, t: string, origem = "voz") => cer.ouvir(t, { origem });

beforeEach(() => {
  c = { abertos: [], urls: [], procs: [], teclas: [], fechadas: [], vol: [], mortos: [] };
  agoraMs = 1_000_000;
  janelasAbertas = [
    { hwnd: 11, pid: 100, titulo: "YouTube - Google Chrome", proc: "chrome", foco: true },
    { hwnd: 12, pid: 100, titulo: "Gmail - Google Chrome", proc: "chrome", foco: false },
    { hwnd: 21, pid: 200, titulo: "Pasta1 - Excel", proc: "EXCEL", foco: false },
  ];
});

describe("ativação", () => {
  it("dormindo ignora conversa que não chama pelo nome", async () => {
    const { cerebro } = montar();
    const r = await dizer(cerebro, "abre o chrome por favor");
    expect(r.ignorado).toBe(true);
    expect(c.procs).toEqual([]);
  });
  it("ignora alucinações do Whisper", async () => {
    const { cerebro } = montar();
    expect((await dizer(cerebro, "Obrigado.")).ignorado).toBe(true);
    expect((await dizer(cerebro, "Jarvis.")).fala).toBe("Pois não?");
  });
  it("só o nome: acorda e o próximo comando não precisa do nome", async () => {
    const { cerebro } = montar();
    expect((await dizer(cerebro, "Jarvis")).fala).toBe("Pois não?");
    expect(cerebro.estado().estado).toBe("ouvindo");
    const r = await dizer(cerebro, "abre o excel");
    expect(r.ok).toBe(true);
    expect(c.procs[0][1][0]).toContain("Excel");
  });
  it("nome + comando na mesma frase", async () => {
    const { cerebro } = montar();
    const r = await dizer(cerebro, "Jarvis, abre a marca Beira Rio");
    expect(r.fala).toMatch(/Abrindo a marca BEIRA RIO. Tem 5 referências/);
    expect(c.abertos).toEqual([path.join(raiz, "BEIRA RIO")]);
  });
  it("depois do tempo volta a dormir", async () => {
    const { cerebro } = montar();
    await dizer(cerebro, "Jarvis");
    agoraMs += 11_000;
    expect(cerebro.estado().estado).toBe("dormindo");
    expect((await dizer(cerebro, "abre o excel")).ignorado).toBe(true);
  });
  it("janela de conversa: após um comando continua ouvindo por alguns segundos", async () => {
    const { cerebro } = montar();
    await dizer(cerebro, "Jarvis abre a marca beira rio");
    agoraMs += 5000;
    const r = await dizer(cerebro, "abre a referência 8506 209");
    expect(r.ok).toBe(true);
    expect(c.abertos[1]).toBe(path.join(raiz, "BEIRA RIO", "8506.209"));
    agoraMs += 9000;
    expect(cerebro.estado().estado).toBe("dormindo");
  });
  it("texto digitado não precisa do nome", async () => {
    const { cerebro } = montar();
    const r = await dizer(cerebro, "abre o excel", "texto");
    expect(r.ok).toBe(true);
  });
  it("'pode dormir' volta a esperar pelo nome", async () => {
    const { cerebro } = montar();
    await dizer(cerebro, "Jarvis");
    await dizer(cerebro, "pode dormir");
    expect(cerebro.estado().estado).toBe("dormindo");
  });
});

describe("trocar o nome de ativação por voz", () => {
  it("Jarvis -> seu nome agora é Assistente -> confirma e passa a responder só ao novo nome", async () => {
    const { cerebro, config } = montar();
    expect((await dizer(cerebro, "Jarvis")).fala).toBe("Pois não?");
    const r = await dizer(cerebro, "Seu nome agora é: Assistente.");
    expect(r.fala).toBe("Ok, me chame de Assistente quando quiser algo.");
    expect(config.get().nomeAtivacao).toBe("Assistente");
    cerebro.dormir();
    expect((await dizer(cerebro, "Jarvis abre o excel")).ignorado).toBe(true);
    const ok = await dizer(cerebro, "Assistente, abre o excel");
    expect(ok.ok).toBe(true);
    expect(c.procs.length).toBe(1);
  });
  it("tudo na mesma frase", async () => {
    const { cerebro, config } = montar();
    const r = await dizer(cerebro, "Jarvis, seu nome agora é Computador");
    expect(r.fala).toContain("Computador");
    expect(config.get().nomeAtivacao).toBe("Computador");
  });
  it("sem dizer o nome: pergunta e aceita a resposta", async () => {
    const { cerebro, config } = montar();
    await dizer(cerebro, "Jarvis");
    expect((await dizer(cerebro, "seu nome agora é")).fala).toBe("Qual nome você quer usar?");
    expect(cerebro.estado().estado).toBe("nome");
    const r = await dizer(cerebro, "Zé Carlos");
    expect(r.fala).toBe("Ok, me chame de Zé Carlos quando quiser algo.");
    expect(config.get().nomeAtivacao).toBe("Zé Carlos");
  });
  it("recusa nome que parece comando e pergunta de novo", async () => {
    const { cerebro, config } = montar();
    await dizer(cerebro, "Jarvis");
    const r = await dizer(cerebro, "seu nome agora é abre");
    expect(r.ok).toBe(false);
    expect(config.get().nomeAtivacao).toBe("Jarvis");
    expect(cerebro.estado().estado).toBe("nome");
  });
  it("o nome fica salvo no arquivo (sobrevive a reiniciar o programa)", async () => {
    const arq = path.join(tmp, "persist.json");
    const a = criarConfig(arq);
    a.set({ pastaRaiz: raiz });
    const { cerebro } = (() => {
      const acoes = criarAcoes({ config: a, janelas: {}, abrirCaminho: async () => "", abrirUrl: async () => {}, executarProcesso: async () => {}, listarProgramas: async () => [] });
      return { cerebro: criarCerebro({ config: a, acoes, agora: () => agoraMs }) };
    })();
    await dizer(cerebro, "Jarvis, seu nome agora é Assistente");
    expect(criarConfig(arq).get().nomeAtivacao).toBe("Assistente");
  });
});

describe("fluxo marca > referência > arquivos", () => {
  it("abre a marca e depois pesquisa a referência dentro dela", async () => {
    const { cerebro } = montar();
    await dizer(cerebro, "Jarvis abre a marca Beira Rio");
    const r = await dizer(cerebro, "pesquisa a referência 8506");
    expect(r.fala).toMatch(/Abrindo 8506.209 da BEIRA RIO. Tem 2 arquivos/);
    expect(c.abertos.at(-1)).toBe(path.join(raiz, "BEIRA RIO", "8506.209"));
  });
  it("lista os arquivos da referência aberta e abre um deles", async () => {
    const { cerebro } = montar();
    await dizer(cerebro, "Jarvis abre a marca beira rio referência 8506 ponto 209");
    const l = await dizer(cerebro, "lista os arquivos");
    expect(l.fala).toBe("2 arquivos: ficha tecnica, frente.");
    const a = await dizer(cerebro, "abre o arquivo ficha");
    expect(a.ok).toBe(true);
    expect(c.abertos.at(-1)).toBe(path.join(raiz, "BEIRA RIO", "8506.209", "ficha tecnica.pdf"));
  });
  it("referência parcial ambígua: pergunta e aceita 'dois'", async () => {
    const { cerebro } = montar();
    await dizer(cerebro, "Jarvis abre a marca Beira Rio");
    const q = await dizer(cerebro, "abre a referência 8367");
    expect(q.fala).toMatch(/Achei 3 referências\. 1, 8367\.871\. 2, 8367\.872\. 3, 8367\.875\. Qual\?/);
    expect(cerebro.estado().estado).toBe("escolhendo");
    const r = await dizer(cerebro, "dois");
    expect(r.ok).toBe(true);
    expect(c.abertos.at(-1)).toBe(path.join(raiz, "BEIRA RIO", "8367.872"));
  });
  it("aceita escolher pelo final do código falado", async () => {
    const { cerebro } = montar();
    await dizer(cerebro, "Jarvis abre a referência 8367 da beira rio");
    await dizer(cerebro, "8367.875");
    expect(c.abertos.at(-1)).toBe(path.join(raiz, "BEIRA RIO", "8367.875"));
  });
  it("cancelar a escolha não abre nada", async () => {
    const { cerebro } = montar();
    await dizer(cerebro, "Jarvis abre a referência 8367 da beira rio");
    const r = await dizer(cerebro, "cancela");
    expect(r.fala).toBe("Ok, cancelei.");
    expect(c.abertos).toEqual([]);
  });
  it("mesma referência em duas marcas pergunta qual", async () => {
    const { cerebro } = montar();
    const q = await dizer(cerebro, "Jarvis abre a referência 8506.209");
    expect(q.fala).toMatch(/BEBECE — 8506.209/);
    expect(q.fala).toMatch(/BEIRA RIO — 8506.209/);
  });
  it("referência que está em outra marca é sugerida", async () => {
    const { cerebro } = montar();
    const q = await dizer(cerebro, "Jarvis abre a marca molekinha referência 4182 224");
    expect(q.fala).toMatch(/Não achei 4182 224 na marca MOLEKINHA, mas achei em outra\. 1, BEBECE — 4182.224/);
    await dizer(cerebro, "um");
    expect(c.abertos.at(-1)).toBe(path.join(raiz, "BEBECE", "4182.224"));
  });
  it("marca com nome parecido: tolera o 'k' trocado", async () => {
    const { cerebro } = montar();
    const r = await dizer(cerebro, "Jarvis abre a marca molequinha");
    expect(r.ok).toBe(true);
    expect(c.abertos[0]).toBe(path.join(raiz, "MOLEKINHA"));
  });
  it("marca inexistente / referência inexistente", async () => {
    const { cerebro } = montar();
    expect((await dizer(cerebro, "Jarvis abre a marca zzzzzz")).fala).toMatch(/Não achei a marca/);
    await dizer(cerebro, "abre a marca beira rio");
    expect((await dizer(cerebro, "abre a referência 9999 999")).ok).toBe(false);
  });
  it("volta uma pasta", async () => {
    const { cerebro } = montar();
    await dizer(cerebro, "Jarvis abre a marca beira rio referência 8506 209");
    const r = await dizer(cerebro, "volta uma pasta");
    expect(r.ok).toBe(true);
    expect(c.abertos.at(-1)).toBe(path.join(raiz, "BEIRA RIO"));
  });
  it("sem pasta raiz configurada avisa", async () => {
    const { cerebro } = montar({ pastaRaiz: "" });
    expect((await dizer(cerebro, "Jarvis abre a marca beira rio")).fala).toMatch(/pasta raiz/);
  });
  it("'beira rio 8506 209' (marca + código sem a palavra marca)", async () => {
    const { cerebro } = montar();
    const r = await dizer(cerebro, "Jarvis abre beira rio 8506 209");
    expect(r.ok).toBe(true);
    expect(c.abertos[0]).toBe(path.join(raiz, "BEIRA RIO", "8506.209"));
  });
});

describe("programas, sites e janelas", () => {
  it("abre programa instalado pelo menu Iniciar", async () => {
    const { cerebro } = montar();
    // chrome já está aberto: traz para a frente em vez de abrir outro
    const r = await dizer(cerebro, "Jarvis abre o chrome");
    expect(r.fala).toMatch(/já estava aberto/);
    janelasAbertas = [];
    const r2 = await dizer(cerebro, "abre o whatsapp");
    expect(r2.fala).toBe("Abrindo WhatsApp.");
    expect(c.procs.at(-1)).toEqual(["explorer.exe", ["shell:AppsFolder\\5319275A.WhatsAppDesktop_cv1g1gvanyjgm!App"]]);
  });
  it("atalho da área de trabalho (zap web) abre pelo arquivo", async () => {
    const { cerebro } = montar();
    janelasAbertas = [];
    await dizer(cerebro, "Jarvis abre o zap web");
    expect(c.abertos[0]).toBe("C:\\Users\\x\\Desktop\\Zap Web.lnk");
  });
  it("apelido do usuário tem prioridade", async () => {
    const { cerebro } = montar({ aliases: [{ falas: ["meu zap"], tipo: "url", destino: "https://web.whatsapp.com" }] });
    await dizer(cerebro, "Jarvis abre o meu zap");
    expect(c.urls[0][0]).toBe("https://web.whatsapp.com");
  });
  it("só o nome de um programa também funciona", async () => {
    const { cerebro } = montar();
    janelasAbertas = [];
    const r = await dizer(cerebro, "Jarvis excel");
    expect(r.ok).toBe(true);
    expect(c.procs.length).toBe(1);
  });
  it("site conhecido e endereço", async () => {
    const { cerebro } = montar();
    await dizer(cerebro, "Jarvis abre o youtube");
    await dizer(cerebro, "abre o site globo.com");
    expect(c.urls.map((u) => u[0])).toEqual(["https://www.youtube.com", "https://globo.com"]);
  });
  it("fecha o Chrome: fecha todas as janelas dele, sem tocar no Excel", async () => {
    const { cerebro } = montar();
    const r = await dizer(cerebro, "Jarvis fecha o chrome");
    expect(r.fala).toBe("Fechando chrome (2 janelas).");
    expect(c.fechadas).toEqual([[11, 12]]);
    expect(c.mortos).toEqual([]);
  });
  it("'mata' fecha e depois força o encerramento", async () => {
    const { cerebro } = montar();
    await dizer(cerebro, "Jarvis mata o excel");
    expect(c.fechadas).toEqual([[21]]);
    expect(c.mortos).toEqual([[200]]);
  });
  it("não encontra programa aberto", async () => {
    const { cerebro } = montar();
    expect((await dizer(cerebro, "Jarvis fecha o spotify")).ok).toBe(false);
  });
  it("não fecha processos protegidos", async () => {
    const { cerebro } = montar();
    janelasAbertas = [{ hwnd: 1, pid: 4, titulo: "Windows Defender", proc: "MsMpEng", foco: false }];
    expect((await dizer(cerebro, "Jarvis fecha o msmpeng")).ok).toBe(false);
    expect(c.fechadas).toEqual([]);
  });
});

describe("navegador e volume", () => {
  it("próxima aba no navegador em foco", async () => {
    const { cerebro } = montar();
    const r = await dizer(cerebro, "Jarvis próxima aba");
    expect(r.ok).toBe(true);
    expect(c.teclas[0][0]).toBe("^{TAB}");
    expect(c.teclas[0][1].hwnd).toBe(11);
  });
  it("aba número 3 e aba por nome (Chrome usa Ctrl+Shift+A)", async () => {
    const { cerebro } = montar();
    await dizer(cerebro, "Jarvis vai para a aba 3");
    await dizer(cerebro, "vai para a aba do gmail");
    expect(c.teclas[0][0]).toBe("^3");
    expect(c.teclas[1][0]).toBe("^+a");
    expect(c.teclas[1][1]).toMatchObject({ digitar: "gmail", depois: "{ENTER}" });
  });
  it("Firefox pesquisa abas pela barra de endereço (% texto)", async () => {
    const { cerebro } = montar();
    janelasAbertas = [{ hwnd: 31, pid: 300, titulo: "Mozilla Firefox", proc: "firefox", foco: true }];
    await dizer(cerebro, "Jarvis vai para a aba do youtube");
    expect(c.teclas[0][0]).toBe("^l");
    expect(c.teclas[0][1].digitar).toBe("% youtube");
  });
  it("navegador citado que não está aberto", async () => {
    const { cerebro } = montar();
    const r = await dizer(cerebro, "Jarvis próxima aba no firefox");
    expect(r.fala).toBe("O Firefox não está aberto.");
  });
  it("sem navegador aberto", async () => {
    const { cerebro } = montar();
    janelasAbertas = [];
    expect((await dizer(cerebro, "Jarvis fecha a aba")).fala).toBe("Nenhum navegador está aberto.");
  });
  it("pesquisa no Google abre a busca", async () => {
    const { cerebro } = montar();
    await dizer(cerebro, "Jarvis pesquisa no google preço do dólar");
    expect(c.urls[0][0]).toBe("https://www.google.com/search?q=preco%20do%20dolar");
  });
  it("'pesquisa X' sem contexto de pasta vai para a web", async () => {
    const { cerebro } = montar();
    await dizer(cerebro, "Jarvis pesquisa receita de bolo");
    expect(c.urls[0][0]).toContain("google.com/search");
  });
  it("volume", async () => {
    const { cerebro } = montar();
    expect((await dizer(cerebro, "Jarvis volume em 30")).fala).toBe("Volume em 30 por cento.");
    await dizer(cerebro, "aumenta o volume");
    await dizer(cerebro, "mudo");
    expect(c.vol).toEqual([["definir", 30], ["mais", 10], ["mudo", 0]]);
  });
  it("erro dentro de uma ação vira mensagem, não derruba o assistente", async () => {
    const { cerebro, acoes } = montar();
    const orig = acoes.executar;
    acoes.executar = async () => {
      throw new Error("falhou feio");
    };
    const r = await dizer(cerebro, "Jarvis abre o excel");
    expect(r.fala).toMatch(/Deu erro: falhou feio/);
    acoes.executar = orig;
  });
  it("não entendeu", async () => {
    const { cerebro } = montar();
    const r = await dizer(cerebro, "Jarvis xpto qwerty bla bla bla");
    expect(r.ok).toBe(false);
    expect(r.fala).toMatch(/Não entendi/);
  });
});
