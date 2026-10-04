import type { ReactNode } from "react";
import { Icone } from "./Icons";
import type { Risco } from "../api/types";
import type { Severidade } from "../lib/analise";

export function Caixa({ marcado, onChange, desabilitado, rotulo }: { marcado: boolean; onChange: (v: boolean) => void; desabilitado?: boolean; rotulo?: string }) {
  return (
    <button type="button" role="checkbox" aria-checked={marcado} aria-label={rotulo} disabled={desabilitado} className={`caixa${marcado ? " on" : ""}`} onClick={() => onChange(!marcado)}>
      {marcado && <Icone nome="check" tam={14} />}
    </button>
  );
}

export function Chave({ ligado, onChange, desabilitado, rotulo }: { ligado: boolean; onChange: (v: boolean) => void; desabilitado?: boolean; rotulo?: string }) {
  return (
    <button type="button" role="switch" aria-checked={ligado} aria-label={rotulo} disabled={desabilitado} className={`chave${ligado ? " on" : ""}`} onClick={() => onChange(!ligado)}>
      <span />
    </button>
  );
}

const ROTULO_RISCO: Record<Risco, string> = { baixo: "Seguro", medio: "Atenção", alto: "Cuidado" };
export function SeloRisco({ risco }: { risco: Risco }) {
  return <span className={`selo risco-${risco}`}>{ROTULO_RISCO[risco]}</span>;
}

const ROTULO_SEV: Record<Severidade, string> = { critico: "Crítico", atencao: "Atenção", info: "Melhoria" };
export function SeloSeveridade({ s }: { s: Severidade }) {
  return <span className={`selo sev-${s}`}>{ROTULO_SEV[s]}</span>;
}

export function Barra({ pct, tom = "azul", alto = 8 }: { pct: number; tom?: "azul" | "verde" | "ambar" | "vermelho"; alto?: number }) {
  return (
    <div className="barra" style={{ height: alto }}>
      <div className={`barra-fill ${tom}`} style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} />
    </div>
  );
}

export function tomPorUso(pct: number): "verde" | "ambar" | "vermelho" {
  return pct >= 90 ? "vermelho" : pct >= 75 ? "ambar" : "verde";
}

export function Anel({ valor, rotulo, sub, tom, tam = 150 }: { valor: number; rotulo: string; sub?: string; tom: string; tam?: number }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  return (
    <div className="anel" style={{ width: tam, height: tam }}>
      <svg viewBox="0 0 120 120" width={tam} height={tam}>
        <circle cx="60" cy="60" r={r} className="anel-trilho" />
        <circle cx="60" cy="60" r={r} className="anel-valor" style={{ stroke: tom, strokeDasharray: `${(c * Math.max(0, Math.min(100, valor))) / 100} ${c}` }} transform="rotate(-90 60 60)" />
      </svg>
      <div className="anel-texto">
        <strong>{rotulo}</strong>
        {sub && <small>{sub}</small>}
      </div>
    </div>
  );
}

export function Vazio({ icone, titulo, children }: { icone: string; titulo: string; children?: ReactNode }) {
  return (
    <div className="vazio">
      <Icone nome={icone} tam={36} />
      <h3>{titulo}</h3>
      {children && <p>{children}</p>}
    </div>
  );
}

export function Aviso({ tom = "info", children }: { tom?: "info" | "atencao" | "erro"; children: ReactNode }) {
  return (
    <div className={`aviso aviso-${tom}`}>
      <Icone nome={tom === "info" ? "info" : "alert"} />
      <div>{children}</div>
    </div>
  );
}
