import type { FastifyInstance, FastifyRequest } from 'fastify';
import { Prisma } from '@prisma/client';
import { prisma } from '../../db/cliente.js';
import { apresentarNoticiaPublica } from '../../http/apresentadores.js';
import { naoEncontrado } from '../../http/erros.js';
import { exigirApp, usuarioAppOpcional } from '../../http/guardas.js';

const COM_RELACOES = {
  midias: { orderBy: { ordem: 'asc' as const } },
  entidade: { select: { id: true, nome: true } },
};

/**
 * Monta o filtro de visibilidade das notícias para quem está pedindo:
 *  - anônimo (sem token válido): só as GERAIS (entidadeId = null);
 *  - logado: as GERAIS + as restritas às entidades a que o usuário é vinculado.
 */
async function filtroVisibilidade(req: FastifyRequest): Promise<Prisma.NoticiaWhereInput> {
  const usuarioId = usuarioAppOpcional(req);
  if (!usuarioId) return { status: 'PUBLICADA', entidadeId: null };

  const vinculos = await prisma.vinculoEntidade.findMany({
    where: { usuarioId },
    select: { entidadeId: true },
  });
  const entidadeIds = vinculos.map((v) => v.entidadeId);

  return {
    status: 'PUBLICADA',
    OR: [{ entidadeId: null }, ...(entidadeIds.length ? [{ entidadeId: { in: entidadeIds } }] : [])],
  };
}

/**
 * Notícias para o aplicativo — apenas PUBLICADAS, respeitando o alcance.
 * Paginação por cursor (lista infinita): mais recentes primeiro, desempate por id.
 */
export async function rotasNoticiasAppV1(app: FastifyInstance) {
  app.get('/app/noticias', async (req) => {
    const q = req.query as { cursor?: string; limite?: string };
    const limite = Math.min(50, Math.max(1, Number(q.limite) || 10));
    const where = await filtroVisibilidade(req);

    const lista = await prisma.noticia.findMany({
      where,
      orderBy: [{ publicadaEm: 'desc' }, { id: 'desc' }],
      include: COM_RELACOES,
      take: limite + 1, // +1 para saber se há próxima página
      ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
    });

    const temMais = lista.length > limite;
    const pagina = temMais ? lista.slice(0, limite) : lista;

    return {
      noticias: pagina.map(apresentarNoticiaPublica),
      proximoCursor: temMais ? pagina[pagina.length - 1]!.id : null,
    };
  });

  app.get('/app/noticias/:id', async (req) => {
    const { id } = req.params as { id: string };
    const where = await filtroVisibilidade(req);
    const n = await prisma.noticia.findFirst({
      where: { ...where, id },
      include: COM_RELACOES,
    });
    if (!n) throw naoEncontrado('Notícia não encontrada');
    return { noticia: apresentarNoticiaPublica(n) };
  });

  // Marca a notícia como lida pelo usuário logado (uma vez por pessoa).
  app.post('/app/noticias/:id/lida', { preHandler: exigirApp() }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const usuarioId = req.usuario!.id;
    const n = await prisma.noticia.findFirst({ where: { id, status: 'PUBLICADA' }, select: { id: true } });
    if (n) {
      await prisma.leituraNoticia.upsert({
        where: { noticiaId_usuarioId: { noticiaId: id, usuarioId } },
        create: { noticiaId: id, usuarioId },
        update: {},
      });
    }
    reply.code(204);
    return null;
  });
}
