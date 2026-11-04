import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db/cliente.js';
import { exigirAdmin } from '../http/guardas.js';
import { invalido, naoEncontrado } from '../http/erros.js';
import { refletirProcessoNoSync } from '../dominio/despachanteSync.js';
import { resolverServicos } from '../dominio/despachanteConfig.js';
import { resolverConfigAsaas, urlWebhookAsaas } from '../dominio/asaasConfig.js';

const STATUS_VALIDOS = ['aguardando_pagamento', 'pago', 'em_andamento', 'concluido', 'cancelado'] as const;

const TAMANHO_PAGINA = 50;

const atualizarStatusSchema = z.object({
  status: z.enum(['pago', 'em_andamento', 'concluido', 'cancelado']),
});

const configPrecoSchema = z.object({
  gruCentavos: z.number().int().min(0).max(1_000_000),
  servicoCentavos: z.number().int().min(0).max(1_000_000),
  ativo: z.boolean().optional(),
});

const configAsaasSchema = z.object({
  ambiente: z.enum(['sandbox', 'producao']),
  // Vazio/ausente = mantém o segredo atual (não sobrescreve com em branco).
  apiKey: z.string().optional(),
  webhookToken: z.string().optional(),
});

/** Mostra só uma dica do segredo (últimos 4), nunca o valor completo. */
function mascarar(valor: string): string {
  if (!valor) return '';
  return valor.length <= 4 ? '••••' : `••••${valor.slice(-4)}`;
}

/**
 * Fila de processos do despachante (visão do admin/backoffice). Lê a tabela
 * autoritativa `ProcessoDespachante` e permite avançar o status. Toda mudança é
 * refletida no espelho de sincronização do usuário, para o app mostrar o
 * andamento.
 */
export async function rotasDespachanteAdmin(app: FastifyInstance) {
  app.addHook('preHandler', exigirAdmin());

  // Preços dos serviços (defaults + overrides). Editável sem update do app.
  app.get('/api/admin/despachante/servicos', async () => ({
    servicos: await resolverServicos(),
  }));

  app.put('/api/admin/despachante/servicos/:tipo', async (req) => {
    const { tipo } = req.params as { tipo: string };
    if (tipo !== 'RENOVACAO_CRAF' && tipo !== 'EMISSAO_GUIA') {
      throw invalido('Serviço desconhecido');
    }
    const { gruCentavos, servicoCentavos, ativo } = configPrecoSchema.parse(req.body);
    await prisma.servicoDespachanteConfig.upsert({
      where: { tipoServico: tipo },
      create: { tipoServico: tipo, gruCentavos, servicoCentavos, ativo: ativo ?? true },
      update: { gruCentavos, servicoCentavos, ativo: ativo ?? true },
    });
    return { ok: true };
  });

  // --------------------------------------------------- integração Asaas
  // Estado atual (sem revelar os segredos) + a URL do webhook para copiar.
  app.get('/api/admin/despachante/asaas', async () => {
    const cfg = await resolverConfigAsaas();
    return {
      ambiente: cfg.ambiente,
      apiKeyDefinida: Boolean(cfg.apiKey),
      apiKeyDica: mascarar(cfg.apiKey),
      webhookTokenDefinido: Boolean(cfg.webhookToken),
      webhookTokenDica: mascarar(cfg.webhookToken),
      webhookUrl: urlWebhookAsaas(),
    };
  });

  app.put('/api/admin/despachante/asaas', async (req) => {
    const { ambiente, apiKey, webhookToken } = configAsaasSchema.parse(req.body);
    const atual = await prisma.configuracaoAsaas.findUnique({ where: { id: 'unico' } });
    // Só sobrescreve o segredo quando um novo valor não-vazio é enviado.
    const novaApiKey = apiKey && apiKey.trim() ? apiKey.trim() : atual?.apiKey ?? null;
    const novoToken =
      webhookToken && webhookToken.trim() ? webhookToken.trim() : atual?.webhookToken ?? null;
    await prisma.configuracaoAsaas.upsert({
      where: { id: 'unico' },
      create: { id: 'unico', ambiente, apiKey: novaApiKey, webhookToken: novoToken },
      update: { ambiente, apiKey: novaApiKey, webhookToken: novoToken },
    });
    return { ok: true };
  });

  app.get('/api/admin/despachante/processos', async (req) => {
    const q = req.query as { status?: string; pagina?: string };
    const status = q.status && STATUS_VALIDOS.includes(q.status as never) ? q.status : undefined;
    const pagina = Math.max(1, Number(q.pagina ?? 1) || 1);

    const where = status ? { status } : {};
    const [processos, total] = await Promise.all([
      prisma.processoDespachante.findMany({
        where,
        orderBy: { criadoEm: 'desc' },
        skip: (pagina - 1) * TAMANHO_PAGINA,
        take: TAMANHO_PAGINA,
        include: {
          usuario: { select: { id: true, nome: true, email: true, cpf: true, celular: true } },
        },
      }),
      prisma.processoDespachante.count({ where }),
    ]);

    return {
      processos: processos.map((p) => ({
        id: p.id,
        tipoServico: p.tipoServico,
        status: p.status,
        valorCentavos: p.valorCentavos,
        armaNome: p.armaNome,
        invoiceUrl: p.invoiceUrl,
        criadoEm: p.criadoEm.toISOString(),
        atualizadoEm: p.atualizadoEm.toISOString(),
        usuario: p.usuario,
      })),
      total,
      pagina,
      tamanhoPagina: TAMANHO_PAGINA,
    };
  });

  app.patch('/api/admin/despachante/processos/:id', async (req) => {
    const { id } = req.params as { id: string };
    const { status } = atualizarStatusSchema.parse(req.body);

    const existente = await prisma.processoDespachante.findUnique({ where: { id } });
    if (!existente) throw naoEncontrado('Processo não encontrado');
    // Não deixa "despagar" um processo ainda não pago pela mão do admin.
    if (status !== 'cancelado' && existente.status === 'aguardando_pagamento' && status !== 'pago') {
      throw invalido('O processo ainda não foi pago.');
    }

    const atualizado = await prisma.processoDespachante.update({
      where: { id },
      data: { status },
    });
    await refletirProcessoNoSync(atualizado);

    return { ok: true, status: atualizado.status };
  });
}
