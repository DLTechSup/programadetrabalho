// Página aberta do escritório: responder códigos com foto grande e código em destaque
import { html, raw, icone, aviso, erro, recolher, camada, ampliar, tempo } from '../ui.js';
import * as R from '../regras.js';
import { vazio, precoChip } from '../componentes.js';

const CHAVE_VISTO = 'codigos-fotos-esc-visto-v1'; // mesma chave do site original
const lerVisto = () => { try { return +JSON.parse(localStorage.getItem(CHAVE_VISTO)) || 0; } catch { return 0; } };
const gravarVisto = () => { try { localStorage.setItem(CHAVE_VISTO, JSON.stringify(Date.now())); } catch { /* ok */ } };
const filtro = { marca: '', q: '' };
const qtd = (n, um = 'referência', varios = 'referências') => `${n} ${n === 1 ? um : varios}`;
const ordem = (a, b) => (a.criado || 0) - (b.criado || 0) || a.ref.localeCompare(b.ref, 'pt-BR');

// ---------- Alertas no topo ----------
function alertas(ctx, rota) {
  const it = ctx.itens;
  const sem = it.filter(R.alertaSemCodigo).length, com = it.filter(R.alertaComCodigo).length;
  const pend = sem + com ? html`<div class="alerta-pend" role="alert">
      <span class="alerta-ico">${icone('alerta')}</span>
      <div><b>Falta resolver ${qtd(sem + com, 'pendência de fotos', 'pendências de fotos')}</b>
        <span>${[sem && `${sem} sem código e sem foto`, com && `${com} com código, faltando foto`].filter(Boolean).join(' · ')}</span></div>
      ${rota === 'esc-pendencias' ? '' : html`<a class="btn acc peq" href="#/esc-pendencias">Resolver ${icone('seta')}</a>`}
    </div>` : '';
  const visto = lerVisto();
  const novos = it.filter(R.esperandoEsc).filter((i) => (i.criado || 0) > visto);
  const nov = rota === 'esc' && novos.length ? html`<div class="alerta-novo" role="status">
      <span class="alerta-ico novo">${icone('sino')}</span>
      <div><b>${qtd(novos.length, 'produto novo chegou', 'produtos novos chegaram')}</b><span>${[...new Set(novos.map((i) => R.normMarca(i.marca)))].join(' · ')}</span></div>
      <button class="btn peq pri" data-ver-novo="${novos[0].id}">Ver agora</button>
      <button class="btn fant peq ico" data-ok-novo aria-label="Dispensar aviso">${icone('x')}</button>
    </div>` : '';
  return html`${nov}${pend}`;
}

// ---------- Cartão de referência ----------
function cartao(i, n, modo) {
  const fs = R.fotos(i);
  const precisaCodigo = modo === 'codigo' || (modo === 'pend' && i.status !== 'respondido');
  const tag = modo === 'pend' ? R.etiquetaPendencia(i) : null;
  return html`<article class="painel modelo ${modo === 'pend' ? 'modelo-pend' : ''}" data-id="${i.id}" data-marca="${R.normMarca(i.marca)}" data-busca="${`${i.marca} ${i.ref}`.toLowerCase()}" style="--i:${n}">
    <button type="button" class="modelo-foto" data-ver-fotos="${i.id}" aria-label="${fs.length ? `Ver fotos de ${i.marca} ${i.ref}` : 'Sem foto'}" ${fs.length ? '' : raw('disabled')}>
      ${fs.length ? html`<img src="${fs[0]}" alt="${i.marca} ${i.ref}" loading="lazy"><span class="ver-foto">${icone('busca')} ${fs.length > 1 ? `Ver ${fs.length} fotos` : 'Ampliar'}</span>`
        : html`<span class="sem-foto">${icone('foto')}<span>Sem foto</span></span>`}
    </button>
    <div class="modelo-corpo">
      <header>
        <div><span class="modelo-marca">${i.marca}</span><h3 class="mono">${i.ref}</h3></div>
        <div class="linha-flex">${tag ? html`<span class="selo ${tag.tom === 'pend-forte' ? 'pend' : tag.tom}">${tag.txt}</span>` : ''}${i.motivoFoto && R.pendFoto(i) ? html`<span class="selo pend">${i.motivoFoto}</span>` : ''}${i.codigo ? html`<span class="codigo">${i.codigo}</span>` : ''}${precoChip(i)}</div>
      </header>
      <div class="item-meta"><span>Chegou ${tempo(i.criado ? new Date(i.criado).toISOString() : null)}</span>${i.origem === 'lista' && i.data ? html`<span>Fotos de ${i.data}</span>` : ''}</div>
      ${i.notaPainel ? html`<p class="nota-recado"><b>Recado:</b> ${i.notaPainel}</p>` : ''}
      ${i.nota ? html`<p class="nota-escritorio"><b>Observação:</b> ${i.nota}</p>` : ''}
      ${i.conferidoNaoRecebido ? html`<p class="nota-recado forte"><b>As fotos ainda não chegaram.</b> Confira e envie de novo.</p>` : ''}
      ${!precisaCodigo ? html`<p class="info-pend">Código já enviado. Falta só a foto deste modelo chegar ao painel.</p>` : html`<form class="modelo-form" data-form="${i.id}" novalidate>
        <label class="campo campo-codigo"><span>Código das fotos</span>
          <input class="inp mono codigo-grande" name="codigo" autocomplete="off" autocapitalize="characters" enterkeyhint="send" placeholder="Digite o código"></label>
        <label class="campo"><span>Observação <small>(opcional)</small></span>
          <textarea class="inp" name="obs" rows="2" placeholder="Ex.: só tem numeração 34 a 37"></textarea></label>
        <div class="modelo-rodape">
          <button class="btn pri" type="submit">${icone('enviar')} Enviar código</button>
        </div>
      </form>`}
    </div>
  </article>`;
}

function blocos(itens, modo) {
  let g = 0;
  return html`<div class="grupos-loja cascata">${[...R.porMarca(itens, ordem)].map(([m, l]) => html`
    <section class="grupo-loja" data-grupo="${m}" style="--i:${g++}" aria-label="${m}">
      <header class="grupo-cab"><h2>${m}</h2><span class="grupo-n" data-restam="${l.length}">${modo === 'codigo' ? `faltam ${qtd(l.length)}` : qtd(l.length, 'pendência', 'pendências')}</span></header>
      <div class="modelos">${l.map((i, k) => cartao(i, k, modo))}</div>
    </section>`)}</div>
    <div class="painel vazio" id="lj-nada" hidden>${icone('busca')}<h3>Nada encontrado</h3><p>Tente outra marca ou referência.</p></div>`;
}

function barraFiltros(itens) {
  const m = R.porMarca(itens);
  return html`<div class="loja-filtros">
    <div class="filtros-topo">
      <span class="filtros-rot">${icone('lista')} Responder por marca <small class="muted">(${m.size} ${m.size === 1 ? 'marca' : 'marcas'})</small></span>
      <label class="busca">${icone('busca')}<span class="sr">Buscar referência</span><input class="inp" type="search" id="lj-busca" value="${filtro.q}" placeholder="Buscar referência"></label>
    </div>
    <div class="chips ${filtro.abertas ? 'abertas' : ''}" id="chips" role="group" aria-label="Filtrar por marca">
      <button class="chip" data-chip="" aria-pressed="${!filtro.marca}">Todas <span>${itens.length}</span></button>
      ${[...m].map(([k, l]) => html`<button class="chip" data-chip="${k}" aria-pressed="${filtro.marca === k}">${k} <span>${l.length}</span></button>`)}
    </div>
    <button type="button" class="btn fant peq ver-marcas" id="ver-marcas" hidden aria-expanded="${Boolean(filtro.abertas)}" aria-controls="chips"></button>
  </div>`;
}

// ---------- Telas ----------
const esperando = {
  render(ctx) {
    const itens = ctx.itens.filter(R.esperandoEsc);
    if (!itens.length) {
      const hojeFim = ctx.fins.filter((t) => R.diaKey(t) === R.diaKey(Date.now())).sort().at(-1);
      return html`${alertas(ctx, 'esc')}<div class="painel vazio tudo-ok" role="status">${icone('festa')}<h3>Tudo preenchido</h3>
        <p>${hojeFim ? `Todos os códigos foram enviados hoje às ${R.hm(hojeFim)}.` : 'Nenhum produto esperando código agora.'} Quando chegar produto novo, ele aparece aqui na hora.</p>
        <p style="margin-top:14px"><a class="btn" href="#/esc-no-site">Ver o que já está no site</a></p></div>`;
    }
    const nm = R.porMarca(itens).size;
    return html`${alertas(ctx, 'esc')}
      <div class="loja-intro"><h1>${qtd(itens.length, 'produto esperando código', 'produtos esperando código')} <span class="muted">em ${qtd(nm, 'marca', 'marcas')}</span></h1>
        <p class="muted">Confira a foto, digite o código e aperte <b>Enter</b>. Depois de confirmar, já vai para a próxima referência da mesma marca.</p></div>
      ${barraFiltros(itens)}${blocos(itens, 'codigo')}`;
  },
  montar: (el, ctx) => ligar(el, ctx, 'codigo'),
};

const pendencias = {
  render(ctx) {
    const sem = ctx.itens.filter(R.alertaSemCodigo), com = ctx.itens.filter(R.alertaComCodigo);
    const todos = [...sem, ...com];
    if (!todos.length) return vazio('feito', 'Nenhuma pendência de fotos', 'Está tudo certo com as fotos.');
    const secao = (t, s, l, modo) => (l.length ? html`<h2 class="secao-titulo pend-titulo">${t} <span>${l.length}</span></h2><p class="muted" style="margin:-6px 0 12px">${s}</p>${blocos(l, modo)}` : '');
    return html`${alertas(ctx, 'esc-pendencias')}
      <div class="loja-intro"><h1>Pendências de fotos</h1><p class="muted">Produtos que precisam de foto. Mande o código dos que ainda não têm e envie as fotos direto para o painel.</p></div>
      ${barraFiltros(todos)}
      ${secao('Sem código e sem foto', 'Digite o código. As fotos vão direto para o painel.', sem, 'pend')}
      <div style="height:24px"></div>
      ${secao('Com código, faltando foto', 'O código já foi enviado. Falta só a foto para ir ao site.', com, 'pend')}`;
  },
  montar: (el, ctx) => ligar(el, ctx, 'pend'),
};

const noSite = {
  render(ctx) {
    const feitos = ctx.itens.filter(R.feito).sort((a, b) => b.feitoEm - a.feitoEm).slice(0, 24);
    if (!feitos.length) return vazio('feito', 'Nada no site ainda', 'Os produtos finalizados aparecem aqui.');
    return html`<div class="loja-intro"><h1>Já está no site</h1><p class="muted">Os últimos produtos que o painel finalizou com o código que vocês enviaram.</p></div>
      <div class="vitrine cascata">${feitos.map((i, n) => html`<figure class="painel vit" style="--i:${n}">
        ${R.capa(i) ? html`<button type="button" class="vit-foto" data-ver-fotos="${i.id}" aria-label="Ver foto"><img src="${R.capa(i)}" alt="" loading="lazy"></button>` : html`<span class="vit-foto sem">${icone('foto')}</span>`}
        <figcaption><span class="modelo-marca">${i.marca}</span><b class="mono">${i.ref}</b><span class="codigo">${i.codigo}</span><small class="muted">${R.hora(i.feitoEm)}</small></figcaption></figure>`)}</div>`;
  },
};

// ---------- Comportamento ----------
function aplicarFiltro(el) {
  const q = filtro.q.trim().toLowerCase();
  let vis = 0;
  el.querySelectorAll('.modelo').forEach((c) => {
    const okk = (!filtro.marca || c.dataset.marca === filtro.marca) && (!q || c.dataset.busca.includes(q));
    c.hidden = !okk; if (okk) vis++;
  });
  el.querySelectorAll('.grupo-loja').forEach((g) => (g.hidden = !g.querySelector('.modelo:not([hidden])')));
  el.querySelectorAll('.chip').forEach((b) => b.setAttribute('aria-pressed', b.dataset.chip === filtro.marca));
  el.querySelectorAll('#lj-nada').forEach((n) => (n.hidden = vis > 0));
}

// "Confira antes de enviar": foto grande + código editável. Enter confirma.
function conferir(i, codigo, obs) {
  return new Promise((ok) => {
    const { caixa, fechar } = camada(html`<form class="conferir" id="cf">
        <h2>Confira antes de enviar</h2>
        <div class="conf-grade">
          ${R.capa(i) ? html`<img class="conf-foto" src="${R.capa(i)}" alt="">` : html`<div class="conf-foto sem-foto">${icone('foto')}<span>Sem foto</span></div>`}
          <div class="conf-info">
            <span class="modelo-marca">${i.marca}</span><b class="mono conf-ref">${i.ref}</b>${precoChip(i)}
            <label class="campo"><span>Código</span><input class="inp mono codigo-grande" name="codigo" value="${codigo}" autofocus></label>
            <label class="campo"><span>Observação</span><input class="inp" name="obs" value="${obs}" placeholder="Opcional"></label>
          </div>
        </div>
        <div class="linha-flex" style="justify-content:flex-end"><button type="button" class="btn" data-n>Voltar e revisar</button><button class="btn pri" type="submit">${icone('enviar')} Confirmar envio</button></div>
      </form>`, 'dialogo dialogo-largo');
    const f = caixa.querySelector('#cf');
    requestAnimationFrame(() => { f.codigo.focus(); f.codigo.select(); });
    f.codigo.oninput = () => (f.codigo.value = f.codigo.value.toUpperCase());
    caixa.querySelector('[data-n]').onclick = () => { fechar(); ok(null); };
    document.querySelector('.veu').addEventListener('click', () => ok(null), { once: true });
    f.onsubmit = (e) => {
      e.preventDefault();
      const c = f.codigo.value.trim();
      if (!c) return f.codigo.focus();
      fechar(); ok({ codigo: c, obs: f.obs.value });
    };
  });
}

function ligar(el, ctx, modo) {
  // Filtros
  if (filtro.marca && !el.querySelector(`.chip[data-chip="${CSS.escape(filtro.marca)}"]`)) filtro.marca = '';
  el.querySelectorAll('.chip').forEach((b) => (b.onclick = () => {
    filtro.marca = b.dataset.chip;
    aplicarFiltro(el);
    el.querySelector('.grupos-loja')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }));
  // Muitas marcas: mostra 2 linhas e um botão para ver todas
  const chips = el.querySelector('#chips'), ver = el.querySelector('#ver-marcas');
  if (chips && ver) {
    const texto = () => (ver.innerHTML = String(html`${icone(filtro.abertas ? 'voltar' : 'seta')} ${filtro.abertas ? 'Mostrar menos marcas' : `Ver todas as marcas (${chips.children.length - 1})`}`));
    requestAnimationFrame(() => {
      const sobra = chips.scrollHeight > chips.clientHeight + 4 || filtro.abertas;
      ver.hidden = !sobra;
      texto();
    });
    ver.onclick = () => {
      filtro.abertas = !filtro.abertas;
      chips.classList.toggle('abertas', filtro.abertas);
      ver.setAttribute('aria-expanded', filtro.abertas);
      texto();
    };
  }
  const busca = el.querySelector('#lj-busca');
  if (busca) busca.oninput = () => { filtro.q = busca.value; aplicarFiltro(el); };
  aplicarFiltro(el);

  // Aviso de produtos novos
  el.querySelector('[data-ok-novo]')?.addEventListener('click', () => { gravarVisto(); ctx.render(); });
  el.querySelector('[data-ver-novo]')?.addEventListener('click', (e) => {
    gravarVisto();
    const card = el.querySelector(`.modelo[data-id="${CSS.escape(e.currentTarget.dataset.verNovo)}"]`);
    e.currentTarget.closest('.alerta-novo').remove();
    card?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    card?.querySelector('input[name=codigo]')?.focus({ preventScroll: true });
  });
  el.querySelectorAll('input[name=codigo]').forEach((inp) => (inp.oninput = () => { const p = inp.selectionStart; inp.value = inp.value.toUpperCase(); inp.setSelectionRange(p, p); }));

  // Depois de responder: recolhe o cartão, vai para a próxima da mesma marca e marca "tudo preenchido"
  async function concluido(card, i) {
    const grupo = card.closest('.grupo-loja');
    const irmaos = [...grupo.querySelectorAll('.modelo:not([hidden])')];
    const prox = irmaos.slice(irmaos.indexOf(card) + 1).find((c) => c.querySelector('input[name=codigo]'))?.querySelector('input[name=codigo]');
    const cont = grupo.querySelector('[data-restam]');
    const restam = Number(cont.dataset.restam) - 1;
    cont.dataset.restam = restam;
    cont.textContent = restam ? `faltam ${qtd(restam)}` : 'concluída ✓';
    if (prox) { prox.focus({ preventScroll: true }); prox.closest('.modelo').scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    await recolher(card);
    if (!restam) { aviso(`${R.normMarca(i.marca)} concluída`, 'Todas as referências desta marca foram enviadas.'); await recolher(grupo); scrollTo(0, 0); }
    if (modo === 'codigo' && !ctx.itens.some(R.esperandoEsc)) { await ctx.marcarFim(); aviso('Tudo preenchido!', 'Todos os códigos foram enviados.'); }
  }

  el.querySelectorAll('[data-form]').forEach((form) => (form.onsubmit = async (e) => {
    e.preventDefault();
    const i = ctx.item(form.dataset.form);
    const card = form.closest('.modelo');
    const codigo = form.codigo?.value.trim() || '';
    if (!codigo) { form.codigo?.focus(); return aviso('Digite o código', '', 'erro'); }
    const r = await conferir(i, codigo.toUpperCase(), form.obs.value.trim());
    if (!r) return form.codigo.focus();
    await ctx.segurando(async () => {
      form.querySelectorAll('button, input, textarea').forEach((x) => (x.disabled = true));
      try {
        await ctx.alterar(i.id, R.mudar.enviarCodigo(r.codigo, r.obs));
        card.classList.add('enviado');
        aviso('Código enviado', `${i.marca} ${i.ref} → ${r.codigo.toUpperCase()}`);
        await concluido(card, i);
      } catch (err) { form.querySelectorAll('button, input, textarea').forEach((x) => (x.disabled = false)); erro(err); }
    });
  }));

}

export default { esperando, pendencias, noSite, ampliar };
