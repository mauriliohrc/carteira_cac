/**
 * Catálogo dos serviços do despachante. O preço é dinâmico: cada serviço tem a
 * GRU (taxa do órgão, por item) + o honorário do serviço. O total cobrado é a
 * soma dos dois. Os valores aqui são apenas os DEFAULTS — o backoffice pode
 * sobrescrevê-los (tabela ServicoDespachanteConfig) sem precisar de update do app.
 *
 * GRUs de referência (nov/2025): Renovação de CRAF R$88,00/arma; Guia de Tráfego
 * (atirador desportivo, nacional) R$20,00/arma. Honorário padrão: R$80,00.
 */

export type TipoServicoDespachante = 'RENOVACAO_CRAF' | 'EMISSAO_GUIA';

export interface ServicoDespachante {
  tipo: TipoServicoDespachante;
  nome: string;
  descricao: string;
  /** GRU (taxa do órgão) em centavos, por item. */
  gruCentavos: number;
  /** Honorário do despachante em centavos, por item. */
  servicoCentavos: number;
  /** Unidade de cobrança, para a UI ("por CRAF", "por guia"). */
  unidade: string;
}

export const SERVICOS_DESPACHANTE: ServicoDespachante[] = [
  {
    tipo: 'RENOVACAO_CRAF',
    nome: 'Renovação de CRAF',
    descricao:
      'Cuidamos de toda a renovação do Certificado de Registro de Arma de Fogo (CRAF) ' +
      'de cada arma do seu acervo, do protocolo ao acompanhamento.',
    gruCentavos: 8800,
    servicoCentavos: 8000,
    unidade: 'por CRAF',
  },
  {
    tipo: 'EMISSAO_GUIA',
    nome: 'Emissão de Guias',
    descricao:
      'Emitimos a Guia de Tráfego do armamento que você precisar transportar, ' +
      'com orientação do início ao fim.',
    gruCentavos: 2000,
    servicoCentavos: 8000,
    unidade: 'por guia',
  },
];

/** Total cobrado por item (GRU + honorário), em centavos. */
export function precoTotal(s: { gruCentavos: number; servicoCentavos: number }): number {
  return s.gruCentavos + s.servicoCentavos;
}

/** Nota sobre a GRU, agora que ela já ENTRA no valor cobrado. */
export const GRU_NOTA =
  'O valor já inclui a GRU (taxa paga ao órgão) e o nosso serviço. As GRUs são ' +
  'definidas pelo órgão e podem mudar; confirmamos o valor exato no andamento.';

export function servicoPorTipo(tipo: string): ServicoDespachante | undefined {
  return SERVICOS_DESPACHANTE.find((s) => s.tipo === tipo);
}
