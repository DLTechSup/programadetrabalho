// Aviso grande na tela quando chega um código: fica até você dispensar
import { html, icone, semMovimento } from './ui.js';
import { capa } from './regras.js';

let caixa;
const MAX = 4;

function container() {
  if (caixa?.isConnected) return caixa;
  caixa = document.createElement('div');
  caixa.className = 'chegadas';
  caixa.setAttribute('role', 'region');
  caixa.setAttribute('aria-label', 'Códigos recebidos agora');
  caixa.setAttribute('aria-live', 'assertive');
  document.body.append(caixa);
  return caixa;
}

function fechar(card) {
  if (!card.isConnected) return;
  if (semMovimento()) { card.remove(); atualizar(); return; }
  card.animate([{ opacity: 1, translate: '0 0' }, { opacity: 0, translate: '24px 0' }], { duration: 200, easing: 'ease-in' }).finished.then(() => { card.remove(); atualizar(); });
}

function atualizar() {
  const c = container(), cards = [...c.querySelectorAll('.chegada')];
  cards.forEach((k, i) => (k.hidden = i >= MAX));
  let resumo = c.querySelector('.chegadas-resumo');
  if (cards.length >= 2) {
    if (!resumo) { resumo = document.createElement('div'); resumo.className = 'chegadas-resumo'; c.prepend(resumo); }
    const extra = cards.length - MAX;
    resumo.innerHTML = String(html`<span>${cards.length} códigos recebidos${extra > 0 ? ` (+${extra} ocultos)` : ''}</span><button type="button" class="btn fant peq">Dispensar todos</button>`);
    resumo.querySelector('button').onclick = () => cards.forEach(fechar);
  } else resumo?.remove();
  if (!cards.length) c.remove();
}

export function mostrarCodigo(d, { abrir }) {
  const c = container();
  const card = document.createElement('article');
  card.className = 'chegada';
  card.dataset.id = d.id;
  const foto = capa(d);
  card.innerHTML = String(html`
    <header><span class="chegada-tit">${icone('sino')} Código recebido</span><time>${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</time>
      <button type="button" class="chegada-x" aria-label="Dispensar">${icone('x')}</button></header>
    <div class="chegada-corpo">
      ${foto ? html`<button type="button" class="chegada-foto" data-ver-fotos="${d.id}" aria-label="Ver foto"><img src="${foto}" alt=""></button>` : html`<span class="chegada-foto sem">${icone('foto')}</span>`}
      <div class="chegada-info">
        <span class="modelo-marca">${d.marca}</span>
        <b class="mono">${d.ref}</b>
        <button type="button" class="chegada-codigo" data-copiar="${d.codigo}" data-visto="${d.id}" title="Clique para copiar">${d.codigo}${icone('copiar')}</button>
        ${d.obs ? html`<small class="chegada-obs">Escritório: ${d.obs}</small>` : ''}
      </div>
    </div>
    <footer><button type="button" class="btn peq" data-abrir-cheg>Abrir produto</button><button type="button" class="btn pri peq" data-ok>Ok</button></footer>`);
  card.querySelector('.chegada-x').onclick = () => fechar(card);
  card.querySelector('[data-ok]').onclick = () => fechar(card);
  card.querySelector('[data-abrir-cheg]').onclick = () => { abrir(d.id); fechar(card); };
  // o mais novo fica em cima
  const resumo = c.querySelector('.chegadas-resumo');
  resumo ? resumo.after(card) : c.prepend(card);
  atualizar();
}

export const limparChegadas = () => caixa?.querySelectorAll('.chegada').forEach(fechar);
