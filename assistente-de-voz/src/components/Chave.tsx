export function Chave({ ligado, onChange, rotulo }: { ligado: boolean; onChange: (v: boolean) => void; rotulo?: string }) {
  return (
    <button type="button" role="switch" aria-checked={ligado} aria-label={rotulo} className={`chave${ligado ? " on" : ""}`} onClick={() => onChange(!ligado)}>
      <span />
    </button>
  );
}
