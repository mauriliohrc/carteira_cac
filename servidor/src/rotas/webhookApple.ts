import type { FastifyInstance } from 'fastify';
import { ambiente } from '../config/ambiente.js';
import { verificarNotificacao } from '../integracoes/appleAssinatura.js';
import { processarNotificacaoDecodificada } from '../dominio/assinaturaServico.js';

/**
 * Webhook da Apple — App Store Server Notifications V2 (PÚBLICO).
 *
 * A autenticidade NÃO vem de um token compartilhado: cada notificação é um JWS
 * assinado pela Apple, verificado contra os certificados-raiz embutidos. Produção
 * e sandbox chegam nesta MESMA URL (o ambiente vem no payload verificado).
 *
 * Trata apenas assinaturas Premium (as SKUs conhecidas); notificações de outros
 * produtos (ex.: destaque consumível) são confirmadas e ignoradas. Idempotente
 * por notificationUUID. Sempre responde 200 quando a notificação é válida, para
 * a Apple não reenfileirar indefinidamente — exceto em assinatura inválida (401).
 */
export async function rotasWebhookApple(app: FastifyInstance) {
  app.post('/webhooks/apple', async (req, reply) => {
    if (!ambiente.apple.webhookAtivo) {
      reply.code(503);
      return { ok: false, erro: 'Webhook da Apple não configurado' };
    }

    const signedPayload = (req.body as { signedPayload?: string } | undefined)?.signedPayload;
    if (!signedPayload) {
      reply.code(400);
      return { ok: false };
    }

    // 1) Verifica e decodifica a notificação (assinatura da Apple).
    let notif;
    try {
      notif = await verificarNotificacao(signedPayload);
    } catch (e) {
      req.log.warn({ e: (e as Error)?.message }, '[apple webhook] assinatura inválida');
      reply.code(401);
      return { ok: false };
    }

    // 2) Verifica a transação/renewal embutidos e aplica o evento (compartilhado
    //    com o backfill por histórico). Assinaturas não-Premium → no-op.
    try {
      await processarNotificacaoDecodificada(notif);
    } catch (e) {
      req.log.warn({ e: (e as Error)?.message }, '[apple webhook] transação inválida');
      reply.code(401);
      return { ok: false };
    }

    return { ok: true };
  });
}
