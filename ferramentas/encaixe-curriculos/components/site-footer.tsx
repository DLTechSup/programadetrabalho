import Link from "next/link";
import { Lock, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/logo";
import { AVISO_PRIVACIDADE, REGRA_DE_OURO } from "@/lib/constantes";

export function SiteFooter() {
  return (
    <footer className="mt-auto bg-tinta text-teal-50">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="grid content-start gap-4">
          <Logo claro />
          <p className="max-w-sm text-sm text-teal-100/90">
            Ajuda profissionais de qualquer área a colocar o currículo na língua da vaga, sem inventar nada.
          </p>
        </div>
        <nav aria-label="Rodapé" className="grid content-start gap-2 text-sm">
          <p className="font-semibold text-white">Encaixe</p>
          <Link className="text-teal-100/90 hover:text-white" href="/analisar">Analisar currículo</Link>
          <Link className="text-teal-100/90 hover:text-white" href="/#como-funciona">Como funciona</Link>
          <Link className="text-teal-100/90 hover:text-white" href="/#recursos">Recursos</Link>
          <Link className="text-teal-100/90 hover:text-white" href="/#perguntas">Perguntas frequentes</Link>
        </nav>
        <div className="grid content-start gap-3 text-sm">
          <p className="font-semibold text-white">Privacidade</p>
          <p className="flex gap-2 text-teal-100/90">
            <Lock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>{AVISO_PRIVACIDADE} Tudo roda no seu navegador e some ao recarregar a página.</span>
          </p>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto grid max-w-6xl gap-3 px-4 py-6 text-sm sm:px-6">
          <p className="flex gap-2 text-teal-50">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-teal-300" aria-hidden="true" />
            <span>
              <strong className="font-semibold text-white">Regra de ouro:</strong> {REGRA_DE_OURO}
            </span>
          </p>
          <p className="text-teal-100/70">© {new Date().getFullYear()} Encaixe</p>
        </div>
      </div>
    </footer>
  );
}
