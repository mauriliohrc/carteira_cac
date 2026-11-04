import type { FastifyInstance } from 'fastify';
import type { ProcessoDespachante } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../db/cliente.js';
import { exigirApp } from '../../http/guardas.js';
import { invalido, naoAutorizado } from '../../http/erros.js';
import { cancelarCobranca, criarCliente, criarCobranca } from '../../integracoes/asaas.js';
import { refletirProcessoNoSync, removerProcessoDoSync } from '../../dominio/despachanteSync.js';
import { GRU_NOTA } from '../../dominio/despachante.js';
import { resolverServico, resolverServicos } from '../../dominio/despachanteConfig.js';

const pedidoSchema = z.object({
  tipoServico: z.enum(['RENOVACAO_CRAF', 'EMISSAO_GUIA']),
  armaId: z.string().optional().nullable(),
  armaNome: z.string().trim().max(120).optional().nullable(),
});

/** Prisma → formato camelCase que o app consome (igual ao tipo Processo). */
function apresentar(p: ProcessoDespachante) {
  return {
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
  };
}

/** Data de vencimento da cobrança: hoje + N dias, no formato YYYY-MM-DD. */
function vencimentoEmDias(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

export async function rotasDespachanteAppV1(app: FastifyInstance) {
  app.addHook('preHandler', exigirApp());

  // Catálogo de serviços (preços resolvidos: defaults + override do backoffice).
  app.get('/app/despachante/servicos', async () => {
    const servicos = (await resolverServicos()).filter((s) => s.ativo);
    return { servicos, gruNota: GRU_NOTA };
  });

  // Processos do usuário (fonte da verdade; o app também os recebe via sync).
  app.get('/app/despachante/pedidos', async (req) => {
    const processos = await prisma.processoDespachante.findMany({
      where: { usuarioId: req.usuario!.id },
      orderBy: { criadoEm: 'desc' },
    });
    return { processos: processos.map(apresentar) };
  });

  // Cria um pedido (1 processo por item) e abre a cobrança no Asaas.
  app.post('/app/despachante/pedidos', async (req) => {
    const { tipoServico, armaId, armaNome } = pedidoSchema.parse(req.body);
    const servico = await resolverServico(tipoServico);
    if (!servico || !servico.ativo) throw invalido('Serviço indisponível');

    const usuario = await prisma.usuarioApp.findUnique({ where: { id: req.usuario!.id } });
    if (!usuario || !usuario.ativo) throw naoAutorizado();
    if (!usuario.celular) throw invalido('celular_requerido');

    // Garante o cliente no Asaas (criado sob demanda na 1ª cobrança).
    let asaasCustomerId = usuario.asaasCustomerId;
    if (!asaasCustomerId) {
      const cliente = await criarCliente({
        name: usuario.nome,
        cpfCnpj: usuario.cpf,
        email: usuario.email,
        mobilePhone: usuario.celular,
      });
      asaasCustomerId = cliente.id;
      await prisma.usuarioApp.update({
        where: { id: usuario.id },
        data: { asaasCustomerId },
      });
    }

    // Cria o processo (aguardando pagamento) e depois a cobrança, para ter o id
    // como externalReference e reconciliar no webhook.
    let processo = await prisma.processoDespachante.create({
      data: {
        usuarioId: usuario.id,
        tipoServico,
        valorCentavos: servico.precoCentavos,
        armaId: armaId ?? null,
        armaNome: armaNome ?? null,
      },
      // precoCentavos = GRU + serviço, já resolvido com overrides do backoffice.
    });

    const cobranca = await criarCobranca({
      customer: asaasCustomerId,
      value: servico.precoCentavos / 100,
      description: `${servico.nome}${armaNome ? ` — ${armaNome}` : ''}`,
      externalReference: processo.id,
      dueDate: vencimentoEmDias(3),
    });

    processo = await prisma.processoDespachante.update({
      where: { id: processo.id },
      data: { asaasPaymentId: cobranca.id, invoiceUrl: cobranca.invoiceUrl },
    });

    await refletirProcessoNoSync(processo);

    return { processo: apresentar(processo), invoiceUrl: cobranca.invoiceUrl };
  });

  // Exclui um processo ainda NÃO pago (cancela a cobrança no Asaas e tombstone
  // no sync). Pago/em andamento não pode ser excluído por aqui.
  app.delete('/app/despachante/pedidos/:id', async (req) => {
    const { id } = req.params as { id: string };
    const processo = await prisma.processoDespachante.findFirst({
      where: { id, usuarioId: req.usuario!.id },
    });
    if (!processo) throw naoAutorizado();
    if (processo.status !== 'aguardando_pagamento') {
      throw invalido('Só é possível excluir um processo que ainda não foi pago.');
    }
    if (processo.asaasPaymentId) await cancelarCobranca(processo.asaasPaymentId);
    await prisma.processoDespachante.delete({ where: { id: processo.id } });
    await removerProcessoDoSync(processo.usuarioId, processo.id);
    return { ok: true };
  });
}
