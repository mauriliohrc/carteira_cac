import type { FastifyInstance } from 'fastify';
import { usuarioAppOpcional } from '../../http/guardas.js';
import { eventosAppSchema } from '../../dominio/validacao.js';
import { registrarEventosApp } from '../../dominio/eventoApp.js';

/**
 * Ingestão de eventos de produto do app (funil de onboarding, conversão da liga).
 * Público: funciona anônimo (anonId do aparelho) e, se houver token, associa à
 * conta. Best-effort — sempre responde ok, mesmo que o registro falhe, para o
 * app jamais depender disto.
 */
export async function rotasEventosAppV1(app: FastifyInstance) {
  app.post('/app/eventos', async (req) => {
    const { anonId, plataforma, appVersao, eventos } = eventosAppSchema.parse(req.body);
    const usuarioId = usuarioAppOpcional(req);
    await registrarEventosApp(eventos, { anonId, usuarioId, plataforma, appVersao });
    return { ok: true };
  });
}
