import { describe, expect, it } from "vitest";
import { extrairReferencia as x, chaveReferencia, nomeSeguro } from "../src/apps/monitor/referencia";

describe("extrairReferencia", () => {
  it("referências só de número, com letras e nomes", () => {
    expect(x("PEGADA\nREF: (133) 161-01")).toBe("133 161-01");
    expect(x("REF: 8513.115")).toBe("8513.115");
    expect(x("MODELO: CORRE 2")).toBe("CORRE 2");
    expect(x("REF.: T3533-150")).toBe("T3533-150");
    expect(x("sem nada de util")).toBeNull();
  });
});

describe("chaveReferencia", () => {
  it("ignora pontuação", () => {
    expect(chaveReferencia("123.456")).toBe(chaveReferencia("123-456"));
  });
});

describe("nomeSeguro", () => {
  it("remove caracteres proibidos", () => {
    expect(nomeSeguro('Só Foto: Caixa/2')).toBe("Só Foto- Caixa-2");
    expect(nomeSeguro("")).toBe("SEM_NOME");
  });
});
