import type { FastifyInstance } from 'fastify';
import { prisma } from '../db/cliente.js';
import { criarContatoSchema } from '../dominio/validacao.js';

/**
 * Contato do site — PÚBLICO (sem autenticação). Sistema interno: só grava a
 * mensagem; a equipe vê e trata no backoffice (não dispara e-mail).
 */
export async function rotasPublicoContato(app: FastifyInstance) {
  app.post('/api/publico/contato', async (req, reply) => {
    const dados = criarContatoSchema.parse(req.body);
    await prisma.contato.create({ data: dados });
    reply.code(201);
    return { ok: true };
  });
}
