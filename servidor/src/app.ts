import Fastify from 'fastify';
import cors from '@fastify/cors';
import { ZodError } from 'zod';
import { ambiente } from './config/ambiente.js';
import { ErroHttp } from './http/erros.js';
import { rotasAutenticacao } from './rotas/autenticacao.js';
import { rotasEntidades } from './rotas/entidades.js';
import { rotasEntidade } from './rotas/entidade.js';
import { rotasEntidadeCompeticoes } from './rotas/entidadeCompeticoes.js';
import { rotasAdminCompeticoes } from './rotas/adminCompeticoes.js';
import { rotasUploads } from './rotas/uploads.js';
import { rotasPublicoCompeticoes } from './rotas/publicoCompeticoes.js';
import { rotasPublicoContato } from './rotas/publicoContato.js';
import { rotasContatosAdmin } from './rotas/contatosAdmin.js';
import { rotasDashboardAdmin } from './rotas/dashboardAdmin.js';
import { rotasNoticias } from './rotas/noticias.js';
import { rotasPushAdmin } from './rotas/pushAdmin.js';
import { rotasAcervoAdmin } from './rotas/acervoAdmin.js';
import { rotasCuponsAdmin } from './rotas/cuponsAdmin.js';
import { rotasAppV1 } from './rotas/v1/appAuth.js';
import { rotasNoticiasAppV1 } from './rotas/v1/appNoticias.js';
import { rotasDispositivosAppV1 } from './rotas/v1/appDispositivos.js';
import { rotasHabitualidadesAppV1 } from './rotas/v1/appHabitualidades.js';
import { rotasSyncAppV1 } from './rotas/v1/appSync.js';
import { rotasParceiroAppV1 } from './rotas/v1/appParceiro.js';
import { rotasArmasAppV1 } from './rotas/v1/appArmas.js';
import { rotasDocumentosAppV1 } from './rotas/v1/appDocumentos.js';
import { rotasCupomAppV1 } from './rotas/v1/appCupom.js';
import { rotasCompeticoesAppV1 } from './rotas/v1/appCompeticoes.js';

export function construirApp() {
  // bodyLimit alto: uploads de PDF/foto em base64 na sincronização.
  const app = Fastify({ logger: true, bodyLimit: 30 * 1024 * 1024 });

  app.register(cors, {
    // Libera o backoffice e QUALQUER subdomínio de carteiracac.com — as páginas
    // públicas de ranking agora rodam em 3gun.carteiracac.com, clube-x..., etc.
    // Reflete a origem (não usa '*') porque credentials:true exige origem exata.
    origin: (origin, cb) => {
      if (!origin) return cb(null, true); // sem Origin: curl, app nativo, mesma origem
      try {
        const host = new URL(origin).hostname;
        const ok =
          origin === ambiente.backofficeOrigem ||
          host === 'carteiracac.com' ||
          host.endsWith('.carteiracac.com');
        return cb(null, ok);
      } catch {
        return cb(null, false);
      }
    },
    credentials: true,
  });

  // Tratamento central de erros: Zod -> 400 com detalhes; ErroHttp -> status.
  app.setErrorHandler((erro, _req, reply) => {
    if (erro instanceof ZodError) {
      return reply.code(400).send({
        erro: 'Dados inválidos',
        detalhes: erro.issues.map((i) => ({
          campo: i.path.join('.'),
          mensagem: i.message,
        })),
      });
    }
    if (erro instanceof ErroHttp) {
      return reply.code(erro.status).send({ erro: erro.message });
    }
    app.log.error(erro);
    return reply.code(500).send({ erro: 'Erro interno do servidor' });
  });

  app.get('/api/saude', async () => ({ ok: true, agora: new Date().toISOString() }));

  // Backoffice (admin do app e usuários de entidade).
  app.register(rotasAutenticacao);
  app.register(rotasEntidades);
  app.register(rotasEntidade);
  app.register(rotasEntidadeCompeticoes);
  app.register(rotasAdminCompeticoes);
  app.register(rotasUploads);
  app.register(rotasPublicoCompeticoes);
  app.register(rotasPublicoContato);
  app.register(rotasContatosAdmin);
  app.register(rotasNoticias);
  app.register(rotasPushAdmin);
  app.register(rotasDashboardAdmin);
  app.register(rotasAcervoAdmin);
  app.register(rotasCuponsAdmin);

  // API pública do aplicativo — versionada. Novas versões entram como /api/v2
  // sem mexer nas rotas abaixo, preservando apps já instalados.
  app.register(rotasAppV1, { prefix: '/api/v1' });
  app.register(rotasNoticiasAppV1, { prefix: '/api/v1' });
  app.register(rotasDispositivosAppV1, { prefix: '/api/v1' });
  app.register(rotasHabitualidadesAppV1, { prefix: '/api/v1' });
  app.register(rotasSyncAppV1, { prefix: '/api/v1' });
  app.register(rotasParceiroAppV1, { prefix: '/api/v1' });
  app.register(rotasArmasAppV1, { prefix: '/api/v1' });
  app.register(rotasDocumentosAppV1, { prefix: '/api/v1' });
  app.register(rotasCupomAppV1, { prefix: '/api/v1' });
  app.register(rotasCompeticoesAppV1, { prefix: '/api/v1' });

  return app;
}
