import type { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { prisma } from '../db/cliente.js';
import { exigirAdmin } from '../http/guardas.js';
import { conflito, naoEncontrado } from '../http/erros.js';
import { ambiente } from '../config/ambiente.js';
import { JANELA_ONLINE_MIN } from '../dominio/tipos.js';
import { backfillPorTransacao } from '../dominio/assinaturaServico.js';
import { enviarPush } from '../push/expo.js';
import { enviarTexto, estaConectado } from '../whatsapp/cliente.js';
import { resolverModelo } from '../whatsapp/automacoes.js';
import { registrarLog } from '../log/auditoria.js';
import { normalizarCupom } from '../dominio/cupom.js';

const STATUS_GRUPO: Record<string, string[]> = {
  // Em risco: ainda têm acesso, mas desligaram a renovação / em recuperação.
  risco: ['CANCELADA_RENOVACAO', 'EM_GRACA'],
  // Perdidos: churn consumado.
  perdidos: ['EXPIRADA', 'REEMBOLSADA', 'REVOGADA'],
  todos: ['CANCELADA_RENOVACAO', 'EM_GRACA', 'EXPIRADA', 'REEMBOLSADA', 'REVOGADA'],
};

const WINBACK_STATUS = ['PENDENTE', 'CONTATADO', 'RECUPERADO', 'PERDIDO'] as const;

function online(ultimoAcessoEm: Date | null): boolean {
  if (!ultimoAcessoEm) return false;
  return Date.now() - ultimoAcessoEm.getTime() < JANELA_ONLINE_MIN * 60_000;
}

function compararVersao(a: string, b: string): number {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

// Inclui no usuário as MESMAS dimensões da listagem principal de /usuarios.
const INCLUDE_USUARIO = {
  usuario: {
    include: {
      vinculos: { include: { entidade: { select: { id: true, nome: true } } } },
      dispositivos: { where: { ativo: true }, select: { plataforma: true, appVersao: true } },
      _count: { select: { registrosSync: { where: { tipo: 'armas', removido: false } } } },
    },
  },
} satisfies Prisma.AssinaturaAppInclude;

type AssinaturaComUsuario = Prisma.AssinaturaAppGetPayload<{ include: typeof INCLUDE_USUARIO }>;

function mapChurn(a: AssinaturaComUsuario) {
  const u = a.usuario;
  return {
    id: a.id,
    originalTransactionId: a.originalTransactionId,
    plataforma: a.plataforma,
    produtoId: a.produtoId,
    premiumTipo: a.premiumTipo,
    status: a.status,
    autoRenova: a.autoRenova,
    ambiente: a.ambiente,
    expiraEm: a.expiraEm,
    iniciouEm: a.iniciouEm,
    canceladaEm: a.canceladaEm,
    expirouEm: a.expirouEm,
    motivo: a.motivo,
    winbackStatus: a.winbackStatus,
    winbackEm: a.winbackEm,
    observacao: a.observacao,
    // Usuário com as mesmas colunas da listagem de /usuarios (null = órfã).
    usuario: u
      ? {
          id: u.id,
          nome: u.nome,
          email: u.email,
          cpf: u.cpf,
          celular: u.celular,
          ativo: u.ativo,
          emailVerificado: u.emailVerificado,
          premium: u.premium,
          premiumTipo: u.premiumTipo,
          entidades: u.vinculos.map((v) => ({ id: v.entidade.id, nome: v.entidade.nome, origem: v.origem })),
          ultimoAcessoEm: u.ultimoAcessoEm,
          online: online(u.ultimoAcessoEm),
          dispositivos: u.dispositivos.length,
          plataformas: [...new Set(u.dispositivos.map((d) => d.plataforma))],
          appVersao:
            u.dispositivos
              .map((d) => d.appVersao)
              .filter((v): v is string => !!v)
              .sort(compararVersao)
              .at(-1) ?? null,
          armasSistema: u._count.registrosSync,
          winbackParceiroEm: u.winbackParceiroEm,
          criadoEm: u.criadoEm,
        }
      : null,
  };
}

const patchSchema = z.object({
  winbackStatus: z.enum(WINBACK_STATUS).optional(),
  observacao: z.string().max(2000).nullish(),
});

const winbackSchema = z.object({
  canal: z.enum(['parceiro', 'cupom', 'push', 'whatsapp']),
  titulo: z.string().max(120).optional(),
  corpo: z.string().max(1000).optional(),
  // Cupom: parâmetros opcionais (senão gera com defaults).
  cupomDescricao: z.string().max(200).optional(),
  cupomValidadeDias: z.number().int().min(1).max(365).optional(),
});

function gerarCodigoCupom(): string {
  return `volta-${randomBytes(3).toString('hex')}`;
}

/**
 * Backoffice de churn: quem cancelou/expirou, quando e por quê — e ações de
 * reconquista (win-back). Fonte: a tabela de assinaturas de loja.
 */
export async function rotasChurnAdmin(app: FastifyInstance) {
  app.addHook('preHandler', exigirAdmin());

  // Lista de churn/risco com as mesmas colunas de usuário da tela de /usuarios.
  app.get('/api/admin/churn', async (req) => {
    const q = req.query as { grupo?: string; winback?: string };
    const grupo = q.grupo && q.grupo in STATUS_GRUPO ? q.grupo : 'todos';
    const where: Prisma.AssinaturaAppWhereInput = { status: { in: STATUS_GRUPO[grupo]! } };
    if (q.winback && (WINBACK_STATUS as readonly string[]).includes(q.winback)) {
      where.winbackStatus = q.winback;
    }
    const assinaturas = await prisma.assinaturaApp.findMany({
      where,
      orderBy: [{ canceladaEm: 'desc' }, { expirouEm: 'desc' }, { atualizadoEm: 'desc' }],
      take: 5000,
      include: INCLUDE_USUARIO,
    });
    return { grupo, total: assinaturas.length, assinaturas: assinaturas.map(mapChurn) };
  });

  // Números para os cards do dashboard.
  app.get('/api/admin/churn/metricas', async () => {
    const d30 = new Date(Date.now() - 30 * 86_400_000);
    const [canceladaRenovacao, emGraca, expirados30, aReconquistar, apiAtiva] = await Promise.all([
      prisma.assinaturaApp.count({ where: { status: 'CANCELADA_RENOVACAO' } }),
      prisma.assinaturaApp.count({ where: { status: 'EM_GRACA' } }),
      prisma.assinaturaApp.count({
        where: { status: { in: ['EXPIRADA', 'REEMBOLSADA', 'REVOGADA'] }, expirouEm: { gte: d30 } },
      }),
      prisma.assinaturaApp.count({
        where: {
          status: { in: STATUS_GRUPO.perdidos },
          OR: [{ winbackStatus: null }, { winbackStatus: 'PENDENTE' }],
        },
      }),
      Promise.resolve(ambiente.apple.apiAtiva),
    ]);
    return { canceladaRenovacao, emGraca, expirados30, aReconquistar, apiAtiva };
  });

  // Atualiza o acompanhamento (status win-back / anotação).
  app.patch('/api/admin/churn/:id', async (req) => {
    const { id } = req.params as { id: string };
    const dados = patchSchema.parse(req.body);
    const existe = await prisma.assinaturaApp.findUnique({ where: { id }, select: { id: true } });
    if (!existe) throw naoEncontrado('Assinatura não encontrada');
    await prisma.assinaturaApp.update({
      where: { id },
      data: {
        ...(dados.winbackStatus ? { winbackStatus: dados.winbackStatus } : {}),
        ...(dados.observacao !== undefined ? { observacao: dados.observacao ?? null } : {}),
      },
    });
    return { ok: true };
  });

  // Reconsulta o status atual na App Store Server API (backfill sob demanda).
  app.post('/api/admin/churn/:id/reconsultar', async (req) => {
    if (!ambiente.apple.apiAtiva) throw conflito('App Store Server API não configurada');
    const { id } = req.params as { id: string };
    const a = await prisma.assinaturaApp.findUnique({ where: { id } });
    if (!a) throw naoEncontrado('Assinatura não encontrada');
    const r = await backfillPorTransacao(a.originalTransactionId, a.ambiente);
    return { ok: true, sincronizada: !!r };
  });

  // Ação de reconquista.
  app.post('/api/admin/churn/:id/winback', async (req) => {
    const { id } = req.params as { id: string };
    const dados = winbackSchema.parse(req.body);
    const a = await prisma.assinaturaApp.findUnique({ where: { id }, include: { usuario: true } });
    if (!a) throw naoEncontrado('Assinatura não encontrada');
    const u = a.usuario;
    if (!u) throw conflito('Assinatura ainda não vinculada a um usuário');

    let resultado: Record<string, unknown> = { ok: true };

    switch (dados.canal) {
      case 'parceiro': {
        // Libera a oferta Premium Parceiro (R$49,90) mesmo sem vínculo de entidade.
        await prisma.usuarioApp.update({
          where: { id: u.id },
          data: { winbackParceiroEm: new Date() },
        });
        resultado = { ok: true, mensagem: 'Oferta Premium Parceiro liberada para o usuário.' };
        break;
      }
      case 'cupom': {
        const codigo = normalizarCupom(gerarCodigoCupom());
        const expiraEm = dados.cupomValidadeDias
          ? new Date(Date.now() + dados.cupomValidadeDias * 86_400_000)
          : null;
        const cupom = await prisma.cupomPromocional.create({
          data: {
            codigo,
            descricao: dados.cupomDescricao ?? `Reconquista — ${u.nome}`,
            limiteUsos: 1,
            expiraEm,
            ativo: true,
          },
        });
        resultado = { ok: true, codigo: cupom.codigo, expiraEm: cupom.expiraEm };
        break;
      }
      case 'push': {
        // Texto do modelo editável (gatilho WINBACK) — ou o que vier no corpo.
        const modelo = await resolverModelo('WINBACK', 'PUSH', u.nome);
        const titulo = dados.titulo ?? modelo.titulo ?? 'Sentimos sua falta 🎯';
        const corpo = dados.corpo ?? modelo.corpo;
        const disp = await prisma.dispositivoPush.findMany({
          where: { usuarioId: u.id, ativo: true },
          select: { token: true },
        });
        if (!disp.length) throw conflito('Usuário sem aparelho ativo para push');
        const r = await enviarPush(disp.map((d) => d.token), {
          titulo,
          corpo,
          dados: { tipo: 'winback' },
        });
        const status = r.aceitos > 0 ? 'OK' : 'FALHOU';
        await registrarLog({
          usuarioId: u.id,
          canal: 'PUSH',
          tipo: 'WINBACK',
          titulo,
          corpo,
          status,
          erro: r.erros.length ? r.erros.map((e) => e.motivo).join('; ') : null,
        });
        resultado = { ok: true, titulo, corpo, aceitos: r.aceitos, falhas: r.erros.length };
        break;
      }
      case 'whatsapp': {
        if (!estaConectado()) throw conflito('WhatsApp desconectado no servidor');
        if (!u.celular) throw conflito('Usuário sem celular cadastrado');
        const modelo = await resolverModelo('WINBACK', 'WHATSAPP', u.nome);
        const corpo = dados.corpo ?? modelo.corpo;
        try {
          await enviarTexto(u.celular, corpo, u.nome);
          await registrarLog({
            usuarioId: u.id,
            canal: 'WHATSAPP',
            tipo: 'WINBACK',
            corpo,
            destino: u.celular,
            status: 'OK',
          });
        } catch (e) {
          await registrarLog({
            usuarioId: u.id,
            canal: 'WHATSAPP',
            tipo: 'WINBACK',
            corpo,
            destino: u.celular,
            status: 'FALHOU',
            erro: e instanceof Error ? e.message : String(e),
          });
          throw e;
        }
        resultado = { ok: true, corpo };
        break;
      }
    }

    // Marca como contatado (sem rebaixar um já recuperado).
    await prisma.assinaturaApp.update({
      where: { id },
      data: {
        winbackEm: new Date(),
        ...(a.winbackStatus === 'RECUPERADO' ? {} : { winbackStatus: 'CONTATADO' }),
      },
    });

    return resultado;
  });
}
