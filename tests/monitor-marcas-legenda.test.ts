import { describe, expect, it } from "vitest";
import { carregarMarcas, detectarMarca, sequenceRatio } from "../src/apps/monitor/marcas";
import { dividirLegenda } from "../src/apps/monitor/legenda";
import { RegrasReferencia } from "../src/apps/monitor/regrasRef";

const marcas = carregarMarcas();

describe("detectarMarca", () => {
  it("acha a marca mesmo com variação de caixa/acento", () => {
    expect(detectarMarca("BEIRA RIO 8513.115", marcas)).toBe("Beira Rio");
    expect(detectarMarca("beira rio", marcas)).toBe("Beira Rio");
    expect(detectarMarca("nada a ver aqui", marcas)).toBeNull();
  });

  it("tolera pequeno erro de digitação (OCR)", () => {
    expect(detectarMarca("OLYMPIKU5", marcas)).toBe("Olympikus"); // 1 caractere trocado
  });
});

describe("sequenceRatio (port do difflib.SequenceMatcher.ratio)", () => {
  it("casos conhecidos", () => {
    expect(sequenceRatio("", "")).toBe(1);
    expect(sequenceRatio("abc", "abc")).toBe(1);
    expect(sequenceRatio("abc", "xyz")).toBe(0);
    expect(sequenceRatio("rain", "shine")).toBeCloseTo(0.44, 1);
  });
});

describe("dividirLegenda", () => {
  it("separa marca e referência", () => {
    expect(dividirLegenda("BEIRA RIO 8513.115", marcas)).toEqual({ marca: "BEIRA RIO", referencia: "8513.115", original: "BEIRA RIO 8513.115" });
    expect(dividirLegenda("PEGADA (133) 161-01", marcas)).toEqual({ marca: "PEGADA", referencia: "(133) 161-01", original: "PEGADA (133) 161-01" });
    expect(dividirLegenda("OLYMPIKUS CORRE 2", marcas)).toEqual({ marca: "OLYMPIKUS", referencia: "CORRE 2", original: "OLYMPIKUS CORRE 2" });
  });

  it("marca desconhecida com número vira _Conferir (sem marca)", () => {
    const d = dividirLegenda("NOVA MARCA 55-1", marcas);
    expect(d.marca).toBe("NOVA MARCA");
    expect(d.referencia).toBe("55-1");
  });

  it("texto sem nada de útil: tudo vira referência, marca nula", () => {
    expect(dividirLegenda("bom dia pessoal", marcas)).toEqual({ marca: null, referencia: "bom dia pessoal", original: "bom dia pessoal" });
  });
});

describe("RegrasReferencia", () => {
  it("corta o padrão só quando a marca tem regra", () => {
    const r = RegrasReferencia.carregarDeTexto("PEGADA | -NN\n");
    expect(r.aplicar("Pegada", "133 161-01")).toEqual(["133 161", "133 161-01"]);
    expect(r.aplicar("PEGADA", "133 161")).toEqual(["133 161", ""]);
    expect(r.aplicar("Olympikus", "CORRE 2")).toEqual(["CORRE 2", ""]);
  });

  it("padrão com letras (L) e número", () => {
    const r = RegrasReferencia.carregarDeTexto("MODARE | .NNN\nOlympikus | -LL\n");
    expect(r.aplicar("Modare", "7226.106")).toEqual(["7226", "7226.106"]);
    expect(r.aplicar("Olympikus", "CORRE-AB")[0]).toBe("CORRE");
  });
});
