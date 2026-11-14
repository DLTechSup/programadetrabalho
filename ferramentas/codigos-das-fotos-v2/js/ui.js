// Utilitários de interface: HTML seguro, ícones, avisos, diálogos, gaveta, som e animações.

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

class Bruto { constructor(s) { this.s = s; } toString() { return this.s; } }
export const raw = (s) => new Bruto(s);

// Template seguro: tudo é escapado, exceto valores criados por html``/raw()
export function html(partes, ...valores) {
  let s = partes[0];
  valores.forEach((v, i) => {
    if (Array.isArray(v)) s += v.map((x) => (x instanceof Bruto ? x.s : esc(x))).join('');
    else if (v instanceof Bruto) s += v.s;
    else if (v !== false && v !== null && v !== undefined) s += esc(v);
    s += partes[i + 1];
  });
  return new Bruto(s);
}

const P = {
  painel: '<path d="M3 13h8V3H3zM13 21h8V11h-8zM3 21h8v-6H3zM13 3v6h8V3z"/>',
  mais: '<path d="M12 5v14M5 12h14"/>',
  caixa: '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5M12 13v8"/>',
  relogio: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  alerta: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
  feito: '<path d="M20 6 9 17l-5-5"/>',
  arquivo: '<path d="M3 4h18v4H3zM5 8v12h14V8M10 12h4"/>',
  equipe: '<circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0M16 3.1a4 4 0 0 1 0 7.8M22 21a7 7 0 0 0-4-6.3"/>',
  busca: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  sair: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  lua: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  sol: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  foto: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>',
  enviar: '<path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/>',
  imprimir: '<path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
  voltar: '<path d="m15 18-6-6 6-6"/>',
  seta: '<path d="m9 18 6-6-6-6"/>',
  loja: '<path d="M3 9 4.5 4h15L21 9M3 9v11h18V9M3 9h18M9 20v-6h6v6"/>',
  restaurar: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
  sino: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0"/>',
  escudo: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  copiar: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  baixar: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  lista: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  ajuda: '<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01"/>',
  caminhao: '<path d="M1 3h15v13H1zM16 8h4l3 3v5h-7"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>',
  festa: '<path d="M5.8 11.3 2 22l10.7-3.8M4 3h.01M22 8h.01M15 2h.01M22 20h.01M22 2l-2.2.7a1.9 1.9 0 0 0-1.3 2 1.9 1.9 0 0 1-1.3 2l-2.2.7M9.6 14.4 2 22"/><path d="m9 15 3-3 1.5 4.5L9 15z"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
};
export const icone = (n, rot) =>
  raw(`<svg class="i" viewBox="0 0 24 24" ${rot ? `role="img" aria-label="${esc(rot)}"` : 'aria-hidden="true"'}>${P[n] || ''}</svg>`);

// Logo da loja nas versões para fundo claro e escuro (o CSS mostra a certa)
export const logo = (classe = '') => raw(`<span class="logo-loja ${classe}"><img class="l-claro" src="img/logo.png" alt="Calçados 24h"><img class="l-escuro" src="img/logo-escuro.png" alt="" aria-hidden="true"></span>`);

export const iniciais = (s) => (s || '?').trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase();

export function tempo(iso) {
  if (!iso) return '—';
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'agora';
  if (s < 3600) return `há ${Math.floor(s / 60)} min`;
  if (s < 86400) return `há ${Math.floor(s / 3600)} h`;
  if (s < 86400 * 7) return `há ${Math.floor(s / 86400)} d`;
  return new Date(iso).toLocaleDateString('pt-BR');
}
export const dataBR = (iso) => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '—');

// ---------- Avisos ----------
let pilha;
export function aviso(titulo, texto = '', tipo = 'ok', ms = 4500) {
  pilha ||= Object.assign(document.body.appendChild(document.createElement('div')), { className: 'avisos' });
  pilha.setAttribute('role', 'status');
  pilha.setAttribute('aria-live', 'polite');
  const el = document.createElement('div');
  el.className = 'aviso' + (tipo === 'erro' ? ' erro' : '');
  el.innerHTML = String(html`<span class="ico-aviso">${icone(tipo === 'erro' ? 'alerta' : tipo === 'sino' ? 'sino' : 'feito')}</span>
    <div><b>${titulo}</b>${texto}</div><button aria-label="Fechar aviso">${icone('x')}</button>`);
  const fechar = () => el.animate([{ opacity: 1 }, { opacity: 0, translate: '12px 0' }], { duration: 180 }).finished.then(() => el.remove());
  el.querySelector('button').onclick = fechar;
  pilha.append(el);
  setTimeout(fechar, ms);
}
export const erro = (e) => aviso('Não deu certo', e?.message || String(e), 'erro', 7000);

// ---------- Camadas (gaveta / diálogo) com foco preso e Esc ----------
export function camada(conteudoHTML, classe) {
  const anterior = document.activeElement;
  const veu = Object.assign(document.createElement('div'), { className: 'veu' });
  const caixa = document.createElement('div');
  caixa.className = classe;
  caixa.setAttribute('role', 'dialog');
  caixa.setAttribute('aria-modal', 'true');
  caixa.innerHTML = String(conteudoHTML);
  document.body.append(veu, caixa);
  const fechar = () => {
    veu.remove(); caixa.remove(); document.removeEventListener('keydown', tecla); anterior?.focus?.();
  };
  const tecla = (e) => {
    if (e.key === 'Escape') fechar();
    if (e.key === 'Tab') {
      const f = [...caixa.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter((x) => !x.disabled);
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f.at(-1).focus(); }
      else if (!e.shiftKey && document.activeElement === f.at(-1)) { e.preventDefault(); f[0].focus(); }
    }
  };
  document.addEventListener('keydown', tecla);
  veu.onclick = fechar;
  caixa.querySelectorAll('[data-fechar]').forEach((b) => (b.onclick = fechar));
  requestAnimationFrame(() => (caixa.querySelector('[autofocus]') || caixa.querySelector('input, select, textarea, button'))?.focus());
  return { caixa, fechar };
}
export const gaveta = (conteudo) => camada(conteudo, 'gaveta');

export function confirmar(titulo, texto, botao = 'Confirmar') {
  return new Promise((ok) => {
    const { caixa, fechar } = camada(html`<h2>${titulo}</h2><p>${texto}</p>
      <div class="linha-flex"><button class="btn" data-n>Cancelar</button><button class="btn pri" data-s autofocus>${botao}</button></div>`, 'dialogo');
    caixa.querySelector('[data-n]').onclick = () => { fechar(); ok(false); };
    caixa.querySelector('[data-s]').onclick = () => { fechar(); ok(true); };
  });
}

// Visualizador de fotos: clique fora, X ou Esc fecha; setas trocam a foto
export function ampliar(fotos, inicio = 0, legenda = '') {
  const lista = (Array.isArray(fotos) ? fotos : [fotos]).filter(Boolean);
  if (!lista.length) return;
  let n = Math.max(0, lista.indexOf(inicio) >= 0 ? lista.indexOf(inicio) : inicio | 0);
  const anterior = document.activeElement;
  const z = Object.assign(document.createElement('div'), { className: 'zoom', tabIndex: -1 });
  z.setAttribute('role', 'dialog'); z.setAttribute('aria-modal', 'true'); z.setAttribute('aria-label', 'Foto ampliada');
  const varias = lista.length > 1;
  z.innerHTML = String(html`<figure>
      <img alt="${legenda || 'Foto ampliada'}">
      <figcaption><span>${legenda}</span>${varias ? html`<span class="mono" data-pos></span>` : ''}</figcaption>
    </figure>
    <button class="zoom-btn zoom-x" aria-label="Fechar">${icone('x')}</button>
    ${varias ? html`<button class="zoom-btn zoom-ant" aria-label="Foto anterior">${icone('voltar')}</button><button class="zoom-btn zoom-prox" aria-label="Próxima foto">${icone('seta')}</button>` : ''}`);
  const img = z.querySelector('img');
  const mostrar = () => {
    img.src = lista[n];
    const pos = z.querySelector('[data-pos]'); if (pos) pos.textContent = `${n + 1} / ${lista.length}`;
    if (!semMovimento()) img.animate([{ opacity: 0, scale: 0.97 }, { opacity: 1, scale: 1 }], { duration: 220, easing: 'cubic-bezier(.22,1,.36,1)' });
  };
  const ir = (d) => { n = (n + d + lista.length) % lista.length; mostrar(); };
  const fechar = () => { z.remove(); document.removeEventListener('keydown', k); anterior?.focus?.({ preventScroll: true }); };
  const k = (e) => {
    if (e.key === 'Escape') fechar();
    if (varias && e.key === 'ArrowRight') ir(1);
    if (varias && e.key === 'ArrowLeft') ir(-1);
  };
  z.onclick = (e) => {
    if (e.target.closest('.zoom-prox')) return ir(1);
    if (e.target.closest('.zoom-ant')) return ir(-1);
    if (e.target === z || e.target.closest('.zoom-x')) fechar();
  };
  // Arrastar para o lado no celular
  let x0 = null;
  z.addEventListener('touchstart', (e) => (x0 = e.touches[0].clientX), { passive: true });
  z.addEventListener('touchend', (e) => { if (varias && x0 !== null) { const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 50) ir(dx < 0 ? 1 : -1); } x0 = null; });
  document.addEventListener('keydown', k);
  document.body.append(z);
  mostrar();
  z.querySelector('.zoom-x').focus();
}

// ---------- Botão ocupado ----------
export async function ocupado(botao, fn) {
  const antes = botao.innerHTML;
  botao.disabled = true;
  botao.innerHTML = '<span class="giro" aria-hidden="true"></span> Salvando…';
  try { return await fn(); } finally { if (botao.isConnected) { botao.disabled = false; botao.innerHTML = antes; } }
}

// ---------- Motion ----------
export const semMovimento = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export function contar(el, ate, ms = 700) {
  if (semMovimento()) { el.textContent = ate; return; }
  const ini = performance.now();
  const passo = (t) => {
    const p = Math.min(1, (t - ini) / ms);
    el.textContent = Math.round(ate * (1 - Math.pow(1 - p, 3)));
    if (p < 1) requestAnimationFrame(passo);
  };
  requestAnimationFrame(passo);
}

export function recolher(el) {
  if (!el || semMovimento()) { el?.remove(); return Promise.resolve(); }
  el.classList.add('saindo');
  return new Promise((ok) => setTimeout(() => { el.remove(); ok(); }, 520));
}

// Som curto de notificação (sem arquivo de áudio)
export function bip() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    const t = ctx.currentTime;
    o.frequency.setValueAtTime(660, t); o.frequency.setValueAtTime(880, t + 0.09);
    g.gain.setValueAtTime(0.08, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    o.start(t); o.stop(t + 0.3);
  } catch { /* navegador bloqueou o áudio */ }
}

export function imprimir(conteudo) {
  let alvo = document.getElementById('impressao');
  if (!alvo) { alvo = Object.assign(document.createElement('div'), { id: 'impressao' }); document.body.append(alvo); }
  alvo.innerHTML = String(conteudo);
  window.print();
}
