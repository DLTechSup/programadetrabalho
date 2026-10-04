/** Resposta falada (voz do Windows, offline) e sinal sonoro de ativação. */
let vozPt: SpeechSynthesisVoice | null = null;

function escolherVoz(): SpeechSynthesisVoice | null {
  const vozes = window.speechSynthesis?.getVoices() ?? [];
  return vozes.find((v) => /pt[-_]BR/i.test(v.lang) && /natural|online/i.test(v.name)) || vozes.find((v) => /pt[-_]BR/i.test(v.lang)) || vozes.find((v) => /^pt/i.test(v.lang)) || null;
}

export function iniciarFala() {
  if (!window.speechSynthesis) return;
  vozPt = escolherVoz();
  window.speechSynthesis.onvoiceschanged = () => {
    vozPt = escolherVoz();
  };
}

export const temVozPortugues = () => !!vozPt;

export function falar(texto: string): Promise<void> {
  return new Promise((resolve) => {
    const s = window.speechSynthesis;
    if (!s || !texto) return resolve();
    s.cancel();
    const u = new SpeechSynthesisUtterance(texto);
    u.lang = "pt-BR";
    if (vozPt) u.voice = vozPt;
    u.rate = 1.05;
    const fim = () => resolve();
    u.onend = fim;
    u.onerror = fim;
    // segurança: se o sistema não avisar o fim, não trava o assistente
    setTimeout(fim, Math.min(30000, 2500 + texto.length * 90));
    s.speak(u);
  });
}

export function pararDeFalar() {
  window.speechSynthesis?.cancel();
}

export function bip(tipo: "ativar" | "erro" = "ativar") {
  try {
    const ctx = new AudioContext();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = tipo === "ativar" ? 880 : 220;
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.2);
    setTimeout(() => ctx.close(), 400);
  } catch {
    /* sem áudio: ignora */
  }
}
