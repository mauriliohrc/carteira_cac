import { prisma } from '../db/cliente.js';
import { ambiente } from '../config/ambiente.js';

export type AmbienteAsaas = 'sandbox' | 'producao';

export interface ConfigAsaasResolvida {
  ambiente: AmbienteAsaas;
  baseUrl: string;
  apiKey: string;
  webhookToken: string;
  ativo: boolean;
}

const BASE_POR_AMBIENTE: Record<AmbienteAsaas, string> = {
  sandbox: 'https://api-sandbox.asaas.com/v3',
  producao: 'https://api.asaas.com/v3',
};

/**
 * Resolve a configuração efetiva do Asaas. O que estiver no banco (editado pelo
 * backoffice) manda; na ausência, cai nas variáveis de ambiente (ASAAS_*), para
 * não quebrar deploys que já configuravam por env.
 */
export async function resolverConfigAsaas(): Promise<ConfigAsaasResolvida> {
  let cfg = null;
  try {
    cfg = await prisma.configuracaoAsaas.findUnique({ where: { id: 'unico' } });
  } catch {
    // Tabela ainda não migrada (deploy antigo): usa só o env.
    cfg = null;
  }

  const ambDb: AmbienteAsaas | null =
    cfg?.ambiente === 'producao' ? 'producao' : cfg?.ambiente === 'sandbox' ? 'sandbox' : null;

  const apiKey = (cfg?.apiKey || ambiente.asaas.apiKey || '').trim();
  const webhookToken = (cfg?.webhookToken || ambiente.asaas.webhookToken || '').trim();
  const ambienteFinal: AmbienteAsaas =
    ambDb ?? (ambiente.asaas.baseUrl.includes('sandbox') ? 'sandbox' : 'producao');
  const baseUrl = ambDb ? BASE_POR_AMBIENTE[ambDb] : ambiente.asaas.baseUrl;

  return {
    ambiente: ambienteFinal,
    baseUrl,
    apiKey,
    webhookToken,
    ativo: Boolean(apiKey),
  };
}

/** URL pública do webhook, para o admin copiar no painel do Asaas. */
export function urlWebhookAsaas(): string {
  const base = (ambiente.apiPublicaUrl || 'https://api.carteiracac.com').replace(/\/$/, '');
  return `${base}/webhooks/asaas`;
}
