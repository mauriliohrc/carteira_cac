import type { FastifyInstance } from 'fastify';
import { prisma } from '../../db/cliente.js';
import { ranquear } from '../../dominio/ranking.js';
import { naoEncontrado } from '../../http/erros.js';
import { exigirApp } from '../../http/guardas.js';

const TOPO = 10;

/**
 * Competições vistas pelo usuário do app. Ele só enxerga as competições das
 * entidades às quais está vinculado (VinculoEntidade). O ranking expõe apenas o
 * Top 10 — mais a posição do próprio usuário, mesmo fora do Top 10.
 */
export async function rotasCompeticoesAppV1(app: FastifyInstance) {
  // Lista as competições ATIVAS (dentro do prazo) das entidades do usuário.
  app.get('/app/competicoes', { preHandler: exigirApp() }, async (req) => {
    const usuarioId = req.usuario!.id;
    const agora = new Date();
    const comps = await prisma.competicao.findMany({
      where: {
        ativo: true,
        dataFim: { gte: agora },
        entidade: { vinculosApp: { some: { usuarioId } } },
      },
      orderBy: { dataInicio: 'asc' },
      include: {
        entidade: { select: { id: true, nome: true } },
        _count: { select: { categorias: true } },
      },
    });

    return {
      competicoes: comps.map((c) => ({
        id: c.id,
        nome: c.nome,
        descricao: c.descricao,
        bannerUrl: c.bannerUrl,
        dataInicio: c.dataInicio,
        dataFim: c.dataFim,
        entidadeId: c.entidadeId,
        entidadeNome: c.entidade.nome,
        totalCategorias: c._count.categorias,
        emAndamento: c.dataInicio <= agora,
      })),
    };
  });

  // Detalhe de uma competição: categorias, cada uma com Top 10 e a posição do usuário.
  app.get('/app/competicoes/:id', { preHandler: exigirApp() }, async (req) => {
    const usuarioId = req.usuario!.id;
    const { id } = req.params as { id: string };

    const usuario = await prisma.usuarioApp.findUnique({
      where: { id: usuarioId },
      select: { cpf: true },
    });

    const comp = await prisma.competicao.findFirst({
      // Só devolve se a entidade da competição é uma das do usuário.
      where: { id, entidade: { vinculosApp: { some: { usuarioId } } } },
      include: {
        entidade: { select: { id: true, nome: true } },
        categorias: {
          orderBy: { criadoEm: 'asc' },
          include: { resultados: true },
        },
      },
    });
    if (!comp) throw naoEncontrado('Competição não encontrada');

    const meuCpf = usuario?.cpf ?? null;

    const categorias = comp.categorias.map((cat) => {
      const ranque = ranquear(cat.resultados, cat.ordenamento);
      const ehVoce = (cpf: string, uid: string | null) =>
        (meuCpf !== null && cpf === meuCpf) || (uid !== null && uid === usuarioId);

      const top = ranque.slice(0, TOPO).map((r) => ({
        posicao: r.posicao,
        nome: r.nome,
        pontuacao: r.pontuacao,
        ehVoce: ehVoce(r.cpf, r.usuarioId),
      }));

      const meu = ranque.find((r) => ehVoce(r.cpf, r.usuarioId));

      return {
        id: cat.id,
        nome: cat.nome,
        descricao: cat.descricao,
        regras: cat.regras,
        ordenamento: cat.ordenamento,
        totalParticipantes: cat.resultados.length,
        top,
        minhaPosicao: meu
          ? { posicao: meu.posicao, pontuacao: meu.pontuacao, noTop: meu.posicao <= TOPO }
          : null,
      };
    });

    return {
      competicao: {
        id: comp.id,
        nome: comp.nome,
        descricao: comp.descricao,
        bannerUrl: comp.bannerUrl,
        regras: comp.regras,
        dataInicio: comp.dataInicio,
        dataFim: comp.dataFim,
        entidadeId: comp.entidadeId,
        entidadeNome: comp.entidade.nome,
        categorias,
      },
    };
  });
}
