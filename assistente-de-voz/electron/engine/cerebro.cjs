// "Cérebro": recebe o que foi ouvido, decide se é para ele (palavra de ativação), entende o comando,
// conduz perguntas (escolhas) e permite trocar o próprio nome por voz.
const { normalizar, similaridade, ehRuido } = require("./texto.cjs");
const { interpretar, interpretarEscolha, ehNao, EXEMPLOS } = require("./comandos.cjs");

const INTERJEICOES = new Set(["ei", "oi", "ola", "hey", "e", "ok", "opa", "fala", "bom", "dia", "boa", "tarde", "noite", "olha", "escuta", "alo"]);
const PALAVRAS_DE_COMANDO = new Set(["abre", "abrir", "fecha", "fechar", "volume", "aba", "cancela", "pesquisa", "procura", "liga", "desliga", "mostra", "vai", "troca", "muda", "sim", "nao"]);

/** Procura o nome de ativação no começo da frase. Devolve { achou, resto (texto original depois do nome) }. */
function detectarAtivacao(raw, nomes) {
  const toks = String(raw).split(/\s+/).filter((t) => normalizar(t));
  const norm = toks.map(normalizar);
  let ini = 0;
  while (ini < 2 && ini < norm.length - 1 && INTERJEICOES.has(norm[ini])) ini++;
  let melhor = null;
  for (const nome of nomes) {
    const alvo = normalizar(nome);
    if (!alvo) continue;
    const k = alvo.split(" ").length;
    const limiar = alvo.replace(/\s/g, "").length <= 4 ? 0.95 : 0.88;
    for (const len of new Set([k, k + 1, Math.max(1, k - 1)])) {
      if (ini + len > norm.length) continue;
      const falado = norm.slice(ini, ini + len).join(" ");
      const s = Math.max(similaridade(falado, alvo), similaridade(falado.replace(/\s/g, ""), alvo.replace(/\s/g, "")));
      // palavras separadas/coladas pelo reconhecedor exigem mais certeza (evita "já vi" acordar o "Jarvis")
      if (s >= (len === k ? limiar : Math.max(limiar, 0.92)) && (!melhor || s > melhor.s)) melhor = { s, fim: ini + len };
    }
  }
  if (!melhor) return { achou: false, resto: "" };
  return { achou: true, resto: toks.slice(melhor.fim).join(" ").replace(/^[\s,.:;!?-]+/, "") };
}

/** Limpa o nome dito ("de Assistente agora" -> "Assistente"). Devolve { nome } ou { erro }. */
function limparNome(texto) {
  let t = String(texto).replace(/[^\p{L}\p{N}\s'-]/gu, " ").replace(/\s+/g, " ").trim();
  for (let i = 0; i < 3; i++) {
    t = t.replace(/^(?:de|para|pra|por|o|a|um|uma|se|chamar|chamo|como)\s+/i, "").replace(/\s+(?:agora|ta|ok|por favor|valeu|obrigado|obrigada|ne)$/i, "").trim();
  }
  if (t.split(" ").filter(Boolean).length > 4) return { erro: "Não entendi o nome." };
  const palavras = t.split(" ").filter(Boolean).slice(0, 3);
  const nome = palavras.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join(" ");
  if (nome.length < 2) return { erro: "Não entendi o nome." };
  if (nome.length > 24) return { erro: "Esse nome é muito comprido. Use até três palavras curtas." };
  if (palavras.some((p) => PALAVRAS_DE_COMANDO.has(normalizar(p)))) return { erro: "Esse nome pode se confundir com um comando. Escolha outro." };
  return { nome };
}

function criarCerebro({ config, acoes, agora = Date.now }) {
  let estado = "dormindo"; // dormindo | ouvindo | escolhendo | nome
  let expiraEm = 0;
  let pendente = null;
  let ultimaFala = "";
  let tentativas = 0;

  const seg = (s) => s * 1000;
  const acordar = (s) => {
    estado = "ouvindo";
    expiraEm = agora() + seg(s);
  };
  const atualizar = () => {
    if (estado !== "dormindo" && agora() > expiraEm) {
      estado = "dormindo";
      pendente = null;
    }
  };
  const resp = (fala, extra = {}) => {
    if (fala) ultimaFala = fala;
    return { estado, fala, expiraEm, nome: config.get().nomeAtivacao, ...extra };
  };

  function nomesAtivacao() {
    const c = config.get();
    return [c.nomeAtivacao, ...c.variantes];
  }

  async function renomear(it) {
    if (!it.nome) {
      estado = "nome";
      expiraEm = agora() + seg(15);
      return resp("Qual nome você quer usar?", { intent: it });
    }
    return aplicarNome(it.nome, it);
  }

  function aplicarNome(texto, it) {
    const r = limparNome(texto);
    if (r.erro) {
      estado = "nome";
      expiraEm = agora() + seg(15);
      return resp(`${r.erro} Qual nome você quer usar?`, { intent: it, ok: false });
    }
    config.set({ nomeAtivacao: r.nome, variantes: [] });
    acordar(config.get().janelaConversaSeg);
    return resp(`Ok, me chame de ${r.nome} quando quiser algo.`, { intent: it, ok: true, renomeado: r.nome });
  }

  function perguntaEscolha(esc) {
    const lista = esc.opcoes.map((o, i) => `${i + 1}, ${o.rotulo}`).join(". ");
    return `${esc.pergunta} ${lista}. Qual?`;
  }

  async function responderEscolha(raw) {
    if (ehNao(raw) || /^(?:cancela|cancelar|deixa|esquece)/.test(normalizar(raw))) {
      pendente = null;
      acordar(config.get().janelaConversaSeg);
      return resp("Ok, cancelei.", { ok: true });
    }
    const ops = pendente.opcoes;
    let i = interpretarEscolha(raw, ops.length);
    if (i == null) {
      const n = normalizar(raw);
      const cand = ops.map((o, idx) => ({ idx, s: Math.max(similaridade(n, o.rotulo), n.length >= 3 && normalizar(o.rotulo).includes(n) ? 0.88 : 0) })).sort((a, b) => b.s - a.s);
      if (cand[0].s >= 0.85 && (cand.length === 1 || cand[0].s - cand[1].s >= 0.04)) i = cand[0].idx;
    }
    if (i == null) {
      tentativas++;
      if (tentativas >= 2) {
        pendente = null;
        acordar(config.get().janelaConversaSeg);
        return resp("Não consegui entender a escolha. Cancelei.", { ok: false });
      }
      expiraEm = agora() + seg(20);
      return resp("Não entendi. Diga o número da opção, ou cancele.", { ok: false });
    }
    const op = ops[i];
    pendente = null;
    return executarIntent(op.intent);
  }

  async function executarIntent(intent) {
    let r;
    try {
      r = await acoes.executar(intent);
    } catch (e) {
      r = { ok: false, fala: `Deu erro: ${String((e && e.message) || e).slice(0, 120)}` };
    }
    if (r.escolha) {
      pendente = r.escolha;
      tentativas = 0;
      estado = "escolhendo";
      expiraEm = agora() + seg(20);
      return resp(perguntaEscolha(r.escolha), { intent, ok: true, escolha: r.escolha.opcoes.map((o) => o.rotulo) });
    }
    acordar(config.get().janelaConversaSeg);
    return resp(r.fala, { intent, ok: r.ok, lista: r.lista });
  }

  async function comando(cmd) {
    const it = interpretar(cmd);
    switch (it.tipo) {
      case "vazio":
        acordar(config.get().escutaAposAtivarSeg);
        return resp("Pois não?", { intent: it, ok: true });
      case "renomear":
        return renomear(it);
      case "cancelar":
        acordar(config.get().janelaConversaSeg);
        return resp("Ok.", { intent: it, ok: true });
      case "dormir":
        estado = "dormindo";
        return resp("Até logo.", { intent: it, ok: true });
      case "pausar_escuta":
        estado = "dormindo";
        return resp("Parei de ouvir.", { intent: it, ok: true, pausarEscuta: true });
      case "repetir":
        acordar(config.get().janelaConversaSeg);
        return resp(ultimaFala || "Ainda não falei nada.", { intent: it, ok: true });
      case "ajuda": {
        acordar(config.get().janelaConversaSeg);
        const nome = config.get().nomeAtivacao;
        return resp(`Posso abrir marcas e referências, programas, sites, trocar abas do navegador, controlar janelas e o volume. Para trocar meu nome, diga: ${nome}, seu nome agora é, e o novo nome.`, { intent: it, ok: true, exemplos: EXEMPLOS });
      }
      case "desconhecido": {
        // frase curta que pode ser só o nome de um programa/pasta ("whatsapp", "downloads")
        if (it.texto.split(" ").length <= 3) {
          let r;
          try {
            r = await acoes.executar({ tipo: "abrir", alvo: it.texto });
          } catch {
            r = null;
          }
          if (r && (r.ok || r.escolha)) return executarIntentComResultado(it, r);
        }
        acordar(config.get().janelaConversaSeg);
        return resp(`Não entendi "${cmd.trim()}". Diga ajuda para ver o que sei fazer.`, { intent: it, ok: false });
      }
      default:
        return executarIntent(it);
    }
  }

  async function executarIntentComResultado(it, r) {
    if (r.escolha) {
      pendente = r.escolha;
      tentativas = 0;
      estado = "escolhendo";
      expiraEm = agora() + seg(20);
      return resp(perguntaEscolha(r.escolha), { intent: it, ok: true });
    }
    acordar(config.get().janelaConversaSeg);
    return resp(r.fala, { intent: it, ok: r.ok });
  }

  /**
   * Entrada principal. `origem`: "voz" (precisa da palavra de ativação quando está dormindo) ou "texto"
   * (digitado na caixa: não precisa de ativação).
   */
  async function ouvir(raw, { origem = "voz" } = {}) {
    atualizar();
    const texto = String(raw ?? "").trim();
    if (!texto || (origem === "voz" && ehRuido(texto))) return resp("", { ignorado: true, entendido: texto });

    if (estado === "nome") return aplicarNome(texto, { tipo: "renomear", nome: texto });
    if (estado === "escolhendo" && pendente) return responderEscolha(texto);

    if (origem === "voz" && estado === "dormindo") {
      const det = detectarAtivacao(texto, nomesAtivacao());
      if (!det.achou) return resp("", { ignorado: true, entendido: texto });
      if (!normalizar(det.resto)) {
        acordar(config.get().escutaAposAtivarSeg);
        return resp("Pois não?", { ok: true, ativado: true, entendido: texto });
      }
      const r = await comando(det.resto);
      return { ...r, entendido: texto, ativado: true };
    }
    // acordado (ou digitado): se a pessoa repetir o nome antes do comando, tira
    let cmd = texto;
    const det = detectarAtivacao(texto, nomesAtivacao());
    if (det.achou && normalizar(det.resto)) cmd = det.resto;
    else if (det.achou) {
      acordar(config.get().escutaAposAtivarSeg);
      return resp("Pois não?", { ok: true, ativado: true, entendido: texto });
    }
    const r = await comando(cmd);
    return { ...r, entendido: texto };
  }

  return {
    ouvir,
    estado: () => {
      atualizar();
      return { estado, restanteMs: estado === "dormindo" ? 0 : Math.max(0, expiraEm - agora()), nome: config.get().nomeAtivacao };
    },
    dormir: () => {
      estado = "dormindo";
      pendente = null;
    },
  };
}

module.exports = { criarCerebro, detectarAtivacao, limparNome };
