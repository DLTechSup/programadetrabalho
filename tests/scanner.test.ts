import { describe, expect, it } from "vitest";
import {
  agruparVariacoes, bancoVazio, gerarCodigoEDescricao, normalizarCodigos, processarVariacoes,
  type Linha, type Planilha,
} from "../src/core/nucleo";
import { Agregador, aplicarAoBanco, extrairCores, statusDoPar } from "../src/core/scanner";

function pronta(pai: string, marca: string, cores: Array<[string, string, number[]]>): Planilha {
  const colunas = ["Código", "Descrição", "Marca", "Categoria do produto"];
  const linhas: Linha[] = [{ Código: pai, Descrição: "Produto", Marca: marca, "Categoria do produto": "X" }];
  for (const [cor, , tams] of cores) for (const t of tams) linhas.push({ Código: "", Descrição: `PROD ${cor} ${t}` });
  const p: Planilha = { colunas, linhas };
  normalizarCodigos(p);
  processarVariacoes(p, 0, "Sandalia");
  const { analisadas, grupos } = agruparVariacoes(p, 0);
  const mapa = new Map<string, [string, string]>();
  for (const [chave] of grupos) {
    const c = cores.find(([nome]) => chave.endsWith(nome.toUpperCase()))!;
    mapa.set(chave, [c[0], c[1]]);
  }
  gerarCodigoEDescricao(p, analisadas, grupos, pai, mapa, bancoVazio(), marca);
  return p;
}

describe("scanner", () => {
  it("recupera as abreviações usadas ao gerar a planilha", () => {
    const p = pronta("VZ2024", "VIZZANO", [["Preto", "PT", [37, 38]], ["Branco Off", "BROF", [37]]]);
    const pares = extrairCores(p, "pasta-qualquer");
    expect(new Set(pares.map((x) => `${x.marca}|${x.cor}|${x.abrev}`))).toEqual(
      new Set(["VIZZANO|preto|PT", "VIZZANO|branco off|BROF"]),
    );
  });

  it("usa o nome da pasta quando a planilha não tem Marca", () => {
    const p = pronta("A1", "", [["Azul", "AZ", [36]]]);
    expect(extrairCores(p, "Kenner")[0].marca).toBe("KENNER");
  });

  it("ignora planilhas ainda não preenchidas e códigos fora do padrão", () => {
    const crua: Planilha = { colunas: ["Código", "Descrição"], linhas: [{ Código: "X", Descrição: "Prod" }, { Código: "", Descrição: "PROD PRETO 37" }] };
    expect(extrairCores(crua, "M")).toEqual([]);
    const torta: Planilha = {
      colunas: ["Código", "Descrição", "Código Pai"],
      linhas: [{ Código: "ZZZ37", Descrição: "Cor:Preto;Tamanho:37", "Código Pai": "ABC" }],
    };
    expect(extrairCores(torta, "M")).toEqual([]);
  });

  it("agrega por frequência, aponta conflitos e aplica ao banco", () => {
    const ag = new Agregador();
    const par = (abrev: string) => ({ marca: "M", cor: "preto", abrev });
    ag.adicionar([par("PT"), par("PT"), par("PR")]);
    const [r] = ag.resultado();
    expect(r).toMatchObject({ abrev: "PT", ocorrencias: 3, alternativas: ["PR"] });

    const banco = bancoVazio();
    banco.por_marca["M|preto"] = "OLD";
    expect(statusDoPar(banco, r)).toBe("diferente");
    expect(aplicarAoBanco(banco, [r], false)).toEqual({ novas: 0, atualizadas: 0 });
    expect(banco.por_marca["M|preto"]).toBe("OLD");
    expect(aplicarAoBanco(banco, [r], true)).toEqual({ novas: 0, atualizadas: 1 });
    expect(banco.por_marca["M|preto"]).toBe("PT");
    expect(banco.generico["preto"]).toBe("PT");
  });
});
