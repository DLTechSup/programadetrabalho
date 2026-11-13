// Leitura do WhatsApp Web (só lê: nunca envia nada), dentro de uma janela própria da Central
// com um perfil (partition) separado. Porta o leitor.py original, trocando o Playwright por um
// BrowserWindow do Electron: o JS que roda dentro da página é o mesmo.
const { BrowserWindow } = require("electron");

const URL_WHATSAPP = "https://web.whatsapp.com";
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

// JS que roda dentro da página: devolve as mensagens do chat aberto (só o que é visível/carregado).
const JS_LER = String.raw`() => {
  const main = document.querySelector('#main');
  if (!main) return {aberto: false, titulo: '', msgs: []};
  const t = main.querySelector('header span[title]');
  const todos = [...main.querySelectorAll('div[data-id]')];
  const externos = todos.filter(n => !n.parentElement.closest('div[data-id]'));
  const msgs = externos.map(n => {
    const id = n.getAttribute('data-id') || '';
    const pre = n.querySelector('[data-pre-plain-text]');
    const caps = [...n.querySelectorAll('span.selectable-text')].filter(s => !s.parentElement.closest('span.selectable-text'));
    const imgs = [...n.querySelectorAll('img')].filter(i => !i.hasAttribute('data-plain-text') && !i.classList.contains('emoji')
        && (i.src.startsWith('blob:') || i.src.startsWith('data:image')) && (i.naturalWidth > 40 || i.width > 40));
    let mais = 0;
    for (const el of n.querySelectorAll('*')) {
      if (el.children.length === 0) { const m = (el.textContent || '').trim().match(/^\+(\d+)$/); if (m) { mais = parseInt(m[1], 10); break; } }
    }
    return {
      id, minha: id.startsWith('true_'),
      pre: pre ? pre.getAttribute('data-pre-plain-text') : '',
      legenda: caps.map(c => c.innerText).join('\n').trim(),
      blobs: imgs.filter(i => i.src.startsWith('blob:')).map(i => i.src),
      carregando: imgs.filter(i => i.src.startsWith('data:image')).length,
      mais
    };
  });
  return {aberto: true, titulo: t ? (t.getAttribute('title') || t.textContent) : '', msgs};
}`;

const JS_BAIXAR = String.raw`async (urls) => Promise.all(urls.map(async u => {
  try {
    const b = await (await fetch(u)).blob();
    return await new Promise(res => { const f = new FileReader(); f.onload = () => res(f.result.split(',')[1]); f.readAsDataURL(b); });
  } catch (e) { return ''; }
}))`;

const _JS_ROLAVEL = String.raw`
const achar = () => {
  const m = document.querySelector('#main'); if (!m) return null;
  const el = m.querySelector('div[data-id]'); if (!el) return null;
  let p = el.parentElement;
  while (p && p !== document.body) {
    const st = getComputedStyle(p);
    if ((st.overflowY === 'auto' || st.overflowY === 'scroll') && p.scrollHeight > p.clientHeight + 4) return p;
    p = p.parentElement;
  }
  return null;
};`;

const JS_ROLAR_TOPO = "() => {" + _JS_ROLAVEL + String.raw`
  const m = document.querySelector('#main'); const r = achar(); if (r) r.scrollTop = 0;
  const pre = m ? m.querySelector('[data-pre-plain-text]') : null;
  return {n: m ? m.querySelectorAll('div[data-id]').length : 0, pre: pre ? pre.getAttribute('data-pre-plain-text') : '', rolavel: !!r};
}`;

const JS_ROLAR_PASSO = "() => {" + _JS_ROLAVEL + String.raw`
  const r = achar(); if (!r) return false;
  if (r.scrollTop + r.clientHeight >= r.scrollHeight - 6) return false;
  r.scrollTop = r.scrollTop + r.clientHeight * 0.8; return true;
}`;

const JS_ROLAR_FIM = "() => {" + _JS_ROLAVEL + String.raw`
  const r = achar(); if (r) r.scrollTop = r.scrollHeight; return !!r;
}`;

const JS_CONVERSAS = String.raw`() => {
  const out = []; const add = t => { t = (t || '').trim(); if (t && !out.includes(t)) out.push(t); };
  document.querySelectorAll('#pane-side [title]').forEach(e => add(e.getAttribute('title')));
  if (out.length < 3) {
    document.querySelectorAll('#pane-side [role="row"], #pane-side [role="listitem"], #pane-side [role="gridcell"]')
      .forEach(e => add(((e.innerText || '').split('\n').map(x => x.trim()).filter(Boolean))[0]));
  }
  return out;
}`;

const JS_TITULO_ABERTO = String.raw`() => {
  const h = document.querySelector('#main header'); if (!h) return '';
  const t = h.querySelector('[title]');
  if (t && (t.getAttribute('title') || '').trim()) return t.getAttribute('title').trim();
  return ((h.innerText || '').split('\n').map(x => x.trim()).filter(Boolean))[0] || '';
}`;

// Acha a conversa pelo título OU pelo texto exato e clica nela de verdade (.click() dispara o
// evento no próprio elemento e deixa borbulhar -- funciona tanto com onclick direto quanto com
// um listener delegado mais acima, como o WhatsApp Web real costuma usar).
const JS_CLICAR_CONVERSA = String.raw`(nome) => {
  let alvo = [...document.querySelectorAll('#pane-side [title]')].find(e => (e.getAttribute('title') || '').trim() === nome);
  if (!alvo) alvo = [...document.querySelectorAll('#pane-side span, #pane-side div[dir="auto"]')].find(e => (e.innerText || '').trim() === nome);
  if (!alvo) return false;
  alvo.click();
  return true;
}`;

// Visualizador de fotos em tela cheia (álbum com "+N"): maior imagem blob FORA do #main
const JS_VISUALIZADOR = String.raw`() => {
  let melhor = null, area = 0;
  for (const i of document.querySelectorAll('img')) {
    if (!i.src.startsWith('blob:') || i.closest('#main') || i.closest('#pane-side')) continue;
    const r = i.getBoundingClientRect(); const a = r.width * r.height;
    if (a > area) { area = a; melhor = i; }
  }
  return melhor ? melhor.src : '';
}`;

function compactar(texto) {
  const semAcento = (texto || "").normalize("NFKD").replace(/[̀-ͯ]/g, "");
  return semAcento.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function esperar(ms) { return new Promise((r) => setTimeout(r, ms)); }

const RE_PRE_DATA = /^\[(\d{1,2}:\d{2})(?::\d{2})?(?:\s?[AP]M)?,\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\]/;

/** Só a data de '[18:42, 06/11/2026] Nome: ' (mesma regra de src/apps/monitor/mensagem.ts). */
function diaDoPre(pre) {
  const m = RE_PRE_DATA.exec(pre || "");
  if (!m) return null;
  const dd = Number(m[2]), mm = Number(m[3]), yyyy = Number(m[4]);
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  return new Date(yyyy, mm - 1, dd);
}

class Navegador {
  constructor({ partition = "persist:monitor-whatsapp", url = URL_WHATSAPP, show = false } = {}) {
    this.partition = partition;
    this.url = url;
    this.show = show;
    this.win = null;
  }

  async iniciar() {
    this.win = new BrowserWindow({
      width: 1280, height: 900, show: this.show,
      webPreferences: { partition: this.partition, contextIsolation: true, sandbox: true },
    });
    this.win.webContents.setUserAgent(USER_AGENT);
    await this.win.loadURL(this.url);
  }

  fechar() {
    if (this.win && !this.win.isDestroyed()) this.win.destroy();
    this.win = null;
  }

  vivo() {
    return !!this.win && !this.win.isDestroyed();
  }

  async exec(expr, timeoutMs = 10000) {
    if (!this.vivo()) throw new Error("janela do WhatsApp fechada");
    return Promise.race([
      this.win.webContents.executeJavaScript(expr, true),
      new Promise((_, rej) => setTimeout(() => rej(new Error("tempo esgotado")), timeoutMs)),
    ]);
  }

  async logado() {
    try { return await this.exec(`document.querySelectorAll('#pane-side').length > 0`); } catch { return false; }
  }

  async conversas() {
    try { return await this.exec(`(${JS_CONVERSAS})()`); } catch { return []; }
  }

  async tituloAberto() {
    try { return await this.exec(`(${JS_TITULO_ABERTO})()`); } catch { return ""; }
  }

  static mesmoNome(a, b) {
    return !!compactar(a) && compactar(a) === compactar(b);
  }

  async tituloEquivalente(nome) {
    try {
      for (const t of await this.conversas()) if (Navegador.mesmoNome(t, nome)) return t;
    } catch { /* ok */ }
    return null;
  }

  async clicar(titulo) {
    try { return !!(await this.exec(`(${JS_CLICAR_CONVERSA})(${JSON.stringify(titulo)})`)); } catch { return false; }
  }

  /** Abre o grupo pela lista lateral (ou pela busca). Só clica; não digita mensagem.
   * O nome vale igual ao do WhatsApp OU sem emojis, acentos e maiúsculas. */
  async abrirConversa(nome) {
    if (Navegador.mesmoNome(await this.tituloAberto(), nome)) return true;
    const real = await this.tituloEquivalente(nome);
    let clicou = false;
    if (real !== null) clicou = await this.clicar(real);
    if (!clicou && !(await this.abrirPelaBusca(nome))) return false;
    const fim = Date.now() + 5000;
    while (Date.now() < fim) {
      if (Navegador.mesmoNome(await this.tituloAberto(), nome)) {
        await esperar(500);
        return true;
      }
      await esperar(200);
    }
    return false;
  }

  async abrirPelaBusca(nome) {
    try {
      const achouCaixa = await this.exec(`(() => {
        for (const sel of ['#side div[contenteditable="true"]', 'div[contenteditable="true"][data-tab="3"]',
                            'div[role="textbox"][contenteditable="true"]:not(#main *)', 'input[type="text"]']) {
          const el = document.querySelector(sel);
          if (el) { el.focus(); return true; }
        }
        return false;
      })()`);
      if (!achouCaixa) return false;
      // digita via eventos de teclado de verdade (campo controlado do WhatsApp real escuta isso)
      for (const ch of nome) {
        this.win.webContents.sendInputEvent({ type: "char", keyCode: ch });
        await esperar(15);
      }
      await esperar(1500);
      const real = await this.tituloEquivalente(nome);
      return real !== null && (await this.clicar(real));
    } catch {
      return false;
    } finally {
      try { this.win.webContents.sendInputEvent({ type: "keyDown", keyCode: "Escape" }); } catch { /* ok */ }
    }
  }

  async ler() {
    const d = await this.exec(`(${JS_LER})()`);
    const msgs = (d?.msgs || []).map((x) => ({ ...x }));
    return { titulo: d?.titulo || "", msgsBrutas: msgs };
  }

  /** Sobe a conversa até aparecer uma mensagem de antes de hoje (ou não carregar mais nada). */
  async rolarParaOInicioDoDia(hoje, maxVoltas = 60) {
    let parados = 0, ultimo = -1;
    for (let volta = 0; volta < maxVoltas; volta++) {
      const r = await this.exec(`(${JS_ROLAR_TOPO})()`);
      await esperar(900);
      const dia = diaDoPre(r?.pre);
      if (dia && dia.getTime() < hoje.getTime()) return volta + 1;
      if (!r?.rolavel) return volta + 1;
      const n = await this.exec(`document.querySelectorAll('#main div[data-id]').length`);
      parados = n === ultimo ? parados + 1 : 0;
      ultimo = n;
      if (parados >= 2) return volta + 1;
    }
    return maxVoltas;
  }

  async aguardar(ms) { await esperar(ms); }

  async rolarUmPasso() {
    const ok = !!(await this.exec(`(${JS_ROLAR_PASSO})()`));
    await esperar(900);
    return ok;
  }

  async rolarParaOFim() {
    await this.exec(`(${JS_ROLAR_FIM})()`);
    await esperar(400);
  }

  async baixar(urls) {
    if (!urls || !urls.length) return [];
    const saida = await this.exec(`(${JS_BAIXAR})(${JSON.stringify(urls)})`);
    return (saida || []).filter(Boolean).map((s) => Buffer.from(s, "base64"));
  }

  async baixarAlbumCompleto(msg, esperado) {
    const fotos = [];
    try {
      const clicouPrimeira = await this.exec(
        `(() => { const el = document.querySelector('div[data-id=${JSON.stringify(msg.id)}] img[src^="blob:"]'); if (el) { el.click(); return true; } return false; })()`,
      );
      if (!clicouPrimeira) return fotos;
      await esperar(900);
      const vistos = new Set();
      let repetidas = 0;
      for (let i = 0; i < esperado + 2; i++) {
        const src = await this.exec(`(${JS_VISUALIZADOR})()`);
        if (src && !vistos.has(src)) {
          vistos.add(src);
          fotos.push(...(await this.baixar([src])));
          repetidas = 0;
        } else {
          repetidas++;
        }
        if (fotos.length >= esperado || repetidas >= 2) break;
        try { this.win.webContents.sendInputEvent({ type: "keyDown", keyCode: "Right" }); } catch { /* ok */ }
        await esperar(500);
      }
    } catch { /* melhor esforço: devolve o que conseguiu */ } finally {
      try { this.win.webContents.sendInputEvent({ type: "keyDown", keyCode: "Escape" }); } catch { /* ok */ }
      await esperar(300);
    }
    return fotos;
  }

  async resumoConversas(limite = 8) {
    let nomes;
    try { nomes = await this.conversas(); } catch { return "não consegui ler a lista de conversas"; }
    if (!nomes.length) return "a lista de conversas aparece VAZIA para o programa";
    const extra = nomes.length > limite ? ` (+${nomes.length - limite} outras)` : "";
    return "vejo " + nomes.slice(0, limite).join(", ") + extra;
  }
}

module.exports = { Navegador, URL_WHATSAPP };
