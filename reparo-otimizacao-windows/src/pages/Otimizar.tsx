import { useEffect, useState } from "react";
import { Icone } from "../components/Icons";
import { ListaTarefas } from "../components/ListaTarefas";
import { useApp } from "../state";
import { ITENS, SINTOMAS, idsDoSintoma } from "../lib/catalogo";

export function Otimizar({ sintomaInicial }: { sintomaInicial?: string }) {
  const { executar } = useApp();
  const [sintoma, setSintoma] = useState<string | null>(sintomaInicial ?? null);
  const [sel, setSel] = useState<Set<string>>(new Set(sintomaInicial ? idsDoSintoma(sintomaInicial) : []));

  useEffect(() => {
    if (sintomaInicial) {
      setSintoma(sintomaInicial);
      setSel(new Set(idsDoSintoma(sintomaInicial)));
    }
  }, [sintomaInicial]);

  const escolher = (id: string) => {
    setSintoma(id);
    setSel(new Set(idsDoSintoma(id)));
  };
  const itens = ITENS.filter((i) => !(i.limpeza && ["windows_old", "hibernacao"].includes(i.id.replace("limpar:", ""))));

  return (
    <div className="pagina com-barra">
      <header className="pagina-topo">
        <div>
          <h1>Otimização e reparo</h1>
          <p className="muted">Escolha o que o cliente está reclamando: já deixo marcado o que costuma resolver. Você ainda pode ajustar item por item.</p>
        </div>
      </header>

      <div className="cartoes">
        {SINTOMAS.map((s) => (
          <button key={s.id} className={`cartao-sintoma${sintoma === s.id ? " ativo" : ""}`} onClick={() => escolher(s.id)}>
            <span className="cartao-ico"><Icone nome={s.icone} tam={22} /></span>
            <strong>{s.titulo}</strong>
            <small>{s.descricao}</small>
          </button>
        ))}
      </div>

      <div className="linha-acoes">
        <h2 className="secao">Tudo que posso fazer</h2>
        <div>
          <button className="btn" onClick={() => setSel(new Set(itens.map((i) => i.id)))}>Marcar tudo</button>{" "}
          <button className="btn" onClick={() => { setSel(new Set()); setSintoma(null); }}>Limpar seleção</button>
        </div>
      </div>
      <ListaTarefas itens={itens} sel={sel} alternar={(id, v) => setSel((s) => { const n = new Set(s); v ? n.add(id) : n.delete(id); return n; })} />

      <div className="barra-acao">
        <div>
          <strong>{sel.size} item(ns) selecionado(s)</strong>
          <small>Você revisa e confirma antes de executar.</small>
        </div>
        <button className="btn primario" disabled={!sel.size} onClick={() => executar([...sel], "Otimizar e reparar")}><Icone nome="play" tam={16} /> Executar selecionados</button>
      </div>
    </div>
  );
}
