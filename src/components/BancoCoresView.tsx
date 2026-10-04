import { useMemo, useState } from "react";
import { amostraCor } from "../cores";
import type { BancoCores } from "../core/nucleo";
import { IconeBusca, IconeLixeira, IconePasta } from "./Icons";

interface Props {
  banco: BancoCores;
  caminho: string;
  onAlterar: (fn: (b: BancoCores) => void) => void;
  onExportar: () => void;
  onImportar: () => void;
  onMostrarPasta: () => void;
}

interface Entrada { tipo: "marca" | "generico"; chave: string; marca: string; cor: string; abrev: string }

const LIMITE = 120;

export function BancoCoresView({ banco, caminho, onAlterar, onExportar, onImportar, onMostrarPasta }: Props) {
  const [busca, setBusca] = useState("");
  const [novaMarca, setNovaMarca] = useState("");
  const [novaCor, setNovaCor] = useState("");
  const [novaAbrev, setNovaAbrev] = useState("");

  const todas = useMemo<Entrada[]>(() => {
    const porMarca = Object.entries(banco.por_marca).map(([chave, abrev]) => {
      const i = chave.indexOf("|");
      return { tipo: "marca" as const, chave, marca: chave.slice(0, i), cor: chave.slice(i + 1), abrev };
    });
    const gen = Object.entries(banco.generico).map(([cor, abrev]) => ({ tipo: "generico" as const, chave: cor, marca: "", cor, abrev }));
    return [...porMarca, ...gen];
  }, [banco]);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return q ? todas.filter((e) => `${e.marca} ${e.cor} ${e.abrev}`.toLowerCase().includes(q)) : todas;
  }, [todas, busca]);

  function adicionar() {
    const cor = novaCor.trim().toLowerCase();
    const abrev = novaAbrev.trim().toUpperCase();
    if (!cor || !abrev) return;
    onAlterar((b) => {
      const marca = novaMarca.trim().toUpperCase();
      if (marca) b.por_marca[`${marca}|${cor}`] = abrev;
      else b.generico[cor] = abrev;
    });
    setNovaMarca(""); setNovaCor(""); setNovaAbrev("");
  }

  function editar(e: Entrada, abrev: string) {
    abrev = abrev.trim().toUpperCase();
    if (!abrev || abrev === e.abrev) return;
    onAlterar((b) => { (e.tipo === "marca" ? b.por_marca : b.generico)[e.chave] = abrev; });
  }

  function remover(e: Entrada) {
    onAlterar((b) => { delete (e.tipo === "marca" ? b.por_marca : b.generico)[e.chave]; });
  }

  return (
    <>
      <div className="banco-ferr">
        <div className="busca">
          <IconeBusca size={16} />
          <input className="input" placeholder="Buscar por marca, cor ou abreviação…" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <button className="btn sec" onClick={onImportar}>Importar…</button>
        <button className="btn sec" onClick={onExportar}>Exportar…</button>
        <button className="btn sec" onClick={onMostrarPasta}><IconePasta size={17} /> Pasta</button>
      </div>

      <div className="card">
        <div className="add-linha">
          <div className="campo"><label>Marca (opcional)</label><input className="input" value={novaMarca} onChange={(e) => setNovaMarca(e.target.value)} placeholder="Ex: VIZZANO" /></div>
          <div className="campo"><label>Cor</label><input className="input" value={novaCor} onChange={(e) => setNovaCor(e.target.value)} placeholder="Ex: branco off" onKeyDown={(e) => e.key === "Enter" && adicionar()} /></div>
          <div className="campo"><label>Abreviação</label><input className="input mono" value={novaAbrev} onChange={(e) => setNovaAbrev(e.target.value.toUpperCase())} placeholder="BROF" onKeyDown={(e) => e.key === "Enter" && adicionar()} /></div>
          <button className="btn" onClick={adicionar} disabled={!novaCor.trim() || !novaAbrev.trim()}>Adicionar</button>
        </div>
      </div>

      <div className="card" style={{ overflow: "hidden", display: "flex", flexDirection: "column", flex: "1 1 auto", minHeight: 240 }}>
        <div className="card-head">
          <span>{todas.length} abreviações salvas</span>
          <span className="sub">{filtradas.length > LIMITE ? `Mostrando ${LIMITE} de ${filtradas.length} — use a busca` : `${filtradas.length} resultado(s)`}</span>
        </div>
        <div className="tabela-wrap" style={{ flex: 1 }}>
          <table className="tabela">
            <thead>
              <tr><th>Marca</th><th>Cor</th><th style={{ width: 190 }}>Abreviação</th><th style={{ width: 56 }} /></tr>
            </thead>
            <tbody>
              {filtradas.slice(0, LIMITE).map((e) => (
                <tr key={`${e.tipo}:${e.chave}`}>
                  <td>{e.marca ? e.marca : <span className="badge info">Qualquer marca</span>}</td>
                  <td>
                    <div className="cor-cel" style={{ minWidth: 0 }}>
                      <span className="amostra" style={{ background: amostraCor(e.cor) }} /> {e.cor}
                    </div>
                  </td>
                  <td>
                    <input
                      key={e.abrev}
                      className="input mono"
                      defaultValue={e.abrev}
                      onBlur={(ev) => editar(e, ev.target.value)}
                      onKeyDown={(ev) => ev.key === "Enter" && (ev.target as HTMLInputElement).blur()}
                    />
                  </td>
                  <td>
                    <button className="btn danger sm" title="Remover" aria-label="Remover" onClick={() => remover(e)}><IconeLixeira size={15} /></button>
                  </td>
                </tr>
              ))}
              {filtradas.length === 0 && (
                <tr><td colSpan={4} style={{ textAlign: "center", color: "var(--muted)", padding: 28 }}>Nada encontrado.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <p className="sub" style={{ margin: 0 }}>Arquivo do banco: <span className="chip">{caminho}</span></p>
    </>
  );
}
