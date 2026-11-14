import { normalizar } from "./score";

/**
 * Verbos de ação para tópicos de experiência, na 1ª pessoa do pretérito
 * ("Elaborei", "Atendi"). Só muda a forma de escrever, nunca o fato.
 */

const IRREGULARES: Record<string, string> = {
  fazer: "fiz", refazer: "refiz", desfazer: "desfiz", trazer: "trouxe", dizer: "disse",
  ser: "fui", ir: "fui", estar: "estive", ter: "tive", obter: "obtive", manter: "mantive",
  conter: "contive", deter: "detive", reter: "retive", ver: "vi", rever: "revi", prever: "previ",
  dar: "dei", poder: "pude", saber: "soube", querer: "quis", vir: "vim", intervir: "intervim",
  ler: "li", pôr: "pus", propor: "propus", compor: "compus", dispor: "dispus", expor: "expus",
  repor: "repus", supor: "supus", impor: "impus", depor: "depus",
};

/** "elaborar" -> "elaborei", "atender" -> "atendi", "verificar" -> "verifiquei". */
export function passado(infinitivo: string): string | null {
  const v = infinitivo.toLowerCase();
  if (IRREGULARES[v]) return IRREGULARES[v];
  if (v.length < 4) return null;
  if (v.endsWith("ar")) {
    const radical = v.slice(0, -2);
    if (radical.endsWith("c")) return `${radical.slice(0, -1)}quei`;
    if (radical.endsWith("g")) return `${radical}uei`;
    if (radical.endsWith("ç")) return `${radical.slice(0, -1)}cei`;
    return `${radical}ei`;
  }
  if (v.endsWith("uir")) return `${v.slice(0, -2)}í`;
  if (v.endsWith("er") || v.endsWith("ir")) return `${v.slice(0, -2)}i`;
  return null;
}

/** Pretérito imperfeito -> perfeito: "realizava" -> "realizei", "atendia" -> "atendi". */
function perfeitoDoImperfeito(verbo: string): string | null {
  const v = verbo.toLowerCase();
  if (v === "fazia") return "fiz";
  if (v === "tinha") return "tive";
  if (v === "era" || v === "ia") return null;
  if (v.endsWith("ava") && v.length > 4) return passado(`${v.slice(0, -3)}ar`);
  // Só formas verbais claras (atendia, desenvolvia, produzia, recebia, conhecia);
  // evita substantivos como "experiência", "auditoria", "garantia".
  if (/^[a-z]+[dvzbc]ia$/.test(v) && v.length > 4) {
    const radical = v.slice(0, -2);
    return radical.endsWith("u") ? `${radical}í` : `${radical}i`;
  }
  return null;
}

/** Substantivo de ação -> verbo ("elaboração" -> "Elaborei"). */
export const VERBOS_DE_SUBSTANTIVO: Record<string, string> = {
  elaboracao: "Elaborei", desenvolvimento: "Desenvolvi", criacao: "Criei", implantacao: "Implantei",
  implementacao: "Implementei", gerenciamento: "Gerenciei", analise: "Analisei", acompanhamento: "Acompanhei",
  controle: "Controlei", coordenacao: "Coordenei", organizacao: "Organizei", planejamento: "Planejei",
  execucao: "Executei", treinamento: "Treinei", emissao: "Emiti", lancamento: "Lancei", conciliacao: "Conciliei",
  monitoramento: "Monitorei", realizacao: "Realizei", conducao: "Conduzi", lideranca: "Liderei",
  automacao: "Automatizei", automatizacao: "Automatizei", otimizacao: "Otimizei", estruturacao: "Estruturei",
  definicao: "Defini", revisao: "Revisei", mapeamento: "Mapeei", integracao: "Integrei", construcao: "Construí",
  producao: "Produzi", prospeccao: "Prospectei", supervisao: "Supervisionei", negociacao: "Negociei",
  gestao: "Geri", atualizacao: "Atualizei", preparacao: "Preparei", manutencao: "Mantive", validacao: "Validei",
  padronizacao: "Padronizei", apuracao: "Apurei", confeccao: "Confeccionei", redacao: "Redigi",
  atendimento: "Atendi", administracao: "Administrei", operacao: "Operei", inspecao: "Inspecionei",
  instalacao: "Instalei", configuracao: "Configurei", recrutamento: "Recrutei", selecao: "Selecionei",
  venda: "Vendi", vendas: "Vendi", cobranca: "Cobrei", auditoria: "Auditei", avaliacao: "Avaliei",
  elaboracoes: "Elaborei", orientacao: "Orientei", capacitacao: "Capacitei", divulgacao: "Divulguei",
};

const ARTIGO: Record<string, string> = { de: "", do: "o ", da: "a ", dos: "os ", das: "as " };

function maiuscula(t: string) {
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/**
 * Deixa um tópico mais forte, começando com verbo de ação:
 * "Responsável por atender clientes" -> "Atendi clientes";
 * "Responsável pela elaboração de relatórios" -> "Elaborei relatórios";
 * "Realizava conciliações" -> "Realizei conciliações";
 * "Apoio na manutenção de..." -> "Apoiei a manutenção de...".
 * Devolve null quando não há o que melhorar com segurança.
 */
export function fortalecerTopico(topico: string): string | null {
  const t = topico.trim().replace(/^eu\s+/i, "");

  // Responsável por + verbo no infinitivo
  let m = t.match(/^respons[aá]vel\s+por\s+([\p{L}]+(?:ar|er|ir|or))\b\s*(.*)$/iu);
  if (m) {
    const v = passado(m[1]);
    if (v) return maiuscula(`${v} ${m[2]}`.trim());
  }

  // Responsável pelo/pela + substantivo de ação
  m = t.match(/^respons[aá]vel\s+(?:pel[oa]s?|por)\s+([\p{L}]+)\s+(de|do|da|dos|das|a|ao|aos|às|com|em|no|na|nos|nas)\s+(.+)$/iu);
  if (m) {
    const verbo = VERBOS_DE_SUBSTANTIVO[normalizar(m[1])];
    if (verbo) {
      const prep = m[2].toLowerCase();
      const ligacao = prep in ARTIGO ? ARTIGO[prep] : `${prep} `;
      return `${verbo} ${ligacao}${m[3]}`;
    }
  }

  // Apoio/Auxílio na/no + ...
  m = t.match(/^(?:apoio|aux[ií]lio|suporte)\s+(na|no|nas|nos|em|à|ao|às|aos)\s+(.+)$/iu);
  if (m) {
    const prep = m[1].toLowerCase();
    const artigo: Record<string, string> = { na: "a ", no: "o ", nas: "as ", nos: "os ", em: "", "à": "a ", ao: "o ", "às": "as ", aos: "os " };
    return `Apoiei ${artigo[prep]}${m[2]}`;
  }

  // Verbo no imperfeito: "Realizava", "Atendia"
  m = t.match(/^([\p{L}]+)\s+(.+)$/u);
  if (m) {
    const perfeito = perfeitoDoImperfeito(m[1]);
    if (perfeito && /(ava|ia)$/i.test(m[1])) return maiuscula(`${perfeito} ${m[2]}`);
  }

  // Tirar o "Eu" do começo já é uma melhoria
  if (t !== topico.trim()) return maiuscula(t);
  return null;
}
