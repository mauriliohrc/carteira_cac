import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../db/cliente.js';
import { exigirApp } from '../../http/guardas.js';
import { invalido, naoEncontrado } from '../../http/erros.js';

const registroSchema = z.object({
  tipo: z.string().min(1),
  registroId: z.string().min(1),
  dados: z.unknown(), // objeto livre; guardamos como JSON
  atualizadoEm: z.string().min(1),
  removido: z.boolean().optional(),
});

const pushSchema = z.object({
  registros: z.array(registroSchema).max(2000),
});

const arquivoSchema = z.object({
  registroId: z.string().min(1),
  mime: z.string().optional().nullable(),
  tamanho: z.number().int().optional().nullable(),
  base64: z.string().min(1),
});

/**
 * Sincronização na nuvem do acervo do usuário (espelho offline-first).
 * Registros genéricos com last-write-wins; arquivos binários à parte.
 */
export async function rotasSyncAppV1(app: FastifyInstance) {
  // Aumenta o limite do corpo: uploads de PDF/foto em base64.
  app.addHook('preHandler', exigirApp());

  // -------- PUSH: sobe alterações locais (LWW por atualizadoEm) ----------
  app.post('/app/sync/push', async (req) => {
    const { registros } = pushSchema.parse(req.body);
    const usuarioId = req.usuario!.id;

    for (const r of registros) {
      const atualizadoEm = new Date(r.atualizadoEm);
      if (Number.isNaN(atualizadoEm.getTime())) continue;
      const dados = JSON.stringify(r.dados ?? null);

      const existente = await prisma.registroSync.findUnique({
        where: { usuarioId_tipo_registroId: { usuarioId, tipo: r.tipo, registroId: r.registroId } },
      });

      // Só sobrescreve se o que chega for igual ou mais novo (last-write-wins).
      if (existente && existente.atualizadoEm > atualizadoEm) continue;

      await prisma.registroSync.upsert({
        where: { usuarioId_tipo_registroId: { usuarioId, tipo: r.tipo, registroId: r.registroId } },
        create: {
          usuarioId,
          tipo: r.tipo,
          registroId: r.registroId,
          dados,
          atualizadoEm,
          removido: r.removido ?? false,
        },
        update: { dados, atualizadoEm, removido: r.removido ?? false },
      });
    }

    return { servidorAgora: new Date().toISOString() };
  });

  // -------- PULL: baixa o que mudou desde o cursor do servidor -----------
  app.get('/app/sync/pull', async (req) => {
    const { desde } = req.query as { desde?: string };
    const usuarioId = req.usuario!.id;
    const where = { usuarioId } as { usuarioId: string; carimboServidor?: { gt: Date } };
    if (desde) {
      const d = new Date(desde);
      if (!Number.isNaN(d.getTime())) where.carimboServidor = { gt: d };
    }

    const linhas = await prisma.registroSync.findMany({
      where,
      orderBy: { carimboServidor: 'asc' },
      take: 5000,
    });

    return {
      registros: linhas.map((l) => ({
        tipo: l.tipo,
        registroId: l.registroId,
        dados: JSON.parse(l.dados),
        atualizadoEm: l.atualizadoEm.toISOString(),
        removido: l.removido,
      })),
      servidorAgora: new Date().toISOString(),
    };
  });

  // -------- Arquivos: lista, upload e download de blobs ------------------
  app.get('/app/sync/arquivos', async (req) => {
    const arquivos = await prisma.arquivoSync.findMany({
      where: { usuarioId: req.usuario!.id },
      select: { registroId: true, tamanho: true, mime: true, atualizadoEm: true },
    });
    return { arquivos };
  });

  app.post('/app/sync/arquivo', async (req, reply) => {
    const { registroId, mime, tamanho, base64 } = arquivoSchema.parse(req.body);
    const usuarioId = req.usuario!.id;
    let conteudo: Uint8Array<ArrayBuffer>;
    try {
      const buf = Buffer.from(base64, 'base64');
      conteudo = new Uint8Array(buf.byteLength); // garante backing ArrayBuffer
      conteudo.set(buf);
    } catch {
      throw invalido('base64 inválido');
    }
    await prisma.arquivoSync.upsert({
      where: { usuarioId_registroId: { usuarioId, registroId } },
      create: { usuarioId, registroId, mime: mime ?? null, tamanho: tamanho ?? conteudo.length, conteudo },
      update: { mime: mime ?? null, tamanho: tamanho ?? conteudo.length, conteudo },
    });
    reply.code(204);
    return null;
  });

  app.get('/app/sync/arquivo/:registroId', async (req) => {
    const { registroId } = req.params as { registroId: string };
    const a = await prisma.arquivoSync.findUnique({
      where: { usuarioId_registroId: { usuarioId: req.usuario!.id, registroId } },
    });
    if (!a) throw naoEncontrado('Arquivo não encontrado');
    return {
      registroId: a.registroId,
      mime: a.mime,
      base64: Buffer.from(a.conteudo).toString('base64'),
    };
  });
}
