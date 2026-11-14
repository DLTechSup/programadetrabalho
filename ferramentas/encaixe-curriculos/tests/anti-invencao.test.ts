import { describe, expect, it } from "vitest";
import {
  encontrarTermosNaoConfirmados,
  numerosInventados,
  removerMencoes,
  termosProibidos,
  validarAntiInvencao,
} from "@/lib/anti-invencao";
import type { PalavraChave } from "@/lib/tipos";

const p = (termo: string, variantes: string[] = []): PalavraChave => ({
  termo,
  variantes,
  categoria: "ferramenta",
  obrigatorio: true,
});

const faltando = [p("Python"), p("Power BI", ["powerbi"]), p("Kubernetes", ["k8s"])];

describe("termosProibidos", () => {
  it("libera só termos confirmados com descrição", () => {
    const proibidos = termosProibidos(faltando, [
      { termo: "Python", descricao: "Curso na Alura, 2023" },
      { termo: "Kubernetes", descricao: "   " },
    ]);
    expect(proibidos.map((x) => x.termo)).toEqual(["Power BI", "Kubernetes"]);
  });
});

describe("removerMencoes", () => {
  it("remove itens de listas e mantém o resto", () => {
    const texto = "HABILIDADES\nExcel, Power BI, SQL\n- Docker; K8s\nFerramentas: PowerBI";
    const limpo = removerMencoes(texto, faltando);
    expect(limpo).toBe("HABILIDADES\nExcel, SQL\n- Docker");
    expect(encontrarTermosNaoConfirmados(limpo, faltando)).toHaveLength(0);
  });

  it("não apaga frases corridas (vira aviso)", () => {
    const texto = "- Criei dashboards em Power BI para a diretoria";
    expect(removerMencoes(texto, faltando)).toBe(texto);
  });
});

describe("numerosInventados", () => {
  it("aceita números do original, inclusive telefone reformatado", () => {
    expect(numerosInventados("Tel. 11 98765-4321 | 2019 - 2023", ["(11) 987654321 — 2019 a 2023"])).toEqual([]);
  });
  it("aponta métricas novas", () => {
    expect(numerosInventados("Reduzi custos em 35%", ["Reduzi custos"])).toEqual(["35"]);
  });
});

describe("validarAntiInvencao", () => {
  it("gera aviso com o trecho quando um termo não confirmado persiste", () => {
    const avisos = validarAntiInvencao({
      curriculoAjustado: "Maria\n- Criei dashboards em Power BI",
      curriculoOriginal: "Maria. Criei dashboards.",
      proibidos: faltando,
      confirmadas: [],
    });
    expect(avisos).toEqual([{ tipo: "termo", valor: "Power BI", trecho: "- Criei dashboards em Power BI" }]);
  });
});
