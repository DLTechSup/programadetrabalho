// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { corLegivel, familiaDaFonte, limparNomeFonte, normalizarEstilo, pacoteFonteEquivalente } from "@/lib/estilo";
import { estiloDasLinhas, estiloDoDocx } from "@/lib/extrair-estilo";
import { gerarDocx } from "@/components/analise/curriculo-docx";
import { avaliarDicas } from "@/lib/dicas";
import { analisarVaga } from "@/lib/analisar-vaga";
import { reescreverCurriculo } from "@/lib/reescrever-curriculo";
import { tituloExibido } from "@/lib/estrutura-curriculo";

describe("estilo", () => {
  it("limpa nomes de fonte de PDF", () => {
    expect(limparNomeFonte("ABCDEF+Calibri-Bold")).toBe("Calibri");
    expect(limparNomeFonte("TimesNewRomanPSMT")).toBe("Times New Roman");
    expect(limparNomeFonte("ArialMT")).toBe("Arial");
  });
  it("identifica a família e a fonte equivalente", () => {
    expect(familiaDaFonte("Georgia")).toBe("serif");
    expect(familiaDaFonte("Open Sans")).toBe("sans");
    expect(pacoteFonteEquivalente("Calibri")).toBe("carlito");
    expect(pacoteFonteEquivalente("Arial")).toBeNull();
  });
  it("troca cores claras demais por preto", () => {
    expect(corLegivel("#1F4E79")).toBe("#1f4e79");
    expect(corLegivel("#EEEEEE")).toBe("#000000");
    expect(corLegivel("auto")).toBe("#000000");
  });
  it("mantém tamanhos em limites legíveis", () => {
    const e = normalizarEstilo({ origem: "pdf", tamanhoCorpo: 6, tamanhoNome: 60 });
    expect(e.tamanhoCorpo).toBe(9);
    expect(e.tamanhoNome).toBe(28);
  });
  it("títulos no formato do original", () => {
    expect(tituloExibido("EXPERIÊNCIA", false)).toBe("Experiência");
    expect(tituloExibido("Certificações e idiomas", true)).toBe("CERTIFICAÇÕES E IDIOMAS");
  });
});

describe("estiloDasLinhas", () => {
  it("separa nome, títulos e corpo", () => {
    const l = (texto: string, tamanho: number, cor = "#000000", negrito = false, centralizada = false) => ({
      texto, tamanho, fonte: "Georgia", negrito, cor, centralizada,
    });
    const e = estiloDasLinhas(
      [
        l("Maria Souza", 20, "#1f4e79", true, true),
        l("maria@email.com | (11) 91234-5678", 10),
        l("Experiência", 13, "#1f4e79", true),
        l("Analista de dados na Empresa X, responsável por relatórios e painéis.", 10.5),
        l("Formação", 13, "#1f4e79", true),
        l("Bacharelado em Estatística - USP", 10.5),
      ],
      "pdf"
    );
    expect(e).toMatchObject({
      fonte: "Georgia", familia: "serif", tamanhoCorpo: 10.5, tamanhoNome: 20, tamanhoTitulo: 13,
      corNome: "#1f4e79", corTitulo: "#1f4e79", corTexto: "#000000", tituloMaiusculo: false,
      alinhamentoNome: "center",
    });
  });
});

describe("Word: gerar e ler de volta o estilo", () => {
  it("preserva fonte, tamanhos, cores, alinhamento e linha nos títulos", async () => {
    const estilo = normalizarEstilo({
      origem: "docx", fonte: "Cambria", familia: "serif", tamanhoCorpo: 11, tamanhoNome: 22, tamanhoTitulo: 14,
      corNome: "#2e74b5", corTitulo: "#2e74b5", tituloMaiusculo: false, linhaAbaixoTitulo: true,
      alinhamentoNome: "center", margem: 42.5,
    });
    const texto = reescreverCurriculo({
      curriculo: readFileSync("tests/fixtures/curriculo.txt", "utf8"),
      palavras: analisarVaga(readFileSync("tests/fixtures/vaga.txt", "utf8")).palavras_chave,
      confirmadas: [],
    }).curriculo;
    const blob = await gerarDocx(texto, estilo);
    const lido = await estiloDoDocx(await blob.arrayBuffer());
    expect(lido).toMatchObject({
      origem: "docx", fonte: "Cambria", tamanhoCorpo: 11, tamanhoNome: 22, tamanhoTitulo: 14,
      corNome: "#2e74b5", corTitulo: "#2e74b5", tituloMaiusculo: false, linhaAbaixoTitulo: true,
      alinhamentoNome: "center",
    });
    expect(lido.margem).toBeCloseTo(42.5, 0);
  });
});

describe("dicas", () => {
  const palavras = analisarVaga(readFileSync("tests/fixtures/vaga.txt", "utf8")).palavras_chave;
  const avisoDe = (texto: string, id: string) => avaliarDicas({ texto, palavras }).find((r) => r.id === id)?.aviso;

  it("aponta requisitos obrigatórios faltando", () => {
    const aviso = avisoDe("Maria\nmaria@x.com\nEXPERIÊNCIA\n- Fiz relatórios em Excel", "obrigatorios");
    expect(aviso?.nivel).toBe("importante");
    expect(aviso?.trechos).toContain("SQL");
  });
  it("pede contatos e seções quando faltam", () => {
    expect(avisoDe("Maria\nTexto qualquer", "contatos")?.mensagem).toMatch(/e-mail e telefone/);
    expect(avisoDe("Maria\nTexto qualquer", "secoes")?.mensagem).toMatch(/Experiência, Formação, Habilidades/);
  });
  it("sugere remover dados pessoais e pronomes", () => {
    expect(avisoDe("Maria\nCPF 123.456.789-00\nEstado civil: casada", "dados-pessoais")).toBeTruthy();
    expect(avisoDe("Maria\nEXPERIÊNCIA\n- Eu fiz meu trabalho", "primeira-pessoa")).toBeTruthy();
  });
  it("aponta tópicos genéricos e sem números", () => {
    const texto = "Maria\nEXPERIÊNCIA\nAnalista | Empresa | 2020 - atual\n- Responsável por relatórios\n- Auxiliei a equipe";
    expect(avisoDe(texto, "verbos-fracos")?.trechos).toHaveLength(2);
    expect(avisoDe(texto, "resultados")).toBeTruthy();
    expect(avisoDe(texto.replace("relatórios", "12 relatórios mensais"), "resultados")).toBeNull();
  });
  it("aceita o que está bom", () => {
    expect(avisoDe("Maria\nIdiomas: Inglês avançado", "nivel-idioma")).toBeNull();
    expect(avisoDe("Maria\nIdiomas: Inglês", "nivel-idioma")).toBeTruthy();
  });
});
