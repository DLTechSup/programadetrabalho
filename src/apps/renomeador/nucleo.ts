/**
 * Regras de renomeacao em sequencia (porte de renomeador-em-massa/renomeador/nucleo.py).
 * Puro: nao mexe em arquivo nenhum. A execucao de verdade (fs) fica no processo principal do Electron.
 */

const INVALIDOS = /[<>:"/\\|?*\x00-\x1f]/g;

export function nomeSeguro(nome: string): string {
  return nome.replace(INVALIDOS, "").replace(/^[ .]+|[ .]+$/g, "");
}

/** Ordem natural: "foto 2" antes de "foto 10". */
function chaveNatural(nomeArquivo: string): Array<string | number> {
  return nomeArquivo
    .toLowerCase()
    .split(/(\d+)/)
    .map((t) => (/^\d+$/.test(t) ? parseInt(t, 10) : t));
}

function compararNatural(a: string, b: string): number {
  const ka = chaveNatural(a);
  const kb = chaveNatural(b);
  const n = Math.max(ka.length, kb.length);
  for (let i = 0; i < n; i++) {
    const x = ka[i];
    const y = kb[i];
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    if (x === y) continue;
    if (typeof x === typeof y) return x < y ? -1 : 1;
    return typeof x === "number" ? -1 : 1; // numero antes de texto, se os formatos nao baterem
  }
  return 0;
}

export type Ordem = "data" | "foto" | "nome" | "selecao";
export type Separador = "espaco" | "traco" | "sublinhado" | "nenhum";

export const ORDENS: Record<Ordem, string> = {
  data: "Data do arquivo (mais antigo primeiro)",
  foto: "Data em que a foto foi tirada",
  nome: "Nome do arquivo (1, 2, 10...)",
  selecao: "Ordem em que foram selecionados",
};

export const SEPARADORES: Record<Separador, string> = { espaco: " ", traco: "-", sublinhado: "_", nenhum: "" };

/** Um arquivo selecionado, com os dados que a ordenacao pode precisar (o processo principal os fornece). */
export interface ArquivoSelecionado {
  caminho: string;
  nome: string; // so o nome, sem a pasta
  mtimeMs: number;
  dataFotoMs?: number; // EXIF (DateTimeOriginal); se nao tiver, cai para mtimeMs
}

export interface Opcoes {
  nome: string;
  inicio: number | null; // null = automatico (continua a numeracao existente, ou comeca em 1)
  zeros: boolean;
  separador: Separador;
  ordem: Ordem;
  continuar: boolean;
  extensaoMinuscula: boolean;
}

export const OPCOES_PADRAO: Opcoes = {
  nome: "",
  inicio: null,
  zeros: true,
  separador: "espaco",
  ordem: "data",
  continuar: true,
  extensaoMinuscula: true,
};

export interface Plano {
  pares: Array<{ antigo: string; novo: string }>; // caminhos completos
  inicio: number;
  avisos: string[];
  erro: string;
}

export function ordenar(arquivos: ArquivoSelecionado[], ordem: Ordem): ArquivoSelecionado[] {
  const arqs = [...arquivos];
  if (ordem === "data") arqs.sort((a, b) => a.mtimeMs - b.mtimeMs || compararNatural(a.nome, b.nome));
  else if (ordem === "foto")
    arqs.sort((a, b) => (a.dataFotoMs ?? a.mtimeMs) - (b.dataFotoMs ?? b.mtimeMs) || compararNatural(a.nome, b.nome));
  else if (ordem === "nome") arqs.sort((a, b) => compararNatural(a.nome, b.nome));
  return arqs;
}

function extensao(nome: string): string {
  const i = nome.lastIndexOf(".");
  return i > 0 ? nome.slice(i) : "";
}

function pastaDe(caminho: string): string {
  const i = Math.max(caminho.lastIndexOf("/"), caminho.lastIndexOf("\\"));
  return i >= 0 ? caminho.slice(0, i) : "";
}

function juntarCaminho(pasta: string, nome: string): string {
  const sep = pasta.includes("\\") && !pasta.includes("/") ? "\\" : "/";
  return pasta ? `${pasta}${pasta.endsWith(sep) ? "" : sep}${nome}` : nome;
}

/** Maior numero ja usado por arquivos "base<sep>NN(.ext)" na pasta (fora os que estao sendo renomeados agora). */
function maiorNumeroExistente(nomesNaPasta: string[], base: string, sep: string, ignorar: Set<string>): number {
  const rx = new RegExp(`^${escaparRegex(base)}${escaparRegex(sep)}(\\d+)(?:\\.[^.]+)?$`, "i");
  let maior = 0;
  for (const nome of nomesNaPasta) {
    if (ignorar.has(nome.toLowerCase())) continue;
    const m = rx.exec(nome);
    if (m) maior = Math.max(maior, parseInt(m[1], 10));
  }
  return maior;
}

function escaparRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Calcula o plano (antigo -> novo), sem mexer em nada.
 * `nomesNaPasta`: nomes (so o nome, sem caminho) ja existentes na pasta de destino -- usado para "continuar"
 * e para detectar conflito com arquivos que nao estao na selecao. Vem do processo principal (listagem real).
 */
export function montarPlano(arquivos: ArquivoSelecionado[], op: Opcoes, nomesNaPasta: string[]): Plano {
  const plano: Plano = { pares: [], inicio: 1, avisos: [], erro: "" };
  const base = nomeSeguro(op.nome);
  if (arquivos.length === 0) {
    plano.erro = "Nenhum arquivo selecionado.";
    return plano;
  }
  if (!base) {
    plano.erro = "Digite o novo nome.";
    return plano;
  }
  const sep = SEPARADORES[op.separador];
  const arqs = ordenar(arquivos, op.ordem);
  const pasta = pastaDe(arqs[0].caminho);
  const selecionados = new Set(arqs.map((a) => a.nome.toLowerCase()));

  let inicio = op.inicio;
  if (inicio === null) {
    inicio = maiorNumeroExistente(nomesNaPasta, base, sep, selecionados) + 1;
    if (inicio > 1) plano.avisos.push(`Já existem arquivos "${base}${sep}…" na pasta: a numeração continua do ${inicio}.`);
  }
  plano.inicio = inicio;
  const ultimo = inicio + arqs.length - 1;
  const largura = op.zeros ? Math.max(2, String(ultimo).length) : 1;

  for (let i = 0; i < arqs.length; i++) {
    let ext = extensao(arqs[i].nome);
    if (op.extensaoMinuscula) ext = ext.toLowerCase();
    const numero = String(inicio + i).padStart(largura, "0");
    plano.pares.push({ antigo: arqs[i].caminho, novo: juntarCaminho(pasta, `${base}${sep}${numero}${ext}`) });
  }

  const novosNomes = new Set(plano.pares.map((p) => p.novo.toLowerCase()));
  if (novosNomes.size !== plano.pares.length) {
    plano.erro = "Dois arquivos ficariam com o mesmo nome.";
    return plano;
  }
  const existentesLower = new Set(nomesNaPasta.map((n) => n.toLowerCase()));
  for (const { novo } of plano.pares) {
    const nomeNovo = novo.slice(Math.max(novo.lastIndexOf("/"), novo.lastIndexOf("\\")) + 1);
    if (existentesLower.has(nomeNovo.toLowerCase()) && !selecionados.has(nomeNovo.toLowerCase())) {
      plano.erro = `Já existe um arquivo que não está na seleção: ${nomeNovo}. Escolha outro nome ou outro número inicial.`;
      break;
    }
  }
  return plano;
}
