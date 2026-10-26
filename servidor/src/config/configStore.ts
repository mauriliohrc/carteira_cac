import { prisma } from '../db/cliente.js';

/**
 * Configurações globais (chave/valor) guardadas no banco. Usado para flags que o
 * admin liga/desliga pelo backoffice, como o interruptor-mestre das automações.
 */

/** Lê uma flag booleana; `padrao` quando a chave ainda não existe. */
export async function lerBool(chave: string, padrao: boolean): Promise<boolean> {
  const row = await prisma.configuracao.findUnique({ where: { chave } });
  if (!row) return padrao;
  return row.valor === '1' || row.valor.toLowerCase() === 'true';
}

export async function gravarBool(chave: string, valor: boolean): Promise<void> {
  const v = valor ? '1' : '0';
  await prisma.configuracao.upsert({
    where: { chave },
    create: { chave, valor: v },
    update: { valor: v },
  });
}

/** Chave do interruptor-mestre das mensagens automáticas. */
export const CHAVE_AUTOMACOES = 'automacoes_ativas';
