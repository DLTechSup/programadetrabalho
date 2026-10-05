// Executa as intenções: abre pastas/marcas/referências, programas, sites, controla navegador, janelas e volume.
// Todas as dependências do sistema entram por `deps` (facilita testar sem Windows).
const path = require("node:path");
const { normalizar, digitosDoCodigo, falarCodigo, melhores, vencedorClaro, similaridade } = require("./texto.cjs");
const P = require("./pastas.cjs");
const prog = require("./programas.cjs");

const QUINZE_MIN = 15 * 60 * 1000;
const BROWSERS = { chrome: ["chrome"], edge: ["msedge"], firefox: ["firefox"], brave: ["brave"], opera: ["opera"] };
const NOME_NAV = { chrome: "Chrome", edge: "Edge", firefox: "Firefox", brave: "Brave", opera: "Opera" };
const ORDEM_NAV = ["chrome", "edge", "firefox", "brave", "opera"];

function criarAcoes(deps) {
  const { config, janelas, abrirCaminho, abrirUrl, executarProcesso, listarProgramas, pastasConhecidas = [], ignorarPid = 0, agora = Date.now } = deps;
  const mem = { idx: null, idxQuando: 0, marca: null, ref: null, pastaAtual: null, quando: 0, programas: null, programasQuando: 0 };
  const fresco = () => agora() - mem.quando < QUINZE_MIN;
  const lembrar = (p) => Object.assign(mem, { quando: agora() }, p);

  async function indice(forcar = false) {
    const raiz = config.get().pastaRaiz;
    if (!raiz) return null;
    if (forcar || !mem.idx || mem.idx.raiz !== raiz || agora() - mem.idxQuando > 10 * 60 * 1000) {
      mem.idx = await P.indexar(raiz, { ignorar: config.get().ignorar });
      mem.idxQuando = agora();
    }
    return mem.idx;
  }
  const SEM_RAIZ = { ok: false, fala: "Ainda não escolhi a pasta raiz das marcas. Configure na aba Pastas." };

  async function instalados(forcar = false) {
    if (forcar || !mem.programas || agora() - mem.programasQuando > 30 * 60 * 1000) {
      mem.programas = await listarProgramas();
      mem.programasQuando = agora();
    }
    return mem.programas;
  }

  const abrirDir = async (caminho, extra = {}) => {
    const erro = await abrirCaminho(caminho);
    if (erro) return { ok: false, fala: "Não consegui abrir a pasta." };
    lembrar({ pastaAtual: caminho, ...extra });
    return null;
  };

  const plural = (n, s, p) => `${n} ${n === 1 ? s : p}`;
  const escolher = (pergunta, opcoes) => ({ ok: true, escolha: { pergunta, opcoes: opcoes.slice(0, 6) }, fala: "" });

  // ---------------------------------------------------------------- marcas e referências
  async function abrirMarca(it) {
    const idx = await indice();
    if (!idx) return SEM_RAIZ;
    if (idx.erro) return { ok: false, fala: idx.erro };
    let marca = it.marcaCaminho ? idx.marcas.find((m) => m.caminho === it.marcaCaminho) : null;
    if (!marca) {
      let r = P.acharMarcas(idx, it.marca);
      if (!r.length) r = P.acharMarcas(await indice(true), it.marca);
      if (!r.length) return { ok: false, fala: `Não achei a marca ${it.marca}.` };
      if (!vencedorClaro(r)) {
        return escolher(`Achei ${r.length} marcas parecidas.`, r.map((x) => ({ rotulo: x.item.nome, intent: { ...it, marcaCaminho: x.item.caminho, marca: x.item.nome } })));
      }
      marca = r[0].item;
    }
    if (it.ref) return abrirRef({ tipo: "abrir_ref", ref: it.ref, marcaCaminho: marca.caminho });
    const erro = await abrirDir(marca.caminho, { marca, ref: null });
    if (erro) return erro;
    return { ok: true, fala: `Abrindo a marca ${marca.nome}. Tem ${plural(marca.refs.length, "referência", "referências")}.` };
  }

  async function abrirRef(it) {
    if (it.refCaminho) {
      const m = mem.idx && mem.idx.marcas.find((x) => x.nome === it.marca);
      const erro = await abrirDir(it.refCaminho, { marca: m || mem.marca, ref: { nome: it.refNome, caminho: it.refCaminho } });
      if (erro) return erro;
      const c = await P.listarConteudo(it.refCaminho);
      return { ok: true, fala: `Abrindo ${it.refNome}. Tem ${plural(c.arquivos.length, "arquivo", "arquivos")}.` };
    }
    const idx = await indice();
    if (!idx) return SEM_RAIZ;
    if (idx.erro) return { ok: false, fala: idx.erro };
    let marca = null;
    if (it.marcaCaminho) marca = idx.marcas.find((m) => m.caminho === it.marcaCaminho) || null;
    else if (it.marca) {
      const r = P.acharMarcas(idx, it.marca);
      if (!r.length) return { ok: false, fala: `Não achei a marca ${it.marca}.` };
      if (!vencedorClaro(r)) return escolher(`Achei ${r.length} marcas parecidas.`, r.map((x) => ({ rotulo: x.item.nome, intent: { ...it, marcaCaminho: x.item.caminho, marca: x.item.nome } })));
      marca = r[0].item;
    } else if (mem.marca && fresco()) marca = idx.marcas.find((m) => m.caminho === mem.marca.caminho) || null;

    let refs = P.acharRefs(idx, it.ref, marca);
    if (!refs.length && marca) {
      const fora = P.acharRefs(idx, it.ref);
      if (fora.length) {
        return escolher(`Não achei ${it.ref} na marca ${marca.nome}, mas achei em outra.`, fora.map((x) => ({ rotulo: `${x.item.marca} — ${x.item.nome}`, intent: { tipo: "abrir_ref", refCaminho: x.item.caminho, refNome: x.item.nome, marca: x.item.marca } })));
      }
    }
    if (!refs.length) return { ok: false, fala: marca ? `Não achei a referência ${falarCodigo(digitosDoCodigo(it.ref)) || it.ref} na marca ${marca.nome}.` : `Não achei a referência ${falarCodigo(digitosDoCodigo(it.ref)) || it.ref} em nenhuma marca.` };
    if (!P.vencedorRef(refs)) {
      const unica = new Set(refs.map((r) => r.item.marca)).size === 1;
      return escolher(`Achei ${refs.length} referências.`, refs.map((x) => ({ rotulo: unica ? x.item.nome : `${x.item.marca} — ${x.item.nome}`, intent: { tipo: "abrir_ref", refCaminho: x.item.caminho, refNome: x.item.nome, marca: x.item.marca } })));
    }
    const ref = refs[0].item;
    const m = idx.marcas.find((x) => x.caminho === ref.marcaCaminho);
    const erro = await abrirDir(ref.caminho, { marca: m, ref });
    if (erro) return erro;
    const c = await P.listarConteudo(ref.caminho);
    return { ok: true, fala: `Abrindo ${ref.nome} da ${ref.marca}. Tem ${plural(c.arquivos.length, "arquivo", "arquivos")}${c.pastas.length ? ` e ${plural(c.pastas.length, "pasta", "pastas")}` : ""}.` };
  }

  async function pesquisarEmPasta(termo, marcaObj) {
    const base = marcaObj ? marcaObj.caminho : mem.pastaAtual;
    if (!base) return { ok: false, fala: "Não tem nenhuma pasta aberta para pesquisar." };
    const r = await P.buscarEm(base, termo);
    if (!r.length) return { ok: false, fala: `Não achei ${termo} em ${path.basename(base)}.` };
    const abrir = (x) => ({ tipo: x.pasta ? "abrir_pasta" : "abrir_arquivo", caminho: x.caminho, nome: x.nome });
    if (r.length === 1 || (r[0].score === 1 && r[1].score < 1)) return executar(abrir(r[0]));
    return escolher(`Achei ${r.length} resultados.`, r.map((x) => ({ rotulo: `${x.nome}${x.pasta ? " (pasta)" : ""}`, intent: abrir(x) })));
  }

  async function pesquisar(it) {
    const termo = String(it.termo).replace(/^(?:o |no |na )?(?:youtube|google)\s+/, "").trim();
    const temDigitos = digitosDoCodigo(termo).length >= 3;
    if (it.destino === "pasta" || (it.destino == null && fresco() && mem.marca && (temDigitos || !/\s/.test(termo)))) {
      if (temDigitos) return abrirRef({ tipo: "abrir_ref", ref: termo, marca: "", marcaCaminho: mem.marca && mem.marca.caminho });
      return pesquisarEmPasta(termo, mem.marca);
    }
    const youtube = it.destino === "youtube";
    const url = youtube ? `https://www.youtube.com/results?search_query=${encodeURIComponent(termo)}` : `https://www.google.com/search?q=${encodeURIComponent(termo)}`;
    await abrirUrl(url, it.navegador);
    return { ok: true, fala: `Pesquisando ${termo} ${youtube ? "no YouTube" : "no Google"}.` };
  }

  async function pesquisarEm(it) {
    const idx = await indice();
    if (idx && !idx.erro) {
      const m = P.acharMarcas(idx, it.onde);
      if (m.length && vencedorClaro(m)) {
        if (digitosDoCodigo(it.termo).length >= 3) return abrirRef({ tipo: "abrir_ref", ref: it.termo, marcaCaminho: m[0].item.caminho });
        return pesquisarEmPasta(it.termo, m[0].item);
      }
    }
    return pesquisarEmPasta(it.termo, null);
  }

  async function listarArquivos() {
    if (!mem.pastaAtual) return { ok: false, fala: "Não tem nenhuma pasta aberta." };
    const c = await P.listarConteudo(mem.pastaAtual);
    if (!c.arquivos.length) return { ok: true, fala: c.pastas.length ? `Não tem arquivos aqui, só ${plural(c.pastas.length, "pasta", "pastas")}: ${c.pastas.slice(0, 5).join(", ")}.` : "A pasta está vazia." };
    const primeiros = c.arquivos.slice(0, 5).map((a) => path.parse(a).name);
    const resto = c.arquivos.length - primeiros.length;
    return { ok: true, fala: `${plural(c.arquivos.length, "arquivo", "arquivos")}: ${primeiros.join(", ")}${resto > 0 ? ` e mais ${resto}` : ""}.`, lista: c.arquivos };
  }

  async function abrirArquivo(it) {
    if (it.caminho) {
      const erro = await abrirCaminho(it.caminho);
      return erro ? { ok: false, fala: "Não consegui abrir o arquivo." } : { ok: true, fala: `Abrindo ${it.nome || path.basename(it.caminho)}.` };
    }
    if (!mem.pastaAtual) return { ok: false, fala: "Não tem nenhuma pasta aberta para procurar o arquivo." };
    const r = (await P.buscarEm(mem.pastaAtual, it.nome, { profundidade: 2 })).filter((x) => !x.pasta);
    if (!r.length) return { ok: false, fala: `Não achei o arquivo ${it.nome}.` };
    if (r.length === 1 || vencedorClaro(r.map((x) => ({ score: x.score })))) return abrirArquivo({ caminho: r[0].caminho, nome: r[0].nome });
    return escolher(`Achei ${r.length} arquivos.`, r.map((x) => ({ rotulo: x.nome, intent: { tipo: "abrir_arquivo", caminho: x.caminho, nome: x.nome } })));
  }

  async function abrirPasta(it) {
    if (it.caminho) {
      const erro = await abrirDir(it.caminho);
      return erro || { ok: true, fala: `Abrindo ${path.basename(it.caminho) || it.caminho}.` };
    }
    const n = normalizar(it.nome);
    const disco = n.match(/^(?:disco |unidade |drive )?([a-z])$/);
    if (disco) {
      const erro = await abrirDir(`${disco[1].toUpperCase()}:\\`);
      return erro || { ok: true, fala: `Abrindo o disco ${disco[1].toUpperCase()}.` };
    }
    for (const al of config.get().aliases) {
      if (al.tipo === "caminho" && al.falas.some((f) => normalizar(f) === n)) {
        const erro = await abrirDir(al.destino);
        return erro || { ok: true, fala: `Abrindo ${it.nome}.` };
      }
    }
    const conhecida = pastasConhecidas.find((p) => p.falas.some((f) => normalizar(f) === n || normalizar(f).includes(n) && n.length > 4));
    if (conhecida) {
      const erro = await abrirDir(conhecida.caminho);
      return erro || { ok: true, fala: `Abrindo ${it.nome}.` };
    }
    const idx = await indice();
    if (idx && !idx.erro) {
      if (/^(?:raiz|pasta raiz)$/.test(n) || similaridade(n, path.basename(idx.raiz)) >= 0.85) {
        const erro = await abrirDir(idx.raiz, { marca: null, ref: null });
        return erro || { ok: true, fala: "Abrindo a pasta raiz." };
      }
      const m = P.acharMarcas(idx, it.nome);
      if (m.length) return abrirMarca({ tipo: "abrir_marca", marca: it.nome, ref: "" });
    }
    return { ok: false, fala: `Não encontrei a pasta ${it.nome}.` };
  }

  async function pastaAcima() {
    if (!mem.pastaAtual) return { ok: false, fala: "Não tem nenhuma pasta aberta." };
    const pai = path.dirname(mem.pastaAtual);
    if (pai === mem.pastaAtual) return { ok: false, fala: "Já estou na raiz do disco." };
    const idx = mem.idx;
    const marca = idx && idx.marcas.find((m) => m.caminho === pai);
    const erro = await abrirDir(pai, marca ? { marca, ref: null } : idx && pai === idx.raiz ? { marca: null, ref: null } : {});
    return erro || { ok: true, fala: `Abrindo ${path.basename(pai) || pai}.` };
  }

  // ---------------------------------------------------------------- programas
  async function lancar(item) {
    if (item.tipo === "app") await executarProcesso("explorer.exe", [`shell:AppsFolder\\${item.id}`]);
    else {
      const erro = await abrirCaminho(item.caminho);
      if (erro) return { ok: false, fala: `Não consegui abrir ${item.nome}.` };
    }
    return { ok: true, fala: `Abrindo ${item.nome}.` };
  }

  async function abrirAlias(al, nome) {
    if (al.tipo === "url") {
      await abrirUrl(al.destino);
      return { ok: true, fala: `Abrindo ${nome}.` };
    }
    if (al.tipo === "caminho") {
      const erro = await abrirCaminho(al.destino);
      return erro ? { ok: false, fala: `Não consegui abrir ${nome}.` } : { ok: true, fala: `Abrindo ${nome}.` };
    }
    return abrir({ tipo: "abrir", alvo: al.destino, semAlias: true });
  }

  async function abrir(it) {
    const alvo = it.alvo;
    const n = normalizar(alvo);
    if (!it.semAlias) {
      const al = config.get().aliases.find((a) => a.falas.some((f) => normalizar(f) === n));
      if (al) return abrirAlias(al, alvo);
    }
    // "beira rio 8506 209" = marca + código
    const cod = n.match(/^(.+?) (?:referencia |ref |modelo |codigo )?((?:\d[\d ]*|(?:(?:zero|um|dois|tres|quatro|cinco|seis|sete|oito|nove|ponto) ?)+))$/);
    if (cod && digitosDoCodigo(cod[2]).length >= 3) {
      const idx = await indice();
      if (idx && !idx.erro) {
        const m = P.acharMarcas(idx, cod[1]);
        if (m.length && vencedorClaro(m)) return abrirMarca({ tipo: "abrir_marca", marca: cod[1], ref: cod[2], marcaCaminho: m[0].item.caminho });
      }
    }
    // programa instalado
    let lista = [];
    try {
      lista = await instalados();
    } catch {
      lista = [];
    }
    const r = prog.acharPrograma(lista, alvo, config.get().aliases);
    if (r.candidatos.length) {
      if (!r.claro) return escolher(`Achei ${r.candidatos.length} programas parecidos.`, r.candidatos.map((c) => ({ rotulo: c.item.nome, intent: { tipo: "abrir_item", item: c.item } })));
      return abrirItem(r.candidatos[0].item);
    }
    // site conhecido / endereço
    const url = prog.urlDoSite(alvo);
    if (url) {
      await abrirUrl(url, it.navegador);
      return { ok: true, fala: `Abrindo ${alvo}.` };
    }
    // marca
    const idx = await indice();
    if (idx && !idx.erro) {
      const m = P.acharMarcas(idx, alvo);
      if (m.length) return abrirMarca({ tipo: "abrir_marca", marca: alvo, ref: "" });
    }
    const pasta = pastasConhecidas.find((p) => p.falas.some((f) => normalizar(f) === n));
    if (pasta) return abrirPasta({ nome: alvo });
    return { ok: false, naoEncontrado: true, fala: `Não encontrei ${alvo} entre os programas, pastas ou sites.` };
  }

  /** Se o programa já está aberto, traz para a frente; senão, abre. */
  async function abrirItem(item) {
    try {
      const jan = await janelas.listar(ignorarPid);
      const ach = prog.acharJanelas(jan, item.nome);
      if (ach.length && ach[0].score >= 0.95) {
        await janelas.focar(ach[0].janela.hwnd);
        return { ok: true, fala: `${item.nome} já estava aberto. Trouxe para a frente.` };
      }
    } catch {
      /* sem lista de janelas: abre normalmente */
    }
    return lancar(item);
  }

  async function fecharPrograma(it) {
    const jan = await janelas.listar(ignorarPid);
    const ach = prog.acharJanelas(jan, it.nome).filter((x) => !prog.PROTEGIDOS.has(normalizar(x.janela.proc || "")));
    if (!ach.length) return { ok: false, fala: `Não encontrei ${it.nome} aberto.` };
    const melhor = ach[0].score;
    const alvo = ach.filter((x) => x.score >= melhor - 0.05).map((x) => x.janela);
    await janelas.fechar(alvo.map((j) => j.hwnd));
    if (it.forcar) {
      await new Promise((r) => setTimeout(r, 1500));
      await janelas.matar([...new Set(alvo.map((j) => j.pid))]);
    }
    return { ok: true, fala: `Fechando ${it.nome}${alvo.length > 1 ? ` (${alvo.length} janelas)` : ""}.` };
  }

  // ---------------------------------------------------------------- janelas
  const nomeAmigavel = (j) => {
    const ult = String(j.titulo || "").split(/\s[-–—|]\s/).pop() || j.proc;
    return ult.length > 28 ? j.proc : ult;
  };

  async function janela(it) {
    switch (it.op) {
      case "trocar":
        await janelas.teclas("%{TAB}");
        return { ok: true, fala: "Trocando de janela." };
      case "area_trabalho":
        await janelas.areaDeTrabalho();
        return { ok: true, fala: "Área de trabalho." };
      case "fechar_atual": {
        const jan = await janelas.listar(ignorarPid);
        const f = jan.find((j) => j.foco);
        if (!f) return { ok: false, fala: "Não achei uma janela em foco para fechar." };
        await janelas.fechar([f.hwnd]);
        return { ok: true, fala: `Fechando ${nomeAmigavel(f)}.` };
      }
      case "listar": {
        const jan = await janelas.listar(ignorarPid);
        const nomes = [...new Set(jan.map(nomeAmigavel))].slice(0, 8);
        return { ok: true, fala: nomes.length ? `Abertos: ${nomes.join(", ")}.` : "Não tem nada aberto." };
      }
      case "minimizar":
      case "maximizar":
      case "restaurar": {
        const jan = await janelas.listar(ignorarPid);
        let alvo;
        if (!it.nome) alvo = jan.find((j) => j.foco);
        else alvo = (prog.acharJanelas(jan, it.nome)[0] || {}).janela;
        if (!alvo) return { ok: false, fala: it.nome ? `Não encontrei ${it.nome} aberto.` : "Não achei uma janela em foco." };
        await janelas.mostrar(alvo.hwnd, it.op);
        return { ok: true, fala: `${{ minimizar: "Minimizando", maximizar: "Maximizando", restaurar: "Restaurando" }[it.op]} ${nomeAmigavel(alvo)}.` };
      }
      case "focar": {
        const jan = await janelas.listar(ignorarPid);
        const ach = prog.acharJanelas(jan, it.nome);
        if (!ach.length) {
          const r = await abrir({ tipo: "abrir", alvo: it.nome });
          return r.ok ? { ...r, fala: `${it.nome} não estava aberto. ${r.fala}` } : r;
        }
        await janelas.focar(ach[0].janela.hwnd);
        return { ok: true, fala: `${nomeAmigavel(ach[0].janela)}.` };
      }
    }
    return { ok: false, fala: "Não sei fazer isso com janelas." };
  }

  // ---------------------------------------------------------------- navegador
  async function escolherNavegador(pref) {
    const jan = await janelas.listar(ignorarPid);
    const doNav = (k) => jan.filter((j) => BROWSERS[k].includes(normalizar(j.proc || "")));
    let chave = null;
    if (pref && doNav(pref).length) chave = pref;
    else if (!pref) {
      const emFoco = jan.find((j) => j.foco);
      chave = ORDEM_NAV.find((k) => emFoco && BROWSERS[k].includes(normalizar(emFoco.proc || ""))) || ORDEM_NAV.find((k) => doNav(k).length) || null;
    }
    if (!chave) return { erro: pref ? `O ${NOME_NAV[pref]} não está aberto.` : "Nenhum navegador está aberto." };
    const wins = doNav(chave);
    const j = wins.find((w) => w.foco) || wins[0];
    return { chave, hwnd: j.hwnd, nome: NOME_NAV[chave] };
  }

  async function navegador(it) {
    const nav = await escolherNavegador(it.navegador);
    if (nav.erro) return { ok: false, fala: nav.erro };
    const k = nav.chave;
    const T = (seq, extra = {}) => janelas.teclas(seq, { hwnd: nav.hwnd, ...extra });
    if (it.tipo === "aba") {
      switch (it.op) {
        case "proxima": await T("^{TAB}"); return { ok: true, fala: "Próxima aba." };
        case "anterior": await T("^+{TAB}"); return { ok: true, fala: "Aba anterior." };
        case "numero": await T(`^${it.n}`); return { ok: true, fala: it.n === 9 ? "Última aba." : `Aba ${it.n}.` };
        case "fechar": await T("^w"); return { ok: true, fala: "Aba fechada." };
        case "reabrir": await T("^+t"); return { ok: true, fala: "Reabri a última aba fechada." };
        case "nova":
          if (it.url) {
            const u = prog.urlDoSite(it.url) || `https://www.google.com/search?q=${encodeURIComponent(it.url)}`;
            await abrirUrl(u, k);
            return { ok: true, fala: "Nova aba." };
          }
          await T("^t");
          return { ok: true, fala: "Nova aba." };
        case "nome":
          if (k === "firefox") await T("^l", { digitar: `% ${it.nome}`, depois: "{ENTER}" });
          else await T("^+a", { digitar: it.nome, depois: "{ENTER}" });
          return { ok: true, fala: `Procurando a aba ${it.nome}.` };
      }
    }
    if (it.tipo === "nav") {
      switch (it.op) {
        case "recarregar": await T("{F5}"); return { ok: true, fala: "Recarregando." };
        case "voltar": await T("%{LEFT}"); return { ok: true, fala: "Voltando." };
        case "avancar": await T("%{RIGHT}"); return { ok: true, fala: "Avançando." };
        case "anonima": await T(k === "firefox" ? "^+p" : "^+n"); return { ok: true, fala: "Janela anônima." };
        case "nova_janela": await T("^n"); return { ok: true, fala: "Nova janela." };
        case "tela_cheia": await T("{F11}"); return { ok: true, fala: "Tela cheia." };
      }
    }
    return { ok: false, fala: "Não sei fazer isso no navegador." };
  }

  // ---------------------------------------------------------------- volume e mídia
  async function volume(it) {
    const r = await janelas.volume(it.op, it.valor ?? it.delta ?? 0);
    if (it.op === "mudo") return { ok: true, fala: "Som desligado." };
    if (it.op === "som") return { ok: true, fala: `Som ligado. Volume em ${r.volume} por cento.` };
    return { ok: true, fala: `Volume em ${r.volume} por cento.` };
  }

  async function executar(it) {
    switch (it.tipo) {
      case "abrir_marca": return abrirMarca(it);
      case "abrir_ref": return abrirRef(it);
      case "pesquisar": return pesquisar(it);
      case "pesquisar_em": return pesquisarEm(it);
      case "listar_arquivos": return listarArquivos();
      case "abrir_arquivo": return abrirArquivo(it);
      case "abrir_pasta": return abrirPasta(it);
      case "pasta_acima": return pastaAcima();
      case "fechar_pasta": {
        const n = await janelas.fecharPastas(it.todas ? null : mem.pastaAtual);
        return n ? { ok: true, fala: n === 1 ? "Pasta fechada." : `${n} pastas fechadas.` } : { ok: false, fala: "Não achei pasta aberta para fechar." };
      }
      case "abrir": return abrir(it);
      case "abrir_item": return abrirItem(it.item);
      case "fechar_programa": return fecharPrograma(it);
      case "janela": return janela(it);
      case "aba":
      case "nav": return navegador(it);
      case "abrir_site": {
        const url = prog.urlDoSite(it.site);
        if (!url) return { ok: false, fala: `Não entendi o endereço ${it.site}.` };
        await abrirUrl(url, it.navegador);
        return { ok: true, fala: `Abrindo ${it.site}.` };
      }
      case "volume": return volume(it);
      case "midia": await janelas.midia(it.op); return { ok: true, fala: { pausar: "Pausado.", tocar: "Tocando.", proxima: "Próxima.", anterior: "Anterior." }[it.op] };
      case "hora": {
        const d = new Date(agora());
        return { ok: true, fala: `São ${d.getHours()} horas e ${d.getMinutes()} minutos.` };
      }
    }
    return { ok: false, fala: "Não sei fazer isso ainda." };
  }

  return {
    executar,
    reindexar: async () => {
      const i = await indice(true);
      return i && { marcas: i.marcas.length, referencias: i.totalRefs, erro: i.erro };
    },
    indiceAtual: () => mem.idx,
    programas: instalados,
    contexto: () => ({ marca: mem.marca && mem.marca.nome, ref: mem.ref && mem.ref.nome, pasta: mem.pastaAtual }),
    esquecerContexto: () => Object.assign(mem, { marca: null, ref: null, pastaAtual: null }),
  };
}

module.exports = { criarAcoes };
