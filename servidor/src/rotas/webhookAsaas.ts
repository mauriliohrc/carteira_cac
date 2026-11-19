import type { FastifyInstance } from 'fastify';
import { prisma } from '../db/cliente.js';
import { aoPagarProcesso, mudarStatusProcesso } from '../dominio/despachanteNotificacoes.js';
import { statusPorPapel } from '../dominio/despachanteCatalogo.js';
import { ativarFiliacao, encerrarFiliacao } from '../dominio/filiacao.js';
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
  payment?: { id?: string; externalReference?: string; subscription?: string };
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
    const assinaturaId = payment?.subscription;

    const ehPago = Boolean(event && EVENTOS_PAGO.has(event));
    const ehCancelado = Boolean(event && EVENTOS_CANCELADO.has(event));
    // Eventos que não mexem no andamento (ex.: PAYMENT_UPDATED): só confirmamos.
    if (!ehPago && !ehCancelado) return { ok: true };

    // --- Despachante: cobrança avulsa (sem assinatura). ----------------------
    if (!assinaturaId) {
      const processo = await prisma.processoDespachante.findFirst({
        where: pagamentoId ? { asaasPaymentId: pagamentoId } : { id: referencia ?? '__none__' },
      });
      if (processo) {
        const stAtual = await prisma.statusProcessoDespachante.findUnique({
          where: { codigo: processo.status },
        });
        if (ehPago) {
          // Idempotência: não reprocessa um processo já pago/avançado.
          const jaAvancou = ['PAGO', 'AGUARDANDO_DOC', 'EM_ANALISE', 'NORMAL', 'FINAL'].includes(
            stAtual?.papel ?? ''
          );
          if (!jaAvancou) await aoPagarProcesso(processo);
        } else {
          if (stAtual?.papel !== 'CANCELADO') {
            const canc = await statusPorPapel('CANCELADO');
            await mudarStatusProcesso(processo, canc?.codigo ?? 'cancelado');
          }
        }
        return { ok: true };
      }
      // Pode ser uma cobrança de filiação cujo payment ainda não casou por
      // subscription (raro). Tenta a filiação pela referência externa abaixo.
    }

    // --- Filiação à liga: assinatura anual recorrente. ------------------------
    // Casa pela assinatura (preferido) ou pela referência externa (= id da
    // filiação, herdada pelas cobranças da assinatura).
    const filiacao = await prisma.filiacaoLiga.findFirst({
      where: assinaturaId
        ? { asaasSubscriptionId: assinaturaId }
        : { id: referencia ?? '__none__' },
    });
    if (!filiacao) return { ok: true }; // nada a fazer; não força o Asaas a repetir

    if (ehPago) {
      // Idempotência de pagamento repetido no mesmo ciclo: se já ativa e ainda
      // vigente, não estende de novo (o Asaas pode reenviar o mesmo evento).
      if (filiacao.status === 'ativa' && filiacao.vigenteAte > new Date()) return { ok: true };
      await ativarFiliacao(filiacao, { origemEvento: 'ASAAS' });
    } else {
      const novoStatus = event === 'PAYMENT_OVERDUE' ? 'vencida' : 'cancelada';
      if (filiacao.status === novoStatus) return { ok: true };
      await encerrarFiliacao(filiacao, novoStatus, 'ASAAS');
    }

    return { ok: true };
  });
}
