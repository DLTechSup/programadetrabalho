// Regras do monitor: o que fazer com cada mensagem dos Grupos A e B -- porta motor.py.
// Única diferença estrutural: aqui tudo é assíncrono (o navegador do Electron responde por
// Promises), então o laço principal inteiro usa async/await onde o Python usava chamadas
// diretas do Playwright síncrono.
const { pastaDoDia, salvarFotos, anexarMensagens } = require("./armazenamento.cjs");
const { ListaDoDia, Estado } = require("./lista.cjs");
const {
  chaveReferencia, dividirLegenda, demandaCompleta, nomePastaDemanda, carregarMarcas, detectarMarca,
} = require("./logica-pura.cjs");

const CONFERIR = "_Conferir";
const APAGADA = new Set([
  "ESTA MENSAGEM FOI APAGADA", "VOCE APAGOU ESTA MENSAGEM", "THIS MESSAGE WAS DELETED", "YOU DELETED THIS MESSAGE", "MENSAGEM APAGADA",
]);

function normalizarApagada(t) {
  return (t || "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toUpperCase().trim();
}

const LADO_MINIMO = 1000; // abaixo disso a foto do chat é só uma miniatura: abrimos a foto inteira

async function ladoMedio(fotos) {
  if (!fotos.length) return 0;
  const { nativeImage } = require("electron");
  let total = 0, n = 0;
  for (const f of fotos) {
    try {
      const img = nativeImage.createFromBuffer(f);
      const { width, height } = img.getSize();
      if (width && height) { total += Math.max(width, height); n++; }
    } catch { /* ignora */ }
  }
  return n ? total / n : 0;
}

/** OCR da foto da caixa -> {marca, ref}. Tenta a etiqueta inteira primeiro. */
async function lerEtiqueta(lerOcr, dados, marcas) {
  const texto = await lerOcr(dados);
  const { extrairReferencia } = require("./logica-pura.cjs");
  const marca = detectarMarca(texto, marcas);
  const ref = extrairReferencia(texto);
  return { marca: marca ? marca.toUpperCase() : null, ref };
}

class Processador {
  constructor(cfg, nav, { ocr = null, evento = () => {}, agora = () => Date.now(), hoje = () => new Date(),
    marcasExtras = null, regrasRef } = {}) {
    this.cfg = cfg;
    this.nav = nav;
    this.evento = evento;
    this.agora = agora;
    this.hoje = hoje;
    this._ocr = ocr;
    this.regrasRef = regrasRef;
    this.marcas = carregarMarcas(marcasExtras);
    this.pendentes = new Map(); // `${grupo}\u0000${remetente}` -> {fotos, t0, msgId, remetente, grupo}
    this.aguardando = new Map(); // msgId -> ciclos
    this._dias = new Map(); // grupo -> dataStr
    this.listas = new Map();
    this.estados = new Map();
    this.pastas = new Map();
    this._primeiro = new Set();
    this._avisoFalha = new Map();
  }

  _prepararDia(grupo) {
    const d = this.hoje();
    const chaveDia = d.toDateString();
    if (this._dias.get(grupo) !== chaveDia) {
      this._dias.set(grupo, chaveDia);
      const pasta = pastaDoDia(this.cfg.pastaBase, grupo, d);
      this.pastas.set(grupo, pasta);
      this.listas.set(grupo, new ListaDoDia(pasta));
      this.estados.set(grupo, new Estado(pasta));
      this.evento("lista", null);
    }
  }

  async _motorOcr() {
    if (!this._ocr) {
      this.evento("status", "Carregando o leitor de etiquetas (a primeira vez demora)...");
      const { lerFoto } = require("./ocr.cjs");
      this._ocr = lerFoto;
    }
    return this._ocr;
  }

  _registrar(grupo, marca, ref, pastaNome, fotos, situacao, obs = "") {
    const lista = this.listas.get(grupo);
    const { pasta, novas } = salvarFotos(this.pastas.get(grupo), pastaNome, fotos);
    const path = require("node:path");
    if (novas === 0 && [...lista.itens.values()].some((i) => chaveReferencia(i.pasta) === chaveReferencia(pastaNome))) {
      return; // tudo repetido: não mexe na lista
    }
    const item = lista.registrar({
      chave: chaveReferencia(pastaNome) || pastaNome, grupo, marca, referencia: ref,
      novasFotos: novas, situacao, pasta: path.basename(pasta), observacao: obs,
    });
    this.evento("lista", item);
    this.evento("log", `${grupo}: ${path.basename(pasta)} (+${novas} foto(s))` + (obs ? ` — ${obs}` : ""));
    if (novas > 0) {
      this.evento("salvo", {
        grupo, pasta: path.basename(pasta), marca, referencia: ref, novas, total: item.fotos,
        nova: item.fotos === novas, situacao, obs,
      });
    }
  }

  async ciclo() {
    for (const g of this.cfg.grupos) {
      this._prepararDia(g.nome);
      this.listas.get(g.nome).recarregar();
      const abriu = await this.nav.abrirConversa(g.nome);
      if (!abriu) {
        if (this.agora() - (this._avisoFalha.get(g.nome) ?? -1e15) >= 180000) {
          this._avisoFalha.set(g.nome, this.agora());
          let visto = "";
          try { visto = await this.nav.resumoConversas(); } catch { /* ok */ }
          this.evento("log", `Não consegui abrir o grupo "${g.nome}" (nome diferente? está na lista de conversas?)` + (visto ? ` — ${visto}` : "") + " Continuo tentando.");
        }
        continue;
      }
      await this._processarGrupo(g);
    }
    this._vencerPendentes();
  }

  async _processarGrupo(g) {
    const primeira = !this._primeiro.has(g.nome);
    this._primeiro.add(g.nome);
    if (primeira && this.cfg.pegarAntigas && this.nav.rolarParaOInicioDoDia) {
      await this._varredura(g);
    } else {
      await this._passada(g, primeira && !this.cfg.pegarAntigas);
    }
  }

  /** Sobe até o início do dia e desce tela por tela (as fotos só carregam quando aparecem), processando tudo. */
  async _varredura(g) {
    this.evento("log", `${g.nome}: lendo tudo o que chegou hoje (pode levar um pouco)...`);
    await this.nav.rolarParaOInicioDoDia(this.hoje());
    for (let i = 0; i < 120; i++) {
      await this._passada(g, false);
      if (!(await this.nav.rolarUmPasso())) break;
    }
    await this._passada(g, false);
    await this.nav.rolarParaOFim();
  }

  async _passada(g, ignorarExistentes = false) {
    if (g.tipo === "I") return this._conversaIndividual(g, ignorarExistentes);
    const estado = this.estados.get(g.nome);
    if (ignorarExistentes) {
      await this._marcarHistorico(g);
      return;
    }
    const { msgsBrutas } = await this.nav.ler();
    const { brutaParaMensagem, completarDatas, mesmoDia } = require("./logica-pura.cjs");
    const msgs = msgsBrutas.map(brutaParaMensagem);
    completarDatas(msgs);
    for (const m of msgs) {
      if (m.minha || !estado.novo(m.id)) continue;
      if (!mesmoDia(m.dia, this.hoje())) {
        estado.marcar(m.id);
        continue;
      }
      if (m.blobs.length || m.carregando) {
        const espera = this.aguardando.get(m.id) || 0;
        if (m.carregando) {
          const limite = m.blobs.length ? 10 : 300;
          if (espera < limite) { this.aguardando.set(m.id, espera + 1); continue; }
        }
        if (!m.blobs.length) {
          this.evento("log", `${g.nome}: uma foto de ${m.remetente || "alguém"} não carregou; confira no WhatsApp.`);
          estado.marcar(m.id);
          continue;
        }
        let fotos;
        try {
          fotos = await this._fotosDaMensagem(m);
        } catch (e) {
          this.evento("log", `Erro ao baixar fotos de ${g.nome}: ${e.message || e}`);
          continue;
        }
        if (g.tipo === "B") await this._grupoB(g, m, fotos);
        else await this._grupoA(g, m, fotos);
      } else if (g.tipo === "A" && m.legenda) {
        await this._textoAvulso(g, m);
      }
      estado.marcar(m.id);
    }
  }

  /** Marca como 'já visto' tudo o que já está na conversa (espera o WhatsApp terminar de carregar o histórico). */
  async _marcarHistorico(g) {
    const estado = this.estados.get(g.nome);
    let anterior = -1;
    for (let i = 0; i < 8; i++) {
      const { msgsBrutas } = await this.nav.ler();
      for (const m of msgsBrutas) estado.marcar(m.id);
      if (msgsBrutas.length && msgsBrutas.length === anterior) break;
      anterior = msgsBrutas.length;
      if (this.nav.aguardar) await this.nav.aguardar(1000);
    }
    this.evento("log", `${g.nome}: pronto. Daqui para frente salvo só o que chegar de novo.`);
  }

  async _fotosDaMensagem(m) {
    let fotos = await this.nav.baixar(m.blobs);
    if (m.mais && this.cfg.tentarEscondidas) {
      const esperado = m.blobs.length + m.mais - 1;
      const completo = await this.nav.baixarAlbumCompleto(m, esperado);
      if (completo.length >= fotos.length) {
        m.observacaoAlbum = completo.length >= esperado ? "" : `álbum incompleto: esperadas ${esperado}, baixadas ${completo.length}`;
        return completo;
      }
      m.observacaoAlbum = `álbum incompleto: esperadas ${esperado}, baixadas ${fotos.length} (faltam ${esperado - fotos.length})`;
    } else if (m.mais) {
      m.observacaoAlbum = `álbum com +${m.mais} foto(s) escondida(s): baixe o restante na mão`;
    } else if (this.cfg.tentarEscondidas && fotos.length) {
      const media = await ladoMedio(fotos);
      if (media > 0 && media < LADO_MINIMO) {
        const completo = await this.nav.baixarAlbumCompleto(m, fotos.length);
        const mediaCompleto = await ladoMedio(completo);
        if (completo.length >= fotos.length && mediaCompleto > media) return completo;
      }
    }
    return fotos;
  }

  // ---- Grupo A -------------------------------------------------------------
  async _grupoA(g, m, fotos) {
    const obs = m.observacaoAlbum || "";
    if (!m.legenda.trim()) {
      this.pendentes.set(`${g.nome}\u0000${m.remetente}`, { fotos, t0: this.agora(), msgId: m.id, remetente: m.remetente, grupo: g.nome });
      this.evento("log", `${g.nome}: ${fotos.length} foto(s) de ${m.remetente || "alguém"} sem legenda; esperando o texto...`);
      return;
    }
    this._salvarComLegenda(g.nome, m.legenda, fotos, obs);
  }

  async _textoAvulso(g, m) {
    const chave = `${g.nome}\u0000${m.remetente}`;
    const p = this.pendentes.get(chave);
    if (p) {
      this.pendentes.delete(chave);
      this._salvarComLegenda(g.nome, m.legenda, p.fotos, "legenda veio depois das fotos");
      return;
    }
    const { nomeSeguro } = require("./logica-pura.cjs");
    const nome = `${CONFERIR} sem foto ${nomeSeguro(m.legenda).slice(0, 60)}`;
    this._registrar(g.nome, "?", m.legenda, nome, [], "conferir",
      "não encontrei a foto desta mensagem (pode ter sido enviada de um jeito que não reconheço); confira no WhatsApp");
    this.evento("log", `${g.nome}: texto de ${m.remetente || "alguém"} sem foto correspondente — "${m.legenda.slice(0, 60)}"; salvei em _Conferir para você revisar.`);
  }

  _salvarComLegenda(grupo, legenda, fotos, obs) {
    const { nomeSeguro } = require("./logica-pura.cjs");
    const d = dividirLegenda(legenda, this.marcas);
    if (demandaCompleta(d)) {
      const [ref, completa] = this.regrasRef.aplicar(d.marca, d.referencia);
      d.referencia = ref;
      const nota = completa ? `${obs} ref. completa na legenda: ${completa}`.trim() : obs;
      this._registrar(grupo, d.marca, ref, nomePastaDemanda(d), fotos, "ok", nota);
    } else {
      const nome = `${CONFERIR} ${nomeSeguro(legenda).slice(0, 60)}`;
      this._registrar(grupo, d.marca || "?", d.referencia || legenda, nome, fotos, "conferir",
        `${obs} marca não reconhecida: confira`.trim());
    }
  }

  _vencerPendentes() {
    const { nomeSeguro } = require("./logica-pura.cjs");
    const agora = this.agora();
    for (const [chave, p] of [...this.pendentes.entries()]) {
      if (agora - p.t0 >= this.cfg.esperaLegendaSeg * 1000) {
        this.pendentes.delete(chave);
        this._registrar(p.grupo, "?", "sem legenda",
          `${CONFERIR} sem legenda ${p.remetente || ""} ${p.msgId.slice(-6)}`.trim(),
          p.fotos, "conferir", "fotos sem marca e referência");
      }
    }
  }

  // ---- Grupo B (foto da caixa, lê a etiqueta) -------------------------------
  async _grupoB(g, m, fotos) {
    const achados = new Map(); // chave -> {marca, ref, lote, completa}
    const semLeitura = [];
    let ler = null;
    try {
      ler = await this._motorOcr();
    } catch (e) {
      this.evento("log", `Leitor de etiquetas indisponível: ${e.message || e}`);
    }
    for (const f of fotos) {
      let marca = null, ref = null;
      if (ler && f.length >= 3000) {
        try {
          ({ marca, ref } = await lerEtiqueta(ler, f, this.marcas));
        } catch (e) {
          this.evento("log", `Não consegui ler uma foto: ${e.message || e}`);
        }
      }
      if (ref) {
        const [refFinal, completa] = this.regrasRef.aplicar(marca, ref);
        const chave = chaveReferencia(refFinal);
        if (!achados.has(chave)) achados.set(chave, { marca: marca || "", ref: refFinal, lote: [], completa });
        achados.get(chave).lote.push(f);
      } else {
        semLeitura.push(f);
      }
      if (this.cfg.todasDoGrupoB) {
        const { nomeSeguro } = require("./logica-pura.cjs");
        const lido = ref ? `${marca || ""} ${ref}`.trim() : "não lida";
        const hora = (m.hora || "").replace(":", "h");
        salvarFotos(this.pastas.get(g.nome), "_Todas as fotos", [f], `${hora} - ${nomeSeguro(lido)} - `);
      }
    }
    for (const { marca, ref, lote, completa } of achados.values()) {
      const nome = `${marca} ${ref}`.trim();
      const partes = [];
      if (!marca) partes.push("marca não identificada na foto");
      if (completa) partes.push(`etiqueta completa: ${completa}`);
      this._registrar(g.nome, marca || "?", ref, nome, lote, "ok", partes.join(" "));
    }
    if (semLeitura.length) {
      const hora = (m.hora || "").replace(":", "h");
      this._registrar(g.nome, "?", "não lida", `${CONFERIR} etiqueta ${hora} ${m.id.slice(-6)}`, semLeitura,
        "conferir", "não consegui ler a referência na foto");
    }
  }

  // ---- Conversa individual: salva o TEXTO do que a pessoa escreveu ----------
  async _conversaIndividual(g, ignorarExistentes = false) {
    const estado = this.estados.get(g.nome);
    if (ignorarExistentes) { await this._marcarHistorico(g); return; }
    const { msgsBrutas } = await this.nav.ler();
    const { nomePastaGrupo } = require("./logica-pura.cjs");
    const mensagens = [];
    let previa = "", nFotos = 0;
    for (const m of msgsBrutas) {
      if (m.minha || !estado.novo(m.id)) continue;
      const { dia } = require("./logica-pura.cjs").interpretarPre(m.pre);
      const ehHoje = dia && new Date(dia).toDateString() === this.hoje().toDateString();
      if (!ehHoje) { estado.marcar(m.id); continue; }
      if (m.carregando && (this.aguardando.get(m.id) || 0) < 10) {
        this.aguardando.set(m.id, (this.aguardando.get(m.id) || 0) + 1);
        continue;
      }
      if (m.blobs.length) {
        try {
          const fotos = await this._fotosDaMensagem(m);
          const { novas } = salvarFotos(this.pastas.get(g.nome), "fotos", fotos, `${nomePastaGrupo(g.nome)} - `);
          nFotos += novas;
        } catch (e) {
          this.evento("log", `Erro ao baixar foto de ${g.nome}: ${e.message || e}`);
          continue;
        }
      }
      let texto = (m.legenda || "").trim();
      if (texto && APAGADA.has(normalizarApagada(texto))) texto = "[mensagem apagada antes de o monitor ler]";
      else if (!texto) texto = m.blobs.length || m.carregando ? "[foto]" : "[mídia sem texto: áudio, figurinha ou arquivo]";
      else if (m.blobs.length || m.carregando) texto = `[foto] ${texto}`;
      const { remetente, hora } = require("./logica-pura.cjs").interpretarPre(m.pre);
      const partes = texto.split("\n");
      mensagens.push([`[${hora || "--:--"}] ${partes[0]}`, ...partes.slice(1).map((p) => `        ${p}`)]);
      previa = previa || texto;
      estado.marcar(m.id);
    }
    if (!mensagens.length) return;
    const arq = anexarMensagens(this.pastas.get(g.nome), mensagens);
    const path = require("node:path");
    if (nFotos) this.evento("log", `${g.nome}: ${nFotos} foto(s) salva(s) na pasta fotos`);
    this.evento("log", `${g.nome}: ${mensagens.length} mensagem(ns) salva(s) em ${path.basename(arq)}`);
    this.evento("salvo", { tipo: "I", grupo: g.nome, mensagens: mensagens.length, fotos: nFotos, previa: previa.slice(0, 80), situacao: "ok", obs: "" });
  }
}

module.exports = { Processador };
