import { useCallback, useEffect, useMemo, useState } from "react";
import type { ItemInicializacao } from "../api/types";
import { Aviso, Chave } from "../components/ui";
import { Icone } from "../components/Icons";
import { useApp } from "../state";

export function Inicio() {
  const { api } = useApp();
  const [itens, setItens] = useState<ItemInicializacao[] | null>(null);
  const [alt, setAlt] = useState<Record<string, boolean>>({});
  const [erro, setErro] = useState("");
  const [msg, setMsg] = useState("");
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    try {
      setItens(await api.listarInicializacao());
      setAlt({});
      setErro("");
    } catch (e) {
      setErro(String((e as Error).message || e));
    }
  }, [api]);
  useEffect(() => { carregar(); }, [carregar]);

  const estado = (i: ItemInicializacao) => alt[i.id] ?? i.ativo;
  const mudancas = useMemo(() => (itens ?? []).filter((i) => alt[i.id] !== undefined && alt[i.id] !== i.ativo), [itens, alt]);
  const sugeridosAtivos = (itens ?? []).filter((i) => estado(i) && i.sugerido);

  async function aplicar() {
    setSalvando(true);
    try {
      await api.aplicarInicializacao(mudancas.map((i) => ({ id: i.id, ativar: alt[i.id] })));
      setMsg(`${mudancas.length} alteração(ões) aplicada(s). Vale a partir da próxima vez que o Windows iniciar.`);
      await carregar();
    } catch (e) {
      setErro(String((e as Error).message || e));
    }
    setSalvando(false);
  }

  const ordenados = [...(itens ?? [])].sort((a, b) => Number(estado(b)) - Number(estado(a)) || Number(b.sugerido) - Number(a.sugerido));

  return (
    <div className="pagina com-barra">
      <header className="pagina-topo">
        <div>
          <h1>Programas na inicialização</h1>
          <p className="muted">Cada programa ligado aqui abre sozinho quando o Windows liga e deixa a partida mais lenta. Desligar não desinstala nada e dá para religar quando quiser.</p>
        </div>
        <button className="btn" onClick={() => setAlt(Object.fromEntries(sugeridosAtivos.map((i) => [i.id, false])))} disabled={!sugeridosAtivos.length}>Desligar os {sugeridosAtivos.length} sugeridos</button>
      </header>
      {erro && <Aviso tom="erro">{erro}</Aviso>}
      {msg && <Aviso>{msg}</Aviso>}
      {!itens && !erro && <div className="analisando"><span className="spinner grande" /></div>}
      {itens && (
        <ul className="inicio-lista">
          {ordenados.map((i) => (
            <li key={i.id} className={estado(i) ? "" : "desligado"}>
              <Chave ligado={estado(i)} onChange={(v) => setAlt((a) => ({ ...a, [i.id]: v }))} rotulo={i.nome} />
              <div className="inicio-texto">
                <div className="tarefa-titulo">
                  <strong>{i.nome}</strong>
                  {i.sugerido && <span className="selo risco-medio">sugerido desligar</span>}
                  {i.essencial && <span className="selo risco-baixo">essencial</span>}
                  <span className="selo neutro">{i.escopo}</span>
                </div>
                <small className="caminho" title={i.comando}>{i.comando}</small>
                {i.motivo && <small className="muted">{i.motivo}</small>}
              </div>
            </li>
          ))}
          {itens.length === 0 && <li className="desligado">Nenhum programa na inicialização.</li>}
        </ul>
      )}
      <div className="barra-acao">
        <div><strong>{mudancas.length} alteração(ões) pendente(s)</strong><small><Icone nome="info" tam={13} /> Não mexa em antivírus nem em drivers (marcados como essenciais).</small></div>
        <button className="btn primario" disabled={!mudancas.length || salvando} onClick={aplicar}><Icone nome="check" tam={16} /> Aplicar alterações</button>
      </div>
    </div>
  );
}
