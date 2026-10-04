/// <reference lib="webworker" />
// Reconhecimento de voz (Whisper) rodando no próprio computador, em segundo plano (Web Worker).
import { pipeline, env } from "@huggingface/transformers";

type Msg =
  | { tipo: "carregar"; modelo: string }
  | { tipo: "transcrever"; id: number; audio: Float32Array };

const origem = self.location.origin;
env.allowLocalModels = true;
env.allowRemoteModels = false;
env.useBrowserCache = false;
env.localModelPath = `${origem}/modelos/`;
const onnx = env.backends.onnx as { wasm?: { wasmPaths?: string; numThreads?: number } };
if (onnx.wasm) {
  onnx.wasm.wasmPaths = `${origem}/ort/`;
  onnx.wasm.numThreads = self.crossOriginIsolated ? Math.max(1, Math.min(4, Math.floor((navigator.hardwareConcurrency || 4) / 2))) : 1;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let asr: any = null;

self.onmessage = async (e: MessageEvent<Msg>) => {
  const m = e.data;
  try {
    if (m.tipo === "carregar") {
      self.postMessage({ tipo: "estado", estado: "carregando" });
      asr = await pipeline("automatic-speech-recognition", `whisper-${m.modelo}`, {
        dtype: { encoder_model: "q8", decoder_model_merged: "q8" },
        device: "wasm",
      } as never);
      self.postMessage({ tipo: "estado", estado: "pronto" });
    } else if (m.tipo === "transcrever") {
      if (!asr) throw new Error("Modelo de voz não carregado.");
      const r = await asr(m.audio, { language: "portuguese", task: "transcribe", chunk_length_s: 30 });
      const texto = String(Array.isArray(r) ? r[0]?.text : r?.text ?? "").trim();
      self.postMessage({ tipo: "texto", id: m.id, texto });
    }
  } catch (err) {
    self.postMessage({ tipo: "erro", id: (m as { id?: number }).id, mensagem: String((err as Error)?.message ?? err) });
  }
};
