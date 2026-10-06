import type { FastifyInstance } from 'fastify';
import { prisma } from '../../db/cliente.js';
import { verificarParceiro } from '../../integracoes/shootinghouse.js';
import { exigirApp } from '../../http/guardas.js';

/** Plano liberado para sócios de parceiros — assinatura anual. */
export const PLANO_PARCEIRO = {
  id: 'parceiro_premium_anual',
  nome: 'Parceiro Premium',
  precoCentavos: 4990,
  precoLabel: 'R$ 49,90',
  periodo: 'ano',
} as const;

/**
 * Elegibilidade ao Parceiro Premium: o CPF do usuário precisa constar como
 * sócio ATIVO e ADIMPLENTE de alguma entidade parceira na Shooting House.
 */
export async function rotasParceiroAppV1(app: FastifyInstance) {
  app.get('/app/parceiro/elegibilidade', { preHandler: exigirApp() }, async (req) => {
    const usuario = await prisma.usuarioApp.findUnique({ where: { id: req.usuario!.id } });
    if (!usuario) return { elegivel: false, plano: PLANO_PARCEIRO };

    const entidades = await prisma.entidadeTiro.findMany({
      where: { shIntegracaoAtiva: true, shLogin: { not: null }, shSenha: { not: null } },
      select: { id: true, nome: true, shBaseUrl: true, shLogin: true, shSenha: true },
    });

    for (const e of entidades) {
      const v = await verificarParceiro(
        { baseUrl: e.shBaseUrl, login: e.shLogin!, senha: e.shSenha! },
        usuario.cpf
      );
      if (v.membro && v.ativo && v.adimplente) {
        return {
          elegivel: true,
          entidade: { id: e.id, nome: e.nome },
          atirador: { nome: v.nome, matricula: v.matricula, expiracao: v.expiracao },
          plano: PLANO_PARCEIRO,
        };
      }
    }

    return { elegivel: false, plano: PLANO_PARCEIRO };
  });
}
