import type { FastifyInstance, FastifyRequest } from 'fastify';
import { Prisma } from '@prisma/client';
import { prisma } from '../db/cliente.js';
import { ambiente } from '../config/ambiente.js';
import { naoEncontrado } from '../http/erros.js';
import { apresentarAnuncio } from './v1/appMarketplace.js';

/** Base pública da API (igual a uploads.ts) para montar URLs de foto. */
function baseUrl(req: FastifyRequest): string {
  if (ambiente.apiPublicaUrl) return ambiente.apiPublicaUrl;
  const proto = (req.headers['x-forwarded-proto'] as string | undefined) ?? req.protocol ?? 'http';
  const host = req.headers.host ?? `localhost:${ambiente.porta}`;
  return `${proto}://${host}`;
}

const INCLUIR = {
  fotos: { orderBy: { ordem: 'asc' as const } },
  loja: true,
  vendedor: { select: { nome: true } },
} satisfies Prisma.AnuncioInclude;

/**
 * Marketplace PÚBLICO (sem login) — a vitrine web em `mercado.carteiracac.com`.
 * Mostra só anúncios APROVADOS e **nunca** expõe contato: nem telefone do
 * vendedor P2P nem contato da loja (`contatoLoja: false`). Qualquer interesse na
 * web leva o visitante a baixar o app (CTA no frontend). Link direto é aberto de
 * propósito — para compartilhar e converter novos usuários.
 */
export async function rotasPublicoMarketplace(app: FastifyInstance) {
  app.get('/api/publico/marketplace', async (req) => {
    const q = req.query as {
      cursor?: string;
      limite?: string;
      categoria?: string;
      uf?: string;
      texto?: string;
    };
    const limite = Math.min(48, Math.max(1, Number(q.limite) || 24));
    const and: Prisma.AnuncioWhereInput[] = [{ status: 'APROVADO' }];
    if (q.categoria) and.push({ categoria: q.categoria });
    if (q.uf) and.push({ uf: q.uf.toUpperCase() });
    if (q.texto) and.push({ OR: [{ titulo: { contains: q.texto } }, { descricao: { contains: q.texto } }] });

    const lista = await prisma.anuncio.findMany({
      where: { AND: and },
      orderBy: [{ destaqueAte: 'desc' }, { criadoEm: 'desc' }, { id: 'desc' }],
      include: INCLUIR,
      take: limite + 1,
      ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
    });
    const temMais = lista.length > limite;
    const pagina = temMais ? lista.slice(0, limite) : lista;
    const base = baseUrl(req);
    return {
      anuncios: pagina.map((a) => apresentarAnuncio(a, base, { contatoLoja: false })),
      proximoCursor: temMais ? pagina[pagina.length - 1]!.id : null,
    };
  });

  app.get('/api/publico/marketplace/:id', async (req) => {
    const { id } = req.params as { id: string };
    const a = await prisma.anuncio.findFirst({ where: { id, status: 'APROVADO' }, include: INCLUIR });
    if (!a) throw naoEncontrado('Anúncio não encontrado');
    return { anuncio: apresentarAnuncio(a, baseUrl(req), { contatoLoja: false }) };
  });
}
