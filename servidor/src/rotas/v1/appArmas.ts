import type { FastifyInstance } from 'fastify';
import { prisma } from '../../db/cliente.js';
import { buscarArmas, emailConfereNoSH, type ArmaImportada } from '../../integracoes/shootinghouse.js';
import { exigirApp } from '../../http/guardas.js';

/**
 * Armas do acervo do usuário na Shooting House, para pré-preencher o app.
 * Varre as entidades parceiras pelo CPF e deduplica por número de série.
 *
 * Trava de segurança: só importa com a conta confirmada (e-mail verificado) e
 * apenas das entidades cujo e-mail cadastrado do sócio bate com o da conta —
 * impede trazer armas de terceiros usando o CPF alheio.
 */
export async function rotasArmasAppV1(app: FastifyInstance) {
  app.get('/app/armas/shooting-house', { preHandler: exigirApp() }, async (req) => {
    const usuario = await prisma.usuarioApp.findUnique({ where: { id: req.usuario!.id } });
    if (!usuario) return { status: 'SEM_CONTA', armas: [] };
    if (!usuario.emailVerificado) return { status: 'NAO_VERIFICADO', armas: [] };

    const entidades = await prisma.entidadeTiro.findMany({
      where: { shIntegracaoAtiva: true, shLogin: { not: null }, shSenha: { not: null } },
      select: { nome: true, shBaseUrl: true, shLogin: true, shSenha: true },
    });

    const porSerie = new Map<string, ArmaImportada>();
    let algumOk = false;
    let algumNaoAutorizado = false;

    for (const e of entidades) {
      const creds = { baseUrl: e.shBaseUrl, login: e.shLogin!, senha: e.shSenha! };
      // Só traz desta entidade se o e-mail da conta bate com o cadastro do SH.
      const conf = await emailConfereNoSH(creds, usuario.cpf, usuario.email);
      if (conf.membro && !conf.confere) algumNaoAutorizado = true;
      if (!conf.confere) continue;

      const r = await buscarArmas(creds, usuario.cpf);
      if (r.status === 'OK') algumOk = true;
      if (r.status === 'NAO_AUTORIZADO') algumNaoAutorizado = true;
      for (const a of r.armas) {
        const chave = a.numeroSerie.replace(/\s+/g, '').toUpperCase();
        if (!porSerie.has(chave)) porSerie.set(chave, a);
      }
    }

    const status = !entidades.length
      ? 'SEM_PARCEIROS'
      : algumOk
        ? 'OK'
        : algumNaoAutorizado
          ? 'NAO_AUTORIZADO'
          : 'ERRO';

    return { status, armas: [...porSerie.values()] };
  });
}
