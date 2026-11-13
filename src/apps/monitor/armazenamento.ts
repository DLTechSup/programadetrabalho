// Parte pura de armazenamento.py (nome da pasta do grupo e extensão da foto pela assinatura
// dos bytes). O resto (gravar de verdade em disco) fica em electron/monitor/armazenamento.cjs.
import { nomeSeguro } from "./referencia";

const RE_NAO_IMPRIMIVEL = /[\p{Cc}\p{Zl}\p{Zp}]/u;
const RE_SIMBOLO = /[\p{So}\p{Sk}\p{Cs}\p{Cn}]/u;

/** Nome do grupo como pasta: tira emojis e caracteres proibidos no Windows
 * (ex.: 'PROGRAMAÇÃO ✨📷💰' -> 'PROGRAMAÇÃO'). */
export function nomePastaGrupo(nome: string): string {
  const semAltos = Array.from(nome).filter((c) => (c.codePointAt(0) ?? 0) < 0x2190).join("");
  const limpo = Array.from(semAltos).filter((c) => !RE_NAO_IMPRIMIVEL.test(c) && !RE_SIMBOLO.test(c)).join("");
  const colapsado = limpo.replace(/\s+/g, " ").trim();
  return colapsado ? nomeSeguro(colapsado) : "Grupo";
}

export function extensaoDaFoto(dados: Uint8Array): string {
  if (dados.length >= 3 && dados[0] === 0xff && dados[1] === 0xd8 && dados[2] === 0xff) return ".jpg";
  if (dados.length >= 8 && dados[0] === 0x89 && dados[1] === 0x50 && dados[2] === 0x4e && dados[3] === 0x47) return ".png";
  if (dados.length >= 12 && dados[0] === 0x52 && dados[1] === 0x49 && dados[2] === 0x46 && dados[3] === 0x46
      && dados[8] === 0x57 && dados[9] === 0x45 && dados[10] === 0x42 && dados[11] === 0x50) return ".webp";
  return ".jpg";
}

/** Formata a pasta do dia como dd-mm-aaaa, igual ao Python strftime('%d-%m-%Y'). */
export function nomePastaDoDia(dia: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(dia.getDate())}-${p(dia.getMonth() + 1)}-${dia.getFullYear()}`;
}
