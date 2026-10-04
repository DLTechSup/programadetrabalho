import { createRequire } from "node:module";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

const req = createRequire(import.meta.url);
const M = req("../electron/engine/modelo.cjs");

const repo = {
  siblings: [
    { rfilename: ".gitattributes", size: 1 }, { rfilename: "README.md", size: 1 },
    { rfilename: "config.json", size: 5 }, { rfilename: "tokenizer.json", size: 6 }, { rfilename: "preprocessor_config.json", size: 4 },
    { rfilename: "generation_config.json", size: 3 }, { rfilename: "vocab.json", size: 3 },
    { rfilename: "onnx/encoder_model.onnx", size: 900 }, { rfilename: "onnx/encoder_model_quantized.onnx", size: 20 },
    { rfilename: "onnx/decoder_model_merged_quantized.onnx", size: 30 }, { rfilename: "onnx/decoder_model.onnx", size: 800 },
  ],
};
const fakeFetch = (conteudos: Record<string, string>, falhar = "") => async (url: string) => {
  if (url.includes("/api/models/")) return { ok: true, status: 200, json: async () => repo };
  const nome = url.split("/resolve/main/")[1];
  if (nome === falhar) return { ok: false, status: 500 };
  const buf = Buffer.from(conteudos[nome] ?? "x".repeat(repo.siblings.find((s) => s.rfilename === nome)?.size ?? 1));
  let lido = false;
  return { ok: true, status: 200, body: { getReader: () => ({ read: async () => (lido ? { done: true } : ((lido = true), { done: false, value: new Uint8Array(buf) })) }) } };
};

describe("modelo de voz", () => {
  it("escolhe só os arquivos necessários (ignora ONNX grandes e README)", () => {
    const nomes = M.arquivosNecessarios(repo.siblings).map((f: any) => f.nome);
    expect(nomes).toContain("onnx/encoder_model_quantized.onnx");
    expect(nomes).toContain("onnx/decoder_model_merged_quantized.onnx");
    expect(nomes).not.toContain("onnx/encoder_model.onnx");
    expect(nomes).not.toContain("README.md");
    expect(nomes).toContain("tokenizer.json");
  });
  it("baixa, relata progresso e marca como pronto", async () => {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), "mod-"));
    expect(M.modeloPronto(base, "base")).toBe(false);
    const eventos: number[] = [];
    await M.baixarModelo(base, "base", { fetchFn: fakeFetch({}), onProgresso: (p: any) => eventos.push(p.baixado / p.total) });
    expect(M.modeloPronto(base, "base")).toBe(true);
    expect(eventos.at(-1)).toBe(1);
    expect(fs.existsSync(path.join(base, "whisper-base", "onnx", "encoder_model_quantized.onnx"))).toBe(true);
  });
  it("download interrompido não conta como pronto", async () => {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), "mod-"));
    await expect(M.baixarModelo(base, "tiny", { fetchFn: fakeFetch({}, "onnx/decoder_model_merged_quantized.onnx") })).rejects.toThrow(/Falha ao baixar/);
    expect(M.modeloPronto(base, "tiny")).toBe(false);
  });
  it("modelo inválido", async () => {
    await expect(M.baixarModelo("/tmp", "gigante", { fetchFn: fakeFetch({}) })).rejects.toThrow(/desconhecido/);
  });
});
