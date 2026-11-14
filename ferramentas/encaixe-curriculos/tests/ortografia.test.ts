import { beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { VerificadorHunspell } from "@/lib/ortografia/hunspell";
import { corrigirNoTexto, revisarTexto } from "@/lib/ortografia";

let v: VerificadorHunspell;
beforeAll(() => {
  v = new VerificadorHunspell(
    readFileSync("node_modules/dictionary-pt/index.aff", "utf8"),
    readFileSync("node_modules/dictionary-pt/index.dic", "utf8")
  );
});

describe("revisarTexto", () => {
  it("não acusa erro em um currículo correto", () => {
    const { problemas } = revisarTexto(readFileSync("tests/fixtures/curriculo.txt", "utf8"), v);
    expect(problemas).toEqual([]);
  });

  it("aponta palavras erradas, com sugestões e contagem", () => {
    const texto = [
      "Maria Souza",
      "EXPERIENCIA",
      "- Responsavel pela cordenação de relatorios, mais não tinha acesso ao sistema.",
      "- Trabalhei a 5 anos atrás com analise de dados na Empresa Xpto.",
      "- Relatorios semanais para para a diretoria.",
    ].join("\n");
    const { problemas } = revisarTexto(texto, v);
    const achar = (t: string) => problemas.find((p) => p.trecho.toLowerCase() === t.toLowerCase());
    expect(achar("Responsavel")?.sugestoes[0]).toBe("Responsável");
    expect(achar("cordenação")?.sugestoes).toContain("coordenação");
    expect(achar("relatorios")?.ocorrencias).toBe(2);
    expect(achar("EXPERIENCIA")?.sugestoes[0]).toBe("EXPERIÊNCIA");
    expect(achar("analise")?.sugestoes[0]).toBe("análise");
    expect(problemas.find((p) => p.id.startsWith("escrita:mas-mais"))?.sugestoes[0]).toMatch(/, mas /);
    expect(problemas.find((p) => p.id.startsWith("escrita:ha-tempo"))?.sugestoes[0]).toBe("há 5 anos");
    expect(problemas.find((p) => p.id.startsWith("escrita:palavra-repetida"))?.sugestoes[0]).toBe("para");
    expect(achar("Xpto")).toBeUndefined(); // nome próprio no meio da frase
  });

  it("ignora e-mails, links, siglas e termos de mercado", () => {
    const { problemas } = revisarTexto("maria.souzza@gmaill.com | linkedin.com/in/mariaa\n- Criei dashboards no PowerBI e KPIs de sprint", v);
    expect(problemas).toEqual([]);
  });

  it("corrige todas as ocorrências da palavra inteira", () => {
    expect(corrigirNoTexto("relatorio e relatorios; relatorio.", "relatorio", "relatório")).toBe("relatório e relatorios; relatório.");
  });
});

describe("correções", () => {
  it("aplica correções que começam ou terminam com pontuação", () => {
    expect(corrigirNoTexto("Analisei, mais não tinha acesso", ", mais ", ", mas ")).toBe("Analisei, mas não tinha acesso");
  });
  it("prioriza sugestões com a mesma primeira letra", () => {
    expect(v.sugerir("cordenação")[0]).toBe("coordenação");
  });
});
