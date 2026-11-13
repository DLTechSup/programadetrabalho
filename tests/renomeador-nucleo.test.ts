import { describe, expect, it } from "vitest";
import { montarPlano, nomeSeguro, ordenar, OPCOES_PADRAO, type ArquivoSelecionado, type Opcoes } from "../src/apps/renomeador/nucleo";

function arq(nome: string, mtimeMs: number, pasta = "C:\\fotos"): ArquivoSelecionado {
  return { caminho: `${pasta}\\${nome}`, nome, mtimeMs };
}

function nomesDoPlano(arquivos: ArquivoSelecionado[], op: Partial<Opcoes>, nomesNaPasta: string[] = []): string[] {
  const plano = montarPlano(arquivos, { ...OPCOES_PADRAO, ...op }, nomesNaPasta);
  return plano.pares.map((p) => p.novo.split("\\").pop()!);
}

describe("nomeSeguro", () => {
  it("tira caracteres proibidos no Windows e espacos/pontos nas pontas", () => {
    expect(nomeSeguro('  bra:nco/<1>?  ')).toBe("branco1");
    expect(nomeSeguro("a/b*c")).toBe("abc");
  });
});

describe("montarPlano - sequencia basica", () => {
  it("numera em sequencia, com zero e extensao em minuscula", () => {
    const arqs = [arq("IMG-20260101-WA0007.JPG", 100), arq("IMG-20260101-WA0008.jpg", 200), arq("foto.png", 300)];
    const plano = montarPlano(arqs, { ...OPCOES_PADRAO, nome: "branco" }, []);
    expect(plano.erro).toBe("");
    expect(plano.pares.map((p) => p.novo.split("\\").pop())).toEqual(["branco 01.jpg", "branco 02.jpg", "branco 03.png"]);
  });
});

describe("montarPlano - ordens, zeros, separador, inicio", () => {
  const arqs = [arq("b 10.jpg", 300), arq("b 2.jpg", 200), arq("b 1.jpg", 100)];

  it("ordena por nome (ordem natural: 2 antes de 10)", () => {
    expect(ordenar(arqs, "nome").map((a) => a.nome)).toEqual(["b 1.jpg", "b 2.jpg", "b 10.jpg"]);
  });
  it("ordena por data de modificacao", () => {
    expect(ordenar(arqs, "data").map((a) => a.nome)).toEqual(["b 1.jpg", "b 2.jpg", "b 10.jpg"]);
  });
  it("zeros desligado comeca de onde o usuario pedir", () => {
    expect(nomesDoPlano(arqs, { nome: "x", zeros: false, inicio: 8 })).toEqual(["x 8.jpg", "x 9.jpg", "x 10.jpg"]);
  });
  it("a largura do zero cresce sozinha quando passa de 99", () => {
    expect(nomesDoPlano(arqs, { nome: "x", zeros: true, inicio: 99 })).toEqual(["x 099.jpg", "x 100.jpg", "x 101.jpg"]);
  });
  it("separadores", () => {
    expect(nomesDoPlano(arqs, { nome: "x", separador: "sublinhado", ordem: "nome" })).toEqual(["x_01.jpg", "x_02.jpg", "x_03.jpg"]);
    expect(nomesDoPlano(arqs, { nome: "x", separador: "nenhum", ordem: "nome" })).toEqual(["x01.jpg", "x02.jpg", "x03.jpg"]);
  });
});

describe("montarPlano - continua a numeracao que ja existe na pasta", () => {
  const existentes = ["branco 01.jpg", "branco 02.jpg", "branco 07.png", "preto 09.jpg"];
  const novos = [arq("a.jpg", 100), arq("b.jpg", 200)];

  it("comeca depois do maior numero ja usado, e avisa", () => {
    const plano = montarPlano(novos, { ...OPCOES_PADRAO, nome: "branco" }, existentes);
    expect(plano.pares.map((p) => p.novo.split("\\").pop())).toEqual(["branco 08.jpg", "branco 09.jpg"]);
    expect(plano.avisos.length).toBeGreaterThan(0);
  });
  it("sem 'continuar', detecta o conflito com o que ja existe", () => {
    const plano = montarPlano(novos, { ...OPCOES_PADRAO, nome: "branco", continuar: false, inicio: 1 }, existentes);
    expect(plano.erro).toContain("branco 01.jpg");
  });
  it("com um inicio escolhido que nao bate em nada, nao da erro", () => {
    expect(montarPlano(novos, { ...OPCOES_PADRAO, nome: "branco", inicio: 20 }, existentes).erro).toBe("");
  });
});

describe("montarPlano - nome invalido e vazio", () => {
  const arqs = [arq("a.jpg", 100)];
  it("sem nome, ou sem arquivos", () => {
    expect(montarPlano(arqs, { ...OPCOES_PADRAO, nome: "" }, []).erro).not.toBe("");
    expect(montarPlano([], { ...OPCOES_PADRAO, nome: "x" }, []).erro).not.toBe("");
  });
  it("nome com caracteres proibidos e limpo antes de montar o plano", () => {
    const plano = montarPlano(arqs, { ...OPCOES_PADRAO, nome: "a/b*c" }, []);
    expect(plano.pares[0].novo.endsWith("abc 01.jpg")).toBe(true);
  });
});
