import Link from "next/link";
import { ArrowRight, House } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";

const LINKS = [
  { href: "/", rotulo: "Início" },
  { href: "/#como-funciona", rotulo: "Como funciona" },
  { href: "/#recursos", rotulo: "Recursos" },
  { href: "/#perguntas", rotulo: "Perguntas" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/65">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" aria-label="Encaixe, página inicial" className="rounded-lg outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
          <Logo />
        </Link>
        <nav aria-label="Principal" className="flex items-center gap-1 sm:gap-2">
          {LINKS.map((l, i) => (
            <Link
              key={l.href}
              href={l.href}
              className={
                "items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 " +
                (i > 1 ? "hidden md:inline-flex" : "inline-flex")
              }
            >
              {i === 0 && <House className="size-4" aria-hidden="true" />}
              {l.rotulo}
            </Link>
          ))}
          <Button asChild size="sm" className="ml-1 hidden sm:inline-flex">
            <Link href="/analisar">
              Analisar currículo
              <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}
