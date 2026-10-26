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

/** Lê um valor de texto; `null` se a chave não existe. */
export async function lerTexto(chave: string): Promise<string | null> {
  const row = await prisma.configuracao.findUnique({ where: { chave } });
  return row?.valor ?? null;
}

export async function gravarTexto(chave: string, valor: string): Promise<void> {
  await prisma.configuracao.upsert({
    where: { chave },
    create: { chave, valor },
    update: { valor },
  });
}

/** Chave do interruptor-mestre das mensagens automáticas. */
export const CHAVE_AUTOMACOES = 'automacoes_ativas';

/** Salvar o número na agenda (como contato) antes de enviar a mensagem. */
export const CHAVE_SALVAR_CONTATO = 'whats_salvar_contato';

/**
 * Marco de ativação das automações (ISO). Gatilhos baseados em tempo (ex.: 7
 * dias sem arma) só valem para usuários que cruzam o prazo DEPOIS deste marco,
 * evitando disparar para toda a base histórica quando a automação é ligada.
 */
export const CHAVE_MARCO_AUTOMACOES = 'automacoes_marco';
