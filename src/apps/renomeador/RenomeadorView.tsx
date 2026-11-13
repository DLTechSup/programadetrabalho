import { useEffect, useMemo, useRef, useState } from "react";
import { IconeDesfazer, IconePasta, IconeRenomear, IconeUpload } from "../../components/Icons";
import { plataforma, type ArquivoParaRenomear } from "../../platform";
import {
  montarPlano, OPCOES_PADRAO, ORDENS, type Opcoes, type Ordem, type Separador,
} from "./nucleo";

interface Props {
  arquivosIniciais?: ArquivoParaRenomear[] | null;
  onArquivosIniciaisConsumidos?: () => void;
}

interface Desfazer {
  feitos: Array<[string, string]>;
  nome: string;
}

const ROTULO_SEP: Record<Separador, string> = { espaco: "espaço", traco: "traço (-)", sublinhado: "sublinhado (_)", nenhum: "nenhum" };

export function RenomeadorView({ arquivosIniciais, onArquivosIniciaisConsumidos }: Props) {
  const [arquivos, setArquivos] = useState<ArquivoParaRenomear[]>([]);
  const [op, setOp] = useState<Opcoes>(OPCOES_PADRAO);
  const [nomesNaPasta, setNomesNaPasta] = useState<string[]>([]);
  const [ultimoDesfazer, setUltimoDesfazer] = useState<Desfazer | null>(null);
  const [status, setStatus] = useState<{ texto: string; erro?: boolean } | null>(null);
  const [recentes, setRecentes] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("renomeador.recentes") ?? "[]");
    } catch {
      return [];
    }
  });
  const timeoutStatus = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (arquivosIniciais && arquivosIniciais.length > 0) {
      setArquivos(arquivosIniciais);
      onArquivosIniciaisConsumidos?.();
    }
  }, [arquivosIniciais, onArquivosIniciaisConsumidos]);

  useEffect(() => {
    (async () => {
      if (arquivos.length === 0) return setNomesNaPasta([]);
      const pasta = arquivos[0].caminho.replace(/[\\/][^\\/]+$/, "");
      setNomesNaPasta((await plataforma.listarPasta?.(pasta)) ?? []);
    })();
  }, [arquivos]);

  const plano = useMemo(() => montarPlano(arquivos, op, nomesNaPasta), [arquivos, op, nomesNaPasta]);

  function avisar(texto: string, erro = false) {
    window.clearTimeout(timeoutStatus.current);
    setStatus({ texto, erro });
    timeoutStatus.current = window.setTimeout(() => setStatus(null), 6000);
  }

  async function escolherArquivos() {
    const r = await plataforma.escolherArquivosParaRenomear?.();
    if (r && r.length > 0) setArquivos(r);
  }

  async function renomear() {
    if (plano.erro || plano.pares.length === 0) return;
    try {
      const feitos = (await plataforma.renomearExecutar?.(plano.pares)) ?? [];
      setUltimoDesfazer({ feitos, nome: op.nome });
      const novos = [op.nome, ...recentes.filter((n) => n.toLowerCase() !== op.nome.toLowerCase())].slice(0, 8);
      setRecentes(novos);
      try {
        localStorage.setItem("renomeador.recentes", JSON.stringify(novos));
      } catch {
        /* sem armazenamento: segue sem salvar os recentes */
      }
      avisar(`✔ ${feitos.length} arquivo(s) renomeado(s): ${plano.pares[0].novo.split(/[\\/]/).pop()}…`);
      setArquivos([]);
    } catch (e) {
      avisar(`Não foi possível renomear: ${e instanceof Error ? e.message : e}`, true);
    }
  }

  async function desfazer() {
    if (!ultimoDesfazer) return;
    try {
      const n = await plataforma.renomearDesfazer?.(ultimoDesfazer.feitos);
      avisar(`↩ ${n} arquivo(s) voltaram ao nome original.`);
      setUltimoDesfazer(null);
    } catch (e) {
      avisar(`Não consegui desfazer: ${e instanceof Error ? e.message : e}`, true);
    }
  }

  return (
    <div className="shell-pagina">
      <div>
        <h1 style={{ margin: 0 }}>Renomear em Massa</h1>
        <p style={{ color: "var(--muted)", margin: "4px 0 0" }}>
          Escolha os arquivos, digite um nome e eles viram <code>nome 01</code>, <code>nome 02</code>...
        </p>
      </div>

      <div className="card" style={{ padding: 18, display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
        <button className="btn" onClick={escolherArquivos}>
          <IconeUpload size={16} /> Escolher arquivos…
        </button>
        <span style={{ color: "var(--muted)" }}>
          {arquivos.length === 0 ? "Nenhum arquivo escolhido" : `${arquivos.length} arquivo(s) escolhido(s)`}
        </span>
        <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--faint)" }}>
          Dica: aperte <b>Ctrl+Alt+R</b> com arquivos selecionados no Explorador para trazê-los direto pra cá.
        </span>
      </div>

      {arquivos.length > 0 && (
        <>
          <div className="card" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>Novo nome</label>
              <input
                autoFocus
                value={op.nome}
                onChange={(e) => setOp({ ...op, nome: e.target.value })}
                placeholder="ex.: branco"
                style={{ display: "block", width: "100%", marginTop: 4, padding: "10px 12px", fontSize: 16, borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)" }}
              />
              {recentes.length > 0 && (
                <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                  {recentes.map((n) => (
                    <button key={n} className="btn sec sm" onClick={() => setOp({ ...op, nome: n })}>{n}</button>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              <div>
                <label style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>Começar em</label>
                <input
                  value={op.inicio ?? ""}
                  onChange={(e) => setOp({ ...op, inicio: e.target.value.trim() === "" ? null : Math.max(0, parseInt(e.target.value, 10) || 0) })}
                  placeholder="automático"
                  style={{ display: "block", width: 120, marginTop: 4, padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)" }}
                />
              </div>
              <div>
                <label style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>Separador</label>
                <select
                  value={op.separador}
                  onChange={(e) => setOp({ ...op, separador: e.target.value as Separador })}
                  style={{ display: "block", marginTop: 4, padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)" }}
                >
                  {(Object.keys(ROTULO_SEP) as Separador[]).map((s) => (
                    <option key={s} value={s}>{ROTULO_SEP[s]}</option>
                  ))}
                </select>
              </div>
              <div style={{ flex: 1, minWidth: 220 }}>
                <label style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>Ordenar por</label>
                <select
                  value={op.ordem}
                  onChange={(e) => setOp({ ...op, ordem: e.target.value as Ordem })}
                  style={{ display: "block", width: "100%", marginTop: 4, padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)" }}
                >
                  {(Object.keys(ORDENS) as Ordem[]).map((o) => (
                    <option key={o} value={o}>{ORDENS[o]}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
              <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <input type="checkbox" checked={op.zeros} onChange={(e) => setOp({ ...op, zeros: e.target.checked })} />
                Números com zero (01, 02, 03...)
              </label>
              <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <input type="checkbox" checked={op.continuar} onChange={(e) => setOp({ ...op, continuar: e.target.checked })} />
                Continuar a numeração se a pasta já tiver esse nome
              </label>
              <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <input type="checkbox" checked={op.extensaoMinuscula} onChange={(e) => setOp({ ...op, extensaoMinuscula: e.target.checked })} />
                Extensão em minúsculas
              </label>
            </div>
          </div>

          <div className="card" style={{ padding: 18, flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <b>Prévia</b>
              {plano.avisos.map((a) => <span key={a} style={{ fontSize: 12, color: "var(--success)" }}>ℹ {a}</span>)}
            </div>
            {plano.erro && <div style={{ color: "var(--danger)", marginTop: 8 }}>⚠ {plano.erro}</div>}
            <div style={{ overflow: "auto", marginTop: 10, fontFamily: "var(--mono)", fontSize: 13, display: "flex", flexDirection: "column", gap: 6 }}>
              {plano.pares.slice(0, 80).map((p) => (
                <div key={p.antigo}>
                  <span style={{ color: "var(--muted)" }}>{p.antigo.split(/[\\/]/).pop()}</span>
                  {"  →  "}
                  <b>{p.novo.split(/[\\/]/).pop()}</b>
                </div>
              ))}
              {plano.pares.length > 80 && <span style={{ color: "var(--muted)" }}>... e mais {plano.pares.length - 80} arquivo(s)</span>}
            </div>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn" disabled={!!plano.erro || plano.pares.length === 0} onClick={renomear}>
              <IconeRenomear size={16} /> Renomear
            </button>
            {ultimoDesfazer && (
              <button className="btn sec" onClick={desfazer}>
                <IconeDesfazer size={16} /> Desfazer último ({ultimoDesfazer.feitos.length})
              </button>
            )}
          </div>
        </>
      )}

      {arquivos.length === 0 && (
        <div className="card" style={{ padding: 28, textAlign: "center", color: "var(--muted)" }}>
          <IconePasta size={28} />
          <p>Escolha os arquivos acima, ou selecione-os no Explorador e aperte Ctrl+Alt+R.</p>
        </div>
      )}

      {status && (
        <div style={{ position: "fixed", right: 24, bottom: 24, padding: "10px 16px", borderRadius: 10, background: status.erro ? "var(--danger-soft)" : "var(--success-soft)", color: status.erro ? "var(--danger)" : "var(--success)", fontWeight: 600, boxShadow: "var(--shadow)" }}>
          {status.texto}
        </div>
      )}
    </div>
  );
}
