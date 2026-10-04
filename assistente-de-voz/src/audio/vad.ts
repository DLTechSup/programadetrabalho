/**
 * Detecta quando alguém está falando (energia do sinal, com ruído de fundo adaptativo)
 * e entrega cada frase como um bloco de áudio. Sem dependências: dá para testar com sinais sintéticos.
 */
export interface OpcoesVad {
  sampleRate: number;
  /** 1 (exige voz alta) .. 10 (muito sensível) */
  sensibilidade: number;
  silencioMs?: number;
  minFalaMs?: number;
  maxFalaMs?: number;
  preRollMs?: number;
}

export function rms(f: Float32Array): number {
  let s = 0;
  for (let i = 0; i < f.length; i++) s += f[i] * f[i];
  return Math.sqrt(s / Math.max(1, f.length));
}

export class Segmentador {
  private quadro: number;
  private resto = new Float32Array(0);
  private preRoll: Float32Array[] = [];
  private fala: Float32Array[] = [];
  private falando = false;
  private acima = 0;
  private silencio = 0;
  private ruido = 0.004;
  private pausado = false;
  private readonly o: Required<OpcoesVad>;

  constructor(
    opcoes: OpcoesVad,
    private aoFalar: (audio: Float32Array, duracaoMs: number) => void,
    private aoNivel: (nivel: number, falando: boolean) => void = () => {},
  ) {
    this.o = { silencioMs: 800, minFalaMs: 350, maxFalaMs: 14000, preRollMs: 300, ...opcoes };
    this.quadro = Math.round(this.o.sampleRate * 0.02); // 20 ms
  }

  pausar(p: boolean) {
    this.pausado = p;
    if (p) this.descartar();
  }

  private descartar() {
    this.falando = false;
    this.fala = [];
    this.acima = 0;
    this.silencio = 0;
    this.resto = new Float32Array(0);
  }

  get limiar(): number {
    const s = this.o.sensibilidade;
    return Math.max(0.02 - 0.0013 * s, this.ruido * (4.2 - 0.3 * s));
  }

  processar(entrada: Float32Array) {
    if (this.pausado) return;
    const buf = new Float32Array(this.resto.length + entrada.length);
    buf.set(this.resto);
    buf.set(entrada, this.resto.length);
    let pos = 0;
    while (pos + this.quadro <= buf.length) {
      this.quadro20(buf.slice(pos, pos + this.quadro));
      pos += this.quadro;
    }
    this.resto = buf.slice(pos);
  }

  private quadro20(q: Float32Array) {
    const nivel = rms(q);
    const alto = nivel > this.limiar;
    const maxPre = Math.round(this.o.preRollMs / 20);
    if (!this.falando) {
      this.ruido = Math.min(0.05, this.ruido * 0.95 + nivel * 0.05);
      this.preRoll.push(q);
      if (this.preRoll.length > maxPre) this.preRoll.shift();
      this.acima = alto ? this.acima + 1 : 0;
      if (this.acima >= 3) {
        this.falando = true;
        this.fala = [...this.preRoll];
        this.preRoll = [];
        this.silencio = 0;
      }
    } else {
      this.fala.push(q);
      this.silencio = alto ? 0 : this.silencio + 1;
      const duracao = this.fala.length * 20;
      if (this.silencio * 20 >= this.o.silencioMs || duracao >= this.o.maxFalaMs) this.finalizar();
    }
    this.aoNivel(nivel, this.falando);
  }

  private finalizar() {
    const util = this.fala.length - Math.max(0, this.silencio - 10); // mantém ~200 ms de silêncio no fim
    const quadros = this.fala.slice(0, Math.max(1, util));
    const falaMs = (this.fala.length - this.silencio) * 20;
    this.fala = [];
    this.falando = false;
    this.acima = 0;
    this.silencio = 0;
    if (falaMs < this.o.minFalaMs) return;
    const audio = new Float32Array(quadros.length * this.quadro);
    quadros.forEach((q, i) => audio.set(q, i * this.quadro));
    this.aoFalar(audio, quadros.length * 20);
  }
}
