// Diagnóstico do computador (uma única chamada ao PowerShell) e memória/processos.
const { psJson, ps, dadosPS, arr } = require("./ps.cjs");

const SCRIPT_DIAGNOSTICO = `
function T($b) { try { & $b } catch { $null } }
$o = [ordered]@{}
$os = T { Get-CimInstance Win32_OperatingSystem }
$cs = T { Get-CimInstance Win32_ComputerSystem }
$cpu = T { Get-CimInstance Win32_Processor | Select-Object -First 1 }
$o.windows = if ($os) { [string]$os.Caption } else { '' }
$o.versao = if ($os) { [string]$os.Version } else { '' }
$o.fabricante = if ($cs) { ([string]$cs.Manufacturer + ' ' + [string]$cs.Model).Trim() } else { '' }
$o.ramTotal = if ($os) { [int64]$os.TotalVisibleMemorySize * 1024 } else { 0 }
$o.ramLivre = if ($os) { [int64]$os.FreePhysicalMemory * 1024 } else { 0 }
$o.uptimeDias = if ($os) { [math]::Round(((Get-Date) - $os.LastBootUpTime).TotalDays, 1) } else { 0 }
$o.cpu = if ($cpu) { ([string]$cpu.Name).Trim() } else { '' }
$o.nucleos = if ($cpu) { [int]$cpu.NumberOfLogicalProcessors } else { 0 }
$o.cpuUso = if ($cpu -and $cpu.LoadPercentage -ne $null) { [int]$cpu.LoadPercentage } else { 0 }
$o.pagefileAutomatico = if ($cs) { [bool]$cs.AutomaticManagedPagefile } else { $true }
$o.notebook = $false
$gab = T { (Get-CimInstance Win32_SystemEnclosure).ChassisTypes }
if ($gab) { foreach ($g in @($gab)) { if (@(8,9,10,11,12,14,18,21,30,31,32) -contains [int]$g) { $o.notebook = $true } } }
$d = T { Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='C:'" }
$o.discoTotal = if ($d) { [int64]$d.Size } else { 0 }
$o.discoLivre = if ($d) { [int64]$d.FreeSpace } else { 0 }
$o.tipoDisco = 'Desconhecido'
$o.saudeDisco = 'Desconhecida'
$pd = T { Get-Partition -DriveLetter C | Get-Disk | Get-PhysicalDisk | Select-Object -First 1 }
if ($pd) {
  $m = [string]$pd.MediaType
  if ($m -eq 'SSD' -or $m -eq 'HDD') { $o.tipoDisco = $m }
  elseif ([string]$pd.BusType -eq 'NVMe') { $o.tipoDisco = 'SSD' }
  $o.saudeDisco = [string]$pd.HealthStatus
}
$pl = T { powercfg /getactivescheme | Out-String }
$o.planoEnergia = ''
if ($pl -match '([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})') { $o.planoEnergia = $Matches[1].ToLower() }
$av = T { Get-CimInstance -Namespace root/SecurityCenter2 -ClassName AntiVirusProduct | ForEach-Object { [string]$_.displayName } }
$o.antivirus = @(@($av) | Where-Object { $_ } | Select-Object -Unique)
$srv = @{}
foreach ($n in 'SysMain','DiagTrack','WSearch') {
  $s = T { Get-Service $n -ErrorAction Stop }
  $srv[$n] = if ($s) { [string]$s.StartType + '/' + [string]$s.Status } else { 'ausente' }
}
$o.servicos = $srv
$p = T { Get-ItemProperty 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize' -ErrorAction Stop }
$o.transparencia = if ($p -and $p.EnableTransparency -ne $null) { [int]$p.EnableTransparency -eq 1 } else { $true }
$ex = T { Get-ItemProperty 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced' -ErrorAction Stop }
$o.explorerAbreEmEsteComputador = if ($ex -and $ex.LaunchTo -ne $null) { [int]$ex.LaunchTo -eq 1 } else { $false }
$bg = T { Get-ItemProperty 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\BackgroundAccessApplications' -ErrorAction Stop }
$o.appsSegundoPlanoBloqueados = if ($bg -and $bg.GlobalUserDisabled -ne $null) { [int]$bg.GlobalUserDisabled -eq 1 } else { $false }
$dns = T { Get-NetAdapter | Where-Object { $_.Status -eq 'Up' -and $_.HardwareInterface } | ForEach-Object { (Get-DnsClientServerAddress -InterfaceIndex $_.ifIndex -AddressFamily IPv4).ServerAddresses } }
$o.dns = @(@($dns) | Where-Object { $_ } | Select-Object -Unique)
ConvertTo-Json -InputObject $o -Compress -Depth 5
`;

async function diagnosticar() {
  const d = await psJson(SCRIPT_DIAGNOSTICO, { timeout: 120000 });
  d.antivirus = arr(d.antivirus);
  d.dns = arr(d.dns);
  return d;
}

const SCRIPT_PROCESSOS = `
$os = Get-CimInstance Win32_OperatingSystem
$grupos = Get-Process | Group-Object ProcessName | ForEach-Object {
  [pscustomobject]@{
    nome = $_.Name
    qtd = $_.Count
    mem = [int64](($_.Group | Measure-Object -Property WorkingSet64 -Sum).Sum)
    pids = @($_.Group | ForEach-Object { $_.Id })
  }
} | Sort-Object mem -Descending | Select-Object -First 25
$r = [ordered]@{
  total = [int64]$os.TotalVisibleMemorySize * 1024
  livre = [int64]$os.FreePhysicalMemory * 1024
  processos = @($grupos)
}
ConvertTo-Json -InputObject $r -Compress -Depth 4
`;

async function processos() {
  const r = await psJson(SCRIPT_PROCESSOS);
  r.processos = arr(r.processos).map((p) => ({ ...p, pids: arr(p.pids) }));
  return r;
}

// Processos que nunca podem ser encerrados por aqui (derrubam o Windows ou a segurança).
const PROTEGIDOS = new Set([
  "system", "idle", "registry", "smss", "csrss", "wininit", "winlogon", "services", "lsass", "svchost", "dwm", "fontdrvhost",
  "msmpeng", "nissrv", "securityhealthservice", "memory compression", "spoolsv", "audiodg", "sihost", "taskhostw", "ctfmon",
  "reparowindows", "electron", "wmiprvse", "lsm", "conhost", "runtimebroker", "searchindexer", "explorer",
]);

async function encerrar(nome, pids) {
  if (PROTEGIDOS.has(String(nome).toLowerCase())) throw new Error(`"${nome}" é um processo do sistema e não pode ser encerrado aqui.`);
  const lista = arr(pids).filter((p) => Number.isInteger(p) && p > 4);
  if (!lista.length) throw new Error("Processo inválido.");
  await ps(`${dadosPS("pids", lista)} foreach ($p in @($pids)) { Stop-Process -Id ([int]$p) -Force -ErrorAction SilentlyContinue }`);
  return lista.length;
}

module.exports = { diagnosticar, processos, encerrar, PROTEGIDOS, SCRIPT_DIAGNOSTICO, SCRIPT_PROCESSOS };
