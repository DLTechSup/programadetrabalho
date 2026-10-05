/** Captura o microfone em 16 kHz mono (formato que o Whisper espera) e entrega blocos de amostras. */
export interface Microfone {
  parar(): void;
}

function reamostrar(entrada: Float32Array, de: number, para: number): Float32Array {
  if (de === para) return entrada;
  const razao = de / para;
  const n = Math.floor(entrada.length / razao);
  const saida = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const pos = i * razao;
    const i0 = Math.floor(pos);
    const i1 = Math.min(entrada.length - 1, i0 + 1);
    saida[i] = entrada[i0] + (entrada[i1] - entrada[i0]) * (pos - i0);
  }
  return saida;
}

export async function abrirMicrofone(aoAudio: (amostras: Float32Array) => void, dispositivoId = "", filtros = false): Promise<Microfone> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { deviceId: dispositivoId ? { exact: dispositivoId } : undefined, channelCount: 1, echoCancellation: filtros, noiseSuppression: filtros, autoGainControl: true },
  });
  let ctx: AudioContext;
  try {
    ctx = new AudioContext({ sampleRate: 16000 });
  } catch {
    ctx = new AudioContext();
  }
  const fonte = ctx.createMediaStreamSource(stream);
  const proc = ctx.createScriptProcessor(2048, 1, 1);
  const taxa = ctx.sampleRate;
  proc.onaudioprocess = (e) => aoAudio(reamostrar(new Float32Array(e.inputBuffer.getChannelData(0)), taxa, 16000));
  fonte.connect(proc);
  proc.connect(ctx.destination); // necessário para o navegador processar; a saída é silêncio
  return {
    parar() {
      proc.disconnect();
      fonte.disconnect();
      stream.getTracks().forEach((t) => t.stop());
      ctx.close();
    },
  };
}

export async function listarMicrofones(): Promise<{ id: string; nome: string }[]> {
  try {
    const t = await navigator.mediaDevices.getUserMedia({ audio: true });
    t.getTracks().forEach((x) => x.stop());
    const ds = await navigator.mediaDevices.enumerateDevices();
    return ds.filter((d) => d.kind === "audioinput").map((d, i) => ({ id: d.deviceId, nome: d.label || `Microfone ${i + 1}` }));
  } catch {
    return [];
  }
}
