import type { FastifyInstance } from 'fastify';
import { prisma } from '../../db/cliente.js';
import { normalizarCupom } from '../../dominio/cupom.js';
import { resgatarCupomSchema } from '../../dominio/validacao.js';
import { usuarioAppOpcional } from '../../http/guardas.js';

/**
 * Resgate de cupom promocional. Público: funciona logado (registra o usuário)
 * ou anônimo. Valida ativo/validade/limite e computa um uso.
 * O easter egg "rocambole do dino" é tratado no app, não cai aqui.
 */
export async function rotasCupomAppV1(app: FastifyInstance) {
  app.post('/app/cupom/resgatar', async (req) => {
    const { codigo } = resgatarCupomSchema.parse(req.body);
    const codigoNorm = normalizarCupom(codigo);
    const usuarioId = usuarioAppOpcional(req);

    const cupom = await prisma.cupomPromocional.findUnique({ where: { codigo: codigoNorm } });
    if (!cupom || !cupom.ativo) return { ok: false, motivo: 'INVALIDO' };
    if (cupom.expiraEm && cupom.expiraEm < new Date()) return { ok: false, motivo: 'EXPIRADO' };
    if (cupom.limiteUsos != null && cupom.usos >= cupom.limiteUsos) {
      return { ok: false, motivo: 'ESGOTADO' };
    }

    // Já resgatado por este usuário: continua válido, sem computar de novo.
    if (usuarioId) {
      const jaUsou = await prisma.usoCupom.findFirst({ where: { cupomId: cupom.id, usuarioId } });
      if (jaUsou) return { ok: true, descricao: cupom.descricao, jaResgatado: true };
    }

    await prisma.$transaction([
      prisma.usoCupom.create({ data: { cupomId: cupom.id, usuarioId: usuarioId ?? null } }),
      prisma.cupomPromocional.update({ where: { id: cupom.id }, data: { usos: { increment: 1 } } }),
    ]);

    return { ok: true, descricao: cupom.descricao };
  });
}
