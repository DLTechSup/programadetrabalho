// Listas do painel: esperando, recebidos, pendências, falta atacado, arquivados
import { html, raw, icone, aviso, erro, recolher, confirmar, imprimir } from '../ui.js';
import * as R from '../regras.js';
import { cartao, porMarcaHTML, vazio, relatorioCartoes } from '../componentes.js';

const filtros = {};

function barra(id, { abas, extra = '' } = {}) {
  const f = (filtros[id] ||= { q: '', aba: abas?.[0]?.[0] });
  return html`<div class="barra">
    ${abas ? html`<div class="abas" role="tablist">${abas.map(([v, t, n]) => html`<button role="tab" data-aba="${v}" aria-selected="${f.aba === v}">${t}<span class="n">${n}</span></button>`)}</div>` : ''}
    <span class="espaco"></span>
    <label class="busca">${icone('busca')}<span class="sr">Buscar</span><input class="inp" type="search" data-busca value="${f.q}" placeholder="Buscar marca, referência ou código"></label>
    ${extra}
  </div><div data-lista></div>`;
}

function ligar(el, id, desenhar) {
  const f = filtros[id], alvo = el.querySelector('[data-lista]');
  const pintar = (anim) => {
    alvo.innerHTML = String(desenhar(f));
    if (!anim) alvo.querySelectorAll('.cascata').forEach((c) => c.classList.remove('cascata'));
  };
  pintar(true);
  el.querySelector('[data-busca]').oninput = (e) => { f.q = e.target.value; pintar(false); };
  el.querySelectorAll('[data-aba]').forEach((b) => (b.onclick = () => {
    f.aba = b.dataset.aba;
    el.querySelectorAll('[data-aba]').forEach((x) => x.setAttribute('aria-selected', x === b));
    pintar(true);
  }));
  return pintar;
}

// Executa a alteração, mostra o ✓ e recolhe o cartão
async function sair(ctx, botao, id, mudancas, msg) {
  const li = botao.closest('li');
  botao.disabled = true;
  await ctx.segurando(async () => {
    try {
      await ctx.alterar(id, mudancas);
      botao.outerHTML = '<span class="marca-ok" aria-hidden="true"><svg class="i" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg></span>';
      await recolher(li);
      aviso(...msg);
    } catch (e) { botao.disabled = false; erro(e); }
  });
}

const chips = (i) => html`<button class="btn peq ${i.enviadoSite ? '' : 'fant'}" data-site="${i.id}" aria-pressed="${Boolean(i.enviadoSite)}">${i.enviadoSite ? icone('feito') : raw('<span class="bola"></span>')}Site</button>
  <button class="btn peq ${i.enviadoAtacado ? '' : 'fant'}" data-atac="${i.id}" aria-pressed="${Boolean(i.enviadoAtacado)}">${i.enviadoAtacado ? icone('feito') : raw('<span class="bola"></span>')}Atacado</button>`;

// Site/Atacado: mesma lógica do original (site pergunta se já foi ao atacado)
function ligarSiteAtacado(el, ctx) {
  el.addEventListener('click', async (e) => {
    const s = e.target.closest('[data-site]'), a = e.target.closest('[data-atac]');
    if (!s && !a) return;
    const b = s || a, i = ctx.item(b.dataset.site || b.dataset.atac), marcar = b.getAttribute('aria-pressed') !== 'true';
    try {
      if (a) {
        await ctx.alterar(i.id, R.mudar.atacado(i, marcar));
        if (marcar) aviso('Nos dois sites ✓', `${i.marca} ${i.ref}`);
      } else {
        const ambos = marcar && i.status !== 'feito' ? await confirmar(`${i.marca} ${i.ref} também foi para o site do Atacado?`, 'Se ainda não foi, fica um lembrete em "Falta Atacado".', 'Sim, nos dois') : false;
        await ctx.alterar(i.id, R.mudar.site(i, marcar, ambos));
        if (marcar) aviso(ambos ? 'Nos dois sites ✓' : 'Lembrete criado', ambos ? `${i.marca} ${i.ref}` : `Falta enviar ${i.marca} ${i.ref} ao Atacado`);
      }
    } catch (err) { erro(err); }
  });
}

// ---------- Esperando código ----------
const esperando = {
  titulo: () => 'Esperando código',
  render(ctx) {
    const it = ctx.itens.filter(R.aguardando);
    return html`<p class="muted" style="margin:0 0 16px">Sua parte já está feita. Aqui ficam os produtos aguardando o escritório responder.</p>
      ${barra('esperando', { abas: [
        ['todos', 'Todos', it.length],
        ['pendente', 'Com o escritório', it.filter((i) => i.status === 'pendente').length],
        ['naosei', 'Escritório não sabe', it.filter((i) => i.status === 'naosei').length],
        ['rascunho', 'Rascunho', it.filter((i) => i.status === 'rascunho').length],
      ], extra: html`<button class="btn" data-rel>${icone('imprimir')} Relatório</button>` })}`;
  },
  montar(el, ctx) {
    const filtrar = (aba) => ctx.itens.filter(R.aguardando).filter((i) => aba === 'todos' || i.status === aba);
    ligar(el, 'esperando', (f) => porMarcaHTML(R.buscar(filtrar(f.aba), f.q), (i, n) => cartao(i, { n,
      acoes: i.status === 'naosei' ? html`<button class="btn peq" data-reenviar="${i.id}">${icone('restaurar')} Reenviar</button>`
        : i.status === 'rascunho' ? html`<button class="btn acc peq" data-enviar="${i.id}">${icone('enviar')} Enviar</button>` : '',
    }), vazio('relogio', 'Nada esperando', 'Tudo que você enviou já foi respondido.')));
    el.addEventListener('click', (e) => {
      const r = e.target.closest('[data-reenviar]'), s = e.target.closest('[data-enviar]');
      if (r) sair(ctx, r, r.dataset.reenviar, R.mudar.reenviar(), ['Reenviado ao escritório', '']);
      if (s) sair(ctx, s, s.dataset.enviar, R.mudar.enviarRascunho(), ['Enviado ao escritório', '']);
    });
    el.querySelector('[data-rel]').onclick = () => imprimir(relatorioCartoes('Esperando código do escritório', filtrar(filtros.esperando.aba)));
  },
};

// ---------- Códigos recebidos ----------
const recebidos = {
  titulo: () => 'Códigos recebidos',
  render(ctx) {
    const it = ctx.itens.filter(R.recebido);
    return barra('recebidos', { extra: it.length ? html`
      <button class="btn" data-copiar-todos>${icone('copiar')} Copiar todos</button>
      <button class="btn" data-rel>${icone('imprimir')} Relatório</button>
      <button class="btn ok" data-todos-feito>${icone('feito')} Marcar todos como feito</button>` : '' });
  },
  montar(el, ctx) {
    const lista = () => ctx.itens.filter(R.recebido);
    ligar(el, 'recebidos', (f) => porMarcaHTML(R.buscar(lista(), f.q).sort((a, b) => (b.respondidoEm || 0) - (a.respondidoEm || 0)),
      (i, n) => cartao(i, { n, acoes: html`<div class="acoes-col">${chips(i)}<button class="btn ok peq" data-feito="${i.id}">${icone('feito')} Feito</button></div>` }),
      vazio('sino', 'Nenhum código novo', 'Quando o escritório responder, o código aparece aqui na hora, com aviso e som.')));
    ligarSiteAtacado(el, ctx);
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-feito]');
      if (b) { const i = ctx.item(b.dataset.feito); sair(ctx, b, i.id, R.mudar.feito(), ['Já está no site', `${i.marca} ${i.ref}`]); }
    });
    el.querySelector('[data-copiar-todos]')?.addEventListener('click', async () => {
      const l = lista();
      await navigator.clipboard.writeText(R.textoCodigos(l)).catch(() => {});
      aviso('Códigos copiados', `${l.length} códigos no formato de sempre`);
      ctx.alterarVarios(l.filter((i) => !i.visto).map((i) => i.id), () => R.mudar.visto()).catch(erro);
    });
    el.querySelector('[data-rel]')?.addEventListener('click', () => imprimir(relatorioCartoes('Códigos recebidos', lista())));
    el.querySelector('[data-todos-feito]')?.addEventListener('click', async () => {
      const l = lista();
      if (!(await confirmar(`Marcar ${l.length} códigos como feitos?`, 'Todos vão para o histórico como "já está no site".', 'Marcar todos'))) return;
      try { await ctx.alterarVarios(l.map((i) => i.id), () => R.mudar.feito()); aviso(`${l.length} já estão no site ✓`); } catch (err) { erro(err); }
    });
  },
};

// ---------- Pendências de fotos ----------
const pendencias = {
  titulo: () => 'Pendências de fotos',
  render(ctx) {
    const it = ctx.itens.filter(R.pendencia), f = filtros.pendencias;
    return html`${barra('pendencias', {
      abas: [['todas', 'Todas', it.length], ['sem', 'Sem código', it.filter(R.pendenciaSemCodigo).length], ['com', 'Com código', it.filter(R.pendenciaComCodigo).length]],
      extra: html`<label class="sr" for="f-motivo">Filtrar por situação</label><select class="inp" id="f-motivo" style="width:auto">
          <option value="">Todas as situações</option>${R.MOTIVOS.slice(1).map((m) => html`<option ${f?.motivo === m ? raw('selected') : ''}>${m}</option>`)}</select>
        <button class="btn" data-rel>${icone('imprimir')} Relatório</button>` })}`;
  },
  montar(el, ctx) {
    const filtrar = (f) => ctx.itens.filter(f.aba === 'sem' ? R.pendenciaSemCodigo : f.aba === 'com' ? R.pendenciaComCodigo : R.pendencia).filter((i) => !f.motivo || i.motivoFoto === f.motivo);
    const pintar = ligar(el, 'pendencias', (f) => porMarcaHTML(R.buscar(filtrar(f), f.q), (i, n) => {
      const t = R.etiquetaPendencia(i);
      return cartao(i, { n,
        extra: html`<div><span class="etiqueta ${t.tom}">${t.txt}</span></div>`,
        acoes: html`<div class="acoes-col">${i.fotosEnviadas ? html`<button class="btn peq" data-nao="${i.id}">Não recebi</button>` : ''}<button class="btn ok peq" data-recebi="${i.id}">${icone('foto')} Recebi as fotos</button></div>` });
    }, vazio('feito', 'Sem pendências de fotos', 'Nenhum produto nesta situação.')));
    el.querySelector('#f-motivo').onchange = (e) => { filtros.pendencias.motivo = e.target.value; pintar(true); };
    el.addEventListener('click', async (e) => {
      const r = e.target.closest('[data-recebi]'), n = e.target.closest('[data-nao]');
      if (r) {
        const i = ctx.item(r.dataset.recebi);
        const destino = i.status === 'respondido' ? 'Códigos recebidos' : 'Esperando código';
        if (await confirmar(`Recebeu as fotos de ${i.marca} ${i.ref}?`, `Ela vai para ${destino}.`, 'Recebi')) sair(ctx, r, i.id, R.mudar.fotosRecebidas(), ['Fotos recebidas', `${i.marca} ${i.ref} foi para ${destino}`]);
      }
      if (n) { try { await ctx.alterar(n.dataset.nao, R.mudar.naoRecebi()); aviso('Marcado como não recebido', 'O escritório vai ver o aviso.'); } catch (err) { erro(err); } }
    });
    el.querySelector('[data-rel]').onclick = () => {
      const l = filtrar(filtros.pendencias);
      if (!l.length) return aviso('Nada para imprimir', '', 'erro');
      imprimir(relatorioCartoes('Referências aguardando fotos', l, filtros.pendencias.motivo || ''));
    };
  },
};

// ---------- Falta Atacado ----------
const atacado = {
  titulo: () => 'Falta enviar ao Atacado',
  render: () => html`<p class="muted" style="margin:0 0 16px">Já estão no site, mas ainda não foram para o site do Atacado.</p>${barra('atacado')}`,
  montar(el, ctx) {
    ligar(el, 'atacado', (f) => porMarcaHTML(R.buscar(ctx.itens.filter(R.lembrete), f.q), (i, n) => cartao(i, { n,
      acoes: html`<button class="btn ok peq" data-ok-atac="${i.id}">${icone('caminhao')} Enviado ao Atacado</button>` }),
    vazio('caminhao', 'Nenhum lembrete', 'Tudo que está no site também está no Atacado.')));
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-ok-atac]');
      if (b) { const i = ctx.item(b.dataset.okAtac); sair(ctx, b, i.id, R.mudar.atacado(i, true), ['Nos dois sites ✓', `${i.marca} ${i.ref}`]); }
    });
  },
};

// ---------- Arquivados ----------
const arquivados = {
  titulo: () => 'Arquivados',
  render: () => html`<p class="muted" style="margin:0 0 16px">Nada é apagado do banco. O que você arquiva fica guardado aqui e pode voltar quando quiser.</p>${barra('arquivados')}`,
  montar(el, ctx) {
    ligar(el, 'arquivados', (f) => porMarcaHTML(R.buscar(ctx.itens.filter(R.arquivado), f.q), (i, n) => cartao(i, { n,
      acoes: html`<button class="btn peq" data-desarq="${i.id}">${icone('restaurar')} Desarquivar</button>` }),
    vazio('arquivo', 'Nada arquivado', 'Produtos arquivados aparecem aqui.')));
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-desarq]');
      if (b) sair(ctx, b, b.dataset.desarq, R.mudar.desarquivar(), ['Desarquivado', 'Voltou para a lista de onde saiu.']);
    });
  },
};

export default { esperando, recebidos, pendencias, atacado, arquivados };
