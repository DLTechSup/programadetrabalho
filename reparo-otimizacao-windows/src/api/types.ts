export type Risco = "baixo" | "medio" | "alto";
export type Duracao = "rapida" | "media" | "longa";

export interface Sintoma { id: string; titulo: string; descricao: string; icone: string }
export interface Categoria { id: string; titulo: string }
export interface TarefaMeta {
  id: string;
  categoria: string;
  titulo: string;
  descricao: string;
  aviso?: string;
  risco: Risco;
  duracao: Duracao;
  reinicia?: boolean;
  sintomas: string[];
}
export interface LimpezaMeta {
  id: string;
  nome: string;
  descricao: string;
  aviso?: string;
  risco: Risco;
  padrao: boolean;
  sintomas: string[];
}

export interface Diagnostico {
  windows: string;
  versao: string;
  fabricante: string;
  ramTotal: number;
  ramLivre: number;
  uptimeDias: number;
  cpu: string;
  nucleos: number;
  cpuUso: number;
  pagefileAutomatico: boolean;
  notebook: boolean;
  discoTotal: number;
  discoLivre: number;
  tipoDisco: "SSD" | "HDD" | "Desconhecido";
  saudeDisco: string;
  planoEnergia: string;
  antivirus: string[];
  servicos: Record<string, string>;
  transparencia: boolean;
  explorerAbreEmEsteComputador: boolean;
  appsSegundoPlanoBloqueados: boolean;
  dns: string[];
}

export interface ItemLimpeza {
  id: string;
  bytes: number | null; // null = tamanho só é conhecido depois de executar
  arquivos: number;
  existe: boolean;
}

export interface NoPasta {
  nome: string;
  caminho: string;
  bytes: number;
  arquivos: number;
  filhos: NoPasta[];
}
export interface ArquivoGrande {
  caminho: string;
  nome: string;
  pasta: string;
  bytes: number;
  modificado: number;
  tipo: string;
}
export interface ResultadoScan {
  raiz: string;
  totalBytes: number;
  arquivos: number;
  pastas: number;
  erros: number;
  duracaoMs: number;
  cancelado: boolean;
  arvore: NoPasta;
  maiores: ArquivoGrande[];
  porTipo: Record<string, { bytes: number; arquivos: number }>;
}
export interface ProgressoScan { arquivos: number; pastas: number; bytes: number; atual: string }

export type EstadoTarefa = "pendente" | "rodando" | "ok" | "aviso" | "erro" | "ignorado";
export interface EventoTarefa {
  id: string;
  estado: EstadoTarefa;
  mensagem: string;
  liberado?: number | null;
  reiniciar?: boolean;
}

export interface GrupoProcesso { nome: string; qtd: number; mem: number; pids: number[] }
export interface Processos { total: number; livre: number; processos: GrupoProcesso[] }

export interface ItemInicializacao {
  id: string;
  nome: string;
  comando: string;
  escopo: string;
  origem: "registro" | "pasta";
  ativo: boolean;
  sugerido: boolean;
  essencial: boolean;
  motivo: string;
}

export interface TesteInternet {
  resolvedores: { nome: string; ms: number | null; falhas: number }[];
  latenciaMs: number | null;
  conectado: boolean;
}

export interface InfoApp { versao: string; plataforma: string; admin: boolean }

export interface Api {
  demo: boolean;
  info(): Promise<InfoApp>;
  diagnosticar(): Promise<Diagnostico>;
  escanearLimpeza(): Promise<ItemLimpeza[]>;
  escanearDisco(): Promise<ResultadoScan>;
  cancelarScan(): Promise<void>;
  aoProgressoScan(cb: (p: ProgressoScan) => void): () => void;
  executar(ids: string[], opcoes: { pontoRestauracao: boolean }): Promise<EventoTarefa[]>;
  cancelarExecucao(): Promise<void>;
  aoProgressoExecucao(cb: (e: EventoTarefa) => void): () => void;
  processos(): Promise<Processos>;
  encerrarProcesso(nome: string, pids: number[]): Promise<number>;
  listarInicializacao(): Promise<ItemInicializacao[]>;
  aplicarInicializacao(itens: { id: string; ativar: boolean }[]): Promise<number>;
  testarInternet(): Promise<TesteInternet>;
  enviarParaLixeira(caminhos: string[]): Promise<{ feitos: string[]; falhas: string[] }>;
  mostrarNaPasta(caminho: string): Promise<void>;
  abrirPasta(caminho: string): Promise<void>;
  reiniciarWindows(): Promise<void>;
  cancelarReinicio(): Promise<void>;
  salvarRelatorio(texto: string): Promise<string | null>;
}
