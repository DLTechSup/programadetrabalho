import { normalizar } from "./score";

/**
 * Detecta quando a pessoa pode parecer "qualificada demais" para a vaga:
 * vaga operacional ou de entrada × currículo com formação alta ou cargos de gestão.
 */

export interface AvaliacaoNivel {
  vagaSimples: boolean;
  curriculoQualificado: boolean;
  sobrequalificado: boolean;
  /** Por que a vaga parece de nível de entrada (ex.: "cargo de repositor"). */
  sinaisVaga: string[];
  /** Por que o currículo parece acima da vaga (ex.: "MBA", "cargo de gerente"). */
  sinaisCurriculo: string[];
}

const CARGOS_OPERACIONAIS: Array<[RegExp, string]> = [
  [/\b((operador|operadora) de (caixa|loja|supermercado)\b|\bcaixa de supermercado)\b/, "operador(a) de caixa"],
  [/\b(repositor|repositora)\b/, "repositor(a)"],
  [/\bestoquista\b/, "estoquista"],
  [/\b(empacotador|empacotadora)\b/, "empacotador(a)"],
  [/\batendente\b/, "atendente"],
  [/\bbalconista\b/, "balconista"],
  [/\brecepcionista\b/, "recepcionista"],
  [/\bauxiliar\b/, "auxiliar"],
  [/\bajudante\b/, "ajudante"],
  [/\bservente\b/, "servente"],
  [/\b(zelador|zeladora)\b/, "zelador(a)"],
  [/\b(porteiro|porteira)\b/, "porteiro(a)"],
  [/\b(entregador|entregadora)\b/, "entregador(a)"],
  [/\b(garcom|garconete)\b/, "garçom/garçonete"],
  [/\b(cozinheir[oa]|copeir[oa])\b/, "cozinha"],
  [/\b(faxineir[oa]|limpeza)\b/, "limpeza"],
  [/\b(conferente|separador|separadora|almoxarife)\b/, "logística operacional"],
  [/\bfrentista\b/, "frentista"],
  [/\b(vendedor|vendedora)\b/, "vendedor(a)"],
  [/\b(promotor|promotora)\b/, "promotor(a)"],
  [/\b(jovem )?aprendiz\b/, "aprendiz"],
  [/\b(camareir[oa]|cuidador|cuidadora|diarista)\b/, "serviços gerais"],
];

const REQUISITOS_SIMPLES: Array<[RegExp, string]> = [
  [/\b(ensino (medio|fundamental)( completo| incompleto)?)\b/, "pede ensino médio ou fundamental"],
  [/\b((nao (e )?(necessario|exigimos|exige) experiencia|sem experiencia|primeiro emprego))\b/, "não exige experiência"],
];

const FORMACAO_ALTA: Array<[RegExp, string]> = [
  [/\b(doutorado|doutor em)\b/, "doutorado"],
  [/\b(mestrado|mestre em)\b/, "mestrado"],
  [/\bmba\b/, "MBA"],
  [/\b(pos[ -]?graduacao|pos[ -]?graduad[oa]|especializacao)\b/, "pós-graduação"],
  [/\b((bacharelado|bacharel|licenciatura|graduacao|graduad[oa]|superior completo|tecnologo))\b/, "ensino superior"],
];

const CARGOS_ALTOS: Array<[RegExp, string]> = [
  [/\b(diretor|diretora)\b/, "diretor(a)"],
  [/\bgerente\b/, "gerente"],
  [/\b(coordenador|coordenadora)\b/, "coordenador(a)"],
  [/\b(supervisor|supervisora)\b/, "supervisor(a)"],
  [/\bhead\b/, "head"],
  [/\bespecialista\b/, "especialista"],
  [/\b(consultor|consultora)\b/, "consultor(a)"],
  [/\banalista\b/, "analista"],
  [/\b((senior|sr))\b/, "sênior"],
];

function sinais(texto: string, regras: Array<[RegExp, string]>): string[] {
  return [...new Set(regras.filter(([re]) => re.test(texto)).map(([, rotulo]) => rotulo))];
}

export function avaliarNivel(params: { vaga: string; cargo: string; curriculo: string }): AvaliacaoNivel {
  const cargo = normalizar(params.cargo);
  const vaga = normalizar(params.vaga);
  const cv = normalizar(params.curriculo);

  const cargosVaga = sinais(cargo, CARGOS_OPERACIONAIS).map((c) => `cargo de ${c}`);
  const requisitos = sinais(vaga, REQUISITOS_SIMPLES);
  const sinaisVaga = [...cargosVaga, ...requisitos];
  // Vaga cujo próprio cargo já é de gestão não é "simples", mesmo que diga "ensino médio".
  const vagaSimples = sinaisVaga.length > 0 && sinais(cargo, CARGOS_ALTOS).length === 0;

  const formacao = sinais(cv, FORMACAO_ALTA);
  const cargosCv = sinais(cv, CARGOS_ALTOS).map((c) => `cargo de ${c}`);
  const sinaisCurriculo = [...formacao, ...cargosCv];
  const curriculoQualificado = sinaisCurriculo.length > 0;

  return {
    vagaSimples,
    curriculoQualificado,
    sobrequalificado: vagaSimples && curriculoQualificado,
    sinaisVaga,
    sinaisCurriculo,
  };
}
