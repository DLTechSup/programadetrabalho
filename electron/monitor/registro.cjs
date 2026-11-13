// Log dos eventos do dia: um arquivo .txt, um evento por linha, na pasta principal (_Log) --
// porta registro.py.
const fs = require("node:fs");
const path = require("node:path");

class RegistroDoDia {
  constructor(pastaBase, agora = () => new Date()) {
    this.agora = agora;
    this.pasta = path.join(pastaBase, "_Log");
  }

  get arquivo() {
    const d = this.agora();
    const p = (n) => String(n).padStart(2, "0");
    return path.join(this.pasta, `log_${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()}.txt`);
  }

  /** Acrescenta '[HH:MM:SS] texto'. Se o texto tiver várias linhas, cada uma vira uma linha do log. */
  escrever(texto) {
    fs.mkdirSync(this.pasta, { recursive: true });
    const d = this.agora();
    const p = (n) => String(n).padStart(2, "0");
    const hora = `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
    const linhas = String(texto).split(/\r?\n/);
    let conteudo = "";
    linhas.forEach((linha, i) => {
      conteudo += (i === 0 ? `[${hora}] ` : "           ") + linha + "\r\n";
    });
    fs.appendFileSync(this.arquivo, conteudo, "utf-8");
  }

  ler() {
    try {
      return fs.readFileSync(this.arquivo, "utf-8").replace(/\r\n/g, "\n");
    } catch {
      return "";
    }
  }
}

module.exports = { RegistroDoDia };
