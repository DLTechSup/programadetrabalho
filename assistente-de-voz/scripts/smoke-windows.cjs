// Teste de fumaça para um Windows de verdade: confere se os comandos do PowerShell funcionam
// (lista de programas, janelas, volume, pastas). Não abre nem fecha nada.
// Uso:  node scripts/smoke-windows.cjs
const janelas = require("../electron/engine/janelas.cjs");
const programas = require("../electron/engine/programas.cjs");

let falhas = 0;
async function passo(nome, fn) {
  const t0 = Date.now();
  try {
    const r = await fn();
    console.log(`OK    ${nome} (${Date.now() - t0} ms) ${r ?? ""}`);
  } catch (e) {
    falhas++;
    console.log(`FALHA ${nome}: ${e.message}`);
  }
}

(async () => {
  if (process.platform !== "win32") {
    console.log("Este teste só roda no Windows.");
    return;
  }
  await passo("janelas abertas", async () => {
    const j = await janelas.listar(0);
    return `${j.length} janelas: ${j.slice(0, 4).map((x) => `${x.proc}|${x.titulo.slice(0, 25)}`).join(" ; ")}`;
  });
  await passo("programas instalados (menu Iniciar + área de trabalho)", async () => {
    const p = await programas.listarInstalados();
    if (!p.length) throw new Error("nenhum programa encontrado");
    return `${p.length} itens, ex.: ${p.slice(0, 5).map((x) => x.nome).join(", ")}`;
  });
  await passo("volume (leitura)", async () => {
    const v = await janelas.volume("ler");
    return `${v.volume}% mudo=${v.mudo}`;
  });
  await passo("janelas de pasta (fechar nenhuma)", async () => {
    const n = await janelas.fecharPastas("Z:\\pasta-que-nao-existe");
    return `${n} fechadas`;
  });
  console.log(falhas ? `\n${falhas} falha(s).` : "\nTudo certo.");
  process.exit(falhas ? 1 : 0);
})();
