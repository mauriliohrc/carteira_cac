import type { FastifyInstance } from 'fastify';
import { prisma } from '../db/cliente.js';
import {
  atualizarNoticiaEntidadeSchema,
  criarNoticiaEntidadeSchema,
  enviarPushEntidadeSchema,
} from '../dominio/validacao.js';
import type { StatusNoticia } from '../dominio/tipos.js';
import { apresentarNoticia } from '../http/apresentadores.js';
import { invalido, naoEncontrado, proibido } from '../http/erros.js';
import { exigirEntidade } from '../http/guardas.js';
import { enviarPush } from '../push/expo.js';

function limpar<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined)
  ) as Partial<T>;
}

function resolverPublicadaEm(statusNovo: StatusNoticia, publicadaEmAtual: Date | null): Date | null {
  if (statusNovo === 'PUBLICADA') return publicadaEmAtual ?? new Date();
  return null;
}

const COM_MIDIAS = {
  midias: { orderBy: { ordem: 'asc' as const } },
  entidade: { select: { id: true, nome: true } },
  _count: { select: { leituras: true } },
};

type MidiaEntrada = { tipo: string; url: string; legenda?: string | null };
function criarMidias(midias: MidiaEntrada[]) {
  return midias.map((m, i) => ({ tipo: m.tipo, url: m.url, legenda: m.legenda ?? null, ordem: i }));
}

/**
 * Rotas do painel da ENTIDADE. Tudo aqui é no escopo da própria entidade do
 * usuário autenticado (`req.usuario.entidadeId`), nunca de outra — as notícias
 * que ela cria nascem restritas aos seus sócios, e o push só alcança eles.
 */
export async function rotasEntidade(app: FastifyInstance) {
  app.addHook('preHandler', exigirEntidade());

  // Push (notificações) é só do ADMIN_ENTIDADE; operador faz notícias e competições.
  function exigirAdminEntidade(req: { usuario?: { papel?: string } }) {
    if (req.usuario?.papel !== 'ADMIN_ENTIDADE') {
      throw proibido('Apenas administradores da entidade podem enviar notificações');
    }
  }

  // Acha uma notícia garantindo que pertence à entidade do requisitante.
  async function acharDaEntidade(id: string, entidadeId: string) {
    const n = await prisma.noticia.findFirst({ where: { id, entidadeId }, include: COM_MIDIAS });
    if (!n) throw naoEncontrado('Notícia não encontrada');
    return n;
  }

  // -------------------------------------------------- notícias da entidade
  app.get('/api/entidade/noticias', async (req) => {
    const entidadeId = req.usuario!.entidadeId!;
    const q = req.query as { pagina?: string; limite?: string; status?: string };
    const pagina = Math.max(1, Number(q.pagina) || 1);
    const limite = Math.min(100, Math.max(1, Number(q.limite) || 20));
    const where = { entidadeId, ...(q.status ? { status: q.status } : {}) };

    const [total, lista] = await Promise.all([
      prisma.noticia.count({ where }),
      prisma.noticia.findMany({
        where,
        orderBy: { criadoEm: 'desc' },
        skip: (pagina - 1) * limite,
        take: limite,
        include: {
          entidade: { select: { id: true, nome: true } },
          _count: { select: { leituras: true } },
        },
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

  app.get('/api/entidade/noticias/:id', async (req) => {
    const { id } = req.params as { id: string };
    return { noticia: apresentarNoticia(await acharDaEntidade(id, req.usuario!.entidadeId!)) };
  });

  app.post('/api/entidade/noticias', async (req, reply) => {
    const entidadeId = req.usuario!.entidadeId!;
    const dados = criarNoticiaEntidadeSchema.parse(req.body);
    const status = (dados.status ?? 'RASCUNHO') as StatusNoticia;
    const n = await prisma.noticia.create({
      data: {
        titulo: dados.titulo,
        resumo: dados.resumo ?? null,
        conteudo: dados.conteudo,
        imagemUrl: dados.imagemUrl ?? null,
        status,
        publicadaEm: resolverPublicadaEm(status, null),
        // autorId fica nulo: pertence ao admin do app; o dono é a entidade.
        entidadeId,
        ...(dados.midias?.length ? { midias: { create: criarMidias(dados.midias) } } : {}),
      },
      include: COM_MIDIAS,
    });
    reply.code(201);
    return { noticia: apresentarNoticia(n) };
  });

  app.patch('/api/entidade/noticias/:id', async (req) => {
    const { id } = req.params as { id: string };
    const entidadeId = req.usuario!.entidadeId!;
    const atual = await acharDaEntidade(id, entidadeId);
    const { midias, ...resto } = atualizarNoticiaEntidadeSchema.parse(req.body);
    const dados = limpar(resto) as Record<string, unknown>;

    if (typeof dados.status === 'string') {
      dados.publicadaEm = resolverPublicadaEm(dados.status as StatusNoticia, atual.publicadaEm);
    }
    if (midias !== undefined) {
      dados.midias = { deleteMany: {}, create: criarMidias(midias) };
    }

    const n = await prisma.noticia.update({ where: { id }, data: dados, include: COM_MIDIAS });
    return { noticia: apresentarNoticia(n) };
  });

  app.delete('/api/entidade/noticias/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    await acharDaEntidade(id, req.usuario!.entidadeId!);
    await prisma.noticia.delete({ where: { id } });
    reply.code(204);
    return null;
  });

  app.post('/api/entidade/noticias/:id/publicar', async (req) => {
    const { id } = req.params as { id: string };
    const entidadeId = req.usuario!.entidadeId!;
    const atual = await acharDaEntidade(id, entidadeId);
    const body = (req.body ?? {}) as { publicar?: boolean };
    if (typeof body.publicar !== 'boolean') throw invalido('Informe "publicar": true|false');
    const status: StatusNoticia = body.publicar ? 'PUBLICADA' : 'RASCUNHO';
    const n = await prisma.noticia.update({
      where: { id },
      data: { status, publicadaEm: resolverPublicadaEm(status, atual.publicadaEm) },
      include: COM_MIDIAS,
    });
    return { noticia: apresentarNoticia(n) };
  });

  // ------------------------------------------------ push para os sócios
  app.post('/api/entidade/push', async (req) => {
    exigirAdminEntidade(req);
    const entidadeId = req.usuario!.entidadeId!;
    const { titulo, corpo, dados } = enviarPushEntidadeSchema.parse(req.body);

    // Só usuários ativos vinculados a ESTA entidade e seus aparelhos ativos.
    const usuarios = await prisma.usuarioApp.findMany({
      where: { ativo: true, vinculos: { some: { entidadeId } } },
      select: { id: true },
    });
    const ids = usuarios.map((u) => u.id);
    const dispositivos = ids.length
      ? await prisma.dispositivoPush.findMany({
          where: { usuarioId: { in: ids }, ativo: true },
          select: { token: true },
        })
      : [];
    const tokens = dispositivos.map((d) => d.token);

    const resultado = await enviarPush(tokens, { titulo, corpo, dados });

    const mortos = resultado.erros
      .filter((e) => /DeviceNotRegistered/i.test(e.motivo))
      .map((e) => e.token);
    if (mortos.length) {
      await prisma.dispositivoPush.updateMany({
        where: { token: { in: mortos } },
        data: { ativo: false },
      });
    }

    await prisma.envioPush.create({
      data: {
        titulo,
        corpo,
        alvoTipo: 'ENTIDADE',
        alvoRef: entidadeId,
        totalUsuarios: ids.length,
        totalTokens: tokens.length,
        totalAceitos: resultado.aceitos,
        autorId: req.usuario!.id,
      },
    });

    return {
      totalUsuarios: ids.length,
      totalTokens: tokens.length,
      aceitos: resultado.aceitos,
      falhas: resultado.erros.length,
    };
  });

  app.get('/api/entidade/push', async (req) => {
    exigirAdminEntidade(req);
    const entidadeId = req.usuario!.entidadeId!;
    const q = req.query as { limite?: string };
    const limite = Math.min(100, Math.max(1, Number(q.limite) || 30));
    const envios = await prisma.envioPush.findMany({
      where: { alvoTipo: 'ENTIDADE', alvoRef: entidadeId },
      orderBy: { criadoEm: 'desc' },
      take: limite,
    });
    return { envios };
  });

  // Quantos sócios/aparelhos a entidade alcança (para a tela de push).
  app.get('/api/entidade/alcance', async (req) => {
    exigirAdminEntidade(req);
    const entidadeId = req.usuario!.entidadeId!;
    const [socios, dispositivos] = await Promise.all([
      prisma.usuarioApp.count({ where: { ativo: true, vinculos: { some: { entidadeId } } } }),
      prisma.dispositivoPush.count({
        where: { ativo: true, usuario: { ativo: true, vinculos: { some: { entidadeId } } } },
      }),
    ]);
    return { socios, dispositivos };
  });
}
