import { useEffect, useMemo, useRef, useState } from "react";
import type { EventoTarefa } from "../api/types";
import { Caixa, SeloRisco } from "./ui";
import { Icone } from "./Icons";
import { item, tituloDe } from "../lib/catalogo";
import { bytes } from "../lib/format";
import { montarRelatorio } from "../lib/relatorio";
import { useApp } from "../state";

type Fase = "plano" | "rodando" | "fim";

/** Assistente: mostra o que será feito, executa mostrando o progresso e resume o resultado. */
export function ExecModal({ ids: idsIniciais, titulo, aoFechar }: { ids: string[]; titulo: string; aoFechar: (rodou: boolean) => void }) {
  const { api, info, diag } = useApp();
  const [fase, setFase] = useState<Fase>("plano");
  const [marcados, setMarcados] = useState(() => new Set(idsIniciais));
  const [restauracao, setRestauracao] = useState(true);
  const [estados, setEstados] = useState<Record<string, EventoTarefa>>({});
  const [resultados, setResultados] = useState<EventoTarefa[]>([]);
  const [erro, setErro] = useState("");
  const [reinicioAgendado, setReinicioAgendado] = useState(false);
  const rodouRef = useRef(false);

  const selecionados = useMemo(() => idsIniciais.filter((i) => marcados.has(i)), [idsIniciais, marcados]);
  const temArriscado = selecionados.some((i) => item(i)?.risco === "alto");
  const temLonga = selecionados.some((i) => item(i)?.duracao === "longa");
  const temAjuste = selecionados.some((i) => item(i) && !item(i)!.limpeza);

  useEffect(() => {
    const parar = api.aoProgressoExecucao((e) => setEstados((s) => ({ ...s, [e.id]: e })));
    return parar;
  }, [api]);

  async function iniciar() {
    setFase("rodando");
    rodouRef.current = true;
    setErro("");
    try {
      const r = await api.executar(selecionados, { pontoRestauracao: restauracao && temAjuste });
      setResultados(r);
    } catch (e) {
      setErro(String((e as Error).message || e));
    }
    setFase("fim");
  }

  const liberado = resultados.reduce((s, r) => s + (r.liberado ?? 0), 0);
  const falhas = resultados.filter((r) => r.estado === "erro").length;
  const precisaReiniciar = resultados.some((r) => r.reiniciar);
  const ordem = estados["ponto_restauracao"] ? ["ponto_restauracao", ...selecionados] : selecionados;
  const feitos = ordem.filter((i) => ["ok", "aviso", "erro", "ignorado"].includes(estados[i]?.estado)).length;

  return (
    <div className="modal-fundo" role="dialog" aria-modal="true">
      <div className="modal">
        <header className="modal-topo">
          <h2>{titulo}</h2>
          {fase !== "rodando" && (
            <button className="btn-icone" onClick={() => aoFechar(rodouRef.current)} aria-label="Fechar">
              <Icone nome="x" />
            </button>
          )}
        </header>

        {fase === "plano" && (
          <>
            <div className="modal-corpo">
              <p className="muted">Confira o que será feito. Desmarque o que não quiser.</p>
              <ul className="plano">
                {idsIniciais.map((id) => {
                  const it = item(id);
                  return (
                    <li key={id}>
                      <Caixa marcado={marcados.has(id)} onChange={(v) => setMarcados((s) => { const n = new Set(s); v ? n.add(id) : n.delete(id); return n; })} rotulo={tituloDe(id)} />
                      <div className="plano-texto">
                        <strong>{tituloDe(id)}</strong>
                        {it?.aviso && <small className="aviso-linha">⚠ {it.aviso}</small>}
                      </div>
                      {it && <SeloRisco risco={it.risco} />}
                      {it?.duracao === "longa" && <span className="selo neutro">demora</span>}
                    </li>
                  );
                })}
              </ul>
              {!info.admin && info.plataforma !== "demo" && (
                <div className="aviso aviso-erro"><Icone nome="alert" /><div>O programa não está como Administrador. Feche e abra com “Executar como administrador”, senão várias correções vão falhar.</div></div>
              )}
              {temArriscado && <div className="aviso aviso-atencao"><Icone nome="alert" /><div>Há itens marcados como <b>Cuidado</b>: não dá para desfazer. Confirme com o cliente antes.</div></div>}
              {temLonga && <div className="aviso aviso-info"><Icone nome="info" /><div>Algumas etapas são demoradas (de alguns minutos a mais de uma hora). Não desligue o computador durante a execução.</div></div>}
              {temAjuste && (
                <label className="linha-check">
                  <Caixa marcado={restauracao} onChange={setRestauracao} rotulo="Criar ponto de restauração" />
                  <span>Criar um <b>ponto de restauração</b> antes (recomendado — permite desfazer os ajustes)</span>
                </label>
              )}
              {diag && diag.discoLivre < 2 * 1024 ** 3 && temAjuste && <p className="muted">Com pouco espaço livre, o ponto de restauração pode falhar; a execução continua mesmo assim.</p>}
            </div>
            <footer className="modal-rodape">
              <button className="btn" onClick={() => aoFechar(false)}>Cancelar</button>
              <button className="btn primario" disabled={!selecionados.length} onClick={iniciar}>
                <Icone nome="play" tam={16} /> Executar {selecionados.length} {selecionados.length === 1 ? "item" : "itens"}
              </button>
            </footer>
          </>
        )}

        {(fase === "rodando" || fase === "fim") && (
          <>
            <div className="modal-corpo">
              {fase === "rodando" && (
                <div className="progresso-topo">
                  <div className="barra" style={{ height: 8 }}><div className="barra-fill azul" style={{ width: `${(feitos / Math.max(1, ordem.length)) * 100}%` }} /></div>
                  <small>{feitos} de {ordem.length} concluídos — não feche o programa.</small>
                </div>
              )}
              {fase === "fim" && (
                <div className={`resumo ${falhas ? "com-falha" : "sucesso"}`}>
                  <Icone nome={falhas ? "alert" : "check"} tam={26} />
                  <div>
                    <strong>{falhas ? `Concluído com ${falhas} falha(s)` : "Tudo certo!"}</strong>
                    <span>{liberado > 0 ? `${bytes(liberado)} de espaço liberado. ` : ""}{precisaReiniciar ? "Reinicie o computador para concluir." : ""}</span>
                  </div>
                </div>
              )}
              {erro && <div className="aviso aviso-erro"><Icone nome="alert" /><div>{erro}</div></div>}
              <ul className="execucao">
                {ordem.map((id) => {
                  const e = estados[id];
                  const st = e?.estado ?? "pendente";
                  return (
                    <li key={id} className={`st-${st}`}>
                      <span className="st-icone">{st === "rodando" ? <span className="spinner" /> : st === "ok" ? <Icone nome="check" tam={16} /> : st === "erro" ? <Icone nome="x" tam={16} /> : st === "aviso" ? <Icone nome="alert" tam={16} /> : <span className="ponto" />}</span>
                      <div>
                        <strong>{tituloDe(id)}</strong>
                        {e?.mensagem && <small>{e.mensagem}</small>}
                      </div>
                      {e?.liberado ? <span className="selo sev-info">{bytes(e.liberado)}</span> : null}
                    </li>
                  );
                })}
              </ul>
              {reinicioAgendado && <div className="aviso aviso-atencao"><Icone nome="alert" /><div>O Windows vai reiniciar em 30 segundos. Salve seus arquivos.</div></div>}
            </div>
            <footer className="modal-rodape">
              {fase === "rodando" ? (
                <button className="btn" onClick={() => api.cancelarExecucao()}>Cancelar as etapas restantes</button>
              ) : (
                <>
                  <button className="btn" onClick={() => api.salvarRelatorio(montarRelatorio(resultados, diag))}><Icone nome="save" tam={16} /> Salvar relatório</button>
                  {precisaReiniciar && !reinicioAgendado && <button className="btn" onClick={() => { api.reiniciarWindows(); setReinicioAgendado(true); }}><Icone nome="power" tam={16} /> Reiniciar agora</button>}
                  {reinicioAgendado && <button className="btn" onClick={() => { api.cancelarReinicio(); setReinicioAgendado(false); }}>Cancelar reinício</button>}
                  <button className="btn primario" onClick={() => aoFechar(true)}>Concluir</button>
                </>
              )}
            </footer>
          </>
        )}
      </div>
    </div>
  );
}
