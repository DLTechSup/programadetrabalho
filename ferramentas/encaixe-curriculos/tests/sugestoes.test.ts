import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fortalecerTopico, passado } from "@/lib/verbos";
import { aplicarSugestao, aplicarTodas, gerarSugestoes } from "@/lib/sugestoes";
import { compararCurriculos, diffPalavras } from "@/lib/diff";
import { analisarVaga } from "@/lib/analisar-vaga";
import { reescreverCurriculo, secaoDoTitulo } from "@/lib/reescrever-curriculo";
import { calcularMatch } from "@/lib/score";
import { encontrarTermosNaoConfirmados, termosProibidos } from "@/lib/anti-invencao";

describe("verbos", () => {
  it("conjuga no pretérito", () => {
    expect(["elaborar", "atender", "verificar", "entregar", "alcançar", "construir", "fazer", "manter", "propor"].map(passado)).toEqual([
      "elaborei", "atendi", "verifiquei", "entreguei", "alcancei", "construí", "fiz", "mantive", "propus",
    ]);
  });
  it("fortalece tópicos sem mudar o fato", () => {
    expect(fortalecerTopico("Responsável por atender clientes do varejo")).toBe("Atendi clientes do varejo");
    expect(fortalecerTopico("Responsável pela elaboração de relatórios")).toBe("Elaborei relatórios");
    expect(fortalecerTopico("Responsável pelo atendimento ao público")).toBe("Atendi ao público");
    expect(fortalecerTopico("Realizava conciliações bancárias")).toBe("Realizei conciliações bancárias");
    expect(fortalecerTopico("Atendia clientes")).toBe("Atendi clientes");
    expect(fortalecerTopico("Apoio na manutenção de indicadores")).toBe("Apoiei a manutenção de indicadores");
    expect(fortalecerTopico("Eu desenvolvi APIs")).toBe("Desenvolvi APIs");
    expect(fortalecerTopico("Experiência em vendas")).toBeNull();
    expect(fortalecerTopico("Auditoria de processos")).toBeNull();
    expect(fortalecerTopico("Criei painéis no Power BI")).toBeNull();
  });
});

describe("sugestões", () => {
  const vaga = readFileSync("tests/fixtures/vaga.txt", "utf8");
  const { cargo, palavras_chave } = analisarVaga(vaga);
  const base = reescreverCurriculo({ curriculo: readFileSync("tests/fixtures/curriculo.txt", "utf8"), palavras: palavras_chave, confirmadas: [] }).curriculo;
  const texto = base
    .replace("- Apoio na manutenção de", "- Responsável por manter")
    .replace("RESUMO PROFISSIONAL", "Estado civil: casada | CPF 123.456.789-00\n\nRESUMO PROFISSIONAL");
  const sugestoes = gerarSugestoes({ texto, palavras: palavras_chave, cargo });
  const porCategoria = (c: string) => sugestoes.filter((s) => s.categoria === c);

  it("explica o que faria e por quê", () => {
    for (const s of sugestoes) {
      expect(s.euFaria.length).toBeGreaterThan(10);
      expect(s.porque.length).toBeGreaterThan(20);
    }
  });

  it("sugere verbo de ação, resumo com fatos, título e privacidade", () => {
    expect(porCategoria("Verbos de ação")[0].trocas[0].nova).toBe("- Mantive indicadores de desempenho");
    const resumo = porCategoria("Resumo profissional")[0].trocas[0].nova!;
    expect(resumo).toMatch(/^Analista de Dados Jr com experiência em /);
    expect(porCategoria("Cabeçalho")[0].trocas[0].nova).toMatch(/\nAnalista de Dados$/);
    expect(porCategoria("Privacidade")[0].trocas[0].nova).toBeNull();
  });

  it("aplicar uma e aplicar todas mantêm a regra de ouro", () => {
    const um = aplicarSugestao(texto, porCategoria("Verbos de ação")[0]);
    expect(um).toContain("- Mantive indicadores de desempenho");
    const todas = aplicarTodas(texto, sugestoes);
    expect(todas).not.toMatch(/CPF|casada/);
    const { faltando } = calcularMatch(base, palavras_chave);
    expect(encontrarTermosNaoConfirmados(todas, termosProibidos(faltando, []))).toEqual([]);
    expect(gerarSugestoes({ texto: todas, palavras: palavras_chave, cargo })).toEqual([]);
  });
});

describe("comparação", () => {
  it("marca palavras trocadas", () => {
    expect(diffPalavras("- Elaboração de relatórios", "- Elaborei relatórios")).toEqual([
      { tipo: "removido", texto: "Elaboração de" },
      { tipo: "novo", texto: "Elaborei" },
      { tipo: "igual", texto: " relatórios" },
    ]);
  });
  it("classifica linhas iguais, alteradas, novas e removidas", () => {
    const c = compararCurriculos(
      "Maria\nCPF 123\nElaboração de relatórios mensais para a diretoria",
      "Maria\nEXPERIÊNCIA\n- Elaborei relatórios mensais para a diretoria\nAnalista de Dados",
      (l) => !!secaoDoTitulo(l) || l === "EXPERIÊNCIA"
    );
    expect(c.linhas.map((l) => l.tipo)).toEqual(["igual", "titulo", "alterada", "nova"]);
    expect(c.removidas).toEqual(["CPF 123"]);
  });
});

describe("dados pessoais", () => {
  it("fica no cabeçalho e sai sem apagar o resto", () => {
    const { palavras_chave, cargo } = analisarVaga(readFileSync("tests/fixtures/vaga.txt", "utf8"));
    const cv = readFileSync("tests/fixtures/curriculo.txt", "utf8").replace("São Paulo, SP", "São Paulo, SP\nEstado civil: casada");
    const texto = reescreverCurriculo({ curriculo: cv, palavras: palavras_chave, confirmadas: [] }).curriculo;
    expect(texto.split("\n")[1]).toContain("Estado civil: casada");
    const s = gerarSugestoes({ texto, palavras: palavras_chave, cargo }).find((x) => x.categoria === "Privacidade")!;
    const depois = aplicarSugestao(texto, s);
    expect(depois.split("\n")[1]).toBe("maria.souza@email.com | (11) 91234-5678 | São Paulo, SP | linkedin.com/in/mariasouza");
    expect(depois).toContain("Atuar como analista de dados");
  });
});
