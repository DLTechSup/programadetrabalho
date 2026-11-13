// Garante que electron/captura-nucleo.cjs (cópia em CommonJS usada pelo processo principal)
// continua produzindo exatamente o mesmo resultado que src/apps/captura/nucleo.ts.
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { GatilhoCaptura as GatilhoTS, areaValida, caminhoSemSobrescrever, nomeArquivo, normalizarArea } from "../src/apps/captura/nucleo";

const requireCjs = createRequire(import.meta.url);
const cjs = requireCjs("../electron/captura-nucleo.cjs");

describe("electron/captura-nucleo.cjs em sincronia com o TypeScript", () => {
  it("funções puras dão o mesmo resultado", () => {
    expect(cjs.normalizarArea(10.6, 20.4, 100.2, 200.9)).toEqual(normalizarArea(10.6, 20.4, 100.2, 200.9));
    const area = { esquerda: 100, topo: 100, direita: 110, baixo: 110 };
    expect(cjs.areaValida(area)).toBe(areaValida(area));
    const quando = new Date(2026, 10, 13, 15, 30, 7);
    expect(cjs.nomeArquivo(quando)).toBe(nomeArquivo(quando));
    const existe = (n: string) => n === "x.png";
    expect(cjs.caminhoSemSobrescrever("x.png", existe)).toBe(caminhoSemSobrescrever("x.png", existe));
  });

  it("GatilhoCaptura tem a mesma máquina de estados", () => {
    const eventosTs: unknown[][] = [];
    const eventosCjs: unknown[][] = [];
    const gTs = new GatilhoTS(
      (x: number, y: number) => eventosTs.push(["armar", x, y]),
      (x: number, y: number) => eventosTs.push(["iniciar", x, y]),
      () => {},
      (x: number, y: number) => eventosTs.push(["finalizar", x, y]),
      () => eventosTs.push(["cancelar"]),
      300,
      () => 1000,
    );
    const gCjs = new cjs.GatilhoCaptura(
      (x: number, y: number) => eventosCjs.push(["armar", x, y]),
      (x: number, y: number) => eventosCjs.push(["iniciar", x, y]),
      () => {},
      (x: number, y: number) => eventosCjs.push(["finalizar", x, y]),
      () => eventosCjs.push(["cancelar"]),
      300,
      () => 1000,
    );
    for (const [x, y, lado, pressionado] of [
      [10, 10, "esquerdo", true], [10, 10, "direito", true],
      [10, 10, "esquerdo", false], [10, 10, "direito", false],
      [50, 60, "esquerdo", true], [120, 130, "esquerdo", false],
    ] as const) {
      gTs.clique(x, y, lado, pressionado);
      gCjs.clique(x, y, lado, pressionado);
    }
    expect(eventosCjs).toEqual(eventosTs);
    expect(gCjs.estado).toBe(gTs.estado);
  });
});
