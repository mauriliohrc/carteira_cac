import { prisma } from '../db/cliente.js';
import { precoTotal, SERVICOS_DESPACHANTE, type ServicoDespachante } from './despachante.js';

export interface ServicoResolvido extends ServicoDespachante {
  /** Total cobrado por item (GRU + serviço), em centavos. */
  precoCentavos: number;
  ativo: boolean;
}

/**
 * Serviços com os preços efetivos: parte dos defaults e aplica por cima o que
 * estiver cadastrado em ServicoDespachanteConfig (backoffice). Assim os valores
 * mudam sem update do app.
 */
export async function resolverServicos(): Promise<ServicoResolvido[]> {
  const configs = await prisma.servicoDespachanteConfig.findMany();
  const porTipo = new Map(configs.map((c) => [c.tipoServico, c]));
  return SERVICOS_DESPACHANTE.map((s) => {
    const c = porTipo.get(s.tipo);
    const gruCentavos = c?.gruCentavos ?? s.gruCentavos;
    const servicoCentavos = c?.servicoCentavos ?? s.servicoCentavos;
    return {
      ...s,
      gruCentavos,
      servicoCentavos,
      precoCentavos: precoTotal({ gruCentavos, servicoCentavos }),
      ativo: c?.ativo ?? true,
    };
  });
}

export async function resolverServico(tipo: string): Promise<ServicoResolvido | undefined> {
  return (await resolverServicos()).find((s) => s.tipo === tipo);
}
