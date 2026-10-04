import { useEffect, useState } from "react";
import { Icone } from "../components/Icons";
import { Chave } from "../components/Chave";
import { useAssistente } from "../assistente";
import { listarMicrofones } from "../audio/microfone";
import { falar, temVozPortugues } from "../audio/fala";

export function PaginaConfig() {
  const a = useAssistente();
  const [nome, setNome] = useState(a.config.nomeAtivacao);
  const [variantes, setVariantes] = useState(a.config.variantes.join(", "));
  const [mics, setMics] = useState<{ id: string; nome: string }[]>([]);
  useEffect(() => setNome(a.config.nomeAtivacao), [a.config.nomeAtivacao]);
  useEffect(() => { if (!a.api.demo) listarMicrofones().then(setMics); }, [a.api.demo]);
  const c = a.config;

  return (
    <div className="pagina estreita">
      <header className="topo"><div><h1>Configurações</h1></div></header>

      <section className="cartao">
        <h3>Nome do assistente</h3>
        <p className="muted">É a palavra que me chama. Você também pode trocar por voz: diga o nome atual e depois <i>“seu nome agora é …”</i>.</p>
        <div className="linha-form">
          <input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={30} />
          <button className="btn primario" disabled={!nome.trim() || nome.trim() === c.nomeAtivacao} onClick={() => a.salvarConfig({ nomeAtivacao: nome.trim() })}>Salvar</button>
        </div>
        <label className="rotulo">Outras formas que o reconhecedor costuma escrever (opcional)</label>
        <div className="linha-form">
          <input value={variantes} onChange={(e) => setVariantes(e.target.value)} placeholder="ex.: jarves, jarbis" />
          <button className="btn" onClick={() => a.salvarConfig({ variantes: variantes.split(",").map((x) => x.trim()).filter(Boolean) })}>Salvar</button>
        </div>
        <small>Se eu não responder, olhe na Conversa o que eu ouvi (“ouvi, mas não era para mim”) e coloque aqui como o nome foi escrito.</small>
      </section>

      <section className="cartao">
        <h3>Voz e microfone</h3>
        <label className="rotulo">Microfone</label>
        <select value={c.microfoneId} onChange={(e) => a.salvarConfig({ microfoneId: e.target.value })} disabled={a.api.demo}>
          <option value="">Padrão do Windows</option>
          {mics.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
        </select>
        <label className="rotulo">Sensibilidade: {c.sensibilidade} <small>(aumente se eu não te ouço; diminua se eu pego barulho)</small></label>
        <input type="range" min={1} max={10} value={c.sensibilidade} onChange={(e) => a.salvarConfig({ sensibilidade: Number(e.target.value) })} />
        <label className="rotulo">Qualidade do reconhecimento</label>
        <select value={c.modelo} onChange={(e) => a.salvarConfig({ modelo: e.target.value as typeof c.modelo })}>
          <option value="tiny">Rápido (tiny, ~40 MB) — menos preciso</option>
          <option value="base">Equilibrado (base, ~80 MB) — recomendado</option>
          <option value="small">Preciso (small, ~250 MB) — mais lento</option>
        </select>
        {!a.modelo.pronto && !a.api.demo && <p className="aviso-linha"><Icone nome="alert" tam={14} /> Esse modelo ainda não foi baixado. <button className="link" onClick={a.baixarModelo}>Baixar agora</button></p>}
        <div className="linha-chave"><div><b>Falar as respostas</b><small>Usa a voz do Windows{!temVozPortugues() && " (não achei voz em português instalada)"}.</small></div><Chave ligado={c.falarRespostas} onChange={(v) => a.salvarConfig({ falarRespostas: v })} /></div>
        <button className="btn" onClick={() => falar(`Olá! Me chame de ${c.nomeAtivacao} quando quiser algo.`)}>Testar a voz</button>
      </section>

      <section className="cartao">
        <h3>Conversa</h3>
        <label className="rotulo">Continuar ouvindo depois de um comando: {c.janelaConversaSeg}s <small>(para encadear pedidos sem repetir o nome)</small></label>
        <input type="range" min={0} max={30} value={c.janelaConversaSeg} onChange={(e) => a.salvarConfig({ janelaConversaSeg: Number(e.target.value) })} />
        <label className="rotulo">Esperar o comando depois de me chamar: {c.escutaAposAtivarSeg}s</label>
        <input type="range" min={3} max={30} value={c.escutaAposAtivarSeg} onChange={(e) => a.salvarConfig({ escutaAposAtivarSeg: Number(e.target.value) })} />
      </section>

      <section className="cartao">
        <h3>Programa</h3>
        <div className="linha-chave"><div><b>Iniciar junto com o Windows</b><small>Fica escutando na bandeja, sem abrir a janela.</small></div><Chave ligado={c.iniciarComWindows} onChange={(v) => a.salvarConfig({ iniciarComWindows: v })} /></div>
        <div className="linha-chave"><div><b>Fechar a janela deixa o assistente na bandeja</b><small>Para sair de vez, use o ícone da bandeja → Sair.</small></div><Chave ligado={c.minimizarParaBandeja} onChange={(v) => a.salvarConfig({ minimizarParaBandeja: v })} /></div>
        <button className="btn" onClick={() => a.api.sair()}><Icone nome="power" tam={16} /> Encerrar o assistente</button>
      </section>
    </div>
  );
}
