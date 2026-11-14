// Núcleo: dados, tempo real, rotas, moldura do escritório e do painel
import * as R from './regras.js';
import { html, raw, icone, logo, aviso, erro, bip, ampliar } from './ui.js';
import { abrirEditor } from './componentes.js';
import { mostrarCodigo } from './chegadas.js';
import { NOME_PUBLICO } from './config.js';
import escritorio from './views/escritorio.js';
import login from './views/login.js';
import visao from './views/visao.js';
import novo from './views/novo.js';
import listas from './views/listas.js';
import historico from './views/historico.js';
import acessos from './views/acessos.js';

const DEMO = new URLSearchParams(location.search).has('demo');
const banco = DEMO ? (await import('./demo.js')).criarBancoDemo() : (await import('./db.js')).criarBanco();

const ESC = [
  { id: 'esc', titulo: 'Esperando código', tela: escritorio.esperando, conta: R.esperandoEsc },
  { id: 'esc-pendencias', titulo: 'Pendências de fotos', tela: escritorio.pendencias, conta: R.alertaFoto, alerta: true },
  { id: 'esc-no-site', titulo: 'Já no site', tela: escritorio.noSite },
];
const ADM = [
  { id: 'painel', titulo: 'Visão geral', icone: 'painel', tela: visao },
  { id: 'novo', titulo: 'Novo produto', icone: 'mais', tela: novo, conta: R.rascunho, dica: 'em rascunho' },
  { grupo: 'Fluxo' },
  { id: 'esperando', titulo: 'Esperando código', icone: 'relogio', tela: listas.esperando, conta: R.aguardando },
  { id: 'recebidos', titulo: 'Códigos recebidos', icone: 'sino', tela: listas.recebidos, conta: R.recebido, novos: true },
  { id: 'pendencias', titulo: 'Pendências de fotos', icone: 'alerta', tela: listas.pendencias, conta: R.pendencia },
  { id: 'atacado', titulo: 'Falta Atacado', icone: 'caminhao', tela: listas.atacado, conta: R.lembrete },
  { id: 'historico', titulo: 'Histórico', icone: 'feito', tela: historico },
  { grupo: 'Gestão' },
  { id: 'arquivados', titulo: 'Arquivados', icone: 'arquivo', tela: listas.arquivados },
  { id: 'acessos', titulo: 'Acessos e backup', icone: 'equipe', tela: acessos },
];
const IDS_ADM = new Set(['entrar', ...ADM.filter((r) => r.id).map((r) => r.id)]);

const est = { itens: new Map(), fins: [], sessao: null, carregado: false, erro: null, aoVivo: false, menu: false, online: navigator.onLine };
let raiz, segurar = 0, adiado = false, hashAnterior = null;
const destacar = new Set();

const idRota = () => location.hash.replace(/^#\/?/, '').split('/')[0];
const noPainel = () => IDS_ADM.has(idRota());
const lista = () => [...est.itens.values()];

function rotaAtual() {
  const [id, ...resto] = location.hash.replace(/^#\/?/, '').split('/');
  const rs = (noPainel() ? ADM : ESC).filter((r) => r.id);
  return { ...(rs.find((r) => r.id === id) || rs[0]), params: resto.map(decodeURIComponent) };
}

// ---------- Contexto entregue às telas ----------
const ctx = {
  get itens() { return lista(); },
  get fins() { return est.fins; },
  get perfil() { return est.sessao?.perfil; },
  demo: DEMO,
  banco,
  item: (id) => est.itens.get(id),
  async alterar(id, mudancas) { const d = await banco.alterar(id, mudancas); est.itens.set(d.id, d); pedirRender(); return d; },
  async alterarVarios(ids, f) { for (const id of ids) { const d = await banco.alterar(id, f(est.itens.get(id))); est.itens.set(d.id, d); } pedirRender(); },
  async inserir(docs) { await banco.inserir(docs); docs.forEach((d) => est.itens.set(d.id, d)); pedirRender(); },
  async marcarFim() { const em = await banco.marcarFim(); if (!est.fins.includes(em)) est.fins.push(em); return em; },
  async enviarFoto(arquivo) {
    const blob = DEMO ? arquivo : await (await import('./db.js')).comprimir(arquivo);
    return banco.enviarFoto(blob);
  },
  abrirItem(id) { const d = est.itens.get(id); if (d) abrirEditor(d, ctx); },
  async segurando(fn) { segurar++; try { return await fn(); } finally { segurar--; pedirRender(); } },
  render: () => pedirRender(),
};

// ---------- Tempo real: avisos com som ----------
// Aviso do sistema (aparece mesmo com o navegador minimizado, se os avisos estiverem ativados)
function notificar(msg, titulo = 'Calçados 24h', fixo = false) {
  try {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const n = new Notification(titulo, { body: msg, tag: 'codigos-fotos-' + Date.now(), requireInteraction: fixo, icon: 'img/logo.png' });
    n.onclick = () => { window.focus(); n.close(); };
  } catch { /* ok */ }
}
let naoVistos = 0;
const tituloBase = () => (noPainel() ? 'Meu painel — Códigos das Fotos' : 'Códigos das Fotos');
function aoItem(d, idRemovido) {
  if (!d) { est.itens.delete(idRemovido); return pedirRender(); }
  const antes = est.itens.get(d.id);
  est.itens.set(d.id, d);
  if (noPainel() && est.sessao && d.status === 'respondido' && antes?.status !== 'respondido') {
    mostrarCodigo(d, { abrir: (id) => ctx.abrirItem(id) });
    bip();
    notificar(`${d.marca} ${d.ref} → código ${d.codigo}`, 'Código recebido', true);
    if (document.hidden || !document.hasFocus()) { naoVistos++; document.title = `● (${naoVistos}) ${naoVistos === 1 ? 'código novo' : 'códigos novos'} — Códigos das Fotos`; }
  } else if (!noPainel()) {
    if (d.status === 'pendente' && antes?.status !== 'pendente' && !R.pendFoto(d)) { aviso('Novo produto esperando código', `${d.marca} ${d.ref}`, 'sino'); bip(); notificar('Novo produto esperando código'); }
    else if (d.status === 'feito' && antes && antes.status !== 'feito') { aviso('Já está no site', `${d.marca} ${d.ref}`, 'sino'); }
  }
  pedirRender(d.id);
}

// ---------- Renderização ----------
function pedirRender(id) {
  if (id) destacar.add(id);
  const f = document.activeElement;
  const digitando = f?.matches?.('input, textarea, select') && document.getElementById('conteudo')?.contains(f) && f.value;
  if (segurar > 0 || digitando || document.querySelector('.gaveta, .dialogo, .zoom')) {
    if (!adiado) {
      adiado = true;
      const de_novo = () => { adiado = false; pedirRender(); };
      if (digitando) f.addEventListener('blur', de_novo, { once: true }); else setTimeout(de_novo, 600);
    }
    return;
  }
  render();
}

const escuro = () => document.documentElement.dataset.theme === 'dark' || (!document.documentElement.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);
const aoVivo = () => html`<span class="ao-vivo ${est.aoVivo ? 'on' : ''}" title="${est.aoVivo ? 'Atualiza sozinho' : 'Reconectando…'}"><i></i><span class="txt">${est.aoVivo ? 'Ao vivo' : 'Offline'}</span></span>`;
const offline = () => (est.online ? '' : html`<div class="faixa-offline" role="alert">Sem internet — o que você fizer agora pode não ser salvo até a conexão voltar.</div>`);
const demoFaixa = () => (DEMO ? html`<div class="demo-faixa">Modo demonstração · dados fictícios, o banco real não é usado</div>` : '');

function molduraEsc(rota, corpo) {
  const l = lista();
  const abas = ESC.map((r) => {
    const n = r.conta ? l.filter(r.conta).length : null;
    return html`<a href="#/${r.id}" ${r.id === rota.id ? raw('aria-current="page"') : ''}>${r.titulo}${n !== null ? html`<span class="n ${r.alerta && n ? 'alerta' : ''}">${n}</span>` : ''}</a>`;
  });
  const podeAvisar = 'Notification' in window && Notification.permission === 'default';
  return html`<div class="loja-app">${demoFaixa()}${offline()}
    <header class="loja-topo">
      <a class="marca-app" href="#/esc" style="padding:0;text-decoration:none">${logo()}<small class="marca-sub">Códigos das fotos · ${NOME_PUBLICO}</small></a>
      <nav class="loja-abas" aria-label="Seções">${abas}</nav>
      <div class="linha-flex loja-acoes">
        ${aoVivo()}
        ${podeAvisar ? html`<button class="btn fant peq" data-avisos title="Receber aviso quando chegar produto novo">${icone('sino')}<span class="txt">Ativar avisos</span></button>` : ''}
        <button class="btn fant ico" data-tema aria-label="Alternar tema">${icone(escuro() ? 'sol' : 'lua')}</button>
        <a class="btn peq" href="#/${est.sessao ? 'painel' : 'entrar'}">${icone('escudo')}<span class="txt">Meu painel</span></a>
      </div>
    </header>
    <main class="conteudo loja-conteudo" id="conteudo">${corpo}</main></div>`;
}

function molduraAdm(rota, corpo) {
  const l = lista(), p = est.sessao.perfil;
  const nav = ADM.map((r) => {
    if (r.grupo) return html`<div class="nav-grupo">${r.grupo}</div>`;
    const its = r.conta ? l.filter(r.conta) : [];
    const n = its.length, novos = r.novos ? its.filter((i) => !i.visto).length : 0;
    return html`<a href="#/${r.id}" ${r.id === rota.id ? raw('aria-current="page"') : ''}>${icone(r.icone)}${r.titulo}
      ${n ? html`<span class="n ${novos ? 'alerta' : ''}" title="${novos ? `${novos} códigos novos para ver` : r.dica || ''}">${novos || n}</span>` : ''}</a>`;
  });
  return html`<div class="app ${est.menu ? 'menu-aberto' : ''}">
    <aside class="side" aria-label="Menu do painel">
      <div class="marca-app" style="flex-direction:column;align-items:flex-start;gap:4px">${logo()}<small class="marca-sub">Códigos das fotos · Meu painel</small></div>
      <nav class="nav">${nav}</nav>
      <div class="side-rodape">
        <div class="usuario"><span class="avatar" aria-hidden="true">${(p.usuario || '?')[0].toUpperCase()}</span><div><b>${p.usuario}</b><small>Administrador</small></div></div>
        <div class="linha-flex"><button class="btn fant peq" data-tema>${icone(escuro() ? 'sol' : 'lua')} ${escuro() ? 'Claro' : 'Escuro'}</button><button class="btn fant peq" data-sair>${icone('sair')} Sair</button></div>
        <a class="btn fant peq" href="#/esc" style="justify-content:flex-start">${icone('loja')} Ver página do ${NOME_PUBLICO.toLowerCase()}</a>
      </div>
    </aside>
    <main class="main">${demoFaixa()}${offline()}
      <header class="topo"><button class="btn fant ico menu-btn" data-menu aria-label="Abrir menu" aria-expanded="${est.menu}">${icone('menu')}</button>
        <h1>${rota.tela.titulo?.(ctx) || rota.titulo}</h1><span class="espaco"></span>
        ${'Notification' in window && Notification.permission === 'default' ? html`<button class="btn peq" data-avisos title="Receber aviso do sistema quando chegar código, mesmo com o navegador minimizado">${icone('sino')}<span class="txt">Ativar avisos</span></button>` : ''}
        ${'Notification' in window && Notification.permission === 'denied' ? html`<span class="muted aviso-bloq" style="font-size:12px" title="Libere as notificações deste site nas configurações do navegador">Avisos do sistema bloqueados</span>` : ''}
        ${aoVivo()}</header>
      <div class="conteudo" id="conteudo">${corpo}</div>
    </main></div>`;
}

function render() {
  const rota = rotaAtual();
  if (noPainel() && !est.sessao) {
    if (idRota() !== 'entrar') return location.replace('#/entrar');
    hashAnterior = location.hash;
    raiz.innerHTML = String(login.render(ctx));
    login.montar(raiz, ctx, entrar);
    return;
  }
  if (idRota() === 'entrar') return location.replace('#/painel');
  const corpo = est.erro
    ? html`<div class="painel vazio">${icone('alerta')}<h3>Não foi possível carregar</h3><p>${est.erro}</p><p style="margin-top:12px"><button class="btn" data-recarregar>Tentar de novo</button></p></div>`
    : est.carregado ? rota.tela.render(ctx, rota.params) : html`<div aria-busy="true">${[1, 2, 3].map(() => raw('<div class="esqueleto" style="height:140px"></div>'))}</div>`;
  const trocou = hashAnterior !== location.hash;
  const pintar = () => {
    const y = scrollY, f = document.activeElement;
    const foco = f?.name && f.closest('[data-id]') ? [f.closest('[data-id]').dataset.id, f.name] : null;
    raiz.innerHTML = String(noPainel() ? molduraAdm(rota, corpo) : molduraEsc(rota, corpo));
    if (trocou) scrollTo(0, 0); else { scrollTo(0, y); raiz.querySelectorAll('.cascata').forEach((c) => c.classList.remove('cascata')); }
    if (foco) raiz.querySelector(`[data-id="${CSS.escape(foco[0])}"] [name="${foco[1]}"]`)?.focus({ preventScroll: true });
    destacar.forEach((id) => raiz.querySelectorAll(`[data-id="${CSS.escape(id)}"]`).forEach((el) => el.classList.add('chegou')));
    destacar.clear();
    ligarMoldura();
    if (est.carregado && !est.erro) rota.tela.montar?.(raiz.querySelector('#conteudo'), ctx, rota.params);
    atualizarTitulo();
  };
  if (trocou && hashAnterior !== null && document.startViewTransition) document.startViewTransition(pintar); else pintar();
  hashAnterior = location.hash;
}

function atualizarTitulo() {
  if (noPainel()) return;
  const n = lista().filter(R.esperandoEsc).length;
  document.title = n ? `(${n}) Códigos das Fotos` : 'Códigos das Fotos';
  try { if (navigator.setAppBadge) (n ? navigator.setAppBadge(n) : navigator.clearAppBadge()).catch(() => {}); } catch { /* ok */ }
}

function ligarMoldura() {
  raiz.querySelectorAll('[data-tema]').forEach((b) => (b.onclick = () => {
    document.documentElement.dataset.theme = escuro() ? 'light' : 'dark';
    try { localStorage.setItem('cf2-tema', document.documentElement.dataset.theme); } catch { /* ok */ }
    render();
  }));
  raiz.querySelector('[data-recarregar]')?.addEventListener('click', carregar);
  raiz.querySelector('[data-avisos]')?.addEventListener('click', async () => {
    const p = await Notification.requestPermission();
    if (p === 'granted') notificar(noPainel() ? 'Avisos ativados. Você será avisado quando chegar código.' : 'Avisos ativados. Você será avisado quando chegar produto novo.');
    render();
  });
  if (!noPainel()) return;
  raiz.querySelector('[data-sair]').onclick = async () => { await banco.sair(); est.sessao = null; location.hash = '#/esc'; };
  raiz.querySelector('[data-menu]').onclick = () => { est.menu = !est.menu; render(); };
  raiz.querySelector('.app').addEventListener('click', (e) => {
    if (!est.menu) return;
    if (e.target === e.currentTarget) { est.menu = false; render(); } else if (e.target.closest('.nav a')) est.menu = false;
  });
}

// ---------- Cliques globais: abrir produto, ver fotos, copiar código ----------
function ligarGlobais() {
  document.addEventListener('click', async (e) => {
    const ver = e.target.closest('[data-ver-fotos]');
    if (ver) {
      e.stopPropagation();
      const d = est.itens.get(ver.dataset.verFotos);
      if (d) ampliar(R.fotos(d), Number(ver.dataset.pos || 0), `${d.marca} · ${d.ref}${d.codigo ? ' · código ' + d.codigo : ''}`);
      return;
    }
    const cop = e.target.closest('[data-copiar]');
    if (cop) {
      e.stopPropagation();
      const t = cop.dataset.copiar;
      try { await navigator.clipboard.writeText(t); } catch {
        const a = Object.assign(document.createElement('textarea'), { value: t }); document.body.append(a); a.select(); document.execCommand('copy'); a.remove();
      }
      cop.classList.remove('copiado'); void cop.offsetWidth; cop.classList.add('copiado');
      aviso('Código copiado', t);
      const id = cop.dataset.visto, d = id && est.itens.get(id);
      if (d && !d.visto && est.sessao) ctx.alterar(id, R.mudar.visto()).catch(() => {});
      return;
    }
    const ab = e.target.closest('[data-abrir]');
    if (ab && est.sessao && noPainel() && !e.target.closest('button, a, input, label, select, textarea')) ctx.abrirItem(ab.dataset.abrir);
  }, true);
  document.addEventListener('keydown', (e) => {
    const ab = e.target.closest?.('[data-abrir]');
    if (e.key === 'Enter' && ab && e.target === ab && est.sessao) ctx.abrirItem(ab.dataset.abrir);
  });
}

// ---------- Carga e sessão ----------
async function carregar() {
  est.erro = null; est.carregado = false; render();
  try {
    const [docs, fins] = await Promise.all([banco.listar(), banco.fins()]);
    est.itens = new Map(docs.map((d) => [d.id, d]));
    est.fins = fins;
    est.carregado = true;
  } catch (e) { est.erro = e.message; }
  render();
}

function entrar(sessao) {
  est.sessao = sessao;
  location.hash = '#/painel';
}

async function iniciar() {
  try { const t = localStorage.getItem('cf2-tema'); if (t) document.documentElement.dataset.theme = t; } catch { /* ok */ }
  raiz = document.getElementById('app');
  ligarGlobais();
  addEventListener('hashchange', () => { est.menu = false; render(); });
  addEventListener('focus', () => { naoVistos = 0; document.title = tituloBase(); });
  addEventListener('online', () => { est.online = true; render(); });
  addEventListener('offline', () => { est.online = false; render(); });
  // Rede de segurança: se o tempo real cair, recarrega a cada 2 minutos
  setInterval(() => { if (!est.aoVivo && est.carregado) banco.listar().then((ds) => { est.itens = new Map(ds.map((d) => [d.id, d])); pedirRender(); }).catch(() => {}); }, 120000);
  // ?modo=painel abre direto o painel (compatível com o link antigo)
  const modo = new URLSearchParams(location.search).get('modo');
  if (!location.hash) location.replace(modo === 'painel' ? '#/painel' : '#/esc');
  try { est.sessao = await banco.sessao(); } catch (e) { erro(e); }
  banco.ouvir({
    aoItem, aoFim: (em) => { if (!est.fins.includes(em)) est.fins.push(em); pedirRender(); },
    aoStatus: (on) => { if (est.aoVivo !== on) { est.aoVivo = on; pedirRender(); } },
  });
  await carregar();
}

iniciar();
