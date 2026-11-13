// Lista da demanda do dia (lista_do_dia.txt legível + um .json interno) -- porta lista.py.
const fs = require("node:fs");
const path = require("node:path");

class ListaDoDia {
  constructor(pastaDia) {
    this.pasta = pastaDia;
    this.arquivo = path.join(pastaDia, "lista_do_dia.json");
    this.itens = new Map(); // chave -> item
    this.recarregar();
  }

  /** Lê de novo do arquivo (a janela pode ter marcado 'feito' enquanto o monitor trabalhava). */
  recarregar() {
    try {
      const d = JSON.parse(fs.readFileSync(this.arquivo, "utf-8"));
      this.itens = new Map(d.map((i) => [i.chave, i]));
    } catch { /* primeiro uso ou arquivo ainda não existe */ }
  }

  /** Mesma pasta de novo = soma as fotos (não cria linha repetida). */
  registrar({ chave, grupo, marca, referencia, novasFotos, situacao, pasta, observacao = "" }) {
    let item = this.itens.get(chave);
    if (!item) {
      const d = new Date();
      const p = (n) => String(n).padStart(2, "0");
      item = { chave, hora: `${p(d.getHours())}:${p(d.getMinutes())}`, grupo, marca, referencia, fotos: 0, situacao, pasta, observacao, feito: false };
      this.itens.set(chave, item);
    }
    item.fotos += novasFotos;
    if (situacao === "ok") item.situacao = "ok";
    if (observacao && !item.observacao.includes(observacao)) item.observacao = `${item.observacao} ${observacao}`.trim();
    this.salvar();
    return item;
  }

  marcarFeito(chave, feito) {
    const item = this.itens.get(chave);
    if (item) { item.feito = feito; this.salvar(); }
  }

  ordenados() {
    return [...this.itens.values()].sort((a, b) => {
      if (a.feito !== b.feito) return a.feito ? 1 : -1;
      const aConferir = a.situacao === "conferir", bConferir = b.situacao === "conferir";
      if (aConferir !== bConferir) return aConferir ? -1 : 1;
      return a.hora < b.hora ? -1 : a.hora > b.hora ? 1 : 0;
    });
  }

  salvar() {
    fs.mkdirSync(this.pasta, { recursive: true });
    fs.writeFileSync(this.arquivo, JSON.stringify([...this.itens.values()], null, 1), "utf-8");
    this._escreverTxt();
  }

  /** Um bloco por demanda, com cada dado em sua própria linha (nada junto numa linha só). */
  _escreverTxt() {
    const nomeGrupo = path.basename(path.dirname(this.pasta));
    const nomeDia = path.basename(this.pasta).replace(/-/g, "/");
    const linhas = ["LISTA DA DEMANDA", `Grupo: ${nomeGrupo}`, `Dia: ${nomeDia}`, "", "=".repeat(40), ""];
    const ordenadosPorHora = [...this.itens.values()].sort((a, b) => (a.hora < b.hora ? -1 : a.hora > b.hora ? 1 : 0));
    for (const i of ordenadosPorHora) {
      const marca = i.marca && i.marca !== "?" ? i.marca : "(não identificada)";
      linhas.push(
        `[${i.feito ? "x" : " "}] ${i.referencia}`,
        `    Marca: ${marca}`,
        `    Hora: ${i.hora}`,
        `    Fotos: ${i.fotos}`,
        `    Pasta: ${i.pasta}`,
        `    Situação: ${i.situacao === "conferir" ? "CONFERIR" : "ok"}`,
      );
      if (i.observacao) linhas.push(`    Observação: ${i.observacao}`);
      linhas.push("");
    }
    fs.writeFileSync(path.join(this.pasta, "lista_do_dia.txt"), linhas.join("\r\n") + "\r\n", "utf-8");
  }
}

/** Mensagens já processadas hoje (para não baixar de novo ao reiniciar). */
class Estado {
  constructor(pastaDia) {
    this.arquivo = path.join(pastaDia, "estado.json");
    try {
      this.vistos = new Set(JSON.parse(fs.readFileSync(this.arquivo, "utf-8")));
    } catch {
      this.vistos = new Set();
    }
  }

  novo(idMsg) {
    return !this.vistos.has(idMsg);
  }

  marcar(idMsg) {
    this.vistos.add(idMsg);
    fs.mkdirSync(path.dirname(this.arquivo), { recursive: true });
    fs.writeFileSync(this.arquivo, JSON.stringify([...this.vistos].sort()), "utf-8");
  }
}

module.exports = { ListaDoDia, Estado };
