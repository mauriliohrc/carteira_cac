import type { ProcessoDespachante } from '@prisma/client';
import { prisma } from '../db/cliente.js';

/**
 * Reflete um processo de despachante no espelho de sincronização do usuário
 * (RegistroSync tipo 'processos'), para o app receber o andamento pelo pull —
 * mesmo mecanismo que o acervoAdmin usa para editar o acervo de um usuário.
 *
 * As chaves do JSON são snake_case, idênticas às colunas da tabela local
 * `processos` no app, porque o upsert do pull é genérico (usa as chaves como
 * colunas). `atualizado_em` avança para "agora" a cada reflexo, empurrando o
 * `carimboServidor` e garantindo que o registro caia no próximo pull.
 */
export async function refletirProcessoNoSync(p: ProcessoDespachante): Promise<void> {
  const agora = new Date();
  const dados = {
    id: p.id,
    tipo_servico: p.tipoServico,
    status: p.status,
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
