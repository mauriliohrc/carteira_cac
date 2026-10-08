import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db/cliente.js';
import { exigirAdmin } from '../http/guardas.js';
import { naoEncontrado } from '../http/erros.js';

const TIPOS = new Set(['armas', 'documentos', 'habitualidades', 'locais_tiro', 'arquivos', 'fotos']);

const criarRegistroSchema = z.object({
  tipo: z.string().refine((t) => TIPOS.has(t), 'Tipo inválido'),
  registroId: z.string().optional(),
  dados: z.record(z.string(), z.unknown()),
});

function agora(): string {
  return new Date().toISOString();
}

async function acharUsuario(id: string) {
  const u = await prisma.usuarioApp.findUnique({ where: { id } });
  if (!u) throw naoEncontrado('Usuário não encontrado');
  return u;
}

/** Lê os registros sincronizados de um usuário, agrupados por tipo. */
async function lerAcervo(usuarioId: string) {
  const linhas = await prisma.registroSync.findMany({
    where: { usuarioId, removido: false },
  });
  const por: Record<string, Record<string, unknown>[]> = {};
  for (const l of linhas) {
    (por[l.tipo] ??= []).push(JSON.parse(l.dados) as Record<string, unknown>);
  }
  return por;
}

export async function rotasAcervoAdmin(app: FastifyInstance) {
  app.addHook('preHandler', exigirAdmin());

  // Perfil completo + acervo do usuário do app.
  app.get('/api/admin/usuarios-app/:id/perfil', async (req) => {
    const { id } = req.params as { id: string };
    const u = await acharUsuario(id);
    const vinculos = await prisma.vinculoEntidade.findMany({
      where: { usuarioId: id },
      include: { entidade: { select: { id: true, nome: true } } },
    });
    const acervo = await lerAcervo(id);

    return {
      usuario: {
        id: u.id,
        nome: u.nome,
        email: u.email,
        cpf: u.cpf,
        ativo: u.ativo,
        premium: u.premium,
        premiumTipo: u.premiumTipo,
        emailVerificado: u.emailVerificado,
        entidades: vinculos.map((v) => ({ id: v.entidade.id, nome: v.entidade.nome, origem: v.origem })),
        ultimoAcessoEm: u.ultimoAcessoEm,
        criadoEm: u.criadoEm,
      },
      armas: acervo.armas ?? [],
      documentos: acervo.documentos ?? [],
      habitualidades: acervo.habitualidades ?? [],
      locais: acervo.locais_tiro ?? [],
      arquivos: acervo.arquivos ?? [],
    };
  });

  // Cria ou edita um registro (ex.: adicionar documento). Propaga ao app no sync.
  app.post('/api/admin/usuarios-app/:id/registros', async (req, reply) => {
    const { id } = req.params as { id: string };
    await acharUsuario(id);
    const { tipo, registroId, dados } = criarRegistroSchema.parse(req.body);

    const rid = registroId ?? (dados.id as string) ?? randomUUID();
    const existente = await prisma.registroSync.findUnique({
      where: { usuarioId_tipo_registroId: { usuarioId: id, tipo, registroId: rid } },
    });

    // Normaliza carimbos (o app usa criado_em/atualizado_em nas tabelas locais).
    const corpo: Record<string, unknown> = { ...dados, id: rid };
    if (!corpo.criado_em) corpo.criado_em = existente ? JSON.parse(existente.dados).criado_em ?? agora() : agora();
    corpo.atualizado_em = agora();

    await prisma.registroSync.upsert({
      where: { usuarioId_tipo_registroId: { usuarioId: id, tipo, registroId: rid } },
      create: {
        usuarioId: id,
        tipo,
        registroId: rid,
        dados: JSON.stringify(corpo),
        atualizadoEm: new Date(),
        removido: false,
      },
      update: { dados: JSON.stringify(corpo), atualizadoEm: new Date(), removido: false },
    });

    reply.code(201);
    return { registroId: rid, dados: corpo };
  });

  // Exclui um registro (tombstone) — some no app na próxima sincronização.
  app.delete('/api/admin/usuarios-app/:id/registros/:tipo/:registroId', async (req, reply) => {
    const { id, tipo, registroId } = req.params as { id: string; tipo: string; registroId: string };
    await acharUsuario(id);
    await prisma.registroSync.upsert({
      where: { usuarioId_tipo_registroId: { usuarioId: id, tipo, registroId } },
      create: {
        usuarioId: id,
        tipo,
        registroId,
        dados: '{}',
        atualizadoEm: new Date(),
        removido: true,
      },
      update: { removido: true, atualizadoEm: new Date() },
    });
    reply.code(204);
    return null;
  });

  // Anexa um arquivo (PDF/foto) a um documento do usuário: guarda o blob e cria
  // o metadado 'arquivos' que desce para o app na próxima sincronização.
  app.post('/api/admin/usuarios-app/:id/arquivo', async (req, reply) => {
    const { id } = req.params as { id: string };
    await acharUsuario(id);
    const { documentoId, nome, mime, base64 } = z
      .object({
        documentoId: z.string().min(1),
        nome: z.string().min(1),
        mime: z.string().optional().nullable(),
        base64: z.string().min(1),
      })
      .parse(req.body);

    const buf = Buffer.from(base64, 'base64');
    const conteudo = new Uint8Array(buf.byteLength);
    conteudo.set(buf);
    const arquivoId = randomUUID();

    await prisma.arquivoSync.create({
      data: { usuarioId: id, registroId: arquivoId, mime: mime ?? null, tamanho: conteudo.length, conteudo },
    });
    await prisma.registroSync.create({
      data: {
        usuarioId: id,
        tipo: 'arquivos',
        registroId: arquivoId,
        dados: JSON.stringify({
          id: arquivoId,
          documento_id: documentoId,
          nome,
          uri: '',
          mime: mime ?? null,
          tamanho: conteudo.length,
          criado_em: agora(),
        }),
        atualizadoEm: new Date(),
        removido: false,
      },
    });

    reply.code(201);
    return { arquivoId };
  });

  // Baixa o conteúdo de um arquivo/foto do usuário (para visualizar).
  app.get('/api/admin/usuarios-app/:id/arquivo/:registroId', async (req) => {
    const { id, registroId } = req.params as { id: string; registroId: string };
    const a = await prisma.arquivoSync.findUnique({
      where: { usuarioId_registroId: { usuarioId: id, registroId } },
    });
    if (!a) throw naoEncontrado('Arquivo não encontrado');
    return {
      registroId: a.registroId,
      mime: a.mime,
      base64: Buffer.from(a.conteudo).toString('base64'),
    };
  });
}
