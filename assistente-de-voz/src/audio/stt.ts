/** Ponte com o Web Worker do Whisper. */
export type EstadoStt = "parado" | "carregando" | "pronto" | "erro";

export class Transcritor {
  private w: Worker | null = null;
  private pendentes = new Map<number, { ok: (t: string) => void; erro: (e: Error) => void }>();
  private seq = 0;
  estado: EstadoStt = "parado";
  mensagem = "";

  constructor(private aoMudar: (e: EstadoStt, msg: string) => void) {}

  /** Carrega o modelo (já baixado) no worker. Resolve quando está pronto. */
  carregar(modelo: string): Promise<void> {
    this.descartar();
    this.w = new Worker(new URL("./whisper.worker.ts", import.meta.url), { type: "module" });
    return new Promise<void>((ok, erro) => {
      this.w!.onmessage = (e: MessageEvent) => {
        const m = e.data;
        if (m.tipo === "estado") {
          this.estado = m.estado;
          this.aoMudar(m.estado, "");
          if (m.estado === "pronto") ok();
        } else if (m.tipo === "texto") {
          this.pendentes.get(m.id)?.ok(m.texto);
          this.pendentes.delete(m.id);
        } else if (m.tipo === "erro") {
          if (m.id != null) {
            this.pendentes.get(m.id)?.erro(new Error(m.mensagem));
            this.pendentes.delete(m.id);
          } else {
            this.estado = "erro";
            this.mensagem = m.mensagem;
            this.aoMudar("erro", m.mensagem);
            erro(new Error(m.mensagem));
          }
        }
      };
      this.w!.onerror = (ev) => {
        this.estado = "erro";
        this.mensagem = ev.message || "Falha no reconhecimento de voz.";
        this.aoMudar("erro", this.mensagem);
        erro(new Error(this.mensagem));
      };
      this.estado = "carregando";
      this.aoMudar("carregando", "");
      this.w!.postMessage({ tipo: "carregar", modelo });
    });
  }

  transcrever(audio: Float32Array): Promise<string> {
    if (!this.w || this.estado !== "pronto") return Promise.reject(new Error("Modelo de voz não está pronto."));
    const id = ++this.seq;
    return new Promise((ok, erro) => {
      this.pendentes.set(id, { ok, erro });
      this.w!.postMessage({ tipo: "transcrever", id, audio }, [audio.buffer]);
    });
  }

  descartar() {
    this.w?.terminate();
    this.w = null;
    this.pendentes.clear();
    this.estado = "parado";
  }
}
