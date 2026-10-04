// Controle do Windows: janelas, teclado, volume, mídia e janelas de pasta.
// Tudo via PowerShell (sem instalar nada). O C# fica compilado em cache para as próximas chamadas serem rápidas.
const { ps, psJson, arr } = require("./ps.cjs");

const VERSAO_DLL = "1";

const CS_JANELAS = `
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;
public class JW {
  delegate bool EnumProc(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc p, IntPtr l);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] static extern int GetWindowTextLength(IntPtr h);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] static extern int GetWindowLong(IntPtr h, int i);
  [DllImport("user32.dll")] static extern bool IsIconic(IntPtr h);
  [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr h, int c);
  [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] static extern bool BringWindowToTop(IntPtr h);
  [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] static extern bool AttachThreadInput(uint a, uint b, bool f);
  [DllImport("kernel32.dll")] static extern uint GetCurrentThreadId();
  [DllImport("user32.dll")] static extern bool PostMessage(IntPtr h, uint m, IntPtr w, IntPtr l);
  [DllImport("dwmapi.dll")] static extern int DwmGetWindowAttribute(IntPtr h, int a, out int v, int size);
  public class Info { public long Hwnd; public uint Pid; public string Titulo; public bool Min; public bool Foco; }
  public static List<Info> Listar(uint ignorar) {
    List<Info> r = new List<Info>();
    IntPtr fg = GetForegroundWindow();
    EnumWindows(delegate(IntPtr h, IntPtr l) {
      if (!IsWindowVisible(h)) return true;
      int len = GetWindowTextLength(h);
      if (len == 0) return true;
      StringBuilder sb = new StringBuilder(len + 1);
      GetWindowText(h, sb, sb.Capacity);
      string t = sb.ToString();
      if (t == "Program Manager") return true;
      int ex = GetWindowLong(h, -20);
      if ((ex & 0x80) != 0 && (ex & 0x40000) == 0) return true;
      int cloaked = 0;
      DwmGetWindowAttribute(h, 14, out cloaked, 4);
      if (cloaked != 0) return true;
      uint pid = 0;
      GetWindowThreadProcessId(h, out pid);
      if (pid == ignorar) return true;
      Info i = new Info();
      i.Hwnd = h.ToInt64(); i.Pid = pid; i.Titulo = t; i.Min = IsIconic(h); i.Foco = (h == fg);
      r.Add(i);
      return true;
    }, IntPtr.Zero);
    return r;
  }
  public static void Focar(long hwnd) {
    IntPtr h = new IntPtr(hwnd);
    if (IsIconic(h)) ShowWindow(h, 9);
    IntPtr fg = GetForegroundWindow();
    uint ignorado;
    uint fgThread = GetWindowThreadProcessId(fg, out ignorado);
    uint eu = GetCurrentThreadId();
    AttachThreadInput(eu, fgThread, true);
    BringWindowToTop(h);
    SetForegroundWindow(h);
    AttachThreadInput(eu, fgThread, false);
  }
  public static void Mostrar(long hwnd, int cmd) { ShowWindow(new IntPtr(hwnd), cmd); }
  public static void Fechar(long hwnd) { PostMessage(new IntPtr(hwnd), 0x0010, IntPtr.Zero, IntPtr.Zero); }
  public static long Frente() { return GetForegroundWindow().ToInt64(); }
}
`;

const CS_VOLUME = `
using System;
using System.Runtime.InteropServices;
[Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IAudioEndpointVolume {
  int f(); int g(); int h(); int i();
  int SetMasterVolumeLevelScalar(float fLevel, Guid pguidEventContext);
  int j();
  int GetMasterVolumeLevelScalar(out float pfLevel);
  int k(); int l(); int m(); int n();
  int SetMute([MarshalAs(UnmanagedType.Bool)] bool bMute, Guid pguidEventContext);
  int GetMute(out bool pbMute);
}
[Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDevice { int Activate(ref Guid id, int clsCtx, int activationParams, out IAudioEndpointVolume aev); }
[Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDeviceEnumerator { int f(); int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice endpoint); }
[ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")] class MMDeviceEnumeratorComObject { }
public class JVol {
  static IAudioEndpointVolume Vol() {
    IMMDeviceEnumerator enumerator = new MMDeviceEnumeratorComObject() as IMMDeviceEnumerator;
    IMMDevice dev = null;
    Marshal.ThrowExceptionForHR(enumerator.GetDefaultAudioEndpoint(0, 1, out dev));
    IAudioEndpointVolume epv = null;
    Guid epvid = typeof(IAudioEndpointVolume).GUID;
    Marshal.ThrowExceptionForHR(dev.Activate(ref epvid, 23, 0, out epv));
    return epv;
  }
  public static float Volume {
    get { float v = -1; Marshal.ThrowExceptionForHR(Vol().GetMasterVolumeLevelScalar(out v)); return v; }
    set { Marshal.ThrowExceptionForHR(Vol().SetMasterVolumeLevelScalar(value, Guid.Empty)); }
  }
  public static bool Mute {
    get { bool m; Marshal.ThrowExceptionForHR(Vol().GetMute(out m)); return m; }
    set { Marshal.ThrowExceptionForHR(Vol().SetMute(value, Guid.Empty)); }
  }
}
`;

/** Trecho PowerShell que carrega um tipo C# (compila uma vez e guarda a DLL em %LOCALAPPDATA%). */
function carregarTipo(nome, cs) {
  return `
$cs_${nome} = @'
${cs}
'@
try {
  $dll_${nome} = Join-Path $env:LOCALAPPDATA 'AssistenteDeVoz\\${nome}-${VERSAO_DLL}.dll'
  if (-not (Test-Path $dll_${nome})) {
    New-Item -ItemType Directory -Force -Path (Split-Path $dll_${nome}) | Out-Null
    Add-Type -TypeDefinition $cs_${nome} -OutputAssembly $dll_${nome} -OutputType Library
  }
  Add-Type -Path $dll_${nome}
} catch { Add-Type -TypeDefinition $cs_${nome} }
`;
}

const q = (s) => `'${String(s).replace(/'/g, "''")}'`;

/** Escapa texto para o SendKeys do .NET (+ ^ % ~ ( ) { } [ ] têm significado especial). */
function escaparSendKeys(texto) {
  return String(texto).replace(/[+^%~(){}[\]]/g, (c) => `{${c}}`);
}

async function listar(ignorarPid = 0) {
  const lista = await psJson(
    carregarTipo("jw", CS_JANELAS) +
      `$lista = @([JW]::Listar([uint32]${Number(ignorarPid) || 0}) | ForEach-Object {
  $p = ''
  try { $p = (Get-Process -Id $_.Pid -ErrorAction Stop).ProcessName } catch {}
  [pscustomobject]@{ hwnd = [int64]$_.Hwnd; pid = [int]$_.Pid; titulo = $_.Titulo; proc = $p; min = [bool]$_.Min; foco = [bool]$_.Foco }
})
ConvertTo-Json -InputObject $lista -Compress`,
    { timeout: 60000 },
  );
  return arr(lista).filter(Boolean);
}

async function focar(hwnd) {
  await ps(carregarTipo("jw", CS_JANELAS) + `[JW]::Focar([int64]${Number(hwnd)})`);
}

/** modo: "minimizar" | "maximizar" | "restaurar" */
async function mostrar(hwnd, modo) {
  const cmd = { minimizar: 6, maximizar: 3, restaurar: 9 }[modo];
  if (!cmd) throw new Error("Modo de janela inválido.");
  await ps(carregarTipo("jw", CS_JANELAS) + `[JW]::Mostrar([int64]${Number(hwnd)}, ${cmd})`);
}

/** Pede para as janelas fecharem (como clicar no X: o programa pergunta se quer salvar). */
async function fechar(hwnds) {
  const lista = arr(hwnds).map((h) => `[int64]${Number(h)}`).join(",");
  if (!lista) return;
  await ps(carregarTipo("jw", CS_JANELAS) + `foreach ($h in @(${lista})) { [JW]::Fechar($h) }`);
}

async function matar(pids) {
  const lista = arr(pids).filter((p) => Number.isInteger(p) && p > 4).join(",");
  if (!lista) return;
  await ps(`foreach ($p in @(${lista})) { Stop-Process -Id $p -Force -ErrorAction SilentlyContinue }`);
}

/** Envia teclas (sintaxe SendKeys). Se `hwnd`, traz a janela para a frente antes. `depois` = outra sequência após `espera` ms. */
async function teclas(seq, { hwnd = 0, espera = 350, depois = null, esperaDepois = 450, digitar = null } = {}) {
  let s = `Add-Type -AssemblyName System.Windows.Forms\n`;
  if (hwnd) s = carregarTipo("jw", CS_JANELAS) + s + `[JW]::Focar([int64]${Number(hwnd)})\nStart-Sleep -Milliseconds ${espera}\n`;
  if (seq) s += `[System.Windows.Forms.SendKeys]::SendWait(${q(seq)})\n`;
  if (digitar != null) s += `Start-Sleep -Milliseconds ${esperaDepois}\n[System.Windows.Forms.SendKeys]::SendWait(${q(escaparSendKeys(digitar))})\n`;
  if (depois) s += `Start-Sleep -Milliseconds ${esperaDepois}\n[System.Windows.Forms.SendKeys]::SendWait(${q(depois)})\n`;
  await ps(s);
}

/** Teclas de mídia: pausar/tocar (179), próxima (176), anterior (177). */
async function midia(op) {
  const cod = { pausar: 179, tocar: 179, proxima: 176, anterior: 177 }[op];
  if (!cod) throw new Error("Comando de mídia inválido.");
  await ps(`(New-Object -ComObject WScript.Shell).SendKeys([char]${cod})`);
}

/** op: mais | menos | definir | mudo | som | ler. Devolve { volume: 0..100, mudo }. */
async function volume(op, valor = 0) {
  const v = Math.max(0, Math.min(100, Number(valor) || 0));
  const acao = {
    mais: `$n = [math]::Min(1.0, [JVol]::Volume + ${v / 100}); [JVol]::Volume = [single]$n; [JVol]::Mute = $false`,
    menos: `$n = [math]::Max(0.0, [JVol]::Volume - ${v / 100}); [JVol]::Volume = [single]$n`,
    definir: `[JVol]::Volume = [single]${v / 100}; if (${v} -gt 0) { [JVol]::Mute = $false }`,
    mudo: `[JVol]::Mute = $true`,
    som: `[JVol]::Mute = $false`,
    ler: ``,
  }[op];
  if (acao == null) throw new Error("Operação de volume inválida.");
  const r = await psJson(
    carregarTipo("jvol", CS_VOLUME) + `${acao}\n$r = [ordered]@{ volume = [int][math]::Round([JVol]::Volume * 100); mudo = [bool][JVol]::Mute }\nConvertTo-Json -InputObject $r -Compress`,
    { timeout: 60000 },
  );
  return r;
}

/** Fecha janelas do Explorador de Arquivos. `caminho` = só as dessa pasta; null = todas. */
async function fecharPastas(caminho) {
  const alvo = caminho ? q(caminho) : "$null";
  const n = await ps(`
$alvo = ${alvo}
$sh = New-Object -ComObject Shell.Application
$fechadas = 0
foreach ($w in @($sh.Windows())) {
  try {
    if ($w.FullName -notlike '*\\explorer.exe') { continue }
    $p = $w.Document.Folder.Self.Path
    if ($null -eq $alvo -or $p -ieq $alvo) { $w.Quit(); $fechadas++ }
  } catch {}
}
$fechadas`);
  return parseInt(n, 10) || 0;
}

/** Mostra a área de trabalho (ou volta às janelas, se já estiver mostrando). */
async function areaDeTrabalho() {
  await ps("(New-Object -ComObject Shell.Application).ToggleDesktop()");
}

const SCRIPTS_PARA_TESTE = () => [
  carregarTipo("jw", CS_JANELAS),
  carregarTipo("jvol", CS_VOLUME),
];

module.exports = { areaDeTrabalho, listar, focar, mostrar, fechar, matar, teclas, midia, volume, fecharPastas, escaparSendKeys, carregarTipo, CS_JANELAS, CS_VOLUME, SCRIPTS_PARA_TESTE };
