// Visão geral do painel: números, conferência de fotos enviadas, ritmo e atividade
import { html, icone, contar, aviso, erro, semMovimento } from '../ui.js';
import * as R from '../regras.js';
import { selo, codigoCopiavel } from '../componentes.js';

let graficos = [];
const DIA = 864e5;

function dias(n) {
  const out = [];
  for (let k = n - 1; k >= 0; k--) out.push(R.diaKey(Date.now() - k * DIA));
  return out;
}

export default {
  titulo: () => 'Visão geral',
  render(ctx) {
    const it = ctx.itens;
    const novos = it.filter(R.recebido).filter((i) => !i.visto).length;
    const hoje = R.diaKey(Date.now());
    const feitosHoje = it.filter(R.feito).filter((i) => R.diaKey(i.feitoEm) === hoje).length;
    const fimHoje = ctx.fins.filter((t) => R.diaKey(t) === hoje).sort().at(-1);
    const conferir = it.filter(R.conferirFotos);
    const k = [
      { r: 'recebidos', t: 'Códigos recebidos', n: it.filter(R.recebido).length, s: novos ? `${novos} novos para ver` : 'prontos para o site', ic: 'sino', d: novos > 0 },
      { r: 'esperando', t: 'Esperando código', n: it.filter(R.aguardando).length, s: `${it.filter(R.rascunho).length} em rascunho`, ic: 'relogio' },
      { r: 'pendencias', t: 'Pendências de fotos', n: it.filter(R.pendencia).length, s: `${it.filter(R.pendenciaComCodigo).length} já com código`, ic: 'alerta' },
      { r: 'atacado', t: 'Falta Atacado', n: it.filter(R.lembrete).length, s: 'já no site, falta atacado', ic: 'caminhao' },
      { r: 'historico', t: 'Feitos hoje', n: feitosHoje, s: `${it.filter(R.feito).length} no histórico`, ic: 'feito' },
    ];
    const recentes = [...it].filter((i) => !i.arquivado)
      .map((i) => ({ i, t: Math.max(i.feitoEm || 0, i.respondidoEm || 0, i.criado || 0) }))
      .sort((a, b) => b.t - a.t).slice(0, 8);
    return html`
      <div class="faixa-status ${fimHoje ? 'ok' : ''}">${icone(fimHoje ? 'festa' : 'relogio')}
        <span>${fimHoje ? `O escritório marcou tudo preenchido hoje às ${R.hm(fimHoje)}.` : `O escritório ainda tem ${it.filter(R.esperandoEsc).length} produtos para responder hoje.`}</span></div>
      <div class="kpis cascata">${k.map((x, n) => html`<a class="painel kpi ${x.d ? 'destaque' : ''}" href="#/${x.r}" style="--i:${n}">
        <span>${icone(x.ic)}${x.t}</span><b data-n="${x.n}">${x.n}</b><small>${x.s}</small></a>`)}</div>
      ${conferir.length ? html`<section class="painel conferir-box" style="margin-top:16px">
        <div class="painel-cab"><h2>${icone('foto')} O escritório diz que já enviou as fotos</h2><span class="espaco"></span><span class="n mono muted">${conferir.length}</span></div>
        <ul class="lista">${conferir.map((i) => html`<li class="item" data-id="${i.id}">
          ${R.capa(i) ? html`<button type="button" class="thumb thumb-zoom" data-ver-fotos="${i.id}"><img src="${R.capa(i)}" alt=""></button>` : html`<span class="thumb">${icone('foto')}</span>`}
          <div class="item-info"><span class="modelo-marca">${i.marca}</span><div class="item-titulo"><b>${i.ref}</b><span class="selo pend">${i.motivoFoto || 'Pendência'}</span></div>
            <div class="item-meta"><span>Enviou ${R.hora(i.fotosEnviadasEm)}</span></div></div>
          <div class="item-acoes"><button class="btn peq" data-nao="${i.id}">Não recebi</button><button class="btn ok peq" data-sim="${i.id}">${icone('feito')} Recebi</button></div></li>`)}</ul></section>` : ''}
      <div class="graficos cascata">
        <section class="painel" style="--i:5"><div class="painel-cab"><h2>Ritmo dos últimos 14 dias</h2></div>
          <div class="painel-corpo"><div class="grafico"><canvas id="g-ritmo" role="img" aria-label="Códigos recebidos e produtos feitos por dia"></canvas></div></div></section>
        <section class="painel" style="--i:6"><div class="painel-cab"><h2>Atividade recente</h2></div>
          <ul class="lista atividade">${recentes.map(({ i, t }) => html`<li data-abrir="${i.id}" data-id="${i.id}" class="clicavel" tabindex="0" style="cursor:pointer">
            <b class="mono">${i.marca} · ${i.ref}</b>${selo(i)}${codigoCopiavel(i.codigo, i.id)}<time>${R.hora(t)}</time></li>`)}</ul></section>
      </div>`;
  },
  montar(el, ctx) {
    el.querySelectorAll('[data-n]').forEach((b) => contar(b, Number(b.dataset.n)));
    el.querySelectorAll('[data-sim]').forEach((b) => (b.onclick = () => ctx.alterar(b.dataset.sim, R.mudar.fotosRecebidas()).then(() => aviso('Fotos recebidas', 'A pendência foi resolvida.')).catch(erro)));
    el.querySelectorAll('[data-nao]').forEach((b) => (b.onclick = () => ctx.alterar(b.dataset.nao, R.mudar.naoRecebi()).then(() => aviso('Marcado como não recebido', 'O escritório vai ver o aviso.')).catch(erro)));
    graficos.forEach((g) => g.destroy()); graficos = [];
    const cv = el.querySelector('#g-ritmo');
    if (!cv || !window.Chart) return;
    const ds = dias(14), it = ctx.itens;
    const conta = (campo) => ds.map((d) => it.filter((i) => i[campo] && R.diaKey(i[campo]) === d).length);
    const css = getComputedStyle(document.documentElement), cor = (v) => css.getPropertyValue(v).trim();
    Chart.defaults.color = cor('--muted'); Chart.defaults.borderColor = cor('--line'); Chart.defaults.font.family = 'Geist, system-ui';
    graficos.push(new Chart(cv, {
      type: 'bar',
      data: { labels: ds.map((d) => d.slice(8) + '/' + d.slice(5, 7)), datasets: [
        { label: 'Códigos recebidos', data: conta('respondidoEm'), backgroundColor: cor('--recv'), borderRadius: 4, maxBarThickness: 16 },
        { label: 'Feitos (no site)', data: conta('feitoEm'), backgroundColor: cor('--done'), borderRadius: 4, maxBarThickness: 16 },
      ] },
      options: { responsive: true, maintainAspectRatio: false, animation: semMovimento() ? false : { duration: 700 },
        plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8 } } },
        scales: { x: { grid: { display: false } }, y: { beginAtZero: true, ticks: { precision: 0 } } } },
    }));
  },
};
