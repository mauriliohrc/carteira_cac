import type { FastifyInstance } from 'fastify';
import { prisma } from '../../db/cliente.js';
import {
  buscarHabitualidades,
  emailConfereNoSH,
  type SessaoImportada,
} from '../../integracoes/shootinghouse.js';
import { exigirApp } from '../../http/guardas.js';

/**
 * Importação de habitualidades da Shooting House para o usuário logado.
 *
 * Varre as entidades com integração SH ativa, consulta cada uma pelo CPF do
 * usuário (identificador forte; a API da SH não busca por e-mail) e devolve as
 * sessões deduplicadas por `externoId`. O app mescla localmente sem duplicar.
 */
export async function rotasHabitualidadesAppV1(app: FastifyInstance) {
  app.get('/app/habitualidades/importar', { preHandler: exigirApp() }, async (req) => {
    const usuario = await prisma.usuarioApp.findUnique({ where: { id: req.usuario!.id } });
    if (!usuario) return { status: 'ERRO', sessoes: [], parceiros: [] };
    if (!usuario.emailVerificado) return { status: 'NAO_VERIFICADO', sessoes: [], parceiros: [] };

    const entidades = await prisma.entidadeTiro.findMany({
      where: { shIntegracaoAtiva: true, shLogin: { not: null }, shSenha: { not: null } },
      select: { id: true, nome: true, shBaseUrl: true, shLogin: true, shSenha: true },
    });

    const porExternoId = new Map<string, SessaoImportada>();
    const parceiros: { entidade: string; status: string; encontradas: number; mensagem?: string }[] = [];

    for (const e of entidades) {
      const creds = { baseUrl: e.shBaseUrl, login: e.shLogin!, senha: e.shSenha! };
      // Só importa desta entidade se o e-mail da conta bate com o cadastro do SH.
      const conf = await emailConfereNoSH(creds, usuario.cpf, usuario.email);
      if (!conf.confere) {
        parceiros.push({
          entidade: e.nome,
          status: conf.membro ? 'EMAIL_DIVERGENTE' : conf.status,
          encontradas: 0,
          mensagem: conf.membro
            ? 'O e-mail da sua conta não confere com o cadastrado nesta entidade.'
            : undefined,
        });
        continue;
      }

      const r = await buscarHabitualidades(creds, usuario.cpf);
      for (const s of r.sessoes) porExternoId.set(s.externoId, s);
      parceiros.push({
        entidade: e.nome,
        status: r.status,
        encontradas: r.sessoes.length,
        mensagem: r.mensagem,
      });
    }

    const sessoes = [...porExternoId.values()].sort((a, b) => b.data.localeCompare(a.data));
    // Status geral: OK se algum parceiro respondeu OK; senão o pior encontrado.
    const status = !entidades.length
      ? 'SEM_PARCEIROS'
      : parceiros.some((p) => p.status === 'OK')
        ? 'OK'
        : parceiros.some((p) => p.status === 'NAO_AUTORIZADO')
          ? 'NAO_AUTORIZADO'
          : 'ERRO';

    return { status, sessoes, parceiros };
  });
}
