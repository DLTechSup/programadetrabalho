// Programas que abrem junto com o Windows. Desativar usa o mesmo mecanismo do
// Gerenciador de Tarefas (StartupApproved), então é 100% reversível.
const { ps, psJson, dadosPS, arr } = require("./ps.cjs");

const ESSENCIAIS =
  /defender|windows ?security|security ?health|sechealth|antivir|avast|avg\b|kaspersky|norton|mcafee|eset|bitdefender|malwarebytes|sophos|trend ?micro|panda|realtek|rtk|nahimic|waves|audio|nvidia|nvcpl|nvbackend|intel|igfx|radeon|synaptics|touchpad|bluetooth|btvstack|ctfmon|wacom|vmware|virtualbox|hotkey|fn ?key|lenovo|dell|asus|acer|samsung|cloudflare|vpn|\b(amd|ime|hp|elan|alps)\b/i;

const SUGERIDOS = [
  [/teams/i, "Microsoft Teams"],
  [/skype/i, "Skype"],
  [/spotify/i, "Spotify"],
  [/discord/i, "Discord"],
  [/steam/i, "Steam"],
  [/epicgames|epic ?games/i, "Epic Games"],
  [/origin|eadesktop|ea ?app/i, "EA / Origin"],
  [/battle\.?net|blizzard/i, "Battle.net"],
  [/utorrent|bittorrent|qbittorrent/i, "Cliente de torrent"],
  [/zoom/i, "Zoom"],
  [/adobe|acrotray|creative ?cloud|ccxprocess|aam ?updater/i, "Adobe (atualizador/serviços em segundo plano)"],
  [/jusched|sunjava|java ?update|javaw?updater/i, "Atualizador do Java"],
  [/itunes|ipodservice|apple ?push|applemobile/i, "Apple / iTunes"],
  [/ccleaner/i, "CCleaner"],
  [/yourphone|phone ?link/i, "Vincular ao Celular"],
  [/cortana/i, "Cortana"],
  [/whatsapp|telegram|viber|slack/i, "Mensageiro"],
  [/microsoftedgeautolaunch|edgeautolaunch/i, "Edge (abrir ao iniciar)"],
  [/googleupdate|googlechromeautolaunch/i, "Atualizador do Google"],
  [/onedrive/i, "OneDrive (mantenha se o cliente usa sincronização)"],
  [/dropbox|googledrive|gdrive/i, "Sincronização de nuvem"],
  [/opera|brave|firefox/i, "Navegador abrindo sozinho"],
  [/officeclicktorun|ose\.exe|msoia|officebackground/i, "Atualizador do Office"],
];

/** Decide se vale sugerir desativar. Segurança e drivers nunca são sugeridos. */
function classificar(nome, comando) {
  const texto = `${nome} ${comando || ""}`;
  if (ESSENCIAIS.test(nome) || /\\windows\\system32\\|\\driverstore\\/i.test(comando || "")) return { sugerido: false, essencial: true, motivo: "Segurança, driver ou fabricante: mantenha." };
  for (const [re, rotulo] of SUGERIDOS) {
    if (re.test(texto)) {
      const onedrive = /onedrive|dropbox|googledrive/i.test(texto);
      return { sugerido: !onedrive, essencial: false, motivo: rotulo };
    }
  }
  return { sugerido: false, essencial: false, motivo: "" };
}

const SCRIPT_LISTAR = `
$saida = New-Object System.Collections.ArrayList
$apr = 'Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved'
function Ativo($raiz, $sub, $nome) {
  try {
    $v = (Get-ItemProperty -Path ($raiz + $apr + '\\' + $sub) -ErrorAction Stop).$nome
    if ($v -and $v.Length -gt 0 -and ($v[0] % 2) -eq 1) { return $false }
  } catch {}
  return $true
}
$runs = @(
  @{ raiz='HKCU:\\'; ch='HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run'; sub='Run'; escopo='Usuário atual' },
  @{ raiz='HKLM:\\'; ch='HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run'; sub='Run'; escopo='Todos os usuários' },
  @{ raiz='HKLM:\\'; ch='HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Run'; sub='Run32'; escopo='Todos os usuários (32 bits)' }
)
foreach ($r in $runs) {
  if (Test-Path $r.ch) {
    $k = Get-Item $r.ch
    foreach ($n in $k.GetValueNames()) {
      if ($n) {
        [void]$saida.Add([pscustomobject]@{ nome=$n; comando=[string]$k.GetValue($n); escopo=$r.escopo; raiz=$r.raiz; sub=$r.sub; origem='registro'; ativo=(Ativo $r.raiz $r.sub $n) })
      }
    }
  }
}
$pastas = @(
  @{ raiz='HKCU:\\'; dir=(Join-Path $env:APPDATA 'Microsoft\\Windows\\Start Menu\\Programs\\Startup'); escopo='Usuário atual' },
  @{ raiz='HKLM:\\'; dir=(Join-Path $env:ProgramData 'Microsoft\\Windows\\Start Menu\\Programs\\Startup'); escopo='Todos os usuários' }
)
foreach ($p in $pastas) {
  if (Test-Path $p.dir) {
    Get-ChildItem $p.dir -File -ErrorAction SilentlyContinue | Where-Object { $_.Name -ne 'desktop.ini' } | ForEach-Object {
      [void]$saida.Add([pscustomobject]@{ nome=$_.Name; comando=$_.FullName; escopo=$p.escopo; raiz=$p.raiz; sub='StartupFolder'; origem='pasta'; ativo=(Ativo $p.raiz 'StartupFolder' $_.Name) })
    }
  }
}
ConvertTo-Json -InputObject @($saida) -Compress -Depth 4
`;

async function listar() {
  const bruto = arr(await psJson(SCRIPT_LISTAR));
  return bruto.map((i) => ({
    id: `${i.raiz}|${i.sub}|${i.nome}`,
    nome: i.nome,
    comando: i.comando,
    escopo: i.escopo,
    origem: i.origem,
    ativo: !!i.ativo,
    ...classificar(i.nome, i.comando),
  }));
}

/** itens: [{id, ativar:boolean}] — o id vem de listar(). */
async function aplicar(itens) {
  const lista = itens.map((i) => {
    const [raiz, sub, ...resto] = String(i.id).split("|");
    return { raiz, sub, nome: resto.join("|"), ativar: !!i.ativar };
  });
  for (const i of lista) {
    if (!["HKCU:\\", "HKLM:\\"].includes(i.raiz) || !["Run", "Run32", "StartupFolder"].includes(i.sub) || !i.nome) throw new Error("Item inválido.");
  }
  if (!lista.length) return 0;
  await ps(
    dadosPS("itens", lista) +
      `$base = 'Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved';
foreach ($i in @($itens)) {
  $caminho = $i.raiz + $base + '\\' + $i.sub
  if (-not (Test-Path $caminho)) { New-Item -Path $caminho -Force | Out-Null }
  $b = New-Object byte[] 12
  if ($i.ativar) { $b[0] = 2 } else { $b[0] = 3 }
  Set-ItemProperty -Path $caminho -Name $i.nome -Value $b -Type Binary
}`,
  );
  return lista.length;
}

/** Desativa só o que `classificar` marcou como sugerido. Devolve os nomes desativados. */
async function desativarSugeridos() {
  const alvos = (await listar()).filter((i) => i.ativo && i.sugerido);
  if (!alvos.length) return [];
  await aplicar(alvos.map((i) => ({ id: i.id, ativar: false })));
  return alvos.map((i) => i.nome);
}

module.exports = { classificar, listar, aplicar, desativarSugeridos };
