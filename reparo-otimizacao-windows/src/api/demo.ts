// Dados de demonstração: permitem ver e testar a interface sem estar em um Windows de verdade.
import type { Api, Diagnostico, EventoTarefa, ItemInicializacao, ItemLimpeza, NoPasta, Processos, ProgressoScan, ResultadoScan } from "./types";

const GB = 1024 ** 3;
const MB = 1024 ** 2;
const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

const DIAG: Diagnostico = {
  windows: "Microsoft Windows 10 Pro",
  versao: "10.0.19045",
  fabricante: "Dell Inc. Inspiron 3470",
  ramTotal: 4 * GB,
  ramLivre: 0.5 * GB,
  uptimeDias: 12.4,
  cpu: "Intel(R) Core(TM) i3-8100 CPU @ 3.60GHz",
  nucleos: 4,
  cpuUso: 38,
  pagefileAutomatico: false,
  notebook: false,
  discoTotal: 465 * GB,
  discoLivre: 21 * GB,
  tipoDisco: "HDD",
  saudeDisco: "Healthy",
  planoEnergia: "381b4222-f694-41f0-9685-ff5bb260df2e",
  antivirus: ["Windows Defender", "Avast Free Antivirus"],
  servicos: { SysMain: "Automatic/Running", DiagTrack: "Automatic/Running", WSearch: "Automatic/Running" },
  transparencia: true,
  explorerAbreEmEsteComputador: false,
  appsSegundoPlanoBloqueados: false,
  dns: ["192.168.0.1"],
};

const LIMPEZA: ItemLimpeza[] = [
  { id: "temp_usuario", bytes: 6.4 * GB, arquivos: 18420, existe: true },
  { id: "temp_windows", bytes: 1.1 * GB, arquivos: 940, existe: true },
  { id: "cache_navegadores", bytes: 3.2 * GB, arquivos: 22100, existe: true },
  { id: "cache_apps", bytes: 820 * MB, arquivos: 3100, existe: true },
  { id: "miniaturas", bytes: 410 * MB, arquivos: 12, existe: true },
  { id: "shader_cache", bytes: 150 * MB, arquivos: 80, existe: true },
  { id: "relatorios_erro", bytes: 4.8 * GB, arquivos: 130, existe: true },
  { id: "logs_windows", bytes: 380 * MB, arquivos: 60, existe: true },
  { id: "windows_update", bytes: 2.7 * GB, arquivos: 410, existe: true },
  { id: "entrega_cache", bytes: 0, arquivos: 0, existe: false },
  { id: "lixeira", bytes: 1.9 * GB, arquivos: 230, existe: true },
  { id: "componentes", bytes: null, arquivos: 0, existe: true },
  { id: "windows_old", bytes: 14.6 * GB, arquivos: 190000, existe: true },
  { id: "hibernacao", bytes: 3.2 * GB, arquivos: 1, existe: true },
];

const no = (nome: string, caminho: string, bytes: number, filhos: NoPasta[] = [], arquivos = Math.round(bytes / (180 * 1024))): NoPasta => ({ nome, caminho, bytes, arquivos, filhos });

function arvoreDemo(): NoPasta {
  const u = "C:\\Users\\Cliente";
  return no("C:\\", "C:\\", 444 * GB, [
    no("Users", "C:\\Users", 168 * GB, [
      no("Cliente", u, 166 * GB, [
        no("Videos", `${u}\\Videos`, 62 * GB, [no("Viagem 2022", `${u}\\Videos\\Viagem 2022`, 38 * GB), no("Festas", `${u}\\Videos\\Festas`, 24 * GB)]),
        no("Downloads", `${u}\\Downloads`, 41 * GB, [no("Instaladores", `${u}\\Downloads\\Instaladores`, 28 * GB)]),
        no("AppData", `${u}\\AppData`, 33 * GB, [no("Local", `${u}\\AppData\\Local`, 29 * GB, [no("Temp", `${u}\\AppData\\Local\\Temp`, 6.4 * GB), no("Google", `${u}\\AppData\\Local\\Google`, 4.2 * GB)])]),
        no("Documents", `${u}\\Documents`, 19 * GB),
        no("Pictures", `${u}\\Pictures`, 11 * GB),
      ]),
    ]),
    no("Windows", "C:\\Windows", 52 * GB, [no("WinSxS", "C:\\Windows\\WinSxS", 14 * GB), no("System32", "C:\\Windows\\System32", 11 * GB), no("SoftwareDistribution", "C:\\Windows\\SoftwareDistribution", 2.7 * GB), no("Installer", "C:\\Windows\\Installer", 5.8 * GB)]),
    no("Windows.old", "C:\\Windows.old", 14.6 * GB),
    no("Program Files (x86)", "C:\\Program Files (x86)", 32 * GB, [no("Steam", "C:\\Program Files (x86)\\Steam", 24 * GB)]),
    no("Program Files", "C:\\Program Files", 21 * GB),
    no("ProgramData", "C:\\ProgramData", 9 * GB),
    no("$Recycle.Bin", "C:\\$Recycle.Bin", 1.9 * GB),
  ]);
}

const ARQ = (nome: string, pasta: string, gb: number, tipo: string, diasAtras: number) => ({
  caminho: `${pasta}\\${nome}`, nome, pasta, bytes: gb * GB, tipo, modificado: Date.now() - diasAtras * 86400000,
});

function resultadoDemo(): ResultadoScan {
  return {
    raiz: "C:\\", totalBytes: 444 * GB, arquivos: 612340, pastas: 98230, erros: 14, duracaoMs: 187000, cancelado: false, arvore: arvoreDemo(),
    maiores: [
      ARQ("Viagem Gramado 4K.mp4", "C:\\Users\\Cliente\\Videos\\Viagem 2022", 14.2, "videos", 820),
      ARQ("Windows11_22H2.iso", "C:\\Users\\Cliente\\Downloads\\Instaladores", 5.4, "imagensDisco", 400),
      ARQ("MEMORY.DMP", "C:\\Windows", 4.8, "logsDumps", 60),
      ARQ("Festa Aniversario.mkv", "C:\\Users\\Cliente\\Videos\\Festas", 4.1, "videos", 1100),
      ARQ("hiberfil.sys", "C:\\", 3.2, "outros", 5),
      ARQ("pagefile.sys", "C:\\", 4.0, "outros", 1),
      ARQ("Office2019_Setup.exe", "C:\\Users\\Cliente\\Downloads", 3.1, "programas", 700),
      ARQ("backup_notebook.zip", "C:\\Users\\Cliente\\Downloads", 2.9, "compactados", 500),
      ARQ("VirtualBox_Win7.vdi", "C:\\Users\\Cliente\\Documents", 2.6, "imagensDisco", 900),
      ARQ("Outlook.pst", "C:\\Users\\Cliente\\Documents\\Outlook", 2.2, "bancos", 3),
      ARQ("fotos_casamento.rar", "C:\\Users\\Cliente\\Downloads", 1.8, "compactados", 1300),
      ARQ("setup_jogo.msi", "C:\\Users\\Cliente\\Downloads", 1.1, "programas", 900),
    ],
    porTipo: {
      videos: { bytes: 118 * GB, arquivos: 640 }, imagens: { bytes: 41 * GB, arquivos: 38200 }, audio: { bytes: 9 * GB, arquivos: 2100 },
      documentos: { bytes: 12 * GB, arquivos: 9400 }, compactados: { bytes: 26 * GB, arquivos: 310 }, imagensDisco: { bytes: 24 * GB, arquivos: 14 },
      programas: { bytes: 63 * GB, arquivos: 150000 }, logsDumps: { bytes: 9 * GB, arquivos: 22000 }, bancos: { bytes: 6 * GB, arquivos: 900 }, outros: { bytes: 136 * GB, arquivos: 390000 },
    },
  };
}

const INICIO: ItemInicializacao[] = [
  { id: "HKCU:\\|Run|Microsoft Teams", nome: "Microsoft Teams", comando: "C:\\Users\\Cliente\\AppData\\Local\\Microsoft\\Teams\\Update.exe --processStart Teams.exe", escopo: "Usuário atual", origem: "registro", ativo: true, sugerido: true, essencial: false, motivo: "Microsoft Teams" },
  { id: "HKCU:\\|Run|Spotify", nome: "Spotify", comando: "C:\\Users\\Cliente\\AppData\\Roaming\\Spotify\\Spotify.exe /minimized", escopo: "Usuário atual", origem: "registro", ativo: true, sugerido: true, essencial: false, motivo: "Spotify" },
  { id: "HKCU:\\|Run|Discord", nome: "Discord", comando: "C:\\Users\\Cliente\\AppData\\Local\\Discord\\Update.exe --processStart Discord.exe", escopo: "Usuário atual", origem: "registro", ativo: true, sugerido: true, essencial: false, motivo: "Discord" },
  { id: "HKLM:\\|Run|AdobeAAMUpdater-1.0", nome: "Adobe Updater Startup Utility", comando: "C:\\Program Files (x86)\\Common Files\\Adobe\\OOBE\\PDApp\\UWA\\UpdaterStartupUtility.exe", escopo: "Todos os usuários", origem: "registro", ativo: true, sugerido: true, essencial: false, motivo: "Adobe (atualizador/serviços em segundo plano)" },
  { id: "HKCU:\\|Run|OneDrive", nome: "OneDrive", comando: "C:\\Users\\Cliente\\AppData\\Local\\Microsoft\\OneDrive\\OneDrive.exe /background", escopo: "Usuário atual", origem: "registro", ativo: true, sugerido: false, essencial: false, motivo: "OneDrive (mantenha se o cliente usa sincronização)" },
  { id: "HKLM:\\|Run|SecurityHealth", nome: "SecurityHealth", comando: "C:\\Windows\\system32\\SecurityHealthSystray.exe", escopo: "Todos os usuários", origem: "registro", ativo: true, sugerido: false, essencial: true, motivo: "Segurança, driver ou fabricante: mantenha." },
  { id: "HKLM:\\|Run|RtkAudUService", nome: "Realtek HD Audio", comando: "C:\\Windows\\System32\\DriverStore\\FileRepository\\RtkAudUService64.exe -background", escopo: "Todos os usuários", origem: "registro", ativo: true, sugerido: false, essencial: true, motivo: "Segurança, driver ou fabricante: mantenha." },
  { id: "HKCU:\\|Run|Steam", nome: "Steam", comando: "\"C:\\Program Files (x86)\\Steam\\steam.exe\" -silent", escopo: "Usuário atual", origem: "registro", ativo: false, sugerido: true, essencial: false, motivo: "Steam" },
];

const PROC: Processos = {
  total: 4 * GB, livre: 0.5 * GB,
  processos: [
    { nome: "chrome", qtd: 14, mem: 1.4 * GB, pids: [1204, 1210, 1288] },
    { nome: "MsMpEng", qtd: 1, mem: 310 * MB, pids: [2210] },
    { nome: "Teams", qtd: 6, mem: 540 * MB, pids: [3300, 3304] },
    { nome: "explorer", qtd: 1, mem: 190 * MB, pids: [4012] },
    { nome: "Spotify", qtd: 4, mem: 260 * MB, pids: [5100] },
    { nome: "AvastSvc", qtd: 1, mem: 240 * MB, pids: [2330] },
    { nome: "Discord", qtd: 5, mem: 420 * MB, pids: [5230] },
    { nome: "OUTLOOK", qtd: 1, mem: 180 * MB, pids: [5560] },
    { nome: "svchost", qtd: 62, mem: 480 * MB, pids: [800] },
    { nome: "WINWORD", qtd: 1, mem: 150 * MB, pids: [6100] },
  ].sort((a, b) => b.mem - a.mem),
};

export function criarApiDemo(): Api {
  let ouvinteScan: ((p: ProgressoScan) => void) | null = null;
  let ouvinteExec: ((e: EventoTarefa) => void) | null = null;
  let cancelar = false;
  let inicio = INICIO.map((i) => ({ ...i }));

  return {
    demo: true,
    info: async () => ({ versao: "1.0.0", plataforma: "demo", admin: true }),
    diagnosticar: async () => (await espera(900), DIAG),
    escanearLimpeza: async () => (await espera(1200), LIMPEZA),
    async escanearDisco() {
      cancelar = false;
      const total = 36;
      for (let i = 1; i <= total && !cancelar; i++) {
        await espera(90);
        ouvinteScan?.({ arquivos: i * 17000, pastas: i * 2700, bytes: (i / total) * 444 * GB, atual: i % 2 ? "C:\\Users\\Cliente\\AppData\\Local\\Temp" : "C:\\Windows\\WinSxS\\amd64_microsoft-windows" });
      }
      const r = resultadoDemo();
      r.cancelado = cancelar;
      return r;
    },
    cancelarScan: async () => void (cancelar = true),
    aoProgressoScan(cb) {
      ouvinteScan = cb;
      return () => void (ouvinteScan = null);
    },
    async executar(ids) {
      cancelar = false;
      const saida: EventoTarefa[] = [];
      for (const id of ids) {
        ouvinteExec?.({ id, estado: "rodando", mensagem: "" });
        await espera(id.startsWith("limpar:") ? 800 : 1100);
        const lim = LIMPEZA.find((l) => "limpar:" + l.id === id);
        const r: EventoTarefa = id === "dism_restore"
          ? { id, estado: "erro", mensagem: "Sem conexão com a internet (modo demonstração)." }
          : { id, estado: "ok", mensagem: lim ? "Limpo." : "Concluído (demonstração).", liberado: lim?.bytes ?? undefined, reiniciar: id === "pagefile_auto" };
        saida.push(r);
        ouvinteExec?.(r);
      }
      return saida;
    },
    cancelarExecucao: async () => void (cancelar = true),
    aoProgressoExecucao(cb) {
      ouvinteExec = cb;
      return () => void (ouvinteExec = null);
    },
    processos: async () => (await espera(300), { ...PROC, livre: PROC.livre + Math.random() * 60 * MB }),
    encerrarProcesso: async (nome, pids) => {
      if (["svchost", "explorer", "MsMpEng"].includes(nome)) throw new Error(`"${nome}" é um processo do sistema e não pode ser encerrado aqui.`);
      await espera(400);
      return pids.length;
    },
    listarInicializacao: async () => (await espera(500), inicio.map((i) => ({ ...i }))),
    aplicarInicializacao: async (itens) => {
      await espera(500);
      inicio = inicio.map((i) => {
        const m = itens.find((x) => x.id === i.id);
        return m ? { ...i, ativo: m.ativar } : i;
      });
      return itens.length;
    },
    testarInternet: async () => (await espera(1500), {
      conectado: true, latenciaMs: 28,
      resolvedores: [{ nome: "DNS atual do Windows", ms: 212, falhas: 0 }, { nome: "Cloudflare (1.1.1.1)", ms: 24, falhas: 0 }, { nome: "Google (8.8.8.8)", ms: 31, falhas: 0 }],
    }),
    enviarParaLixeira: async (c) => ({ feitos: c, falhas: [] }),
    mostrarNaPasta: async () => {},
    abrirPasta: async () => {},
    reiniciarWindows: async () => {},
    cancelarReinicio: async () => {},
    salvarRelatorio: async () => null,
  };
}
