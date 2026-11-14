// Modo demonstração (?demo): mesma interface do banco, dados fictícios em memória. Não toca o Supabase.
import { lerLista, novoItem, mudar, uid } from './regras.js';

const LISTA = `Fotos iniciadas em 23/09/26
MODARE
7232.102 — Falta código das fotos.
7178.129 — Falta código das fotos.
7340.135 — Falta código das fotos.
BEIRA RIO
8575.106 — Falta código das fotos.
8562.113 — Falta código das fotos.
8571.108 — Falta código das fotos.
8575.103 — Falta código das fotos.
MOLECA
5579.103 — Falta código das fotos.
5560.114 — Falta código das fotos.
5490.231 — Falta código das fotos.
VIZZANO
6584.100 — Falta código das fotos. Observação: a prata é 6584.100 e a dourada é 6584.200.
6492.341 — Falta código das fotos.
6579.102 — Falta código das fotos.
6510.102 — Falta código das fotos. Observação: falta foto da cor MOCCA.
BEBECE
T5118-194 — Falta código das fotos.
OLYMPIKUS
VOA — Falta código das fotos.
LANCE — Falta código das fotos.`;

const CORES = ['#b9a48a', '#7d8b74', '#a86b4f', '#5f6f86', '#c4a35a', '#8a6a8a', '#6f8f8a', '#9c6b6b'];
function foto(txt, n) {
  const c = CORES[n % CORES.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600"><rect width="600" height="600" fill="${c}"/><ellipse cx="300" cy="455" rx="230" ry="26" fill="#000" opacity=".18"/><path d="M95 400c55-8 98-40 128-86 11-17 33-20 47-6 31 31 75 49 131 54 42 4 64 20 64 40v14H95z" fill="#fff" opacity=".92"/><rect x="95" y="412" width="370" height="20" rx="6" fill="#222" opacity=".78"/><text x="28" y="56" font-family="monospace" font-size="26" fill="#fff" opacity=".85">${txt}</text></svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

function gerar() {
  const t = Date.now(), H = 36e5, D = 864e5;
  const itens = lerLista(LISTA).map((p, n) => {
    const i = novoItem({ ...p, origem: 'lista', status: 'pendente', cadastradoEm: t - 2 * D });
    i.criado = t - (n % 5) * H;
    i.fotos = n % 9 === 4 ? [] : [foto(p.ref, n), foto(p.ref + ' · lado', n + 3), foto(p.ref + ' · sola', n + 5)].slice(0, 1 + (n % 3));
    if (n % 3 === 0) i.valores = [`${(99 + n * 10).toFixed(2).replace('.', ',')}`];
    return i;
  });
  const set = (k, p) => Object.assign(itens[k], p);
  // Situações variadas para mostrar todas as telas
  set(0, mudar.enviarCodigo('47213', 'só tem do 34 ao 37'));
  set(1, mudar.enviarCodigo('47188', ''));
  set(5, mudar.enviarCodigo('51002', ''));
  set(9, { motivoFoto: 'Somente foto de capa', notaPainel: 'Mandar as fotos da lateral' });
  set(13, { motivoFoto: 'Não tenho fotos' });
  set(10, { ...mudar.enviarCodigo('39911', ''), motivoFoto: 'Foto de baixa qualidade' });
  set(14, { ...mudar.enviarCodigo('40220', ''), motivoFoto: 'Falta o escritório mandar as fotos', ...mudar.jaEnviei() });
  set(15, mudar.naoSei('não achei no sistema'));
  set(12, { ...mudar.enviarCodigo('38877', ''), enviadoSite: true });
  // Histórico
  const feitos = ['TÊNIS ACTVITTA|4820.101', 'ACTVITTA|4801.300', 'MOLEKINHA|2107.140', 'PICCADILLY|117083', 'VIZZANO|1356.200', 'BEIRA RIO|4271.801'];
  feitos.forEach((s, k) => {
    const [marca, ref] = s.split('|');
    const i = novoItem({ marca, ref, status: 'feito', origem: 'avulso', fotos: [foto(ref, k + 2)] });
    Object.assign(i, { codigo: String(46000 + k * 37), respondidoEm: t - (k + 1) * 5 * H, feitoEm: t - k * 4 * H - (k > 2 ? D : 0), enviadoSite: true, enviadoAtacado: true });
    itens.push(i);
  });
  // ?demo&muitas: muitas marcas com pendência, para ver o filtro com bastante coisa
  if (new URLSearchParams(location.search).has('muitas')) {
    const ms = ['AREZZO', 'BEIRA RIO', 'DAKOTA', 'IMPROVISO', 'MOLECA', 'MOLEKINHO', 'PICCADILLY', 'RAMARIM', 'USAFLEX', 'VIZZANO', 'BOTTERO', 'COMFORTFLEX', 'KOLOSH', 'MODARE', 'OLYMPIKUS', 'ACTVITTA', "MARIA'S SHOES", 'BEBECE'];
    for (let k = 0; k < 40; k++) {
      const m = ms[k % ms.length], ref = `${1000 + k * 7}.${100 + k}`;
      const i = novoItem({ marca: m, ref, status: k % 3 ? 'pendente' : 'respondido', origem: 'lista', motivoFoto: ['Somente foto de capa', 'Não tenho fotos', 'Foto de baixa qualidade'][k % 3], fotos: k % 4 ? [foto(ref, k)] : [] });
      if (i.status === 'respondido') Object.assign(i, { codigo: String(60000 + k), respondidoEm: t - k * H });
      itens.push(i);
    }
  }
  // Rascunho do admin
  itens.push(Object.assign(novoItem({ marca: 'DAKOTA', ref: 'G9801', fotos: [foto('G9801', 6)], valores: ['189,90'] }), { status: 'rascunho' }));
  return itens;
}

export function criarBancoDemo() {
  const itens = gerar();
  const fins = [Date.now() - 864e5];
  const ouvintes = new Set();
  const avisar = (d) => ouvintes.forEach((o) => o.aoItem(structuredClone(d)));
  let perfis = [{ id: 'p1', usuario: 'danilolira', papel: 'admin' }];
  let sessao = null;
  const espera = (ms = 120) => new Promise((r) => setTimeout(r, ms));

  // Simula o escritório respondendo um código (a cada 30 s, só com o painel aberto)
  const simular = () => {
    const i = itens.find((x) => x.status === 'pendente' && !x.arquivado && !(x.motivoFoto && x.motivoFoto !== 'Já tenho as fotos'));
    if (!i) return;
    Object.assign(i, mudar.enviarCodigo(String(70000 + Math.floor(Math.random() * 9999)), Math.random() < 0.4 ? 'só tem do 35 ao 38' : ''));
    avisar(i);
  };
  window.__simularCodigo = simular;
  setInterval(() => { if (sessao && location.hash !== '#/esc' && !location.hash.startsWith('#/esc')) simular(); }, 30000);

  return {
    demo: true,
    async sessao() { return sessao; },
    async entrar(usuario) { await espera(300); sessao = { user: { id: 'p1' }, perfil: { ...perfis[0], usuario: usuario || 'danilolira' } }; return sessao; },
    async sair() { sessao = null; },
    async listar() { await espera(350); return structuredClone(itens); },
    async fins() { return [...fins]; },
    async alterar(id, mudancas) {
      await espera();
      const i = itens.find((x) => x.id === id);
      if (!i) throw new Error('Produto não encontrado.');
      Object.assign(i, mudancas);
      avisar(i);
      return structuredClone(i);
    },
    async inserir(docs) { await espera(); docs.forEach((d) => { itens.push(structuredClone(d)); avisar(d); }); return docs; },
    async marcarFim() { const em = Date.now(); fins.push(em); ouvintes.forEach((o) => o.aoFim(em)); return em; },
    async enviarFoto(blob) { return new Promise((ok) => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(blob); }); },
    ouvir(o) { ouvintes.add(o); o.aoStatus?.(true); return () => ouvintes.delete(o); },
    async acessos() { await espera(); return structuredClone(perfis); },
    async criarAcesso(usuario) { perfis.push({ id: uid(), usuario, papel: 'admin' }); },
  };
}
