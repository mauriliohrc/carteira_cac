import { randomBytes } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import { prisma } from '../db/cliente.js';
import { normalizarCupom } from '../dominio/cupom.js';
import { criarCupomSchema, editarCupomSchema } from '../dominio/validacao.js';
import { conflito, naoEncontrado } from '../http/erros.js';
import { exigirAdmin } from '../http/guardas.js';

function limpar<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;
}

/** Gera um código curto legível (ex.: "cac-7f3a9k"). */
function gerarCodigo(): string {
  return `cac-${randomBytes(4).toString('hex')}`;
}

export async function rotasCuponsAdmin(app: FastifyInstance) {
  app.addHook('preHandler', exigirAdmin());

  app.get('/api/admin/cupons', async () => {
    const cupons = await prisma.cupomPromocional.findMany({ orderBy: { criadoEm: 'desc' } });
    return { cupons };
  });

  app.post('/api/admin/cupons', async (req, reply) => {
    const dados = criarCupomSchema.parse(req.body);
    const codigo = normalizarCupom(dados.codigo || gerarCodigo());
    try {
      const cupom = await prisma.cupomPromocional.create({
        data: {
          codigo,
          descricao: dados.descricao ?? null,
          limiteUsos: dados.limiteUsos ?? null,
          expiraEm: dados.expiraEm ? new Date(dados.expiraEm) : null,
          ativo: dados.ativo ?? true,
        },
      });
      reply.code(201);
      return { cupom };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw conflito('Já existe um cupom com este código');
      }
      throw err;
    }
  });

  app.patch('/api/admin/cupons/:id', async (req) => {
    const { id } = req.params as { id: string };
    const atual = await prisma.cupomPromocional.findUnique({ where: { id } });
    if (!atual) throw naoEncontrado('Cupom não encontrado');
    const dados = editarCupomSchema.parse(req.body);
    const data = limpar({
      descricao: dados.descricao,
      limiteUsos: dados.limiteUsos,
      ativo: dados.ativo,
      expiraEm: dados.expiraEm === undefined ? undefined : dados.expiraEm ? new Date(dados.expiraEm) : null,
    });
    const cupom = await prisma.cupomPromocional.update({ where: { id }, data });
    return { cupom };
  });

  app.delete('/api/admin/cupons/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    await prisma.cupomPromocional.delete({ where: { id } }).catch(() => {});
    reply.code(204);
    return null;
  });

  // Quem resgatou este cupom.
  app.get('/api/admin/cupons/:id/usos', async (req) => {
    const { id } = req.params as { id: string };
    const usos = await prisma.usoCupom.findMany({
      where: { cupomId: id },
      orderBy: { criadoEm: 'desc' },
      take: 500,
      include: { usuario: { select: { nome: true, email: true, cpf: true } } },
    });
    return {
      usos: usos.map((u) => ({
        criadoEm: u.criadoEm,
        usuario: u.usuario
          ? { nome: u.usuario.nome, email: u.usuario.email, cpf: u.usuario.cpf }
          : null,
      })),
    };
  });
}
