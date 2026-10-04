// Executa uma lista de tarefas/limpezas na ordem certa, avisando o progresso de cada uma.
const catalogo = require("./catalogo.json");
const { TAREFAS } = require("./tarefas.cjs");
const { CATEGORIAS, limparCategoria } = require("./limpeza.cjs");
const { ps } = require("./ps.cjs");

const PREFIXO_LIMPEZA = "limpar:";
const ORDEM = new Map();
catalogo.limpeza.forEach((l, i) => ORDEM.set(PREFIXO_LIMPEZA + l.id, i));
catalogo.tarefas.forEach((t, i) => ORDEM.set(t.id, 1000 + (t.duracao === "longa" ? 1000 : 0) + i));

const SCRIPT_RESTAURACAO = `
try {
  Checkpoint-Computer -Description 'Reparo e Otimização do Windows (DL Tech)' -RestorePointType MODIFY_SETTINGS -ErrorAction Stop
  'Ponto de restauração criado.'
} catch { 'Ponto de restauração não criado: ' + $_.Exception.Message }
`;

function validar(ids) {
  const vistos = new Set();
  for (const id of ids) {
    if (typeof id !== "string") throw new Error("ID inválido.");
    const ok = id.startsWith(PREFIXO_LIMPEZA) ? !!CATEGORIAS[id.slice(PREFIXO_LIMPEZA.length)] : !!TAREFAS[id];
    if (!ok) throw new Error(`Tarefa desconhecida: ${id}`);
    vistos.add(id);
  }
  return [...vistos].sort((a, b) => ORDEM.get(a) - ORDEM.get(b));
}

/**
 * ids: ["limpar:temp_usuario", "dns_limpar", ...]. onEvento recebe {id, estado, mensagem, liberado, reiniciar}.
 * ctx = { env, ps, executar }. cancelado() permite parar entre uma tarefa e outra.
 */
async function executar(ids, { ctx, onEvento = () => {}, pontoRestauracao = false, cancelado = () => false }) {
  const lista = validar(ids);
  const resultados = [];
  if (pontoRestauracao && lista.some((id) => !id.startsWith(PREFIXO_LIMPEZA))) {
    onEvento({ id: "ponto_restauracao", estado: "rodando", mensagem: "" });
    let mensagem;
    try {
      mensagem = await ps(SCRIPT_RESTAURACAO, { timeout: 5 * 60 * 1000 });
    } catch (e) {
      mensagem = `Ponto de restauração não criado: ${e.message}`;
    }
    onEvento({ id: "ponto_restauracao", estado: "ok", mensagem });
  }
  for (const id of lista) {
    if (cancelado()) {
      const r = { id, estado: "ignorado", mensagem: "Cancelado." };
      resultados.push(r);
      onEvento(r);
      continue;
    }
    onEvento({ id, estado: "rodando", mensagem: "" });
    let r;
    try {
      if (id.startsWith(PREFIXO_LIMPEZA)) {
        const x = await limparCategoria(id.slice(PREFIXO_LIMPEZA.length), ctx);
        r = { id, estado: "ok", mensagem: x.mensagem, liberado: x.liberado };
      } else {
        const x = await TAREFAS[id](ctx);
        r = { id, estado: x.aviso ? "aviso" : "ok", mensagem: x.mensagem, reiniciar: !!x.reiniciar };
      }
    } catch (e) {
      r = { id, estado: "erro", mensagem: String((e && e.message) || e) };
    }
    resultados.push(r);
    onEvento(r);
  }
  return resultados;
}

module.exports = { executar, validar, PREFIXO_LIMPEZA };
