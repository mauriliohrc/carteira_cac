import type { FastifyInstance } from 'fastify';
import { prisma } from '../db/cliente.js';
import { ranquear } from '../dominio/ranking.js';
import { naoEncontrado } from '../http/erros.js';

const TOPO = 10;

/**
 * Ranking PÚBLICO de uma competição (sem autenticação) — a base da página
 * compartilhável. Expõe só o Top 10 de cada categoria, sem CPF: apenas nome,
 * posição e pontuação.
 */
export async function rotasPublicoCompeticoes(app: FastifyInstance) {
  app.get('/api/publico/competicoes/:id', async (req) => {
    const { id } = req.params as { id: string };
    const comp = await prisma.competicao.findUnique({
      where: { id },
      include: {
        entidade: { select: { nome: true } },
        categorias: { orderBy: { criadoEm: 'asc' }, include: { resultados: true } },
      },
    });
    if (!comp) throw naoEncontrado('Competição não encontrada');

    return {
      competicao: {
        id: comp.id,
        nome: comp.nome,
        descricao: comp.descricao,
        bannerUrl: comp.bannerUrl,
        regras: comp.regras,
        dataInicio: comp.dataInicio,
        dataFim: comp.dataFim,
        entidadeNome: comp.entidade.nome,
        categorias: comp.categorias.map((cat) => ({
          id: cat.id,
          nome: cat.nome,
          descricao: cat.descricao,
          ordenamento: cat.ordenamento,
          totalParticipantes: cat.resultados.length,
          top: ranquear(cat.resultados, cat.ordenamento)
            .slice(0, TOPO)
            .map((r) => ({ posicao: r.posicao, nome: r.nome, pontuacao: r.pontuacao })),
        })),
      },
    };
  });
}
