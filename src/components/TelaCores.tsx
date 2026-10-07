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
  /** `removidas`: chaves dos grupos de cor cujas linhas devem ser apagadas da planilha final. */
  onGerar: (cores: Map<string, [string, string]>, removidas: string[]) => void;
  onCancelar: () => void;
}

interface LinhaCor {
  chave: string;
  cor: string;
  abrev: string;
  auto: boolean; // abreviação preenchida pelo histórico (pode ser refeita ao mudar o nome)
  removida: boolean; // cor marcada para sair da planilha final
}

export function TelaCores({ codigoPai, marca, categoria, totalVariacoes, grupos, planilha, banco, onGerar, onCancelar }: Props) {
  const [linhas, setLinhas] = useState<LinhaCor[]>(() =>
    [...grupos.entries()]
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([chave, g]) => {
        // cor já conhecida (mesmo com acento diferente): usa a grafia do banco, ex. "Avela" -> "Avelã"
        const achado = buscarCor(banco, marca, g.sugestao);
        return { chave, cor: achado ? titulo(achado.nome) : g.sugestao, abrev: achado?.abrev ?? "", auto: !!achado, removida: false };
      }),
  );
  const [soPendentes, setSoPendentes] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const [confirmarCancelar, setConfirmarCancelar] = useState(false);
  const inicial = useRef(JSON.stringify(linhas.map((l) => [l.cor, l.abrev, l.removida])));
  const alterado = JSON.stringify(linhas.map((l) => [l.cor, l.abrev, l.removida])) !== inicial.current;
  const original = (g: Grupo) => {
    const l = planilha.linhas[g.indices[0]];
    const cod = limpo(l["Cód. no fornecedor"]);
    return `${limpo(l["Descrição"])}${cod ? `  ·  forn.: ${cod}` : ""}`;
  };
  const refsAbrev = useRef<Array<HTMLInputElement | null>>([]);

  const ehPronta = (l: LinhaCor) => !!(l.cor.trim() && l.abrev.trim());
  const ativas = linhas.filter((l) => !l.removida);
  const prontas = ativas.filter(ehPronta).length;
  const pendentes = ativas.length - prontas;
  const removidas = linhas.filter((l) => l.removida);
  const linhasPendentes = ativas.filter((l) => !ehPronta(l)).reduce((s, l) => s + grupos.get(l.chave)!.indices.length, 0);
  const pct = ativas.length ? Math.round((prontas / ativas.length) * 100) : 100;

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

  /** `pendentes`: "manter" deixa as cores incompletas sem código; "remover" apaga as linhas delas. */
  function gerar(pendentesNoFim: "perguntar" | "manter" | "remover" = "perguntar") {
    if (pendentes > 0 && pendentesNoFim === "perguntar") return setConfirmar(true);
    const mapa = new Map<string, [string, string]>();
    for (const l of ativas) if (ehPronta(l)) mapa.set(l.chave, [l.cor.trim(), l.abrev.trim()]);
    const apagar = removidas.map((l) => l.chave);
    if (pendentesNoFim === "remover") for (const l of ativas) if (!ehPronta(l)) apagar.push(l.chave);
    onGerar(mapa, apagar);
  }

  function cancelar() {
    if (alterado) setConfirmarCancelar(true);
    else onCancelar();
  }

  const visiveis = useMemo(
    () => linhas.map((l, i) => ({ l, i })).filter(({ l }) => !soPendentes || (!l.removida && !ehPronta(l))),
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
          <small>{prontas} de {ativas.length} cores prontas {pendentes > 0 && `· ${pendentes} pendente(s)`}{removidas.length > 0 && ` · ${removidas.length} removida(s)`}</small>
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
                <th style={{ width: 120 }}>Abreviação</th>
                <th style={{ width: 120 }}>Situação</th>
                <th>Tamanhos</th>
                <th style={{ width: 48 }}>Qtd.</th>
                <th>Exemplo de código</th>
                <th style={{ width: 70 }} />
              </tr>
            </thead>
            <tbody>
              {visiveis.map(({ l, i }) => {
                const g = grupos.get(l.chave)!;
                const tams = tamanhosOrdenados(g.tamanhos);
                const pronto = ehPronta(l);
                const conhecida = consultarAbreviacao(banco, marca, l.cor);
                const situacao = !pronto ? "vazio" : conhecida && conhecida === l.abrev.trim().toUpperCase() ? "ok" : "novo";
                return (
                  <tr key={l.chave} className={l.removida ? "removida" : ""}>
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
                      {l.removida && <span className="badge vazio">Será removida</span>}
                      {!l.removida && situacao === "ok" && <span className="badge ok">✓ Do histórico</span>}
                      {!l.removida && situacao === "novo" && <span className="badge novo">● Nova</span>}
                      {!l.removida && situacao === "vazio" && <span className="badge vazio">Pendente</span>}
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
                    <td>
                      <button
                        className="btn ghost sm"
                        title={l.removida ? "Voltar a usar esta cor" : "Apagar as linhas desta cor da planilha final"}
                        onClick={() => mudar(l.chave, { removida: !l.removida })}
                      >
                        {l.removida ? "Restaurar" : "Remover"}
                      </button>
                    </td>
                  </tr>
                );
              })}
              {visiveis.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: "center", color: "var(--muted)", padding: 28 }}>Nenhuma cor pendente 🎉</td></tr>
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
        <button className="btn ghost" onClick={cancelar}>Cancelar e descartar</button>
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
              <button className="btn sec" onClick={() => { setConfirmar(false); gerar("manter"); }}>Manter sem código</button>
              <button className="btn" onClick={() => { setConfirmar(false); gerar("remover"); }}>Remover pendentes</button>
            </>
          }
        >
          <p style={{ marginTop: 0 }}>
            <b>{pendentes}</b> cor(es) estão sem nome ou sem abreviação ({linhasPendentes} linha(s) da planilha).
          </p>
          <ul style={{ margin: 0, paddingLeft: 20 }}>
            <li><b>Remover pendentes</b>: apaga essas linhas da planilha final, para não irem para o Bling.</li>
            <li><b>Manter sem código</b>: elas continuam na planilha, sem Código/Descrição.</li>
          </ul>
        </Modal>
      )}

      {confirmarCancelar && (
        <Modal
          titulo="Descartar este arquivo?"
          onFechar={() => setConfirmarCancelar(false)}
          largura={460}
          rodape={
            <>
              <button className="btn sec" onClick={() => setConfirmarCancelar(false)}>Continuar editando</button>
              <button className="btn danger" onClick={onCancelar}>Descartar tudo</button>
            </>
          }
        >
          <p style={{ marginTop: 0 }}>
            Tudo o que você preencheu neste arquivo será perdido. Nada é salvo e nenhuma abreviação nova é aprendida.
          </p>
        </Modal>
      )}
    </>
  );
}
