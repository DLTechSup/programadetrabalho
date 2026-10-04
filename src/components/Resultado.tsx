import type { Linha, Planilha } from "../core/nucleo";
import { limpo } from "../core/nucleo";
import { IconeAlerta, IconeCheck, IconePasta, IconeSalvar } from "./Icons";

export interface ResumoGeracao {
  total: number;
  cores: number;
  linhasSemTamanho: number[];
}

interface Props {
  planilha: Planilha;
  paiIdx: number;
  codigoPai: string;
  resumo: ResumoGeracao | null;
  caminhoSalvo: string | null;
  onSalvar: () => void;
  onMostrarPasta: () => void;
  onNova: () => void;
}

const LIMITE = 80;

export function Resultado({ planilha, paiIdx, codigoPai, resumo, caminhoSalvo, onSalvar, onMostrarPasta, onNova }: Props) {
  const semCodigo = !codigoPai;
  const aviso = semCodigo || !resumo;
  const mostrar = planilha.linhas.slice(0, LIMITE).map((l, i) => ({ l, i }));

  return (
    <>
      <div className={`card hero ${aviso ? "aviso" : ""}`}>
        <div className="check">{aviso ? <IconeAlerta size={28} /> : <IconeCheck size={28} />}</div>
        <div>
          <h2>
            {semCodigo
              ? "Campos de apoio preenchidos — falta o código do PAI"
              : resumo
                ? `${resumo.total} variação(ões) com Código e Descrição`
                : "Geração de cores cancelada"}
          </h2>
          <div className="sub">
            {semCodigo
              ? "O PAI ainda não tem 'Código'. Preencha-o, exporte de novo e rode o programa novamente para gerar os SKUs."
              : resumo
                ? `${resumo.cores} cor(es) aplicada(s) · PAI ${codigoPai}`
                : "Os demais campos já preenchidos continuam disponíveis para salvar."}
          </div>
        </div>
        <div className="acoes">
          <button className="btn sec" onClick={onNova}>Nova planilha</button>
          {caminhoSalvo && (
            <button className="btn sec" onClick={onMostrarPasta}><IconePasta size={17} /> Mostrar na pasta</button>
          )}
          <button className="btn lg" onClick={onSalvar}><IconeSalvar size={18} /> Salvar planilha pronta…</button>
        </div>
      </div>

      {caminhoSalvo && (
        <div className="aviso-box" style={{ background: "var(--success-soft)", color: "var(--success)" }}>
          <b>Arquivo salvo:</b> {caminhoSalvo}
        </div>
      )}

      {resumo && resumo.linhasSemTamanho.length > 0 && (
        <div className="aviso-box">
          <b>Atenção:</b> não identifiquei o tamanho automaticamente nas linhas{" "}
          <b>{resumo.linhasSemTamanho.join(", ")}</b> (número da linha no Excel) — preencha essas manualmente.
        </div>
      )}

      <div className="card" style={{ overflow: "hidden" }}>
        <div className="card-head">
          <span>Pré-visualização</span>
          <span className="sub">
            {planilha.linhas.length > LIMITE ? `Mostrando ${LIMITE} de ${planilha.linhas.length} linhas` : `${planilha.linhas.length} linhas`}
          </span>
        </div>
        <div className="tabela-wrap limite">
          <table className="tabela">
            <thead>
              <tr>
                <th style={{ width: 54 }}>Linha</th>
                <th>Código</th>
                <th>Descrição</th>
                <th>Cód. no fornecedor</th>
                <th>Categoria</th>
                <th>Código Pai</th>
              </tr>
            </thead>
            <tbody>
              {mostrar.map(({ l, i }) => (
                <tr key={i} className={i === paiIdx ? "pai" : ""}>
                  <td className="mono">{i + 2}</td>
                  <td className="mono"><b>{limpo(l["Código"]) || "—"}</b>{i === paiIdx && <span className="badge info" style={{ marginLeft: 8 }}>PAI</span>}</td>
                  <td>{celula(l, "Descrição")}</td>
                  <td className="mono">{celula(l, "Cód. no fornecedor")}</td>
                  <td>{celula(l, "Categoria do produto")}</td>
                  <td className="mono">{celula(l, "Código Pai")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function celula(l: Linha, coluna: string): string {
  return limpo(l[coluna]) || "—";
}
