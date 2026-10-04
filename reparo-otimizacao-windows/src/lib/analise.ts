import type { Diagnostico, ItemInicializacao, ItemLimpeza } from "../api/types";
import { LIMPEZAS, PREFIXO_LIMPEZA } from "./catalogo";
import { bytes as fmt } from "./format";

export type Severidade = "critico" | "atencao" | "info";

export interface Problema {
  id: string;
  area: "Disco" | "Memória" | "Lentidão" | "Pastas" | "Internet" | "Segurança" | "Hardware";
  severidade: Severidade;
  titulo: string;
  detalhe: string;
  /** tarefas que corrigem (vazio = só orientação manual) */
  ids: string[];
  /** vem marcado por padrão? (itens opcionais/arriscados vêm desmarcados) */
  padrao: boolean;
  /** espaço que será liberado, quando se aplica */
  liberavel?: number;
  /** orientação para quando não dá para resolver por software */
  manual?: string;
}

export const GUID_ALTO_DESEMPENHO = "8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c";
const GB = 1024 ** 3;
const DNS_PUBLICOS = ["1.1.1.1", "1.0.0.1", "8.8.8.8", "8.8.4.4", "9.9.9.9"];

const PESO: Record<Severidade, number> = { critico: 22, atencao: 10, info: 3 };

export function pontuacao(problemas: Problema[]): number {
  return Math.max(5, 100 - problemas.reduce((s, p) => s + PESO[p.severidade], 0));
}

export function rotuloNota(n: number): string {
  if (n >= 90) return "Ótimo";
  if (n >= 70) return "Bom";
  if (n >= 45) return "Precisa de atenção";
  return "Crítico";
}

export function liberavelPadrao(limpeza: ItemLimpeza[]): { ids: string[]; bytes: number } {
  const padrao = new Set(LIMPEZAS.filter((l) => l.padrao).map((l) => l.id));
  const ativos = limpeza.filter((i) => padrao.has(i.id) && (i.bytes ?? 0) > 0);
  return { ids: ativos.map((i) => PREFIXO_LIMPEZA + i.id), bytes: ativos.reduce((s, i) => s + (i.bytes ?? 0), 0) };
}

/** Transforma os dados coletados em uma lista de problemas com a correção de cada um. */
export function analisar(d: Diagnostico, limpeza: ItemLimpeza[], inicio: ItemInicializacao[] = []): Problema[] {
  const p: Problema[] = [];
  const fraco = d.ramTotal > 0 && d.ramTotal <= 8 * GB;
  const hdd = d.tipoDisco === "HDD";
  const livrePct = d.discoTotal > 0 ? (d.discoLivre / d.discoTotal) * 100 : 100;
  const lixo = liberavelPadrao(limpeza);

  // ---- disco
  if (livrePct < 20 || lixo.bytes >= 500 * 1024 ** 2) {
    const sev: Severidade = livrePct < 10 ? "critico" : livrePct < 20 ? "atencao" : "info";
    const titulo = livrePct < 10 ? "Disco C: quase cheio" : livrePct < 20 ? "Pouco espaço livre no disco C:" : "Arquivos descartáveis ocupando espaço";
    if (lixo.bytes > 0) {
      p.push({
        id: "lixo", area: "Disco", severidade: sev, titulo,
        detalhe: `Só ${fmt(d.discoLivre)} livres (${livrePct.toFixed(0)}%). Dá para liberar ${fmt(lixo.bytes)} com segurança (temporários, caches, relatórios de erro, lixeira).`,
        ids: lixo.ids, padrao: true, liberavel: lixo.bytes,
      });
    } else {
      p.push({
        id: "lixo", area: "Disco", severidade: sev, titulo,
        detalhe: `Só ${fmt(d.discoLivre)} livres (${livrePct.toFixed(0)}%) e não há lixo suficiente para limpar.`,
        ids: [], padrao: false, manual: "Use a aba Espaço em disco para achar pastas e arquivos grandes (vídeos, instaladores, ISOs) e decidir o que remover ou mover para um HD externo.",
      });
    }
  }
  const old = limpeza.find((i) => i.id === "windows_old");
  if (old && (old.bytes ?? 0) > GB) {
    p.push({ id: "windows_old", area: "Disco", severidade: "info", titulo: "Instalação antiga do Windows (Windows.old)", detalhe: `Ocupa ${fmt(old.bytes)}. Só apague se o computador está funcionando bem desde a última atualização.`, ids: [PREFIXO_LIMPEZA + "windows_old"], padrao: false, liberavel: old.bytes ?? 0 });
  }
  const hib = limpeza.find((i) => i.id === "hibernacao");
  if (hib && (hib.bytes ?? 0) > GB && !d.notebook) {
    p.push({ id: "hibernacao", area: "Disco", severidade: "info", titulo: "Arquivo de hibernação grande", detalhe: `O hiberfil.sys ocupa ${fmt(hib.bytes)}. Em computadores de mesa que não hibernam pode ser desativado.`, ids: [PREFIXO_LIMPEZA + "hibernacao"], padrao: false, liberavel: hib.bytes ?? 0 });
  }
  if (/warning|unhealthy/i.test(d.saudeDisco)) {
    p.push({ id: "saude_disco", area: "Hardware", severidade: "critico", titulo: "O disco informa problemas de saúde", detalhe: `Estado do disco: ${d.saudeDisco}.`, ids: ["chkdsk_scan"], padrao: true, manual: "Faça backup dos arquivos do cliente imediatamente e avise que o disco pode precisar ser trocado." });
  }

  // ---- memória
  const usoRam = d.ramTotal > 0 ? ((d.ramTotal - d.ramLivre) / d.ramTotal) * 100 : 0;
  if (usoRam >= 85) {
    p.push({ id: "ram_alta", area: "Memória", severidade: usoRam >= 93 ? "critico" : "atencao", titulo: "Memória RAM quase toda em uso", detalhe: `${usoRam.toFixed(0)}% de ${fmt(d.ramTotal)} em uso agora.`, ids: ["liberar_memoria", "inicializacao_pesados"], padrao: true });
  }
  if (d.ramTotal > 0 && d.ramTotal <= 4.2 * GB) {
    p.push({ id: "ram_pouca", area: "Memória", severidade: "atencao", titulo: `Pouca memória instalada (${fmt(d.ramTotal, 0)})`, detalhe: "Com 4 GB ou menos, o Windows 10/11 fica lento ao abrir navegador e outros programas juntos.", ids: ["apps_segundo_plano"], padrao: true, manual: "Recomende aumentar para 8 GB ou mais: é a melhoria mais barata e efetiva neste caso." });
  }
  if (!d.pagefileAutomatico) {
    p.push({ id: "pagefile", area: "Memória", severidade: "atencao", titulo: "Memória virtual com tamanho fixo", detalhe: "O arquivo de paginação foi configurado manualmente e pode estar pequeno, causando travamentos por falta de memória.", ids: ["pagefile_auto"], padrao: true });
  }

  // ---- lentidão
  if (hdd) {
    p.push({
      id: "hdd", area: "Hardware", severidade: "atencao", titulo: "O Windows está instalado em um HD (disco mecânico)",
      detalhe: "HDs são a principal causa de lentidão em computadores antigos.",
      ids: /Running/i.test(d.servicos.SysMain || "") ? ["sysmain_hdd"] : [], padrao: true,
      manual: "Trocar por um SSD é o ganho de velocidade mais impressionante possível (o computador pode ficar de 3 a 5 vezes mais rápido).",
    });
  }
  const ativosSugeridos = inicio.filter((i) => i.ativo && i.sugerido);
  const ativos = inicio.filter((i) => i.ativo).length;
  if (ativosSugeridos.length > 0) {
    p.push({ id: "inicio", area: "Lentidão", severidade: ativosSugeridos.length >= 3 ? "atencao" : "info", titulo: `${ativosSugeridos.length} programa(s) desnecessário(s) abrindo com o Windows`, detalhe: `${ativosSugeridos.slice(0, 5).map((i) => i.nome).join(", ")}${ativosSugeridos.length > 5 ? "…" : ""} (${ativos} itens no total na inicialização).`, ids: ["inicializacao_pesados"], padrao: true });
  }
  if (d.planoEnergia && d.planoEnergia !== GUID_ALTO_DESEMPENHO) {
    p.push({ id: "energia", area: "Lentidão", severidade: "info", titulo: "Plano de energia não está em Alto desempenho", detalhe: d.notebook ? "Em notebooks isso reduz a bateria; aplique se o cliente usa mais na tomada." : "O processador pode estar sendo limitado para economizar energia.", ids: ["energia_alto_desempenho"], padrao: !d.notebook });
  }
  if (d.transparencia) {
    p.push({ id: "visuais", area: "Lentidão", severidade: "info", titulo: "Efeitos visuais e transparência ativos", detalhe: "Consomem placa de vídeo e memória; desligar ajuda em computadores mais fracos.", ids: ["efeitos_visuais"], padrao: fraco || hdd });
  }
  if (/Running/i.test(d.servicos.DiagTrack || "")) {
    p.push({ id: "telemetria", area: "Lentidão", severidade: "info", titulo: "Serviço de telemetria do Windows em execução", detalhe: "Lê o disco e usa processador em segundo plano, sentido principalmente em HDs.", ids: ["desativar_telemetria"], padrao: fraco || hdd });
  }
  if (!d.appsSegundoPlanoBloqueados && fraco) {
    p.push({ id: "segundo_plano", area: "Lentidão", severidade: "info", titulo: "Aplicativos rodando em segundo plano", detalhe: "Aplicativos da Microsoft Store continuam consumindo memória mesmo fechados.", ids: ["apps_segundo_plano"], padrao: true });
  }
  if (d.cpuUso >= 85) {
    p.push({ id: "cpu", area: "Lentidão", severidade: "atencao", titulo: `Processador em ${d.cpuUso}% agora`, detalhe: "Algum programa está usando quase todo o processador.", ids: ["defender_rapido"], padrao: false, manual: "Veja na aba Memória quais programas estão pesados. Se for desconhecido, pode ser vírus ou minerador." });
  }
  if (d.uptimeDias >= 7) {
    p.push({ id: "uptime", area: "Lentidão", severidade: d.uptimeDias >= 14 ? "atencao" : "info", titulo: `Computador ligado há ${Math.floor(d.uptimeDias)} dias sem reiniciar`, detalhe: "Com o tempo o Windows acumula lentidão e atualizações pendentes.", ids: [], padrao: false, manual: "Reinicie o computador (não use apenas \"Desligar\" se a Inicialização rápida estiver ativa: use Reiniciar)." });
  }

  // ---- pastas
  if (!d.explorerAbreEmEsteComputador) {
    p.push({ id: "pastas", area: "Pastas", severidade: "info", titulo: "Explorador de Arquivos abre no \"Acesso rápido\"", detalhe: "Se as pastas demoram a abrir, o Acesso rápido (recentes e rede) costuma ser o culpado.", ids: ["explorer_acesso_rapido", "explorer_reset_visualizacao"], padrao: false });
  }

  // ---- internet
  if (d.dns.length > 0 && !d.dns.some((x) => DNS_PUBLICOS.includes(x))) {
    p.push({ id: "dns", area: "Internet", severidade: "info", titulo: "Usando o DNS do provedor", detalhe: `DNS atual: ${d.dns.join(", ")}. Se os sites demoram a abrir, trocar por Cloudflare/Google costuma resolver.`, ids: ["dns_limpar", "dns_rapido"], padrao: false });
  }

  // ---- segurança
  if (d.antivirus.length > 1) {
    p.push({ id: "antivirus", area: "Segurança", severidade: "atencao", titulo: `${d.antivirus.length} antivírus instalados ao mesmo tempo`, detalhe: d.antivirus.join(", "), ids: [], padrao: false, manual: "Dois antivírus brigam entre si e deixam o PC muito lento. Mantenha só um e desinstale os outros." });
  } else if (d.antivirus.length === 0) {
    p.push({ id: "sem_antivirus", area: "Segurança", severidade: "atencao", titulo: "Nenhum antivírus detectado", detalhe: "Não foi encontrado antivírus ativo no Windows.", ids: ["defender_rapido"], padrao: false, manual: "Ative o Windows Defender ou instale um antivírus." });
  }

  const ordem: Record<Severidade, number> = { critico: 0, atencao: 1, info: 2 };
  return p.sort((a, b) => ordem[a.severidade] - ordem[b.severidade]);
}
