import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../db/cliente.js';
import { exigirApp } from '../../http/guardas.js';
import { ambiente } from '../../config/ambiente.js';
import { backfillPorTransacao, processarAssinaturaAndroid } from '../../dominio/assinaturaServico.js';
import { registrarEventoUsuario } from '../../dominio/eventoUsuario.js';

const vincularSchema = z.object({
  /** Qualquer transactionId da assinatura ativa (o servidor resolve o original). */
  transactionId: z.string().min(1).max(64),
  /** Production | Sandbox (environmentIOS do app). Opcional. */
  environment: z.string().max(20).optional(),
});

const tentativaSchema = z.object({
  /** SKU que o usuário tentou assinar (premium_anual/mensal/parceiro). Opcional. */
  produtoId: z.string().max(64).optional(),
  /** IOS | ANDROID (opcional — só para a timeline). */
  plataforma: z.enum(['IOS', 'ANDROID']).optional(),
});

const vincularGoogleSchema = z.object({
  /** purchaseToken da assinatura ativa no Google Play (chave estável). */
  purchaseToken: z.string().min(1).max(4096),
});

/**
 * Assinatura do app (Apple). Dois endpoints que fecham o elo conta↔assinatura:
 *  - preparar: entrega o appAccountToken (UUID) para o app enviar na compra, de
 *    modo que a notificação da Apple já chegue atribuída à conta.
 *  - vincular: casa uma assinatura já existente (de quem comprou antes do
 *    appAccountToken) resolvendo o originalTransactionId pela App Store Server API.
 */
export async function rotasAssinaturaAppV1(app: FastifyInstance) {
  app.get('/app/assinatura/preparar', { preHandler: exigirApp() }, async (req) => {
    const id = req.usuario!.id;
    const u = await prisma.usuarioApp.findUnique({
      where: { id },
      select: { appAccountToken: true },
    });
    let token = u?.appAccountToken ?? null;
    if (!token) {
      token = randomUUID();
      // Corrida rara (dois aparelhos ao mesmo tempo): se já gravaram, relê.
      try {
        await prisma.usuarioApp.update({ where: { id }, data: { appAccountToken: token } });
      } catch {
        const atual = await prisma.usuarioApp.findUnique({
          where: { id },
          select: { appAccountToken: true },
        });
        token = atual?.appAccountToken ?? token;
      }
    }
    return { appAccountToken: token };
  });

  // Timeline: o usuário INICIOU o fluxo de compra (abriu o checkout da loja).
  // Best-effort e sem efeito colateral — serve só para o histórico no backoffice.
  // Endpoint novo: apps antigos simplesmente não o chamam (nada quebra).
  app.post('/app/assinatura/tentativa', { preHandler: exigirApp() }, async (req, reply) => {
    const corpo = tentativaSchema.safeParse(req.body ?? {});
    const dados = corpo.success ? corpo.data : {};
    void registrarEventoUsuario(req.usuario!.id, 'ASSINATURA_TENTATIVA', {
      origem: dados.plataforma ?? 'APP',
      descricao: dados.produtoId ?? null,
      meta: dados.produtoId ? { produtoId: dados.produtoId } : undefined,
    });
    reply.code(204);
    return null;
  });

  app.post('/app/assinatura/vincular', { preHandler: exigirApp() }, async (req, reply) => {
    // Sem a App Store Server API não dá para resolver o originalTransactionId a
    // partir de um transactionId de renovação — responde silencioso.
    if (!ambiente.apple.apiAtiva) {
      reply.code(204);
      return null;
    }
    const { transactionId, environment } = vincularSchema.parse(req.body);
    try {
      await backfillPorTransacao(
        transactionId,
        environment ?? ambiente.apple.ambiente,
        req.usuario!.id
      );
    } catch (e) {
      req.log.warn({ e: (e as Error).message }, '[assinatura vincular] falha ao resolver');
    }
    return { ok: true };
  });

  // Android: o app reporta o purchaseToken da assinatura ativa para o servidor
  // casá-la com a conta (via Android Publisher API) e trazer o estado atual.
  // Cobre quem assinou antes de o app passar o obfuscatedAccountId na compra.
  app.post('/app/assinatura/vincular-google', { preHandler: exigirApp() }, async (req, reply) => {
    if (!ambiente.google.apiAtiva) {
      reply.code(204);
      return null;
    }
    const { purchaseToken } = vincularGoogleSchema.parse(req.body);
    try {
      await processarAssinaturaAndroid(purchaseToken, undefined, req.usuario!.id);
    } catch (e) {
      req.log.warn({ e: (e as Error).message }, '[assinatura vincular-google] falha ao resolver');
    }
    return { ok: true };
  });
}
