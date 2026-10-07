import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { prisma } from '../db/cliente.js';
import { ambiente } from '../config/ambiente.js';
import { uploadImagemSchema } from '../dominio/validacao.js';
import { invalido, naoEncontrado } from '../http/erros.js';
import { exigirAdmin, exigirEntidade } from '../http/guardas.js';

/** Teto do arquivo enviado (após decodificar o base64). */
const LIMITE_BYTES = 5 * 1024 * 1024; // 5 MB

/** Base pública da API: a configurada, ou derivada do próprio request (atrás do nginx). */
function baseUrl(req: FastifyRequest): string {
  if (ambiente.apiPublicaUrl) return ambiente.apiPublicaUrl;
  const proto = (req.headers['x-forwarded-proto'] as string | undefined) ?? req.protocol ?? 'http';
  const host = req.headers.host ?? `localhost:${ambiente.porta}`;
  return `${proto}://${host}`;
}

async function criarUpload(req: FastifyRequest, reply: FastifyReply) {
  const { mime, dadosBase64 } = uploadImagemSchema.parse(req.body);
  const dados = Buffer.from(dadosBase64, 'base64');
  if (dados.length === 0) throw invalido('Arquivo vazio');
  if (dados.length > LIMITE_BYTES) throw invalido('Imagem muito grande (máx. 5 MB)');

  const up = await prisma.upload.create({
    data: { mime, tamanho: dados.length, dados },
    select: { id: true },
  });
  reply.code(201);
  return { id: up.id, url: `${baseUrl(req)}/uploads/${up.id}` };
}

/**
 * Uploads de imagem do backoffice (hoje: banner de competição). Guardados no
 * banco e servidos publicamente em `GET /uploads/:id`. A criação exige token
 * de entidade OU de admin do app — por isso dois POSTs com o mesmo handler.
 */
export async function rotasUploads(app: FastifyInstance) {
  app.post('/api/entidade/uploads', { preHandler: exigirEntidade() }, criarUpload);
  app.post('/api/admin/uploads', { preHandler: exigirAdmin() }, criarUpload);

  // Servir a imagem — público (os <img> do backoffice e o app carregam por aqui).
  app.get('/uploads/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const up = await prisma.upload.findUnique({ where: { id } });
    if (!up) throw naoEncontrado('Arquivo não encontrado');
    reply
      .header('Content-Type', up.mime)
      .header('Cache-Control', 'public, max-age=31536000, immutable');
    return reply.send(up.dados);
  });
}
