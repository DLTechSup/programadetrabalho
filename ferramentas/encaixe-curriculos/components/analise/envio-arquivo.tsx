"use client";

import { useRef, useState } from "react";
import { CheckCircle2, FileUp, Loader2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ErroLeitura, TIPOS_ACEITOS, lerCurriculoDeArquivo } from "@/lib/ler-arquivo";
import { descreverEstilo, type EstiloCurriculo } from "@/lib/estilo";
import { cn } from "@/lib/utils";

interface Props {
  onArquivo: (texto: string, estilo: EstiloCurriculo | null) => void;
}

/** Envio do currículo em PDF, Word (.docx) ou .txt. O arquivo é lido no navegador. */
export function EnvioArquivo({ onArquivo }: Props) {
  const entrada = useRef<HTMLInputElement>(null);
  const [lendo, setLendo] = useState(false);
  const [arrastando, setArrastando] = useState(false);
  const [lido, setLido] = useState("");
  const [estiloLido, setEstiloLido] = useState<EstiloCurriculo | null>(null);
  const [erro, setErro] = useState("");

  async function processar(arquivo: File | undefined) {
    if (!arquivo) return;
    setLendo(true);
    setErro("");
    setLido("");
    try {
      const { texto, estilo } = await lerCurriculoDeArquivo(arquivo);
      onArquivo(texto, estilo);
      setLido(arquivo.name);
      setEstiloLido(estilo);
    } catch (e) {
      if (!(e instanceof ErroLeitura)) console.error(e);
      setErro(
        e instanceof ErroLeitura
          ? e.message
          : "Não conseguimos ler esse arquivo. Tente outro formato ou cole o texto abaixo."
      );
    } finally {
      setLendo(false);
      if (entrada.current) entrada.current.value = "";
    }
  }

  return (
    <div className="grid gap-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setArrastando(true);
        }}
        onDragLeave={() => setArrastando(false)}
        onDrop={(e) => {
          e.preventDefault();
          setArrastando(false);
          processar(e.dataTransfer.files[0]);
        }}
        className={cn(
          "flex flex-col items-center gap-3 rounded-xl border-2 border-dashed bg-white px-4 py-8 text-center transition-colors",
          arrastando ? "border-primary bg-accent/40" : "border-input"
        )}
      >
        <FileUp className="size-8 text-primary" aria-hidden="true" />
        <div>
          <p className="font-medium">Envie seu currículo</p>
          <p id="formatos-arquivo" className="text-sm text-muted-foreground">
            PDF, Word (.docx) ou .txt, até 10 MB. Você também pode arrastar o arquivo para cá.
          </p>
        </div>
        <input
          ref={entrada}
          id="arquivo-curriculo"
          type="file"
          accept={TIPOS_ACEITOS}
          className="sr-only"
          aria-describedby="formatos-arquivo"
          onChange={(e) => processar(e.target.files?.[0])}
          disabled={lendo}
        />
        <Button type="button" onClick={() => entrada.current?.click()} disabled={lendo}>
          {lendo ? <Loader2 className="animate-spin" aria-hidden="true" /> : <FileUp aria-hidden="true" />}
          {lendo ? "Lendo o arquivo…" : "Escolher arquivo"}
        </Button>
        <p className="text-xs text-muted-foreground">O arquivo é lido aqui no seu navegador e não é enviado para lugar nenhum.</p>
      </div>

      <div aria-live="polite">
        {lido && (
          <p className="flex items-start gap-2 text-sm text-success-foreground">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>
              Lemos o arquivo <strong className="break-all">{lido}</strong>. Confira o texto abaixo e ajuste se precisar.
              {estiloLido && (
                <> O currículo ajustado vai manter o estilo do seu arquivo ({descreverEstilo(estiloLido)}).</>
              )}
            </span>
          </p>
        )}
        {erro && (
          <Alert variant="warning">
            <TriangleAlert aria-hidden="true" />
            <AlertDescription>
              <p>{erro}</p>
            </AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );
}
