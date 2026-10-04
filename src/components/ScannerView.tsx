import { useMemo, useRef, useState } from "react";
import { amostraCor } from "../cores";
import { lerPlanilha } from "../core/planilha";
import {
  Agregador, abreviacaoAtual, extrairCores, statusDoPar, type ParAgregado, type StatusPar,
} from "../core/scanner";
import type { BancoCores } from "../core/nucleo";
import { plataforma, type PastaEscolhida } from "../platform";
import { IconeBusca, IconePasta } from "./Icons";

interface Props {
  banco: BancoCores;
  onAplicar: (pares: ParAgregado[], sobrescrever: boolean) => void;
}

interface Andamento { feitos: number; total: number; marca: string; arquivo: string }
interface Falha { caminho: string; motivo: string }
interface Resultado {
  pasta: string;
  pares: ParAgregado[];
  arquivos: number;
  marcas: number;
  semCores: number;
  falhas: Falha[];
  cancelado: boolean;
}

const LIMITE = 150;
const ROTULO: Record<StatusPar, string> = { nova: "Nova", igual: "Já existe", diferente: "Diferente" };
const pausa = () => new Promise<void>((r) => setTimeout(r, 0));

export function ScannerView({ banco, onAplicar }: Props) {
  const [andamento, setAndamento] = useState<Andamento | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [filtro, setFiltro] = useState<"todas" | StatusPar>("todas");
  const [busca, setBusca] = useState("");
  const [sobrescrever, setSobrescrever] = useState(false);
  const [aplicado, setAplicado] = useState(false);
  const cancelar = useRef(false);

  async function iniciar() {
    const pasta = await plataforma.escolherPasta();
    if (!pasta) return;
    setResultado(null); setAplicado(false); setFiltro("todas"); setBusca("");
    cancelar.current = false;
    await varrer(pasta);
  }

  async function varrer(pasta: PastaEscolhida) {
    const agreg = new Agregador();
    const falhas: Falha[] = [];
    const marcas = new Set<string>();
    let semCores = 0;
    let feitos = 0;
    for (const a of pasta.arquivos) {
      if (cancelar.current) break;
      setAndamento({ feitos, total: pasta.arquivos.length, marca: a.marca, arquivo: a.nome });
      try {
        const planilha = lerPlanilha(await a.ler());
        const pares = extrairCores(planilha, a.marca);
        if (pares.length) {
          agreg.adicionar(pares);
          marcas.add(a.marca || pares[0].marca);
        } else semCores++;
      } catch (e) {
        falhas.push({ caminho: `${a.marca}/${a.referencia}/${a.nome}`, motivo: e instanceof Error ? e.message : String(e) });
      }
      feitos++;
      if (feitos % 5 === 0) await pausa(); // deixa a tela respirar
    }
    setAndamento(null);
    setResultado({
      pasta: pasta.nome, pares: agreg.resultado(), arquivos: feitos, marcas: marcas.size,
      semCores, falhas, cancelado: cancelar.current,
    });
  }

  const linhas = useMemo(() => {
    if (!resultado) return [];
    const q = busca.trim().toLowerCase();
    return resultado.pares
      .map((p) => ({ p, status: statusDoPar(banco, p) }))
      .filter(({ p, status }) => (filtro === "todas" || status === filtro) && (!q || `${p.marca} ${p.cor} ${p.abrev}`.toLowerCase().includes(q)));
  }, [resultado, banco, filtro, busca]);

  const contagem = useMemo(() => {
    const c = { nova: 0, igual: 0, diferente: 0 };
    resultado?.pares.forEach((p) => c[statusDoPar(banco, p)]++);
    return c;
  }, [resultado, banco]);

  const aGravar = contagem.nova + (sobrescrever ? contagem.diferente : 0);
  const pct = andamento ? Math.round((andamento.feitos / Math.max(andamento.total, 1)) * 100) : 0;

  return (
    <>
      <div className="card card-pad">
        <h2>Aprender cores de uma pasta de planilhas prontas</h2>
        <p className="sub" style={{ margin: "4px 0 14px" }}>
          Escolha a <b>pasta raiz</b>. O programa percorre <span className="chip">Raiz / Marca / Referência / planilha.xlsx</span>,
          lê o <b>Código</b> e a <b>Descrição</b> de cada variação e deduz a abreviação de cada cor
          (Código = Código Pai + abreviação + tamanho). Nada é alterado nos seus arquivos.
        </p>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button className="btn lg" onClick={iniciar} disabled={!!andamento}><IconePasta size={18} /> Escolher pasta raiz…</button>
          {andamento && <button className="btn sec" onClick={() => { cancelar.current = true; }}>Parar</button>}
          {resultado && !andamento && <span className="sub">Última pasta: <b>{resultado.pasta}</b></span>}
        </div>
      </div>

      {andamento && (
        <div className="card card-pad">
          <div className="progresso">
            <small>
              Analisando {andamento.feitos + 1} de {andamento.total} · <b>{andamento.marca || "—"}</b> · {andamento.arquivo}
            </small>
            <div className="trilho"><div className="preench" style={{ width: `${pct}%` }} /></div>
          </div>
        </div>
      )}

      {resultado && !andamento && (
        <>
          <div className="resumo">
            <div className="card metric"><small>Arquivos analisados</small><div>{resultado.arquivos}</div></div>
            <div className="card metric"><small>Marcas com cores</small><div>{resultado.marcas}</div></div>
            <div className="card metric"><small>Marca + cor</small><div>{resultado.pares.length}</div></div>
            <div className="card metric"><small>Novas</small><div style={{ color: "var(--warn)" }}>{contagem.nova}</div></div>
            <div className="card metric"><small>Diferentes</small><div style={{ color: "var(--danger)" }}>{contagem.diferente}</div></div>
            <div className="card metric"><small>Já existem</small><div style={{ color: "var(--success)" }}>{contagem.igual}</div></div>
          </div>

          {(resultado.cancelado || resultado.semCores > 0 || resultado.falhas.length > 0) && (
            <div className="aviso-box">
              {resultado.cancelado && <div><b>Varredura interrompida</b> — só os arquivos já lidos entram no resultado.</div>}
              {resultado.semCores > 0 && <div>{resultado.semCores} arquivo(s) sem variações no padrão <i>Cor:…;Tamanho:…</i> (ainda não preenchidos) foram ignorados.</div>}
              {resultado.falhas.length > 0 && (
                <details>
                  <summary>{resultado.falhas.length} arquivo(s) não puderam ser lidos</summary>
                  {resultado.falhas.slice(0, 40).map((f) => <div key={f.caminho} className="exemplo">{f.caminho} — {f.motivo}</div>)}
                </details>
              )}
            </div>
          )}

          <div className="banco-ferr">
            <div className="busca">
              <IconeBusca size={16} />
              <input className="input" placeholder="Buscar marca, cor ou abreviação…" value={busca} onChange={(e) => setBusca(e.target.value)} />
            </div>
            <select className="input" style={{ width: 190 }} value={filtro} onChange={(e) => setFiltro(e.target.value as typeof filtro)}>
              <option value="todas">Todas</option>
              <option value="nova">Só novas</option>
              <option value="diferente">Só diferentes</option>
              <option value="igual">Só já existentes</option>
            </select>
          </div>

          <div className="card" style={{ overflow: "hidden", flex: "1 1 auto", minHeight: 420, display: "flex", flexDirection: "column" }}>
            <div className="card-head">
              <span>{linhas.length} resultado(s)</span>
              <span className="sub">{linhas.length > LIMITE ? `Mostrando ${LIMITE} — use a busca/filtro` : ""}</span>
            </div>
            <div className="tabela-wrap" style={{ flex: 1 }}>
              <table className="tabela">
                <thead>
                  <tr><th>Marca</th><th>Cor</th><th>Encontrada</th><th>No banco hoje</th><th>Vezes</th><th>Situação</th></tr>
                </thead>
                <tbody>
                  {linhas.slice(0, LIMITE).map(({ p, status }) => (
                    <tr key={`${p.marca}|${p.cor}`}>
                      <td>{p.marca}</td>
                      <td><div className="cor-cel" style={{ minWidth: 0 }}><span className="amostra" style={{ background: amostraCor(p.cor) }} />{p.cor}</div></td>
                      <td className="mono"><b>{p.abrev}</b>{p.alternativas.length > 0 && <span className="sub" title="Outras abreviações vistas para esta cor"> (também: {p.alternativas.join(", ")})</span>}</td>
                      <td className="mono">{abreviacaoAtual(banco, p) ?? "—"}</td>
                      <td className="mono">{p.ocorrencias}</td>
                      <td><span className={`badge ${status === "nova" ? "novo" : status === "igual" ? "ok" : "vazio"}`}>{ROTULO[status]}</span></td>
                    </tr>
                  ))}
                  {linhas.length === 0 && <tr><td colSpan={6} style={{ textAlign: "center", color: "var(--muted)", padding: 28 }}>Nada encontrado.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rodape-acoes">
            <label className="switch">
              <input type="checkbox" checked={sobrescrever} onChange={(e) => setSobrescrever(e.target.checked)} />
              Também sobrescrever as {contagem.diferente} abreviação(ões) diferentes das que já tenho
            </label>
            <div className="dir">
              <button className="btn lg" disabled={aGravar === 0 || aplicado}
                onClick={() => { onAplicar(resultado.pares, sobrescrever); setAplicado(true); }}>
                {aplicado ? "Banco atualizado ✓" : `Atualizar banco de cores (${aGravar})`}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
