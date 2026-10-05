import { useEffect, useRef, useState } from "react";
import { Icone } from "../components/Icons";
import { Orbe } from "../components/Orbe";
import { useAssistente } from "../assistente";

export function PaginaAssistente() {
  const a = useAssistente();
  const [texto, setTexto] = useState("");
  const fim = useRef<HTMLDivElement>(null);
  useEffect(() => fim.current?.scrollIntoView({ block: "end" }), [a.log.length]);

  async function enviar() {
    const t = texto.trim();
    if (!t) return;
    setTexto("");
    await a.enviarTexto(t);
  }
  const semRaiz = !a.config.pastaRaiz;
  const segundos = Math.ceil(a.cerebro.restanteMs / 1000);

  return (
    <div className="pagina assistente">
      <section className="palco">
        <Orbe fase={a.fase} nivel={a.nivel} falando={a.falandoNivel} />
        <h1>{a.fase === "dormindo" || a.fase === "desligado" ? <>Diga <b>“{a.config.nomeAtivacao}”</b></> : a.fase === "ouvindo" ? <>Pode falar{segundos > 0 ? <small> · {segundos}s</small> : null}</> : a.fase === "escolhendo" ? "Diga o número da opção" : a.fase === "nome" ? "Diga o novo nome" : " "}</h1>
        <p className="dica">
          {a.fase === "dormindo" && "Exemplo: “" + a.config.nomeAtivacao + ", abre a marca Beira Rio”"}
          {a.fase === "ouvindo" && "Estou ouvindo o seu comando"}
          {a.fase === "desligado" && "Ligue a escuta para falar com o assistente"}
        </p>
        <div className="palco-acoes">
          {a.escutando ? (
            <button className="btn" onClick={a.desligar}><Icone nome="micoff" /> Desligar a escuta</button>
          ) : (
            <button className="btn primario" onClick={a.ligar} disabled={!a.modelo.pronto && !a.api.demo}><Icone nome="mic" /> Ligar a escuta</button>
          )}
          {a.cerebro.estado !== "dormindo" && <button className="btn" onClick={() => a.api.dormir()}>Pode dormir</button>}
        </div>
        {a.cerebro.contexto.marca && (
          <div className="contexto">
            <Icone nome="folder" tam={15} /> {a.cerebro.contexto.marca}
            {a.cerebro.contexto.ref ? <> › <b>{a.cerebro.contexto.ref}</b></> : null}
          </div>
        )}
      </section>

      <section className="lateral-direita">
        {!a.api.demo && !a.modelo.pronto && (
          <div className="cartao destaque">
            <h3>Falta baixar o modelo de voz</h3>
            <p className="muted">É um download único (cerca de {a.config.modelo === "tiny" ? "40" : a.config.modelo === "small" ? "250" : "80"} MB). Depois, o reconhecimento de voz funciona sem internet.</p>
            {a.modelo.baixando ? (
              <>
                <div className="barra"><div className="barra-fill" style={{ width: `${a.modelo.progresso * 100}%` }} /></div>
                <small>{Math.round(a.modelo.progresso * 100)}% <button className="link" onClick={a.cancelarModelo}>cancelar</button></small>
              </>
            ) : (
              <button className="btn primario" onClick={a.baixarModelo}><Icone nome="download" /> Baixar o modelo de voz</button>
            )}
            {a.modelo.erro && <p className="erro">{a.modelo.erro}</p>}
          </div>
        )}
        {semRaiz && (
          <div className="cartao aviso">
            <Icone nome="folder" /> <div><b>Escolha a pasta raiz das marcas</b><p className="muted">Sem ela não consigo abrir marcas e referências.</p><button className="btn" onClick={() => a.ir("pastas")}>Escolher pasta</button></div>
          </div>
        )}
        {a.api.demo && <div className="cartao aviso"><Icone nome="info" /> <div><b>Modo demonstração</b><p className="muted">Sem microfone: digite os comandos abaixo. Comece com “{a.config.nomeAtivacao}”.</p></div></div>}
        {a.erroMic && !a.api.demo && <div className="cartao erro-card"><Icone nome="alert" /> <div>{a.erroMic}</div></div>}
        {a.stt.estado === "erro" && <div className="cartao erro-card"><Icone nome="alert" /> <div>Falha ao carregar a voz: {a.stt.msg}</div></div>}

        <div className="conversa">
          <header>
            <h3>Conversa</h3>
            {a.log.length > 0 && <button className="link" onClick={a.limparLog}>limpar</button>}
          </header>
          <div className="mensagens">
            {a.log.length === 0 && <p className="muted vazio">O que eu ouvir e responder aparece aqui.</p>}
            {a.log.map((m) => (
              <div key={m.id} className={`msg ${m.tipo}${m.ok === false ? " falha" : ""}`}>
                {m.tipo === "ignorado" && <small>{m.motivo === "expirou" ? `o tempo de escuta já tinha acabado — diga “${a.config.nomeAtivacao}” de novo:` : `ouvi, mas faltou dizer “${a.config.nomeAtivacao}” antes:`}</small>}
                {m.texto}
              </div>
            ))}
            <div ref={fim} />
          </div>
          <div className="rodape-conversa"><small>Não me entendeu? <button className="link" onClick={() => a.ir("config")}>Ouvir o que o microfone captou</button></small></div>
          <form className="entrada" onSubmit={(e) => { e.preventDefault(); enviar(); }}>
            <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Ou digite um comando (não precisa chamar pelo nome)…" />
            <button className="btn primario" type="submit" disabled={!texto.trim()}><Icone nome="send" /></button>
          </form>
        </div>
      </section>
    </div>
  );
}
