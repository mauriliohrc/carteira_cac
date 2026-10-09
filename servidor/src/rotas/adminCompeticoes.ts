import type { FastifyInstance } from 'fastify';
import { prisma } from '../db/cliente.js';
import {
  atualizarCategoriaSchema,
  atualizarCompeticaoSchema,
  criarCategoriaSchema,
  criarCompeticaoSchema,
  lancarResultadoSchema,
} from '../dominio/validacao.js';
import { limparCPF, validarCPF } from '../dominio/cpf.js';
import { ranquear } from '../dominio/ranking.js';
import { invalido, naoEncontrado } from '../http/erros.js';
import { exigirAdmin } from '../http/guardas.js';
import {
  apresentarCategoria,
  apresentarCompeticao,
  apresentarResultado,
  limpar,
  notificarResultado,
  previaAtirador,
  resolverAtirador,
} from './competicoesComum.js';

/**
 * Competições pelo ADMIN do app (super admin / suporte). Mesmas operações da
 * entidade, mas o escopo vem da entidade na URL — o admin gere qualquer uma.
 */
export async function rotasAdminCompeticoes(app: FastifyInstance) {
  app.addHook('preHandler', exigirAdmin());

  async function exigirEntidadeExiste(entidadeId: string) {
    const e = await prisma.entidadeTiro.findUnique({ where: { id: entidadeId } });
    if (!e) throw naoEncontrado('Entidade não encontrada');
    return e;
  }
  async function acharCompeticao(id: string) {
    const c = await prisma.competicao.findUnique({ where: { id } });
    if (!c) throw naoEncontrado('Competição não encontrada');
    return c;
  }
  async function acharCategoria(id: string) {
    const cat = await prisma.categoriaCompeticao.findUnique({
      where: { id },
      include: { competicao: true },
    });
    if (!cat) throw naoEncontrado('Categoria não encontrada');
    return cat;
  }

  // ------------------------------------------------------- competições
  app.get('/api/admin/entidades/:entidadeId/competicoes', async (req) => {
    const { entidadeId } = req.params as { entidadeId: string };
    await exigirEntidadeExiste(entidadeId);
    const comps = await prisma.competicao.findMany({
      where: { entidadeId },
      orderBy: { dataInicio: 'desc' },
      include: { _count: { select: { categorias: true } } },
    });
    return { competicoes: comps.map(apresentarCompeticao) };
  });

  app.post('/api/admin/entidades/:entidadeId/competicoes', async (req, reply) => {
    const { entidadeId } = req.params as { entidadeId: string };
    await exigirEntidadeExiste(entidadeId);
    const d = criarCompeticaoSchema.parse(req.body);
    const comp = await prisma.competicao.create({
      data: {
        entidadeId,
        nome: d.nome,
        descricao: d.descricao ?? null,
        bannerUrl: d.bannerUrl ?? null,
        regras: d.regras ?? null,
        dataInicio: d.dataInicio,
        dataFim: d.dataFim,
        ativo: d.ativo ?? true,
      },
    });
    reply.code(201);
    return { competicao: apresentarCompeticao(comp) };
  });

  app.get('/api/admin/competicoes/:id', async (req) => {
    const { id } = req.params as { id: string };
    await acharCompeticao(id);
    const comp = await prisma.competicao.findUnique({
      where: { id },
      include: {
        entidade: { select: { subdominio: true } },
        categorias: {
          orderBy: { criadoEm: 'asc' },
          include: { _count: { select: { resultados: true } } },
        },
      },
    });
    const dados = apresentarCompeticao(comp!);
    dados.categorias = comp!.categorias.map((cat) =>
      apresentarCategoria(cat, (cat as { _count?: { resultados: number } })._count?.resultados ?? 0)
    );
    return { competicao: dados };
  });

  app.patch('/api/admin/competicoes/:id', async (req) => {
    const { id } = req.params as { id: string };
    await acharCompeticao(id);
    const dados = limpar(atualizarCompeticaoSchema.parse(req.body));
    const comp = await prisma.competicao.update({ where: { id }, data: dados });
    return { competicao: apresentarCompeticao(comp) };
  });

  app.delete('/api/admin/competicoes/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    await acharCompeticao(id);
    await prisma.competicao.delete({ where: { id } });
    reply.code(204);
    return null;
  });

  // --------------------------------------------------------- categorias
  app.post('/api/admin/competicoes/:id/categorias', async (req, reply) => {
    const { id } = req.params as { id: string };
    await acharCompeticao(id);
    const d = criarCategoriaSchema.parse(req.body);
    const cat = await prisma.categoriaCompeticao.create({
      data: {
        competicaoId: id,
        nome: d.nome,
        descricao: d.descricao ?? null,
        regras: d.regras ?? null,
        dataInicio: d.dataInicio ?? null,
        dataFim: d.dataFim ?? null,
        ordenamento: d.ordenamento ?? 'MAIOR',
      },
    });
    reply.code(201);
    return { categoria: apresentarCategoria(cat, 0) };
  });

  app.patch('/api/admin/categorias/:id', async (req) => {
    const { id } = req.params as { id: string };
    await acharCategoria(id);
    const dados = limpar(atualizarCategoriaSchema.parse(req.body));
    const cat = await prisma.categoriaCompeticao.update({ where: { id }, data: dados });
    return { categoria: apresentarCategoria(cat) };
  });

  app.delete('/api/admin/categorias/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    await acharCategoria(id);
    await prisma.categoriaCompeticao.delete({ where: { id } });
    reply.code(204);
    return null;
  });

  // ----------------------------------------------------------- resultados
  app.get('/api/admin/entidades/:entidadeId/atirador/:cpf', async (req) => {
    const { entidadeId, cpf: cpfBruto } = req.params as { entidadeId: string; cpf: string };
    const cpf = limparCPF(cpfBruto);
    if (!validarCPF(cpf)) throw invalido('CPF inválido');
    const entidade = await prisma.entidadeTiro.findUnique({ where: { id: entidadeId } });
    return previaAtirador(entidade, cpf);
  });

  app.get('/api/admin/categorias/:id/resultados', async (req) => {
    const { id } = req.params as { id: string };
    const cat = await acharCategoria(id);
    const resultados = await prisma.resultadoCompeticao.findMany({ where: { categoriaId: id } });
    const ranqueados = ranquear(resultados, cat.ordenamento);
    return {
      categoria: apresentarCategoria(cat, resultados.length),
      resultados: ranqueados.map(apresentarResultado),
    };
  });

  app.post('/api/admin/categorias/:id/resultados', async (req, reply) => {
    const { id } = req.params as { id: string };
    const cat = await acharCategoria(id);
    const d = lancarResultadoSchema.parse(req.body);

    const entidade = await prisma.entidadeTiro.findUnique({ where: { id: cat.competicao.entidadeId } });
    const { nome, usuarioId, origemNome } = await resolverAtirador(entidade!, d.cpf, d.nome);

    const resultado = await prisma.resultadoCompeticao.upsert({
      where: { categoriaId_cpf: { categoriaId: id, cpf: d.cpf } },
      create: {
        categoriaId: id,
        cpf: d.cpf,
        nome,
        pontuacao: d.pontuacao,
        usuarioId,
        origemNome,
        observacao: d.observacao ?? null,
      },
      update: { nome, pontuacao: d.pontuacao, usuarioId, origemNome, observacao: d.observacao ?? null },
    });
    void notificarResultado(usuarioId, cat.competicao.id, cat.competicao.nome, cat.nome).catch(() => {});
    reply.code(201);
    return { resultado: apresentarResultado(resultado) };
  });

  app.delete('/api/admin/resultados/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const r = await prisma.resultadoCompeticao.findUnique({ where: { id } });
    if (!r) throw naoEncontrado('Resultado não encontrado');
    await prisma.resultadoCompeticao.delete({ where: { id } });
    reply.code(204);
    return null;
  });
}
