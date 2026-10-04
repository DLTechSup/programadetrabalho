import { diasDesde } from "./format";

export const NOMES_TIPO: Record<string, string> = {
  videos: "Vídeos",
  imagens: "Imagens e fotos",
  audio: "Músicas e áudio",
  documentos: "Documentos",
  compactados: "Arquivos compactados (zip, rar)",
  imagensDisco: "Imagens de disco / máquinas virtuais",
  programas: "Programas e instaladores",
  logsDumps: "Logs, dumps e temporários",
  bancos: "Bancos de dados e backups",
  outros: "Outros",
};

export interface Dica {
  texto: string;
  tom: "bom" | "atencao" | "perigo";
}

/** Sugestão para um arquivo grande: o que ele provavelmente é e se costuma poder apagar. */
export function dicaArquivo(caminho: string, nome: string, modificado: number, agora = Date.now()): Dica | null {
  const c = caminho.toLowerCase().replace(/\//g, "\\");
  const ext = nome.includes(".") ? nome.slice(nome.lastIndexOf(".") + 1).toLowerCase() : "";
  if (/\\windows\\|\\program files|\\programdata\\microsoft\\/.test(c)) return { texto: "Arquivo do sistema: não apague", tom: "perigo" };
  if (["dmp", "etl"].includes(ext)) return { texto: "Relatório de erro: pode apagar", tom: "bom" };
  if (["iso", "msi"].includes(ext) || (ext === "exe" && c.includes("\\downloads\\"))) return { texto: "Instalador: provavelmente pode apagar", tom: "bom" };
  if (["zip", "rar", "7z"].includes(ext) && c.includes("\\downloads\\")) return { texto: "Download compactado: confira e apague", tom: "bom" };
  if (["vhd", "vhdx", "vmdk", "vdi", "ova"].includes(ext)) return { texto: "Máquina virtual: confirme antes", tom: "atencao" };
  if (["pst", "ost"].includes(ext)) return { texto: "E-mail do Outlook: não apague", tom: "perigo" };
  if (["mp4", "mkv", "avi", "mov", "wmv"].includes(ext)) {
    return { texto: diasDesde(modificado, agora) > 365 ? "Vídeo antigo: ofereça mover para HD externo" : "Vídeo: confirme com o cliente", tom: "atencao" };
  }
  if (["bak", "old", "tmp", "log"].includes(ext)) return { texto: "Backup/temporário: confira e apague", tom: "bom" };
  return null;
}

/** Pastas conhecidas: explica o que são e se mexer é seguro. */
const NOTAS: [RegExp, string, "bom" | "atencao" | "perigo"][] = [
  [/\\windows\\winsxs$/, "Componentes do Windows. NUNCA apague na mão; use a limpeza de componentes.", "perigo"],
  [/\\windows\\(assembly|microsoft\.net)(\\|$)/, "Componentes do .NET Framework (GAC e NativeImages). NUNCA apague: quebra programas e o Windows.", "perigo"],
  [/\\windows\\(system32|syswow64|servicing|fonts|driverstore)(\\|$)/, "Arquivos essenciais do Windows. Não apague.", "perigo"],
  [/\\windows\\installer$/, "Cache do Windows Installer. Não apague (quebra desinstalação de programas).", "perigo"],
  [/\\windows\\softwaredistribution$/, "Atualizações do Windows. A parte \"Download\" pode ser limpa.", "atencao"],
  [/\\windows$/, "Sistema Windows. Não apague nada daqui.", "perigo"],
  [/\\program files( \(x86\))?$/, "Programas instalados. Desinstale pelo Painel de Controle, não apague a pasta.", "perigo"],
  [/\\programdata$/, "Dados compartilhados de programas.", "atencao"],
  [/\\users\\[^\\]+\\appdata$/, "Dados dos programas do usuário. Contém caches que podem ser limpos.", "atencao"],
  [/\\users\\[^\\]+\\downloads$/, "Downloads: costuma ter instaladores e arquivos antigos.", "bom"],
  [/\\users\\[^\\]+\\(documents|desktop|pictures|videos|music)$/, "Arquivos pessoais do cliente. Só apague com autorização.", "atencao"],
  [/\\\$recycle\.bin$/, "Lixeira. Pode esvaziar depois de conferir.", "bom"],
  [/\\windows\.old$/, "Windows anterior. Pode apagar se tudo estiver funcionando.", "bom"],
  [/\\users$/, "Pastas dos usuários.", "atencao"],
  [/\\temp$/, "Temporários. Costuma poder apagar.", "bom"],
];

export function notaPasta(caminho: string): { texto: string; tom: "bom" | "atencao" | "perigo" } | null {
  const c = caminho.toLowerCase().replace(/\//g, "\\").replace(/\\+$/, "");
  for (const [re, texto, tom] of NOTAS) if (re.test(c)) return { texto, tom };
  return null;
}
