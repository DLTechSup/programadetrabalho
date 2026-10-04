import type { Api } from "./types";
import { criarApiDemo } from "./demo";

declare global {
  interface Window {
    api?: Omit<Api, "demo">;
  }
}

/** No app instalado usa o motor real; no navegador / fora do Windows usa dados de demonstração. */
export async function criarApi(): Promise<Api> {
  if (window.api) {
    const real = window.api;
    const info = await real.info();
    if (info.plataforma === "win32") return { ...real, demo: false } as Api;
  }
  return criarApiDemo();
}
