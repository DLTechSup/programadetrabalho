// Teste de fumaça para rodar em um Windows de verdade (usado no GitHub Actions):
// executa o motor sem a interface e confere se os comandos do PowerShell funcionam.
// Uso:  node scripts/smoke-windows.cjs [--tarefas]     (--tarefas também executa os ajustes de verdade)
const os = require("node:os");
const sistema = require("../electron/engine/sistema.cjs");
const inicializacao = require("../electron/engine/inicializacao.cjs");
const { montarEnv, escanearLimpeza } = require("../electron/engine/limpeza.cjs");
const { escanearDisco } = require("../electron/engine/scanner.cjs");
const { executar } = require("../electron/engine/executor.cjs");
const { ps, executar: executarPrograma } = require("../electron/engine/ps.cjs");
const { testarInternet } = require("../electron/engine/rede.cjs");

const falhas = [];
async function passo(nome, fn) {
  const t0 = Date.now();
  try {
    const r = await fn();
    console.log(`✔ ${nome} (${Date.now() - t0} ms)`);
    return r;
  } catch (e) {
    console.log(`✘ ${nome}: ${e.message}`);
    falhas.push(nome);
    return null;
  }
}

(async () => {
  if (process.platform !== "win32") {
    console.log("Este teste só roda no Windows.");
    process.exit(0);
  }
  const d = await passo("diagnosticar", () => sistema.diagnosticar());
  if (d) console.log(JSON.stringify(d, null, 1));
  const p = await passo("processos", () => sistema.processos());
  if (p) console.log(`  ${p.processos.length} grupos, maior: ${p.processos[0].nome} ${(p.processos[0].mem / 1048576).toFixed(0)} MB`);
  const ini = await passo("inicialização: listar", () => inicializacao.listar());
  if (ini) console.log(ini.map((i) => `  ${i.ativo ? "[on ]" : "[off]"} ${i.nome} ${i.sugerido ? "(sugerido)" : ""}${i.essencial ? "(essencial)" : ""}`).join("\n"));
  const env = montarEnv();
  const lim = await passo("limpeza: escanear", () => escanearLimpeza(env));
  if (lim) console.log(lim.map((i) => `  ${i.id}: ${i.bytes == null ? "n/d" : (i.bytes / 1048576).toFixed(1) + " MB"}`).join("\n"));
  await passo("scanner de disco (pasta Temp)", async () => {
    const r = await escanearDisco(os.tmpdir(), { tamanhoMinArquivo: 1024 * 1024 });
    console.log(`  ${r.arquivos} arquivos, ${(r.totalBytes / 1048576).toFixed(1)} MB, erros: ${r.erros}`);
  });
  await passo("internet", async () => console.log(JSON.stringify(await testarInternet())));
  await passo("administrador (net session)", async () => {
    const r = await executarPrograma("net.exe", ["session"]);
    console.log(`  admin: ${r.ok}`);
  });
  await passo("powershell: sintaxe do script de ponto de restauração", () => ps("[scriptblock]::Create('Checkpoint-Computer -Description x') | Out-Null; 1"));

  if (process.argv.includes("--tarefas")) {
    const ids = [
      "limpar:temp_usuario", "limpar:cache_navegadores", "limpar:miniaturas", "limpar:shader_cache", "limpar:relatorios_erro", "limpar:logs_windows", "limpar:lixeira",
      "energia_alto_desempenho", "efeitos_visuais", "apps_segundo_plano", "inicializacao_pesados", "liberar_memoria", "pagefile_auto",
      "explorer_reset_visualizacao", "explorer_miniaturas", "explorer_acesso_rapido", "dns_limpar", "dns_rapido", "dns_automatico", "entrega_otimizada",
    ];
    const resultados = await executar(ids, { ctx: { env, ps, executar: executarPrograma }, onEvento: () => {} });
    console.log("\nTarefas:");
    for (const r of resultados) console.log(`  [${r.estado.toUpperCase()}] ${r.id}: ${r.mensagem}`);
    const erros = resultados.filter((r) => r.estado === "erro");
    if (erros.length) console.log(`\n${erros.length} tarefa(s) com erro (veja acima).`);
    if (process.argv.includes("--estrito") && erros.length) falhas.push(...erros.map((e) => e.id));
  }
  if (falhas.length) {
    console.log(`\nFALHAS: ${falhas.join(", ")}`);
    process.exit(1);
  }
  console.log("\nTudo certo.");
})();
