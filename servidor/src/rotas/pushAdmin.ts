import type { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import { prisma } from '../db/cliente.js';
import { JANELA_ONLINE_MIN } from '../dominio/tipos.js';
import { addVinculoSchema, editarUsuarioAppSchema, enviarPushSchema } from '../dominio/validacao.js';
import { enviarPush } from '../push/expo.js';
import { conflito, naoEncontrado } from '../http/erros.js';
import { exigirAdmin } from '../http/guardas.js';

type Alvo =
  | { tipo: 'TODOS' }
  | { tipo: 'ENTIDADE'; entidadeId: string }
  | { tipo: 'USUARIO'; usuarioId: string }
  | { tipo: 'INATIVOS'; diasSemAcesso: number };

function estaOnline(ultimoAcessoEm: Date | null): boolean {
  if (!ultimoAcessoEm) return false;
  return Date.now() - ultimoAcessoEm.getTime() < JANELA_ONLINE_MIN * 60_000;
}

/** Resolve os IDs de usuários-alvo conforme o tipo de segmentação. */
async function resolverAlvo(alvo: Alvo): Promise<{ id: string }[]> {
  const ativo: Prisma.UsuarioAppWhereInput = { ativo: true };

  switch (alvo.tipo) {
    case 'TODOS':
      return prisma.usuarioApp.findMany({ where: ativo, select: { id: true } });
    case 'ENTIDADE':
      return prisma.usuarioApp.findMany({
        where: { ...ativo, vinculos: { some: { entidadeId: alvo.entidadeId } } },
        select: { id: true },
      });
    case 'USUARIO':
      return prisma.usuarioApp.findMany({
        where: { id: alvo.usuarioId },
        select: { id: true },
      });
    case 'INATIVOS': {
      const corte = new Date(Date.now() - alvo.diasSemAcesso * 86_400_000);
      return prisma.usuarioApp.findMany({
        where: { ...ativo, OR: [{ ultimoAcessoEm: null }, { ultimoAcessoEm: { lt: corte } }] },
        select: { id: true },
      });
    }
  }
}

export async function rotasPushAdmin(app: FastifyInstance) {
  app.addHook('preHandler', exigirAdmin());

  // ------------------------------------------------- usuários do aplicativo
  app.get('/api/admin/usuarios-app', async (req) => {
    const q = req.query as { pagina?: string; limite?: string; busca?: string };
    const pagina = Math.max(1, Number(q.pagina) || 1);
    const limite = Math.min(100, Math.max(1, Number(q.limite) || 20));
    const busca = (q.busca ?? '').trim();

    const where: Prisma.UsuarioAppWhereInput = (() => {
      if (!busca) return {};
      const OR: Prisma.UsuarioAppWhereInput[] = [
        { nome: { contains: busca } },
        { email: { contains: busca } },
      ];
      // Só filtra por CPF quando o termo tem dígitos — senão `contains('')`
      // casaria com todo mundo.
      const digitos = busca.replace(/\D/g, '');
      if (digitos) OR.push({ cpf: { contains: digitos } });
      return { OR };
    })();

    const [total, lista] = await Promise.all([
      prisma.usuarioApp.count({ where }),
      prisma.usuarioApp.findMany({
        where,
        orderBy: { criadoEm: 'desc' },
        skip: (pagina - 1) * limite,
        take: limite,
        include: {
          vinculos: { include: { entidade: { select: { id: true, nome: true } } } },
          _count: { select: { dispositivos: { where: { ativo: true } } } },
        },
      }),
    ]);

    return {
      usuarios: lista.map((u) => ({
        id: u.id,
        nome: u.nome,
        email: u.email,
        cpf: u.cpf,
        ativo: u.ativo,
        premium: u.premium,
        entidades: u.vinculos.map((v) => ({ id: v.entidade.id, nome: v.entidade.nome, origem: v.origem })),
        ultimoAcessoEm: u.ultimoAcessoEm,
        online: estaOnline(u.ultimoAcessoEm),
        dispositivos: u._count.dispositivos,
        criadoEm: u.criadoEm,
      })),
      total,
      pagina,
      limite,
      totalPaginas: Math.max(1, Math.ceil(total / limite)),
    };
  });

  // Edita os dados do usuário do app (nome, e-mail, CPF, status).
  app.patch('/api/admin/usuarios-app/:id', async (req) => {
    const { id } = req.params as { id: string };
    const dados = editarUsuarioAppSchema.parse(req.body);
    const usuario = await prisma.usuarioApp.findUnique({ where: { id } });
    if (!usuario) throw naoEncontrado('Usuário não encontrado');
    try {
      await prisma.usuarioApp.update({ where: { id }, data: dados });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const alvo = String(err.meta?.target ?? '');
        throw conflito(alvo.includes('cpf') ? 'CPF já cadastrado' : 'E-mail já cadastrado');
      }
      throw err;
    }
    return { ok: true };
  });

  // Vincula o usuário a uma entidade (manual, pelo backoffice).
  app.post('/api/admin/usuarios-app/:id/vinculos', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { entidadeId } = addVinculoSchema.parse(req.body);
    const usuario = await prisma.usuarioApp.findUnique({ where: { id } });
    if (!usuario) throw naoEncontrado('Usuário não encontrado');
    const ent = await prisma.entidadeTiro.findUnique({ where: { id: entidadeId } });
    if (!ent) throw naoEncontrado('Entidade não encontrada');
    await prisma.vinculoEntidade.upsert({
      where: { usuarioId_entidadeId: { usuarioId: id, entidadeId } },
      create: { usuarioId: id, entidadeId, origem: 'MANUAL' },
      update: {},
    });
    reply.code(201);
    return { ok: true };
  });

  // Remove um vínculo do usuário com uma entidade.
  app.delete('/api/admin/usuarios-app/:id/vinculos/:entidadeId', async (req, reply) => {
    const { id, entidadeId } = req.params as { id: string; entidadeId: string };
    await prisma.vinculoEntidade.deleteMany({ where: { usuarioId: id, entidadeId } });
    reply.code(204);
    return null;
  });

  // ---------------------------------------------------------- enviar push
  app.post('/api/admin/push', async (req) => {
    const { titulo, corpo, dados, alvo } = enviarPushSchema.parse(req.body);

    // Valida referências do alvo cedo, para erro claro.
    if (alvo.tipo === 'ENTIDADE') {
      const ent = await prisma.entidadeTiro.findUnique({ where: { id: alvo.entidadeId } });
      if (!ent) throw naoEncontrado('Entidade não encontrada');
    }
    if (alvo.tipo === 'USUARIO') {
      const u = await prisma.usuarioApp.findUnique({ where: { id: alvo.usuarioId } });
      if (!u) throw naoEncontrado('Usuário não encontrado');
    }

    // TODOS alcança todos os aparelhos ativos, inclusive anônimos (sem conta).
    // Os demais alvos resolvem usuários e pegam só os aparelhos deles.
    let tokens: string[];
    let totalUsuarios: number;
    if (alvo.tipo === 'TODOS') {
      const dispositivos = await prisma.dispositivoPush.findMany({
        where: { ativo: true },
        select: { token: true },
      });
      tokens = dispositivos.map((d) => d.token);
      totalUsuarios = await prisma.usuarioApp.count({ where: { ativo: true } });
    } else {
      const usuarios = await resolverAlvo(alvo as Alvo);
      const ids = usuarios.map((u) => u.id);
      const dispositivos = ids.length
        ? await prisma.dispositivoPush.findMany({
            where: { usuarioId: { in: ids }, ativo: true },
            select: { token: true },
          })
        : [];
      tokens = dispositivos.map((d) => d.token);
      totalUsuarios = ids.length;
    }

    const resultado = await enviarPush(tokens, { titulo, corpo, dados });

    // Desativa tokens que a Expo diz não existirem mais.
    const mortos = resultado.erros
      .filter((e) => /DeviceNotRegistered/i.test(e.motivo))
      .map((e) => e.token);
    if (mortos.length) {
      await prisma.dispositivoPush.updateMany({
        where: { token: { in: mortos } },
        data: { ativo: false },
      });
    }

    const alvoRef =
      alvo.tipo === 'ENTIDADE'
        ? alvo.entidadeId
        : alvo.tipo === 'USUARIO'
          ? alvo.usuarioId
          : alvo.tipo === 'INATIVOS'
            ? String(alvo.diasSemAcesso)
            : null;

    await prisma.envioPush.create({
      data: {
        titulo,
        corpo,
        alvoTipo: alvo.tipo,
        alvoRef,
        totalUsuarios,
        totalTokens: tokens.length,
        totalAceitos: resultado.aceitos,
        autorId: req.usuario!.id,
      },
    });

    return {
      totalUsuarios,
      totalTokens: tokens.length,
      aceitos: resultado.aceitos,
      falhas: resultado.erros.length,
    };
  });

  // Histórico dos disparos (mais recentes primeiro).
  app.get('/api/admin/push', async (req) => {
    const q = req.query as { limite?: string };
    const limite = Math.min(100, Math.max(1, Number(q.limite) || 30));
    const envios = await prisma.envioPush.findMany({
      orderBy: { criadoEm: 'desc' },
      take: limite,
    });
    return { envios };
  });
}
