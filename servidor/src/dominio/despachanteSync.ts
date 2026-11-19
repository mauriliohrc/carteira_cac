import type { ProcessoDespachante } from '@prisma/client';
import { prisma } from '../db/cliente.js';
import { baseLegadoDoPapel } from './despachanteCatalogo.js';

/** Códigos de status que apps antigos entendem direto (sem o catálogo). */
const CODIGOS_LEGADOS = new Set(['aguardando_pagamento', 'pago', 'em_andamento', 'concluido', 'cancelado']);

/**
 * Reflete um processo de despachante no espelho de sincronização do usuário
 * (RegistroSync tipo 'processos'), para o app receber o andamento pelo pull —
 * mesmo mecanismo que o acervoAdmin usa para editar o acervo de um usuário.
 *
 * As chaves do JSON são snake_case, idênticas às colunas da tabela local
 * `processos` no app, porque o upsert do pull é genérico (usa as chaves como
 * colunas). `atualizado_em` avança para "agora" a cada reflexo, empurrando o
 * `carimboServidor` e garantindo que o registro caia no próximo pull.
 *
 * COMPAT (CRÍTICO): as chaves do JSON são EXATAMENTE as mesmas de sempre — não
 * se adiciona chave nova a um tipo de sync existente (viraria coluna que o
 * SQLite do app antigo não tem e quebraria o pull). O campo `status` é sempre um
 * dos 5 códigos LEGADOS (mapeado do papel do status dinâmico), então status
 * novos aparecem para o app antigo como o código-base equivalente. O app NOVO lê
 * o status dinâmico (código/label/cor/ícone) pela API `/app/despachante/pedidos`.
 */
export async function refletirProcessoNoSync(p: ProcessoDespachante): Promise<void> {
  const agora = new Date();
  const st = await prisma.statusProcessoDespachante.findUnique({ where: { codigo: p.status } });
  const statusLegado = st
    ? baseLegadoDoPapel(st.papel)
    : CODIGOS_LEGADOS.has(p.status)
      ? p.status
      : 'em_andamento';
  const dados = {
    id: p.id,
    tipo_servico: p.tipoServico,
    status: statusLegado,
    arma_id: p.armaId,
    arma_nome: p.armaNome,
    valor_centavos: p.valorCentavos,
    quantidade: p.quantidade,
    asaas_payment_id: p.asaasPaymentId,
    invoice_url: p.invoiceUrl,
    criado_em: p.criadoEm.toISOString(),
    atualizado_em: agora.toISOString(),
  };
  await prisma.registroSync.upsert({
    where: {
      usuarioId_tipo_registroId: {
        usuarioId: p.usuarioId,
        tipo: 'processos',
        registroId: p.id,
      },
    },
    create: {
      usuarioId: p.usuarioId,
      tipo: 'processos',
      registroId: p.id,
      dados: JSON.stringify(dados),
      atualizadoEm: agora,
      removido: false,
    },
    update: { dados: JSON.stringify(dados), atualizadoEm: agora, removido: false },
  });
}

/**
 * Marca o processo como removido no espelho de sincronização (tombstone), para
 * sumir do app no próximo pull. Usado ao excluir um processo não pago.
 */
export async function removerProcessoDoSync(usuarioId: string, id: string): Promise<void> {
  const agora = new Date();
  await prisma.registroSync.upsert({
    where: { usuarioId_tipo_registroId: { usuarioId, tipo: 'processos', registroId: id } },
    create: {
      usuarioId,
      tipo: 'processos',
      registroId: id,
      dados: '{}',
      atualizadoEm: agora,
      removido: true,
    },
    update: { dados: '{}', atualizadoEm: agora, removido: true },
  });
}
