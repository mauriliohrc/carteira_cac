import { Prisma } from '@prisma/client';
import { prisma } from '../db/cliente.js';
import type { z } from 'zod';
import type { filtrosWhatsSchema } from '../dominio/validacao.js';

export type FiltrosWhats = z.infer<typeof filtrosWhatsSchema>;

/** Um destinatário resolvido para campanha de WhatsApp (sempre com celular). */
export interface Destinatario {
  id: string;
  nome: string;
  celular: string;
}

/**
 * Monta o `where` combinando os filtros com E/AND. O alvo são sempre usuários do
 * app COM celular preenchido — WhatsApp exige número, e instalações anônimas não
 * têm telefone (por isso nem entram nesta busca, diferente do push).
 */
function montarWhere(f: FiltrosWhats): Prisma.UsuarioAppWhereInput {
  const where: Prisma.UsuarioAppWhereInput = {
    // Celular obrigatório: só dígitos, não nulo e não vazio.
    celular: { not: null },
    NOT: { celular: '' },
  };

  if (f.ativos) where.ativo = true;

  if (typeof f.emailVerificado === 'boolean') where.emailVerificado = f.emailVerificado;

  if (typeof f.comArma === 'boolean') {
    // Armas = registros de sync do tipo "armas" não removidos (mesmo critério do push).
    where.registrosSync = f.comArma
      ? { some: { tipo: 'armas', removido: false } }
      : { none: { tipo: 'armas', removido: false } };
  }

  if (typeof f.diasDeUsoMin === 'number') {
    const corte = new Date(Date.now() - f.diasDeUsoMin * 86_400_000);
    where.criadoEm = { lt: corte };
  }

  if (f.comCadastro) {
    // Cadastro completo: CPF e nome preenchidos (toda UsuarioApp tem conta, mas
    // deixa o filtro explícito e à prova de registros incompletos).
    where.AND = [{ cpf: { not: '' } }, { nome: { not: '' } }];
  }

  return where;
}

/** Resolve os destinatários (com celular) conforme os filtros combinados. */
export async function resolverDestinatarios(f: FiltrosWhats): Promise<Destinatario[]> {
  const usuarios = await prisma.usuarioApp.findMany({
    where: montarWhere(f),
    select: { id: true, nome: true, celular: true },
    orderBy: { criadoEm: 'desc' },
  });
  // celular é String? no schema, mas o where garante não-nulo; normaliza o tipo.
  return usuarios
    .filter((u): u is { id: string; nome: string; celular: string } => !!u.celular)
    .map((u) => ({ id: u.id, nome: u.nome, celular: u.celular }));
}
