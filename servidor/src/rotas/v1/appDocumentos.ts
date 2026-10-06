import type { FastifyInstance } from 'fastify';
import { prisma } from '../../db/cliente.js';
import { buscarCR, emailConfereNoSH } from '../../integracoes/shootinghouse.js';
import { exigirApp } from '../../http/guardas.js';

export interface DocumentoImportavel {
  tipo: string;
  numero: string | null;
  dataValidade: string;
  /** Chave estável para deduplicar. */
  externoKey: string;
}

/**
 * Documentos do sócio disponíveis na Shooting House para pré-preencher o app.
 * Hoje: o CR (Certificado de Registro). CRAF/guias/declarações dependem da SH
 * liberar as rotas correspondentes (hoje retornam 403).
 */
export async function rotasDocumentosAppV1(app: FastifyInstance) {
  app.get('/app/documentos/shooting-house', { preHandler: exigirApp() }, async (req) => {
    const usuario = await prisma.usuarioApp.findUnique({ where: { id: req.usuario!.id } });
    if (!usuario) return { status: 'SEM_CONTA', documentos: [] };
    if (!usuario.emailVerificado) return { status: 'NAO_VERIFICADO', documentos: [] };

    const entidades = await prisma.entidadeTiro.findMany({
      where: { shIntegracaoAtiva: true, shLogin: { not: null }, shSenha: { not: null } },
      select: { shBaseUrl: true, shLogin: true, shSenha: true },
    });
    if (entidades.length === 0) return { status: 'SEM_PARCEIROS', documentos: [] };

    const porChave = new Map<string, DocumentoImportavel>();
    for (const e of entidades) {
      const creds = { baseUrl: e.shBaseUrl, login: e.shLogin!, senha: e.shSenha! };
      // Só traz o CR desta entidade se o e-mail da conta bate com o do cadastro.
      const conf = await emailConfereNoSH(creds, usuario.cpf, usuario.email);
      if (!conf.confere) continue;

      const cr = await buscarCR(creds, usuario.cpf);
      if (cr) {
        const key = `sh_cr_${cr.numero}`;
        if (!porChave.has(key)) {
          porChave.set(key, { tipo: 'CR', numero: cr.numero, dataValidade: cr.validade, externoKey: key });
        }
      }
    }

    return { status: 'OK', documentos: [...porChave.values()] };
  });
}
