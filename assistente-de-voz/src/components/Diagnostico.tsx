import { Icone } from "./Icons";
import { useAssistente, type Captura } from "../assistente";

function veredito(c: Captura): { tom: "ok" | "aviso" | "erro"; texto: string } {
  const { pico, duracaoMs } = c.stats;
  if (pico < 0.03) return { tom: "erro", texto: "Volume muito baixo. Aumente o volume do microfone (no celular/aplicativo) ou a sensibilidade." };
  if (pico > 0.98) return { tom: "erro", texto: "Estourando (som distorcido). Diminua o volume do microfone." };
  if (duracaoMs < 700) return { tom: "aviso", texto: "Frase muito curta: pode ter sido cortada. Fale a frase inteira, sem pausa no começo." };
  if (pico < 0.1) return { tom: "aviso", texto: "Volume baixo: eu amplifico, mas o ruído também aumenta. Chegue o microfone mais perto." };
  return { tom: "ok", texto: "Áudio bom." };
}

/** Últimas frases captadas: dá para ouvir o que o microfone mandou, ver o volume e o que foi reconhecido. */
export function Diagnostico() {
  const a = useAssistente();
  const lista = [...a.capturas].reverse();
  return (
    <section className="cartao">
      <h3>Diagnóstico do microfone</h3>
      <p className="muted">Fale algo com a escuta ligada. Aparecem as últimas frases: toque ▶ para ouvir <b>exatamente o que o programa recebeu</b> — se estiver baixo, abafado ou cortado, o problema é o microfone/aplicativo, não o reconhecimento.</p>
      {lista.length === 0 && <p className="muted vazio-diag">Nenhuma frase captada ainda.</p>}
      <ul className="capturas">
        {lista.map((c) => {
          const v = veredito(c);
          return (
            <li key={c.id}>
              <button className="btn-icone" onClick={() => a.tocarCaptura(c.id)} title="Ouvir"><Icone nome="play" tam={16} /></button>
              <div className="cap-corpo">
                <div className="cap-texto">{c.texto ? <>“{c.texto}”</> : <i className="muted">(nada reconhecido)</i>}</div>
                <div className="cap-nivel"><div className={`cap-barra ${v.tom}`} style={{ width: `${Math.min(100, c.stats.pico * 100)}%` }} /></div>
                <small>{(c.stats.duracaoMs / 1000).toFixed(1)} s · reconheci em {(c.ms / 1000).toFixed(1)} s · volume {Math.round(c.stats.pico * 100)}% {c.stats.ganho > 1.5 ? `(amplificado ${c.stats.ganho.toFixed(0)}x)` : ""} · <span className={`v-${v.tom}`}>{v.texto}</span></small>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
