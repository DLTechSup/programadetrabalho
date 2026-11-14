// Acesso ao Supabase com as MESMAS tabelas do site original: itens(id, doc, atualizado), perfis(id, usuario, papel), fins(em)
// e a pasta de fotos "fotos". REGRA: este arquivo não apaga nada — não existe nenhuma chamada de delete aqui.
import { SUPABASE_URL, SUPABASE_ANON_KEY, DOMINIO_EMAIL } from './config.js';
import { uid } from './regras.js';

const limpaUser = (u) => (u || '').trim().toLowerCase().replace(/\s+/g, '');
// Aceita só o usuário (como no site original) ou o e-mail completo
const emailDe = (u) => (limpaUser(u).includes('@') ? limpaUser(u) : `${limpaUser(u)}@${DOMINIO_EMAIL}`);

// Traduz o erro real do Supabase em vez de esconder a causa
function motivo(error) {
  const m = (error?.message || '').toLowerCase();
  if (m.includes('invalid login credentials')) return 'Usuário ou senha incorretos.';
  if (m.includes('email not confirmed')) return 'Este usuário ainda não foi confirmado no Supabase (Authentication → Users).';
  if (m.includes('failed to fetch') || m.includes('network')) return 'Sem conexão com o servidor do Supabase. Verifique a internet.';
  if (m.includes('rate limit') || m.includes('too many')) return 'Muitas tentativas seguidas. Espere alguns minutos e tente de novo.';
  return 'Não foi possível entrar: ' + (error?.message || 'erro desconhecido');
}
const docDe = (r) => ({ ...(r.doc || {}), id: (r.doc && r.doc.id) || r.id });

export function criarBanco() {
  const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  async function perfilDe(user) {
    const { data, error } = await sb.from('perfis').select('id,usuario,papel').eq('id', user.id).maybeSingle();
    if (error) throw new Error('Login certo, mas não consegui ler seu perfil: ' + error.message);
    return data || null;
  }

  return {
    demo: false,

    async sessao() {
      const { data } = await sb.auth.getSession();
      const user = data.session?.user;
      if (!user) return null;
      const perfil = await perfilDe(user);
      if (!perfil) { await sb.auth.signOut(); return null; }
      return { user, perfil };
    },

    async entrar(usuario, senha) {
      const { data, error } = await sb.auth.signInWithPassword({ email: emailDe(usuario), password: senha });
      if (error) throw new Error(motivo(error));
      const perfil = await perfilDe(data.user);
      if (!perfil) { await sb.auth.signOut(); throw new Error('Este usuário não tem acesso liberado.'); }
      return { user: data.user, perfil };
    },

    sair: () => sb.auth.signOut(),

    async listar() {
      const docs = [];
      for (let de = 0; ; de += 1000) {
        const { data, error } = await sb.from('itens').select('id,doc').range(de, de + 999);
        if (error) throw new Error(error.message);
        docs.push(...data.map(docDe));
        if (data.length < 1000) break;
      }
      return docs;
    },

    async fins() {
      const { data } = await sb.from('fins').select('em');
      return (data || []).map((r) => +r.em);
    },

    // Lê o registro atual e grava só o que mudou, preservando todos os outros campos
    async alterar(id, mudancas) {
      const { data: atual, error: e1 } = await sb.from('itens').select('doc').eq('id', id).maybeSingle();
      if (e1) throw new Error(e1.message);
      if (!atual) throw new Error('Este produto não foi encontrado no banco.');
      const doc = { ...(atual.doc || {}), ...mudancas, id };
      const { data, error } = await sb.from('itens').update({ doc, atualizado: new Date().toISOString() }).eq('id', id).select('id').maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) throw new Error('O banco não aceitou a alteração.');
      return doc;
    },

    async inserir(docs) {
      const linhas = docs.map((d) => ({ id: d.id, doc: d, atualizado: new Date().toISOString() }));
      const { error } = await sb.from('itens').insert(linhas);
      if (error) throw new Error(error.message);
      return docs;
    },

    // "Tudo preenchido": mesmo registro que o site original grava
    async marcarFim() {
      const em = Date.now();
      await sb.from('fins').insert({ em });
      return em;
    },

    async enviarFoto(blob) {
      const caminho = `${Date.now()}-${uid()}.jpg`;
      const { error } = await sb.storage.from('fotos').upload(caminho, blob, { contentType: 'image/jpeg' });
      if (error) throw new Error('Erro ao enviar foto: ' + error.message);
      return sb.storage.from('fotos').getPublicUrl(caminho).data.publicUrl;
    },

    ouvir({ aoItem, aoFim, aoStatus }) {
      const canal = sb.channel('cf2-itens')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'itens' }, (p) => {
          if (p.eventType === 'DELETE') aoItem(null, p.old && p.old.id);
          else if (p.new) aoItem(docDe(p.new));
        })
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'fins' }, (p) => aoFim(+p.new.em))
        .subscribe((s) => aoStatus?.(s === 'SUBSCRIBED'));
      return () => sb.removeChannel(canal);
    },

    async acessos() {
      const { data, error } = await sb.from('perfis').select('id,usuario,papel').order('usuario');
      if (error) throw new Error(error.message);
      return data || [];
    },

    // Igual ao original: cria o login sem derrubar a sessão atual e registra o perfil
    async criarAcesso(usuario, senha) {
      const u = limpaUser(usuario);
      const tmp = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'cf2-tmp' } });
      const { data, error } = await tmp.auth.signUp({ email: emailDe(u), password: senha });
      if (error) throw new Error(error.message);
      if (!data.user || (data.user.identities && data.user.identities.length === 0)) throw new Error('Esse usuário já existe.');
      const r = await sb.from('perfis').insert({ id: data.user.id, usuario: u, papel: 'admin' });
      if (r.error) throw new Error(r.error.message);
    },
  };
}

// Reduz a foto antes de enviar (lado maior 1200px, JPEG 80%)
export async function comprimir(arquivo, max = 1200) {
  const bmp = await createImageBitmap(arquivo);
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((ok) => c.toBlob(ok, 'image/jpeg', 0.8));
}
