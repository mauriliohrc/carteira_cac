import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db/cliente.js';
import { exigirAdmin } from '../http/guardas.js';
import { invalido, naoEncontrado } from '../http/erros.js';
import { ambiente } from '../config/ambiente.js';
import {
  apresentarFiliacao,
  ativarFiliacao,
  criarFiliacaoManual,
  encerrarFiliacao,
  MESES_VINCULO,
} from '../dominio/filiacao.js';
import { refletirFiliacaoNoSync } from '../dominio/filiacaoSync.js';
import { resolverConfigFiliacao } from '../dominio/filiacaoConfig.js';

const TAMANHO_PAGINA = 50;

const patchSchema = z.object({
  status: z.enum(['ativa', 'suspensa', 'cancelada', 'vencida']).optional(),
  documentacaoCompleta: z.boolean().optional(),
  // Data de validade da filiação (admin ajusta manualmente). ISO ou YYYY-MM-DD.
  vigenteAte: z.string().optional(),
});

/** Promoção manual a filiado (sem Asaas): define só a validade e se o doc veio. */
const promoverSchema = z.object({
  vigenteAte: z.string().optional(),
  documentacaoCompleta: z.boolean().optional(),
});

const conteudoSchema = z.object({
  titulo: z.string().trim().max(120).optional(),
  subtitulo: z.string().trim().max(600).optional(),
  vantagens: z.array(z.string().trim().max(200)).max(12).optional(),
  credibilidade: z.string().trim().max(600).optional(),
  termos: z.string().trim().max(1200).optional(),
});

const configSchema = z.object({
  valorCentavos: z.number().int().min(0).max(100_000_00),
  ativo: z.boolean().optional(),
  nomeLiga: z.string().trim().max(120).optional().nullable(),
  // Logo como data URI (base64) ou URL. String vazia/ausente mantém o atual.
  logoUrl: z.string().max(3_000_000).optional().nullable(),
  // Conteúdo editável da tela da liga. Ausente = mantém o atual.
  conteudo: conteudoSchema.optional(),
});

const SELECT_USUARIO = { id: true, nome: true, email: true, cpf: true, celular: true } as const;

function urlsDocumento(numero: string | null) {
  const api = (ambiente.apiPublicaUrl || 'https://api.carteiracac.com').replace(/\/$/, '');
  const back = (ambiente.backofficeOrigem || 'https://carteiracac.com').replace(/\/$/, '');
  if (!numero) return { certificadoUrl: null, verificacaoUrl: null };
  return {
    certificadoUrl: `${api}/filiacao/certificado/${encodeURIComponent(numero)}`,
    verificacaoUrl: `${back}/filiacao/${encodeURIComponent(numero)}`,
  };
}

/**
 * Gestão das filiações à liga (backoffice). Espelha despachanteAdmin.ts:
 * lista/filtra a tabela autoritativa, permite transição de status e edição da
 * config da liga (preço + identidade). Toda mudança reflete no sync do usuário.
 */
export async function rotasFiliacoesAdmin(app: FastifyInstance) {
  app.addHook('preHandler', exigirAdmin());

  // Config da liga (preço + nome + logo). Editável sem update do app. A filiação
  // fica sempre disponível desde que haja preço (> 0) — não há mais toggle.
  app.get('/api/admin/filiacoes/config', async () => {
    const cfg = await resolverConfigFiliacao();
    return { ...cfg, mesesVinculo: MESES_VINCULO };
  });

  app.put('/api/admin/filiacoes/config', async (req) => {
    const { valorCentavos, nomeLiga, logoUrl, conteudo } = configSchema.parse(req.body);
    const atual = await prisma.filiacaoConfig.findUnique({ where: { id: 'unico' } });
    // Logo vazio/ausente mantém o atual (não apaga por engano); null explícito não é enviado.
    const novoLogo = logoUrl && logoUrl.trim() ? logoUrl.trim() : atual?.logoUrl ?? null;
    // Conteúdo ausente mantém o atual; presente é salvo como JSON.
    const novoConteudo = conteudo ? JSON.stringify(conteudo) : atual?.conteudoJson ?? null;
    const dados = {
      valorCentavos,
      ativo: true, // sempre disponível (a regra efetiva é preço > 0)
      nomeLiga: nomeLiga?.trim() || null,
      logoUrl: novoLogo,
      conteudoJson: novoConteudo,
    };
    await prisma.filiacaoConfig.upsert({
      where: { id: 'unico' },
      create: { id: 'unico', ...dados },
      update: dados,
    });
    return { ok: true };
  });

  // Lista/fila de filiações.
  app.get('/api/admin/filiacoes', async (req) => {
    const q = req.query as {
      status?: string;
      pendenteDoc?: string;
      origem?: string;
      busca?: string;
      pagina?: string;
    };
    const pagina = Math.max(1, Number(q.pagina ?? 1) || 1);

    const where: Record<string, unknown> = {};
    if (q.status) where.status = q.status;
    if (q.origem) where.origem = q.origem;
    if (q.pendenteDoc === '1') {
      where.status = 'ativa';
      where.documentacaoCompleta = false;
    }
    if (q.busca && q.busca.trim()) {
      const b = q.busca.trim();
      where.OR = [
        { nomeCompleto: { contains: b } },
        { cpf: { contains: b.replace(/\D/g, '') } },
        { numeroFiliacao: { contains: b } },
      ];
    }

    const [itens, total] = await Promise.all([
      prisma.filiacaoLiga.findMany({
        where,
        orderBy: { criadoEm: 'desc' },
        skip: (pagina - 1) * TAMANHO_PAGINA,
        take: TAMANHO_PAGINA,
        include: { usuario: { select: SELECT_USUARIO } },
      }),
      prisma.filiacaoLiga.count({ where }),
    ]);

    return {
      itens: itens.map((f) => ({
        ...apresentarFiliacao(f),
        usuario: f.usuario,
      })),
      total,
      pagina,
      tamanhoPagina: TAMANHO_PAGINA,
    };
  });

  // Detalhe de uma filiação (com usuário, links de documento e certificado).
  app.get('/api/admin/filiacoes/:id', async (req) => {
    const { id } = req.params as { id: string };
    const f = await prisma.filiacaoLiga.findUnique({
      where: { id },
      include: { usuario: { select: SELECT_USUARIO } },
    });
    if (!f) throw naoEncontrado('Filiação não encontrada');
    return {
      ...apresentarFiliacao(f),
      usuario: f.usuario,
      docArquivoId: f.docArquivoId,
      ...urlsDocumento(f.numeroFiliacao),
    };
  });

  // Transição de status, validação do documento e/ou ajuste da validade.
  app.patch('/api/admin/filiacoes/:id', async (req) => {
    const { id } = req.params as { id: string };
    const { status, documentacaoCompleta, vigenteAte } = patchSchema.parse(req.body);
    const existente = await prisma.filiacaoLiga.findUnique({ where: { id } });
    if (!existente) throw naoEncontrado('Filiação não encontrada');
    if (status === undefined && documentacaoCompleta === undefined && vigenteAte === undefined) {
      throw invalido('Nada para atualizar');
    }

    // Documento e/ou validade: update direto + reflete no sync.
    const dadosDiretos: { documentacaoCompleta?: boolean; vigenteAte?: Date } = {};
    if (documentacaoCompleta !== undefined) dadosDiretos.documentacaoCompleta = documentacaoCompleta;
    if (vigenteAte !== undefined) {
      const d = new Date(vigenteAte);
      if (Number.isNaN(d.getTime())) throw invalido('Data de validade inválida');
      dadosDiretos.vigenteAte = d;
    }
    if (Object.keys(dadosDiretos).length) {
      const atualizada = await prisma.filiacaoLiga.update({ where: { id }, data: dadosDiretos });
      await refletirFiliacaoNoSync(atualizada);
    }

    if (status !== undefined && status !== existente.status) {
      if (status === 'ativa') {
        await ativarFiliacao(existente, { origemEvento: 'ADMIN' });
      } else {
        await encerrarFiliacao(existente, status, 'ADMIN');
      }
    }

    const final = await prisma.filiacaoLiga.findUnique({ where: { id } });
    return { ok: true, filiacao: final ? apresentarFiliacao(final) : null };
  });

  // Promove um usuário a filiado manualmente (sem Asaas). Tela de perfil única.
  app.post('/api/admin/usuarios-app/:id/filiacao', async (req) => {
    const { id } = req.params as { id: string };
    const { vigenteAte, documentacaoCompleta } = promoverSchema.parse(req.body);
    const u = await prisma.usuarioApp.findUnique({ where: { id } });
    if (!u) throw naoEncontrado('Usuário não encontrado');

    const jaTem = await prisma.filiacaoLiga.findFirst({
      where: { usuarioId: id, status: { in: ['ativa', 'pendente_pagamento'] } },
    });
    if (jaTem) throw invalido('Usuário já tem uma filiação ativa ou pendente.');

    let vigente: Date | undefined;
    if (vigenteAte) {
      const d = new Date(vigenteAte);
      if (Number.isNaN(d.getTime())) throw invalido('Data de validade inválida');
      vigente = d;
    }

    const criada = await criarFiliacaoManual({
      usuarioId: id,
      nomeCompleto: u.nome,
      cpf: u.cpf,
      vigenteAte: vigente,
      documentacaoCompleta,
    });
    return { ok: true, filiacao: apresentarFiliacao(criada) };
  });
}
