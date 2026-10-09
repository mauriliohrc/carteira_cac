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
import { exigirEntidade } from '../http/guardas.js';
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
 * Rotas de COMPETIÇÕES do painel da entidade. Tudo é escopado à entidade do
 * usuário autenticado (`req.usuario.entidadeId`): nunca enxerga outra entidade.
 * O admin do app tem as mesmas operações em `adminCompeticoes.ts`.
 */
export async function rotasEntidadeCompeticoes(app: FastifyInstance) {
  app.addHook('preHandler', exigirEntidade());

  // Garante que a competição é da entidade do requisitante.
  async function acharCompeticao(id: string, entidadeId: string) {
    const c = await prisma.competicao.findFirst({ where: { id, entidadeId } });
    if (!c) throw naoEncontrado('Competição não encontrada');
    return c;
  }
  // Garante que a categoria pertence a uma competição da entidade.
  async function acharCategoria(id: string, entidadeId: string) {
    const cat = await prisma.categoriaCompeticao.findFirst({
      where: { id, competicao: { entidadeId } },
      include: { competicao: true },
    });
    if (!cat) throw naoEncontrado('Categoria não encontrada');
    return cat;
  }

  // ------------------------------------------------------- competições
  app.get('/api/entidade/competicoes', async (req) => {
    const entidadeId = req.usuario!.entidadeId!;
    const comps = await prisma.competicao.findMany({
      where: { entidadeId },
      orderBy: { dataInicio: 'desc' },
      include: { _count: { select: { categorias: true } } },
    });
    return { competicoes: comps.map(apresentarCompeticao) };
  });

  app.get('/api/entidade/competicoes/:id', async (req) => {
    const { id } = req.params as { id: string };
    const entidadeId = req.usuario!.entidadeId!;
    await acharCompeticao(id, entidadeId);
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

  app.post('/api/entidade/competicoes', async (req, reply) => {
    const entidadeId = req.usuario!.entidadeId!;
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

  app.patch('/api/entidade/competicoes/:id', async (req) => {
    const { id } = req.params as { id: string };
    const entidadeId = req.usuario!.entidadeId!;
    await acharCompeticao(id, entidadeId);
    const dados = limpar(atualizarCompeticaoSchema.parse(req.body));
    const comp = await prisma.competicao.update({ where: { id }, data: dados });
    return { competicao: apresentarCompeticao(comp) };
  });

  app.delete('/api/entidade/competicoes/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    await acharCompeticao(id, req.usuario!.entidadeId!);
    await prisma.competicao.delete({ where: { id } });
    reply.code(204);
    return null;
  });

  // --------------------------------------------------------- categorias
  app.post('/api/entidade/competicoes/:id/categorias', async (req, reply) => {
    const { id } = req.params as { id: string };
    const entidadeId = req.usuario!.entidadeId!;
    await acharCompeticao(id, entidadeId);
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

  app.patch('/api/entidade/categorias/:id', async (req) => {
    const { id } = req.params as { id: string };
    await acharCategoria(id, req.usuario!.entidadeId!);
    const dados = limpar(atualizarCategoriaSchema.parse(req.body));
    const cat = await prisma.categoriaCompeticao.update({ where: { id }, data: dados });
    return { categoria: apresentarCategoria(cat) };
  });

  app.delete('/api/entidade/categorias/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    await acharCategoria(id, req.usuario!.entidadeId!);
    await prisma.categoriaCompeticao.delete({ where: { id } });
    reply.code(204);
    return null;
  });

  // ----------------------------------------------------------- resultados
  // Prévia do nome de um CPF (para a tela de lançamento confirmar antes de salvar).
  app.get('/api/entidade/atirador/:cpf', async (req) => {
    const entidadeId = req.usuario!.entidadeId!;
    const cpf = limparCPF((req.params as { cpf: string }).cpf);
    if (!validarCPF(cpf)) throw invalido('CPF inválido');
    const entidade = await prisma.entidadeTiro.findUnique({ where: { id: entidadeId } });
    return previaAtirador(entidade, cpf);
  });

  // Ranking/resultados de uma categoria (com posição).
  app.get('/api/entidade/categorias/:id/resultados', async (req) => {
    const { id } = req.params as { id: string };
    const cat = await acharCategoria(id, req.usuario!.entidadeId!);
    const resultados = await prisma.resultadoCompeticao.findMany({ where: { categoriaId: id } });
    const ranqueados = ranquear(resultados, cat.ordenamento);
    return {
      categoria: apresentarCategoria(cat, resultados.length),
      resultados: ranqueados.map(apresentarResultado),
    };
  });

  app.post('/api/entidade/categorias/:id/resultados', async (req, reply) => {
    const { id } = req.params as { id: string };
    const entidadeId = req.usuario!.entidadeId!;
    const cat = await acharCategoria(id, entidadeId);
    const d = lancarResultadoSchema.parse(req.body);

    const entidade = await prisma.entidadeTiro.findUnique({ where: { id: entidadeId } });
    const { nome, usuarioId, origemNome } = await resolverAtirador(entidade!, d.cpf, d.nome);

    // Upsert: relançar o mesmo CPF atualiza a pontuação (não duplica).
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
    // Avisa o atirador (se tiver conta + device) e abre o ranking no app.
    void notificarResultado(usuarioId, cat.competicaoId, cat.competicao.nome, cat.nome).catch(() => {});
    reply.code(201);
    return { resultado: apresentarResultado(resultado) };
  });

  app.delete('/api/entidade/resultados/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const entidadeId = req.usuario!.entidadeId!;
    const r = await prisma.resultadoCompeticao.findFirst({
      where: { id, categoria: { competicao: { entidadeId } } },
    });
    if (!r) throw naoEncontrado('Resultado não encontrado');
    await prisma.resultadoCompeticao.delete({ where: { id } });
    reply.code(204);
    return null;
  });
}
