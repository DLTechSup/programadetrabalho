// Mesma lógica pura de src/apps/captura/nucleo.ts, em CommonJS para o processo principal usar
// direto (o fluxo da Captura de Tela roda todo em electron/main, sem passar pelo renderer).
// Mantenha os dois em sincronia.
const TAMANHO_MINIMO = 4;

function normalizarArea(x1, y1, x2, y2) {
  const [esquerda, direita] = [Math.round(x1), Math.round(x2)].sort((a, b) => a - b);
  const [topo, baixo] = [Math.round(y1), Math.round(y2)].sort((a, b) => a - b);
  return { esquerda, topo, direita, baixo };
}

function areaValida(a, minimo = TAMANHO_MINIMO) {
  return a.direita - a.esquerda >= minimo && a.baixo - a.topo >= minimo;
}

const PROIBIDOS = /[<>:"/\\|?*]/g;

function nomeArquivo(quando, prefixo = "Captura") {
  const base = prefixo.replace(PROIBIDOS, "-").trim() || "Captura";
  const p = (n) => String(n).padStart(2, "0");
  const data = `${quando.getFullYear()}-${p(quando.getMonth() + 1)}-${p(quando.getDate())}`;
  const hora = `${p(quando.getHours())}-${p(quando.getMinutes())}-${p(quando.getSeconds())}`;
  return `${base} ${data} ${hora}.png`;
}

function caminhoSemSobrescrever(nome, existe) {
  if (!existe(nome)) return nome;
  const pontoExt = nome.lastIndexOf(".");
  const tronco = pontoExt === -1 ? nome : nome.slice(0, pontoExt);
  const ext = pontoExt === -1 ? "" : nome.slice(pontoExt);
  let n = 2;
  while (existe(`${tronco} (${n})${ext}`)) n++;
  return `${tronco} (${n})${ext}`;
}

class GatilhoCaptura {
  constructor(aoArmar, aoIniciarSelecao, aoMover, aoFinalizar, aoCancelar, janelaMs = 350, agora = () => Date.now()) {
    this.aoArmar = aoArmar;
    this.aoIniciarSelecao = aoIniciarSelecao;
    this.aoMover = aoMover;
    this.aoFinalizar = aoFinalizar;
    this.aoCancelar = aoCancelar;
    this.janelaMs = janelaMs;
    this.agora = agora;
    this.estado = GatilhoCaptura.IDLE;
    this.esquerdoApertado = false;
    this.direitoApertado = false;
    this.esquerdoDesde = 0;
    this.direitoDesde = 0;
  }

  cancelar() {
    if (this.estado !== GatilhoCaptura.IDLE) {
      this.estado = GatilhoCaptura.IDLE;
      this.aoCancelar();
    }
  }

  clique(x, y, lado, pressionado) {
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

  mover(x, y) {
    if (this.estado === GatilhoCaptura.SELECIONANDO) this.aoMover(x, y);
  }
}
GatilhoCaptura.IDLE = "idle";
GatilhoCaptura.ARMADO = "armado";
GatilhoCaptura.SELECIONANDO = "selecionando";

module.exports = { normalizarArea, areaValida, nomeArquivo, caminhoSemSobrescrever, GatilhoCaptura };
