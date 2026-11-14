// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { nomeArquivoPdf } from "@/lib/slug";
import { estruturarCurriculo, textoSeguroParaPdf } from "@/lib/estrutura-curriculo";

describe("nomeArquivoPdf", () => {
  it("usa minúsculas, sem acento e com hífens", () => {
    expect(nomeArquivoPdf("Analista de Dados Sênior (Remoto)")).toBe("curriculo-analista-de-dados-senior-remoto.pdf");
  });
});

describe("estruturarCurriculo", () => {
  it("identifica nome, contato, títulos e tópicos", () => {
    const blocos = estruturarCurriculo(
      "Maria Silva\nmaria@email.com | São Paulo\n\nRESUMO PROFISSIONAL\nAnalista.\n\nEXPERIÊNCIA\n- Fiz algo"
    );
    expect(blocos.map((b) => b.tipo)).toEqual([
      "nome", "contato", "espaco", "titulo", "paragrafo", "espaco", "titulo", "topico",
    ]);
  });
  it("remove caracteres que a Helvetica não suporta", () => {
    expect(textoSeguroParaPdf("Olá “mundo” 🚀 → ok")).toBe("Olá “mundo”  -> ok");
  });
});
