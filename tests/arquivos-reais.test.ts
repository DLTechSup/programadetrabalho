import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  agruparVariacoes, bancoVazio, buscarCor, detectarLinhaPai, normalizarBanco, titulo, gerarCodigoEDescricao, limpo, normalizarCodigos,
  processarVariacoes, type Planilha,
} from "../src/core/nucleo";
import seed from "../src/core/cores_bling_seed.json";
import { lerPlanilha } from "../src/core/planilha";

const abrir = (nome: string) => lerPlanilha(readFileSync(new URL(`./fixtures/${nome}`, import.meta.url)));

/** Roda o fluxo inteiro; a abreviação de cada cor é a que o usuário digitaria. */
function rodar(p: Planilha, abrevs: Record<string, string>) {
  normalizarCodigos(p);
  const pai = detectarLinhaPai(p)!;
  const codigoPai = limpo(p.linhas[pai]["Código"]);
  processarVariacoes(p, pai, limpo(p.linhas[pai]["Categoria do produto"]) || "Sandalias");
  const { analisadas, grupos } = agruparVariacoes(p, pai);
  const cores = new Map<string, [string, string]>();
  for (const [chave, g] of grupos) if (abrevs[g.sugestao]) cores.set(chave, [g.sugestao, abrevs[g.sugestao]]);
  gerarCodigoEDescricao(p, analisadas, grupos, codigoPai, cores, bancoVazio(), "X");
  return { pai, codigoPai };
}

describe("arquivos reais do usuário", () => {
  const ABREV_MODARE = { Avelã: "AVL", Preto: "PT", Creme: "CRM", Alecrim: "ALCRM" };

  it("MODARE (resultado correto): o PAI é a última linha e reprocessar não muda nada", () => {
    const esperado = abrir("correto-modare.xlsx");
    const p = abrir("correto-modare.xlsx");
    const { pai, codigoPai } = rodar(p, ABREV_MODARE);
    expect(pai).toBe(esperado.linhas.length - 1);
    expect(codigoPai).toBe("MD7208113SAFE");
    for (let i = 0; i < p.linhas.length - 1; i++) {
      expect(p.linhas[i]["Código"]).toBe(esperado.linhas[i]["Código"]);
      expect(p.linhas[i]["Descrição"]).toBe(esperado.linhas[i]["Descrição"]);
      expect(p.linhas[i]["Código Pai"]).toBe("MD7208113SAFE");
    }
  });

  it("MODARE com os códigos das variações em branco (entrada nova) gera o mesmo resultado", () => {
    const esperado = abrir("correto-modare.xlsx");
    const p = abrir("correto-modare.xlsx");
    for (const l of p.linhas.slice(0, -1)) l["Código"] = null;
    rodar(p, ABREV_MODARE);
    expect(p.linhas.map((l) => l["Código"])).toEqual(esperado.linhas.map((l) => l["Código"]));
  });

  it("BERTELLI (arquivo que saiu com códigos repetidos): agora acha o PAI certo e conserta", () => {
    const p = abrir("errado-bertelli.xlsx");
    const { pai, codigoPai } = rodar(p, { Café: "CAF", Preto: "PR" });
    expect(pai).toBe(0);
    expect(codigoPai).toBe("BT70209SASO");
    const codigos = p.linhas.slice(1).map((l) => String(l["Código"]));
    expect(codigos).toContain("BT70209SASOCAF38");
    expect(codigos).toContain("BT70209SASOPR44");
    expect(codigos.some((c) => /CAF37CAF|SASOCAF37PR/.test(c))).toBe(false);
    expect(new Set(codigos).size).toBe(codigos.length); // sem repetidos
  });
});

describe("arquivo original do Bling (descrições com 'CABEDAL SINT. AVELA 1248 tam: 33')", () => {
  it("com o banco de cores padrão, gera exatamente a planilha correta sem digitar nada", () => {
    const esperado = abrir("correto-modare.xlsx");
    const p = abrir("original-bling.xls");
    normalizarCodigos(p);
    const pai = detectarLinhaPai(p)!;
    const codigoPai = limpo(p.linhas[pai]["Código"]);
    const marca = limpo(p.linhas[pai]["Marca"]);
    const banco = normalizarBanco(seed);
    processarVariacoes(p, pai, "Sandálias");
    const { analisadas, grupos } = agruparVariacoes(p, pai);
    const cores = new Map<string, [string, string]>();
    for (const [chave, g] of grupos) {
      const achado = buscarCor(banco, marca, g.sugestao)!; // o que a tela de cores pré-preenche
      expect(achado, g.sugestao).not.toBeNull();
      cores.set(chave, [titulo(achado.nome), achado.abrev]);
    }
    gerarCodigoEDescricao(p, analisadas, grupos, codigoPai, cores, banco, marca);
    for (let i = 0; i < p.linhas.length - 1; i++) {
      expect(p.linhas[i]["Código"]).toBe(esperado.linhas[i]["Código"]);
      expect(p.linhas[i]["Descrição"]).toBe(esperado.linhas[i]["Descrição"]);
    }
  });
});

describe("MOLEKINHO: cor escrita como combinação de códigos", () => {
  it("sugere Preto/Amarelo/Branco em vez de '99 Tam'", () => {
    const p = abrir("molekinho-original.xls");
    normalizarCodigos(p);
    const pai = detectarLinhaPai(p)!;
    expect(limpo(p.linhas[pai]["Código"])).toBe("MK2653206SAIF");
    const { grupos } = agruparVariacoes(p, pai);
    expect(grupos.size).toBe(1);
    const [g] = [...grupos.values()];
    expect(g.sugestao).toBe("Preto/Amarelo/Branco");
    expect(g.indices.length).toBe(5);
    expect(g.tamanhos).toEqual(["17/18", "19/20", "21/22", "23/24", "25/26"]);
  });
});
