import { apiApp } from '@/conta/api';
import { lerToken } from '@/conta/armazenamento';
import type { Processo, TipoServicoDespachante } from '@/domain/tipos';

export interface ServicoDespachante {
  tipo: TipoServicoDespachante;
  nome: string;
  descricao: string;
  /** GRU (taxa do órgão) em centavos, por item. */
  gruCentavos: number;
  /** Honorário do despachante em centavos, por item. */
  servicoCentavos: number;
  /** Total cobrado por item (GRU + serviço), em centavos. */
  precoCentavos: number;
  /** Unidade de cobrança, para a UI ("por CRAF", "por guia"). */
  unidade: string;
}

export interface CatalogoDespachante {
  servicos: ServicoDespachante[];
  /** Nota explicando a composição do valor (GRU + serviço). */
  gruNota: string;
}

/**
 * Fallback usado quando o servidor não responde (ex.: offline, ou a API nova
 * ainda não está no ar). Os valores REAIS vêm do servidor e são editáveis no
 * backoffice; estes são só o padrão de referência (GRU + R$80 de serviço).
 */
const CATALOGO_PADRAO: CatalogoDespachante = {
  servicos: [
    {
      tipo: 'RENOVACAO_CRAF',
      nome: 'Renovação de CRAF',
      descricao:
        'Cuidamos de toda a renovação do Certificado de Registro de Arma de Fogo (CRAF) ' +
        'de cada arma do seu acervo, do protocolo ao acompanhamento.',
      gruCentavos: 8800,
      servicoCentavos: 8000,
      precoCentavos: 16800,
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
      precoCentavos: 10000,
      unidade: 'por guia',
    },
  ],
  gruNota:
    'O valor já inclui a GRU (taxa paga ao órgão) e o nosso serviço. As GRUs são ' +
    'definidas pelo órgão e podem mudar; confirmamos o valor exato no andamento.',
};

/**
 * Catálogo de serviços (preços e nota vêm do servidor, editáveis no backoffice).
 * Se o servidor não responder, cai no {@link CATALOGO_PADRAO} para a tela nunca
 * ficar sem valores.
 */
export async function listarServicos(): Promise<CatalogoDespachante> {
  const token = await lerToken();
  try {
    const r = await apiApp<CatalogoDespachante>('/despachante/servicos', { token });
    return r?.servicos?.length ? r : CATALOGO_PADRAO;
  } catch {
    return CATALOGO_PADRAO;
  }
}

/**
 * Cria um pedido (1 processo por item) e abre a cobrança no Asaas. Devolve o
 * processo criado e o `invoiceUrl` do checkout hospedado (PIX/cartão).
 */
export async function criarPedido(dados: {
  tipoServico: TipoServicoDespachante;
  armaId?: string | null;
  armaNome?: string | null;
}): Promise<{ processo: Processo; invoiceUrl: string }> {
  const token = await lerToken();
  return apiApp<{ processo: Processo; invoiceUrl: string }>('/despachante/pedidos', {
    metodo: 'POST',
    token,
    corpo: dados,
  });
}

/** Exclui um processo ainda não pago (cancela a cobrança no Asaas). */
export async function excluirPedido(id: string): Promise<void> {
  const token = await lerToken();
  await apiApp(`/despachante/pedidos/${id}`, { metodo: 'DELETE', token });
}
