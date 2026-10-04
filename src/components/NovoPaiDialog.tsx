import { useState } from "react";
import type { DadosNovoPai } from "../core/nucleo";
import { Modal } from "./Modal";

type Chave = keyof DadosNovoPai;
interface Campo { chave: Chave; rotulo: string; obrigatorio?: boolean; dica?: string; largo?: boolean }

const CAMPOS: Campo[] = [
  { chave: "codigo", rotulo: "Código do PAI (SKU)", dica: "Deixe em branco se ainda não decidiu", largo: true },
  { chave: "descricao", rotulo: "Descrição completa do produto", largo: true },
  { chave: "marca", rotulo: "Marca", obrigatorio: true },
  { chave: "categoria", rotulo: "Categoria", obrigatorio: true, dica: "Ex: Sandalia, Chinelo, Bota" },
  { chave: "peso_liquido", rotulo: "Peso líquido (Kg)", obrigatorio: true },
  { chave: "peso_bruto", rotulo: "Peso bruto (Kg)", obrigatorio: true },
  { chave: "largura", rotulo: "Largura do produto (cm)", obrigatorio: true },
  { chave: "altura", rotulo: "Altura do produto (cm)", obrigatorio: true },
  { chave: "profundidade", rotulo: "Profundidade do produto (cm)", obrigatorio: true },
  { chave: "volumes", rotulo: "Volumes", obrigatorio: true },
  { chave: "itens_caixa", rotulo: "Itens por caixa", obrigatorio: true },
  { chave: "data_validade", rotulo: "Data de validade (opcional)" },
];

interface Props {
  onConfirmar: (dados: DadosNovoPai) => void;
  onCancelar: () => void;
}

export function NovoPaiDialog({ onConfirmar, onCancelar }: Props) {
  const [valores, setValores] = useState<Record<string, string>>({});
  const [tentou, setTentou] = useState(false);

  const faltando = CAMPOS.filter((c) => c.obrigatorio && !(valores[c.chave] ?? "").trim());

  function confirmar() {
    setTentou(true);
    if (faltando.length) return;
    const d = Object.fromEntries(CAMPOS.map((c) => [c.chave, (valores[c.chave] ?? "").trim()]));
    onConfirmar(d as unknown as DadosNovoPai);
  }

  return (
    <Modal
      titulo="Criar PAI"
      onFechar={onCancelar}
      largura={700}
      rodape={
        <>
          <button className="btn sec" onClick={onCancelar}>Cancelar</button>
          <button className="btn" onClick={confirmar}>Criar PAI e continuar</button>
        </>
      }
    >
      <p className="sub" style={{ marginTop: 0 }}>
        Não encontrei um PAI já cadastrado neste arquivo. Preencha os dados abaixo para criar essa linha:
      </p>
      <div className="form-grid">
        {CAMPOS.map((c, i) => {
          const erro = tentou && c.obrigatorio && !(valores[c.chave] ?? "").trim();
          return (
            <div key={c.chave} className={`campo ${c.largo ? "full" : ""}`}>
              <label htmlFor={`pai-${c.chave}`}>
                {c.rotulo} {c.obrigatorio && <em>*</em>}
              </label>
              <input
                id={`pai-${c.chave}`}
                className={`input ${erro ? "erro" : ""}`}
                autoFocus={i === 0}
                value={valores[c.chave] ?? ""}
                placeholder={c.dica}
                onChange={(e) => setValores({ ...valores, [c.chave]: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && confirmar()}
              />
              {erro && <small>Obrigatório</small>}
            </div>
          );
        })}
      </div>
    </Modal>
  );
}
