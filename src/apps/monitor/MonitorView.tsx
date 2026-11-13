import { useEffect, useRef, useState } from "react";
import { IconeFerramentas, IconePasta, IconeWhats } from "../../components/Icons";
import { plataforma, type ConfigMonitor, type GrupoMonitor, type ItemListaMonitor, type LinhaLogMonitor } from "../../platform";

const PADRAO: ConfigMonitor = {
  pastaBase: "",
  grupos: [],
  esperaLegendaSeg: 120,
  pegarAntigas: false,
  todasDoGrupoB: true,
  tentarEscondidas: true,
  notificar: true,
  som: true,
};

const ROTULO_TIPO: Record<GrupoMonitor["tipo"], string> = {
  A: "Grupo A: foto + marca + referência (legenda)",
  B: "Grupo B: só foto da caixa (lê a etiqueta)",
  I: "Conversa individual: salvar o texto",
};

export function MonitorView() {
  const [cfg, setCfg] = useState<ConfigMonitor>(PADRAO);
  const [carregado, setCarregado] = useState(false);
  const [rodando, setRodando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [novoNome, setNovoNome] = useState("");
  const [novoTipo, setNovoTipo] = useState<GrupoMonitor["tipo"]>("A");
  const [log, setLog] = useState<LinhaLogMonitor[]>([]);
  const [grupoSelecionado, setGrupoSelecionado] = useState<string | null>(null);
  const [lista, setLista] = useState<ItemListaMonitor[]>([]);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      const [c, e] = await Promise.all([plataforma.monitorConfigCarregar?.(), plataforma.monitorEstado?.()]);
      if (c) setCfg(c);
      if (e) setRodando(e.rodando);
      const texto = await plataforma.monitorLogDeHoje?.();
      if (texto) setLog(texto.split("\n").filter(Boolean).map((l) => ({ tipo: "log", texto: l, quando: 0 })));
      setCarregado(true);
    })();
    const off1 = plataforma.aoMudarLogMonitor?.((l) => setLog((prev) => [...prev, l].slice(-300)));
    const off2 = plataforma.aoMudarEstadoMonitor?.((e) => setRodando(e.rodando));
    const off3 = plataforma.aoMudarListaMonitor?.(() => {
      if (grupoSelecionado) plataforma.monitorListaDoDia?.(grupoSelecionado).then(setLista);
    });
    return () => { off1?.(); off2?.(); off3?.(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [log]);

  useEffect(() => {
    if (cfg.grupos.length && !grupoSelecionado) setGrupoSelecionado(cfg.grupos[0].nome);
  }, [cfg.grupos, grupoSelecionado]);

  useEffect(() => {
    if (grupoSelecionado) plataforma.monitorListaDoDia?.(grupoSelecionado).then(setLista);
  }, [grupoSelecionado]);

  async function atualizar(novo: Partial<ConfigMonitor>) {
    const seguro = { ...cfg, ...novo };
    setCfg(seguro);
    await plataforma.monitorConfigSalvar?.(novo);
  }

  async function escolherPasta() {
    const p = await plataforma.monitorEscolherPasta?.();
    if (p) atualizar({ pastaBase: p });
  }

  function adicionarGrupo() {
    const nome = novoNome.trim();
    if (!nome || cfg.grupos.some((g) => g.nome.toLowerCase() === nome.toLowerCase())) return;
    atualizar({ grupos: [...cfg.grupos, { nome, tipo: novoTipo }] });
    setNovoNome("");
  }

  function removerGrupo(nome: string) {
    atualizar({ grupos: cfg.grupos.filter((g) => g.nome !== nome) });
  }

  async function iniciar() {
    setErro(null);
    const r = await plataforma.monitorIniciar?.();
    if (r && !r.ok) setErro(r.erro || "Não consegui iniciar o monitor.");
  }

  async function parar() {
    await plataforma.monitorParar?.();
  }

  if (!carregado) return <div className="shell-pagina" />;

  return (
    <div className="shell-pagina">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 style={{ margin: 0 }}>Monitor de Demandas</h1>
          <p style={{ color: "var(--muted)", margin: "4px 0 0" }}>
            Lê os grupos do WhatsApp Web e organiza fotos e pedidos em pastas, automaticamente.
          </p>
        </div>
        <button className={rodando ? "btn sec" : "btn"} onClick={rodando ? parar : iniciar}>
          <IconeWhats size={16} /> {rodando ? "Parar monitor" : "Iniciar monitor"}
        </button>
      </div>

      {erro && <div className="card" style={{ padding: 14, color: "var(--danger)" }}>⚠ {erro}</div>}
      {rodando && (
        <div className="card" style={{ padding: 14, color: "var(--success)" }}>
          ✔ Rodando. Se o WhatsApp pedir, escaneie o QR Code na janela que abriu.
        </div>
      )}

      <div className="card" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <label style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>Pasta onde salvar as demandas</label>
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <input
              readOnly
              value={cfg.pastaBase}
              style={{ flex: 1, padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)" }}
            />
            <button className="btn sec" onClick={escolherPasta}><IconePasta size={16} /> Escolher…</button>
          </div>
        </div>

        <div>
          <label style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>Grupos monitorados</label>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
            {cfg.grupos.map((g) => (
              <div key={g.nome} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 8, background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                <b style={{ flex: 1 }}>{g.nome}</b>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>{ROTULO_TIPO[g.tipo]}</span>
                <button className="btn sec sm" onClick={() => removerGrupo(g.nome)}>Remover</button>
              </div>
            ))}
            {!cfg.grupos.length && <span style={{ color: "var(--muted)", fontSize: 13 }}>Nenhum grupo adicionado ainda.</span>}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <input
              value={novoNome}
              onChange={(e) => setNovoNome(e.target.value)}
              placeholder="nome do grupo no WhatsApp"
              style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)" }}
            />
            <select
              value={novoTipo}
              onChange={(e) => setNovoTipo(e.target.value as GrupoMonitor["tipo"])}
              style={{ padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)" }}
            >
              <option value="A">Grupo A (foto + legenda)</option>
              <option value="B">Grupo B (só a caixa)</option>
              <option value="I">Conversa individual</option>
            </select>
            <button className="btn" onClick={adicionarGrupo}>Adicionar</button>
          </div>
        </div>

        <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
          <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input type="checkbox" checked={cfg.pegarAntigas} onChange={(e) => atualizar({ pegarAntigas: e.target.checked })} />
            Ler também o que já chegou hoje antes de iniciar
          </label>
          <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input type="checkbox" checked={cfg.tentarEscondidas} onChange={(e) => atualizar({ tentarEscondidas: e.target.checked })} />
            Tentar baixar fotos escondidas do álbum (+N)
          </label>
          <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input type="checkbox" checked={cfg.todasDoGrupoB} onChange={(e) => atualizar({ todasDoGrupoB: e.target.checked })} />
            Grupo B: guardar cópia de cada foto em "_Todas as fotos"
          </label>
          <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input type="checkbox" checked={cfg.notificar} onChange={(e) => atualizar({ notificar: e.target.checked })} />
            Avisar na tela a cada item salvo
          </label>
          <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input type="checkbox" checked={cfg.som} onChange={(e) => atualizar({ som: e.target.checked })} />
            Som no aviso
          </label>
        </div>
      </div>

      {cfg.grupos.length > 0 && (
        <div className="card" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 10, flex: 1, minHeight: 0 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <b>Lista de hoje</b>
            <select
              value={grupoSelecionado ?? ""}
              onChange={(e) => setGrupoSelecionado(e.target.value)}
              style={{ padding: "6px 8px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)" }}
            >
              {cfg.grupos.map((g) => <option key={g.nome} value={g.nome}>{g.nome}</option>)}
            </select>
            {grupoSelecionado && (
              <button className="btn sec sm" onClick={() => plataforma.monitorAbrirPastaDoDia?.(grupoSelecionado)}>
                <IconePasta size={14} /> Abrir pasta
              </button>
            )}
          </div>
          <div style={{ overflow: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
            {lista.length === 0 && <span style={{ color: "var(--muted)", fontSize: 13 }}>Nada registrado ainda hoje.</span>}
            {lista.map((i) => (
              <label key={i.chave} style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 10px", borderRadius: 8, background: i.situacao === "conferir" ? "var(--warn-soft)" : "var(--surface-2)", border: "1px solid var(--border)" }}>
                <input type="checkbox" checked={i.feito} onChange={(e) => plataforma.monitorMarcarFeito?.(i.grupo, i.chave, e.target.checked)} />
                <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--muted)" }}>{i.hora}</span>
                <b style={{ flex: 1 }}>{i.marca} {i.referencia}</b>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>{i.fotos} foto(s)</span>
                {i.situacao === "conferir" && <span style={{ fontSize: 11, fontWeight: 700, color: "var(--warn)" }}>CONFERIR</span>}
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="card" style={{ padding: 14 }}>
        <b style={{ fontSize: 13 }}>Registro de hoje</b>
        <div ref={logRef} style={{ marginTop: 8, maxHeight: 180, overflow: "auto", fontFamily: "var(--mono)", fontSize: 12, color: "var(--muted)", display: "flex", flexDirection: "column", gap: 2 }}>
          {log.length === 0 && (
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}><IconeFerramentas size={14} /> Nada ainda hoje.</span>
          )}
          {log.map((l, i) => <div key={i}>{l.texto}</div>)}
        </div>
      </div>
    </div>
  );
}
