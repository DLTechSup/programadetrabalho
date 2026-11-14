// Peças compartilhadas: cartão de produto, selos, editor do produto e relatórios
import { html, raw, icone, esc, gaveta, confirmar, aviso, erro, ocupado } from './ui.js';
import { MOTIVOS, STATUS_TXT, fotos, capa, valor, pendFoto, lembrete, etiquetaPendencia, mudar, hora, normMarca, porMarca } from './regras.js';

export function selo(i) {
  if (i.arquivado) return html`<span class="selo neu">Arquivado</span>`;
  if (i.status !== 'feito' && pendFoto(i)) return html`<span class="selo pend">${i.motivoFoto}</span>`;
  if (lembrete(i)) return html`<span class="selo wait">Falta atacado</span>`;
  const tom = { rascunho: 'neu', pendente: 'wait', naosei: 'pend', respondido: 'recv', feito: 'done' }[i.status] || 'neu';
  return html`<span class="selo ${tom}">${STATUS_TXT[i.status] || i.status}</span>`;
}

export const codigoCopiavel = (c, id = '') => c
  ? html`<button type="button" class="codigo copiar" data-copiar="${c}" data-visto="${id}" title="Clique para copiar" aria-label="Copiar código ${c}">${c}${icone('copiar')}</button>`
  : '';

export const precoChip = (i) => (valor(i) ? html`<span class="preco" title="Valor no Bling">R$ ${String(valor(i)).replace(/^R\$\s*/, '')}</span>` : '');

export function fotoGrande(i, classe = 'thumb') {
  const c = capa(i);
  return c
    ? html`<button type="button" class="${classe} thumb-zoom" data-ver-fotos="${i.id}" aria-label="Ver fotos de ${i.marca} ${i.ref}"><img src="${c}" alt="" loading="lazy">${fotos(i).length > 1 ? html`<span class="qtd">${fotos(i).length}</span>` : ''}</button>`
    : html`<span class="${classe} sem-foto-adm">${icone('foto')}<small>Sem foto</small></span>`;
}

// Cartão de produto do painel: foto grande, marca, referência, status, valor, código e recados
export function cartao(i, { acoes = '', extra = '', n = 0, clicavel = true } = {}) {
  const outras = fotos(i).slice(1, 6);
  return html`<li class="item item-grande ${clicavel ? 'clicavel' : ''} ${!i.visto && i.status === 'respondido' ? 'novo' : ''}" ${clicavel ? raw(`data-abrir="${esc(i.id)}" tabindex="0"`) : ''} data-id="${i.id}" style="--i:${n}">
    ${fotoGrande(i)}
    <div class="item-info">
      <span class="modelo-marca">${i.marca}${!i.visto && i.status === 'respondido' ? html` <b class="tag-novo">novo</b>` : ''}</span>
      <div class="item-titulo"><b>${i.ref}</b>${codigoCopiavel(i.codigo, i.id)}${selo(i)}${precoChip(i)}</div>
      <div class="item-meta">
        <span>${i.origem === 'lista' ? `Remessa ${i.data || ''}` : `Cadastro ${hora(i.cadastradoEm || i.criado)}`}</span>
        ${i.respondidoEm ? html`<span>Respondido ${hora(i.respondidoEm)}</span>` : ''}
        ${i.feitoEm ? html`<span>Feito ${hora(i.feitoEm)}</span>` : ''}
      </div>
      ${i.nota ? html`<div class="item-nota">Observação: ${i.nota}</div>` : ''}
      ${i.notaPainel ? html`<div class="item-nota recado">Recado ao escritório: ${i.notaPainel}</div>` : ''}
      ${i.obs ? html`<div class="item-nota loja">Escritório: ${i.obs}</div>` : ''}
      ${outras.length ? html`<div class="mais-fotos">${outras.map((f, k) => html`<button type="button" class="thumb thumb-zoom" data-ver-fotos="${i.id}" data-pos="${k + 1}" aria-label="Ver foto ${k + 2}"><img src="${f}" alt="" loading="lazy"></button>`)}</div>` : ''}
      ${extra}
    </div>
    <div class="item-acoes">${acoes}</div>
  </li>`;
}

// Blocos por marca
export function porMarcaHTML(itens, render, vazio) {
  const m = porMarca(itens);
  if (!m.size) return vazio;
  let g = 0;
  return html`<div class="cascata">${[...m].map(([marca, l]) => html`
    <section class="painel grupo-marca" style="--i:${g++}" aria-label="${marca}">
      <header><h3>${marca}</h3><span class="n">${l.length} ${l.length === 1 ? 'referência' : 'referências'}</span></header>
      <ul class="lista">${l.map((i, k) => render(i, k))}</ul>
    </section>`)}</div>`;
}

export const vazio = (ic, titulo, texto) => html`<div class="painel vazio" role="status">${icone(ic)}<h3>${titulo}</h3><p>${texto}</p></div>`;

// ---------- Editor do produto (gaveta) ----------
export function abrirEditor(i, ctx) {
  const vals = (i.valores || []).length ? i.valores : [''];
  const { caixa, fechar } = gaveta(html`
    <header>
      <div><span class="modelo-marca">${i.marca}</span><h2 id="ed-t" class="mono">${i.ref}</h2></div>${selo(i)}
      <span style="flex:1"></span><button class="btn fant ico" data-fechar aria-label="Fechar">${icone('x')}</button>
    </header>
    <form class="corpo" id="ed">
      <div class="galeria-ed">
        ${fotos(i).map((f, k) => html`<button type="button" class="thumb thumb-zoom" data-ver-fotos="${i.id}" data-pos="${k}"><img src="${f}" alt="Foto ${k + 1}"></button>`)}
        <label class="thumb add-foto" title="Adicionar fotos">${icone('upload')}<span>Adicionar</span><input type="file" accept="image/*" multiple class="sr" id="ed-fotos"></label>
      </div>
      <div class="grade g2">
        <label class="campo"><span>Marca</span><input class="inp" name="marca" value="${i.marca}" required></label>
        <label class="campo"><span>Referência</span><input class="inp mono" name="ref" value="${i.ref}" required></label>
      </div>
      <div class="campo"><span>Valor no Bling</span>
        <div id="ed-vals" class="grade" style="gap:6px">${vals.map((v) => html`<input class="inp" name="valor" value="${v}" placeholder="Ex.: 129,90">`)}</div>
        <button type="button" class="btn fant peq" id="ed-mais-valor" style="align-self:flex-start">${icone('mais')} Outro valor</button></div>
      <label class="campo"><span>Situação das fotos</span><select class="inp" name="motivoFoto">
        <option value="">Sem situação</option>${MOTIVOS.map((m) => html`<option ${i.motivoFoto === m ? raw('selected') : ''}>${m}</option>`)}</select></label>
      <label class="campo"><span>Observação do cadastro</span><textarea class="inp" name="nota" rows="2">${i.nota || ''}</textarea></label>
      <label class="campo"><span>Recado ao escritório</span><textarea class="inp" name="notaPainel" rows="2" placeholder="Aparece em destaque para o escritório">${i.notaPainel || ''}</textarea></label>
      ${i.codigo || i.status === 'respondido' || i.status === 'feito'
        ? html`<label class="campo"><span>Código ${codigoCopiavel(i.codigo)}</span><input class="inp mono" name="codigo" value="${i.codigo || ''}" style="font-size:16px;font-weight:700"><small>Corrija aqui se o escritório digitou errado.</small></label>` : ''}
      ${i.obs ? html`<div class="item-nota loja" style="white-space:normal">Escritório escreveu: ${i.obs}</div>` : ''}
      <div class="grade g2">
        <label class="check"><input type="checkbox" name="enviadoSite" ${i.enviadoSite ? raw('checked') : ''}> Enviado ao site</label>
        <label class="check"><input type="checkbox" name="enviadoAtacado" ${i.enviadoAtacado ? raw('checked') : ''}> Enviado ao Atacado</label>
      </div>
      <p class="muted" style="font-size:12px;margin:0">${i.origem === 'lista' ? `Remessa ${i.data}` : 'Cadastro avulso'} · criado ${hora(i.cadastradoEm || i.criado)}${i.respondidoEm ? ` · respondido ${hora(i.respondidoEm)}` : ''}${i.feitoEm ? ` · feito ${hora(i.feitoEm)}` : ''}</p>
    </form>
    <footer>
      <button class="btn pri" form="ed" type="submit">Salvar</button>
      ${i.status === 'rascunho' && !i.arquivado ? html`<button class="btn acc" data-a="enviarRascunho">${icone('enviar')} Enviar ao escritório</button>` : ''}
      ${i.status === 'naosei' && !i.arquivado ? html`<button class="btn" data-a="reenviar">${icone('restaurar')} Reenviar ao escritório</button>` : ''}
      ${i.status === 'respondido' && !pendFoto(i) && !i.arquivado ? html`<button class="btn ok" data-a="feito">${icone('feito')} Feito</button>` : ''}
      ${pendFoto(i) && i.status !== 'feito' && !i.arquivado ? html`<button class="btn ok" data-a="fotosRecebidas">${icone('foto')} Fotos recebidas</button>` : ''}
      ${i.status === 'feito' && !i.arquivado ? html`<button class="btn" data-a="restaurar">${icone('restaurar')} Voltar para recebidos</button>` : ''}
      <span style="flex:1"></span>
      ${i.arquivado ? html`<button class="btn" data-a="desarquivar">${icone('restaurar')} Desarquivar</button>` : html`<button class="btn fant" data-a="arquivar">${icone('arquivo')} Arquivar</button>`}
    </footer>`);
  caixa.setAttribute('aria-labelledby', 'ed-t');

  caixa.querySelector('#ed-mais-valor').onclick = () => {
    const inp = Object.assign(document.createElement('input'), { className: 'inp', name: 'valor', placeholder: 'Ex.: 129,90' });
    caixa.querySelector('#ed-vals').append(inp); inp.focus();
  };
  caixa.querySelector('#ed-fotos').onchange = async (e) => {
    const arqs = [...e.target.files];
    if (!arqs.length) return;
    try {
      aviso('Enviando fotos…', `${arqs.length} ${arqs.length === 1 ? 'foto' : 'fotos'}`);
      const urls = [];
      for (const a of arqs) urls.push(await ctx.enviarFoto(a));
      const atual = ctx.item(i.id);
      await ctx.alterar(i.id, { fotos: [...(atual.fotos || []), ...urls] });
      aviso('Fotos adicionadas'); fechar(); ctx.abrirItem(i.id);
    } catch (err) { erro(err); }
  };

  caixa.querySelector('#ed').onsubmit = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const marca = normMarca(f.get('marca')), ref = f.get('ref').trim();
    if (!marca || !ref) return aviso('Preencha marca e referência', '', 'erro');
    const motivo = f.get('motivoFoto');
    const m = {
      marca, ref, valores: f.getAll('valor').map((v) => v.trim()).filter(Boolean), motivoFoto: motivo,
      nota: f.get('nota').trim(), notaPainel: motivo === 'Já tenho as fotos' ? '' : f.get('notaPainel').trim(),
    };
    if (f.has('codigo')) m.codigo = f.get('codigo').trim().toUpperCase() || i.codigo;
    const site = f.has('enviadoSite'), atac = f.has('enviadoAtacado');
    if (atac !== Boolean(i.enviadoAtacado)) Object.assign(m, mudar.atacado(i, atac));
    else if (site !== Boolean(i.enviadoSite)) Object.assign(m, mudar.site(i, site, false));
    await ocupado(e.submitter, async () => {
      try { await ctx.alterar(i.id, m); aviso('Alterações salvas', `${marca} ${ref}`); fechar(); } catch (err) { erro(err); }
    });
  };

  const textos = {
    enviarRascunho: 'Enviado ao escritório', reenviar: 'Reenviado ao escritório', feito: 'Já está no site',
    fotosRecebidas: 'Fotos recebidas', restaurar: 'Voltou para Códigos recebidos', arquivar: 'Arquivado', desarquivar: 'Desarquivado',
  };
  caixa.querySelectorAll('[data-a]').forEach((b) => (b.onclick = async () => {
    const a = b.dataset.a;
    if (a === 'arquivar' && !(await confirmar('Arquivar este produto?', 'Ele sai de todas as listas mas continua guardado no banco. Você pode desarquivar quando quiser.', 'Arquivar'))) return;
    await ocupado(b, async () => {
      try { await ctx.alterar(i.id, mudar[a](i)); aviso(textos[a], `${i.marca} ${i.ref}`); fechar(); } catch (err) { erro(err); }
    });
  }));
}

// ---------- Relatórios (impressão / PDF) ----------
export function relatorioCartoes(titulo, itens, sub = '') {
  const m = porMarca(itens);
  return raw(`<div class="rel"><h1>${esc(titulo)}</h1><p class="rel-sub">Calçados 24h · gerado em ${hora(Date.now())} · ${itens.length} ${itens.length === 1 ? 'item' : 'itens'} · ${m.size} ${m.size === 1 ? 'marca' : 'marcas'}${sub ? ' · ' + esc(sub) : ''}</p>` +
    [...m].map(([marca, l]) => `<section class="rel-marca"><h2>${esc(marca)} <span>${l.length}</span></h2><div class="rel-grade">${l.map((i) => `
      <div class="rel-card"><div class="rel-foto">${capa(i) ? `<img src="${esc(capa(i))}" alt="">` : '<span>sem foto</span>'}</div>
      <div class="rel-info"><span class="rel-m">${esc(i.marca)}</span><span class="rel-ref">${esc(i.ref)}</span>${i.codigo ? `<span class="rel-cod">Código ${esc(i.codigo)}</span>` : ''}${valor(i) ? `<span class="rel-v">R$ ${esc(valor(i))}</span>` : ''}${i.motivoFoto && i.motivoFoto !== 'Já tenho as fotos' ? `<span class="rel-tag">${esc(i.motivoFoto)}</span>` : ''}${i.nota ? `<span class="rel-n">${esc(i.nota)}</span>` : ''}</div></div>`).join('')}</div></section>`).join('') + '</div>');
}

export { etiquetaPendencia };
