import { Caixa, SeloRisco } from "./ui";
import { Icone } from "./Icons";
import { CATEGORIAS, type ItemCatalogo } from "../lib/catalogo";
import { bytes } from "../lib/format";

/** Lista de tarefas com caixa de seleção, agrupadas por categoria. */
export function ListaTarefas({ itens, sel, alternar, tamanhos }: { itens: ItemCatalogo[]; sel: Set<string>; alternar(id: string, v: boolean): void; tamanhos?: Record<string, number | null | undefined> }) {
  const grupos = CATEGORIAS.map((c) => ({ ...c, itens: itens.filter((i) => i.categoria === c.id) })).filter((g) => g.itens.length);
  return (
    <div className="grupos">
      {grupos.map((g) => (
        <section key={g.id} className="grupo">
          <h3>{g.titulo}</h3>
          <ul className="tarefas">
            {g.itens.map((i) => (
              <li key={i.id} className={sel.has(i.id) ? "sel" : ""}>
                <Caixa marcado={sel.has(i.id)} onChange={(v) => alternar(i.id, v)} rotulo={i.titulo} />
                <div className="tarefa-texto" onClick={() => alternar(i.id, !sel.has(i.id))}>
                  <div className="tarefa-titulo">
                    <strong>{i.titulo}</strong>
                    <SeloRisco risco={i.risco} />
                    {i.duracao === "longa" && <span className="selo neutro">demora</span>}
                    {i.reinicia && <span className="selo neutro">reinicia</span>}
                  </div>
                  <p>{i.descricao}</p>
                  {i.aviso && <small className="aviso-linha"><Icone nome="alert" tam={13} /> {i.aviso}</small>}
                </div>
                {tamanhos && i.id in tamanhos && <span className="tarefa-tam">{tamanhos[i.id] == null ? "?" : bytes(tamanhos[i.id])}</span>}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
