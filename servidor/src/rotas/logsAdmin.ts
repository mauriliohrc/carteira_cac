import type { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import { prisma } from '../db/cliente.js';
import { exigirAdmin } from '../http/guardas.js';

/**
 * Log de auditoria dos envios automáticos (WhatsApp/push) e de notícias.
 * Filtrável por canal (push/whatsapp), tipo (boas-vindas/7 dias/notícia) e
 * usuário. Alimenta tanto a tela de auditoria quanto o histórico no perfil.
 */
export async function rotasLogsAdmin(app: FastifyInstance) {
  app.addHook('preHandler', exigirAdmin());

  app.get('/api/admin/logs-notificacao', async (req) => {
    const q = req.query as {
      canal?: string;
      tipo?: string;
      usuarioId?: string;
      pagina?: string;
      limite?: string;
    };
    const pagina = Math.max(1, Number(q.pagina) || 1);
    const limite = Math.min(100, Math.max(1, Number(q.limite) || 30));

    const where: Prisma.LogNotificacaoWhereInput = {};
    if (q.canal === 'WHATSAPP' || q.canal === 'PUSH') where.canal = q.canal;
    if (q.tipo === 'BOAS_VINDAS' || q.tipo === 'SEM_ARMA_7D' || q.tipo === 'NOTICIA') where.tipo = q.tipo;
    if (q.usuarioId) where.usuarioId = q.usuarioId;

    const [total, logs] = await Promise.all([
      prisma.logNotificacao.count({ where }),
      prisma.logNotificacao.findMany({
        where,
        orderBy: { criadoEm: 'desc' },
        skip: (pagina - 1) * limite,
        take: limite,
        include: { usuario: { select: { id: true, nome: true, email: true } } },
      }),
    ]);

    return {
      logs: logs.map((l) => ({
        id: l.id,
        canal: l.canal,
        tipo: l.tipo,
        titulo: l.titulo,
        destino: l.destino,
        status: l.status,
        erro: l.erro,
        referenciaId: l.referenciaId,
        criadoEm: l.criadoEm,
        usuario: l.usuario ? { id: l.usuario.id, nome: l.usuario.nome, email: l.usuario.email } : null,
      })),
      total,
      pagina,
      totalPaginas: Math.max(1, Math.ceil(total / limite)),
    };
  });
}
