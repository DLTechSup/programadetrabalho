import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Api, Config, EstadoAtual, InfoApp, ProgressoModelo, RespostaVoz } from "./api/types";
import { Segmentador } from "./audio/vad";
import { estatisticas, prepararAudio, type EstatisticasAudio } from "./audio/preparar";
import { abrirMicrofone, type Microfone } from "./audio/microfone";
import { Transcritor, type EstadoStt } from "./audio/stt";
import { bip, falar, iniciarFala, pararDeFalar, tocarAudio } from "./audio/fala";

export type Fase = "desligado" | "carregando" | "dormindo" | "ouvindo" | "escolhendo" | "nome" | "processando" | "falando";
export interface EntradaLog { id: number; tipo: "ouvi" | "resposta" | "ignorado" | "sistema"; texto: string; hora: number; ok?: boolean }
export interface Captura { id: number; hora: number; audio: Float32Array; stats: EstatisticasAudio; texto: string; erro?: string }
export type Pagina = "assistente" | "comandos" | "pastas" | "programas" | "config";

export interface Assistente {
  api: Api;
  info: InfoApp;
  config: Config;
  cerebro: EstadoAtual;
  fase: Fase;
  nivel: number;
  falandoNivel: boolean;
  log: EntradaLog[];
  escutando: boolean;
  erroMic: string;
  stt: { estado: EstadoStt; msg: string };
  modelo: { pronto: boolean; baixando: boolean; progresso: number; erro: string };
  ultimoOuvido: string;
  ultimaResposta: string;
  capturas: Captura[];
  tocarCaptura(id: number): void;
  ligar(): Promise<void>;
  desligar(): void;
  enviarTexto(t: string): Promise<RespostaVoz>;
  salvarConfig(p: Partial<Config>): Promise<void>;
  baixarModelo(): Promise<void>;
  cancelarModelo(): void;
  limparLog(): void;
  ir(p: Pagina): void;
  pagina: Pagina;
}

const Ctx = createContext<Assistente | null>(null);
export const useAssistente = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("Contexto ausente");
  return c;
};

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));
let seqLog = 0;

export function ProvedorAssistente({ api, info, configInicial, children }: { api: Api; info: InfoApp; configInicial: Config; children: ReactNode }) {
  const [config, setConfig] = useState(configInicial);
  const [cerebro, setCerebro] = useState<EstadoAtual>({ estado: "dormindo", restanteMs: 0, nome: configInicial.nomeAtivacao, contexto: { marca: null, ref: null, pasta: null } });
  const [log, setLog] = useState<EntradaLog[]>([]);
  const [escutando, setEscutando] = useState(false);
  const [erroMic, setErroMic] = useState("");
  const [nivel, setNivel] = useState(0);
  const [falandoNivel, setFalandoNivel] = useState(false);
  const [processando, setProcessando] = useState(false);
  const [falando, setFalando] = useState(false);
  const [stt, setStt] = useState<{ estado: EstadoStt; msg: string }>({ estado: "parado", msg: "" });
  const [modelo, setModelo] = useState({ pronto: false, baixando: false, progresso: 0, erro: "" });
  const [pagina, setPagina] = useState<Pagina>("assistente");
  const [ultimoOuvido, setUltimoOuvido] = useState("");
  const [ultimaResposta, setUltimaResposta] = useState("");
  const [capturas, setCapturas] = useState<Captura[]>([]);

  const cfgRef = useRef(config);
  cfgRef.current = config;
  const mic = useRef<Microfone | null>(null);
  const seg = useRef<Segmentador | null>(null);
  const transc = useRef<Transcritor | null>(null);
  const fila = useRef<Promise<void>>(Promise.resolve());
  const naFila = useRef(0);
  const escutaDesejada = useRef(localStorage.getItem("escutaLigada") !== "nao");

  const add = useCallback((tipo: EntradaLog["tipo"], texto: string, ok?: boolean) => {
    setLog((l) => [...l.slice(-79), { id: ++seqLog, tipo, texto, hora: Date.now(), ok }]);
  }, []);

  const falarResposta = useCallback(async (texto: string) => {
    if (!texto || !cfgRef.current.falarRespostas) return;
    seg.current?.pausar(true);
    setFalando(true);
    await falar(texto);
    setFalando(false);
    await espera(350);
    seg.current?.pausar(false);
  }, []);

  const desligar = useCallback(() => {
    mic.current?.parar();
    mic.current = null;
    seg.current = null;
    setEscutando(false);
    setNivel(0);
    setFalandoNivel(false);
  }, []);

  const processar = useCallback(
    async (texto: string, origem: "voz" | "texto"): Promise<RespostaVoz> => {
      const r = await api.ouvir(texto, origem);
      setCerebro((c) => ({ ...c, estado: r.estado, nome: r.nome, restanteMs: r.estado === "dormindo" ? 0 : Math.max(0, r.expiraEm - Date.now()) }));
      if (r.ignorado) {
        if (origem === "voz") add("ignorado", texto);
        return r;
      }
      setUltimoOuvido(r.entendido ?? texto);
      add("ouvi", r.entendido ?? texto);
      if (r.fala) {
        add("resposta", r.fala, r.ok);
        setUltimaResposta(r.fala);
      }
      if (r.ativado) bip("ativar");
      if (r.renomeado) setConfig(await api.obterConfig());
      if (r.pausarEscuta) {
        localStorage.setItem("escutaLigada", "nao");
        escutaDesejada.current = false;
        desligar();
      }
      await falarResposta(r.fala);
      return r;
    },
    [api, add, desligar, falarResposta],
  );

  const aoFala = useCallback(
    (audio: Float32Array) => {
      if (naFila.current >= 2) return; // fila cheia: descarta (o computador está ocupado)
      naFila.current++;
      fila.current = fila.current.then(async () => {
        setProcessando(true);
        const id = ++seqLog;
        const stats = estatisticas(audio);
        let texto = "";
        try {
          const prep = prepararAudio(audio);
          stats.ganho = prep.ganho;
          texto = await transc.current!.transcrever(prep.audio);
          if (texto) await processar(texto, "voz");
        } catch (e) {
          add("sistema", `Erro ao reconhecer a voz: ${(e as Error).message}`, false);
        } finally {
          setCapturas((c) => [...c.slice(-5), { id, hora: Date.now(), audio, stats, texto }]);
          naFila.current--;
          setProcessando(false);
        }
      });
    },
    [processar, add],
  );

  const ligar = useCallback(async () => {
    if (mic.current) return;
    if (api.demo) {
      setErroMic("Modo demonstração: sem microfone. Digite os comandos na caixa abaixo.");
      return;
    }
    setErroMic("");
    try {
      if (!transc.current) transc.current = new Transcritor((estado, msg) => setStt({ estado, msg }));
      if (transc.current.estado !== "pronto") await transc.current.carregar(cfgRef.current.modelo);
      mic.current = await abrirMicrofone((f) => seg.current?.processar(f), cfgRef.current.microfoneId, cfgRef.current.filtrosDoNavegador);
      seg.current = new Segmentador({ sampleRate: 16000, sensibilidade: cfgRef.current.sensibilidade }, aoFala, (n, f) => {
        setNivel(n);
        setFalandoNivel(f);
      });
      localStorage.setItem("escutaLigada", "sim");
      escutaDesejada.current = true;
      setEscutando(true);
    } catch (e) {
      const msg = String((e as Error).message || e);
      setErroMic(/denied|permission|NotAllowed/i.test(msg) ? "Sem permissão para usar o microfone. Libere em Configurações do Windows > Privacidade > Microfone." : msg);
      desligar();
    }
  }, [api.demo, aoFala, desligar]);

  const atualizarModelo = useCallback(async () => {
    const s = await api.statusModelo();
    setModelo((m) => ({ ...m, pronto: s.pronto, baixando: s.baixando }));
    return s;
  }, [api]);

  const baixarModelo = useCallback(async () => {
    setModelo((m) => ({ ...m, baixando: true, erro: "", progresso: 0 }));
    const parar = api.aoProgressoModelo((p: ProgressoModelo) => setModelo((m) => ({ ...m, progresso: p.total ? p.baixado / p.total : 0 })));
    const r = await api.baixarModelo();
    parar();
    setModelo((m) => ({ ...m, baixando: false, erro: r.ok ? "" : r.erro || "Falha no download." }));
    const s = await atualizarModelo();
    if (r.ok && s.pronto && escutaDesejada.current) await ligar();
  }, [api, atualizarModelo, ligar]);

  const salvarConfig = useCallback(
    async (p: Partial<Config>) => {
      const antes = cfgRef.current;
      const nova = await api.salvarConfig(p);
      setConfig(nova);
      if (nova.modelo !== antes.modelo) {
        transc.current?.descartar();
        desligar();
        const s = await atualizarModelo();
        if (s.pronto && escutaDesejada.current) await ligar();
      } else if ((nova.sensibilidade !== antes.sensibilidade || nova.microfoneId !== antes.microfoneId || nova.filtrosDoNavegador !== antes.filtrosDoNavegador) && mic.current) {
        desligar();
        await ligar();
      }
    },
    [api, atualizarModelo, desligar, ligar],
  );

  // inicialização: voz do Windows, status do modelo, escuta automática
  useEffect(() => {
    iniciarFala();
    (async () => {
      const s = await atualizarModelo();
      if (s.pronto && escutaDesejada.current) await ligar();
    })();
    const off = api.aoAlternarEscuta(() => (mic.current ? (localStorage.setItem("escutaLigada", "nao"), (escutaDesejada.current = false), desligar()) : ligar()));
    return () => {
      off();
      desligar();
      transc.current?.descartar();
      pararDeFalar();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // atualiza o estado do cérebro (contagem regressiva da escuta) a cada segundo
  useEffect(() => {
    const t = setInterval(() => api.estado().then(setCerebro).catch(() => {}), 1000);
    return () => clearInterval(t);
  }, [api]);

  const fase: Fase = falando ? "falando" : processando ? "processando" : !escutando && !api.demo ? (stt.estado === "carregando" ? "carregando" : "desligado") : cerebro.estado === "dormindo" ? "dormindo" : cerebro.estado;

  const valor = useMemo<Assistente>(
    () => ({
      api, info, config, cerebro, fase, nivel, falandoNivel, log, escutando, erroMic, stt, modelo, ultimoOuvido, ultimaResposta, pagina, capturas,
      tocarCaptura: (id) => { const c = capturas.find((x) => x.id === id); if (c) tocarAudio(c.audio); },
      ligar, desligar: () => { localStorage.setItem("escutaLigada", "nao"); escutaDesejada.current = false; desligar(); },
      enviarTexto: (t) => processar(t, "texto"),
      salvarConfig, baixarModelo, cancelarModelo: () => void api.cancelarModelo(),
      limparLog: () => setLog([]), ir: setPagina,
    }),
    [api, info, config, cerebro, fase, nivel, falandoNivel, log, escutando, erroMic, stt, modelo, ultimoOuvido, ultimaResposta, pagina, capturas, ligar, desligar, processar, salvarConfig, baixarModelo],
  );
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}
