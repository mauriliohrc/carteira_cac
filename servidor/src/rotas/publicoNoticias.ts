import type { FastifyInstance } from 'fastify';
import { prisma } from '../db/cliente.js';
import {
  apresentarNoticiaPublica,
  apresentarNoticiaResumoPublico,
} from '../http/apresentadores.js';
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
  /**
   * Lista pública de notícias para o portal web (coluna "mais notícias" /
   * "anteriores"). Só notícias GERAIS publicadas — as exclusivas de entidade
   * continuam acessíveis por link direto, mas não são enumeradas aqui para não
   * expor acervo restrito de uma entidade a qualquer visitante. Aceita
   * `?excluir=<id>` (tira a notícia que o leitor já está vendo) e `?limite=`.
   */
  app.get('/api/publico/noticias', async (req) => {
    const q = req.query as { excluir?: string; limite?: string };
    const limite = Math.min(24, Math.max(1, Number(q.limite) || 12));
    const noticias = await prisma.noticia.findMany({
      where: {
        status: 'PUBLICADA',
        entidadeId: null,
        ...(q.excluir ? { id: { not: q.excluir } } : {}),
      },
      orderBy: { publicadaEm: 'desc' },
      take: limite,
      include: { entidade: { select: { id: true, nome: true } } },
    });
    return { noticias: noticias.map(apresentarNoticiaResumoPublico) };
  });

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
