import type { FastifyInstance, FastifyRequest } from 'fastify';
import { Prisma } from '@prisma/client';
import { prisma } from '../db/cliente.js';
import { ambiente } from '../config/ambiente.js';
import { exigirAdmin } from '../http/guardas.js';
import { invalido, naoEncontrado } from '../http/erros.js';
import { criarLojaSchema, editarLojaSchema } from '../dominio/validacao.js';
import { notificarAnuncioAprovado } from './v1/appMarketplace.js';

function baseUrl(req: FastifyRequest): string {
  if (ambiente.apiPublicaUrl) return ambiente.apiPublicaUrl;
  const proto = (req.headers['x-forwarded-proto'] as string | undefined) ?? req.protocol ?? 'http';
  const host = req.headers.host ?? `localhost:${ambiente.porta}`;
  return `${proto}://${host}`;
}

const INCLUIR = {
  fotos: { orderBy: { ordem: 'asc' as const } },
  loja: { select: { id: true, nome: true, verificada: true, ativo: true } },
  vendedor: { select: { id: true, nome: true, email: true, celular: true } },
} satisfies Prisma.AnuncioInclude;

type AnuncioAdmin = Prisma.AnuncioGetPayload<{ include: typeof INCLUIR }>;

/** Visão de moderação — o admin VÊ os dados do vendedor (diferente do app/web). */
function apresentar(a: AnuncioAdmin, base: string) {
  return {
    id: a.id,
    categoria: a.categoria,
    subcategoria: a.subcategoria,
    estadoUso: a.estadoUso,
    precoCentavos: a.precoCentavos,
    uf: a.uf,
    cidade: a.cidade,
    titulo: a.titulo,
    descricao: a.descricao,
    status: a.status,
    motivoRejeicao: a.motivoRejeicao,
    destaqueAte: a.destaqueAte,
    criadoEm: a.criadoEm,
    fotos: a.fotos.map((f) => `${base}/uploads/${f.uploadId}`),
    loja: a.loja,
    vendedor: a.vendedor, // nome/email/celular — só para moderação no backoffice
  };
}

/** Moderação do marketplace (backoffice). Todo acesso exige admin. */
export async function rotasMarketplaceAdmin(app: FastifyInstance) {
  app.addHook('preHandler', exigirAdmin());

  // Lista paginada por status (padrão: PENDENTE, a fila de moderação).
  app.get('/api/admin/marketplace/anuncios', async (req) => {
    const q = req.query as {
      status?: string;
      categoria?: string;
      uf?: string;
      busca?: string;
      pagina?: string;
      limite?: string;
    };
    const pagina = Math.max(1, Number(q.pagina) || 1);
    const limite = Math.min(100, Math.max(1, Number(q.limite) || 20));
    const where: Prisma.AnuncioWhereInput = {};
    if (q.status) where.status = q.status;
    if (q.categoria) where.categoria = q.categoria;
    if (q.uf) where.uf = q.uf.toUpperCase();
    if (q.busca)
      where.OR = [{ titulo: { contains: q.busca } }, { descricao: { contains: q.busca } }];

    const [total, lista] = await Promise.all([
      prisma.anuncio.count({ where }),
      prisma.anuncio.findMany({
        where,
        orderBy: { criadoEm: 'desc' },
        skip: (pagina - 1) * limite,
        take: limite,
        include: INCLUIR,
      }),
    ]);
    const base = baseUrl(req);
    return {
      anuncios: lista.map((a) => apresentar(a, base)),
      total,
      pagina,
      limite,
      totalPaginas: Math.max(1, Math.ceil(total / limite)),
    };
  });

  app.get('/api/admin/marketplace/anuncios/:id', async (req) => {
    const { id } = req.params as { id: string };
    const a = await prisma.anuncio.findUnique({ where: { id }, include: INCLUIR });
    if (!a) throw naoEncontrado('Anúncio não encontrado');
    return { anuncio: apresentar(a, baseUrl(req)) };
  });

  // Aprovar → APROVADO + push ao vendedor.
  app.post('/api/admin/marketplace/anuncios/:id/aprovar', async (req) => {
    const { id } = req.params as { id: string };
    const a = await prisma.anuncio.findUnique({ where: { id }, select: { id: true } });
    if (!a) throw naoEncontrado('Anúncio não encontrado');
    await prisma.anuncio.update({ where: { id }, data: { status: 'APROVADO', motivoRejeicao: null } });
    await notificarAnuncioAprovado(id);
    return { ok: true, status: 'APROVADO' };
  });

  // Reprovar → REJEITADO (motivo obrigatório; vai para o "Meus anúncios" do dono).
  app.post('/api/admin/marketplace/anuncios/:id/reprovar', async (req) => {
    const { id } = req.params as { id: string };
    const { motivo } = (req.body ?? {}) as { motivo?: string };
    if (!motivo?.trim()) throw invalido('Informe o motivo da reprovação.');
    const a = await prisma.anuncio.findUnique({ where: { id }, select: { id: true } });
    if (!a) throw naoEncontrado('Anúncio não encontrado');
    await prisma.anuncio.update({
      where: { id },
      data: { status: 'REJEITADO', motivoRejeicao: motivo.trim().slice(0, 500) },
    });
    return { ok: true, status: 'REJEITADO' };
  });

  // Pausar (tirar do ar) e remover definitivamente.
  app.post('/api/admin/marketplace/anuncios/:id/pausar', async (req) => {
    const { id } = req.params as { id: string };
    const a = await prisma.anuncio.findUnique({ where: { id }, select: { id: true } });
    if (!a) throw naoEncontrado('Anúncio não encontrado');
    await prisma.anuncio.update({ where: { id }, data: { status: 'PAUSADO' } });
    return { ok: true, status: 'PAUSADO' };
  });

  app.delete('/api/admin/marketplace/anuncios/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const a = await prisma.anuncio.findUnique({ where: { id }, select: { id: true } });
    if (!a) throw naoEncontrado('Anúncio não encontrado');
    await prisma.anuncio.delete({ where: { id } });
    reply.code(204);
    return null;
  });

  // ----------------------------------------------------------- denúncias (UGC)
  app.get('/api/admin/marketplace/denuncias', async (req) => {
    const q = req.query as { tratada?: string };
    const where = q.tratada === 'true' ? { tratada: true } : q.tratada === 'false' ? { tratada: false } : {};
    const denuncias = await prisma.denuncia.findMany({
      where,
      orderBy: { criadoEm: 'desc' },
      take: 200,
      include: { denunciante: { select: { id: true, nome: true, email: true } } },
    });
    return { denuncias };
  });

  app.post('/api/admin/marketplace/denuncias/:id/tratar', async (req) => {
    const { id } = req.params as { id: string };
    const { tratada } = (req.body ?? {}) as { tratada?: boolean };
    await prisma.denuncia.update({ where: { id }, data: { tratada: tratada !== false } });
    return { ok: true };
  });

  // ------------------------------------------------------------ lojas parceiras
  app.get('/api/admin/marketplace/lojas', async () => {
    const lojas = await prisma.loja.findMany({
      orderBy: { criadoEm: 'desc' },
      include: {
        usuario: { select: { id: true, nome: true, email: true } },
        _count: { select: { anuncios: true } },
      },
    });
    return { lojas };
  });

  app.post('/api/admin/marketplace/lojas', async (req, reply) => {
    const dados = criarLojaSchema.parse(req.body);
    const dono = await prisma.usuarioApp.findUnique({
      where: { email: dados.usuarioEmail },
      select: { id: true },
    });
    if (!dono) throw invalido('Nenhum usuário do app com esse e-mail.');
    const loja = await prisma.loja.create({
      data: {
        usuarioId: dono.id,
        nome: dados.nome,
        descricao: dados.descricao ?? null,
        logoUploadId: dados.logoUploadId ?? null,
        site: dados.site ?? null,
        whatsapp: dados.whatsapp ?? null,
        uf: dados.uf ?? null,
        cidade: dados.cidade ?? null,
        verificada: dados.verificada ?? false,
        ativo: dados.ativo ?? true,
      },
    });
    reply.code(201);
    return { loja };
  });

  app.patch('/api/admin/marketplace/lojas/:id', async (req) => {
    const { id } = req.params as { id: string };
    const dados = editarLojaSchema.parse(req.body);
    const loja = await prisma.loja.update({ where: { id }, data: dados });
    return { loja };
  });

  app.delete('/api/admin/marketplace/lojas/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    await prisma.loja.delete({ where: { id } });
    reply.code(204);
    return null;
  });

  // Métricas simples para o painel.
  app.get('/api/admin/marketplace/metricas', async () => {
    const porStatus = await prisma.anuncio.groupBy({ by: ['status'], _count: true });
    const pendentes = porStatus.find((s) => s.status === 'PENDENTE')?._count ?? 0;
    const total = porStatus.reduce((acc, s) => acc + (s._count as number), 0);
    const destacados = await prisma.anuncio.count({
      where: { status: 'APROVADO', destaqueAte: { gt: new Date() } },
    });
    return {
      total,
      pendentes,
      destacados,
      porStatus: Object.fromEntries(porStatus.map((s) => [s.status, s._count])),
    };
  });
}
