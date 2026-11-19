import { resolverConfigAsaas } from '../dominio/asaasConfig.js';

/**
 * Cliente mínimo do Asaas (gateway de pagamento do Despachante). Usa o `fetch`
 * global do Node — mesmo estilo das demais integrações do servidor.
 *
 * A configuração (chave/ambiente) vem do backoffice (ou, na ausência, do env) —
 * resolvida a cada chamada por {@link resolverConfigAsaas}.
 *
 * Cobramos serviços do mundo real (renovar CRAF, emitir guia), então por regra
 * da Apple/Google o pagamento é FORA do IAP — aqui, via checkout hospedado do
 * Asaas (o cliente escolhe PIX/crédito/débito). O app só abre o `invoiceUrl`.
 */

export interface ClienteAsaas {
  id: string;
}

export interface CobrancaAsaas {
  id: string;
  invoiceUrl: string;
  status: string;
}

async function requisitar<T>(caminho: string, metodo: string, corpo?: unknown): Promise<T> {
  const cfg = await resolverConfigAsaas();
  if (!cfg.ativo) {
    throw new Error('Asaas não configurado. Defina a chave no backoffice (ou ASAAS_API_KEY).');
  }
  const resp = await fetch(`${cfg.baseUrl}${caminho}`, {
    method: metodo,
    headers: {
      'Content-Type': 'application/json',
      access_token: cfg.apiKey,
      'User-Agent': 'CarteiraCAC',
    },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
  const texto = await resp.text();
  const dados = texto ? JSON.parse(texto) : {};
  if (!resp.ok) {
    const msg =
      dados?.errors?.[0]?.description ?? dados?.message ?? `Asaas respondeu ${resp.status}`;
    throw new Error(`Asaas: ${msg}`);
  }
  return dados as T;
}

/** Cria (ou reaproveita) um cliente no Asaas para o usuário do app. */
export async function criarCliente(dados: {
  name: string;
  cpfCnpj: string;
  email: string;
  mobilePhone: string;
}): Promise<ClienteAsaas> {
  return requisitar<ClienteAsaas>('/customers', 'POST', dados);
}

/**
 * Cria uma cobrança com forma de pagamento aberta (`UNDEFINED`): o cliente
 * escolhe PIX/crédito/débito no checkout hospedado (`invoiceUrl`). `value` em
 * reais (ex.: 99.00). `externalReference` = id do processo, para reconciliar.
 */
export async function criarCobranca(dados: {
  customer: string;
  value: number;
  description: string;
  externalReference: string;
  dueDate: string; // YYYY-MM-DD
}): Promise<CobrancaAsaas> {
  return requisitar<CobrancaAsaas>('/payments', 'POST', {
    billingType: 'UNDEFINED',
    ...dados,
  });
}

/** Remove uma cobrança no Asaas (só faz sentido enquanto não paga). Best-effort. */
export async function cancelarCobranca(id: string): Promise<void> {
  try {
    await requisitar(`/payments/${id}`, 'DELETE');
  } catch {
    // Já paga/removida ou indisponível — seguimos; o processo é removido localmente.
  }
}

// ---------------------------------------------------------------------------
// Assinaturas recorrentes — usadas pela FILIAÇÃO à liga (anuidade). Diferente
// das cobranças avulsas do despachante, a assinatura renova sozinha a cada
// ciclo (YEARLY) e o Asaas gera uma nova cobrança por período. Também é fora do
// IAP, por ser serviço do mundo real (vínculo associativo com validade PF).
// ---------------------------------------------------------------------------

export interface AssinaturaAsaas {
  id: string;
  status?: string;
}

/**
 * Cria uma assinatura recorrente no Asaas. `billingType: 'UNDEFINED'` deixa o
 * cliente escolher PIX/crédito/débito no checkout. `value` em reais. `cycle`
 * padrão YEARLY (anuidade). `externalReference` = id da filiação, p/ reconciliar
 * no webhook. A 1ª cobrança é criada junto; o `invoiceUrl` vem de
 * {@link cobrancasDaAssinatura}.
 */
export async function criarAssinatura(dados: {
  customer: string;
  value: number;
  description: string;
  externalReference: string;
  nextDueDate: string; // YYYY-MM-DD
  cycle?: 'YEARLY' | 'MONTHLY';
}): Promise<AssinaturaAsaas> {
  const { cycle = 'YEARLY', ...resto } = dados;
  return requisitar<AssinaturaAsaas>('/subscriptions', 'POST', {
    billingType: 'UNDEFINED',
    cycle,
    ...resto,
  });
}

/** Cobranças geradas por uma assinatura (a 1ª traz o `invoiceUrl` do checkout). */
export async function cobrancasDaAssinatura(id: string): Promise<CobrancaAsaas[]> {
  const resp = await requisitar<{ data?: CobrancaAsaas[] }>(
    `/subscriptions/${id}/payments`,
    'GET'
  );
  return resp.data ?? [];
}

/** Cancela uma assinatura no Asaas (para a recorrência). Best-effort. */
export async function cancelarAssinatura(id: string): Promise<void> {
  try {
    await requisitar(`/subscriptions/${id}`, 'DELETE');
  } catch {
    // Já cancelada/indisponível — seguimos; o status local é a fonte da verdade.
  }
}
