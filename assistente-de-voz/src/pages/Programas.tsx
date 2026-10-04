import { useEffect, useMemo, useState } from "react";
import type { Alias, ProgramaInstalado } from "../api/types";
import { Icone } from "../components/Icons";
import { useAssistente } from "../assistente";

export function PaginaProgramas() {
  const a = useAssistente();
  const [lista, setLista] = useState<ProgramaInstalado[] | null>(null);
  const [erro, setErro] = useState("");
  const [filtro, setFiltro] = useState("");
  const [falas, setFalas] = useState("");
  const [tipo, setTipo] = useState<Alias["tipo"]>("programa");
  const [destino, setDestino] = useState("");

  const carregar = async (forcar = false) => {
    const r = await a.api.listarProgramas(forcar);
    if (Array.isArray(r)) {
      setLista(r);
      setErro("");
    } else setErro(r.erro);
  };
  useEffect(() => { carregar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const vis = useMemo(() => (lista ?? []).filter((p) => p.nome.toLowerCase().includes(filtro.toLowerCase())).sort((x, y) => x.nome.localeCompare(y.nome, "pt-BR")), [lista, filtro]);

  async function adicionar() {
    const f = falas.split(",").map((x) => x.trim()).filter(Boolean);
    if (!f.length || !destino.trim()) return;
    await a.salvarConfig({ aliases: [...a.config.aliases, { falas: f, tipo, destino: destino.trim() }] });
    setFalas("");
    setDestino("");
  }
  async function escolherArquivo() {
    const p = await a.api.escolherArquivo();
    if (p) {
      setTipo("caminho");
      setDestino(p);
    }
  }

  return (
    <div className="pagina">
      <header className="topo"><div><h1>Programas e apelidos</h1><p className="muted">Eu abro qualquer programa instalado (menu Iniciar) e os atalhos da sua área de trabalho — é só falar o nome. Cadastre apelidos para o que quiser chamar de outro jeito.</p></div></header>

      <div className="cartao">
        <h3>Apelidos</h3>
        {a.config.aliases.length === 0 && <p className="muted">Nenhum ainda. Exemplo: apelido “zap web” → atalho do WhatsApp Web.</p>}
        <ul className="aliases">
          {a.config.aliases.map((al, i) => (
            <li key={i}>
              <div><b>{al.falas.join(", ")}</b><small className="caminho">{al.tipo === "programa" ? "programa: " : al.tipo === "url" ? "site: " : "arquivo/pasta: "}{al.destino}</small></div>
              <button className="btn-icone" title="Remover" onClick={() => a.salvarConfig({ aliases: a.config.aliases.filter((_, j) => j !== i) })}><Icone nome="trash" tam={16} /></button>
            </li>
          ))}
        </ul>
        <div className="form-alias">
          <input placeholder="Como você fala (separe por vírgula): zap web, whatsapp web" value={falas} onChange={(e) => setFalas(e.target.value)} />
          <select value={tipo} onChange={(e) => setTipo(e.target.value as Alias["tipo"])}>
            <option value="programa">Programa instalado</option>
            <option value="caminho">Arquivo, atalho ou pasta</option>
            <option value="url">Site (endereço)</option>
          </select>
          <input placeholder={tipo === "programa" ? "Nome do programa" : tipo === "url" ? "https://..." : "Caminho"} value={destino} onChange={(e) => setDestino(e.target.value)} />
          {tipo === "caminho" && <button className="btn" onClick={escolherArquivo}>Escolher…</button>}
          <button className="btn primario" onClick={adicionar} disabled={!falas.trim() || !destino.trim()}><Icone nome="plus" tam={16} /> Adicionar</button>
        </div>
      </div>

      <div className="cartao">
        <header className="lista-topo"><h3>Encontrados neste computador{lista ? ` (${lista.length})` : ""}</h3><div><input className="busca" placeholder="Filtrar…" value={filtro} onChange={(e) => setFiltro(e.target.value)} /> <button className="btn" onClick={() => carregar(true)}><Icone nome="refresh" tam={16} /></button></div></header>
        {erro && <p className="erro">{erro}</p>}
        {!lista && !erro && <p className="muted">Procurando…</p>}
        <ul className="programas">
          {vis.map((p) => <li key={p.nome + (p.id ?? p.caminho)}><span>{p.nome}</span><small>{p.tipo === "app" ? "menu Iniciar" : "área de trabalho"}</small></li>)}
        </ul>
      </div>
    </div>
  );
}
