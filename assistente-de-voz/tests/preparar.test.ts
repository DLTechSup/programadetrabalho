import { describe, expect, it } from "vitest";
import { estatisticas, prepararAudio } from "../src/audio/preparar";

const seno = (n: number, amp: number, dc = 0) => Float32Array.from({ length: n }, (_, i) => dc + amp * Math.sin((2 * Math.PI * 200 * i) / 16000));

describe("prepararAudio", () => {
  it("amplifica voz baixa até ~0,8 de pico e acrescenta silêncio nas pontas", () => {
    const { audio, ganho } = prepararAudio(seno(16000, 0.05));
    expect(ganho).toBeCloseTo(16, 0);
    expect(audio.length).toBe(16000 + 2 * 4800);
    expect(estatisticas(audio).pico).toBeCloseTo(0.8, 1);
    expect(audio[0]).toBe(0);
    expect(audio[audio.length - 1]).toBe(0);
  });
  it("não reduz áudio que já está alto e limita o ganho em 30x", () => {
    expect(prepararAudio(seno(8000, 0.9)).ganho).toBe(1);
    expect(prepararAudio(seno(8000, 0.0005)).ganho).toBe(30);
  });
  it("remove nível DC e não explode com silêncio total", () => {
    const { audio } = prepararAudio(seno(8000, 0.1, 0.2));
    const meio = audio.slice(4800, 4800 + 8000);
    expect(Math.abs(meio.reduce((a, b) => a + b, 0) / meio.length)).toBeLessThan(0.01);
    expect(prepararAudio(new Float32Array(8000)).ganho).toBe(1);
  });
});
