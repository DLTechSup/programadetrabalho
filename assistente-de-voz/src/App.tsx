import { Icone } from "./components/Icons";
import { useAssistente, type Pagina } from "./assistente";
import { PaginaAssistente } from "./pages/Assistente";
import { PaginaComandos } from "./pages/Comandos";
import { PaginaPastas } from "./pages/Pastas";
import { PaginaProgramas } from "./pages/Programas";
import { PaginaConfig } from "./pages/Config";

const MENU: { id: Pagina; nome: string; icone: string }[] = [
  { id: "assistente", nome: "Assistente", icone: "mic" },
  { id: "comandos", nome: "Comandos", icone: "list" },
  { id: "pastas", nome: "Pastas", icone: "folder" },
  { id: "programas", nome: "Programas", icone: "apps" },
  { id: "config", nome: "Configurações", icone: "gear" },
];

export function App() {
  const a = useAssistente();
  return (
    <div className="app">
      <aside className="barra-lateral">
        <div className="marca"><span className="marca-ico"><Icone nome="mic" tam={20} /></span><div><strong>Assistente de Voz</strong><small>{a.config.nomeAtivacao}</small></div></div>
        <nav>
          {MENU.map((m) => (
            <button key={m.id} className={a.pagina === m.id ? "ativo" : ""} onClick={() => a.ir(m.id)}><Icone nome={m.icone} /> {m.nome}</button>
          ))}
        </nav>
        <div className="mic-lateral">
          <button className={`btn-mic${a.escutando ? " on" : ""}`} onClick={a.escutando ? a.desligar : a.ligar} disabled={!a.escutando && !a.modelo.pronto && !a.api.demo} title={a.escutando ? "Clique para desligar o microfone" : "Clique para ligar o microfone"}>
            <Icone nome={a.escutando ? "mic" : "micoff"} tam={20} />
            <span><b>{a.escutando ? "Microfone ligado" : "Microfone desligado"}</b><small>{a.escutando ? "Ouvindo tudo o que você fala" : a.modelo.pronto || a.api.demo ? "Clique para ligar" : "Baixe o modelo de voz primeiro"}</small></span>
          </button>
        </div>
      </aside>
      <main>
        {a.pagina === "assistente" && <PaginaAssistente />}
        {a.pagina === "comandos" && <PaginaComandos />}
        {a.pagina === "pastas" && <PaginaPastas />}
        {a.pagina === "programas" && <PaginaProgramas />}
        {a.pagina === "config" && <PaginaConfig />}
      </main>
    </div>
  );
}
