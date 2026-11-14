import { describe, expect, it } from "vitest";
import { calcularMatch, faixaDoScore, normalizar } from "@/lib/score";
import type { PalavraChave } from "@/lib/tipos";

const p = (termo: string, obrigatorio: boolean, variantes: string[] = []): PalavraChave => ({
  termo,
  variantes,
  categoria: "ferramenta",
  obrigatorio,
});

describe("normalizar", () => {
  it("remove acentos, pontuação e caixa", () => {
    expect(normalizar("Gestão de Projetos, Ágil!")).toBe("gestao de projetos agil");
  });
  it("preserva linguagens com pontuação significativa", () => {
    expect(normalizar("C++ e C# e .NET")).toBe("cplusplus e csharp e dotnet");
  });
});

describe("calcularMatch", () => {
  const palavras = [p("React", true, ["react.js", "reactjs"]), p("SQL", true), p("Figma", false)];

  it("usa pesos 3 (obrigatório) e 1 (desejável)", () => {
    const r = calcularMatch("Trabalhei com ReactJS e Figma.", palavras);
    expect(r.encontradas.map((x) => x.termo)).toEqual(["React", "Figma"]);
    expect(r.faltando.map((x) => x.termo)).toEqual(["SQL"]);
    expect(r.score).toBe(Math.round((4 / 7) * 100));
  });

  it("exige palavra inteira", () => {
    const r = calcularMatch("Experiência com SQLite e Reactive programming", palavras);
    expect(r.encontradas).toHaveLength(0);
    expect(r.score).toBe(0);
  });

  it("ignora acentos ao comparar", () => {
    const r = calcularMatch("Gestao de projetos", [p("gestão de projetos", true)]);
    expect(r.score).toBe(100);
  });

  it("é determinístico", () => {
    const texto = "React, SQL";
    expect(calcularMatch(texto, palavras)).toEqual(calcularMatch(texto, palavras));
  });

  it("retorna 0 sem palavras-chave", () => {
    expect(calcularMatch("qualquer coisa", []).score).toBe(0);
  });
});

describe("faixaDoScore", () => {
  it("classifica nas faixas corretas", () => {
    expect(faixaDoScore(49).rotulo).toBe("Baixo encaixe");
    expect(faixaDoScore(50).rotulo).toBe("Encaixe médio");
    expect(faixaDoScore(74).rotulo).toBe("Encaixe médio");
    expect(faixaDoScore(75).rotulo).toBe("Alto encaixe");
  });
});
