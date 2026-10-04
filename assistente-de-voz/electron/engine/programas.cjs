// Programas instalados (menu Iniciar + atalhos da área de trabalho), sites conhecidos
// e correspondência entre o nome falado e programas/janelas abertas.
const { psJson, arr } = require("./ps.cjs");
const { normalizar, similaridade, melhores, vencedorClaro } = require("./texto.cjs");

const SCRIPT_LISTAR = `
$apps = @(Get-StartApps | ForEach-Object { [pscustomobject]@{ nome = [string]$_.Name; id = [string]$_.AppID } })
$pastas = @([Environment]::GetFolderPath('Desktop'), [Environment]::GetFolderPath('CommonDesktopDirectory'))
$atalhos = @()
foreach ($d in $pastas) {
  if ($d -and (Test-Path $d)) {
    $atalhos += @(Get-ChildItem -LiteralPath $d -File -ErrorAction SilentlyContinue | Where-Object { $_.Extension -in '.lnk', '.url', '.exe' } | ForEach-Object { [pscustomobject]@{ nome = [string]$_.BaseName; caminho = [string]$_.FullName } })
  }
}
ConvertTo-Json -InputObject ([ordered]@{ apps = $apps; atalhos = $atalhos }) -Compress -Depth 4
`;

/** Lista tudo que dá para abrir: [{nome, tipo:"app", id} | {nome, tipo:"arquivo", caminho}] */
async function listarInstalados() {
  const r = await psJson(SCRIPT_LISTAR, { timeout: 60000 });
  const vistos = new Set();
  const out = [];
  for (const a of arr(r.atalhos)) {
    if (!a || !a.nome) continue;
    out.push({ nome: a.nome, tipo: "arquivo", caminho: a.caminho });
    vistos.add(normalizar(a.nome));
  }
  for (const a of arr(r.apps)) {
    if (!a || !a.nome || !a.id) continue;
    const k = normalizar(a.nome);
    if (vistos.has(k)) continue; // atalho da área de trabalho com o mesmo nome já cobre
    vistos.add(k);
    out.push({ nome: a.nome, tipo: "app", id: a.id });
  }
  return out;
}

/** Modos de falar o mesmo programa. Chave = fala; valor = termos a procurar. */
const SINONIMOS = {
  "vs code": ["visual studio code"],
  "vscode": ["visual studio code"],
  "zap": ["whatsapp"],
  "zap zap": ["whatsapp"],
  "whats": ["whatsapp"],
  "navegador": ["google chrome", "microsoft edge", "firefox"],
  "internet": ["google chrome", "microsoft edge", "firefox"],
  "explorador": ["explorador de arquivos", "file explorer"],
  "explorer": ["explorador de arquivos", "file explorer"],
  "gerenciador de tarefas": ["gerenciador de tarefas", "task manager"],
  "power point": ["powerpoint"],
  "pawer point": ["powerpoint"],
  "calculadora": ["calculadora", "calculator"],
  "bloco de notas": ["bloco de notas", "notepad"],
  "painel de controle": ["painel de controle", "control panel"],
  "configuracoes": ["configuracoes", "settings"],
  "prompt": ["prompt de comando", "command prompt", "terminal"],
  "cmd": ["prompt de comando", "command prompt"],
  "terminal": ["terminal", "windows terminal", "prompt de comando"],
};

const SITES = {
  "youtube": "https://www.youtube.com",
  "google": "https://www.google.com",
  "gmail": "https://mail.google.com",
  "email": "https://mail.google.com",
  "whatsapp web": "https://web.whatsapp.com",
  "zap web": "https://web.whatsapp.com",
  "facebook": "https://www.facebook.com",
  "instagram": "https://www.instagram.com",
  "twitter": "https://x.com",
  "linkedin": "https://www.linkedin.com",
  "mercado livre": "https://www.mercadolivre.com.br",
  "amazon": "https://www.amazon.com.br",
  "netflix": "https://www.netflix.com",
  "google drive": "https://drive.google.com",
  "drive": "https://drive.google.com",
  "google maps": "https://maps.google.com",
  "maps": "https://maps.google.com",
  "github": "https://github.com",
  "chat gpt": "https://chatgpt.com",
  "chatgpt": "https://chatgpt.com",
  "claude": "https://claude.ai",
  "bling": "https://www.bling.com.br",
};

/** Transforma "globo ponto com" / "globo com br" em uma URL. */
function urlDoSite(falado) {
  const n = normalizar(falado).replace(/^(?:o |a |site |pagina )+/, "");
  if (n in SITES) return SITES[n];
  let t = n.replace(/\bponto\b/g, ".").replace(/\s+/g, "");
  const m = n.match(/^(.+?) (?:ponto )?(com br|gov br|org br|com|net|org|br|gov|edu|io)$/);
  if (m) t = `${m[1].replace(/\s+/g, "")}.${m[2].replace(" ", ".")}`;
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(t)) return `https://${t}`;
  return null;
}

/** Procura o programa pelo nome falado. Devolve candidatos ordenados e se há vencedor claro. */
function acharPrograma(lista, falado, aliases = []) {
  const n = normalizar(falado);
  // apelidos do usuário têm prioridade
  for (const al of aliases) {
    if ((al.falas || []).some((f) => normalizar(f) === n)) return { alias: al, candidatos: [], claro: true };
  }
  const termos = [n, ...(SINONIMOS[n] || []).map(normalizar)];
  let achados = [];
  for (const t of termos) {
    for (const r of melhores(t, lista, { nome: (x) => x.nome, minimo: 0.82 })) {
      const ja = achados.find((x) => x.item === r.item);
      if (!ja) achados.push(r);
      else ja.score = Math.max(ja.score, r.score);
    }
  }
  achados.sort((a, b) => b.score - a.score);
  // sinônimo de várias opções ("navegador"): escolhe o que existe, na ordem dada
  if (SINONIMOS[n] && SINONIMOS[n].length > 1 && achados.length > 1) {
    const ordem = SINONIMOS[n].map(normalizar);
    achados.sort((a, b) => ordem.findIndex((o) => normalizar(a.item.nome).includes(o)) - ordem.findIndex((o) => normalizar(b.item.nome).includes(o)));
    return { alias: null, candidatos: achados.slice(0, 6), claro: true };
  }
  return { alias: null, candidatos: achados.slice(0, 6), claro: vencedorClaro(achados) };
}

// nomes de processo para cada programa falado (para achar a janela aberta)
const PROCESSOS = {
  "chrome": ["chrome"], "google chrome": ["chrome"], "edge": ["msedge"], "microsoft edge": ["msedge"], "firefox": ["firefox"], "brave": ["brave"], "opera": ["opera"],
  "whatsapp": ["whatsapp", "whatsapp.root"], "zap": ["whatsapp", "whatsapp.root"],
  "excel": ["excel"], "word": ["winword"], "powerpoint": ["powerpnt"], "power point": ["powerpnt"], "outlook": ["outlook", "olk"],
  "bloco de notas": ["notepad"], "notepad": ["notepad"], "paint": ["mspaint"], "spotify": ["spotify"], "discord": ["discord"],
  "teams": ["ms-teams", "teams"], "vs code": ["code"], "visual studio code": ["code"], "vlc": ["vlc"], "calculadora": ["calculatorapp", "calculator"],
};

const PROTEGIDOS = new Set(["system", "idle", "registry", "smss", "csrss", "wininit", "winlogon", "services", "lsass", "svchost", "dwm", "fontdrvhost", "msmpeng", "securityhealthservice", "spoolsv", "audiodg", "sihost", "taskhostw", "ctfmon", "assistentedevoz", "electron", "conhost", "runtimebroker", "searchindexer", "textinputhost", "startmenuexperiencehost", "shellexperiencehost"]);

/**
 * Entre as janelas abertas ({hwnd,pid,titulo,proc}), acha as do programa falado.
 * Devolve [{janela, score}] ordenadas; pode ter várias (ex.: várias janelas do Chrome).
 */
function acharJanelas(janelas, falado) {
  const n = normalizar(falado);
  const procsAlvo = new Set((PROCESSOS[n] || []).map(normalizar));
  const res = [];
  for (const j of janelas) {
    const proc = normalizar(j.proc || "");
    let score = 0;
    if (procsAlvo.size && procsAlvo.has(proc)) score = 1;
    else {
      score = Math.max(score, similaridade(n, proc) * 0.97);
      const titulo = String(j.titulo || "");
      const ultimo = titulo.split(/\s[-–—|]\s/).pop() || titulo;
      score = Math.max(score, similaridade(n, ultimo) * 0.97);
      const tt = normalizar(titulo).split(" ");
      if (n.split(" ").every((p) => tt.includes(p))) score = Math.max(score, 0.88);
    }
    if (score >= 0.82) res.push({ janela: j, score });
  }
  return res.sort((a, b) => b.score - a.score || (b.janela.foco ? 1 : 0) - (a.janela.foco ? 1 : 0));
}

module.exports = { listarInstalados, acharPrograma, acharJanelas, urlDoSite, SITES, SINONIMOS, PROCESSOS, PROTEGIDOS, SCRIPT_LISTAR };
