import type { FastifyInstance } from 'fastify';
import { prisma } from '../db/cliente.js';
import { exigirAdmin } from '../http/guardas.js';

/** Ordem canônica dos passos do onboarding (igual à máquina de estado do app). */
const PASSOS = ['conta', 'validar', 'cr', 'craf', 'liga'] as const;

/**
 * Métricas de produto para o backoffice. Hoje: o funil de onboarding + a
 * conversão da liga, contando APARELHOS distintos (anonId) por evento/passo
 * numa janela de dias. Usa groupBy (não raw SQL) para manter a convenção do
 * projeto: cada combinação (evento, passo, anonId) vira uma linha, então contar
 * linhas por (evento, passo) já é a contagem de aparelhos distintos.
 */
export async function rotasMetricasAdmin(app: FastifyInstance) {
  app.addHook('preHandler', exigirAdmin());

  app.get('/api/admin/metricas/funil', async (req) => {
    const q = req.query as { dias?: string };
    const dias = Math.min(Math.max(Number(q.dias) || 30, 1), 180);
    const desde = new Date(Date.now() - dias * 86_400_000);

    const grupos = await prisma.eventoApp.groupBy({
      by: ['evento', 'passo', 'anonId'],
      where: { criadoEm: { gte: desde } },
    });

    const cont = new Map<string, number>();
    for (const g of grupos) {
      const chave = `${g.evento}|${g.passo ?? ''}`;
      cont.set(chave, (cont.get(chave) ?? 0) + 1);
    }
    const n = (evento: string, passo = '') => cont.get(`${evento}|${passo}`) ?? 0;

    return {
      dias,
      iniciaram: n('onb_iniciou'),
      passos: PASSOS.map((passo) => ({
        passo,
        entraram: n('onb_passo_entrou', passo),
        pularam: n('onb_pulou', passo),
      })),
      docSubiram: n('onb_doc_subiu'),
      concluiram: n('onb_concluiu'),
      liga: {
        vista: n('liga_vista'),
        filiou: n('liga_filiou'),
        mensal: n('liga_mensal'),
        recusou: n('liga_recusou'),
      },
    };
  });
}
