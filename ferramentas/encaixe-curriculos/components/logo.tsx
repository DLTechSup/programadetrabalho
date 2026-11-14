import { cn } from "@/lib/utils";

/** Marca do Encaixe: um "E" em peça de encaixe. */
export function Logo({ className, claro = false }: { className?: string; claro?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span
        aria-hidden="true"
        className={cn(
          "grid size-8 place-items-center rounded-lg text-base font-extrabold shadow-sm",
          claro ? "bg-white text-primary" : "bg-gradient-to-br from-primary to-teal-500 text-white"
        )}
      >
        E
      </span>
      <span className={cn("text-xl font-bold tracking-tight", claro ? "text-white" : "text-foreground")}>Encaixe</span>
    </span>
  );
}
