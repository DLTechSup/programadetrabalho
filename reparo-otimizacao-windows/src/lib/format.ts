const UNID = ["B", "KB", "MB", "GB", "TB"];

export function bytes(n: number | null | undefined, casas = 1): string {
  if (n == null) return "—";
  let v = Math.abs(n);
  let i = 0;
  while (v >= 1024 && i < UNID.length - 1) {
    v /= 1024;
    i++;
  }
  const txt = (i === 0 ? v.toFixed(0) : v.toFixed(v >= 100 ? 0 : casas)).replace(".", ",");
  return `${txt} ${UNID[i]}`;
}

export function percentual(parte: number, total: number): number {
  return total > 0 ? Math.min(100, (parte / total) * 100) : 0;
}

export function dataBR(ms: number): string {
  return new Date(ms).toLocaleDateString("pt-BR");
}

export function duracao(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} s`;
  return `${Math.floor(s / 60)} min ${s % 60} s`;
}

export function diasDesde(ms: number, agora = Date.now()): number {
  return Math.floor((agora - ms) / 86400000);
}
