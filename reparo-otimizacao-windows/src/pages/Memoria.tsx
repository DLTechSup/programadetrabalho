import { useCallback, useEffect, useState } from "react";
import type { Processos } from "../api/types";
import { Anel, Aviso, Barra, tomPorUso } from "../components/ui";
import { Icone } from "../components/Icons";
import { useApp } from "../state";
import { bytes, percentual } from "../lib/format";

export function Memoria() {
  const { api, executar } = useApp();
  const [dados, setDados] = useState<Processos | null>(null);
  const [erro, setErro] = useState("");
  const [confirmar, setConfirmar] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  const carregar = useCallback(async () => {
    try {
      setDados(await api.processos());
      setErro("");
    } catch (e) {
      setErro(String((e as Error).message || e));
    }
  }, [api]);

  useEffect(() => {
    carregar();
    const t = setInterval(carregar, 5000);
    return () => clearInterval(t);
  }, [carregar]);

  async function encerrar(nome: string, pids: number[]) {
    setConfirmar(null);
    try {
      const n = await api.encerrarProcesso(nome, pids);
      setMsg(`${nome}: ${n} processo(s) encerrado(s).`);
    } catch (e) {
      setMsg(String((e as Error).message || e));
    }
    carregar();
  }

  const uso = dados ? percentual(dados.total - dados.livre, dados.total) : 0;
  const maior = dados?.processos[0]?.mem ?? 1;

  return (
    <div className="pagina">
      <header className="pagina-topo">
        <div>
          <h1>Memória e processos</h1>
          <p className="muted">Veja quais programas estão consumindo a memória RAM agora (atualiza a cada 5 segundos).</p>
        </div>
        <button className="btn primario" onClick={() => executar(["liberar_memoria"], "Liberar memória RAM")}><Icone nome="memory" tam={16} /> Liberar memória agora</button>
      </header>
      {erro && <Aviso tom="erro">{erro}</Aviso>}
      {msg && <Aviso>{msg}</Aviso>}
      {dados && (
        <>
          <div className="cartao disco-resumo">
            <Anel valor={uso} rotulo={`${uso.toFixed(0)}%`} sub="em uso" tom={`var(--${tomPorUso(uso)})`} tam={110} />
            <div>
              <h3>{bytes(dados.total - dados.livre)} em uso de {bytes(dados.total, 0)}</h3>
              <p className="muted">
                {uso >= 85 ? "Memória quase no limite: o Windows começa a usar o disco como memória e tudo fica lento." : "Uso de memória dentro do normal."}
                {dados.total <= 4.2 * 1024 ** 3 && " Com 4 GB ou menos, só aumentar a memória resolve de verdade."}
              </p>
            </div>
          </div>
          <div className="cartao tabela">
            <table>
              <thead><tr><th>Programa</th><th className="num">Processos</th><th style={{ width: "34%" }}>Memória</th><th /></tr></thead>
              <tbody>
                {dados.processos.map((p) => (
                  <tr key={p.nome}>
                    <td><strong>{p.nome}</strong></td>
                    <td className="num">{p.qtd}</td>
                    <td><div className="mem-linha"><Barra pct={percentual(p.mem, maior)} alto={6} tom={p.mem / dados.total > 0.2 ? "vermelho" : "azul"} /><span>{bytes(p.mem)}</span></div></td>
                    <td className="direita">
                      {confirmar === p.nome ? (
                        <span className="confirmar">Encerrar? <button className="btn mini perigo" onClick={() => encerrar(p.nome, p.pids)}>Sim</button> <button className="btn mini" onClick={() => setConfirmar(null)}>Não</button></span>
                      ) : (
                        <button className="btn mini" onClick={() => setConfirmar(p.nome)}>Encerrar</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <small className="muted">Encerrar um programa pode fazer o cliente perder o que não foi salvo. Processos do sistema são protegidos.</small>
          </div>
        </>
      )}
      {!dados && !erro && <div className="analisando"><span className="spinner grande" /></div>}
    </div>
  );
}
