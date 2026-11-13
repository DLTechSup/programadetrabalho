// Interpretação do cabeçalho de cada mensagem do WhatsApp Web (quem mandou, quando) -- mesma
// lógica do leitor.py original (interpretar_pre / completar_datas). Pura, testável sem navegador.

export interface MensagemBruta {
  id: string;
  minha: boolean;
  legenda: string;
  blobs: string[];
  carregando: number;
  mais: number;
  pre: string;
}

export interface Mensagem {
  id: string;
  minha: boolean;
  legenda: string;
  blobs: string[];
  carregando: number;
  mais: number;
  remetente: string;
  dia: Date | null;
  hora: string;
  observacaoAlbum?: string;
}

const RE_PRE = /^\[(\d{1,2}:\d{2})(?::\d{2})?(?:\s?[AP]M)?,\s*(\d{1,2})\/(\d{1,2})\/(\d{4})\]\s*(.*?):?\s*$/;

/** '[18:42, 06/11/2026] Nome: ' -> (remetente, data, hora) */
export function interpretarPre(pre: string): { remetente: string; dia: Date | null; hora: string } {
  const m = RE_PRE.exec(pre || "");
  if (!m) return { remetente: "", dia: null, hora: "" };
  const hora = m[1], dd = Number(m[2]), mm = Number(m[3]), yyyy = Number(m[4]), remetente = m[5].trim();
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return { remetente: "", dia: null, hora: "" };
  const dia = new Date(yyyy, mm - 1, dd);
  return { remetente, dia, hora };
}

/** Mensagem só com foto não traz data/remetente: herda da vizinha (anterior, ou a próxima). */
export function completarDatas(msgs: Mensagem[]): void {
  let ultimo: [Date | null, string, string] = [null, "", ""];
  for (const m of msgs) {
    if (m.dia) ultimo = [m.dia, m.hora, m.remetente];
    else if (ultimo[0]) [m.dia, m.hora, m.remetente] = ultimo;
  }
  let proximo: [Date | null, string, string] = [null, "", ""];
  for (let i = msgs.length - 1; i >= 0; i--) {
    const m = msgs[i];
    if (m.dia) proximo = [m.dia, m.hora, m.remetente];
    else if (!m.dia && proximo[0]) [m.dia, m.hora, m.remetente] = proximo;
  }
}

export function mesmoDia(a: Date | null, b: Date): boolean {
  return !!a && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function brutaParaMensagem(x: MensagemBruta): Mensagem {
  const { remetente, dia, hora } = interpretarPre(x.pre);
  return { id: x.id, minha: x.minha, legenda: x.legenda, blobs: x.blobs, carregando: x.carregando, mais: x.mais, remetente, dia, hora };
}
