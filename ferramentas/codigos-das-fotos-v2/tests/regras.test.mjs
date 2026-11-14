import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../js/regras.js';

const it = (p) => ({ id: 'a', marca: 'MOLECA', ref: '5579.103', fotos: ['https://x/a.jpg'], status: 'pendente', motivoFoto: '', ...p });

test('esperando código no escritório: pendente sem pendência de foto', () => {
  assert.equal(R.esperandoEsc(it()), true);
  assert.equal(R.esperandoEsc(it({ status: 'rascunho' })), false, 'rascunho nunca aparece para o escritório');
  assert.equal(R.esperandoEsc(it({ motivoFoto: 'Já tenho as fotos' })), true);
  assert.equal(R.esperandoEsc(it({ motivoFoto: 'Somente foto de capa' })), false);
});

test('pendências: com e sem código, e "já enviei" sai do alerta do escritório', () => {
  const sem = it({ motivoFoto: 'Não tenho fotos' });
  const com = it({ motivoFoto: 'Foto de baixa qualidade', status: 'respondido', codigo: '123' });
  assert.equal(R.alertaSemCodigo(sem), true);
  assert.equal(R.alertaComCodigo(com), true);
  assert.equal(R.pendenciaComCodigo(com), true);
  assert.equal(R.recebido(com), false, 'código com pendência não vai para recebidos');
  const enviado = { ...sem, ...R.mudar.jaEnviei() };
  assert.equal(R.alertaFoto(enviado), false);
  assert.equal(R.conferirFotos(enviado), true);
  const recebeu = { ...enviado, ...R.mudar.fotosRecebidas() };
  assert.equal(R.esperandoEsc(recebeu), true, 'fotos recebidas: volta para esperando código');
});

test('fluxo do código: enviar → recebido → feito → restaurar', () => {
  let i = { ...it(), ...R.mudar.enviarCodigo(' ab12 ', ' só 35 ') };
  assert.equal(i.codigo, 'AB12'); assert.equal(i.obs, 'só 35'); assert.equal(i.visto, false);
  assert.equal(R.recebido(i), true);
  i = { ...i, ...R.mudar.feito() };
  assert.equal(R.feito(i), true);
  i = { ...i, ...R.mudar.restaurar() };
  assert.equal(R.recebido(i), true);
});

test('site e atacado: site sem atacado vira lembrete; atacado finaliza', () => {
  const i = { ...it(), status: 'respondido', codigo: '1' };
  const s = { ...i, ...R.mudar.site(i, true, false) };
  assert.equal(R.lembrete(s), true);
  assert.equal(R.recebido(s), false);
  const a = { ...s, ...R.mudar.atacado(s, true) };
  assert.equal(a.status, 'feito'); assert.equal(R.lembrete(a), false);
  const ambos = { ...i, ...R.mudar.site(i, true, true) };
  assert.equal(ambos.status, 'feito'); assert.equal(ambos.enviadoAtacado, true);
});

test('não sei o código fica no painel para reenviar', () => {
  const i = { ...it(), ...R.mudar.naoSei('não achei') };
  assert.equal(R.aguardando(i), true);
  assert.equal(R.esperandoEsc(i), false);
  assert.equal(R.esperandoEsc({ ...i, ...R.mudar.reenviar() }), true);
});

test('arquivado some de todas as listas (nada é apagado)', () => {
  const i = { ...it(), ...R.mudar.arquivar() };
  for (const f of [R.esperandoEsc, R.aguardando, R.recebido, R.pendencia, R.feito, R.lembrete, R.alertaFoto]) assert.equal(f(i), false);
});

test('lista colada vira itens no formato original', () => {
  const l = R.lerLista('Fotos iniciadas em 23/09/26\nVIZZANO\n6584.100 — Falta código das fotos. Observação: a prata é 6584.100\nMARIAS SHOES\n2915A — Falta código das fotos.');
  assert.equal(l.length, 2);
  assert.deepEqual([l[0].marca, l[0].ref, l[0].nota, l[0].data], ['VIZZANO', '6584.100', 'a prata é 6584.100', '23/09/26']);
  const n = R.novoItem({ ...l[1], origem: 'lista' });
  assert.equal(n.marca, "MARIA'S SHOES"); assert.equal(n.status, 'rascunho'); assert.equal(n.id.length, 8);
});

test('texto para copiar no formato de sempre', () => {
  const t = R.textoCodigos([it({ codigo: 'X1', obs: 'ok' }), it({ ref: '1000', codigo: 'X2', marca: 'BEIRA RIO' })]);
  assert.equal(t, 'BEIRA RIO\n1000 — X2\n\nMOLECA\n5579.103 — X1 (ok)');
});
