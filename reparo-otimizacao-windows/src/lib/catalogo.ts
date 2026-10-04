import dados from "../../electron/engine/catalogo.json";
import type { Categoria, LimpezaMeta, Sintoma, TarefaMeta } from "../api/types";

export const PREFIXO_LIMPEZA = "limpar:";

export const SINTOMAS = dados.sintomas as Sintoma[];
export const CATEGORIAS = dados.categorias as Categoria[];
export const TAREFAS = dados.tarefas as TarefaMeta[];
export const LIMPEZAS = dados.limpeza as LimpezaMeta[];

export interface ItemCatalogo {
  id: string; // id de execução (limpeza leva o prefixo)
  categoria: string;
  titulo: string;
  descricao: string;
  aviso?: string;
  risco: "baixo" | "medio" | "alto";
  duracao: "rapida" | "media" | "longa";
  reinicia: boolean;
  sintomas: string[];
  limpeza: boolean;
}

export const ITENS: ItemCatalogo[] = [
  ...LIMPEZAS.map((l) => ({
    id: PREFIXO_LIMPEZA + l.id,
    categoria: "limpeza",
    titulo: l.nome,
    descricao: l.descricao,
    aviso: l.aviso,
    risco: l.risco,
    duracao: (l.id === "componentes" ? "longa" : "rapida") as "rapida" | "longa",
    reinicia: false,
    sintomas: l.sintomas,
    limpeza: true,
  })),
  ...TAREFAS.map((t) => ({ ...t, reinicia: !!t.reinicia, limpeza: false })),
];

const POR_ID = new Map(ITENS.map((i) => [i.id, i]));
export const item = (id: string): ItemCatalogo | undefined => POR_ID.get(id);
export const tituloDe = (id: string): string => (id === "ponto_restauracao" ? "Ponto de restauração" : POR_ID.get(id)?.titulo ?? id);

/** IDs recomendados para um sintoma (limpezas "perigosas" ficam de fora). */
export function idsDoSintoma(sintoma: string): string[] {
  return ITENS.filter((i) => i.sintomas.includes(sintoma) && i.risco !== "alto" && !(i.limpeza && i.id.endsWith("componentes") && sintoma !== "disco")).map((i) => i.id);
}
