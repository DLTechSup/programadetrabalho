import { describe, expect, it } from "vitest";
import { Segmentador, rms } from "../src/audio/vad";

const SR = 16000;
let semente = 12345; // ruído determinístico (teste não pode ser instável)
const aleatorio = () => ((semente = (semente * 1664525 + 1013904223) % 4294967296) / 4294967296);
const silencio = (ms: number, ruido = 0.004) => Float32Array.from({ length: (SR * ms) / 1000 }, () => (aleatorio() * 2 - 1) * ruido);
const voz = (ms: number, amp = 0.2) => Float32Array.from({ length: (SR * ms) / 1000 }, (_, i) => amp * Math.sin((2 * Math.PI * 220 * i) / SR) * (0.6 + 0.4 * Math.sin(i / 700)));

function rodar(blocos: Float32Array[], sens = 5) {
  const falas: number[] = [];
  const seg = new Segmentador({ sampleRate: SR, sensibilidade: sens }, (_a, ms) => falas.push(ms));
  for (const b of blocos) for (let i = 0; i < b.length; i += 1000) seg.processar(b.slice(i, i + 1000));
  return { falas, seg };
}

describe("detector de fala", () => {
  it("entrega uma frase com o tamanho certo", () => {
    const { falas } = rodar([silencio(1000), voz(1500), silencio(1500)]);
    expect(falas.length).toBe(1);
    expect(falas[0]).toBeGreaterThan(1400);
    expect(falas[0]).toBeLessThan(2300);
  });
  it("ignora estalos curtos e silêncio", () => {
    const { falas } = rodar([silencio(1000), voz(100), silencio(1500), silencio(1000)]);
    expect(falas).toEqual([]);
  });
  it("separa duas frases com pausa entre elas", () => {
    const { falas } = rodar([silencio(800), voz(1000), silencio(1200), voz(800), silencio(1200)]);
    expect(falas.length).toBe(2);
  });
  it("não corta a fala em pausas curtas (respiração)", () => {
    const { falas } = rodar([silencio(800), voz(700), silencio(400), voz(700), silencio(1200)]);
    expect(falas.length).toBe(1);
  });
  it("limita frases muito longas", () => {
    const { falas } = rodar([silencio(500), voz(20000), silencio(1200)]);
    expect(falas.length).toBeGreaterThanOrEqual(2);
    expect(Math.max(...falas)).toBeLessThanOrEqual(14100);
  });
  it("pausado (enquanto o assistente fala) não capta nada", () => {
    const falas: number[] = [];
    const seg = new Segmentador({ sampleRate: SR, sensibilidade: 5 }, (_a, ms) => falas.push(ms));
    seg.pausar(true);
    seg.processar(voz(2000));
    seg.processar(silencio(1500));
    seg.pausar(false);
    seg.processar(silencio(500));
    expect(falas).toEqual([]);
  });
  it("sensibilidade alta capta voz baixa que a baixa não capta", () => {
    const fraco = [silencio(1000, 0.002), voz(1200, 0.012), silencio(1500, 0.002)];
    expect(rodar(fraco, 10).falas.length).toBe(1);
    expect(rodar(fraco, 1).falas.length).toBe(0);
  });
  it("rms", () => {
    expect(rms(new Float32Array(100))).toBe(0);
    expect(rms(new Float32Array(100).fill(0.5))).toBeCloseTo(0.5);
  });
});
