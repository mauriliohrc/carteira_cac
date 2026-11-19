import type { FiliacaoLiga } from '@prisma/client';
import { prisma } from '../db/cliente.js';

/**
 * Reflete a filiação à liga no espelho de sincronização do usuário
 * (RegistroSync tipo 'filiacoes'), para o app receber o status/validade pelo
 * pull — mesmo mecanismo do despachante (ver despachanteSync.ts).
 *
 * As chaves do JSON são snake_case, idênticas às colunas da tabela local do app.
 * `atualizado_em` avança para "agora" a cada reflexo, empurrando o cursor do
 * pull. NÃO vazamos ids internos do Asaas (asaasSubscriptionId) para o cliente.
 *
 * ADITIVO: 'filiacoes' é um NOVO tipo de registro. Apps antigos que não o
 * conhecem simplesmente o ignoram no pull — nada quebra.
 */
export async function refletirFiliacaoNoSync(f: FiliacaoLiga): Promise<void> {
  const agora = new Date();
  const dados = {
    id: f.id,
    numero_filiacao: f.numeroFiliacao,
    status: f.status,
    origem: f.origem,
    nome_completo: f.nomeCompleto,
    cpf: f.cpf,
    cep: f.cep,
    logradouro: f.logradouro,
    numero: f.numero,
    complemento: f.complemento,
    bairro: f.bairro,
    cidade: f.cidade,
    uf: f.uf,
    doc_tipo: f.docTipo,
    // 0/1 (não boolean): o upsert genérico do SQLite do app não liga boolean JS.
    documentacao_completa: f.documentacaoCompleta ? 1 : 0,
    valor_centavos: f.valorCentavos,
    vigente_ate: f.vigenteAte.toISOString(),
    invoice_url: f.invoiceUrl,
    criado_em: f.criadoEm.toISOString(),
    atualizado_em: agora.toISOString(),
  };
  await prisma.registroSync.upsert({
    where: {
      usuarioId_tipo_registroId: {
        usuarioId: f.usuarioId,
        tipo: 'filiacoes',
        registroId: f.id,
      },
    },
    create: {
      usuarioId: f.usuarioId,
      tipo: 'filiacoes',
      registroId: f.id,
      dados: JSON.stringify(dados),
      atualizadoEm: agora,
      removido: false,
    },
    update: { dados: JSON.stringify(dados), atualizadoEm: agora, removido: false },
  });
}

/** Tombstone da filiação no sync (some do app no próximo pull). */
export async function removerFiliacaoDoSync(usuarioId: string, id: string): Promise<void> {
  const agora = new Date();
  await prisma.registroSync.upsert({
    where: { usuarioId_tipo_registroId: { usuarioId, tipo: 'filiacoes', registroId: id } },
    create: {
      usuarioId,
      tipo: 'filiacoes',
      registroId: id,
      dados: '{}',
      atualizadoEm: agora,
      removido: true,
    },
    update: { dados: '{}', atualizadoEm: agora, removido: true },
  });
}
