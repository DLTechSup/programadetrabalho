// Implementação das tarefas de otimização/reparo. As descrições ficam em catalogo.json.
// Cada função devolve { mensagem } e lança erro se não conseguir.
const { ps, executar } = require("./ps.cjs");
const inicializacao = require("./inicializacao.cjs");

const REINICIAR_EXPLORER = `
Stop-Process -Name explorer -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
if (-not (Get-Process explorer -ErrorAction SilentlyContinue)) { Start-Process explorer.exe }
`;

const defRegistro = (caminho) => `if (-not (Test-Path '${caminho}')) { New-Item -Path '${caminho}' -Force | Out-Null };`;

/** Últimas linhas úteis da saída de um programa (sfc, dism, chkdsk). */
function resumo(r, linhas = 3) {
  const t = (r.stdout || r.stderr || "").split("\n").map((l) => l.trim()).filter((l) => l && !/^[\d\s%.\-=\[\]]+$/.test(l));
  return t.slice(-linhas).join(" ");
}

const TAREFAS = {
  energia_alto_desempenho: async () => ({
    mensagem: await ps(`
$g = '8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c'
if ((powercfg /list | Out-String) -notmatch $g) { powercfg -duplicatescheme $g | Out-Null }
powercfg /setactive $g
if ($LASTEXITCODE -ne 0) { throw 'Este computador não permite o plano de Alto desempenho.' }
'Plano de Alto desempenho ativado.'`),
  }),

  efeitos_visuais: async () => {
    await ps(`
${defRegistro("HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize")}
Set-ItemProperty 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize' -Name EnableTransparency -Value 0 -Type DWord
$a = 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced'
Set-ItemProperty $a -Name TaskbarAnimations -Value 0 -Type DWord
Set-ItemProperty $a -Name ListviewAlphaSelect -Value 0 -Type DWord
Set-ItemProperty $a -Name ListviewShadow -Value 0 -Type DWord
${defRegistro("HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\VisualEffects")}
Set-ItemProperty 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\VisualEffects' -Name VisualFXSetting -Value 3 -Type DWord
Set-ItemProperty 'HKCU:\\Control Panel\\Desktop\\WindowMetrics' -Name MinAnimate -Value '0' -Type String`);
    return { mensagem: "Transparência e animações desligadas (efeito completo ao reentrar no Windows)." };
  },

  apps_segundo_plano: async () => {
    await ps(`
${defRegistro("HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\BackgroundAccessApplications")}
Set-ItemProperty 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\BackgroundAccessApplications' -Name GlobalUserDisabled -Value 1 -Type DWord
${defRegistro("HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Search")}
Set-ItemProperty 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Search' -Name BackgroundAppGlobalToggle -Value 0 -Type DWord`);
    return { mensagem: "Aplicativos em segundo plano bloqueados." };
  },

  desativar_telemetria: async () => {
    await ps(`
$s = Get-Service DiagTrack -ErrorAction SilentlyContinue
if (-not $s) { throw 'Serviço não encontrado neste Windows.' }
Stop-Service DiagTrack -Force -ErrorAction SilentlyContinue
Set-Service DiagTrack -StartupType Disabled`);
    return { mensagem: "Serviço de telemetria desativado." };
  },

  sysmain_hdd: async () => {
    await ps(`
$s = Get-Service SysMain -ErrorAction SilentlyContinue
if (-not $s) { throw 'Serviço não encontrado neste Windows.' }
Stop-Service SysMain -Force -ErrorAction SilentlyContinue
Set-Service SysMain -StartupType Disabled`);
    return { mensagem: "SysMain (Superfetch) desativado." };
  },

  inicializacao_pesados: async () => {
    const nomes = await inicializacao.desativarSugeridos();
    return { mensagem: nomes.length ? `Desativados na inicialização: ${nomes.join(", ")}.` : "Nenhum programa pesado encontrado na inicialização." };
  },

  otimizar_unidade: async () => {
    const r = await executar("defrag.exe", ["C:", "/O"], { timeout: 3 * 60 * 60 * 1000 });
    if (!r.ok) throw new Error(resumo(r) || `defrag retornou ${r.code}`);
    return { mensagem: "Unidade C: otimizada." };
  },

  liberar_memoria: async () => ({
    mensagem: await ps(`
Add-Type -Namespace WinMem -Name Api -MemberDefinition '[DllImport("psapi.dll")] public static extern bool EmptyWorkingSet(IntPtr h);'
$antes = (Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory
foreach ($p in Get-Process) { try { [void][WinMem.Api]::EmptyWorkingSet($p.Handle) } catch {} }
Start-Sleep -Seconds 2
$depois = (Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory
$mb = [math]::Round(($depois - $antes) / 1024)
if ($mb -lt 0) { $mb = 0 }
"Memória liberada: $mb MB."`),
  }),

  pagefile_auto: async () => {
    const m = await ps(`
$cs = Get-WmiObject Win32_ComputerSystem -EnableAllPrivileges
if ($cs.AutomaticManagedPagefile) { 'Já estava automático.' }
else { $cs.AutomaticManagedPagefile = $true; [void]$cs.Put(); 'Memória virtual agora é gerenciada pelo Windows (reinicie o PC).' }`);
    return { mensagem: m, reiniciar: !/Já estava/.test(m) };
  },

  explorer_reset_visualizacao: async () => {
    await ps(`
$b = 'HKCU:\\Software\\Classes\\Local Settings\\Software\\Microsoft\\Windows\\Shell'
Remove-Item -Path "$b\\Bags" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item -Path "$b\\BagMRU" -Recurse -Force -ErrorAction SilentlyContinue
New-Item -Path "$b\\Bags\\AllFolders\\Shell" -Force | Out-Null
Set-ItemProperty -Path "$b\\Bags\\AllFolders\\Shell" -Name FolderType -Value 'NotSpecified' -Type String
${REINICIAR_EXPLORER}`);
    return { mensagem: "Modo de exibição das pastas zerado e Explorador reiniciado." };
  },

  explorer_miniaturas: async () => {
    await ps(`
Stop-Process -Name explorer -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1
$d = Join-Path $env:LOCALAPPDATA 'Microsoft\\Windows\\Explorer'
Get-ChildItem $d -Include 'thumbcache_*.db','iconcache_*.db' -Force -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue
Remove-Item (Join-Path $env:LOCALAPPDATA 'IconCache.db') -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1
if (-not (Get-Process explorer -ErrorAction SilentlyContinue)) { Start-Process explorer.exe }`);
    return { mensagem: "Cache de ícones e miniaturas apagado (será recriado automaticamente)." };
  },

  explorer_acesso_rapido: async () => {
    await ps(`
$a = 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced'
Set-ItemProperty $a -Name LaunchTo -Value 1 -Type DWord
$e = 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer'
Set-ItemProperty $e -Name ShowRecent -Value 0 -Type DWord
Set-ItemProperty $e -Name ShowFrequent -Value 0 -Type DWord
$r = Join-Path $env:APPDATA 'Microsoft\\Windows\\Recent'
foreach ($sub in 'AutomaticDestinations','CustomDestinations') {
  Get-ChildItem (Join-Path $r $sub) -File -Force -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue
}
${REINICIAR_EXPLORER}`);
    return { mensagem: "Explorador abre em \"Este Computador\" e o histórico de recentes foi limpo." };
  },

  dns_limpar: async () => {
    const r = await executar("ipconfig.exe", ["/flushdns"]);
    if (!r.ok) throw new Error(resumo(r) || "Falha ao limpar o DNS.");
    return { mensagem: "Cache de DNS limpo." };
  },

  dns_rapido: async () => ({
    mensagem: await ps(`
$ad = @(Get-NetAdapter | Where-Object { $_.Status -eq 'Up' -and $_.HardwareInterface })
if ($ad.Count -eq 0) { throw 'Nenhum adaptador de rede ativo.' }
foreach ($a in $ad) { Set-DnsClientServerAddress -InterfaceIndex $a.ifIndex -ServerAddresses ('1.1.1.1','8.8.8.8') }
Clear-DnsClientCache
'DNS 1.1.1.1 / 8.8.8.8 aplicado em: ' + (($ad | ForEach-Object { $_.Name }) -join ', ')`),
  }),

  dns_automatico: async () => ({
    mensagem: await ps(`
$ad = @(Get-NetAdapter | Where-Object { $_.Status -eq 'Up' -and $_.HardwareInterface })
foreach ($a in $ad) { Set-DnsClientServerAddress -InterfaceIndex $a.ifIndex -ResetServerAddresses }
Clear-DnsClientCache
'DNS automático restaurado.'`),
  }),

  rede_reset: async () => {
    const a = await executar("netsh.exe", ["winsock", "reset"]);
    const b = await executar("netsh.exe", ["int", "ip", "reset"]);
    await executar("ipconfig.exe", ["/flushdns"]);
    if (!a.ok && !b.ok) throw new Error(resumo(a) || "Falha ao reparar a rede.");
    return { mensagem: "Winsock e TCP/IP reiniciados. Reinicie o computador.", reiniciar: true };
  },

  entrega_otimizada: async () => {
    await ps(`
${defRegistro("HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\DeliveryOptimization")}
Set-ItemProperty 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\DeliveryOptimization' -Name DODownloadMode -Value 0 -Type DWord`);
    return { mensagem: "Compartilhamento de atualizações desativado." };
  },

  chkdsk_scan: async () => {
    const r = await executar("chkdsk.exe", ["C:", "/scan"], { timeout: 2 * 60 * 60 * 1000 });
    const txt = `${r.stdout}\n${r.stderr}`;
    if (r.code === 0) return { mensagem: "Nenhum erro encontrado no disco." };
    return { mensagem: `O CHKDSK encontrou problemas (código ${r.code}). ${resumo(r, 2)} Recomenda-se fazer backup e agendar "chkdsk C: /f" com reinicialização.`, aviso: true, detalhe: txt.slice(-600) };
  },

  sfc: async () => {
    const r = await executar("sfc.exe", ["/scannow"], { timeout: 2 * 60 * 60 * 1000 });
    if (r.code !== 0 && !r.stdout) throw new Error(resumo(r) || `SFC retornou ${r.code}`);
    return { mensagem: resumo(r, 2) || "Verificação concluída." };
  },

  dism_restore: async () => {
    const r = await executar("Dism.exe", ["/Online", "/Cleanup-Image", "/RestoreHealth"], { timeout: 3 * 60 * 60 * 1000 });
    if (!r.ok && r.code !== 3010) throw new Error(resumo(r) || `DISM retornou ${r.code}`);
    return { mensagem: "Imagem do Windows verificada e reparada.", reiniciar: r.code === 3010 };
  },

  windows_update_reparar: async () => {
    await ps(
      `
$servicos = 'wuauserv','bits','cryptsvc','msiserver'
foreach ($s in $servicos) { Stop-Service $s -Force -ErrorAction SilentlyContinue }
foreach ($p in 'C:\\Windows\\SoftwareDistribution','C:\\Windows\\System32\\catroot2') {
  if (Test-Path $p) {
    if (Test-Path ($p + '.old')) { Remove-Item ($p + '.old') -Recurse -Force -ErrorAction SilentlyContinue }
    Rename-Item $p ((Split-Path $p -Leaf) + '.old') -ErrorAction SilentlyContinue
  }
}
foreach ($s in $servicos) { Start-Service $s -ErrorAction SilentlyContinue }`,
      { timeout: 5 * 60 * 1000 },
    );
    return { mensagem: "Componentes do Windows Update reiniciados. Procure atualizações novamente.", reiniciar: false };
  },

  defender_rapido: async () => {
    await ps(`Start-MpScan -ScanType QuickScan`, { timeout: 2 * 60 * 60 * 1000 });
    return { mensagem: "Verificação rápida concluída. Veja o resultado em Segurança do Windows." };
  },
};

module.exports = { TAREFAS, REINICIAR_EXPLORER, resumo };
