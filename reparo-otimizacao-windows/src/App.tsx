import { useCallback, useEffect, useMemo, useState } from "react";
import type { Api, Diagnostico, InfoApp, ItemInicializacao, ItemLimpeza, ResultadoScan } from "./api/types";
import { Ctx, type Contexto, type EstadoAnalise, type Pagina } from "./state";
import { analisar as analisarProblemas } from "./lib/analise";
import { Icone } from "./components/Icons";
import { ExecModal } from "./components/ExecModal";
import { Visao } from "./pages/Visao";
import { Disco } from "./pages/Disco";
import { Otimizar } from "./pages/Otimizar";
import { Memoria } from "./pages/Memoria";
import { Inicio } from "./pages/Inicio";
import { Internet } from "./pages/Internet";

const MENU: { id: Pagina; nome: string; icone: string }[] = [
  { id: "visao", nome: "Visão geral", icone: "home" },
  { id: "disco", nome: "Espaço em disco", icone: "disk" },
  { id: "otimizar", nome: "Otimização e reparo", icone: "rocket" },
  { id: "memoria", nome: "Memória", icone: "memory" },
  { id: "inicio", nome: "Inicialização", icone: "startup" },
  { id: "internet", nome: "Internet", icone: "globe" },
];

export function App({ api }: { api: Api }) {
  const [info, setInfo] = useState<InfoApp>({ versao: "", plataforma: "", admin: true });
  const [pagina, setPagina] = useState<Pagina>("visao");
  const [sintoma, setSintoma] = useState<string | undefined>();
  const [diag, setDiag] = useState<Diagnostico | null>(null);
  const [limpeza, setLimpeza] = useState<ItemLimpeza[] | null>(null);
  const [inicio, setInicio] = useState<ItemInicializacao[] | null>(null);
  const [scan, setScan] = useState<ResultadoScan | null>(null);
  const [estadoAnalise, setEstadoAnalise] = useState<EstadoAnalise>("nunca");
  const [passoAnalise, setPassoAnalise] = useState("");
  const [erroAnalise, setErroAnalise] = useState("");
  const [exec, setExec] = useState<{ ids: string[]; titulo: string } | null>(null);

  useEffect(() => {
    api.info().then(setInfo);
  }, [api]);

  const atualizarLimpeza = useCallback(async () => setLimpeza(await api.escanearLimpeza()), [api]);

  const analisar = useCallback(async () => {
    setEstadoAnalise("rodando");
    setErroAnalise("");
    try {
      setPassoAnalise("Lendo configurações do Windows, disco e memória…");
      const d = await api.diagnosticar();
      setDiag(d);
      setPassoAnalise("Procurando arquivos descartáveis no disco…");
      const l = await api.escanearLimpeza();
      setLimpeza(l);
      setPassoAnalise("Verificando programas da inicialização…");
      const i = await api.listarInicializacao().catch(() => [] as ItemInicializacao[]);
      setInicio(i);
      setEstadoAnalise("pronto");
    } catch (e) {
      setErroAnalise(String((e as Error).message || e));
      setEstadoAnalise("erro");
    }
  }, [api]);

  const problemas = useMemo(() => (diag && limpeza ? analisarProblemas(diag, limpeza, inicio ?? []) : []), [diag, limpeza, inicio]);

  const ctx: Contexto = {
    api, info, diag, limpeza, inicio, problemas, estadoAnalise, passoAnalise, erroAnalise, analisar, atualizarLimpeza, scan, setScan,
    executar: (ids, titulo) => setExec({ ids, titulo }),
    ir: (p, s) => {
      setPagina(p);
      setSintoma(s);
    },
  };

  const fecharExec = (rodou: boolean) => {
    setExec(null);
    if (rodou && estadoAnalise === "pronto") analisar(); // confirma o resultado com uma nova leitura
    else if (rodou && limpeza) atualizarLimpeza();
  };

  return (
    <Ctx.Provider value={ctx}>
      <div className="app">
        <aside className="lateral">
          <div className="marca">
            <span className="marca-ico"><Icone nome="wrench" tam={20} /></span>
            <div>
              <strong>Reparo Windows</strong>
              <small>Limpeza · Otimização · Reparo</small>
            </div>
          </div>
          <nav>
            {MENU.map((m) => (
              <button key={m.id} className={pagina === m.id ? "ativo" : ""} onClick={() => ctx.ir(m.id)}>
                <Icone nome={m.icone} /> {m.nome}
              </button>
            ))}
          </nav>
          <div className="lateral-rodape">
            <span>DL Tech · v{info.versao || "1.0"}</span>
          </div>
        </aside>
        <main>
          {api.demo && <div className="faixa faixa-demo"><Icone nome="info" tam={16} /> Modo demonstração: os dados são fictícios. Abra o programa instalado em um Windows para analisar o computador de verdade.</div>}
          {!api.demo && !info.admin && <div className="faixa faixa-erro"><Icone nome="alert" tam={16} /> Não está como Administrador: várias limpezas e correções vão falhar. Feche e abra com “Executar como administrador”.</div>}
          {pagina === "visao" && <Visao />}
          {pagina === "disco" && <Disco />}
          {pagina === "otimizar" && <Otimizar sintomaInicial={sintoma} />}
          {pagina === "memoria" && <Memoria />}
          {pagina === "inicio" && <Inicio />}
          {pagina === "internet" && <Internet />}
        </main>
        {exec && <ExecModal ids={exec.ids} titulo={exec.titulo} aoFechar={fecharExec} />}
      </div>
    </Ctx.Provider>
  );
}
