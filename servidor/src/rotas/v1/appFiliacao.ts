import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../db/cliente.js';
import { exigirApp } from '../../http/guardas.js';
import { invalido, naoAutorizado } from '../../http/erros.js';
import { criarCliente, criarAssinatura, cobrancasDaAssinatura } from '../../integracoes/asaas.js';
import { garantirCertificadoNoAcervo, refletirFiliacaoNoSync } from '../../dominio/filiacaoSync.js';
import { apresentarFiliacao, MESES_VINCULO } from '../../dominio/filiacao.js';
import { resolverConfigFiliacao } from '../../dominio/filiacaoConfig.js';
import { registrarEventoUsuario } from '../../dominio/eventoUsuario.js';

const enderecoSchema = z.object({
  cep: z.string().trim().max(12).optional().nullable(),
  logradouro: z.string().trim().max(160).optional().nullable(),
  numero: z.string().trim().max(20).optional().nullable(),
  complemento: z.string().trim().max(80).optional().nullable(),
  bairro: z.string().trim().max(80).optional().nullable(),
  cidade: z.string().trim().max(80).optional().nullable(),
  uf: z.string().trim().length(2).optional().nullable(),
});

const DOC_TIPOS = ['CNH', 'RG', 'RNE', 'OUTRO'] as const;

const filiarSchema = z.object({
  nomeCompleto: z.string().trim().min(3).max(160),
  // Data de nascimento YYYY-MM-DD (para a carteira de filiado). Opcional.
  dataNascimento: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida')
    .optional()
    .nullable(),
  endereco: enderecoSchema.optional(),
  docTipo: z.enum(DOC_TIPOS).optional(),
  // registroId de um ArquivoSync já enviado pelo app via POST /app/sync/arquivo.
  docArquivoId: z.string().trim().max(80).optional(),
});

const documentoSchema = z.object({
  docTipo: z.enum(DOC_TIPOS),
  docArquivoId: z.string().trim().min(1).max(80),
});

/** Data de vencimento da 1ª cobrança da assinatura: hoje + N dias (YYYY-MM-DD). */
function vencimentoEmDias(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

/**
 * Filiação à liga esportiva (produto principal). Cobrada como ASSINATURA ANUAL
 * recorrente no Asaas — fora do IAP, por ser serviço do mundo real. Ativa o
 * Premium no app, gera carteirinha e certificado. Espelha o fluxo do despachante
 * (appDespachante.ts), mas com assinatura em vez de cobrança avulsa.
 */
export async function rotasFiliacaoAppV1(app: FastifyInstance) {
  app.addHook('preHandler', exigirApp());

  // Status da filiação do usuário + preço/identidade da liga (para a tela).
  app.get('/app/filiacao', async (req) => {
    const [filiacao, config] = await Promise.all([
      prisma.filiacaoLiga.findFirst({
        where: { usuarioId: req.usuario!.id },
        orderBy: { criadoEm: 'desc' },
      }),
      resolverConfigFiliacao(),
    ]);
    // Garante (lazy, idempotente) o certificado no acervo também para filiados
    // ATUAIS que ativaram antes deste recurso existir. Não bloqueia a resposta.
    if (filiacao) void garantirCertificadoNoAcervo(filiacao).catch(() => {});
    return {
      filiacao: filiacao ? apresentarFiliacao(filiacao) : null,
      config: {
        valorCentavos: config.valorCentavos,
        ativo: config.ativo,
        nomeLiga: config.nomeLiga,
        logoUrl: config.logoUrl,
        conteudo: config.conteudo,
        mesesVinculo: MESES_VINCULO,
      },
    };
  });

  // Solicita a filiação e abre a assinatura anual no Asaas.
  app.post('/app/filiacao', async (req) => {
    const { nomeCompleto, dataNascimento, endereco, docTipo, docArquivoId } = filiarSchema.parse(req.body);
    const config = await resolverConfigFiliacao();
    if (!config.ativo) throw invalido('filiacao_indisponivel');

    const usuario = await prisma.usuarioApp.findUnique({ where: { id: req.usuario!.id } });
    if (!usuario || !usuario.ativo) throw naoAutorizado();
    if (!usuario.celular) throw invalido('celular_requerido');

    // Já filiado e vigente → não cobra de novo; devolve a filiação atual.
    const vigente = await prisma.filiacaoLiga.findFirst({
      where: { usuarioId: usuario.id, status: 'ativa' },
      orderBy: { criadoEm: 'desc' },
    });
    if (vigente) {
      return { filiacao: apresentarFiliacao(vigente), invoiceUrl: vigente.invoiceUrl };
    }

    // Pendente de pagamento com checkout aberto → reaproveita (evita duplicar
    // assinatura no Asaas se o usuário voltar à tela).
    const pendente = await prisma.filiacaoLiga.findFirst({
      where: { usuarioId: usuario.id, status: 'pendente_pagamento' },
      orderBy: { criadoEm: 'desc' },
    });
    if (pendente?.invoiceUrl && pendente.asaasSubscriptionId) {
      return { filiacao: apresentarFiliacao(pendente), invoiceUrl: pendente.invoiceUrl };
    }

    // Garante o cliente no Asaas (reaproveita o do despachante, se existir).
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

    // Cria a filiação (pendente) antes da assinatura, para usar o id como
    // externalReference e reconciliar no webhook. vigenteAte é placeholder; a
    // vigência real é definida na ativação (pagamento confirmado).
    let filiacao =
      pendente ??
      (await prisma.filiacaoLiga.create({
        data: {
          usuarioId: usuario.id,
          nomeCompleto,
          cpf: usuario.cpf,
          dataNascimento: dataNascimento ?? null,
          cep: endereco?.cep ?? null,
          logradouro: endereco?.logradouro ?? null,
          numero: endereco?.numero ?? null,
          complemento: endereco?.complemento ?? null,
          bairro: endereco?.bairro ?? null,
          cidade: endereco?.cidade ?? null,
          uf: endereco?.uf ?? null,
          docTipo: docTipo ?? null,
          docArquivoId: docArquivoId ?? null,
          documentacaoCompleta: Boolean(docArquivoId),
          valorCentavos: config.valorCentavos,
          vigenteAte: new Date(),
        },
      }));

    const assinatura = await criarAssinatura({
      customer: asaasCustomerId,
      value: config.valorCentavos / 100,
      description: `Filiação anual — ${config.nomeLiga}`,
      externalReference: filiacao.id,
      nextDueDate: vencimentoEmDias(3),
      cycle: 'YEARLY',
    });

    // A assinatura gera a 1ª cobrança; o checkout vem no invoiceUrl dela.
    const cobrancas = await cobrancasDaAssinatura(assinatura.id);
    const invoiceUrl = cobrancas[0]?.invoiceUrl ?? null;

    filiacao = await prisma.filiacaoLiga.update({
      where: { id: filiacao.id },
      data: {
        asaasSubscriptionId: assinatura.id,
        invoiceUrl,
        // Mantém/atualiza os dados informados nesta tentativa.
        nomeCompleto,
        dataNascimento: dataNascimento ?? filiacao.dataNascimento,
        cep: endereco?.cep ?? filiacao.cep,
        logradouro: endereco?.logradouro ?? filiacao.logradouro,
        numero: endereco?.numero ?? filiacao.numero,
        complemento: endereco?.complemento ?? filiacao.complemento,
        bairro: endereco?.bairro ?? filiacao.bairro,
        cidade: endereco?.cidade ?? filiacao.cidade,
        uf: endereco?.uf ?? filiacao.uf,
        docTipo: docTipo ?? filiacao.docTipo,
        docArquivoId: docArquivoId ?? filiacao.docArquivoId,
        documentacaoCompleta: filiacao.documentacaoCompleta || Boolean(docArquivoId),
      },
    });

    await refletirFiliacaoNoSync(filiacao);
    await registrarEventoUsuario(usuario.id, 'FILIACAO_SOLICITADA', {
      origem: 'ASAAS',
      descricao: `Solicitou filiação à liga (R$ ${(config.valorCentavos / 100).toFixed(2)})`,
    });

    return { filiacao: apresentarFiliacao(filiacao), invoiceUrl };
  });

  // Envia/atualiza o documento de identificação (CNH/RG). O arquivo já foi
  // subido pelo app via POST /app/sync/arquivo; aqui só vinculamos o registroId.
  // Caminho principal dos legados cortesia (ativos, pendentes só de documento).
  app.post('/app/filiacao/documento', async (req) => {
    const { docTipo, docArquivoId } = documentoSchema.parse(req.body);
    const filiacao = await prisma.filiacaoLiga.findFirst({
      where: { usuarioId: req.usuario!.id },
      orderBy: { criadoEm: 'desc' },
    });
    if (!filiacao) throw invalido('sem_filiacao');

    const atualizada = await prisma.filiacaoLiga.update({
      where: { id: filiacao.id },
      data: { docTipo, docArquivoId, documentacaoCompleta: true },
    });
    await refletirFiliacaoNoSync(atualizada);
    await registrarEventoUsuario(req.usuario!.id, 'FILIACAO_DOC_ENVIADO', {
      origem: 'APP',
      descricao: `Enviou documento de identificação (${docTipo})`,
    });
    return { filiacao: apresentarFiliacao(atualizada) };
  });
}
