import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db/cliente.js';
import { exigirAdmin } from '../http/guardas.js';
import { conflito, invalido, naoEncontrado } from '../http/erros.js';
import {
  calcularProgresso,
  campoPreenchido,
  garantirCatalogoDespachante,
  listarStatus,
  resolverServicoDinamico,
  statusPorPapel,
} from '../dominio/despachanteCatalogo.js';
import { mudarStatusProcesso } from '../dominio/despachanteNotificacoes.js';
import { refletirProcessoNoSync, removerProcessoDoSync } from '../dominio/despachanteSync.js';
import { cancelarCobranca } from '../integracoes/asaas.js';
import { precoTotal } from '../dominio/despachante.js';
import { resolverConfigAsaas, urlWebhookAsaas } from '../dominio/asaasConfig.js';
import { lerTexto, gravarTexto, CHAVE_WHATSAPP_JURIDICO } from '../config/configStore.js';

const TAMANHO_PAGINA = 50;
/** Teto de um arquivo (documento) do despachante. */
const LIMITE_ARQUIVO = 10 * 1024 * 1024; // 10 MB

const TIPOS_CAMPO = ['ARQUIVO', 'TEXTO', 'CHECKBOX', 'SENHA_GOV'] as const;
const PAPEIS_STATUS = ['INICIAL', 'PAGO', 'AGUARDANDO_DOC', 'EM_ANALISE', 'NORMAL', 'FINAL', 'CANCELADO'] as const;

const servicoSchema = z.object({
  nome: z.string().trim().min(1).max(120),
  subtitulo: z.string().trim().max(160).nullish(),
  descricao: z.string().trim().max(4000).default(''),
  comoFunciona: z.string().trim().max(4000).nullish(),
  icone: z.string().trim().max(60).optional(),
  gruCentavos: z.number().int().min(0).max(10_000_000).default(0),
  servicoCentavos: z.number().int().min(0).max(10_000_000).default(0),
  unidade: z.string().trim().max(40).optional(),
  porArma: z.boolean().optional(),
  ativo: z.boolean().optional(),
  ordem: z.number().int().min(0).max(100_000).optional(),
  mensagemWhatsappInicio: z.string().trim().max(2000).nullish(),
  termoAceite: z.string().trim().max(8000).nullish(),
});

const campoSchema = z.object({
  tipo: z.enum(TIPOS_CAMPO),
  nome: z.string().trim().min(1).max(120),
  descricao: z.string().trim().max(2000).nullish(),
  obrigatorio: z.boolean().optional(),
  ordem: z.number().int().min(0).max(100_000).optional(),
  ativo: z.boolean().optional(),
});

const statusSchema = z.object({
  label: z.string().trim().min(1).max(60),
  cor: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, 'Cor deve ser #RRGGBB').optional(),
  icone: z.string().trim().max(60).nullish(),
  papel: z.enum(PAPEIS_STATUS).optional(),
  ordem: z.number().int().min(0).max(100_000).optional(),
  ativo: z.boolean().optional(),
});

const configAsaasSchema = z.object({
  ambiente: z.enum(['sandbox', 'producao']),
  apiKey: z.string().optional(),
  webhookToken: z.string().optional(),
});

function mascarar(valor: string): string {
  if (!valor) return '';
  return valor.length <= 4 ? '••••' : `••••${valor.slice(-4)}`;
}

function gerarSlug(base: string): string {
  return (
    base
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 40) || 'ITEM'
  );
}

async function codigoUnico(
  nome: string,
  existe: (c: string) => Promise<boolean>
): Promise<string> {
  const base = gerarSlug(nome);
  let cand = base;
  let i = 1;
  while (await existe(cand)) cand = `${base}_${++i}`;
  return cand;
}

/** Valor de campo → resumo seguro para o admin (inclui senha gov, oculta bytes). */
function apresentarValor(v: {
  id: string;
  campoId: string | null;
  tipo: string;
  nome: string | null;
  mime: string | null;
  tamanho: number | null;
  valorTexto: string | null;
  valorCpf: string | null;
  origem: string;
  final: boolean;
  status: string;
  motivo: string | null;
  criadoEm: Date;
}) {
  return {
    id: v.id,
    campoId: v.campoId,
    tipo: v.tipo,
    nome: v.nome,
    mime: v.mime,
    tamanho: v.tamanho,
    // Texto/checkbox/senha: o admin vê o valor (inclui a senha do gov.br).
    valorTexto: v.valorTexto,
    valorCpf: v.valorCpf,
    temArquivo: v.tipo === 'ARQUIVO' && (v.tamanho ?? 0) > 0,
    preenchido: campoPreenchido(v.tipo, v),
    origem: v.origem,
    final: v.final,
    status: v.status,
    motivo: v.motivo,
    criadoEm: v.criadoEm.toISOString(),
  };
}

/**
 * Backoffice do despachante: catálogo dinâmico (serviços, status, campos de
 * formulário), fila de processos e gestão (status, revisão de documentos,
 * anexos finais). Toda mudança de status reflete no sync e notifica o usuário.
 */
export async function rotasDespachanteAdmin(app: FastifyInstance) {
  app.addHook('preHandler', exigirAdmin());

  // ----------------------------------------------------------- catálogo
  // Serviços (com TODOS os campos, inclusive inativos) + status, p/ gestão.
  app.get('/api/admin/despachante/catalogo', async () => {
    await garantirCatalogoDespachante();
    const [servicos, status] = await Promise.all([
      prisma.servicoDespachante.findMany({
        orderBy: [{ ordem: 'asc' }, { nome: 'asc' }],
        include: { campos: { orderBy: { ordem: 'asc' } } },
      }),
      listarStatus(),
    ]);
    return {
      servicos: servicos.map((s) => ({ ...s, precoCentavos: precoTotal(s) })),
      status,
    };
  });

  app.post('/api/admin/despachante/servicos', async (req) => {
    const d = servicoSchema.parse(req.body);
    const codigo = await codigoUnico(d.nome, async (c) =>
      Boolean(await prisma.servicoDespachante.findUnique({ where: { codigo: c } }))
    );
    const servico = await prisma.servicoDespachante.create({
      data: {
        codigo,
        nome: d.nome,
        subtitulo: d.subtitulo ?? null,
        descricao: d.descricao,
        comoFunciona: d.comoFunciona ?? null,
        icone: d.icone || 'briefcase-outline',
        gruCentavos: d.gruCentavos,
        servicoCentavos: d.servicoCentavos,
        unidade: d.unidade || 'por processo',
        porArma: d.porArma ?? false,
        ativo: d.ativo ?? true,
        ordem: d.ordem ?? 999,
        mensagemWhatsappInicio: d.mensagemWhatsappInicio ?? null,
        termoAceite: d.termoAceite ?? null,
      },
    });
    return { ok: true, id: servico.id, codigo };
  });

  app.put('/api/admin/despachante/servicos/:id', async (req) => {
    const { id } = req.params as { id: string };
    const d = servicoSchema.parse(req.body);
    const existe = await prisma.servicoDespachante.findUnique({ where: { id } });
    if (!existe) throw naoEncontrado('Serviço não encontrado');
    await prisma.servicoDespachante.update({
      where: { id },
      data: {
        nome: d.nome,
        subtitulo: d.subtitulo ?? null,
        descricao: d.descricao,
        comoFunciona: d.comoFunciona ?? null,
        icone: d.icone || existe.icone,
        gruCentavos: d.gruCentavos,
        servicoCentavos: d.servicoCentavos,
        unidade: d.unidade || existe.unidade,
        porArma: d.porArma ?? existe.porArma,
        ativo: d.ativo ?? existe.ativo,
        ordem: d.ordem ?? existe.ordem,
        mensagemWhatsappInicio: d.mensagemWhatsappInicio ?? null,
        termoAceite: d.termoAceite ?? null,
      },
    });
    return { ok: true };
  });

  app.delete('/api/admin/despachante/servicos/:id', async (req) => {
    const { id } = req.params as { id: string };
    const servico = await prisma.servicoDespachante.findUnique({ where: { id } });
    if (!servico) throw naoEncontrado('Serviço não encontrado');
    const emUso = await prisma.processoDespachante.count({ where: { tipoServico: servico.codigo } });
    if (emUso > 0) {
      throw conflito(`Há ${emUso} processo(s) deste serviço. Desative-o em vez de excluir.`);
    }
    await prisma.servicoDespachante.delete({ where: { id } });
    return { ok: true };
  });

  // ----------------------------------------------------------- campos
  app.post('/api/admin/despachante/servicos/:id/campos', async (req) => {
    const { id } = req.params as { id: string };
    const d = campoSchema.parse(req.body);
    const servico = await prisma.servicoDespachante.findUnique({ where: { id } });
    if (!servico) throw naoEncontrado('Serviço não encontrado');
    const campo = await prisma.campoServicoDespachante.create({
      data: {
        servicoId: id,
        tipo: d.tipo,
        nome: d.nome,
        descricao: d.descricao ?? null,
        obrigatorio: d.obrigatorio ?? true,
        ordem: d.ordem ?? 999,
        ativo: d.ativo ?? true,
      },
    });
    return { ok: true, id: campo.id };
  });

  app.put('/api/admin/despachante/campos/:id', async (req) => {
    const { id } = req.params as { id: string };
    const d = campoSchema.parse(req.body);
    const existe = await prisma.campoServicoDespachante.findUnique({ where: { id } });
    if (!existe) throw naoEncontrado('Campo não encontrado');
    await prisma.campoServicoDespachante.update({
      where: { id },
      data: {
        tipo: d.tipo,
        nome: d.nome,
        descricao: d.descricao ?? null,
        obrigatorio: d.obrigatorio ?? existe.obrigatorio,
        ordem: d.ordem ?? existe.ordem,
        ativo: d.ativo ?? existe.ativo,
      },
    });
    return { ok: true };
  });

  app.delete('/api/admin/despachante/campos/:id', async (req) => {
    const { id } = req.params as { id: string };
    const existe = await prisma.campoServicoDespachante.findUnique({ where: { id } });
    if (!existe) throw naoEncontrado('Campo não encontrado');
    await prisma.campoServicoDespachante.delete({ where: { id } });
    return { ok: true };
  });

  // ----------------------------------------------------------- status (CRUD)
  app.post('/api/admin/despachante/status', async (req) => {
    const d = statusSchema.parse(req.body);
    const codigo = await codigoUnico(d.label, async (c) =>
      Boolean(await prisma.statusProcessoDespachante.findUnique({ where: { codigo: c } }))
    );
    const st = await prisma.statusProcessoDespachante.create({
      data: {
        codigo: codigo.toLowerCase(),
        label: d.label,
        cor: d.cor ?? '#8a8f98',
        icone: d.icone ?? null,
        papel: d.papel ?? 'NORMAL',
        ordem: d.ordem ?? 999,
        ativo: d.ativo ?? true,
      },
    });
    return { ok: true, id: st.id, codigo: st.codigo };
  });

  app.put('/api/admin/despachante/status/:id', async (req) => {
    const { id } = req.params as { id: string };
    const d = statusSchema.parse(req.body);
    const existe = await prisma.statusProcessoDespachante.findUnique({ where: { id } });
    if (!existe) throw naoEncontrado('Status não encontrado');
    await prisma.statusProcessoDespachante.update({
      where: { id },
      data: {
        label: d.label,
        cor: d.cor ?? existe.cor,
        icone: d.icone ?? null,
        papel: d.papel ?? existe.papel,
        ordem: d.ordem ?? existe.ordem,
        ativo: d.ativo ?? existe.ativo,
      },
    });
    return { ok: true };
  });

  app.delete('/api/admin/despachante/status/:id', async (req) => {
    const { id } = req.params as { id: string };
    const st = await prisma.statusProcessoDespachante.findUnique({ where: { id } });
    if (!st) throw naoEncontrado('Status não encontrado');
    const emUso = await prisma.processoDespachante.count({ where: { status: st.codigo } });
    if (emUso > 0) throw conflito(`Há ${emUso} processo(s) neste status. Desative-o em vez de excluir.`);
    await prisma.statusProcessoDespachante.delete({ where: { id } });
    return { ok: true };
  });

  // ----------------------------------------------------- Asaas / jurídico
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
    const novaApiKey = apiKey && apiKey.trim() ? apiKey.trim() : atual?.apiKey ?? null;
    const novoToken = webhookToken && webhookToken.trim() ? webhookToken.trim() : atual?.webhookToken ?? null;
    await prisma.configuracaoAsaas.upsert({
      where: { id: 'unico' },
      create: { id: 'unico', ambiente, apiKey: novaApiKey, webhookToken: novoToken },
      update: { ambiente, apiKey: novaApiKey, webhookToken: novoToken },
    });
    return { ok: true };
  });

  app.get('/api/admin/config/juridico', async () => ({
    whatsappJuridico: (await lerTexto(CHAVE_WHATSAPP_JURIDICO)) ?? '',
  }));

  app.put('/api/admin/config/juridico', async (req) => {
    const { whatsappJuridico } = z.object({ whatsappJuridico: z.string().trim().max(30) }).parse(req.body);
    await gravarTexto(CHAVE_WHATSAPP_JURIDICO, whatsappJuridico.replace(/\D/g, ''));
    return { ok: true };
  });

  // ----------------------------------------------------------- processos
  app.get('/api/admin/despachante/processos', async (req) => {
    const q = req.query as { status?: string; papel?: string; pagina?: string };
    const pagina = Math.max(1, Number(q.pagina ?? 1) || 1);
    let where: { status?: string | { in: string[] } } = {};
    if (q.status) {
      where = { status: q.status };
    } else if (q.papel) {
      // Filtro por categoria (papel): todos os status com aquele papel.
      const codigos = (await listarStatus()).filter((s) => s.papel === q.papel).map((s) => s.codigo);
      where = { status: { in: codigos.length ? codigos : ['__none__'] } };
    }
    const [processos, total, status] = await Promise.all([
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
      listarStatus(),
    ]);
    const metaStatus = new Map(status.map((s) => [s.codigo, s]));
    return {
      status,
      processos: processos.map((p) => {
        const st = metaStatus.get(p.status);
        return {
          id: p.id,
          tipoServico: p.tipoServico,
          status: p.status,
          statusLabel: st?.label ?? p.status,
          statusCor: st?.cor ?? '#8a8f98',
          statusIcone: st?.icone ?? null,
          valorCentavos: p.valorCentavos,
          armaNome: p.armaNome,
          invoiceUrl: p.invoiceUrl,
          // Chave de agrupamento: processos do mesmo pedido (por-arma) compartilham.
          grupoId: p.asaasPaymentId ?? p.id,
          criadoEm: p.criadoEm.toISOString(),
          atualizadoEm: p.atualizadoEm.toISOString(),
          usuario: p.usuario,
        };
      }),
      total,
      pagina,
      tamanhoPagina: TAMANHO_PAGINA,
    };
  });

  app.get('/api/admin/despachante/processos/:id', async (req) => {
    const { id } = req.params as { id: string };
    const processo = await prisma.processoDespachante.findUnique({
      where: { id },
      include: {
        usuario: { select: { id: true, nome: true, email: true, cpf: true, celular: true } },
        valores: { orderBy: { criadoEm: 'asc' } },
      },
    });
    if (!processo) throw naoEncontrado('Processo não encontrado');
    const [servico, status] = await Promise.all([
      resolverServicoDinamico(processo.tipoServico),
      listarStatus(),
    ]);
    const progresso = servico ? calcularProgresso(servico.campos, processo.valores) : null;
    const st = status.find((s) => s.codigo === processo.status);
    return {
      id: processo.id,
      tipoServico: processo.tipoServico,
      servicoNome: servico?.nome ?? processo.tipoServico,
      status: processo.status,
      statusLabel: st?.label ?? processo.status,
      statusCor: st?.cor ?? '#8a8f98',
      valorCentavos: processo.valorCentavos,
      armaNome: processo.armaNome,
      invoiceUrl: processo.invoiceUrl,
      observacao: processo.observacao,
      criadoEm: processo.criadoEm.toISOString(),
      atualizadoEm: processo.atualizadoEm.toISOString(),
      usuario: processo.usuario,
      campos: servico?.campos ?? [],
      valores: processo.valores.map(apresentarValor),
      progresso,
      statusDisponiveis: status,
    };
  });

  app.patch('/api/admin/despachante/processos/:id', async (req) => {
    const { id } = req.params as { id: string };
    const { status, observacao } = z
      .object({ status: z.string().optional(), observacao: z.string().max(4000).nullish() })
      .parse(req.body);
    const processo = await prisma.processoDespachante.findUnique({ where: { id } });
    if (!processo) throw naoEncontrado('Processo não encontrado');

    if (observacao !== undefined) {
      await prisma.processoDespachante.update({ where: { id }, data: { observacao: observacao ?? null } });
    }
    if (status && status !== processo.status) {
      const st = await prisma.statusProcessoDespachante.findUnique({ where: { codigo: status } });
      if (!st) throw invalido('Status desconhecido');
      await mudarStatusProcesso(processo, status);
    }
    return { ok: true };
  });

  // Processos do mesmo pedido (compartilham a cobrança). Sozinho se não houver.
  async function irmaos(processo: { id: string; asaasPaymentId: string | null }) {
    if (!processo.asaasPaymentId) return prisma.processoDespachante.findMany({ where: { id: processo.id } });
    return prisma.processoDespachante.findMany({ where: { asaasPaymentId: processo.asaasPaymentId } });
  }

  // Cancela o pedido (status cancelado em todos os irmãos) + remove a cobrança
  // no Asaas. Admin pode cancelar a qualquer momento.
  app.post('/api/admin/despachante/processos/:id/cancelar', async (req) => {
    const { id } = req.params as { id: string };
    const processo = await prisma.processoDespachante.findUnique({ where: { id } });
    if (!processo) throw naoEncontrado('Processo não encontrado');
    if (processo.asaasPaymentId) {
      try {
        await cancelarCobranca(processo.asaasPaymentId);
      } catch {
        /* cobrança já paga/removida — segue cancelando o processo */
      }
    }
    const grupo = await irmaos(processo);
    const canc = await statusPorPapel('CANCELADO');
    for (let i = 0; i < grupo.length; i++) {
      await mudarStatusProcesso(grupo[i]!, canc?.codigo ?? 'cancelado', { notificar: i === 0 });
    }
    return { ok: true, afetados: grupo.length };
  });

  // Exclui o pedido de vez (remove do banco + tombstone no sync) + remove a
  // cobrança no Asaas. Admin pode excluir a qualquer momento.
  app.delete('/api/admin/despachante/processos/:id', async (req) => {
    const { id } = req.params as { id: string };
    const processo = await prisma.processoDespachante.findUnique({ where: { id } });
    if (!processo) throw naoEncontrado('Processo não encontrado');
    if (processo.asaasPaymentId) {
      try {
        await cancelarCobranca(processo.asaasPaymentId);
      } catch {
        /* best-effort */
      }
    }
    const grupo = await irmaos(processo);
    for (const p of grupo) {
      await prisma.processoDespachante.delete({ where: { id: p.id } });
      await removerProcessoDoSync(p.usuarioId, p.id);
    }
    return { ok: true, afetados: grupo.length };
  });

  // Aprovar / rejeitar um documento enviado pelo usuário.
  app.post('/api/admin/despachante/processos/:id/valores/:valorId/revisar', async (req) => {
    const { valorId } = req.params as { id: string; valorId: string };
    const { aprovar, motivo } = z
      .object({ aprovar: z.boolean(), motivo: z.string().max(1000).nullish() })
      .parse(req.body);
    const valor = await prisma.valorCampoProcessoDespachante.findUnique({ where: { id: valorId } });
    if (!valor) throw naoEncontrado('Documento não encontrado');
    await prisma.valorCampoProcessoDespachante.update({
      where: { id: valorId },
      data: { status: aprovar ? 'APROVADO' : 'REJEITADO', motivo: aprovar ? null : motivo ?? null },
    });
    return { ok: true };
  });

  // Anexar um documento FINAL (entregue pelo despachante ao concluir).
  app.post('/api/admin/despachante/processos/:id/final', async (req) => {
    const { id } = req.params as { id: string };
    const { nome, mime, dadosBase64 } = z
      .object({
        nome: z.string().trim().min(1).max(200),
        mime: z.string().trim().max(120).optional(),
        dadosBase64: z.string().min(1),
      })
      .parse(req.body);
    const processo = await prisma.processoDespachante.findUnique({ where: { id } });
    if (!processo) throw naoEncontrado('Processo não encontrado');
    const conteudo = Buffer.from(dadosBase64, 'base64');
    if (conteudo.length === 0) throw invalido('Arquivo vazio');
    if (conteudo.length > LIMITE_ARQUIVO) throw invalido('Arquivo muito grande (máx. 10 MB)');
    const valor = await prisma.valorCampoProcessoDespachante.create({
      data: {
        processoId: id,
        campoId: null,
        tipo: 'ARQUIVO',
        nome,
        mime: mime ?? 'application/octet-stream',
        tamanho: conteudo.length,
        conteudo,
        origem: 'DESPACHANTE',
        final: true,
        status: 'APROVADO',
      },
    });
    // Reflete no sync para o app (empurra o registro no próximo pull).
    await refletirProcessoNoSync(processo);
    return { ok: true, id: valor.id };
  });

  app.delete('/api/admin/despachante/processos/:id/valores/:valorId', async (req) => {
    const { valorId } = req.params as { id: string; valorId: string };
    const valor = await prisma.valorCampoProcessoDespachante.findUnique({ where: { id: valorId } });
    if (!valor) throw naoEncontrado('Documento não encontrado');
    await prisma.valorCampoProcessoDespachante.delete({ where: { id: valorId } });
    return { ok: true };
  });

  // Baixar um arquivo (documento do usuário ou anexo final) — base64 p/ o fetch
  // autenticado do backoffice, igual ao arquivo do perfil do usuário.
  app.get('/api/admin/despachante/processos/:id/arquivo/:valorId', async (req) => {
    const { valorId } = req.params as { id: string; valorId: string };
    const valor = await prisma.valorCampoProcessoDespachante.findUnique({ where: { id: valorId } });
    if (!valor || !valor.conteudo) throw naoEncontrado('Arquivo não encontrado');
    return {
      base64: Buffer.from(valor.conteudo).toString('base64'),
      mime: valor.mime ?? 'application/octet-stream',
      nome: valor.nome ?? 'arquivo',
    };
  });
}
