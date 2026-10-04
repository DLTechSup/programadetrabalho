import type { Fase } from "../assistente";

const ROTULO: Record<Fase, string> = {
  desligado: "Escuta desligada",
  carregando: "Carregando a voz…",
  dormindo: "Aguardando",
  ouvindo: "Ouvindo",
  escolhendo: "Aguardando sua escolha",
  nome: "Qual será o novo nome?",
  processando: "Entendendo…",
  falando: "Falando",
};

/** Indicador circular do estado do assistente; o brilho acompanha o volume da voz captada. */
export function Orbe({ fase, nivel, falando }: { fase: Fase; nivel: number; falando: boolean }) {
  const escala = 1 + Math.min(0.35, nivel * 6);
  return (
    <div className={`orbe fase-${fase}${falando ? " captando" : ""}`}>
      <div className="orbe-anel a1" />
      <div className="orbe-anel a2" />
      <div className="orbe-nucleo" style={{ transform: `scale(${escala})` }} />
      <span className="orbe-rotulo">{ROTULO[fase]}</span>
    </div>
  );
}
