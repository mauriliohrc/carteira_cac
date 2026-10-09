import type { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import { gerarHash } from '../auth/senha.js';
import { prisma } from '../db/cliente.js';
import {
  atualizarEntidadeSchema,
  atualizarUsuarioEntidadeSchema,
  criarEntidadeSchema,
  criarUsuarioEntidadeSchema,
} from '../dominio/validacao.js';
import {
  apresentarEntidade,
  apresentarUsuarioEntidade,
} from '../http/apresentadores.js';
import { conflito, naoEncontrado } from '../http/erros.js';
import { exigirAdmin } from '../http/guardas.js';
import { candidatosSubdominio } from '../dominio/subdominio.js';

/** Primeiro subdomínio livre derivado do nome (ou null se o nome não gera um). */
async function escolherSubdominioLivre(nome: string): Promise<string | null> {
  for (const cand of candidatosSubdominio(nome)) {
    const existe = await prisma.entidadeTiro.findUnique({
      where: { subdominio: cand },
      select: { id: true },
    });
    if (!existe) return cand;
  }
  return null;
}

// Remove undefined para não sobrescrever campos num update parcial.
function limpar<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined)
  ) as Partial<T>;
}

async function acharEntidade(id: string) {
  const e = await prisma.entidadeTiro.findUnique({ where: { id } });
  if (!e) throw naoEncontrado('Entidade não encontrada');
  return e;
}

export async function rotasEntidades(app: FastifyInstance) {
  // Tudo aqui exige admin do app autenticado.
  app.addHook('preHandler', exigirAdmin());

  // ----------------------------------------------------------- Entidades
  app.get('/api/admin/entidades', async () => {
    const lista = await prisma.entidadeTiro.findMany({
      orderBy: { criadoEm: 'desc' },
      include: { _count: { select: { usuarios: true } } },
    });
    return {
      entidades: lista.map((e) => ({
        ...apresentarEntidade(e),
        totalUsuarios: e._count.usuarios,
      })),
    };
  });

  app.get('/api/admin/entidades/:id', async (req) => {
    const { id } = req.params as { id: string };
    const e = await acharEntidade(id);
    return { entidade: apresentarEntidade(e) };
  });

  app.post('/api/admin/entidades', async (req, reply) => {
    const dados = criarEntidadeSchema.parse(req.body);
    try {
      // Subdomínio público nasce do nome: "3Gun" -> 3gun.carteiracac.com.
      const subdominio = await escolherSubdominioLivre(dados.nome);
      const e = await prisma.entidadeTiro.create({ data: { ...dados, subdominio } });
      reply.code(201);
      return { entidade: apresentarEntidade(e) };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw conflito('Já existe uma entidade com este CNPJ');
      }
      throw err;
    }
  });

  app.patch('/api/admin/entidades/:id', async (req) => {
    const { id } = req.params as { id: string };
    await acharEntidade(id);
    const dados = limpar(atualizarEntidadeSchema.parse(req.body));
    try {
      const e = await prisma.entidadeTiro.update({ where: { id }, data: dados });
      return { entidade: apresentarEntidade(e) };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw conflito('Já existe uma entidade com este CNPJ');
      }
      throw err;
    }
  });

  app.delete('/api/admin/entidades/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    await acharEntidade(id);
    await prisma.entidadeTiro.delete({ where: { id } }); // usuários caem em cascata
    reply.code(204);
    return null;
  });

  // --------------------------------------------- Usuários de uma entidade
  app.get('/api/admin/entidades/:id/usuarios', async (req) => {
    const { id } = req.params as { id: string };
    await acharEntidade(id);
    const usuarios = await prisma.usuarioEntidade.findMany({
      where: { entidadeId: id },
      orderBy: { criadoEm: 'desc' },
    });
    return { usuarios: usuarios.map(apresentarUsuarioEntidade) };
  });

  app.post('/api/admin/entidades/:id/usuarios', async (req, reply) => {
    const { id } = req.params as { id: string };
    await acharEntidade(id);
    const { senha, ...resto } = criarUsuarioEntidadeSchema.parse(req.body);
    try {
      const u = await prisma.usuarioEntidade.create({
        data: { ...resto, entidadeId: id, senhaHash: await gerarHash(senha) },
      });
      reply.code(201);
      return { usuario: apresentarUsuarioEntidade(u) };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw conflito('Já existe um usuário com este e-mail nesta entidade');
      }
      throw err;
    }
  });

  app.patch('/api/admin/entidades/:id/usuarios/:usuarioId', async (req) => {
    const { id, usuarioId } = req.params as { id: string; usuarioId: string };
    const atual = await prisma.usuarioEntidade.findFirst({
      where: { id: usuarioId, entidadeId: id },
    });
    if (!atual) throw naoEncontrado('Usuário não encontrado nesta entidade');

    const { senha, ...resto } = atualizarUsuarioEntidadeSchema.parse(req.body);
    const data = limpar(resto) as Record<string, unknown>;
    if (senha) data.senhaHash = await gerarHash(senha);

    try {
      const u = await prisma.usuarioEntidade.update({ where: { id: usuarioId }, data });
      return { usuario: apresentarUsuarioEntidade(u) };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw conflito('Já existe um usuário com este e-mail nesta entidade');
      }
      throw err;
    }
  });

  app.delete('/api/admin/entidades/:id/usuarios/:usuarioId', async (req, reply) => {
    const { id, usuarioId } = req.params as { id: string; usuarioId: string };
    const atual = await prisma.usuarioEntidade.findFirst({
      where: { id: usuarioId, entidadeId: id },
    });
    if (!atual) throw naoEncontrado('Usuário não encontrado nesta entidade');
    await prisma.usuarioEntidade.delete({ where: { id: usuarioId } });
    reply.code(204);
    return null;
  });
}
