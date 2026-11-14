import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const ETAPAS = ["Vaga", "Currículo", "Resultado"];

export function IndicadorEtapas({ atual }: { atual: number }) {
  return (
    <nav aria-label="Progresso da análise">
      <ol className="grid grid-cols-3 gap-2 rounded-2xl border bg-white/80 p-2 shadow-xs backdrop-blur">
        {ETAPAS.map((nome, i) => {
          const numero = i + 1;
          const concluida = numero < atual;
          const ativa = numero === atual;
          return (
            <li
              key={nome}
              aria-current={ativa ? "step" : undefined}
              className={cn(
                "flex items-center gap-2 rounded-xl px-2 py-2 sm:gap-3 sm:px-3",
                ativa && "bg-accent/70"
              )}
            >
              <span
                className={cn(
                  "grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold",
                  ativa && "bg-primary text-primary-foreground shadow-md shadow-primary/30",
                  concluida && "bg-primary/15 text-primary",
                  !ativa && !concluida && "border bg-white text-muted-foreground"
                )}
              >
                {concluida ? <Check className="size-4" aria-hidden="true" /> : numero}
              </span>
              <span className="min-w-0 leading-tight">
                <span className="block text-xs text-muted-foreground">Etapa {numero}</span>
                <span className={cn("block truncate text-sm", ativa ? "font-semibold text-foreground" : "text-muted-foreground")}>
                  {nome}
                </span>
                {concluida && <span className="sr-only"> (concluída)</span>}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
