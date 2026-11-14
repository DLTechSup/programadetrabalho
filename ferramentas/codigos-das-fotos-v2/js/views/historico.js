// Histórico em catálogo: foto, marca, referência e código de tudo que já foi para o site
import { html, raw, icone, aviso, erro, confirmar, imprimir } from '../ui.js';
import * as R from '../regras.js';
import { codigoCopiavel, vazio, relatorioCartoes } from '../componentes.js';

const f = { aba: 'hoje', marca: '', q: '', pagina: 40 };

function baixarFotos(i) {
  const fs = R.fotos(i);
  const nome = (k) => `${i.marca}_${i.ref}${fs.length > 1 ? '_' + (k + 1) : ''}.jpg`.replace(/[\\/:*?"<>|]/g, '_');
  fs.forEach((src, k) => {
    const baixa = (href) => { const a = Object.assign(document.createElement('a'), { href, download: nome(k) }); document.body.append(a); a.click(); a.remove(); };
    if (src.startsWith('data:')) return baixa(src);
    fetch(src).then((r) => r.blob()).then((b) => { const u = URL.createObjectURL(b); baixa(u); setTimeout(() => URL.revokeObjectURL(u), 4000); }).catch(() => window.open(src, '_blank', 'noopener'));
  });
  aviso(fs.length > 1 ? `Baixando ${fs.length} fotos` : 'Baixando foto');
}

function filtrar(ctx) {
  const hoje = R.diaKey(Date.now());
  return R.buscar(ctx.itens.filter(R.feito), f.q)
    .filter((i) => (f.aba !== 'hoje' || R.diaKey(i.feitoEm) === hoje) && (!f.marca || R.normMarca(i.marca) === f.marca))
    .sort((a, b) => b.feitoEm - a.feitoEm);
}

function grade(ctx) {
  const l = filtrar(ctx);
  if (!l.length) return vazio('feito', f.aba === 'hoje' ? 'Nada concluído hoje ainda' : 'Nada encontrado', f.aba === 'hoje' ? 'O que você marcar como feito hoje aparece aqui.' : 'Tente outra busca ou marca.');
  return html`<div class="catalogo cascata">${l.slice(0, f.pagina).map((i, n) => html`<article class="painel cat" style="--i:${n}" data-id="${i.id}">
      ${R.capa(i) ? html`<button type="button" class="cat-foto" data-ver-fotos="${i.id}" aria-label="Ver fotos"><img src="${R.capa(i)}" alt="" loading="lazy"></button>` : html`<span class="cat-foto sem">${icone('foto')}</span>`}
      <div class="cat-info">
        <span class="modelo-marca">${i.marca}</span><b class="mono">${i.ref}</b>
        ${codigoCopiavel(i.codigo)}
        <small class="muted">${R.hora(i.feitoEm)}</small>
        <div class="cat-flags"><span class="${i.enviadoSite ? 'on' : ''}">Site</span><span class="${i.enviadoAtacado ? 'on' : ''}">Atacado</span></div>
      </div>
      <div class="cat-acoes">
        ${R.fotos(i).length ? html`<button class="btn fant peq ico" data-baixar="${i.id}" title="Baixar fotos" aria-label="Baixar fotos">${icone('baixar')}</button>` : ''}
        <button class="btn fant peq ico" data-restaurar="${i.id}" title="Voltar para Códigos recebidos" aria-label="Voltar para Códigos recebidos">${icone('restaurar')}</button>
        <button class="btn fant peq ico" data-abrir-h="${i.id}" title="Detalhes" aria-label="Detalhes">${icone('seta')}</button>
      </div>
    </article>`)}</div>
    ${l.length > f.pagina ? html`<p style="text-align:center;margin-top:16px"><button class="btn" data-mais>Mostrar mais (${l.length - f.pagina})</button></p>` : ''}`;
}

export default {
  titulo: () => 'Histórico',
  render(ctx) {
    const todos = ctx.itens.filter(R.feito), hoje = R.diaKey(Date.now());
    const marcas = [...new Set(todos.map((i) => R.normMarca(i.marca)))].sort();
    const fins = [...ctx.fins].sort((a, b) => b - a).slice(0, 5);
    return html`
      ${fins.length ? html`<div class="fins">${icone('festa')}<span>O escritório marcou tudo preenchido:</span>${fins.map((t) => html`<span class="fim-chip">${R.diaKey(t) === hoje ? 'hoje' : new Date(t).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} às ${R.hm(t)}</span>`)}</div>` : ''}
      <div class="barra">
        <div class="abas" role="tablist">
          <button role="tab" data-aba="hoje" aria-selected="${f.aba === 'hoje'}">Feitos hoje<span class="n">${todos.filter((i) => R.diaKey(i.feitoEm) === hoje).length}</span></button>
          <button role="tab" data-aba="todos" aria-selected="${f.aba === 'todos'}">Todo o histórico<span class="n">${todos.length}</span></button>
        </div>
        <span class="espaco"></span>
        <select class="inp" id="h-marca" style="width:auto" aria-label="Filtrar por marca"><option value="">Todas as marcas</option>${marcas.map((m) => html`<option ${f.marca === m ? raw('selected') : ''}>${m}</option>`)}</select>
        <label class="busca">${icone('busca')}<span class="sr">Buscar</span><input class="inp" type="search" id="h-busca" value="${f.q}" placeholder="Buscar referência ou código"></label>
        <button class="btn" data-copiar-lista>${icone('copiar')} Copiar lista</button>
        <button class="btn" data-rel>${icone('imprimir')} Relatório</button>
      </div>
      <div id="h-grade">${grade(ctx)}</div>`;
  },
  montar(el, ctx) {
    const repintar = () => { el.querySelector('#h-grade').innerHTML = String(grade(ctx)); el.querySelectorAll('#h-grade .cascata').forEach((c) => c.classList.remove('cascata')); };
    el.querySelectorAll('[data-aba]').forEach((b) => (b.onclick = () => { f.aba = b.dataset.aba; f.pagina = 40; el.querySelectorAll('[data-aba]').forEach((x) => x.setAttribute('aria-selected', x === b)); repintar(); }));
    el.querySelector('#h-marca').onchange = (e) => { f.marca = e.target.value; repintar(); };
    el.querySelector('#h-busca').oninput = (e) => { f.q = e.target.value; repintar(); };
    el.querySelector('[data-rel]').onclick = () => {
      const l = filtrar(ctx);
      if (!l.length) return aviso('Nada para imprimir', '', 'erro');
      imprimir(relatorioCartoes('Relatório de códigos preenchidos', l, [f.aba === 'hoje' ? 'feitos hoje' : '', f.marca].filter(Boolean).join(' · ')));
    };
    el.querySelector('[data-copiar-lista]').onclick = async () => {
      const l = filtrar(ctx);
      await navigator.clipboard.writeText(R.textoCodigos(l)).catch(() => {});
      aviso('Lista copiada', `${l.length} códigos`);
    };
    el.addEventListener('click', async (e) => {
      if (e.target.closest('[data-mais]')) { f.pagina += 40; return repintar(); }
      const b = e.target.closest('[data-baixar]'), r = e.target.closest('[data-restaurar]'), a = e.target.closest('[data-abrir-h]');
      if (b) baixarFotos(ctx.item(b.dataset.baixar));
      if (a) ctx.abrirItem(a.dataset.abrirH);
      if (r) {
        const i = ctx.item(r.dataset.restaurar);
        if (!(await confirmar(`Voltar ${i.marca} ${i.ref} para Códigos recebidos?`, 'Sai do histórico e desmarca Site e Atacado.', 'Voltar'))) return;
        try { await ctx.alterar(i.id, R.mudar.restaurar()); aviso('Voltou para Códigos recebidos'); } catch (err) { erro(err); }
      }
    });
  },
};
