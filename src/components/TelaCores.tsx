import { useMemo, useRef, useState } from "react";
import { amostraCor } from "../cores";
import {
  buscarCor, consultarAbreviacao, tamanhosOrdenados, titulo, limpo, type BancoCores, type Grupo, type Planilha,
} from "../core/nucleo";
import { IconeSeta } from "./Icons";
import { Modal } from "./Modal";

interface Props {
  codigoPai: string;
  marca: string;
  categoria: string;
  totalVariacoes: number;
  grupos: Map<string, Grupo>;
  planilha: Planilha;
  banco: BancoCores;
  onGerar: (cores: Map<string, [string, string]>) => void;
  onCancelar: () => void;
}

interface LinhaCor {
  chave: string;
  cor: string;
  abrev: string;
  auto: boolean; // abreviação preenchida pelo histórico (pode ser refeita ao mudar o nome)
}

export function TelaCores({ codigoPai, marca, categoria, totalVariacoes, grupos, planilha, banco, onGerar, onCancelar }: Props) {
  const [linhas, setLinhas] = useState<LinhaCor[]>(() =>
    [...grupos.entries()]
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([chave, g]) => {
        // cor já conhecida (mesmo com acento diferente): usa a grafia do banco, ex. "Avela" -> "Avelã"
        const achado = buscarCor(banco, marca, g.sugestao);
        return { chave, cor: achado ? titulo(achado.nome) : g.sugestao, abrev: achado?.abrev ?? "", auto: !!achado };
      }),
  );
  const [soPendentes, setSoPendentes] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const original = (g: Grupo) => {
    const l = planilha.linhas[g.indices[0]];
    const cod = limpo(l["Cód. no fornecedor"]);
    return `${limpo(l["Descrição"])}${cod ? `  ·  forn.: ${cod}` : ""}`;
  };
  const refsAbrev = useRef<Array<HTMLInputElement | null>>([]);

  const prontas = linhas.filter((l) => l.cor.trim() && l.abrev.trim()).length;
  const pendentes = linhas.length - prontas;
  const pct = linhas.length ? Math.round((prontas / linhas.length) * 100) : 100;

  function mudar(chave: string, parcial: Partial<LinhaCor>) {
    setLinhas((ls) => ls.map((l) => (l.chave === chave ? { ...l, ...parcial } : l)));
  }

  function aoMudarCor(l: LinhaCor, cor: string) {
    // enquanto a abreviação não foi digitada à mão, acompanha o histórico do nome editado
    if (l.auto || !l.abrev) {
      const conhecida = consultarAbreviacao(banco, marca, cor);
      mudar(l.chave, { cor, abrev: conhecida ?? "", auto: !!conhecida });
    } else {
      mudar(l.chave, { cor });
    }
  }

  function gerar(forcar = false) {
    if (pendentes > 0 && !forcar) return setConfirmar(true);
    const mapa = new Map<string, [string, string]>();
    for (const l of linhas) if (l.cor.trim() && l.abrev.trim()) mapa.set(l.chave, [l.cor.trim(), l.abrev.trim()]);
    onGerar(mapa);
  }

  const visiveis = useMemo(
    () => linhas.map((l, i) => ({ l, i })).filter(({ l }) => !soPendentes || !(l.cor.trim() && l.abrev.trim())),
    [linhas, soPendentes],
  );

  return (
    <>
      <div className="resumo">
        <div className="card metric destaque"><small>Código do PAI</small><div>{codigoPai}</div></div>
        <div className="card metric"><small>Marca</small><div>{marca || "—"}</div></div>
        <div className="card metric"><small>Categoria</small><div>{categoria || "—"}</div></div>
        <div className="card metric"><small>Variações</small><div>{totalVariacoes}</div></div>
        <div className="card metric"><small>Cores detectadas</small><div>{linhas.length}</div></div>
      </div>

      <div className="barra">
        <div className="progresso">
          <small>{prontas} de {linhas.length} cores prontas {pendentes > 0 && `· ${pendentes} pendente(s)`}</small>
          <div className="trilho"><div className="preench" style={{ width: `${pct}%` }} /></div>
        </div>
        <label className="switch">
          <input type="checkbox" checked={soPendentes} onChange={(e) => setSoPendentes(e.target.checked)} />
          Mostrar só pendentes
        </label>
      </div>

      <div className="card" style={{ overflow: "hidden", flex: "1 1 auto", minHeight: 220, display: "flex", flexDirection: "column" }}>
        <div className="tabela-wrap" style={{ flex: 1 }}>
          <table className="tabela">
            <thead>
              <tr>
                <th>Cor (confira / edite)</th>
                <th style={{ width: 170 }}>Abreviação</th>
                <th style={{ width: 130 }}>Situação</th>
                <th>Tamanhos</th>
                <th style={{ width: 60 }}>Qtd.</th>
                <th>Exemplo de código</th>
              </tr>
            </thead>
            <tbody>
              {visiveis.map(({ l, i }) => {
                const g = grupos.get(l.chave)!;
                const tams = tamanhosOrdenados(g.tamanhos);
                const pronto = l.cor.trim() && l.abrev.trim();
                const conhecida = consultarAbreviacao(banco, marca, l.cor);
                const situacao = !pronto ? "vazio" : conhecida && conhecida === l.abrev.trim().toUpperCase() ? "ok" : "novo";
                return (
                  <tr key={l.chave}>
                    <td>
                      <div className="cor-cel">
                        <span className="amostra" style={{ background: amostraCor(l.cor) }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <input
                            className="input"
                            value={l.cor}
                            placeholder="Nome da cor"
                            onChange={(e) => aoMudarCor(l, e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && refsAbrev.current[i]?.focus()}
                          />
                          <div className="orig" title={original(g)}>Original: {original(g)}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <input
                        ref={(el) => { refsAbrev.current[i] = el; }}
                        className="input mono"
                        value={l.abrev}
                        placeholder="ABREV"
                        onChange={(e) => mudar(l.chave, { abrev: e.target.value.toUpperCase(), auto: false })}
                        onKeyDown={(e) => {
                          if (e.key !== "Enter") return;
                          const prox = visiveis.find((v) => v.i > i);
                          if (prox) refsAbrev.current[prox.i]?.focus();
                          else gerar();
                        }}
                      />
                    </td>
                    <td>
                      {situacao === "ok" && <span className="badge ok">✓ Do histórico</span>}
                      {situacao === "novo" && <span className="badge novo">● Nova</span>}
                      {situacao === "vazio" && <span className="badge vazio">Pendente</span>}
                    </td>
                    <td>
                      <div className="tams">{tams.map((t) => <span key={t} className="chip">{t}</span>)}</div>
                    </td>
                    <td className="mono">{g.indices.length}</td>
                    <td className="exemplo">
                      {l.abrev.trim()
                        ? <><b>{codigoPai}</b><i>{l.abrev.trim().toUpperCase()}</i>{tams[0] !== "?" ? tams[0] : "?"}</>
                        : "—"}
                    </td>
                  </tr>
                );
              })}
              {visiveis.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: "center", color: "var(--muted)", padding: 28 }}>Nenhuma cor pendente 🎉</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="sub" style={{ margin: 0 }}>
        Dica: digite a abreviação e aperte <b>Enter</b> para ir para a próxima cor. Se alguma cor foi dividida em duas
        linhas por engano (ou duas cores foram juntadas), guarde esse arquivo para ajustar a regra de agrupamento.
      </p>

      <div className="rodape-acoes">
        <button className="btn ghost" onClick={onCancelar}>Cancelar</button>
        <div className="dir">
          <button className="btn lg" onClick={() => gerar()}>
            Gerar Código e Descrição <IconeSeta size={18} />
          </button>
        </div>
      </div>

      {confirmar && (
        <Modal
          titulo="Cores incompletas"
          onFechar={() => setConfirmar(false)}
          largura={480}
          rodape={
            <>
              <button className="btn sec" onClick={() => setConfirmar(false)}>Voltar e completar</button>
              <button className="btn" onClick={() => { setConfirmar(false); gerar(true); }}>Continuar mesmo assim</button>
            </>
          }
        >
          <p style={{ marginTop: 0 }}>
            <b>{pendentes}</b> grupo(s) de cor estão sem nome ou sem abreviação e vão ficar sem Código/Descrição.
            Deseja continuar mesmo assim?
          </p>
        </Modal>
      )}
    </>
  );
}
