import { cn } from "@/lib/utils";

/** Mostra quantos caracteres o texto tem e, se houver mínimo, se ele foi atingido. */
export function Contador({ id, atual, minimo }: { id: string; atual: number; minimo?: number }) {
  if (minimo === undefined) {
    return (
      <p id={id} className="text-sm text-muted-foreground">
        {atual.toLocaleString("pt-BR")} caracteres
      </p>
    );
  }
  const ok = atual >= minimo;
  return (
    <p id={id} className={cn("text-sm", ok ? "text-success-foreground" : "text-muted-foreground")}>
      {atual.toLocaleString("pt-BR")} caracteres
      {ok ? " — ok" : ` (mínimo de ${minimo})`}
    </p>
  );
}
