# Encaixe

Currículo ATS friendly a partir de uma vaga. Cole o texto da vaga, envie o seu currículo (PDF, Word .docx ou .txt) ou cole o texto, veja o percentual de match, as palavras-chave encontradas e as que faltam, e baixe uma versão ajustada em PDF.

> **Regra de ouro:** o Encaixe melhora como você se apresenta. Ele nunca inventa experiência, habilidade, cargo, empresa, data, número ou certificação que você não tem.

## Stack

Next.js (App Router) + TypeScript + Tailwind CSS + shadcn/ui e `@react-pdf/renderer`.

**Não usa IA externa, chave de API nem servidor.** É um site estático: a análise da vaga, a comparação, a reescrita e o PDF rodam no navegador da pessoa. Sem banco de dados, login ou armazenamento: tudo fica em memória na aba e some ao recarregar.

A vaga é informada colando o texto da descrição (sites como Indeed e LinkedIn bloqueiam a leitura automática por link).

## Rodando localmente

```bash
npm install
npm run dev      # http://localhost:3000
```

Outros comandos: `npm test` (testes unitários), `npm run lint`, `npm run typecheck`, `npm run build`.

## Publicar no GitHub Pages

O workflow `.github/workflows/deploy-pages.yml` roda os testes, gera o site estático e publica a cada push na `main`.

1. No GitHub, abra **Settings → Pages**.
2. Em **Build and deployment → Source**, escolha **GitHub Actions**.
3. Faça um push na `main` (ou rode o workflow em **Actions → Publicar no GitHub Pages → Run workflow**).

O site fica em `https://<usuário>.github.io/<repositório>/`. Também funciona na Vercel (importe o repositório e faça o deploy, sem configuração).

## Como funciona

| Etapa | Onde | Arquivo |
|---|---|---|
| Ler o currículo enviado (PDF com pdf.js, .docx com mammoth, .txt) | navegador | `lib/ler-arquivo.ts` |
| Ler a vaga: seções (requisitos, diferenciais, atividades, benefícios), termos do dicionário e expressões como "experiência com…" (máx. 30 termos) | navegador | `lib/analisar-vaga.ts`, `lib/dicionario.ts` |
| Comparação e score (peso 3 obrigatório, 1 desejável) | navegador | `lib/score.ts` |
| Reescrita: seções padrão ATS, experiências da mais recente para a mais antiga, verbos de ação, sinônimos trocados pelo termo exato da vaga | navegador | `lib/reescrever-curriculo.ts` |
| Validação anti-invenção (remove menções não confirmadas em listas e avisa o que sobrar), também sobre as edições feitas na tela | navegador | `lib/anti-invencao.ts` |
| Estilo do arquivo enviado: fonte, tamanhos, cores, alinhamento, linha nos títulos e margens | navegador | `lib/estilo.ts`, `lib/extrair-estilo.ts` |
| Download no formato do original (.docx ou PDF), com o estilo dele, em uma coluna | navegador | `components/analise/curriculo-docx.ts`, `components/analise/curriculo-pdf.tsx` |
| Dicas para melhorar o currículo, atualizadas enquanto a pessoa edita | navegador | `lib/dicas.ts` |
| Sugestões comentadas ("Eu faria… Porque…") que a pessoa aplica ou ignora | navegador | `lib/sugestoes.ts`, `lib/verbos.ts` |
| Visualizador antes × depois, marcando linhas e palavras alteradas | navegador | `lib/diff.ts`, `components/analise/comparador.tsx` |
| Ortografia (dicionário VERO pt-BR) e escrita (crase, "mas/mais", "há/a"…) | navegador | `lib/ortografia/` |
| Vaga de nível mais simples ("qualificado demais"): detecção e ajustes opcionais que omitem, sem mudar cargos, empresas ou datas | navegador | `lib/nivel.ts`, `lib/sugestoes.ts` |
| Revisão final editável antes de salvar em PDF, Word ou .txt | navegador | `components/analise/curriculo-ajustado.tsx` |

Para reconhecer mais competências, acrescente entradas em `lib/dicionario.ts` (termo, categoria e variantes com o **mesmo** significado).

## Estilo do currículo

Quando a pessoa envia um .docx ou PDF, o Encaixe lê a identidade visual (fonte, tamanhos do nome, dos títulos e do texto, cores, alinhamento do nome, linha abaixo dos títulos e margens) e gera o currículo ajustado com ela, sempre em uma coluna, sem tabelas nem imagens, para continuar legível pelos sistemas ATS. Cores muito claras viram preto.

- **Word (.docx):** usa exatamente o nome da fonte original.
- **PDF:** fontes comuns são trocadas por equivalentes gratuitas do [Fontsource](https://fontsource.org), carregadas do jsDelivr (ex.: Calibri → Carlito, Cambria → Caladea, Georgia → Gelasio). Sem equivalente ou sem internet, usa Helvetica, Times ou Courier conforme a família. A tabela fica em `lib/estilo.ts` (`EQUIVALENTES`).

## Como adicionar uma dica

As dicas ficam em `lib/dicas.ts`, na lista `REGRAS`. Cada regra é independente:

```ts
{
  id: "minha-regra",
  nome: "O que está sendo verificado",
  verificar: ({ texto, linhas, topicos, secoes, palavras }) =>
    condicaoOk ? null : { nivel: "sugestao", mensagem: "Como melhorar", trechos: ["trecho do currículo"] },
}
```

Devolva `null` quando estiver tudo certo. Use `nivel: "importante"` só para o que atrapalha a candidatura. As dicas nunca devem sugerir inventar informação. Acrescente um teste em `tests/estilo-e-dicas.test.ts`.

## Como adicionar uma sugestão

As sugestões ficam em `lib/sugestoes.ts`, na lista `GERADORES`. Cada gerador recebe o texto atual (já separado em linhas e seções) e devolve sugestões com `euFaria`, `porque` e as `trocas` de linhas. Elas só podem reescrever, reorganizar ou remover o que já existe: a validação anti-invenção continua valendo depois de aplicar.

## Ortografia

O dicionário de português do Brasil ([VERO](https://pt-br.libreoffice.org/projetos/vero), LGPL-3.0 ou MPL-2.0, pacote `dictionary-pt`) é copiado para `public/dicionario/` no build e baixado pelo navegador só na tela de resultado. A verificação retira prefixos e sufixos como o Hunspell, sem expandir o dicionário, e carrega em menos de meio segundo. Erros comuns que o dicionário aceita (ex.: "experiencia", que existe como verbo) e regras de escrita ficam em `lib/ortografia/erros-comuns.ts`.
