import { describe, expect, it } from "vitest";
import { GatilhoCaptura, areaValida, caminhoSemSobrescrever, nomeArquivo, normalizarArea } from "../src/apps/captura/nucleo";

describe("normalizarArea", () => {
  it("deixa a área certa não importa de que canto arrastou", () => {
    expect(normalizarArea(100, 200, 10, 20)).toEqual({ esquerda: 10, topo: 20, direita: 100, baixo: 200 });
    expect(normalizarArea(10, 20, 100, 200)).toEqual({ esquerda: 10, topo: 20, direita: 100, baixo: 200 });
    expect(normalizarArea(10.6, 20.4, 100.2, 200.9)).toEqual({ esquerda: 11, topo: 20, direita: 100, baixo: 201 });
  });
});

describe("areaValida", () => {
  it("rejeita clique sem arrastar", () => {
    expect(areaValida({ esquerda: 100, topo: 100, direita: 101, baixo: 101 })).toBe(false);
    expect(areaValida({ esquerda: 100, topo: 100, direita: 102, baixo: 150 })).toBe(false); // largura menor que o mínimo
    expect(areaValida({ esquerda: 100, topo: 100, direita: 110, baixo: 110 })).toBe(true);
  });
});

describe("nomeArquivo", () => {
  it("não tem caracteres proibidos", () => {
    const nome = nomeArquivo(new Date(2026, 10, 13, 15, 30, 7));
    expect(nome).toBe("Captura 2026-11-13 15-30-07.png");
    expect(nome).not.toContain(":");
    expect(nomeArquivo(new Date(2026, 0, 1), "Tela:Teste/1")).toMatch(/^Tela-Teste-1 /);
  });
});

describe("caminhoSemSobrescrever", () => {
  it("acrescenta (2), (3)... quando já existe", () => {
    const existentes = new Set<string>();
    const nome = "Captura 2026-11-13 15-30-07.png";
    expect(caminhoSemSobrescrever(nome, (n) => existentes.has(n))).toBe(nome);
    existentes.add(nome);
    expect(caminhoSemSobrescrever(nome, (n) => existentes.has(n))).toBe("Captura 2026-11-13 15-30-07 (2).png");
    existentes.add("Captura 2026-11-13 15-30-07 (2).png");
    expect(caminhoSemSobrescrever(nome, (n) => existentes.has(n))).toBe("Captura 2026-11-13 15-30-07 (3).png");
  });
});

describe("GatilhoCaptura", () => {
  function criar(janelaMs = 300) {
    const eventos: unknown[][] = [];
    const relogio = { t: 1000 };
    const g = new GatilhoCaptura(
      (x, y) => eventos.push(["armar", x, y]),
      (x, y) => eventos.push(["iniciar", x, y]),
      (x, y) => eventos.push(["mover", x, y]),
      (x, y) => eventos.push(["finalizar", x, y]),
      () => eventos.push(["cancelar"]),
      janelaMs,
      () => relogio.t,
    );
    return { g, eventos, relogio };
  }

  it("1) os dois botões juntos armam (sem precisar segurar). 2) só depois, clique+arrasta com o esquerdo seleciona", () => {
    const { g, eventos, relogio } = criar();
    // 1) toque rápido dos dois botões: arma (não inicia a seleção ainda)
    g.clique(10, 10, "esquerdo", true);
    relogio.t += 50;
    g.clique(10, 10, "direito", true);
    expect(eventos).toEqual([["armar", 10, 10]]);
    expect(g.estado).toBe(GatilhoCaptura.ARMADO);
    // soltar os dois do toque inicial não faz nada (continua armado)
    g.clique(10, 10, "esquerdo", false);
    g.clique(10, 10, "direito", false);
    expect(eventos).toEqual([["armar", 10, 10]]);
    expect(g.estado).toBe(GatilhoCaptura.ARMADO);

    // 2) clique normal com o esquerdo: começa, move, solta -> finaliza
    g.clique(50, 60, "esquerdo", true);
    expect(eventos.at(-1)).toEqual(["iniciar", 50, 60]);
    expect(g.estado).toBe(GatilhoCaptura.SELECIONANDO);
    g.mover(80, 90);
    expect(eventos.at(-1)).toEqual(["mover", 80, 90]);
    g.clique(120, 130, "esquerdo", false);
    expect(eventos.at(-1)).toEqual(["finalizar", 120, 130]);
    expect(g.estado).toBe(GatilhoCaptura.IDLE);

    // não fica "pronto" sozinho de novo: um clique esquerdo solto não faz nada sem armar antes
    eventos.length = 0;
    g.clique(1, 1, "esquerdo", true);
    g.clique(2, 2, "esquerdo", false);
    expect(eventos).toEqual([]);
    expect(g.estado).toBe(GatilhoCaptura.IDLE);
  });

  it("cancela com botão direito e com Esc (cancelar() externo)", () => {
    const { g, eventos } = criar();
    g.clique(0, 0, "esquerdo", true);
    g.clique(0, 0, "direito", true); // arma
    g.clique(0, 0, "esquerdo", false);
    g.clique(0, 0, "direito", false);
    g.clique(5, 5, "direito", true); // cancela enquanto armado
    expect(eventos.at(-1)).toEqual(["cancelar"]);
    expect(g.estado).toBe(GatilhoCaptura.IDLE);
    g.clique(5, 5, "direito", false);

    eventos.length = 0;
    g.clique(0, 0, "esquerdo", true);
    g.clique(0, 0, "direito", true); // arma de novo
    g.clique(0, 0, "esquerdo", false);
    g.clique(0, 0, "direito", false);
    g.clique(10, 10, "esquerdo", true); // começa a selecionar
    g.clique(10, 10, "direito", true); // cancela durante a seleção
    expect(eventos.at(-1)).toEqual(["cancelar"]);
    expect(g.estado).toBe(GatilhoCaptura.IDLE);
    expect(eventos).not.toContainEqual(["finalizar", 10, 10]);
    g.clique(10, 10, "esquerdo", false);
    g.clique(10, 10, "direito", false);

    eventos.length = 0;
    g.clique(0, 0, "esquerdo", true);
    g.clique(0, 0, "direito", true); // arma
    g.cancelar(); // Esc chamado de fora
    expect(eventos).toEqual([["armar", 0, 0], ["cancelar"]]);
    expect(g.estado).toBe(GatilhoCaptura.IDLE);
    g.cancelar(); // já estava ocioso: não duplica
    expect(eventos).toEqual([["armar", 0, 0], ["cancelar"]]);
  });

  it("direito demorado não arma (fora da janela de tempo)", () => {
    const { g, eventos, relogio } = criar(300);
    g.clique(0, 0, "esquerdo", true);
    relogio.t += 1000;
    g.clique(0, 0, "direito", true);
    expect(eventos).toEqual([]);
    expect(g.estado).toBe(GatilhoCaptura.IDLE);
  });
});
