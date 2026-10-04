import { useEffect, type ReactNode } from "react";

interface Props {
  titulo: string;
  children: ReactNode;
  rodape: ReactNode;
  onFechar: () => void;
  largura?: number;
}

export function Modal({ titulo, children, rodape, onFechar, largura }: Props) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onFechar();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onFechar]);

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onFechar()}>
      <div className="card modal" role="dialog" aria-modal="true" aria-label={titulo} style={largura ? { width: largura } : undefined}>
        <div className="modal-head"><h2>{titulo}</h2></div>
        <div className="modal-body">{children}</div>
        <div className="modal-foot">{rodape}</div>
      </div>
    </div>
  );
}
