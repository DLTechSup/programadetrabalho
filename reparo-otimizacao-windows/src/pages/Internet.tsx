import { useState } from "react";
import type { TesteInternet } from "../api/types";
import { Aviso, Barra } from "../components/ui";
import { Icone } from "../components/Icons";
import { ListaTarefas } from "../components/ListaTarefas";
import { useApp } from "../state";
import { ITENS } from "../lib/catalogo";

export function veredito(t: TesteInternet): { tom: "info" | "atencao" | "erro"; texto: string } {
  if (!t.conectado) return { tom: "erro", texto: "Sem conexão com a internet. Verifique o cabo/Wi-Fi e o roteador antes de mexer no Windows." };
  const atual = t.resolvedores[0];
  const melhor = t.resolvedores.slice(1).filter((r) => r.ms != null).sort((a, b) => a.ms! - b.ms!)[0];
  if (atual.ms == null) return { tom: "erro", texto: "O DNS atual não está respondendo: é muito provável que seja esse o motivo dos sites não abrirem. Aplique “Usar DNS rápido”." };
  if (melhor && atual.ms > 120 && atual.ms > melhor.ms! * 2.5) return { tom: "atencao", texto: `O DNS atual leva ${atual.ms} ms por consulta; ${melhor.nome} leva ${melhor.ms} ms. Trocar o DNS deve deixar os sites mais rápidos.` };
  if (t.latenciaMs != null && t.latenciaMs > 150) return { tom: "atencao", texto: `O DNS está normal, mas a latência da conexão está alta (${t.latenciaMs} ms). O problema provavelmente é o Wi-Fi, o roteador ou o provedor.` };
  return { tom: "info", texto: "DNS e latência estão normais. Se os sites ainda demoram, teste o cabo/Wi-Fi, reinicie o roteador e use a limpeza de cache dos navegadores." };
}

export function Internet() {
  const { api, executar } = useApp();
  const [teste, setTeste] = useState<TesteInternet | null>(null);
  const [testando, setTestando] = useState(false);
  const itens = ITENS.filter((i) => i.categoria === "rede" || i.id === "limpar:cache_navegadores");
  const [sel, setSel] = useState<Set<string>>(new Set(["dns_limpar", "dns_rapido", "limpar:cache_navegadores"]));

  async function testar() {
    setTestando(true);
    setTeste(await api.testarInternet());
    setTestando(false);
  }
  const v = teste ? veredito(teste) : null;
  const maximo = Math.max(1, ...(teste?.resolvedores.map((r) => r.ms ?? 0) ?? [1]));

  return (
    <div className="pagina com-barra">
      <header className="pagina-topo">
        <div>
          <h1>Internet e sites lentos</h1>
          <p className="muted">Mede a velocidade de resposta do DNS (a causa mais comum de sites demorando a abrir) e aplica as correções.</p>
        </div>
        <button className="btn primario" disabled={testando} onClick={testar}>{testando ? <span className="spinner" /> : <Icone nome="globe" tam={16} />} Testar a internet</button>
      </header>
      {teste && v && (
        <div className="cartao">
          <h3>Resultado do teste</h3>
          <div className="tipos">
            {teste.resolvedores.map((r) => (
              <div key={r.nome} className="tipo-linha">
                <span>{r.nome}</span>
                <Barra pct={r.ms == null ? 100 : (r.ms / maximo) * 100} tom={r.ms == null ? "vermelho" : r.ms > 150 ? "ambar" : "verde"} alto={10} />
                <strong>{r.ms == null ? "sem resposta" : `${r.ms} ms`}</strong>
                <small>{r.falhas ? `${r.falhas} falha(s)` : "tempo médio de consulta"}</small>
              </div>
            ))}
          </div>
          <p className="muted">Latência até a internet: {teste.latenciaMs == null ? "sem resposta" : `${teste.latenciaMs} ms`}</p>
          <Aviso tom={v.tom}>{v.texto}</Aviso>
        </div>
      )}
      <ListaTarefas itens={itens} sel={sel} alternar={(id, val) => setSel((s) => { const n = new Set(s); val ? n.add(id) : n.delete(id); return n; })} />
      <div className="barra-acao">
        <div><strong>{sel.size} item(ns) selecionado(s)</strong><small>Trocar DNS é reversível em “Voltar o DNS ao automático”.</small></div>
        <button className="btn primario" disabled={!sel.size} onClick={() => executar([...sel], "Corrigir a internet")}><Icone nome="play" tam={16} /> Executar selecionados</button>
      </div>
    </div>
  );
}
