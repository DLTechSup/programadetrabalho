// Acessos ao painel e backup dos dados
import { html, icone, aviso, erro, ocupado, confirmar } from '../ui.js';
import { vazio } from '../componentes.js';

export default {
  titulo: () => 'Acessos e backup',
  render(ctx) {
    return html`<div class="grade acessos-grade">
      <section class="painel"><div class="painel-cab"><h2>${icone('equipe')} Quem entra no Meu painel</h2></div><div id="lista-acessos"><div class="painel-corpo"><div class="esqueleto"></div></div></div>
        <form class="painel-corpo grade" id="f-acesso" style="border-top:1px solid var(--line)" novalidate>
          <h3 style="margin:0;font-size:14px">Novo acesso</h3>
          <div class="grade g2">
            <label class="campo"><span>Usuário</span><input class="inp" name="usuario" autocomplete="off" autocapitalize="none" placeholder="ex.: maria" required></label>
            <label class="campo"><span>Senha</span><input class="inp" name="senha" type="password" autocomplete="new-password" minlength="6" required></label>
          </div>
          <small class="muted">Sem espaço nem acento, mínimo 3 letras. Senha com pelo menos 6 caracteres. O escritório não precisa de acesso: a página dele é aberta.</small>
          <button class="btn pri" type="submit" style="justify-self:start">${icone('mais')} Criar acesso</button>
        </form></section>
      <section class="painel"><div class="painel-cab"><h2>${icone('baixar')} Backup</h2></div>
        <div class="painel-corpo grade">
          <p class="muted" style="margin:0">Guarde uma cópia de todos os produtos (rascunho, esperando, recebidos e histórico). O arquivo é compatível com o backup do site antigo.</p>
          <button class="btn" id="exportar">${icone('baixar')} Exportar backup</button>
          <label class="btn">${icone('upload')} Restaurar de um backup<input type="file" accept="application/json" id="importar" class="sr"></label>
          <small class="muted">Restaurar só <b>adiciona</b> o que estiver faltando. Nada que já existe é apagado ou substituído.</small>
          <p class="muted" style="margin:0;font-size:12px">${ctx.itens.length} produtos no banco · ${ctx.fins.length} marcações de "tudo preenchido"</p>
        </div></section>
    </div>`;
  },
  async montar(el, ctx) {
    const alvo = el.querySelector('#lista-acessos');
    const pintar = async () => {
      try {
        const ps = await ctx.banco.acessos();
        alvo.innerHTML = String(ps.length ? html`<ul class="lista">${ps.map((p) => html`<li class="item" style="grid-template-columns:40px 1fr auto">
            <span class="avatar" aria-hidden="true">${(p.usuario || '?')[0].toUpperCase()}</span>
            <div class="item-info"><b>${p.usuario}</b><span class="item-meta">Meu painel</span></div>
            ${p.id === ctx.perfil.id ? html`<span class="selo recv">Você</span>` : ''}</li>`)}</ul>` : vazio('equipe', 'Nenhum acesso', 'Crie o primeiro abaixo.'));
      } catch (e) { alvo.innerHTML = String(vazio('alerta', 'Não foi possível listar', e.message)); }
    };
    pintar();

    el.querySelector('#f-acesso').onsubmit = (e) => {
      e.preventDefault();
      const f = e.target, u = f.usuario.value.trim().toLowerCase().replace(/\s+/g, ''), s = f.senha.value;
      if (!/^[a-z0-9._-]{3,}$/.test(u)) return aviso('Usuário inválido', 'Mínimo 3 letras, sem espaço nem acento.', 'erro');
      if (s.length < 6) return aviso('Senha curta', 'Use pelo menos 6 caracteres.', 'erro');
      ocupado(e.submitter, async () => {
        try { await ctx.banco.criarAcesso(u, s); aviso('Acesso criado', u); f.reset(); pintar(); } catch (err) { erro(err); }
      });
    };

    el.querySelector('#exportar').onclick = () => {
      const payload = { versao: 1, exportadoEm: new Date().toISOString(), itens: ctx.itens, fim: ctx.fins };
      const a = Object.assign(document.createElement('a'), {
        href: URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })),
        download: `backup-codigos-fotos-${new Date().toISOString().slice(0, 10)}.json`,
      });
      document.body.append(a); a.click(); a.remove();
      aviso('Backup exportado', `${ctx.itens.length} produtos`);
    };

    el.querySelector('#importar').onchange = (e) => {
      const arq = e.target.files[0]; e.target.value = '';
      if (!arq) return;
      const r = new FileReader();
      r.onload = async () => {
        let d;
        try { d = JSON.parse(r.result); } catch { return aviso('Arquivo inválido', '', 'erro'); }
        if (!d || !Array.isArray(d.itens)) return aviso('Não é um backup do Códigos das Fotos', '', 'erro');
        const faltando = d.itens.filter((i) => i && i.id && !ctx.item(i.id));
        if (!faltando.length) return aviso('Nada a restaurar', 'Todos os produtos do backup já estão no banco.');
        if (!(await confirmar(`Restaurar ${faltando.length} produtos?`, `O backup tem ${d.itens.length} produtos; ${faltando.length} não estão no banco e serão adicionados. Nada será apagado.`, 'Restaurar'))) return;
        try { await ctx.inserir(faltando); aviso('Backup restaurado', `${faltando.length} produtos adicionados`); } catch (err) { erro(err); }
      };
      r.readAsText(arq);
    };
  },
};
