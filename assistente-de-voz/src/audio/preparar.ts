/** Prepara o áudio de uma frase antes do Whisper: tira o nível DC, normaliza o volume e acrescenta silêncio nas pontas. */
export interface EstatisticasAudio { duracaoMs: number; pico: number; rms: number; ganho: number }

export function estatisticas(a: Float32Array, sr = 16000): EstatisticasAudio {
  let pico = 0;
  let soma = 0;
  for (let i = 0; i < a.length; i++) {
    const v = Math.abs(a[i]);
    if (v > pico) pico = v;
    soma += a[i] * a[i];
  }
  return { duracaoMs: Math.round((a.length / sr) * 1000), pico, rms: Math.sqrt(soma / Math.max(1, a.length)), ganho: 1 };
}

export function prepararAudio(entrada: Float32Array, sr = 16000, folgaMs = 300): { audio: Float32Array; ganho: number } {
  let media = 0;
  for (let i = 0; i < entrada.length; i++) media += entrada[i];
  media /= Math.max(1, entrada.length);
  let pico = 0;
  for (let i = 0; i < entrada.length; i++) pico = Math.max(pico, Math.abs(entrada[i] - media));
  // voz baixa (celular, microfone longe) é amplificada até ~0,8 de pico, no máximo 30x; nunca reduz
  const ganho = pico > 1e-4 ? Math.min(30, Math.max(1, 0.8 / pico)) : 1;
  const folga = Math.round((sr * folgaMs) / 1000);
  const saida = new Float32Array(entrada.length + 2 * folga);
  for (let i = 0; i < entrada.length; i++) saida[folga + i] = Math.max(-1, Math.min(1, (entrada[i] - media) * ganho));
  return { audio: saida, ganho };
}
