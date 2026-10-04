import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const req = createRequire(import.meta.url);
const { interpretar, interpretarEscolha, ehSim, ehNao, EXEMPLOS } = req("../electron/engine/comandos.cjs");
const T = req("../electron/engine/texto.cjs");

const casos: [string, Record<string, unknown>][] = [
  // marcas e referências
  ["Abre a marca Beira Rio", { tipo: "abrir_marca", marca: "beira rio", ref: "" }],
  ["abre a marca Beira Rio, referência 8506 ponto 209", { tipo: "abrir_marca", marca: "beira rio", ref: "8506 ponto 209" }],
  ["abre beira rio referência 8506", { tipo: "abrir_marca", marca: "beira rio", ref: "8506" }],
  ["Abre a referência 8506.209 da Beira Rio", { tipo: "abrir_ref", marca: "beira rio" }],
  ["abre a referencia 8367 da marca bebece", { tipo: "abrir_ref", ref: "8367", marca: "bebece" }],
  ["abre a referência 8506", { tipo: "abrir_ref", ref: "8506", marca: "" }],
  ["Pesquisa a referência 8367", { tipo: "pesquisar", termo: "8367", destino: "pasta" }],
  ["procura 8506 na pasta beira rio", { tipo: "pesquisar_em", termo: "8506", onde: "beira rio" }],
  ["procura ficha dentro da marca bebece", { tipo: "pesquisar_em", termo: "ficha", onde: "bebece" }],
  ["Lista os arquivos", { tipo: "listar_arquivos" }],
  ["quais são os arquivos", { tipo: "listar_arquivos" }],
  ["Abre o arquivo ficha técnica", { tipo: "abrir_arquivo", nome: "ficha tecnica" }],
  ["abre a pasta downloads", { tipo: "abrir_pasta", nome: "downloads" }],
  ["por favor, abre a pasta de documentos", { tipo: "abrir_pasta", nome: "documentos" }],
  ["abre o disco D", { tipo: "abrir_pasta", nome: "d" }],
  ["Volta uma pasta", { tipo: "pasta_acima" }],
  ["fecha as pastas", { tipo: "fechar_pasta", todas: true }],
  ["fecha a pasta", { tipo: "fechar_pasta", todas: false }],
  // programas
  ["Abre o WhatsApp", { tipo: "abrir", alvo: "whatsapp" }],
  ["abre o zap web", { tipo: "abrir", alvo: "zap web" }],
  ["abre o google chrome", { tipo: "abrir", alvo: "google chrome" }],
  ["Fecha o Chrome", { tipo: "fechar_programa", nome: "chrome", forcar: false }],
  ["mata o excel", { tipo: "fechar_programa", nome: "excel", forcar: true }],
  ["encerra o programa bloco de notas", { tipo: "fechar_programa", nome: "bloco de notas" }],
  // navegador
  ["Próxima aba", { tipo: "aba", op: "proxima" }],
  ["aba anterior", { tipo: "aba", op: "anterior" }],
  ["troca de aba no edge", { tipo: "aba", op: "proxima", navegador: "edge" }],
  ["vai para a aba 3", { tipo: "aba", op: "numero", n: 3 }],
  ["vai para a terceira aba", { tipo: "aba", op: "numero", n: 3 }],
  ["última aba", { tipo: "aba", op: "numero", n: 9 }],
  ["vai pra aba do youtube no chrome", { tipo: "aba", op: "nome", nome: "youtube", navegador: "chrome" }],
  ["nova aba", { tipo: "aba", op: "nova" }],
  ["fecha a aba", { tipo: "aba", op: "fechar" }],
  ["reabre a aba fechada", { tipo: "aba", op: "reabrir" }],
  ["recarrega a página", { tipo: "nav", op: "recarregar" }],
  ["janela anônima no firefox", { tipo: "nav", op: "anonima", navegador: "firefox" }],
  ["pesquisa no google preço do dólar", { tipo: "pesquisar", destino: "web" }],
  ["pesquisa preço do dólar", { tipo: "pesquisar", destino: null }],
  ["abre o site globo.com", { tipo: "abrir_site", site: "globo com" }],
  // janelas
  ["Troca de janela", { tipo: "janela", op: "trocar" }],
  ["vai para o excel", { tipo: "janela", op: "focar", nome: "excel" }],
  ["minimiza essa janela", { tipo: "janela", op: "minimizar", nome: "" }],
  ["maximiza o chrome", { tipo: "janela", op: "maximizar", nome: "chrome" }],
  ["mostra a área de trabalho", { tipo: "janela", op: "area_trabalho" }],
  ["fecha essa janela", { tipo: "janela", op: "fechar_atual" }],
  ["o que está aberto", { tipo: "janela", op: "listar" }],
  // volume e mídia
  ["aumenta o volume", { tipo: "volume", op: "mais", delta: 10 }],
  ["abaixa o volume um pouco", { tipo: "volume", op: "menos", delta: 5 }],
  ["aumenta o volume em 20", { tipo: "volume", op: "mais", delta: 20 }],
  ["volume em 30", { tipo: "volume", op: "definir", valor: 30 }],
  ["coloca o volume em cinquenta por cento", { tipo: "volume", op: "definir", valor: 50 }],
  ["volume no máximo", { tipo: "volume", op: "definir", valor: 100 }],
  ["mudo", { tipo: "volume", op: "mudo" }],
  ["liga o som", { tipo: "volume", op: "som" }],
  ["pausa", { tipo: "midia", op: "pausar" }],
  ["próxima música", { tipo: "midia", op: "proxima" }],
  // o próprio assistente
  ["seu nome agora é Assistente.", { tipo: "renomear", nome: "Assistente" }],
  ["Seu nome agora é: Zé Carlos!", { tipo: "renomear", nome: "Zé Carlos" }],
  ["a partir de agora você se chama Computador", { tipo: "renomear", nome: "Computador" }],
  ["seu nome agora é", { tipo: "renomear", nome: "" }],
  ["pode dormir", { tipo: "dormir" }],
  ["cancela", { tipo: "cancelar" }],
  ["ajuda", { tipo: "ajuda" }],
  ["que horas são", { tipo: "hora" }],
  ["blablabla", { tipo: "desconhecido" }],
];

describe("interpretar", () => {
  for (const [frase, esperado] of casos) {
    it(frase, () => {
      expect(interpretar(frase)).toMatchObject(esperado);
    });
  }
  it("frase vazia", () => expect(interpretar("  ").tipo).toBe("vazio"));
  it("um verbo de abrir não engole 'abrir pasta' nem 'abrir marca'", () => {
    expect(interpretar("abre a pasta lançamentos").tipo).toBe("abrir_pasta");
    expect(interpretar("abre a marca bebece").tipo).toBe("abrir_marca");
  });
});

describe("exemplos da ajuda", () => {
  it("todo exemplo é entendido (a documentação não mente)", () => {
    for (const g of EXEMPLOS) {
      for (const ex of g.itens) {
        const limpo = ex.replace(/\s*\(.*\)$/, "");
        const it = interpretar(limpo);
        expect(it.tipo, `${g.titulo}: ${limpo}`).not.toBe("desconhecido");
      }
    }
  });
});

describe("escolhas e confirmações", () => {
  it("número, ordinal e 'último'", () => {
    expect(interpretarEscolha("dois", 3)).toBe(1);
    expect(interpretarEscolha("o segundo", 3)).toBe(1);
    expect(interpretarEscolha("1", 3)).toBe(0);
    expect(interpretarEscolha("a última", 4)).toBe(3);
    expect(interpretarEscolha("quinto", 3)).toBeNull();
    expect(interpretarEscolha("banana", 3)).toBeNull();
  });
  it("sim e não", () => {
    expect(ehSim("Sim.")).toBe(true);
    expect(ehSim("pode sim")).toBe(true);
    expect(ehNao("Não")).toBe(true);
    expect(ehNao("sim")).toBe(false);
  });
});

describe("texto", () => {
  it("números por extenso e códigos", () => {
    expect(T.extrairNumero("vinte e cinco por cento")).toBe(25);
    expect(T.extrairNumero("cem por cento")).toBe(100);
    expect(T.extrairNumero("trezentos e quarenta")).toBe(340);
    expect(T.digitosDoCodigo("oito cinco zero seis ponto dois zero nove")).toBe("8506209");
    expect(T.digitosDoCodigo("8.506.209")).toBe("8506209");
    expect(T.falarCodigo("8506209")).toBe("8506.209");
  });
  it("alucinações do Whisper em silêncio são ruído", () => {
    for (const x of ["Obrigado.", "Legendas pela comunidade Amara.org", "Tchau!", "...", "Inscreva-se no canal"]) expect(T.ehRuido(x), x).toBe(true);
    expect(T.ehRuido("abre o chrome")).toBe(false);
  });
  it("semelhança tolera erro de grafia mas não confunde nomes diferentes", () => {
    expect(T.similaridade("molequinha", "MOLEKINHA")).toBeGreaterThan(0.9);
    expect(T.similaridade("microsoft edge", "Microsoft Excel")).toBeLessThan(0.82);
    expect(T.similaridade("chrome", "Chrome Remote Desktop")).toBeLessThan(T.similaridade("chrome", "Google Chrome") + 0.01);
  });
});
