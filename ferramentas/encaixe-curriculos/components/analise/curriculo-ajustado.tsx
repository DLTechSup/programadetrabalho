"use client";

import { useState } from "react";
import {
  ArrowRight, Columns2, Copy, Download, Eye, FileText, FileType, History, Loader2, Palette, PencilLine,
  RotateCcw, TriangleAlert, Undo2,
} from "lucide-react";
import { toast } from "sonner";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { descreverEstilo, type EstiloCurriculo } from "@/lib/estilo";
import { faixaDoScore } from "@/lib/score";
import { nomeArquivo } from "@/lib/slug";
import type { AvisoRevisao } from "@/lib/tipos";
import { cn } from "@/lib/utils";
import { baixarBlob } from "./baixar-arquivo";
import { Comparador } from "./comparador";
import { PreviaDocumento } from "./previa-documento";

type Formato = "pdf" | "docx" | "txt";

const NOME_FORMATO: Record<Formato, string> = { pdf: "PDF", docx: "Word (.docx)", txt: "texto (.txt)" };

export interface PassoHistorico {
  texto: string;
  descricao: string;
}

interface Props {
  original: string;
  texto: string;
  gerado: string;
  historico: PassoHistorico[];
  onEditar: (texto: string) => void;
  onDesfazer: () => void;
  onRestaurar: () => void;
  mudancas: string[];
  avisos: AvisoRevisao[];
  cargo: string;
  estilo: EstiloCurriculo | null;
  scoreAntes: number;
  scoreDepois: number;
  onNovaAnalise: () => void;
}

const COR_FAIXA = {
  baixo: "bg-amber-50 text-warning-foreground border-warning/40",
  medio: "bg-accent/60 text-accent-foreground border-primary/30",
  alto: "bg-success/10 text-success-foreground border-success/40",
};

function Pontuacao({ rotulo, valor }: { rotulo: string; valor: number }) {
  return (
    <span className={cn("inline-flex items-baseline gap-1.5 rounded-lg border px-3 py-1.5", COR_FAIXA[faixaDoScore(valor).nivel])}>
      <span className="text-xs font-medium">{rotulo}</span>
      <span className="text-xl font-bold tabular-nums">{valor}%</span>
    </span>
  );
}

export function CurriculoAjustado(props: Props) {
  const {
    original, texto, gerado, historico, onEditar, onDesfazer, onRestaurar, mudancas, avisos, cargo, estilo,
    scoreAntes, scoreDepois, onNovaAnalise,
  } = props;
  const [baixando, setBaixando] = useState<"pdf" | "docx" | null>(null);
  const [aba, setAba] = useState("comparar");
  // Formato escolhido: abre a revisão final, onde dá para ajustar o texto antes de salvar.
  const [revisao, setRevisao] = useState<Formato | null>(null);

  async function salvar(formato: Formato) {
    if (formato === "txt") baixarTxt();
    else await baixar(formato);
    setRevisao(null);
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      toast.success("Texto copiado. Agora é só colar onde precisar.");
    } catch {
      toast.error("Não foi possível copiar. Selecione o texto e copie manualmente.");
    }
  }

  async function baixar(formato: "pdf" | "docx") {
    setBaixando(formato);
    try {
      if (formato === "pdf") {
        const { baixarPdf } = await import("./curriculo-pdf");
        await baixarPdf(texto, cargo, estilo ?? undefined);
      } else {
        const { baixarDocx } = await import("./curriculo-docx");
        await baixarDocx(texto, cargo, estilo ?? undefined);
      }
      toast.success(`${formato === "pdf" ? "PDF" : "Arquivo do Word"} baixado. Confira a pasta de downloads.`);
    } catch (e) {
      console.error(e);
      toast.error("Não foi possível gerar o arquivo. Tente novamente.");
    } finally {
      setBaixando(null);
    }
  }

  function baixarTxt() {
    baixarBlob(new Blob([texto], { type: "text/plain;charset=utf-8" }), nomeArquivo(cargo, "pdf").replace(/\.pdf$/, ".txt"));
    toast.success("Arquivo de texto baixado.");
  }

  const termos = avisos.filter((a) => a.tipo === "termo");
  const numeros = avisos.filter((a) => a.tipo === "numero");
  const formatos: Array<"pdf" | "docx"> = estilo?.origem === "docx" ? ["docx", "pdf"] : ["pdf", "docx"];

  return (
    <section aria-labelledby="titulo-ajustado" className="grid gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-primary">Etapa final</p>
          <h3 id="titulo-ajustado" tabIndex={-1} className="text-2xl font-bold outline-none">
            Seu currículo ajustado
          </h3>
        </div>
        <p className="flex items-center gap-2" aria-label={`Encaixe antes: ${scoreAntes}%. Depois: ${scoreDepois}%.`}>
          <Pontuacao rotulo="Antes" valor={scoreAntes} />
          <ArrowRight className="size-4 text-muted-foreground" aria-hidden="true" />
          <Pontuacao rotulo="Depois" valor={scoreDepois} />
        </p>
      </div>

      {avisos.length > 0 && (
        <Alert variant="warning">
          <TriangleAlert aria-hidden="true" />
          <AlertTitle>Revise estes trechos antes de enviar</AlertTitle>
          <AlertDescription>
            <p>Encontramos algo que não conseguimos confirmar no seu currículo original:</p>
            <ul className="list-disc space-y-1 pl-5">
              {termos.map((a) => (
                <li key={`t-${a.valor}`}>
                  O termo <strong>{a.valor}</strong>, que você não confirmou{a.trecho && <>: “{a.trecho}”</>}
                </li>
              ))}
              {numeros.map((a) => (
                <li key={`n-${a.valor}`}>
                  O número <strong>{a.valor}</strong>, que não aparece no original{a.trecho && <>: “{a.trecho}”</>}
                </li>
              ))}
            </ul>
            <p>Apague ou corrija o que não for verdade.</p>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Card className="gap-4 py-5">
          <CardContent className="px-4 sm:px-6">
            <Tabs value={aba} onValueChange={setAba}>
              <TabsList className="w-full sm:w-fit">
                <TabsTrigger value="comparar">
                  <Columns2 aria-hidden="true" /> Comparar
                </TabsTrigger>
                <TabsTrigger value="previa">
                  <Eye aria-hidden="true" /> Prévia
                </TabsTrigger>
                <TabsTrigger value="editar">
                  <PencilLine aria-hidden="true" /> Editar
                </TabsTrigger>
              </TabsList>
              <TabsContent value="comparar" className="pt-2">
                <Comparador original={original} atual={texto} />
              </TabsContent>
              <TabsContent value="previa" className="grid gap-3 pt-2">
                <p className="flex items-start gap-2 text-sm text-muted-foreground">
                  <Palette className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                  {estilo
                    ? `Mantendo o estilo do seu arquivo: ${descreverEstilo(estilo)}. Em uma coluna, para os sistemas ATS lerem.`
                    : "Formato padrão para ATS: uma coluna, sem cores ou tabelas. Envie o currículo como arquivo para manter o seu estilo."}
                </p>
                <PreviaDocumento texto={texto} estilo={estilo} />
              </TabsContent>
              <TabsContent value="editar" className="grid gap-2 pt-2">
                <Label htmlFor="ajustado-editor">Edite à vontade. Score, sugestões, ortografia e dicas se atualizam enquanto você escreve.</Label>
                <Textarea
                  id="ajustado-editor"
                  value={texto}
                  onChange={(e) => onEditar(e.target.value)}
                  className="h-[36rem] resize-y font-mono text-sm leading-relaxed [field-sizing:fixed]"
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <aside className="grid gap-4 lg:sticky lg:top-4" aria-label="Salvar e histórico">
          <Card className="gap-3 py-5">
            <CardHeader className="px-5">
              <CardTitle className="flex items-center gap-2 text-base">
                <Download className="size-4 text-primary" aria-hidden="true" /> Salvar currículo
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 px-5">
              {formatos.map((f, i) => (
                <Button key={f} variant={i === 0 ? "default" : "outline"} onClick={() => setRevisao(f)} disabled={!!baixando}>
                  {baixando === f ? (
                    <Loader2 className="animate-spin" aria-hidden="true" />
                  ) : f === "pdf" ? (
                    <Download aria-hidden="true" />
                  ) : (
                    <FileText aria-hidden="true" />
                  )}
                  {f === "pdf" ? "Baixar PDF" : "Baixar Word (.docx)"}
                </Button>
              ))}
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={() => setRevisao("txt")}>
                  <FileType aria-hidden="true" /> Texto (.txt)
                </Button>
                <Button variant="outline" onClick={copiar}>
                  <Copy aria-hidden="true" /> Copiar
                </Button>
              </div>
              <Button
                variant="ghost"
                onClick={() => {
                  setAba("editar");
                  requestAnimationFrame(() => document.getElementById("ajustado-editor")?.focus());
                }}
              >
                <PencilLine aria-hidden="true" /> Editar texto antes de salvar
              </Button>
              <p className="text-xs text-muted-foreground">
                Antes de salvar, você revisa e pode ajustar o texto. PDF e Word saem em uma coluna, prontos para sistemas ATS.
              </p>
            </CardContent>
          </Card>

          <Card className="gap-3 py-5">
            <CardHeader className="px-5">
              <CardTitle className="flex items-center gap-2 text-base">
                <History className="size-4 text-primary" aria-hidden="true" /> Alterações
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 px-5 text-sm">
              {historico.length === 0 ? (
                <p className="text-muted-foreground">As sugestões e correções que você aplicar aparecem aqui.</p>
              ) : (
                <ol className="grid max-h-48 gap-1.5 overflow-auto">
                  {historico.map((h, i) => (
                    <li key={i} className="flex gap-2 text-muted-foreground">
                      <span className="font-semibold text-foreground">{i + 1}.</span> {h.descricao}
                    </li>
                  ))}
                </ol>
              )}
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={onDesfazer} disabled={historico.length === 0}>
                  <Undo2 aria-hidden="true" /> Desfazer última
                </Button>
                <Button size="sm" variant="ghost" onClick={onRestaurar} disabled={texto === gerado && historico.length === 0}>
                  <RotateCcw aria-hidden="true" /> Voltar ao gerado
                </Button>
              </div>
            </CardContent>
          </Card>

          {mudancas.length > 0 && (
            <Card className="py-2">
              <CardContent className="px-5">
                <Accordion type="single" collapsible>
                  <AccordionItem value="mudancas" className="border-b-0">
                    <AccordionTrigger>O que ajustamos automaticamente ({mudancas.length})</AccordionTrigger>
                    <AccordionContent>
                      <ul className="list-disc space-y-1.5 pl-5 text-muted-foreground">
                        {mudancas.map((m) => (
                          <li key={m}>{m}</li>
                        ))}
                      </ul>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </CardContent>
            </Card>
          )}

          <Button variant="ghost" onClick={onNovaAnalise} className="justify-self-start">
            <RotateCcw aria-hidden="true" /> Começar nova análise
          </Button>
        </aside>
      </div>
      <Dialog open={revisao !== null} onOpenChange={(aberto) => !aberto && setRevisao(null)}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Revisão final antes de salvar</DialogTitle>
            <DialogDescription>
              Confira o texto e ajuste o que quiser. O arquivo em {revisao ? NOME_FORMATO[revisao] : ""} é gerado com esta versão.
            </DialogDescription>
          </DialogHeader>
          <Label htmlFor="revisao-final" className="sr-only">
            Texto final do currículo
          </Label>
          <Textarea
            id="revisao-final"
            value={texto}
            onChange={(e) => onEditar(e.target.value)}
            className="h-[50dvh] resize-y text-sm leading-relaxed [field-sizing:fixed]"
          />
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground" aria-live="polite">
            <Pontuacao rotulo="Encaixe" valor={scoreDepois} />
            {avisos.length > 0 ? (
              <span className="flex items-center gap-1.5 text-warning-foreground">
                <TriangleAlert className="size-4" aria-hidden="true" />
                {avisos.length} trecho(s) para revisar: algo que não estava no seu currículo original.
              </span>
            ) : (
              <span>Nada inventado encontrado.</span>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevisao(null)}>
              Continuar editando depois
            </Button>
            <Button onClick={() => revisao && salvar(revisao)} disabled={!!baixando}>
              {baixando ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Download aria-hidden="true" />}
              Salvar {revisao ? NOME_FORMATO[revisao] : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
