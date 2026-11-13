import { describe, expect, it } from "vitest";
import { nomePastaGrupo, extensaoDaFoto, nomePastaDoDia } from "../src/apps/monitor/armazenamento";

describe("nomePastaGrupo", () => {
  it("tira emoji e caracteres proibidos", () => {
    expect(nomePastaGrupo("PROGRAMAÇÃO ✨📷💰")).toBe("PROGRAMAÇÃO");
    expect(nomePastaGrupo("Só Foto: Caixa/2")).toBe("Só Foto- Caixa-2");
    expect(nomePastaGrupo("✨📷")).toBe("Grupo");
  });
});

describe("extensaoDaFoto", () => {
  it("reconhece jpg/png/webp pela assinatura", () => {
    expect(extensaoDaFoto(new Uint8Array([0xff, 0xd8, 0xff, 1, 2]))).toBe(".jpg");
    expect(extensaoDaFoto(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]))).toBe(".png");
    const webp = new Uint8Array(12);
    webp.set([0x52, 0x49, 0x46, 0x46], 0);
    webp.set([0x57, 0x45, 0x42, 0x50], 8);
    expect(extensaoDaFoto(webp)).toBe(".webp");
    expect(extensaoDaFoto(new Uint8Array([1, 2, 3]))).toBe(".jpg");
  });
});

describe("nomePastaDoDia", () => {
  it("formata dd-mm-aaaa", () => {
    expect(nomePastaDoDia(new Date(2026, 10, 13))).toBe("13-11-2026");
  });
});
