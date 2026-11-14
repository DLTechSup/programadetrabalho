import Link from "next/link";
import {
  ArrowRight, Check, ClipboardPaste, FileCheck2, FileSearch, FileText, Lock, Palette, ScanText, ShieldCheck,
  Sparkles, SpellCheck, Target, Upload, Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { IlustracaoHero } from "@/components/home/ilustracao-hero";
import { AVISO_PRIVACIDADE, REGRA_DE_OURO } from "@/lib/constantes";

const PASSOS = [
  { icone: ClipboardPaste, titulo: "Cole a vaga", texto: "Copie o texto da vaga, com atividades e requisitos, e cole no Encaixe. Identificamos os requisitos obrigatórios e os desejáveis." },
  { icone: Upload, titulo: "Envie seu currículo", texto: "Envie o arquivo em PDF ou Word, ou cole o texto. Mostramos seu encaixe e as palavras-chave que faltam." },
  { icone: FileCheck2, titulo: "Receba a versão ajustada", texto: "Aprove as sugestões que fizerem sentido, compare o antes e depois e baixe em PDF ou Word." },
];

const RECURSOS = [
  { icone: Target, titulo: "Encaixe com a vaga", texto: "Um percentual claro de quanto seu currículo fala a língua da vaga, com peso maior para os requisitos obrigatórios." },
  { icone: ScanText, titulo: "Palavras-chave", texto: "Veja o que a vaga pede, o que você já tem e o que falta, separado por técnicas, ferramentas, comportamentais e idiomas." },
  { icone: Sparkles, titulo: "Sugestões comentadas", texto: "“Eu faria isso, porque…”: cada sugestão explica o motivo. Você aplica só as que concordar, com um clique." },
  { icone: SpellCheck, titulo: "Ortografia e escrita", texto: "Aponta palavras erradas, acentos, crase e confusões como “mas” e “mais”, com a correção pronta." },
  { icone: Palette, titulo: "Mantém o seu estilo", texto: "O arquivo final segue a fonte, as cores e os tamanhos do seu currículo, em uma coluna que os sistemas conseguem ler." },
  { icone: FileSearch, titulo: "Antes e depois", texto: "Um visualizador mostra linha a linha o que mudou. Desfaça qualquer alteração e salve em PDF, Word ou texto." },
];

const MOTIVOS = [
  { titulo: "Vocabulário diferente", texto: "O sistema procura os termos da vaga. Se você escreveu “planilhas” e a vaga pede “Excel”, pode ficar de fora." },
  { titulo: "Formatação ilegível", texto: "Colunas, tabelas, ícones e textos em imagem confundem a leitura automática e partes do currículo se perdem." },
  { titulo: "Erros de português", texto: "Uma palavra errada passa uma impressão de descuido justamente quando o recrutador finalmente lê seu currículo." },
];

const PERGUNTAS = [
  { p: "O que é um ATS?", r: "É o sistema que muitas empresas usam para receber candidaturas. Ele lê os currículos, compara com a vaga e ajuda a filtrar quem segue para o RH. Currículos com o vocabulário da vaga e formatação simples são lidos melhor." },
  { p: "O Encaixe é gratuito? Preciso me cadastrar?", r: "É gratuito e não tem cadastro. Você abre o site e usa." },
  { p: "O Encaixe inventa informações no meu currículo?", r: "Nunca. Ele reescreve e organiza o que você já tem. Um requisito que falta só entra se você confirmar que tem e contar onde usou. Números, datas, empresas e cargos são sempre os seus." },
  { p: "Meus dados ficam salvos em algum lugar?", r: "Não. A análise acontece no seu navegador. Nada é enviado para um servidor ou guardado; ao recarregar a página, tudo some." },
  { p: "Quais formatos posso enviar e baixar?", r: "Você pode enviar PDF, Word (.docx) ou texto, ou colar o conteúdo. O currículo ajustado pode ser baixado em PDF, Word ou texto." },
  { p: "Funciona para qualquer área?", r: "Sim. O Encaixe reconhece termos de tecnologia, administração, finanças, RH, vendas, marketing, logística, indústria, saúde, jurídico, educação e mais, além do que estiver escrito na própria vaga." },
];

export default function Inicio() {
  return (
    <>
      {/* Hero */}
      <section className="fundo-hero relative overflow-hidden">
        <div className="fundo-pontos pointer-events-none absolute inset-0 [mask-image:linear-gradient(to_bottom,black,transparent_70%)]" aria-hidden="true" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-4 pt-14 pb-20 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:pt-20 lg:pb-28">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-white/70 px-3 py-1 text-sm font-medium text-accent-foreground shadow-xs">
              <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
              Grátis · Sem cadastro · {AVISO_PRIVACIDADE.replace(".", "")}
            </p>
            <h1 className="mt-6 text-balance text-4xl leading-[1.08] font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
              Faça seu currículo passar pelo <span className="texto-gradiente">filtro da vaga</span>
            </h1>
            <p className="mt-6 max-w-xl text-pretty text-lg text-muted-foreground">
              Muitas empresas usam um ATS, um sistema que lê os currículos e descarta os que não usam as palavras da
              vaga antes de alguém do RH ver. O Encaixe mostra o que falta e ajusta o seu, sem inventar nada.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="h-13 px-7 text-base shadow-lg shadow-primary/20">
                <Link href="/analisar">
                  Começar análise
                  <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-13 bg-white/70 px-7 text-base">
                <Link href="#como-funciona">Como funciona</Link>
              </Button>
            </div>
            <ul className="mt-8 grid gap-2 text-sm text-muted-foreground sm:grid-cols-3">
              {["Pronto para sistemas ATS", "PDF e Word", "Mantém o seu estilo"].map((t) => (
                <li key={t} className="flex items-center gap-2">
                  <Check className="size-4 text-primary" aria-hidden="true" /> {t}
                </li>
              ))}
            </ul>
            <div className="mt-8 flex max-w-xl gap-3 rounded-xl border border-primary/20 bg-white/80 p-4 text-sm shadow-xs" role="note">
              <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
              <p>
                <strong className="font-semibold">Regra de ouro:</strong>{" "}
                <span className="text-muted-foreground">{REGRA_DE_OURO}</span>
              </p>
            </div>
          </div>
          <div className="pb-16 lg:pb-8">
            <IlustracaoHero />
          </div>
        </div>
      </section>

      {/* Por que currículos são descartados */}
      <section className="border-y bg-white" aria-labelledby="titulo-motivos">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 id="titulo-motivos" className="max-w-2xl text-2xl font-bold sm:text-3xl">
            Currículos bons ficam de fora por motivos que dá para corrigir
          </h2>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {MOTIVOS.map((m, i) => (
              <div key={m.titulo} className="grid content-start gap-2">
                <span className="text-sm font-bold text-primary">0{i + 1}</span>
                <h3 className="text-lg font-semibold">{m.titulo}</h3>
                <p className="text-muted-foreground">{m.texto}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Como funciona */}
      <section id="como-funciona" aria-labelledby="titulo-como-funciona" className="scroll-mt-20">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <p className="text-center text-sm font-semibold text-primary">Em 3 passos</p>
          <h2 id="titulo-como-funciona" className="mt-2 text-center text-3xl font-bold sm:text-4xl">
            Como funciona
          </h2>
          <ol className="relative mt-12 grid gap-6 md:grid-cols-3">
            <span className="absolute top-7 right-[16%] left-[16%] hidden h-px bg-gradient-to-r from-primary/10 via-primary/40 to-primary/10 md:block" aria-hidden="true" />
            {PASSOS.map((p, i) => (
              <li key={p.titulo} className="relative grid justify-items-center gap-3 text-center">
                <span className="relative grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-primary to-teal-500 text-white shadow-lg shadow-primary/25">
                  <p.icone className="size-6" aria-hidden="true" />
                  <span className="absolute -top-2 -right-2 grid size-6 place-items-center rounded-full bg-white text-xs font-bold text-primary shadow">
                    {i + 1}
                  </span>
                </span>
                <h3 className="text-lg font-semibold">
                  <span className="sr-only">{i + 1}. </span>
                  {p.titulo}
                </h3>
                <p className="max-w-xs text-muted-foreground">{p.texto}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Recursos */}
      <section id="recursos" aria-labelledby="titulo-recursos" className="scroll-mt-20 bg-muted/60">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <p className="text-sm font-semibold text-primary">Tudo o que você precisa</p>
          <h2 id="titulo-recursos" className="mt-2 max-w-2xl text-3xl font-bold sm:text-4xl">
            Um currículo mais forte, sem perder o que é seu
          </h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {RECURSOS.map((r) => (
              <div key={r.titulo} className="group rounded-2xl border bg-white p-6 transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
                <span className="grid size-11 place-items-center rounded-xl bg-accent text-accent-foreground transition group-hover:bg-primary group-hover:text-white">
                  <r.icone className="size-5" aria-hidden="true" />
                </span>
                <h3 className="mt-4 text-lg font-semibold">{r.titulo}</h3>
                <p className="mt-2 text-muted-foreground">{r.texto}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Privacidade e regra de ouro */}
      <section aria-label="Compromissos" className="mx-auto grid max-w-6xl gap-4 px-4 py-20 sm:px-6 md:grid-cols-2">
        <div className="rounded-2xl bg-tinta p-8 text-teal-50">
          <ShieldCheck className="size-8 text-teal-300" aria-hidden="true" />
          <h2 className="mt-4 text-2xl font-bold text-white">Nada é inventado</h2>
          <p className="mt-3 text-teal-100/90">{REGRA_DE_OURO}</p>
          <p className="mt-3 text-teal-100/90">
            Um requisito que falta só entra se você confirmar e contar onde usou. E antes de você baixar, conferimos se
            nada novo apareceu sem a sua confirmação.
          </p>
        </div>
        <div className="rounded-2xl border bg-white p-8">
          <Lock className="size-8 text-primary" aria-hidden="true" />
          <h2 className="mt-4 text-2xl font-bold">Seu currículo não sai do seu computador</h2>
          <p className="mt-3 text-muted-foreground">
            A leitura do arquivo, a análise, as sugestões, a revisão de ortografia e o PDF acontecem no seu navegador.
            Não há cadastro, banco de dados nem envio para servidores. {AVISO_PRIVACIDADE}
          </p>
        </div>
      </section>

      {/* Perguntas */}
      <section id="perguntas" aria-labelledby="titulo-perguntas" className="scroll-mt-20 border-t bg-white">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[1fr_1.6fr]">
          <div>
            <p className="text-sm font-semibold text-primary">Perguntas frequentes</p>
            <h2 id="titulo-perguntas" className="mt-2 text-3xl font-bold sm:text-4xl">Ficou alguma dúvida?</h2>
            <p className="mt-4 text-muted-foreground">O essencial sobre como o Encaixe trata o seu currículo.</p>
          </div>
          <Accordion type="single" collapsible className="rounded-2xl border px-6">
            {PERGUNTAS.map((q) => (
              <AccordionItem key={q.p} value={q.p}>
                <AccordionTrigger className="text-base">{q.p}</AccordionTrigger>
                <AccordionContent className="text-base text-muted-foreground">{q.r}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* Chamada final */}
      <section className="px-4 pb-20 sm:px-6">
        <div className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-teal-700 to-tinta px-6 py-14 text-center text-white sm:px-12">
          <div className="fundo-pontos absolute inset-0 opacity-30" aria-hidden="true" />
          <div className="relative">
            <Wand2 className="mx-auto size-9 text-teal-200" aria-hidden="true" />
            <h2 className="mx-auto mt-4 max-w-2xl text-balance text-3xl font-bold sm:text-4xl">
              Seu próximo currículo pode chegar até o RH
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-teal-50/90">
              Leva poucos minutos. Você vê o que falta, aprova as mudanças e baixa pronto para enviar.
            </p>
            <Button asChild size="lg" variant="secondary" className="mt-8 h-13 bg-white px-8 text-base text-primary hover:bg-teal-50">
              <Link href="/analisar">
                Começar análise
                <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
            <p className="mt-4 flex items-center justify-center gap-1.5 text-sm text-teal-100/90">
              <FileText className="size-4" aria-hidden="true" /> PDF, Word ou texto
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
