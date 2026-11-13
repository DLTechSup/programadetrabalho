import { useEffect, useState } from "react";
import App from "./App";
import { CapturaView } from "./apps/captura/CapturaView";
import { CodigosFotosView } from "./apps/codigos/CodigosFotosView";
import { MonitorView } from "./apps/monitor/MonitorView";
import NoteDeckManager from "./apps/notedeck/Manager.jsx";
import { RenomeadorView } from "./apps/renomeador/RenomeadorView";
import {
  IconeCaptura, IconeCodigo, IconeLogo, IconeNota, IconePlanilha, IconeRenomear, IconeWhats,
} from "./components/Icons";
import { plataforma, type ArquivoParaRenomear } from "./platform";

export type Ferramenta = "gradefacil" | "renomeador" | "captura" | "monitor" | "notedeck" | "codigos";

interface ItemMenu {
  id: Ferramenta;
  nome: string;
  Icone: typeof IconePlanilha;
  pronto: boolean;
}

const ITENS: ItemMenu[] = [
  { id: "gradefacil", nome: "GradeFácil", Icone: IconePlanilha, pronto: true },
  { id: "renomeador", nome: "Renomear em Massa", Icone: IconeRenomear, pronto: true },
  { id: "captura", nome: "Captura de Tela", Icone: IconeCaptura, pronto: true },
  { id: "monitor", nome: "Monitor de Demandas", Icone: IconeWhats, pronto: true },
  { id: "notedeck", nome: "NoteDeck", Icone: IconeNota, pronto: true },
  { id: "codigos", nome: "Códigos das Fotos", Icone: IconeCodigo, pronto: true },
];

export default function Shell() {
  const [ferramenta, setFerramenta] = useState<Ferramenta>("gradefacil");
  const [arquivosParaRenomear, setArquivosParaRenomear] = useState<ArquivoParaRenomear[] | null>(null);

  // o atalho global (Ctrl+Alt+R) traz a janela pra frente, abre a aba certa e ja traz
  // os arquivos que estavam selecionados no Explorador, se houver
  useEffect(() => {
    return plataforma.aoAbrirFerramenta?.((id, arquivos) => {
      setFerramenta(id as Ferramenta);
      if (id === "renomeador" && arquivos && arquivos.length > 0) setArquivosParaRenomear(arquivos);
    });
  }, []);

  return (
    <div className="shell">
      <nav className="shell-sidebar">
        <div className="shell-marca">
          <IconeLogo size={22} />
          <span>Central DLTechSup</span>
        </div>
        <div className="shell-itens">
          {ITENS.map(({ id, nome, Icone, pronto }) => (
            <button
              key={id}
              className={`shell-item ${ferramenta === id ? "ativo" : ""} ${pronto ? "" : "em-breve"}`}
              onClick={() => setFerramenta(id)}
              title={pronto ? nome : `${nome} (em breve)`}
            >
              <Icone size={18} />
              <span>{nome}</span>
              {!pronto && <em>em breve</em>}
            </button>
          ))}
        </div>
      </nav>
      <div className="shell-conteudo" style={{ display: ferramenta === "gradefacil" ? "block" : "none" }}>
        <App />
      </div>
      {ferramenta === "renomeador" && (
        <RenomeadorView arquivosIniciais={arquivosParaRenomear} onArquivosIniciaisConsumidos={() => setArquivosParaRenomear(null)} />
      )}
      {ferramenta === "captura" && <CapturaView />}
      {ferramenta === "monitor" && <MonitorView />}
      {ferramenta === "notedeck" && (
        <div className="shell-pagina" style={{ padding: 0 }}>
          <NoteDeckManager />
        </div>
      )}
      {ferramenta === "codigos" && (
        <div className="shell-pagina" style={{ padding: 0 }}>
          <CodigosFotosView />
        </div>
      )}
    </div>
  );
}
