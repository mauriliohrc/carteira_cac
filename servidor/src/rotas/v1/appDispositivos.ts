import type { FastifyInstance } from 'fastify';
import { prisma } from '../../db/cliente.js';
import { registrarDispositivoSchema } from '../../dominio/validacao.js';
import { exigirApp, usuarioAppOpcional } from '../../http/guardas.js';
import { sincronizarVinculosSH } from '../../integracoes/vinculos.js';

const JANELA_VINCULOS_MS = 6 * 60 * 60 * 1000; // revê filiação na SH no máx. a cada 6h

/**
 * Dispositivos de push e sinal de presença do usuário do app.
 *
 * O registro de dispositivo é PÚBLICO de propósito: queremos o token mesmo de
 * usuários anônimos (ainda sem conta), para poder enviar "Todos". Se vier um
 * token de autenticação, o aparelho é associado à conta; senão fica anônimo.
 */
export async function rotasDispositivosAppV1(app: FastifyInstance) {
  // Registra/atualiza o token deste aparelho. Associa à conta se autenticado.
  app.post('/app/dispositivos', async (req, reply) => {
    const { token, plataforma } = registrarDispositivoSchema.parse(req.body);
    const usuarioId = usuarioAppOpcional(req); // null = anônimo

    await prisma.dispositivoPush.upsert({
      where: { token },
      create: { token, plataforma, usuarioId, ativo: true },
      update: { plataforma, usuarioId, ativo: true },
    });

    if (usuarioId) {
      await prisma.usuarioApp.update({
        where: { id: usuarioId },
        data: { ultimoAcessoEm: new Date() },
      });
    }

    reply.code(204);
    return null;
  });

  // Logout: desassocia o aparelho da conta (volta a anônimo; segue recebendo "Todos").
  app.post('/app/dispositivos/desassociar', async (req, reply) => {
    const { token } = req.body as { token?: string };
    if (token) {
      await prisma.dispositivoPush.updateMany({
        where: { token },
        data: { usuarioId: null },
      });
    }
    reply.code(204);
    return null;
  });

  // Heartbeat de presença: chamado quando o app renderiza notícias / volta ao foco.
  // Aproveita para, de tempos em tempos, revisar a filiação na Shooting House e
  // vincular o usuário às entidades em que ele é sócio ativo e adimplente.
  app.post('/app/presenca', { preHandler: exigirApp() }, async (req) => {
    const id = req.usuario!.id;
    const corpo = (req.body ?? {}) as { premium?: boolean; premiumTipo?: string | null };

    // Retrocompatível: apps antigos mandam só `premium` (booleano). O
    // `premiumTipo` é opcional e só grava quando vem um valor conhecido;
    // perder o premium zera o tipo.
    const tiposValidos = ['CUPOM', 'MENSAL', 'ANUAL', 'ANUAL_PARCEIRO'];
    const dados: Record<string, unknown> = { ultimoAcessoEm: new Date() };
    if (typeof corpo.premium === 'boolean') {
      dados.premium = corpo.premium;
      if (!corpo.premium) dados.premiumTipo = null;
    }
    if (typeof corpo.premiumTipo === 'string' && tiposValidos.includes(corpo.premiumTipo)) {
      dados.premiumTipo = corpo.premiumTipo;
    }

    const u = await prisma.usuarioApp.update({
      where: { id },
      data: dados,
      select: { cpf: true, vinculosCheckEm: true },
    });

    const venceu =
      !u.vinculosCheckEm || Date.now() - u.vinculosCheckEm.getTime() > JANELA_VINCULOS_MS;
    if (venceu) {
      // Marca já para evitar chamadas concorrentes; roda em segundo plano.
      await prisma.usuarioApp.update({ where: { id }, data: { vinculosCheckEm: new Date() } });
      void sincronizarVinculosSH(id, u.cpf).catch(() => {});
    }

    return { ok: true };
  });
}
