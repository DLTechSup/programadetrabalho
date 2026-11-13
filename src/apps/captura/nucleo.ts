// Lógica da Captura de Tela: nomes de arquivo, normalização da área selecionada e o gatilho
// em duas etapas (armar com os dois botões, selecionar com o esquerdo). Nada de Windows/Electron
// aqui -- só o que pode ser testado puro, igual ao captura/nucleo.py original.

export const TAMANHO_MINIMO = 4; // arrastou menos que isso (clique sem querer) = não conta como seleção

export type Area = { esquerda: number; topo: number; direita: number; baixo: number };

/** Deixa a área na ordem certa, não importa de que canto o usuário arrastou. */
export function normalizarArea(x1: number, y1: number, x2: number, y2: number): Area {
  const [esquerda, direita] = [Math.round(x1), Math.round(x2)].sort((a, b) => a - b);
  const [topo, baixo] = [Math.round(y1), Math.round(y2)].sort((a, b) => a - b);
  return { esquerda, topo, direita, baixo };
}

export function areaValida(a: Area, minimo = TAMANHO_MINIMO): boolean {
  return a.direita - a.esquerda >= minimo && a.baixo - a.topo >= minimo;
}

const PROIBIDOS = /[<>:"/\\|?*]/g;

/** 'Captura 2026-11-13 15-30-07.png' (sem ':' no nome, o Windows não aceita). */
export function nomeArquivo(quando: Date, prefixo = "Captura"): string {
  const base = prefixo.replace(PROIBIDOS, "-").trim() || "Captura";
  const p = (n: number) => String(n).padStart(2, "0");
  const data = `${quando.getFullYear()}-${p(quando.getMonth() + 1)}-${p(quando.getDate())}`;
  const hora = `${p(quando.getHours())}-${p(quando.getMinutes())}-${p(quando.getSeconds())}`;
  return `${base} ${data} ${hora}.png`;
}

/** Se 'Captura ...png' já existir (duas no mesmo segundo), acrescenta (2), (3)... */
export function caminhoSemSobrescrever(nome: string, existe: (nomeCandidato: string) => boolean): string {
  if (!existe(nome)) return nome;
  const pontoExt = nome.lastIndexOf(".");
  const tronco = pontoExt === -1 ? nome : nome.slice(0, pontoExt);
  const ext = pontoExt === -1 ? "" : nome.slice(pontoExt);
  let n = 2;
  while (existe(`${tronco} (${n})${ext}`)) n++;
  return `${tronco} (${n})${ext}`;
}

export type Config = {
  pastaDestino: string; // vazio = Imagens\Capturas de Tela (definida na 1a abertura)
  copiarParaAreaTransferencia: boolean;
  som: boolean;
  abrirPastaNoAviso: boolean;
  ativo: boolean; // desliga/liga a captura sem fechar o programa
  prefixoArquivo: string;
};

export const CONFIG_PADRAO: Config = {
  pastaDestino: "",
  copiarParaAreaTransferencia: true,
  som: true,
  abrirPastaNoAviso: true,
  ativo: true,
  prefixoArquivo: "Captura",
};

type Lado = "esquerdo" | "direito";

/** Fluxo em duas etapas:
 * 1) Os dois botões do mouse pressionados ao mesmo tempo (um toque rápido, sem precisar segurar)
 *    ARMAM a captura -- a tela fica pronta esperando.
 * 2) Um clique normal com o botão ESQUERDO: pressionar começa a seleção, arrastar mostra a área,
 *    soltar conclui a captura.
 * Um clique com o botão direito (ou Esc, tratado fora daqui) cancela a qualquer momento depois de armado.
 */
export class GatilhoCaptura {
  static readonly IDLE = "idle";
  static readonly ARMADO = "armado";
  static readonly SELECIONANDO = "selecionando";

  estado: string = GatilhoCaptura.IDLE;
  private esquerdoApertado = false;
  private direitoApertado = false;
  private esquerdoDesde = 0;
  private direitoDesde = 0;

  constructor(
    private aoArmar: (x: number, y: number) => void,
    private aoIniciarSelecao: (x: number, y: number) => void,
    private aoMover: (x: number, y: number) => void,
    private aoFinalizar: (x: number, y: number) => void,
    private aoCancelar: () => void,
    private janelaMs = 350,
    private agora: () => number = () => Date.now(),
  ) {}

  /** Chamado de fora (ex.: tecla Esc) para desistir, de qualquer estado. */
  cancelar(): void {
    if (this.estado !== GatilhoCaptura.IDLE) {
      this.estado = GatilhoCaptura.IDLE;
      this.aoCancelar();
    }
  }

  clique(x: number, y: number, lado: Lado, pressionado: boolean): void {
    const agora = this.agora();
    if (lado === "esquerdo") {
      this.esquerdoApertado = pressionado;
      if (pressionado) this.esquerdoDesde = agora;
    } else {
      this.direitoApertado = pressionado;
      if (pressionado) this.direitoDesde = agora;
    }

    if (this.estado === GatilhoCaptura.IDLE) {
      if (pressionado && this.esquerdoApertado && this.direitoApertado &&
          Math.abs(this.esquerdoDesde - this.direitoDesde) <= this.janelaMs) {
        this.estado = GatilhoCaptura.ARMADO;
        this.aoArmar(x, y);
      }
    } else if (this.estado === GatilhoCaptura.ARMADO) {
      if (lado === "esquerdo" && pressionado) {
        this.estado = GatilhoCaptura.SELECIONANDO;
        this.aoIniciarSelecao(x, y);
      } else if (lado === "direito" && pressionado) {
        this.estado = GatilhoCaptura.IDLE;
        this.aoCancelar();
      }
    } else if (this.estado === GatilhoCaptura.SELECIONANDO) {
      if (lado === "esquerdo" && !pressionado) {
        this.estado = GatilhoCaptura.IDLE;
        this.aoFinalizar(x, y);
      } else if (lado === "direito" && pressionado) {
        this.estado = GatilhoCaptura.IDLE;
        this.aoCancelar();
      }
    }
  }

  mover(x: number, y: number): void {
    if (this.estado === GatilhoCaptura.SELECIONANDO) this.aoMover(x, y);
  }
}
