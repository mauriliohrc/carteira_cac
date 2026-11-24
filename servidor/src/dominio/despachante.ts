/**
 * Catálogo dos serviços do despachante. O preço é dinâmico: cada serviço tem a
 * GRU (taxa do órgão, por item) + o honorário do serviço. O total cobrado é a
 * soma dos dois. Os valores aqui são apenas os DEFAULTS — o backoffice pode
 * sobrescrevê-los (tabela ServicoDespachanteConfig) sem precisar de update do app.
 *
 * GRUs de referência (nov/2025): Renovação de CRAF R$88,00/arma; Guia de Tráfego
 * (atirador desportivo, nacional) R$20,00/arma. Honorário padrão: R$80,00.
 */

export type TipoServicoDespachante =
  | 'CADASTRO_RENOVACAO_IBAMA'
  | 'AQUISICAO_TRANSFERENCIA'
  | 'POSSE_PF'
  | 'PORTE_PF'
  // Legados (apps antigos ainda os pedem; mantidos no catálogo por compat).
  | 'RENOVACAO_CRAF'
  | 'EMISSAO_GUIA';

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
    tipo: 'CADASTRO_RENOVACAO_IBAMA',
    nome: 'Cadastro / Renovação IBAMA',
    descricao:
      'Fazemos o seu cadastro ou a renovação no IBAMA (CTF), do protocolo ao ' +
      'acompanhamento, sem você perder tempo com a burocracia.',
    gruCentavos: 0,
    servicoCentavos: 15000,
    unidade: 'por processo',
  },
  {
    tipo: 'AQUISICAO_TRANSFERENCIA',
    nome: 'Aquisição / Transferência de Equipamento (CAC)',
    descricao:
      'Cuidamos de todo o processo de aquisição ou transferência de armamento do ' +
      'atirador, caçador ou colecionador.',
    gruCentavos: 0,
    servicoCentavos: 20000,
    unidade: 'por processo',
  },
  {
    tipo: 'POSSE_PF',
    nome: 'Posse - Polícia Federal',
    descricao: 'Conduzimos o seu processo de posse de arma de fogo junto à Polícia Federal.',
    gruCentavos: 0,
    servicoCentavos: 25000,
    unidade: 'por processo',
  },
  {
    tipo: 'PORTE_PF',
    nome: 'Porte - Polícia Federal',
    descricao: 'Conduzimos o seu processo de porte de arma de fogo junto à Polícia Federal.',
    gruCentavos: 0,
    servicoCentavos: 30000,
    unidade: 'por processo',
  },
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

/** Faixa de preço por quantidade/filiação (ver model FaixaPrecoDespachante). */
export interface FaixaPreco {
  qtdMin: number;
  precoCentavos: number;
  precoFiliadoCentavos: number;
}

/**
 * Preço POR UNIDADE (centavos) dada a quantidade de equipamentos e se o usuário
 * é filiado. Usa as faixas cadastradas (a de maior `qtdMin` que não ultrapassa a
 * quantidade); SEM faixas, cai no preço legado (GRU + honorário), igual para
 * filiado e não filiado — preserva 100% o comportamento de serviços existentes.
 */
export function precoUnitario(
  s: { gruCentavos: number; servicoCentavos: number; faixas?: FaixaPreco[] | null },
  quantidade: number,
  filiado: boolean
): number {
  const faixas = (s.faixas ?? []).slice().sort((a, b) => a.qtdMin - b.qtdMin);
  if (faixas.length === 0) return precoTotal(s);
  const q = Math.max(1, Math.floor(quantidade) || 1);
  let escolhida = faixas[0]!;
  for (const f of faixas) if (f.qtdMin <= q) escolhida = f;
  return filiado ? escolhida.precoFiliadoCentavos : escolhida.precoCentavos;
}

/** Total do pedido (preço por unidade × quantidade), em centavos. */
export function precoTotalPedido(
  s: { gruCentavos: number; servicoCentavos: number; faixas?: FaixaPreco[] | null },
  quantidade: number,
  filiado: boolean
): number {
  const q = Math.max(1, Math.floor(quantidade) || 1);
  return precoUnitario(s, q, filiado) * q;
}

/** Nota sobre a GRU, agora que ela já ENTRA no valor cobrado. */
export const GRU_NOTA =
  'O valor já inclui a GRU (taxa paga ao órgão) e o nosso serviço. As GRUs são ' +
  'definidas pelo órgão e podem mudar; confirmamos o valor exato no andamento.';

export function servicoPorTipo(tipo: string): ServicoDespachante | undefined {
  return SERVICOS_DESPACHANTE.find((s) => s.tipo === tipo);
}
