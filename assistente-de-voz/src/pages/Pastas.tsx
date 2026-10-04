import { useCallback, useEffect, useState } from "react";
import type { ResumoPastas } from "../api/types";
import { Icone } from "../components/Icons";
import { useAssistente } from "../assistente";

export function PaginaPastas() {
  const a = useAssistente();
  const [resumo, setResumo] = useState<ResumoPastas | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [filtro, setFiltro] = useState("");

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      setResumo(await a.api.resumoPastas());
    } finally {
      setCarregando(false);
    }
  }, [a.api]);
  useEffect(() => { if (a.config.pastaRaiz) carregar(); }, [a.config.pastaRaiz, a.config.ignorar, carregar]);

  async function escolher() {
    const p = await a.api.escolherPasta();
    if (p) await a.salvarConfig({ pastaRaiz: p });
  }
  async function reindexar() {
    setCarregando(true);
    await a.api.reindexar();
    await carregar();
  }
  const ignoradas = new Set(a.config.ignorar.map((x) => x.toLowerCase()));
  const alternar = (nome: string) => {
    const ign = ignoradas.has(nome.toLowerCase());
    a.salvarConfig({ ignorar: ign ? a.config.ignorar.filter((x) => x.toLowerCase() !== nome.toLowerCase()) : [...a.config.ignorar, nome] });
  };
  const marcas = (resumo?.marcas ?? []).filter((m) => m.nome.toLowerCase().includes(filtro.toLowerCase()));

  return (
    <div className="pagina">
      <header className="topo">
        <div><h1>Pastas das marcas</h1><p className="muted">Estrutura esperada: <b>Pasta raiz › Marca › Referência › arquivos</b>. Eu aprendo os nomes sozinho e entendo o que você falar.</p></div>
        <button className="btn primario" onClick={escolher}><Icone nome="folder" /> {a.config.pastaRaiz ? "Trocar a pasta raiz" : "Escolher a pasta raiz"}</button>
      </header>

      <div className="cartao">
        <div className="linha-info">
          <Icone nome="folder" />
          <div>
            <small>Pasta raiz</small>
            <strong className="caminho">{a.config.pastaRaiz || "— não escolhida —"}</strong>
          </div>
          {a.config.pastaRaiz && <button className="btn" onClick={reindexar} disabled={carregando}><Icone nome="refresh" tam={16} /> Reler as pastas</button>}
        </div>
        {resumo?.erro && <p className="erro">{resumo.erro}</p>}
        {resumo && !resumo.erro && <p className="muted"><b>{resumo.marcas.length}</b> marcas e <b>{resumo.total.toLocaleString("pt-BR")}</b> referências encontradas. Eu releio sozinho de tempos em tempos.</p>}
      </div>

      {resumo && !resumo.erro && (
        <div className="cartao">
          <header className="lista-topo"><h3>Marcas</h3><input className="busca" placeholder="Filtrar…" value={filtro} onChange={(e) => setFiltro(e.target.value)} /></header>
          <p className="muted">Pastas que não são marcas (ex.: “FOTOS variadas”) podem ser ignoradas — assim não atrapalham a busca por voz.</p>
          <div className="chips-marcas">
            {marcas.map((m) => {
              const ign = ignoradas.has(m.nome.toLowerCase());
              return (
                <button key={m.nome} className={`chip-marca${ign ? " ign" : ""}`} onClick={() => alternar(m.nome)} title={ign ? "Ignorada — clique para usar" : "Clique para ignorar"}>
                  <span>{m.nome}</span><small>{m.refs}</small>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
