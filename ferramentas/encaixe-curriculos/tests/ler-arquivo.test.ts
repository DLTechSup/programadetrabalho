import { describe, expect, it } from "vitest";
import { limparTextoExtraido, lerCurriculoDeArquivo, montarLinhasPdf } from "@/lib/ler-arquivo";

describe("montarLinhasPdf", () => {
  it("quebra linhas pela posição e separa blocos distantes", () => {
    const itens = [
      { str: "Maria", transform: [1, 0, 0, 1, 50, 800], height: 11 },
      { str: " Souza", transform: [1, 0, 0, 1, 90, 800], height: 11 },
      { str: "maria@email.com", transform: [1, 0, 0, 1, 50, 786], height: 11 },
      { str: "EXPERIÊNCIA", transform: [1, 0, 0, 1, 50, 750], height: 11 },
    ];
    expect(montarLinhasPdf(itens)).toBe("Maria Souza\nmaria@email.com\n\nEXPERIÊNCIA");
  });
});

describe("limparTextoExtraido", () => {
  it("normaliza espaços e linhas em branco", () => {
    expect(limparTextoExtraido("  A  B \r\n\n\n\nC  ")).toBe("A B\n\nC");
  });
});

describe("lerCurriculoDeArquivo", () => {
  it("lê .txt", async () => {
    const texto = "Maria Souza\n" + "Experiência com SQL. ".repeat(5);
    const arquivo = new File([texto], "cv.txt", { type: "text/plain" });
    expect(await lerCurriculoDeArquivo(arquivo)).toEqual({ texto: texto.trim(), estilo: null });
  });

  it("recusa .doc antigo e formatos desconhecidos com mensagem clara", async () => {
    await expect(lerCurriculoDeArquivo(new File(["x"], "cv.doc"))).rejects.toThrow(/\.doc/);
    await expect(lerCurriculoDeArquivo(new File(["x"], "cv.png"))).rejects.toThrow(/Formato não suportado/);
  });

  it("avisa quando não há texto", async () => {
    await expect(lerCurriculoDeArquivo(new File(["  "], "cv.txt"))).rejects.toThrow(/Não encontramos texto/);
  });
});
