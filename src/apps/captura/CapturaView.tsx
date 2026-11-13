import { useEffect, useState } from "react";
import { IconeCaptura, IconePasta } from "../../components/Icons";
import { plataforma, type ConfigCaptura } from "../../platform";

const PADRAO: ConfigCaptura = {
  pastaDestino: "",
  copiarParaAreaTransferencia: true,
  som: true,
  abrirPastaNoAviso: true,
  ativo: true,
  prefixoArquivo: "Captura",
};

export function CapturaView() {
  const [cfg, setCfg] = useState<ConfigCaptura>(PADRAO);
  const [carregado, setCarregado] = useState(false);

  useEffect(() => {
    (async () => {
      const r = await plataforma.capturaConfigCarregar?.();
      if (r) setCfg(r);
      setCarregado(true);
    })();
  }, []);

  async function atualizar(novo: Partial<ConfigCaptura>) {
    const seguro = { ...cfg, ...novo };
    setCfg(seguro);
    await plataforma.capturaConfigSalvar?.(novo);
  }

  async function escolherPasta() {
    const p = await plataforma.capturaEscolherPasta?.();
    if (p) atualizar({ pastaDestino: p });
  }

  if (!carregado) return <div className="shell-pagina" />;

  return (
    <div className="shell-pagina">
      <div>
        <h1 style={{ margin: 0 }}>Captura de Tela</h1>
        <p style={{ color: "var(--muted)", margin: "4px 0 0" }}>
          Toque os dois botões do mouse ao mesmo tempo para <b>armar</b>; depois clique com o esquerdo e
          arraste para selecionar a área. Clique direito ou <b>Esc</b> cancela.
        </p>
      </div>

      <div className="card" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
        <label style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 600 }}>
          <input type="checkbox" checked={cfg.ativo} onChange={(e) => atualizar({ ativo: e.target.checked })} />
          <IconeCaptura size={16} /> Captura por atalho de mouse ativada
        </label>

        <div>
          <label style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>Pasta onde salvar</label>
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <input
              readOnly
              value={cfg.pastaDestino}
              style={{ flex: 1, padding: "10px 12px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)" }}
            />
            <button className="btn sec" onClick={escolherPasta}>
              <IconePasta size={16} /> Escolher…
            </button>
          </div>
        </div>

        <div>
          <label style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>Prefixo do nome do arquivo</label>
          <input
            value={cfg.prefixoArquivo}
            onChange={(e) => atualizar({ prefixoArquivo: e.target.value })}
            placeholder="Captura"
            style={{ display: "block", width: 260, marginTop: 4, padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)" }}
          />
        </div>

        <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
          <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input type="checkbox" checked={cfg.copiarParaAreaTransferencia} onChange={(e) => atualizar({ copiarParaAreaTransferencia: e.target.checked })} />
            Copiar para a área de transferência
          </label>
          <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input type="checkbox" checked={cfg.som} onChange={(e) => atualizar({ som: e.target.checked })} />
            Som ao capturar
          </label>
          <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input type="checkbox" checked={cfg.abrirPastaNoAviso} onChange={(e) => atualizar({ abrirPastaNoAviso: e.target.checked })} />
            Abrir a pasta depois de salvar
          </label>
        </div>

        {cfg.pastaDestino && (
          <button className="btn sec" style={{ alignSelf: "flex-start" }} onClick={() => plataforma.capturaAbrirPasta?.(cfg.pastaDestino)}>
            <IconePasta size={16} /> Abrir pasta das capturas
          </button>
        )}
      </div>
    </div>
  );
}
