import { useState } from "react";
import type { Planilha } from "../core/nucleo";
import { limpo } from "../core/nucleo";
import { Modal } from "./Modal";
import { IconeAlerta, IconeCheck, IconePasta, IconeSalvar } from "./Icons";

export interface ResumoGeracao {
  total: number;
  cores: number;
  linhasSemTamanho: number[];
  removidas?: number;
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
  /** Altera um campo; com `todas` repete o valor em toda a coluna. Devolve quantas linhas mudaram. */
  onEditar: (idx: number, coluna: string, valor: string, todas: boolean) => number;
  abreviacoesAGuardar?: number;
}

const LIMITE = 80;

export function Resultado({ planilha, paiIdx, codigoPai, resumo, caminhoSalvo, onSalvar, onMostrarPasta, onNova, onEditar, abreviacoesAGuardar = 0 }: Props) {
  const [pendente, setPendente] = useState<{ idx: number; coluna: string; valor: string } | null>(null);
  const semCodigo = !codigoPai;
  const aviso = semCodigo || !resumo;
  const mostrar = planilha.linhas.slice(0, LIMITE).map((l, i) => ({ l, i }));

  const nomes: Record<string, string> = { "Categoria do produto": "Categoria" };
  const nomeColuna = (c: string) => nomes[c] ?? c;
  const pedir = (idx: number, coluna: string, valor: string) => {
    if (valor === limpo(planilha.linhas[idx][coluna])) return;
    setPendente({ idx, coluna, valor });
  };
  const aplicar = (todas: boolean) => {
    if (!pendente) return;
    onEditar(pendente.idx, pendente.coluna, pendente.valor, todas);
    setPendente(null);
  };
  const total = planilha.linhas.length;

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
                ? `${resumo.cores} cor(es) aplicada(s) · PAI ${codigoPai}${resumo.removidas ? ` · ${resumo.removidas} linha(s) pendente(s) removida(s)` : ""}`
                : "Os demais campos já preenchidos continuam disponíveis para salvar."}
          </div>
        </div>
        <div className="acoes">
          <button className="btn sec" onClick={onNova}>Novo documento</button>
          {caminhoSalvo && (
            <button className="btn sec" onClick={onMostrarPasta}><IconePasta size={17} /> Mostrar na pasta</button>
          )}
          <button className="btn lg" onClick={onSalvar}><IconeSalvar size={18} /> Salvar planilha pronta…</button>
        </div>
      </div>

      {!caminhoSalvo && abreviacoesAGuardar > 0 && (
        <div className="aviso-box" style={{ background: "var(--primary-soft)", color: "var(--primary)" }}>
          As abreviações deste arquivo só entram no banco de cores quando você <b>salvar</b> a planilha.
          Se descartar, nada é aprendido.
        </div>
      )}

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
                  <td className="mono"><Editavel valor={limpo(l["Código"])} negrito onConfirmar={(v) => pedir(i, "Código", v)} />{i === paiIdx && <span className="badge info" style={{ marginLeft: 8 }}>PAI</span>}</td>
                  <td><Editavel valor={limpo(l["Descrição"])} onConfirmar={(v) => pedir(i, "Descrição", v)} /></td>
                  <td className="mono"><Editavel valor={limpo(l["Cód. no fornecedor"])} onConfirmar={(v) => pedir(i, "Cód. no fornecedor", v)} /></td>
                  <td><Editavel valor={limpo(l["Categoria do produto"])} onConfirmar={(v) => pedir(i, "Categoria do produto", v)} /></td>
                  <td className="mono"><Editavel valor={limpo(l["Código Pai"])} onConfirmar={(v) => pedir(i, "Código Pai", v)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {pendente && (
        <Modal titulo="Aplicar a alteração em toda a coluna?" largura={520} onFechar={() => setPendente(null)}
          rodape={
            <>
              <button className="btn sec" onClick={() => setPendente(null)}>Cancelar</button>
              <button className="btn sec" onClick={() => aplicar(false)}>Só esta linha</button>
              <button className="btn" onClick={() => aplicar(true)}>Todas as {total} linhas</button>
            </>
          }>
          <p style={{ marginTop: 0 }}>
            Você mudou <b>{nomeColuna(pendente.coluna)}</b> da linha {pendente.idx + 2} para:
          </p>
          <p className="mono" style={{ wordBreak: "break-all" }}><b>{pendente.valor || "(vazio)"}</b></p>
          <p style={{ marginBottom: 0 }}>
            Quer deixar <b>todas as linhas</b> da coluna {nomeColuna(pendente.coluna)} com esse mesmo valor?
          </p>
        </Modal>
      )}
    </>
  );
}

/** Texto que vira campo de edição ao clicar. Enter/saída do campo confirma, Esc cancela. */
function Editavel({ valor, onConfirmar, negrito }: { valor: string; onConfirmar: (v: string) => void; negrito?: boolean }) {
  const [editando, setEditando] = useState(false);
  const [rascunho, setRascunho] = useState(valor);

  if (!editando) {
    return (
      <span className="editavel" title="Clique para editar" tabIndex={0}
        onClick={() => { setRascunho(valor); setEditando(true); }}
        onKeyDown={(e) => { if (e.key === "Enter") { setRascunho(valor); setEditando(true); } }}>
        {negrito ? <b>{valor || "—"}</b> : valor || "—"}
      </span>
    );
  }
  const fechar = (confirmar: boolean) => {
    setEditando(false);
    if (confirmar) onConfirmar(rascunho.trim());
  };
  return (
    <input className="input editando" autoFocus value={rascunho}
      onChange={(e) => setRascunho(e.target.value)}
      onFocus={(e) => e.target.select()}
      onBlur={() => fechar(true)}
      onKeyDown={(e) => {
        if (e.key === "Enter") fechar(true);
        else if (e.key === "Escape") { e.stopPropagation(); fechar(false); }
      }} />
  );
}
