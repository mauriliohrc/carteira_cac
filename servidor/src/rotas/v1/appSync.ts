import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../db/cliente.js';
import { exigirApp } from '../../http/guardas.js';
import { invalido, naoEncontrado } from '../../http/erros.js';
import { registrarEventoUsuario, type TipoEventoUsuario } from '../../dominio/eventoUsuario.js';

/** Sync tipos do acervo que viram evento na timeline (criar/editar/remover). */
const EVENTOS_ACERVO: Record<string, { criado: TipoEventoUsuario; editado: TipoEventoUsuario; removido: TipoEventoUsuario }> = {
  documentos: { criado: 'DOC_CRIADO', editado: 'DOC_EDITADO', removido: 'DOC_REMOVIDO' },
  armas: { criado: 'ARMA_CRIADA', editado: 'ARMA_EDITADA', removido: 'ARMA_REMOVIDA' },
};

/** Rótulo curto e legível de um registro de acervo para a timeline. */
function rotuloAcervo(tipo: string, dados: unknown): string | null {
  if (!dados || typeof dados !== 'object') return null;
  const d = dados as Record<string, unknown>;
  const txt = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
  if (tipo === 'documentos') {
    const partes = [txt(d.tipo), txt(d.numero) ?? txt(d.nome)].filter(Boolean);
    return partes.length ? partes.join(' — ') : null;
  }
  if (tipo === 'armas') {
    const partes = [txt(d.fabricante), txt(d.modelo) ?? txt(d.calibre)].filter(Boolean);
    return partes.length ? partes.join(' ') : null;
  }
  return null;
}

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
  // Normaliza a série para comparar (sem espaços, maiúsculas) — igual ao app.
  const chaveSerie = (s: unknown) => String(s ?? '').replace(/\s+/g, '').toUpperCase();

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

      // Anti-duplicação de armas: se chega uma arma NOVA (registroId inédito,
      // não removida) e já existe uma arma ATIVA com a MESMA série (de outro
      // aparelho ou de uma re-importação), grava a nova como removida — evita o
      // acúmulo de duplicatas por série no acervo.
      let removido = r.removido ?? false;
      if (r.tipo === 'armas' && !existente && !removido) {
        const serie = chaveSerie((r.dados as { numero_serie?: unknown } | null)?.numero_serie);
        if (serie) {
          const ativas = await prisma.registroSync.findMany({
            where: { usuarioId, tipo: 'armas', removido: false, registroId: { not: r.registroId } },
            select: { dados: true },
          });
          const jaExiste = ativas.some((a) => {
            try {
              return chaveSerie((JSON.parse(a.dados) as { numero_serie?: unknown }).numero_serie) === serie;
            } catch {
              return false;
            }
          });
          if (jaExiste) removido = true;
        }
      }

      await prisma.registroSync.upsert({
        where: { usuarioId_tipo_registroId: { usuarioId, tipo: r.tipo, registroId: r.registroId } },
        create: {
          usuarioId,
          tipo: r.tipo,
          registroId: r.registroId,
          dados,
          atualizadoEm,
          removido,
        },
        update: { dados, atualizadoEm, removido },
      });

      // Timeline do acervo (documentos/armas): deriva criar/editar/remover do
      // estado anterior. Best-effort — só registra transições reais (não repete
      // em re-push idêntico). Apps antigos continuam funcionando normalmente.
      const mapa = EVENTOS_ACERVO[r.tipo];
      if (mapa) {
        const removidoAgora = removido;
        const removidoAntes = existente?.removido ?? false;
        let evento: TipoEventoUsuario | null = null;
        if (!existente && !removidoAgora) evento = mapa.criado;
        else if (removidoAgora && !removidoAntes && existente) evento = mapa.removido;
        else if (existente && !removidoAgora && existente.dados !== dados) evento = mapa.editado;
        if (evento) {
          void registrarEventoUsuario(usuarioId, evento, {
            origem: 'APP',
            descricao: rotuloAcervo(r.tipo, r.dados),
            meta: { registroId: r.registroId },
          });
        }
      }
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
