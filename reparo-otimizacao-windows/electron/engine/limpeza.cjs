// Categorias de limpeza: onde ficam os arquivos descartáveis e como removê-los.
// O renderer só envia IDs; os caminhos ficam aqui (nunca vêm da interface).
const path = require("node:path");
const fsReal = require("node:fs");
const { expandir, medir, apagarConteudo, Semaforo } = require("./fsutil.cjs");

/** Pastas-base do Windows (para os testes, dá pra apontar para uma pasta falsa). */
function montarEnv(e = process.env) {
  const unidade = (e.SystemDrive || "C:") + "\\";
  const windir = e.SystemRoot || e.windir || path.join(unidade, "Windows");
  return {
    UNIDADE: unidade,
    WINDIR: windir,
    USERS: path.join(unidade, "Users"),
    PROGRAMDATA: e.ProgramData || path.join(unidade, "ProgramData"),
  };
}

const LOCAL = (e, ...resto) => [e.USERS, "*", "AppData", "Local", ...resto];
const ROAMING = (e, ...resto) => [e.USERS, "*", "AppData", "Roaming", ...resto];
const NAVEGADOR = (e, base, ...perfil) => LOCAL(e, ...base, "User Data", "*", ...perfil);

const CATEGORIAS = {
  temp_usuario: { alvos: (e) => [LOCAL(e, "Temp")] },
  temp_windows: { alvos: (e) => [[e.WINDIR, "Temp"]] },
  cache_navegadores: {
    alvos: (e) => {
      const l = [];
      for (const base of [["Google", "Chrome"], ["Microsoft", "Edge"], ["BraveSoftware", "Brave-Browser"]]) {
        for (const p of [["Cache"], ["Code Cache"], ["GPUCache"], ["Service Worker", "CacheStorage"]]) l.push(NAVEGADOR(e, base, ...p));
      }
      l.push(LOCAL(e, "Mozilla", "Firefox", "Profiles", "*", "cache2"));
      return l;
    },
  },
  cache_apps: {
    alvos: (e) => {
      const l = [];
      for (const app of ["discord", "Slack", "Microsoft\\Teams", "Spotify"]) {
        for (const sub of ["Cache", "Code Cache", "GPUCache"]) l.push(ROAMING(e, ...app.split("\\"), sub));
      }
      l.push(LOCAL(e, "Spotify", "Storage"));
      l.push(LOCAL(e, "Packages", "MSTeams_8wekyb3d8bbwe", "LocalCache"));
      return l;
    },
  },
  miniaturas: { alvos: (e) => [LOCAL(e, "Microsoft", "Windows", "Explorer", "thumbcache_*.db")] },
  shader_cache: {
    alvos: (e) => [LOCAL(e, "D3DSCache"), LOCAL(e, "NVIDIA", "DXCache"), LOCAL(e, "NVIDIA", "GLCache"), LOCAL(e, "AMD", "DxCache")],
  },
  relatorios_erro: {
    alvos: (e) => [
      [e.PROGRAMDATA, "Microsoft", "Windows", "WER", "ReportQueue"],
      [e.PROGRAMDATA, "Microsoft", "Windows", "WER", "ReportArchive"],
      LOCAL(e, "Microsoft", "Windows", "WER"),
      LOCAL(e, "CrashDumps"),
      [e.WINDIR, "Minidump"],
      [e.WINDIR, "MEMORY.DMP"],
      [e.WINDIR, "LiveKernelReports", "*.dmp"],
    ],
  },
  logs_windows: { alvos: (e) => [[e.WINDIR, "Logs", "CBS", "*.log"], [e.WINDIR, "Logs", "DISM", "*.log"], [e.WINDIR, "Panther", "*.log"]] },
  windows_update: {
    alvos: (e) => [[e.WINDIR, "SoftwareDistribution", "Download"]],
    antes: ["Stop-Service wuauserv -Force -ErrorAction SilentlyContinue", "Stop-Service bits -Force -ErrorAction SilentlyContinue"],
    depois: ["Start-Service bits -ErrorAction SilentlyContinue", "Start-Service wuauserv -ErrorAction SilentlyContinue"],
  },
  entrega_cache: {
    alvos: (e) => [
      [e.WINDIR, "ServiceProfiles", "NetworkService", "AppData", "Local", "Microsoft", "Windows", "DeliveryOptimization", "Cache"],
      [e.PROGRAMDATA, "Microsoft", "Windows", "DeliveryOptimization", "Cache"],
    ],
  },
  lixeira: {
    alvos: (e) => [[e.UNIDADE, "$Recycle.Bin"]],
    antes: ["Clear-RecycleBin -DriveLetter C -Force -ErrorAction SilentlyContinue"],
  },
  componentes: { alvos: () => [], comando: { arquivo: "Dism.exe", args: ["/Online", "/Cleanup-Image", "/StartComponentCleanup"], timeout: 60 * 60 * 1000 } },
  windows_old: {
    alvos: (e) => [[e.UNIDADE, "Windows.old"]],
    removerPasta: true,
  },
  hibernacao: {
    alvos: (e) => [[e.UNIDADE, "hiberfil.sys"]],
    comando: { arquivo: "powercfg.exe", args: ["/h", "off"], timeout: 60000 },
  },
};

/** Mede todas as categorias (ou só as pedidas). Devolve [{id, bytes|null, arquivos, existe}]. */
async function escanearLimpeza(env, { ids, fs = fsReal, onItem = () => {} } = {}) {
  const lista = ids || Object.keys(CATEGORIAS);
  const sem = new Semaforo(24);
  return Promise.all(
    lista.map(async (id) => {
      const cat = CATEGORIAS[id];
      if (!cat) return { id, bytes: 0, arquivos: 0, existe: false };
      if (!cat.alvos(env).length) {
        const r = { id, bytes: null, arquivos: 0, existe: true };
        onItem(r);
        return r;
      }
      let bytes = 0;
      let arquivos = 0;
      let existe = false;
      for (const padrao of cat.alvos(env)) {
        for (const alvo of await expandir(padrao, fs)) {
          existe = true;
          const m = await medir(alvo, fs, sem);
          bytes += m.bytes;
          arquivos += m.arquivos;
        }
      }
      const r = { id, bytes, arquivos, existe };
      onItem(r);
      return r;
    }),
  );
}

/**
 * Executa a limpeza de uma categoria. `ctx` = { env, ps, executar, fs? }.
 * Devolve { liberado (bytes|null), mensagem }.
 */
async function limparCategoria(id, ctx) {
  const cat = CATEGORIAS[id];
  if (!cat) throw new Error(`Categoria de limpeza desconhecida: ${id}`);
  const fs = ctx.fs || fsReal;
  const medirTudo = async () => {
    let total = 0;
    for (const padrao of cat.alvos(ctx.env)) for (const alvo of await expandir(padrao, fs)) total += (await medir(alvo, fs)).bytes;
    return total;
  };

  // Categorias que rodam só um comando do Windows (DISM, powercfg).
  if (cat.comando) {
    const antes = cat.alvos(ctx.env).length ? await medirTudo() : null;
    const r = await ctx.executar(cat.comando.arquivo, cat.comando.args, { timeout: cat.comando.timeout });
    if (!r.ok) throw new Error((r.stderr || r.stdout || `código ${r.code}`).split("\n").slice(-2).join(" "));
    const depois = antes == null ? null : await medirTudo();
    return { liberado: antes == null ? null : Math.max(0, antes - depois), mensagem: "Concluído." };
  }

  const antes = await medirTudo();

  if (cat.removerPasta) {
    // Windows.old: precisa assumir a posse dos arquivos antes de apagar.
    const pasta = path.join(ctx.env.UNIDADE, "Windows.old");
    try {
      await fs.promises.lstat(pasta);
    } catch {
      return { liberado: 0, mensagem: "Não existe." };
    }
    await ctx.ps(
      `$y = switch ((Get-UICulture).TwoLetterISOLanguageName) { 'pt' {'S'} 'es' {'S'} 'it' {'S'} 'fr' {'O'} 'de' {'J'} default {'Y'} };` +
        `$p = '${pasta.replace(/'/g, "''")}';` +
        `takeown.exe /F $p /R /A /D $y | Out-Null;` +
        `icacls.exe $p /grant '*S-1-5-32-544:(OI)(CI)F' /T /C /Q | Out-Null;` +
        `cmd.exe /c rd /s /q ('"' + $p + '"')`,
      { timeout: 60 * 60 * 1000 },
    ).catch(() => {});
  } else {
    for (const cmd of cat.antes || []) await ctx.ps(cmd).catch(() => {});
    for (const padrao of cat.alvos(ctx.env)) {
      for (const alvo of await expandir(padrao, fs)) await apagarConteudo(alvo, fs);
    }
    for (const cmd of cat.depois || []) await ctx.ps(cmd).catch(() => {});
  }
  const depois = await medirTudo();
  const liberado = Math.max(0, antes - depois);
  return {
    liberado,
    mensagem: depois > 0 ? `Alguns itens estavam em uso e foram mantidos (${formatarBytes(depois)}).` : "Limpo.",
  };
}

function formatarBytes(n) {
  const u = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  while (n >= 1024 && i < u.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(i === 0 ? 0 : 1)} ${u[i]}`;
}

module.exports = { CATEGORIAS, montarEnv, escanearLimpeza, limparCategoria, formatarBytes };
