import type { FastifyInstance } from 'fastify';
import { ambiente } from '../config/ambiente.js';
import { processarAssinaturaAndroid } from '../dominio/assinaturaServico.js';

/**
 * Webhook do Google Play — Real-time Developer Notifications (RTDN) via Pub/Sub
 * push (PÚBLICO, protegido por segredo na query).
 *
 * O Pub/Sub entrega um envelope `{ message: { data: base64 } }`; o `data` é o
 * JSON da RTDN (`subscriptionNotification` com purchaseToken/subscriptionId/
 * notificationType). Como o push NÃO é assinado, exigimos `?token=` igual ao
 * `GOOGLE_PUBSUB_TOKEN`. O estado da assinatura é lido da Android Publisher API.
 *
 * Responde 200 em tudo que for processável (mesmo no-op) para o Pub/Sub não
 * reenfileirar; só rejeita token inválido (401) ou serviço desligado (503).
 */
interface EnvelopePubSub {
  message?: { data?: string; messageId?: string };
}

interface RtdnPayload {
  subscriptionNotification?: {
    notificationType?: number;
    purchaseToken?: string;
    subscriptionId?: string;
  };
  testNotification?: { version?: string };
}

export async function rotasWebhookGoogle(app: FastifyInstance) {
  app.post('/webhooks/google', async (req, reply) => {
    if (!ambiente.google.apiAtiva) {
      reply.code(503);
      return { ok: false, erro: 'Webhook do Google não configurado' };
    }

    // Autenticação por segredo compartilhado na query (o push do Pub/Sub não é
    // assinado). Quando GOOGLE_PUBSUB_TOKEN está definido, é obrigatório.
    if (ambiente.google.pubsubToken) {
      const q = (req.query ?? {}) as { token?: string };
      if (q.token !== ambiente.google.pubsubToken) {
        reply.code(401);
        return { ok: false };
      }
    }

    const envelope = req.body as EnvelopePubSub | undefined;
    const base64 = envelope?.message?.data;
    if (!base64) {
      // Pode ser a verificação de entrega do Pub/Sub — confirma sem erro.
      return { ok: true };
    }

    let payload: RtdnPayload;
    try {
      payload = JSON.parse(Buffer.from(base64, 'base64').toString('utf8')) as RtdnPayload;
    } catch {
      reply.code(400);
      return { ok: false };
    }

    // Notificação de teste (botão "Enviar teste" na Play Console): só confirma.
    if (payload.testNotification) return { ok: true, teste: true };

    const sn = payload.subscriptionNotification;
    if (!sn?.purchaseToken) return { ok: true }; // não é assinatura — ignora

    try {
      await processarAssinaturaAndroid(sn.purchaseToken, sn.notificationType);
    } catch (e) {
      // Falha ao consultar/aplicar: loga e responde 200 assim mesmo — o cron de
      // rede de segurança e os próximos eventos reconciliam. (200 evita o Pub/Sub
      // reenfileirar em loop por um purchaseToken problemático.)
      req.log.warn({ e: (e as Error)?.message }, '[google webhook] falha ao processar RTDN');
    }

    return { ok: true };
  });
}
