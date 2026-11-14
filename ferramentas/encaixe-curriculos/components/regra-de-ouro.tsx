import { ShieldCheck } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { REGRA_DE_OURO } from "@/lib/constantes";
import { cn } from "@/lib/utils";

export function RegraDeOuro({ className }: { className?: string }) {
  return (
    <Alert variant="info" role="note" className={cn("shadow-xs", className)}>
      <ShieldCheck aria-hidden="true" />
      <AlertTitle>Regra de ouro</AlertTitle>
      <AlertDescription>
        <p>{REGRA_DE_OURO}</p>
      </AlertDescription>
    </Alert>
  );
}
