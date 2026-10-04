import { createContext, useContext } from "react";
import type { Api, Diagnostico, InfoApp, ItemInicializacao, ItemLimpeza, ResultadoScan } from "./api/types";
import type { Problema } from "./lib/analise";

export type EstadoAnalise = "nunca" | "rodando" | "pronto" | "erro";

export interface Contexto {
  api: Api;
  info: InfoApp;
  diag: Diagnostico | null;
  limpeza: ItemLimpeza[] | null;
  inicio: ItemInicializacao[] | null;
  problemas: Problema[];
  estadoAnalise: EstadoAnalise;
  passoAnalise: string;
  erroAnalise: string;
  analisar(): Promise<void>;
  atualizarLimpeza(): Promise<void>;
  scan: ResultadoScan | null;
  setScan(s: ResultadoScan | null): void;
  /** abre o assistente de execução (plano → progresso → resultado) */
  executar(ids: string[], titulo: string): void;
  ir(pagina: Pagina, sintoma?: string): void;
}

export type Pagina = "visao" | "disco" | "otimizar" | "memoria" | "inicio" | "internet";

export const Ctx = createContext<Contexto | null>(null);
export function useApp(): Contexto {
  const c = useContext(Ctx);
  if (!c) throw new Error("Contexto ausente");
  return c;
}
