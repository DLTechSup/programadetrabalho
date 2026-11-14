import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { avaliarNivel } from "@/lib/nivel";
import { analisarVaga } from "@/lib/analisar-vaga";
import { reescreverCurriculo } from "@/lib/reescrever-curriculo";
import { aplicarTodas, CATEGORIA_NIVEL, gerarSugestoes } from "@/lib/sugestoes";
import { calcularMatch } from "@/lib/score";
import { encontrarTermosNaoConfirmados, termosProibidos, validarAntiInvencao } from "@/lib/anti-invencao";

const vaga = readFileSync("tests/fixtures/vaga-repositor.txt", "utf8");
const cv = readFileSync("tests/fixtures/curriculo-gerente.txt", "utf8");
const analise = analisarVaga(vaga);

describe("avaliarNivel", () => {
  it("detecta perfil acima de uma vaga operacional", () => {
    const a = avaliarNivel({ vaga, cargo: analise.cargo, curriculo: cv });
    expect(a.sobrequalificado).toBe(true);
    expect(a.sinaisVaga).toEqual(expect.arrayContaining(["cargo de repositor(a)", "pede ensino médio ou fundamental", "não exige experiência"]));
    expect(a.sinaisCurriculo).toEqual(expect.arrayContaining(["MBA", "ensino superior", "cargo de gerente"]));
  });
  it("não acusa quando a vaga é compatível", () => {
    const outra = readFileSync("tests/fixtures/vaga.txt", "utf8");
    expect(avaliarNivel({ vaga: outra, cargo: analisarVaga(outra).cargo, curriculo: cv }).sobrequalificado).toBe(false);
  });
});

describe("ajustes de nível", () => {
  const texto = reescreverCurriculo({ curriculo: cv, palavras: analise.palavras_chave, confirmadas: [] }).curriculo;
  const { faltando } = calcularMatch(cv, analise.palavras_chave);
  const proibidos = termosProibidos(faltando, []);
  const sugestoes = gerarSugestoes({ texto, palavras: analise.palavras_chave, cargo: analise.cargo, nivelEntrada: true, proibidos });
  const deNivel = sugestoes.filter((s) => s.categoria === CATEGORIA_NIVEL);

  it("só aparecem quando a pessoa ativa", () => {
    expect(gerarSugestoes({ texto, palavras: analise.palavras_chave, cargo: analise.cargo }).some((s) => s.categoria === CATEGORIA_NIVEL)).toBe(false);
    expect(deNivel.map((s) => s.titulo)).toEqual(
      expect.arrayContaining(["Deixar de fora pós-graduação e MBA", "Destacar o trabalho prático, não a gestão", "Resumo focado no que a vaga pede", "Habilidades que a vaga usa"])
    );
  });

  it("omite sem mentir: cargos, empresas e datas continuam", () => {
    const final = aplicarTodas(texto, deNivel);
    expect(final).not.toMatch(/MBA/);
    expect(final).not.toMatch(/Liderei equipe|orçamento anual/);
    expect(final).toMatch(/Bacharelado em Administração/);
    expect(final).toMatch(/Gerente Administrativo \| Empresa Alfa \| 2015 - 2024/);
    expect(final).toMatch(/Organizei arquivos|Organização de arquivos/);
    expect(final).toMatch(/Profissional com experiência em atendimento ao cliente, organização, controle de estoque/);
    expect(final).toMatch(/Busco oportunidade como Repositor de Supermercado\./);
    expect(final).not.toMatch(/SAP|Power BI/);
    expect(encontrarTermosNaoConfirmados(final, proibidos)).toEqual([]);
    expect(validarAntiInvencao({ curriculoAjustado: final, curriculoOriginal: cv, proibidos, confirmadas: [] })).toEqual([]);
  });
});

describe("sinais de nível", () => {
  it("não confunde “diretoria” com cargo de diretor", () => {
    const a = avaliarNivel({ vaga, cargo: analise.cargo, curriculo: "Assistente\n- Apresentei relatórios à diretoria" });
    expect(a.sinaisCurriculo).not.toContain("cargo de diretor(a)");
  });
});
