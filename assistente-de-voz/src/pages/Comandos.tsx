import { Icone } from "../components/Icons";
import { useAssistente } from "../assistente";

export function PaginaComandos() {
  const a = useAssistente();
  return (
    <div className="pagina">
      <header className="topo"><div><h1>O que eu sei fazer</h1><p className="muted">Diga “{a.config.nomeAtivacao}” e depois o comando. Clique em um exemplo para testar agora.</p></div></header>
      <div className="grade">
        {a.info.exemplos.map((g) => (
          <section key={g.titulo} className="cartao">
            <h3>{g.titulo}</h3>
            <ul className="exemplos">
              {g.itens.map((i) => (
                <li key={i}>
                  <button onClick={async () => { await a.enviarTexto(i.replace(/\s*\(.*\)$/, "")); a.ir("assistente"); }}>
                    <Icone nome="play" tam={13} /> {i}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <p className="muted rodape-nota">Dica: depois de um comando eu continuo ouvindo por alguns segundos, então você pode encadear sem repetir o nome: “abre a marca Beira Rio”… “referência 8506 ponto 209”… “lista os arquivos”.</p>
    </div>
  );
}
