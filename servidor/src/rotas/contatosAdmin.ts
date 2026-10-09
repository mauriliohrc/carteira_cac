import type { FastifyInstance } from 'fastify';
import { prisma } from '../db/cliente.js';
import { exigirAdmin } from '../http/guardas.js';
import { naoEncontrado } from '../http/erros.js';

/** Caixa de contatos do site, para a equipe ler e marcar como tratado. */
export async function rotasContatosAdmin(app: FastifyInstance) {
  app.addHook('preHandler', exigirAdmin());

  app.get('/api/admin/contatos', async (req) => {
    const q = req.query as { tratado?: string };
    const where =
      q.tratado === '1' ? { tratado: true } : q.tratado === '0' ? { tratado: false } : {};
    const [contatos, naoTratados] = await Promise.all([
      prisma.contato.findMany({ where, orderBy: { criadoEm: 'desc' }, take: 200 }),
      prisma.contato.count({ where: { tratado: false } }),
    ]);
    return { contatos, naoTratados };
  });

  app.post('/api/admin/contatos/:id/tratar', async (req) => {
    const { id } = req.params as { id: string };
    const body = (req.body ?? {}) as { tratado?: boolean };
    const existe = await prisma.contato.findUnique({ where: { id } });
    if (!existe) throw naoEncontrado('Contato não encontrado');
    const contato = await prisma.contato.update({
      where: { id },
      data: { tratado: body.tratado ?? true },
    });
    return { contato };
  });
}
