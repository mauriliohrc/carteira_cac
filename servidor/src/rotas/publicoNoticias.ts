import type { FastifyInstance } from 'fastify';
import { prisma } from '../db/cliente.js';
import { apresentarNoticiaPublica } from '../http/apresentadores.js';
import { naoEncontrado } from '../http/erros.js';

const COM_RELACOES = {
  midias: { orderBy: { ordem: 'asc' as const } },
  entidade: { select: { id: true, nome: true } },
};

/**
 * Notícia PÚBLICA (sem autenticação) — a base da página web compartilhável
 * (backoffice.carteiracac.com/noticia/:id). Serve qualquer notícia PUBLICADA
 * por id, inclusive as exclusivas de entidade (compartilhamento por link é
 * aberto de propósito, para viralizar e converter novos usuários).
 */
export async function rotasPublicoNoticias(app: FastifyInstance) {
  app.get('/api/publico/noticias/:id', async (req) => {
    const { id } = req.params as { id: string };
    const noticia = await prisma.noticia.findFirst({
      where: { id, status: 'PUBLICADA' },
      include: COM_RELACOES,
    });
    if (!noticia) throw naoEncontrado('Notícia não encontrada');
    return { noticia: apresentarNoticiaPublica(noticia) };
  });
}
