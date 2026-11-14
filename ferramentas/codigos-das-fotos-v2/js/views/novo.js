// Cadastro: produto avulso ou lista colada, tudo entra como rascunho até você enviar ao escritório
import { html, raw, icone, aviso, erro, confirmar, recolher } from '../ui.js';
import * as R from '../regras.js';
import { cartao, vazio } from '../componentes.js';

const st = { fotos: [], marca: '', lista: '' };
const STATUS_DUP = { pendente: 'está com o escritório', naosei: 'o escritório marcou "não sei"', respondido: 'já foi respondida', feito: 'já foi concluída', rascunho: 'está em rascunho' };

function previaFotos() {
  return st.fotos.map((u, k) => html`<span class="thumb previa"><img src="${u}" alt="Foto ${k + 1}"><button type="button" data-tirar-foto="${k}" aria-label="Remover foto ${k + 1}">${icone('x')}</button></span>`);
}

export default {
  titulo: () => 'Novo produto',
  render(ctx) {
    const marcas = [...new Set(ctx.itens.map((i) => R.normMarca(i.marca)))].filter((m) => m && m !== '—').sort();
    const rasc = ctx.itens.filter(R.rascunho).sort((a, b) => (a.criado || 0) - (b.criado || 0));
    const previa = st.lista.trim() ? R.lerLista(st.lista) : [];
    return html`<div class="cadastro">
      <div class="grade" style="gap:16px;align-content:start">
        <section class="painel"><div class="painel-cab"><h2>Novo produto</h2></div>
          <form class="painel-corpo grade" id="f-novo" novalidate>
            <div class="campo"><span>Fotos</span>
              <div class="solta" id="solta" tabindex="0" role="button" aria-label="Adicionar fotos">${icone('upload')}<b>Arraste, clique ou cole (Ctrl+V)</b><small>Várias fotos de uma vez · reduzidas automaticamente</small></div>
              <input type="file" accept="image/*" multiple id="arq" class="sr" tabindex="-1">
              <div class="galeria-ed" id="previas">${previaFotos()}</div></div>
            <div class="grade g2">
              <label class="campo"><span>Marca *</span><input class="inp" name="marca" list="dl-marcas" value="${st.marca}" autocomplete="off" required></label>
              <label class="campo"><span>Referência *</span><input class="inp mono" name="ref" autocomplete="off" required placeholder="8575.106"></label>
            </div>
            <datalist id="dl-marcas">${marcas.map((m) => html`<option value="${m}">`)}</datalist>
            <p class="erro-txt" id="dup" hidden></p>
            <label class="campo"><span>Situação das fotos</span><select class="inp" name="motivoFoto"><option value="">Sem situação (normal)</option>${R.MOTIVOS.map((m) => html`<option>${m}</option>`)}</select>
              <small>Qualquer situação diferente de "Já tenho as fotos" vai para as Pendências do escritório.</small></label>
            <div class="campo"><span>Valor no Bling</span><div id="vals" class="grade" style="gap:6px"><input class="inp" name="valor" placeholder="Ex.: 129,90 (opcional)"></div>
              <button type="button" class="btn fant peq" id="mais-valor" style="align-self:flex-start">${icone('mais')} Outro valor</button></div>
            <label class="campo"><span>Observação</span><textarea class="inp" name="nota" rows="2" placeholder="Ex.: a prata é 6584.100 e a dourada é 6584.200"></textarea></label>
            <button class="btn pri" type="submit">${icone('mais')} Adicionar ao rascunho</button>
          </form></section>
        <details class="painel colar" ${st.lista ? raw('open') : ''}>
          <summary class="painel-cab"><h2>${icone('lista')} Colar lista do WhatsApp</h2><span class="espaco"></span>${icone('seta')}</summary>
          <div class="painel-corpo grade">
            <small class="muted">Formato de sempre: a MARCA numa linha e embaixo "REF — Falta código das fotos". Tudo entra no rascunho.</small>
            <textarea class="inp mono" id="lista" rows="8" placeholder="Fotos iniciadas em 23/09/26&#10;MOLECA&#10;5579.103 — Falta código das fotos.&#10;5560.114 — Falta código das fotos. Observação: falta a cor preta">${st.lista}</textarea>
            <div class="linha-flex"><span class="muted" id="lista-info">${previa.length ? `${previa.length} ${previa.length === 1 ? 'referência encontrada' : 'referências encontradas'} em ${new Set(previa.map((p) => p.marca)).size === 1 ? '1 marca' : new Set(previa.map((p) => p.marca)).size + ' marcas'}` : 'Nenhuma referência ainda'}</span><span style="flex:1"></span>
              <button class="btn pri" id="importar" ${previa.length ? '' : raw('disabled')}>Adicionar ao rascunho</button></div>
          </div></details>
      </div>
      <section class="painel">
        <div class="painel-cab"><h2>Rascunho</h2><span class="n mono muted">${rasc.length}</span><span class="espaco"></span>
          <button class="btn acc" id="enviar-rasc" ${rasc.length ? '' : raw('disabled')}>${icone('enviar')} Enviar ${rasc.length || ''} ao escritório</button></div>
        <p class="muted" style="margin:12px 16px 0;font-size:13px">Fica aqui até você enviar. O escritório só vê depois do envio.</p>
        ${rasc.length ? html`<ul class="lista cascata">${rasc.map((i, n) => cartao(i, { n, acoes: html`<button class="btn fant peq ico" data-arq="${i.id}" aria-label="Tirar do rascunho (arquivar)" title="Tirar do rascunho">${icone('x')}</button>` }))}</ul>`
          : html`<div class="painel-corpo">${vazio('caixa', 'Rascunho vazio', 'Cadastre um produto ou cole uma lista ao lado.')}</div>`}
      </section>
    </div>`;
  },

  montar(el, ctx) {
    const f = el.querySelector('#f-novo'), solta = el.querySelector('#solta'), arq = el.querySelector('#arq');
    const pintarPrevias = () => {
      el.querySelector('#previas').innerHTML = String(html`${previaFotos()}`);
      el.querySelectorAll('[data-tirar-foto]').forEach((b) => (b.onclick = () => { st.fotos.splice(+b.dataset.tirarFoto, 1); pintarPrevias(); }));
    };
    pintarPrevias();
    const subir = async (files) => {
      const imgs = [...files].filter((x) => x.type.startsWith('image/'));
      if (!imgs.length) return aviso('Use arquivos de imagem', 'JPG, PNG ou WEBP.', 'erro');
      solta.classList.add('ativa'); solta.querySelector('b').textContent = `Enviando ${imgs.length} ${imgs.length === 1 ? 'foto' : 'fotos'}…`;
      try { for (const a of imgs) { st.fotos.push(await ctx.enviarFoto(a)); pintarPrevias(); } } catch (e) { erro(e); }
      solta.classList.remove('ativa'); solta.querySelector('b').textContent = 'Arraste, clique ou cole (Ctrl+V)';
    };
    solta.onclick = () => arq.click();
    solta.onkeydown = (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), arq.click());
    arq.onchange = () => { subir(arq.files); arq.value = ''; };
    solta.ondragover = (e) => { e.preventDefault(); solta.classList.add('ativa'); };
    solta.ondragleave = () => solta.classList.remove('ativa');
    solta.ondrop = (e) => { e.preventDefault(); subir(e.dataTransfer.files); };
    f.onpaste = (e) => { if (e.clipboardData.files.length) subir(e.clipboardData.files); };
    el.querySelector('#mais-valor').onclick = () => { const i = Object.assign(document.createElement('input'), { className: 'inp', name: 'valor', placeholder: 'Ex.: 129,90' }); el.querySelector('#vals').append(i); i.focus(); };
    f.marca.oninput = () => { f.marca.value = f.marca.value.toUpperCase(); st.marca = f.marca.value; checar(); };
    const dup = el.querySelector('#dup');
    const checar = () => {
      const d = f.ref.value.trim() && ctx.itens.find((i) => !i.arquivado && R.chave(i.marca, i.ref) === R.chave(f.marca.value, f.ref.value));
      dup.hidden = !d;
      if (d) dup.textContent = `Atenção: ${d.marca} ${d.ref} já existe (${STATUS_DUP[d.status] || d.status}).`;
    };
    f.ref.oninput = checar;

    f.onsubmit = async (e) => {
      e.preventDefault();
      const marca = R.normMarca(f.marca.value), ref = f.ref.value.trim();
      if (!marca || !ref) { (marca ? f.ref : f.marca).focus(); return aviso('Preencha marca e referência', '', 'erro'); }
      const d = ctx.itens.find((i) => !i.arquivado && R.chave(i.marca, i.ref) === R.chave(marca, ref));
      if (d && !(await confirmar(`${marca} ${ref} já existe`, `Ela ${STATUS_DUP[d.status] || 'já está cadastrada'}. Adicionar de novo assim mesmo?`, 'Adicionar'))) return;
      const fd = new FormData(f);
      document.activeElement?.blur(); // libera a tela para redesenhar com o formulário limpo
      try {
        await ctx.inserir([R.novoItem({ marca, ref, nota: fd.get('nota').trim(), motivoFoto: fd.get('motivoFoto'), valores: fd.getAll('valor').map((v) => v.trim()).filter(Boolean), fotos: [...st.fotos], status: 'rascunho', origem: 'avulso' })]);
        st.fotos = []; st.marca = marca;
        aviso('Adicionado ao rascunho', `${marca} ${ref}`);
        requestAnimationFrame(() => document.querySelector('#f-novo [name=ref]')?.focus());
      } catch (err) { erro(err); }
    };

    const ta = el.querySelector('#lista'), info = el.querySelector('#lista-info'), imp = el.querySelector('#importar');
    ta.oninput = () => {
      st.lista = ta.value;
      const p = R.lerLista(ta.value);
      info.textContent = p.length ? `${p.length} ${p.length === 1 ? 'referência encontrada' : 'referências encontradas'} em ${new Set(p.map((x) => x.marca)).size === 1 ? '1 marca' : new Set(p.map((x) => x.marca)).size + ' marcas'}` : 'Nenhuma referência ainda';
      imp.disabled = !p.length;
    };
    imp.onclick = async () => {
      const p = R.lerLista(st.lista);
      const ativos = new Set(ctx.itens.filter(R.aguardando).map((i) => R.chave(i.marca, i.ref)));
      const existentes = new Set(ctx.itens.map((i) => R.chave(i.marca, i.ref)));
      const semDup = p.filter((x) => !ativos.has(R.chave(x.marca, x.ref)));
      const novos = semDup.filter((x) => !existentes.has(R.chave(x.marca, x.ref)));
      const repetidos = semDup.filter((x) => existentes.has(R.chave(x.marca, x.ref)));
      try {
        if (novos.length) await ctx.inserir(novos.map((x) => R.novoItem({ ...x, status: 'rascunho', origem: 'lista' })));
        if (repetidos.length && (await confirmar(`${repetidos.length} já foram preenchidas antes`, 'Estão no histórico. Adicionar de novo assim mesmo?', 'Adicionar'))) {
          await ctx.inserir(repetidos.map((x) => R.novoItem({ ...x, status: 'rascunho', origem: 'lista' })));
        }
        st.lista = '';
        aviso(`${novos.length} adicionadas ao rascunho`, p.length - novos.length - repetidos.length ? `${p.length - novos.length - repetidos.length} já estavam na fila` : '');
        ctx.render();
      } catch (err) { erro(err); }
    };

    el.querySelectorAll('[data-arq]').forEach((b) => (b.onclick = async () => {
      const li = b.closest('li');
      await ctx.segurando(async () => { try { await ctx.alterar(b.dataset.arq, R.mudar.arquivar()); await recolher(li); aviso('Tirado do rascunho', 'Está em Arquivados, se precisar.'); } catch (e) { erro(e); } });
    }));

    el.querySelector('#enviar-rasc').onclick = async (e) => {
      const ids = ctx.itens.filter(R.rascunho).map((i) => i.id);
      if (!ids.length) return;
      e.currentTarget.disabled = true;
      try {
        await ctx.alterarVarios(ids, () => R.mudar.enviarRascunho());
        aviso(`${ids.length} ${ids.length === 1 ? 'referência enviada' : 'referências enviadas'} ao escritório`, 'Agora é com eles. Você será avisado quando os códigos chegarem.');
      } catch (err) { erro(err); }
    };
  },
};
