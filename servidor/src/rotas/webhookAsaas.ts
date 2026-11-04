import type { FastifyInstance } from 'fastify';
import { prisma } from '../db/cliente.js';
import { refletirProcessoNoSync } from '../dominio/despachanteSync.js';
import { resolverConfigAsaas } from '../dominio/asaasConfig.js';

/** Eventos do Asaas que confirmam o pagamento → processo vira 'pago'. */
const EVENTOS_PAGO = new Set(['PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED']);
/** Eventos que invalidam a cobrança → processo vira 'cancelado'. */
const EVENTOS_CANCELADO = new Set([
  'PAYMENT_OVERDUE',
  'PAYMENT_DELETED',
  'PAYMENT_REFUNDED',
  'PAYMENT_CHARGEBACK_REQUESTED',
]);

interface CorpoWebhook {
  event?: string;
  payment?: { id?: string; externalReference?: string };
}

/**
 * Webhook do Asaas — PÚBLICO, mas autenticado por token compartilhado no header
 * `asaas-access-token` (configurado no painel do Asaas, casado com
 * ASAAS_WEBHOOK_TOKEN). Atualiza o status do processo e reflete no sync, para o
 * app receber o andamento no próximo pull. Idempotente: reprocessar o mesmo
 * evento não muda nada.
 */
export async function rotasWebhookAsaas(app: FastifyInstance) {
  app.post('/webhooks/asaas', async (req, reply) => {
    const cfg = await resolverConfigAsaas();
    // O Asaas manda o token no header `asaas-access-token`. Aceitamos também
    // algumas variações comuns por robustez.
    const token =
      (req.headers['asaas-access-token'] as string | undefined) ??
      (req.headers['asaas-webhook-token'] as string | undefined) ??
      (req.headers['access-token'] as string | undefined);
    if (!cfg.webhookToken || token !== cfg.webhookToken) {
      req.log.warn(
        {
          headers: Object.keys(req.headers),
          tokenRecebido: typeof token === 'string' ? `len=${token.length}…${token.slice(-4)}` : null,
          tokenEsperadoLen: cfg.webhookToken.length,
          evento: (req.body as { event?: string } | undefined)?.event,
        },
        '[asaas webhook] 401 — token não confere'
      );
      reply.code(401);
      return { ok: false };
    }

    const { event, payment } = (req.body ?? {}) as CorpoWebhook;
    const pagamentoId = payment?.id;
    const referencia = payment?.externalReference;

    let novoStatus: string | null = null;
    if (event && EVENTOS_PAGO.has(event)) novoStatus = 'pago';
    else if (event && EVENTOS_CANCELADO.has(event)) novoStatus = 'cancelado';

    // Eventos que não mexem no andamento (ex.: PAYMENT_UPDATED): só confirmamos.
    if (!novoStatus) return { ok: true };

    // Acha o processo pelo id do pagamento (preferido) ou pela referência externa.
    const processo = await prisma.processoDespachante.findFirst({
      where: pagamentoId ? { asaasPaymentId: pagamentoId } : { id: referencia ?? '__none__' },
    });
    if (!processo) return { ok: true }; // nada a fazer; não força o Asaas a repetir

    // Idempotência: já está no status alvo → nada a fazer.
    if (processo.status === novoStatus) return { ok: true };
    // Não "rebaixa" um processo que já avançou além de pago (em_andamento/concluido).
    if (novoStatus === 'pago' && ['em_andamento', 'concluido'].includes(processo.status)) {
      return { ok: true };
    }

    const atualizado = await prisma.processoDespachante.update({
      where: { id: processo.id },
      data: { status: novoStatus },
    });
    await refletirProcessoNoSync(atualizado);

    return { ok: true };
  });
}
