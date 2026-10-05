export interface Alias { falas: string[]; tipo: "programa" | "caminho" | "url"; destino: string }

export interface Config {
  nomeAtivacao: string;
  variantes: string[];
  pastaRaiz: string;
  ignorar: string[];
  aliases: Alias[];
  falarRespostas: boolean;
  janelaConversaSeg: number;
  escutaAposAtivarSeg: number;
  modelo: "tiny" | "base" | "small";
  microfoneId: string;
  filtrosDoNavegador: boolean;
  sensibilidade: number;
  iniciarComWindows: boolean;
  minimizarParaBandeja: boolean;
}

export type EstadoCerebro = "dormindo" | "ouvindo" | "escolhendo" | "nome";

export interface RespostaVoz {
  estado: EstadoCerebro;
  fala: string;
  expiraEm: number;
  nome: string;
  ok?: boolean;
  ignorado?: boolean;
  ativado?: boolean;
  entendido?: string;
  escolha?: string[];
  renomeado?: string;
  pausarEscuta?: boolean;
  lista?: string[];
}

export interface EstadoAtual {
  estado: EstadoCerebro;
  restanteMs: number;
  nome: string;
  contexto: { marca: string | null; ref: string | null; pasta: string | null };
}

export interface ExemplosGrupo { titulo: string; itens: string[] }
export interface InfoApp { versao: string; plataforma: string; exemplos: ExemplosGrupo[]; pastaModelos: string }

export interface ResumoPastas { raiz: string; erro: string; total: number; marcas: { nome: string; refs: number }[] }
export interface ProgramaInstalado { nome: string; tipo: "app" | "arquivo"; id?: string; caminho?: string }
export interface StatusModelo { chave: string; pronto: boolean; baixando: boolean }
export interface ProgressoModelo { baixado: number; total: number; arquivo: string }

export interface Api {
  demo: boolean;
  info(): Promise<InfoApp>;
  obterConfig(): Promise<Config>;
  salvarConfig(parcial: Partial<Config>): Promise<Config>;
  ouvir(texto: string, origem: "voz" | "texto"): Promise<RespostaVoz>;
  estado(): Promise<EstadoAtual>;
  dormir(): Promise<void>;
  escolherPasta(): Promise<string | null>;
  reindexar(): Promise<{ marcas: number; referencias: number; erro: string } | null>;
  resumoPastas(): Promise<ResumoPastas | null>;
  listarProgramas(forcar?: boolean): Promise<ProgramaInstalado[] | { erro: string }>;
  escolherArquivo(): Promise<string | null>;
  statusModelo(): Promise<StatusModelo>;
  baixarModelo(): Promise<{ ok: boolean; erro?: string }>;
  cancelarModelo(): Promise<void>;
  aoProgressoModelo(cb: (p: ProgressoModelo) => void): () => void;
  aoAlternarEscuta(cb: () => void): () => void;
  sair(): Promise<void>;
  esconder(): Promise<void>;
}
