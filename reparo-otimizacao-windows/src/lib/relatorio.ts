import type { Diagnostico, EventoTarefa } from "../api/types";
import { bytes } from "./format";
import { tituloDe } from "./catalogo";

const ROTULO: Record<string, string> = { ok: "OK", aviso: "ATENÇÃO", erro: "ERRO", ignorado: "NÃO EXECUTADO", rodando: "…", pendente: "…" };

export function montarRelatorio(resultados: EventoTarefa[], diag: Diagnostico | null, agora = new Date()): string {
  const l: string[] = [];
  l.push("RELATÓRIO - REPARO E OTIMIZAÇÃO DO WINDOWS");
  l.push(`Data: ${agora.toLocaleString("pt-BR")}`);
  if (diag) {
    l.push(`Computador: ${diag.fabricante || "—"} | ${diag.windows} (${diag.versao})`);
    l.push(`Processador: ${diag.cpu} | RAM: ${bytes(diag.ramTotal, 0)} | Disco C: ${diag.tipoDisco}, ${bytes(diag.discoLivre)} livres de ${bytes(diag.discoTotal, 0)}`);
  }
  l.push("");
  let liberado = 0;
  for (const r of resultados) {
    l.push(`[${ROTULO[r.estado] ?? r.estado}] ${tituloDe(r.id)}${r.mensagem ? ` — ${r.mensagem}` : ""}${r.liberado ? ` (${bytes(r.liberado)} liberados)` : ""}`);
    liberado += r.liberado ?? 0;
  }
  l.push("");
  l.push(`Espaço liberado no total: ${bytes(liberado)}`);
  if (resultados.some((r) => r.reiniciar)) l.push("É necessário reiniciar o computador para concluir algumas correções.");
  return l.join("\r\n");
}
