import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  agruparVariacoes, analisarLinha, bancoVazio, consultarAbreviacao, criarLinhaPai, detectarLinhaPai,
  gerarCodigoEDescricao, limparNomeCor, normalizarCodigos, processarVariacoes, serializarBanco, titulo,
  type Linha, type Planilha,
} from "../src/core/nucleo";
import { gerarXlsx, lerPlanilha } from "../src/core/planilha";

const ref = JSON.parse(readFileSync(new URL("./referencia.json", import.meta.url), "utf-8"));

describe("paridade com o nucleo.py original", () => {
  it(`analisar_linha dá o mesmo resultado em ${ref.analises.length} casos`, () => {
    const divergencias: string[] = [];
    for (const c of ref.analises) {
      const r = analisarLinha(c.descricao, c.cod);
      if (r.tamanho !== c.tamanho || r.chave !== c.chave || r.sugestao !== c.sugestao || r.veioCodFornecedor !== c.veio) {
        divergencias.push(`${JSON.stringify([c.descricao, c.cod])}\n  py=${JSON.stringify([c.tamanho, c.chave, c.sugestao, c.veio])}\n  ts=${JSON.stringify([r.tamanho, r.chave, r.sugestao, r.veioCodFornecedor])}`);
      }
    }
    expect(divergencias.slice(0, 10).join("\n")).toBe("");
  });

  it("limpar_nome_cor dá o mesmo resultado", () => {
    for (const [entrada, esperado] of ref.limpar) expect(limparNomeCor(entrada)).toBe(esperado);
  });

  it("titulo() imita str.title()", () => {
    expect(titulo("branco off/camel")).toBe("Branco Off/Camel");
    expect(titulo("d'agua 3m")).toBe("D'Agua 3M");
    expect(titulo("AVELÃ ONÇA")).toBe("Avelã Onça");
  });
});

const COLUNAS = [
  "Código", "Descrição", "Cód. no fornecedor", "Marca", "Categoria do produto", "Peso líquido (Kg)",
  "Peso bruto (Kg)", "Largura do produto", "Altura do Produto", "Profundidade do produto", "Volumes",
  "Itens p/ caixa", "Data Validade", "Descrição Curta", "GTIN/EAN",
];
function planilhaExemplo(): Planilha {
  const base = (o: Linha): Linha => Object.fromEntries(COLUNAS.map((c) => [c, o[c] ?? null]));
  return {
    colunas: [...COLUNAS],
    linhas: [
      base({ Código: "SAND100", Descrição: "Sandalia Rasteira", Marca: "VIZZANO", "Categoria do produto": "Sandalia",
        "Peso líquido (Kg)": "0,3", "Peso bruto (Kg)": "0,4", "Largura do produto": "30", "Altura do Produto": "10",
        "Profundidade do produto": "20", Volumes: "1", "Itens p/ caixa": "1", "Descrição Curta": "curta" }),
      base({ Descrição: "SANDALIA 1234567 PRETO 37" }),
      base({ Descrição: "SANDALIA 1234567 PRETO 38" }),
      base({ Descrição: "SANDALIA 1234567 BRANCO OFF 37" }),
      base({ Descrição: "SANDALIA SEM TAMANHO" }),
    ],
  };
}

describe("fluxo completo", () => {
  it("detecta o PAI, preenche variações e gera código/descrição", () => {
    const p = planilhaExemplo();
    normalizarCodigos(p);
    const pai = detectarLinhaPai(p);
    expect(pai).toBe(0);
    processarVariacoes(p, pai!, "Sandalia");
    expect(p.linhas[1]["Código Pai"]).toBe("SAND100");
    expect(p.linhas[1]["Marca"]).toBe("VIZZANO");
    expect(p.linhas[1]["Estoque mínimo"]).toBe("1,00");
    expect(p.linhas[0]["Categoria do produto"]).toBeNull();

    const { analisadas, grupos } = agruparVariacoes(p, pai!);
    expect(grupos.size).toBe(3);
    expect(grupos.get("SANDALIA PRETO")!.sugestao).toBe("Sandalia Preto");
    expect(grupos.get("SANDALIA PRETO")!.tamanhos).toEqual(["37", "38"]);

    const banco = bancoVazio();
    const cores = new Map<string, [string, string]>([
      ["SANDALIA PRETO", ["Cor:Preto", "pt"]],
      ["SANDALIA BRANCO OFF", ["Branco Off", "brof"]],
    ]);
    const r = gerarCodigoEDescricao(p, analisadas, grupos, "SAND100", cores, banco, "VIZZANO");
    expect(r.total).toBe(3);
    expect(p.linhas[1]["Código"]).toBe("SAND100PT37");
    expect(p.linhas[1]["Descrição"]).toBe("Cor:Preto;Tamanho:37");
    expect(p.linhas[3]["Código"]).toBe("SAND100BROF37");
    expect(consultarAbreviacao(banco, "vizzano", "preto")).toBe("PT");
    expect(consultarAbreviacao(banco, "OUTRA", "preto")).toBe("PT"); // cai no genérico
    expect(JSON.parse(serializarBanco(banco)).por_marca["VIZZANO|preto"]).toBe("PT");
  });

  it("cria PAI quando não existe e salva/relê o .xlsx", () => {
    const p = planilhaExemplo();
    p.linhas[0]["Código"] = null;
    p.linhas[0]["Marca"] = null;
    normalizarCodigos(p);
    expect(detectarLinhaPai(p)).toBeNull();
    const idx = criarLinhaPai(p, {
      codigo: "NOVO1", marca: "KENNER", categoria: "Chinelo", peso_liquido: "0,2", peso_bruto: "0,3",
      largura: "1", altura: "2", profundidade: "3", volumes: "1", itens_caixa: "1",
    });
    expect(idx).toBe(p.linhas.length - 1);
    processarVariacoes(p, idx, "Chinelo");
    expect(p.linhas[1]["Código Pai"]).toBe("NOVO1");

    const volta = lerPlanilha(gerarXlsx(p));
    expect(volta.colunas).toContain("Código Pai");
    expect(volta.linhas.length).toBe(p.linhas.length);
    expect(volta.linhas[1]["Categoria do produto"]).toBe("Chinelo");
  });
});

describe("arquivo já processado (reexportado do Bling, todas as linhas com Código)", () => {
  function reexportada(): Planilha {
    const p = planilhaExemplo();
    p.linhas[0]["Código"] = "BT100"; // PAI
    p.linhas[0]["Categoria do produto"] = null; // o programa deixa a categoria do PAI vazia
    p.linhas = p.linhas.slice(0, 4);
    p.linhas[1] = { ...p.linhas[1], Código: "BT100PT37", Descrição: "Cor:Preto;Tamanho:37", "Código Pai": "BT100", "Categoria do produto": "Sandalia" };
    p.linhas[2] = { ...p.linhas[2], Código: "BT100PT38", Descrição: "Cor:Preto;Tamanho:38", "Código Pai": "BT100", "Categoria do produto": "Sandalia" };
    p.linhas[3] = { ...p.linhas[3], Código: "BT100CAF37", Descrição: "Cor:Café;Tamanho:37", "Código Pai": "BT100", "Categoria do produto": "Sandalia" };
    return p;
  }

  it("acha o PAI verdadeiro (e não a primeira variação)", () => {
    const p = reexportada();
    normalizarCodigos(p);
    expect(detectarLinhaPai(p)).toBe(0);
  });

  it("reprocessar mantém os mesmos códigos, sem repetir abreviações", () => {
    const p = reexportada();
    normalizarCodigos(p);
    processarVariacoes(p, 0, "Sandalia");
    const { analisadas, grupos } = agruparVariacoes(p, 0);
    expect([...grupos.values()].map((g) => g.sugestao).sort()).toEqual(["Café", "Preto"]);
    const cores = new Map<string, [string, string]>();
    for (const [chave, g] of grupos) cores.set(chave, [g.sugestao, g.sugestao === "Café" ? "CAF" : "PT"]);
    gerarCodigoEDescricao(p, analisadas, grupos, "BT100", cores, bancoVazio(), "X");
    expect(p.linhas.slice(1).map((l) => l["Código"])).toEqual(["BT100PT37", "BT100PT38", "BT100CAF37"]);
  });
});
