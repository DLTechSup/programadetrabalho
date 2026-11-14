// Regras do Códigos das Fotos (as mesmas do site original), sem acesso a banco ou tela.
// O "item" é exatamente o doc gravado na tabela itens.

export const MOTIVOS = [
  'Já tenho as fotos',
  'Somente foto de capa',
  'Não tenho fotos',
  'Foto de baixa qualidade',
  'Falta o escritório mandar as fotos',
  'Falta receber as fotos',
];

const ALIAS_MARCAS = { 'MARIAS SHOES': "MARIA'S SHOES", "MARIA'S SHOES": "MARIA'S SHOES" };
export const normMarca = (m) => {
  const k = (m || '').trim().toUpperCase().replace(/[’']/g, "'");
  return ALIAS_MARCAS[k] || k;
};

export const fotoValida = (u) => typeof u === 'string' && u.length > 0 && !u.startsWith('{{');
export const fotos = (i) => (i.fotos || []).filter(fotoValida);
export const capa = (i) => fotos(i)[0] || '';
export const valor = (i) => (i.valores || []).filter(Boolean)[0] || '';

// ---------- Situações ----------
export const arquivado = (i) => i.arquivado === true;
export const pendFoto = (i) => Boolean(i.motivoFoto) && i.motivoFoto !== 'Já tenho as fotos';
const ok = (i) => !arquivado(i);

// Escritório
export const esperandoEsc = (i) => ok(i) && i.status === 'pendente' && !pendFoto(i);
export const alertaFoto = (i) => ok(i) && i.status !== 'feito' && i.status !== 'rascunho' && pendFoto(i) && !i.fotosEnviadas;
export const alertaSemCodigo = (i) => alertaFoto(i) && i.status !== 'respondido';
export const alertaComCodigo = (i) => alertaFoto(i) && i.status === 'respondido';

// Painel
export const aguardando = (i) => ok(i) && ['rascunho', 'pendente', 'naosei'].includes(i.status) && !pendFoto(i);
export const rascunho = (i) => ok(i) && i.status === 'rascunho';
export const lembrete = (i) => ok(i) && Boolean(i.enviadoSite) && !i.enviadoAtacado;
export const recebido = (i) => ok(i) && i.status === 'respondido' && !pendFoto(i) && !lembrete(i);
export const pendencia = (i) => ok(i) && i.status !== 'feito' && pendFoto(i);
export const pendenciaComCodigo = (i) => pendencia(i) && i.status === 'respondido';
export const pendenciaSemCodigo = (i) => pendencia(i) && i.status !== 'respondido';
export const conferirFotos = (i) => ok(i) && i.status !== 'feito' && Boolean(i.fotosEnviadas);
export const feito = (i) => ok(i) && i.status === 'feito' && Boolean(i.feitoEm);

export function etiquetaPendencia(i) {
  if (!i.codigo) return { txt: 'Falta código e foto', tom: 'pend' };
  if (i.conferidoNaoRecebido) return { txt: 'Fotos não recebidas ainda', tom: 'pend-forte' };
  if (i.fotosEnviadas) return { txt: 'Conferir recebimento', tom: 'wait' };
  return { txt: 'Código ok · aguardando foto', tom: 'done' };
}

export const STATUS_TXT = {
  rascunho: 'Rascunho', pendente: 'Com o escritório', naosei: 'Escritório não sabe',
  respondido: 'Código recebido', feito: 'No site',
};

// ---------- Alterações (cada função devolve só os campos que mudam) ----------
const agora = () => Date.now();
export const mudar = {
  enviarCodigo: (codigo, obs) => ({ status: 'respondido', codigo: codigo.trim().toUpperCase(), obs: (obs || '').trim(), respondidoEm: agora(), visto: false }),
  naoSei: (obs) => ({ status: 'naosei', obs: (obs || '').trim(), respondidoEm: agora() }),
  jaEnviei: () => ({ fotosEnviadas: true, fotosEnviadasEm: agora(), conferidoNaoRecebido: false, visto: false }),
  fotosRecebidas: () => ({ motivoFoto: '', nota: '', notaPainel: '', fotosEnviadas: false, conferidoNaoRecebido: false }),
  naoRecebi: () => ({ fotosEnviadas: false, conferidoNaoRecebido: true, conferidoEm: agora() }),
  feito: () => ({ status: 'feito', feitoEm: agora(), visto: true }),
  restaurar: () => ({ status: 'respondido', feitoEm: null, enviadoSite: false, enviadoAtacado: false, visto: false }),
  enviarRascunho: () => ({ status: 'pendente', criado: agora() }),
  reenviar: () => ({ status: 'pendente', obs: '' }),
  visto: () => ({ visto: true }),
  arquivar: () => ({ arquivado: true, arquivadoEm: agora() }),
  desarquivar: () => ({ arquivado: false }),
  // Site: se ainda não está feito, a pergunta do atacado decide (confirmou → vai para os dois sites)
  site: (i, marcado, tambemAtacado) => {
    if (!marcado) return { enviadoSite: false };
    if (i.status !== 'feito' && tambemAtacado) return { enviadoSite: true, enviadoAtacado: true, status: 'feito', feitoEm: agora(), visto: true };
    return { enviadoSite: true };
  },
  atacado: (i, marcado) => {
    if (!marcado) return { enviadoAtacado: false };
    const p = { enviadoSite: true, enviadoAtacado: true, visto: true };
    if (i.status !== 'feito') Object.assign(p, { status: 'feito', feitoEm: agora() });
    return p;
  },
};

// ---------- Novo item (mesmo formato do site original) ----------
export const uid = () => Math.random().toString(36).slice(2, 10);
export const hoje = () => new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });

export const novoItem = (p) => ({
  id: uid(), marca: normMarca(p.marca), ref: (p.ref || '').trim(), nota: p.nota || '', motivoFoto: p.motivoFoto || '',
  valores: p.valores || [], data: p.data || hoje(), fotos: p.fotos || [], status: p.status || 'rascunho',
  origem: p.origem || 'avulso', cadastradoEm: p.cadastradoEm || agora(), codigo: '', obs: '', criado: agora(), visto: true,
});

// Lê a lista colada no formato do WhatsApp ("MARCA" + "REF — Falta código...")
export function lerLista(txt) {
  let marca = '', data = hoje();
  const out = [];
  for (const bruto of (txt || '').split(/\r?\n/)) {
    const l = bruto.trim();
    if (!l) continue;
    const d = l.match(/^fotos iniciadas em (.+)$/i);
    if (d) { data = d[1].replace(/\.$/, ''); continue; }
    if (/^(c[óo]digos|total)/i.test(l)) continue;
    const s = l.match(/^(.+?)\s+[—–-]\s+(.*)$/);
    if (s && /falta/i.test(s[2])) {
      const o = s[2].match(/observa[çc][ãa]o:\s*(.+)$/i);
      out.push({ marca: marca || '—', ref: s[1].trim(), nota: o ? o[1].trim() : '', data });
      continue;
    }
    marca = l.replace(/:$/, '').toUpperCase();
  }
  return out;
}

// ---------- Utilidades ----------
export const chave = (marca, ref) => `${normMarca(marca)}|${(ref || '').trim().toUpperCase()}`;

export function porMarca(itens, ordem = (a, b) => a.ref.localeCompare(b.ref, 'pt-BR')) {
  const m = new Map();
  for (const i of itens) {
    const k = normMarca(i.marca) || '—';
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(i);
  }
  return new Map([...m].sort((a, b) => a[0].localeCompare(b[0], 'pt-BR')).map(([k, l]) => [k, l.sort(ordem)]));
}

export function buscar(itens, termo) {
  const q = (termo || '').trim().toUpperCase();
  if (!q) return itens;
  return itens.filter((i) => `${i.marca} ${i.ref} ${i.codigo || ''}`.toUpperCase().includes(q));
}

// Texto para copiar no formato que já é usado ("MARCA\nREF — CÓDIGO (obs)")
export const textoCodigos = (itens) =>
  [...porMarca(itens)].map(([m, l]) => m + '\n' + l.map((i) => `${i.ref} — ${i.codigo}${i.obs ? ` (${i.obs})` : ''}`).join('\n')).join('\n\n');

export const diaKey = (t) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
export const hora = (t) => (t ? new Date(t).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '');
export const hm = (t) => new Date(t).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
