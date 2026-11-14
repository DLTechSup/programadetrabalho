import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { analisarVaga } from "@/lib/analisar-vaga";
import { reescreverCurriculo, comVerboDeAcao } from "@/lib/reescrever-curriculo";
import { calcularMatch } from "@/lib/score";
import { encontrarTermosNaoConfirmados } from "@/lib/anti-invencao";

const vaga = readFileSync("tests/fixtures/vaga.txt", "utf8");
const curriculo = readFileSync("tests/fixtures/curriculo.txt", "utf8");

describe("analisarVaga", () => {
  const analise = analisarVaga(vaga);
  const termo = (t: string) => analise.palavras_chave.find((p) => p.termo === t);

  it("extrai o cargo", () => {
    expect(analise.cargo).toBe("Analista de Dados Pleno");
  });

  it("separa obrigatórios e desejáveis pelas seções", () => {
    expect(termo("SQL")?.obrigatorio).toBe(true);
    expect(termo("Python")?.obrigatorio).toBe(true);
    expect(termo("Inglês")?.obrigatorio).toBe(false);
    expect(termo("Databricks")?.obrigatorio).toBe(false);
    // Atividades, quando há seção de requisitos, contam como desejáveis.
    expect(termo("ETL")?.obrigatorio).toBe(false);
  });

  it("captura expressões fora do dicionário", () => {
    expect(termo("precificação de produtos")?.categoria).toBe("tecnica");
  });

  it("ignora benefícios e a descrição da empresa", () => {
    const termos = analise.palavras_chave.map((p) => p.termo.toLowerCase());
    expect(termos).not.toContain("gympass");
    expect(termos.some((t) => t.includes("plano de saúde"))).toBe(false);
  });

  it("é determinística", () => {
    expect(analisarVaga(vaga)).toEqual(analise);
  });
});

describe("reescreverCurriculo", () => {
  const { palavras_chave } = analisarVaga(vaga);
  const resultado = reescreverCurriculo({
    curriculo,
    palavras: palavras_chave,
    confirmadas: [
      { termo: "Python", descricao: "Curso de Python na Alura, 2023" },
      { termo: "Airflow", descricao: "   " },
    ],
  });
  const texto = resultado.curriculo;

  it("usa a estrutura fixa, na ordem", () => {
    const ordem = ["RESUMO PROFISSIONAL", "EXPERIÊNCIA", "FORMAÇÃO", "HABILIDADES", "CERTIFICAÇÕES E IDIOMAS"].map(
      (t) => texto.indexOf(`\n${t}\n`)
    );
    expect(ordem.every((i) => i > 0)).toBe(true);
    expect([...ordem].sort((a, b) => a - b)).toEqual(ordem);
    expect(texto.startsWith("Maria Souza\n")).toBe(true);
  });

  it("ordena a experiência da mais recente para a mais antiga", () => {
    expect(texto.indexOf("Empresa X")).toBeLessThan(texto.indexOf("Empresa Y"));
  });

  it("troca sinônimo pelo termo exato da vaga", () => {
    expect(texto).toContain("painéis no Power BI");
    expect(resultado.mudancas).toContain("Termo 'Power BI' usado no lugar de 'PowerBI'");
  });

  it("inclui só lacunas confirmadas com descrição", () => {
    expect(texto).toContain("Python: Curso de Python na Alura, 2023");
    expect(texto).not.toMatch(/airflow/i);
    const { faltando } = calcularMatch(curriculo, palavras_chave);
    const naoConfirmados = faltando.filter((p) => p.termo !== "Python");
    expect(encontrarTermosNaoConfirmados(texto, naoConfirmados)).toEqual([]);
    expect(resultado.avisos).toEqual([]);
  });

  it("aumenta o score sem inventar", () => {
    expect(calcularMatch(texto, palavras_chave).score).toBeGreaterThan(calcularMatch(curriculo, palavras_chave).score);
  });

  it("organiza texto corrido sem títulos", () => {
    const corrido =
      "João Lima - joao@email.com - (21) 99876-5432. Vendedor na Loja Z desde 2020, com prospecção de clientes e negociação. Formação em Administração pela UFRJ (2019). Conhecimentos: Excel, CRM, Salesforce. Curso de inglês intermediário.";
    const r = reescreverCurriculo({ curriculo: corrido, palavras: analisarVaga("Requisitos:\n- Experiência com Salesforce e negociação\n- Prospecção").palavras_chave, confirmadas: [] });
    expect(r.curriculo).toMatch(/^João Lima\njoao@email.com \| \(21\) 99876-5432/);
    expect(r.curriculo).toMatch(/FORMAÇÃO\nFormação em Administração pela UFRJ \(2019\)\./);
  });
});

describe("comVerboDeAcao", () => {
  it("converte substantivo em verbo de ação", () => {
    expect(comVerboDeAcao("Elaboração de relatórios").texto).toBe("Elaborei relatórios");
    expect(comVerboDeAcao("Criação dos painéis").texto).toBe("Criei os painéis");
    expect(comVerboDeAcao("Participação no projeto X").texto).toBe("Participei do projeto X");
    expect(comVerboDeAcao("Atendimento ao cliente").mudou).toBe(false);
  });
});
