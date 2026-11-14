import { html, raw, icone, logo } from '../ui.js';

export default {
  render(ctx) {
    return html`<div class="login">
      <section class="login-arte" aria-hidden="true">
        <div>${logo('invertido grande')}</div>
        <div><h1>Sua parte pronta. O resto, acompanhado ao vivo.</h1>
          <p>Cadastre marca, referência e fotos. O escritório responde o código e você vê na hora, com som e aviso.</p></div>
        <div class="fluxo" id="fluxo"><span>Fotos</span><span>Cadastro</span><span>Escritório</span><span>Código</span><span>Site</span><span>Atacado</span></div>
      </section>
      <section class="login-form">
        <form id="f-login" novalidate>
          <a class="btn fant peq" href="#/esc" style="align-self:flex-start">${icone('voltar')} Voltar para a página do escritório</a>
          <div><h2>Meu painel</h2><p class="muted" style="margin:4px 0 0">Acesso restrito. Use seu usuário e senha.</p></div>
          <label class="campo"><span>Usuário</span><input class="inp" name="usuario" autocomplete="username" autocapitalize="none" spellcheck="false" required autofocus></label>
          <label class="campo"><span>Senha</span><input class="inp" type="password" name="senha" autocomplete="current-password" required></label>
          <p class="erro-txt" id="erro" role="alert" hidden></p>
          <button class="btn pri" type="submit">Entrar</button>
          ${ctx.demo ? html`<p class="muted" style="font-size:12px;margin:0">Demonstração: digite qualquer usuário e senha.</p>` : ''}
        </form>
      </section>
    </div>`;
  },

  montar(raiz, ctx, entrar) {
    const ps = [...raiz.querySelectorAll('#fluxo span')];
    let k = 0;
    const t = setInterval(() => { if (!ps[0]?.isConnected) return clearInterval(t); ps.forEach((p, j) => p.classList.toggle('on', j === k)); k = (k + 1) % ps.length; }, 850);
    const f = raiz.querySelector('#f-login'), msg = raiz.querySelector('#erro'), btn = f.querySelector('[type=submit]');
    f.onsubmit = async (e) => {
      e.preventDefault();
      const u = f.usuario.value.trim(), s = f.senha.value;
      if (!u || !s) { msg.hidden = false; msg.textContent = 'Preencha usuário e senha.'; return; }
      btn.disabled = true; btn.innerHTML = String(raw('<span class="giro" aria-hidden="true"></span> Entrando…'));
      try { entrar(await ctx.banco.entrar(u, s)); } catch (err) {
        msg.hidden = false; msg.textContent = err.message; btn.disabled = false; btn.textContent = 'Entrar'; f.senha.value = '';
        f.animate([{ translate: '0' }, { translate: '-6px' }, { translate: '6px' }, { translate: '0' }], { duration: 260 });
      }
    };
  },
};
