import type { FastifyInstance } from 'fastify';
import { prisma } from '../db/cliente.js';
import {
  atualizarNoticiaSchema,
  criarNoticiaSchema,
} from '../dominio/validacao.js';
import type { StatusNoticia } from '../dominio/tipos.js';
import { apresentarNoticia } from '../http/apresentadores.js';
import { invalido, naoEncontrado } from '../http/erros.js';
import { exigirAdmin } from '../http/guardas.js';

function limpar<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined)
  ) as Partial<T>;
}

/**
 * Define publicadaEm conforme o status:
 *  - vira PUBLICADA e ainda não tinha data  -> agora
 *  - vira RASCUNHO                           -> null (some do app)
 *  - continua PUBLICADA                      -> mantém a data original
 */
function resolverPublicadaEm(
  statusNovo: StatusNoticia,
  publicadaEmAtual: Date | null
): Date | null {
  if (statusNovo === 'PUBLICADA') return publicadaEmAtual ?? new Date();
  return null;
}

const COM_MIDIAS = {
  midias: { orderBy: { ordem: 'asc' as const } },
  entidade: { select: { id: true, nome: true } },
};

async function achar(id: string) {
  const n = await prisma.noticia.findUnique({ where: { id }, include: COM_MIDIAS });
  if (!n) throw naoEncontrado('Notícia não encontrada');
  return n;
}

/** Confere que a entidade existe quando um alcance é informado. */
async function validarEntidade(entidadeId: string | null | undefined) {
  if (!entidadeId) return;
  const ent = await prisma.entidadeTiro.findUnique({ where: { id: entidadeId } });
  if (!ent) throw naoEncontrado('Entidade não encontrada');
}

type MidiaEntrada = { tipo: string; url: string; legenda?: string | null };

/** Monta o bloco `create` de mídias com a ordem = posição no array. */
function criarMidias(midias: MidiaEntrada[]) {
  return midias.map((m, i) => ({
    tipo: m.tipo,
    url: m.url,
    legenda: m.legenda ?? null,
    ordem: i,
  }));
}

export async function rotasNoticias(app: FastifyInstance) {
  app.addHook('preHandler', exigirAdmin());

  // ------------------------------------------------- lista paginada (admin)
  app.get('/api/admin/noticias', async (req) => {
    const q = req.query as { pagina?: string; limite?: string; status?: string };
    const pagina = Math.max(1, Number(q.pagina) || 1);
    const limite = Math.min(100, Math.max(1, Number(q.limite) || 20));
    const where = q.status ? { status: q.status } : {};

    const [total, lista] = await Promise.all([
      prisma.noticia.count({ where }),
      prisma.noticia.findMany({
        where,
        orderBy: { criadoEm: 'desc' },
        skip: (pagina - 1) * limite,
        take: limite,
        include: { entidade: { select: { id: true, nome: true } } },
      }),
    ]);

    return {
      noticias: lista.map(apresentarNoticia),
      total,
      pagina,
      limite,
      totalPaginas: Math.max(1, Math.ceil(total / limite)),
    };
  });

  app.get('/api/admin/noticias/:id', async (req) => {
    const { id } = req.params as { id: string };
    return { noticia: apresentarNoticia(await achar(id)) };
  });

  app.post('/api/admin/noticias', async (req, reply) => {
    const dados = criarNoticiaSchema.parse(req.body);
    await validarEntidade(dados.entidadeId);
    const status = (dados.status ?? 'RASCUNHO') as StatusNoticia;
    const n = await prisma.noticia.create({
      data: {
        titulo: dados.titulo,
        resumo: dados.resumo ?? null,
        conteudo: dados.conteudo,
        imagemUrl: dados.imagemUrl ?? null,
        status,
        publicadaEm: resolverPublicadaEm(status, null),
        autorId: req.usuario!.id,
        entidadeId: dados.entidadeId ?? null,
        ...(dados.midias?.length ? { midias: { create: criarMidias(dados.midias) } } : {}),
      },
      include: COM_MIDIAS,
    });
    reply.code(201);
    return { noticia: apresentarNoticia(n) };
  });

  app.patch('/api/admin/noticias/:id', async (req) => {
    const { id } = req.params as { id: string };
    const atual = await achar(id);
    const { midias, ...resto } = atualizarNoticiaSchema.parse(req.body);
    await validarEntidade(resto.entidadeId);
    const dados = limpar(resto) as Record<string, unknown>;

    // Se o status muda (ou vem junto), recalcula publicadaEm.
    if (typeof dados.status === 'string') {
      dados.publicadaEm = resolverPublicadaEm(dados.status as StatusNoticia, atual.publicadaEm);
    }

    // Mídias enviadas substituem a galeria inteira (apaga e recria na ordem).
    if (midias !== undefined) {
      dados.midias = { deleteMany: {}, create: criarMidias(midias) };
    }

    const n = await prisma.noticia.update({
      where: { id },
      data: dados,
      include: COM_MIDIAS,
    });
    return { noticia: apresentarNoticia(n) };
  });

  app.delete('/api/admin/noticias/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    await achar(id);
    await prisma.noticia.delete({ where: { id } });
    reply.code(204);
    return null;
  });

  // Atalho: publicar / despublicar sem reenviar o corpo inteiro.
  app.post('/api/admin/noticias/:id/publicar', async (req) => {
    const { id } = req.params as { id: string };
    const atual = await achar(id);
    const body = (req.body ?? {}) as { publicar?: boolean };
    if (typeof body.publicar !== 'boolean') throw invalido('Informe "publicar": true|false');
    const status: StatusNoticia = body.publicar ? 'PUBLICADA' : 'RASCUNHO';
    const n = await prisma.noticia.update({
      where: { id },
      data: { status, publicadaEm: resolverPublicadaEm(status, atual.publicadaEm) },
    });
    return { noticia: apresentarNoticia(n) };
  });
}
