// Texto do aviso (notificação nativa do Windows) a cada item salvo -- mesma lógica do
// notificacao.py original (texto_do_aviso).

export interface EventoSalvo {
  tipo?: "I";
  grupo: string;
  // Grupo A/B:
  marca?: string;
  referencia?: string;
  novas?: number;
  total?: number;
  nova?: boolean;
  situacao?: "ok" | "conferir";
  obs?: string;
  // Conversa individual:
  previa?: string;
  mensagens?: number;
  fotos?: number;
}

/** (título, linha 1, linha 2) a partir do evento 'salvo'. */
export function textoDoAviso(d: EventoSalvo): [string, string, string] {
  if (d.tipo === "I") {
    const extra = d.fotos ? ` · ${d.fotos} foto(s)` : "";
    return [`💬 ${d.grupo}`, d.previa || "", `${d.mensagens} mensagem(ns) salva(s) em texto${extra}`];
  }
  const marca = d.marca && d.marca !== "?" ? d.marca : "";
  const nome = `${marca} ${d.referencia}`.trim();
  let titulo: string;
  if (d.situacao === "conferir") titulo = `⚠ ${d.grupo} — conferir`;
  else if (d.nova) titulo = `✔ ${d.grupo}`;
  else titulo = `＋ ${d.grupo} — mais fotos`;
  const fotos = `${d.novas} foto(s) salva(s)` + (d.nova ? "" : ` (total ${d.total})`);
  return [titulo, nome, fotos + (d.obs ? ` · ${d.obs}` : "")];
}
