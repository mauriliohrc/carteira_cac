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
/** Faixa de plano → condição Prisma (mesmas regras da lista de usuários). */
const PLANO_COND: Record<string, Prisma.UsuarioAppWhereInput> = {
  GRATIS: { premium: false },
  ANUAL: { premium: true, premiumTipo: { in: ['ANUAL', 'ANUAL_PARCEIRO'] } },
  MENSAL: { premium: true, premiumTipo: 'MENSAL' },
  CORTESIA: { premium: true, premiumTipo: 'CUPOM' },
};

function montarWhere(f: FiltrosWhats): Prisma.UsuarioAppWhereInput {
  // Cada filtro vira uma condição; todas combinam em AND. Usar um array evita
  // que armas e documentos (ambos em `registrosSync`) se sobrescrevam.
  const cond: Prisma.UsuarioAppWhereInput[] = [];

  if (f.ativos) cond.push({ ativo: true });

  if (typeof f.emailVerificado === 'boolean') cond.push({ emailVerificado: f.emailVerificado });

  if (typeof f.comArma === 'boolean') {
    // Armas = registros de sync do tipo "armas" não removidos (mesmo critério do push).
    cond.push({
      registrosSync: f.comArma
        ? { some: { tipo: 'armas', removido: false } }
        : { none: { tipo: 'armas', removido: false } },
    });
  }

  if (typeof f.comDoc === 'boolean') {
    cond.push({
      registrosSync: f.comDoc
        ? { some: { tipo: 'documentos', removido: false } }
        : { none: { tipo: 'documentos', removido: false } },
    });
  }

  if (typeof f.comVinculo === 'boolean') {
    cond.push({ vinculos: f.comVinculo ? { some: {} } : { none: {} } });
  }

  // Plano: faixas combinam em OR entre si (anual OU mensal, p.ex.).
  const planos = (f.planos ?? []).filter((p) => p in PLANO_COND);
  if (planos.length) cond.push({ OR: planos.map((p) => PLANO_COND[p]!) });

  if (typeof f.diasDeUsoMin === 'number') {
    const corte = new Date(Date.now() - f.diasDeUsoMin * 86_400_000);
    cond.push({ criadoEm: { lt: corte } });
  }

  if (f.comCadastro) {
    // Cadastro completo: CPF e nome preenchidos (toda UsuarioApp tem conta, mas
    // deixa o filtro explícito e à prova de registros incompletos).
    cond.push({ cpf: { not: '' } }, { nome: { not: '' } });
  }

  return {
    // Celular obrigatório: só dígitos, não nulo e não vazio.
    celular: { not: null },
    NOT: { celular: '' },
    ...(cond.length ? { AND: cond } : {}),
  };
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
