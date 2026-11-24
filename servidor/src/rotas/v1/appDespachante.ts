import type { FastifyInstance } from 'fastify';
import type { ProcessoDespachante } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../db/cliente.js';
import { exigirApp } from '../../http/guardas.js';
import { invalido, naoAutorizado, naoEncontrado } from '../../http/erros.js';
import { cancelarCobranca, criarCliente, criarCobranca } from '../../integracoes/asaas.js';
import { cifrar, decifrar } from '../../dominio/cripto.js';
import { refletirProcessoNoSync, removerProcessoDoSync } from '../../dominio/despachanteSync.js';
import { GRU_NOTA, precoTotalPedido, precoUnitario } from '../../dominio/despachante.js';
import { usuarioFiliado } from '../../dominio/filiacao.js';
import {
  type ServicoComCampos,
  calcularProgresso,
  campoPreenchido,
  listarStatus,
  resolverServicoDinamico,
  resolverServicosDinamicos,
} from '../../dominio/despachanteCatalogo.js';
import { aoCriarProcesso, aoEnviarDocumento } from '../../dominio/despachanteNotificacoes.js';
import { registrarEventoUsuario } from '../../dominio/eventoUsuario.js';
import { lerTexto, CHAVE_WHATSAPP_JURIDICO } from '../../config/configStore.js';

/** Teto de um documento enviado pelo usuário. */
const LIMITE_ARQUIVO = 10 * 1024 * 1024; // 10 MB

const pedidoSchema = z.object({
  tipoServico: z.string().trim().min(1).max(60),
  // App antigo: uma arma só (single).
  armaId: z.string().optional().nullable(),
  armaNome: z.string().trim().max(160).optional().nullable(),
  // App novo: lista de armas (1..N) — gera um processo por arma e UMA cobrança
  // somando todas. Cada processo tem o seu próprio formulário/checklist.
  armas: z.array(z.object({ id: z.string().nullish(), nome: z.string().trim().max(160).nullish() })).max(50).optional(),
});

type ValorRow = {
  id: string;
  campoId: string | null;
  tipo: string;
  nome: string | null;
  mime: string | null;
  tamanho: number | null;
  valorTexto: string | null;
  valorCpf: string | null;
  conteudo: Uint8Array | null;
  origem: string;
  final: boolean;
  status: string;
  motivo: string | null;
  criadoEm: Date;
};

/** Serviço para o app: mantém os campos LEGADOS (apps antigos) + aditivos novos. */
function apresentarServico(s: ServicoComCampos) {
  return {
    // Legados — apps antigos dependem destes nomes.
    tipo: s.codigo,
    nome: s.nome,
    descricao: s.descricao,
    gruCentavos: s.gruCentavos,
    servicoCentavos: s.servicoCentavos,
    precoCentavos: s.precoCentavos,
    unidade: s.unidade,
    ativo: s.ativo,
    // Aditivos — app novo.
    codigo: s.codigo,
    subtitulo: s.subtitulo,
    comoFunciona: s.comoFunciona,
    icone: s.icone,
    ordem: s.ordem,
    porArma: s.porArma,
    termoAceite: s.termoAceite,
    // Preços diferenciados (filiação × quantidade). Sem faixas, precoFiliado ==
    // preco e `faixas` vazio — o app mostra um preço só, como antes.
    precoFiliadoCentavos: s.precoFiliadoCentavos,
    faixas: s.faixas.map((f) => ({
      qtdMin: f.qtdMin,
      precoCentavos: f.precoCentavos,
      precoFiliadoCentavos: f.precoFiliadoCentavos,
    })),
    campos: s.campos.map((c) => ({
      id: c.id,
      tipo: c.tipo,
      nome: c.nome,
      descricao: c.descricao,
      obrigatorio: c.obrigatorio,
      ordem: c.ordem,
    })),
  };
}

/** Valor de um campo para o app. NUNCA devolve a senha do gov.br de volta. */
function apresentarValor(v: ValorRow) {
  return {
    id: v.id,
    campoId: v.campoId,
    tipo: v.tipo,
    nome: v.nome,
    mime: v.mime,
    tamanho: v.tamanho,
    temArquivo: v.tipo === 'ARQUIVO' && (v.tamanho ?? 0) > 0,
    // Devolve o texto/checkbox para o usuário rever — exceto SENHA_GOV (sensível).
    valorTexto: v.tipo === 'SENHA_GOV' ? null : v.valorTexto,
    valorCpf: v.tipo === 'SENHA_GOV' ? decifrar(v.valorCpf) : null,
    preenchido: campoPreenchido(v.tipo, v),
    origem: v.origem,
    final: v.final,
    status: v.status,
    motivo: v.motivo,
    criadoEm: v.criadoEm.toISOString(),
  };
}

function vencimentoEmDias(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

export async function rotasDespachanteAppV1(app: FastifyInstance) {
  app.addHook('preHandler', exigirApp());

  // Catálogo dinâmico (preços resolvidos + campos de formulário + status).
  app.get('/app/despachante/servicos', async (req) => {
    const [servicos, status, whatsappJuridico, filiado] = await Promise.all([
      resolverServicosDinamicos(true),
      listarStatus(),
      lerTexto(CHAVE_WHATSAPP_JURIDICO),
      usuarioFiliado(req.usuario!.id),
    ]);
    return {
      servicos: servicos.map(apresentarServico),
      status: status.filter((s) => s.ativo),
      gruNota: GRU_NOTA,
      whatsappJuridico: whatsappJuridico ?? '',
      // Se o usuário é filiado da liga (define qual preço a tela destaca e se
      // mostra o convite para filiar). Fonte da verdade da cobrança é o servidor.
      filiado,
    };
  });

  // Processos do usuário — com status dinâmico, progresso e documentos.
  app.get('/app/despachante/pedidos', async (req) => {
    const processos = await prisma.processoDespachante.findMany({
      where: { usuarioId: req.usuario!.id },
      orderBy: { criadoEm: 'desc' },
      include: { valores: { orderBy: { criadoEm: 'asc' } } },
    });
    const status = await listarStatus();
    const metaStatus = new Map(status.map((s) => [s.codigo, s]));
    const servicosCache = new Map<string, ServicoComCampos | undefined>();

    const itens = [];
    for (const p of processos) {
      if (!servicosCache.has(p.tipoServico)) {
        servicosCache.set(p.tipoServico, await resolverServicoDinamico(p.tipoServico));
      }
      const servico = servicosCache.get(p.tipoServico);
      const st = metaStatus.get(p.status);
      itens.push({
        id: p.id,
        tipoServico: p.tipoServico,
        servicoNome: servico?.nome ?? p.tipoServico,
        status: p.status,
        statusLabel: st?.label ?? p.status,
        statusCor: st?.cor ?? '#8a8f98',
        statusIcone: st?.icone ?? null,
        armaId: p.armaId,
        armaNome: p.armaNome,
        valorCentavos: p.valorCentavos,
        quantidade: p.quantidade,
        asaasPaymentId: p.asaasPaymentId,
        grupoId: p.asaasPaymentId ?? p.id,
        invoiceUrl: p.invoiceUrl,
        criadoEm: p.criadoEm.toISOString(),
        atualizadoEm: p.atualizadoEm.toISOString(),
        progresso: servico ? calcularProgresso(servico.campos, p.valores) : null,
        campos: servico ? apresentarServico(servico).campos : [],
        // Mostra só os campos do usuário e os documentos FINAIS — os documentos
        // internos (certidões do despachante) nunca vão para o app.
        valores: (p.valores as ValorRow[]).filter((v) => v.campoId || v.final).map(apresentarValor),
      });
    }
    return { processos: itens };
  });

  // Cria um pedido e abre a cobrança no Asaas. Serviço por-arma com N armas:
  // N processos (um por arma, cada um com o seu formulário) + UMA cobrança
  // somando todas (preço × nº de armas).
  app.post('/app/despachante/pedidos', async (req) => {
    const { tipoServico, armaId, armaNome, armas } = pedidoSchema.parse(req.body);
    const servico = await resolverServicoDinamico(tipoServico);
    if (!servico || !servico.ativo) throw invalido('Serviço indisponível');

    const usuario = await prisma.usuarioApp.findUnique({ where: { id: req.usuario!.id } });
    if (!usuario || !usuario.ativo) throw naoAutorizado();
    if (!usuario.celular) throw invalido('celular_requerido');

    // Itens cobrados: lista de armas (app novo) ou uma única (app antigo/genérico).
    const itens =
      armas && armas.length
        ? armas.map((a) => ({ id: a.id ?? null, nome: a.nome ?? null }))
        : [{ id: armaId ?? null, nome: armaNome ?? null }];

    // Preço autoritativo no SERVIDOR: a faixa certa pela quantidade e o preço de
    // filiado/não-filiado conforme a filiação vigente — nunca confia no cliente.
    // Sem faixas cadastradas, cai no preço legado (= servico.precoCentavos).
    const filiado = await usuarioFiliado(usuario.id);
    const precoUnitarioCentavos = precoUnitario(servico, itens.length, filiado);
    const totalCentavos = precoTotalPedido(servico, itens.length, filiado);

    let asaasCustomerId = usuario.asaasCustomerId;
    if (!asaasCustomerId) {
      const cliente = await criarCliente({
        name: usuario.nome,
        cpfCnpj: usuario.cpf,
        email: usuario.email,
        mobilePhone: usuario.celular,
      });
      asaasCustomerId = cliente.id;
      await prisma.usuarioApp.update({ where: { id: usuario.id }, data: { asaasCustomerId } });
    }

    // Um processo por item (cada um tem o seu próprio checklist).
    const criados: ProcessoDespachante[] = [];
    for (const it of itens) {
      criados.push(
        await prisma.processoDespachante.create({
          data: {
            usuarioId: usuario.id,
            tipoServico,
            status: 'aguardando_pagamento',
            valorCentavos: precoUnitarioCentavos,
            armaId: it.id,
            armaNome: it.nome,
          },
        })
      );
    }

    // UMA cobrança do total (referência = 1º processo; todos compartilham o id).
    const resumoArmas = itens.length > 1 ? `${itens.length} armas` : itens[0]!.nome ?? '';
    const cobranca = await criarCobranca({
      customer: asaasCustomerId,
      value: totalCentavos / 100,
      description: `${servico.nome}${resumoArmas ? ` — ${resumoArmas}` : ''}`,
      externalReference: criados[0]!.id,
      dueDate: vencimentoEmDias(3),
    });

    const atualizados: ProcessoDespachante[] = [];
    for (const pr of criados) {
      const u = await prisma.processoDespachante.update({
        where: { id: pr.id },
        data: { asaasPaymentId: cobranca.id, invoiceUrl: cobranca.invoiceUrl },
      });
      await refletirProcessoNoSync(u);
      atualizados.push(u);
    }
    // Um único "pedido criado" (evita N notificações).
    void aoCriarProcesso(atualizados[0]!, servico.nome).catch(() => {});

    // Devolve os processos COMPLETOS — o app grava cada um no SQLite local.
    const full = (p: ProcessoDespachante) => ({
      id: p.id,
      tipoServico: p.tipoServico,
      status: p.status,
      armaId: p.armaId,
      armaNome: p.armaNome,
      valorCentavos: p.valorCentavos,
      quantidade: p.quantidade,
      asaasPaymentId: p.asaasPaymentId,
      invoiceUrl: p.invoiceUrl,
      criadoEm: p.criadoEm.toISOString(),
      atualizadoEm: p.atualizadoEm.toISOString(),
    });
    return {
      processos: atualizados.map(full),
      processo: full(atualizados[0]!), // compat app antigo
      invoiceUrl: cobranca.invoiceUrl,
    };
  });

  // Cancela um pedido ainda NÃO pago (o pedido inteiro — todos os irmãos que
  // compartilham a cobrança) e remove a cobrança no Asaas.
  app.delete('/app/despachante/pedidos/:id', async (req) => {
    const { id } = req.params as { id: string };
    const processo = await prisma.processoDespachante.findFirst({
      where: { id, usuarioId: req.usuario!.id },
    });
    if (!processo) throw naoAutorizado();

    const irmaos = processo.asaasPaymentId
      ? await prisma.processoDespachante.findMany({
          where: { asaasPaymentId: processo.asaasPaymentId, usuarioId: req.usuario!.id },
        })
      : [processo];
    if (irmaos.some((p) => p.status !== 'aguardando_pagamento')) {
      throw invalido('Este pedido já foi pago e não pode ser cancelado pelo app.');
    }
    if (processo.asaasPaymentId) {
      try {
        await cancelarCobranca(processo.asaasPaymentId);
      } catch {
        /* cobrança pode já ter sido removida */
      }
    }
    for (const p of irmaos) {
      await prisma.processoDespachante.delete({ where: { id: p.id } });
      await removerProcessoDoSync(p.usuarioId, p.id);
    }
    return { ok: true };
  });

  // Processo do usuário + guard (precisa estar pago para receber documentos).
  async function processoDoUsuario(req: { usuario?: { id: string } }, id: string) {
    const processo = await prisma.processoDespachante.findFirst({
      where: { id, usuarioId: req.usuario!.id },
    });
    if (!processo) throw naoAutorizado();
    return processo;
  }

  // Preenche/atualiza um campo de TEXTO / CHECKBOX / SENHA_GOV.
  app.post('/app/despachante/pedidos/:id/campos/:campoId', async (req) => {
    const { id, campoId } = req.params as { id: string; campoId: string };
    const body = z
      .object({
        valorTexto: z.string().max(4000).nullish(),
        valorCpf: z.string().max(20).nullish(),
        checkbox: z.boolean().optional(),
      })
      .parse(req.body);
    const processo = await processoDoUsuario(req, id);

    const campo = await prisma.campoServicoDespachante.findUnique({ where: { id: campoId } });
    const servico = await resolverServicoDinamico(processo.tipoServico);
    if (!campo || !servico || campo.servicoId !== servico.id) throw naoEncontrado('Campo não encontrado');
    if (campo.tipo === 'ARQUIVO') throw invalido('Use o upload de arquivo para este campo');

    let valorTexto: string | null = null;
    let valorCpf: string | null = null;
    if (campo.tipo === 'CHECKBOX') {
      valorTexto = body.checkbox ? 'true' : 'false';
    } else if (campo.tipo === 'SENHA_GOV') {
      // CPF e senha do gov.br cifrados em repouso (ativo de maior valor).
      valorCpf = cifrar((body.valorCpf ?? '').replace(/\D/g, '') || null);
      valorTexto = cifrar(body.valorTexto ?? null); // a senha
    } else {
      valorTexto = body.valorTexto ?? null;
    }

    await prisma.valorCampoProcessoDespachante.upsert({
      where: { processoId_campoId: { processoId: id, campoId } },
      create: { processoId: id, campoId, tipo: campo.tipo, valorTexto, valorCpf, origem: 'USUARIO', status: 'ENVIADO' },
      update: { valorTexto, valorCpf, status: 'ENVIADO', motivo: null },
    });
    void registrarEventoUsuario(processo.usuarioId, 'PROCESSO_DOC_ENVIADO', { descricao: campo.nome, origem: 'APP' });
    void aoEnviarDocumento(id).catch(() => {});
    return { ok: true };
  });

  // Upload de um documento (campo ARQUIVO).
  app.post('/app/despachante/pedidos/:id/campos/:campoId/arquivo', async (req) => {
    const { id, campoId } = req.params as { id: string; campoId: string };
    const { nome, mime, dadosBase64 } = z
      .object({
        nome: z.string().trim().max(200).optional(),
        mime: z.string().trim().max(120).optional(),
        dadosBase64: z.string().min(1),
      })
      .parse(req.body);
    const processo = await processoDoUsuario(req, id);
    const campo = await prisma.campoServicoDespachante.findUnique({ where: { id: campoId } });
    const servico = await resolverServicoDinamico(processo.tipoServico);
    if (!campo || !servico || campo.servicoId !== servico.id) throw naoEncontrado('Campo não encontrado');
    if (campo.tipo !== 'ARQUIVO') throw invalido('Este campo não é de arquivo');

    const conteudo = Buffer.from(dadosBase64, 'base64');
    if (conteudo.length === 0) throw invalido('Arquivo vazio');
    if (conteudo.length > LIMITE_ARQUIVO) throw invalido('Arquivo muito grande (máx. 10 MB)');

    await prisma.valorCampoProcessoDespachante.upsert({
      where: { processoId_campoId: { processoId: id, campoId } },
      create: {
        processoId: id,
        campoId,
        tipo: 'ARQUIVO',
        nome: nome ?? campo.nome,
        mime: mime ?? 'application/octet-stream',
        tamanho: conteudo.length,
        conteudo,
        origem: 'USUARIO',
        status: 'ENVIADO',
      },
      update: {
        nome: nome ?? campo.nome,
        mime: mime ?? 'application/octet-stream',
        tamanho: conteudo.length,
        conteudo,
        status: 'ENVIADO',
        motivo: null,
      },
    });
    void registrarEventoUsuario(processo.usuarioId, 'PROCESSO_DOC_ENVIADO', { descricao: campo.nome, origem: 'APP' });
    void aoEnviarDocumento(id).catch(() => {});
    return { ok: true };
  });

  // Baixar um arquivo do próprio processo (documento enviado ou anexo final).
  app.get('/app/despachante/pedidos/:id/arquivo/:valorId', async (req, reply) => {
    const { id, valorId } = req.params as { id: string; valorId: string };
    await processoDoUsuario(req, id);
    const valor = await prisma.valorCampoProcessoDespachante.findFirst({
      // Só campos do usuário (campoId) ou documentos finais — nunca os internos.
      where: { id: valorId, processoId: id, OR: [{ campoId: { not: null } }, { final: true }] },
    });
    if (!valor || !valor.conteudo) throw naoEncontrado('Arquivo não encontrado');
    // O MIME vem do upload do usuário: neutraliza tipos que o navegador
    // executaria na origem da API (HTML/SVG/XML) e impede sniffing.
    const mime = (valor.mime ?? '').toLowerCase().split(';')[0].trim();
    const perigoso = /html|svg|xml|xhtml/.test(mime) || mime === '';
    reply
      .header('Content-Type', perigoso ? 'application/octet-stream' : mime)
      .header('X-Content-Type-Options', 'nosniff')
      .header(
        'Content-Disposition',
        `${perigoso ? 'attachment' : 'inline'}; filename="${(valor.nome ?? 'arquivo').replace(/"/g, '')}"`
      );
    return reply.send(Buffer.from(valor.conteudo));
  });
}
