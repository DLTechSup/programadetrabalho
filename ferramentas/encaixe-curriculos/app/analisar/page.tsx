import type { Metadata } from "next";
import { FluxoAnalise } from "@/components/analise/fluxo-analise";

export const metadata: Metadata = {
  title: "Analisar currículo — Encaixe",
};

export default function PaginaAnalisar() {
  return <FluxoAnalise />;
}
