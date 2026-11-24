// ============================================================================
// Forma PADRÃO de um usuário do app em listagens do backoffice — para que todas
// as telas (usuários, churn, dashboard, notícias/leituras, push) mostrem as
// MESMAS colunas. Centraliza o `include` e o mapeamento num só lugar.
// ============================================================================
import { Prisma } from '@prisma/client';
import { JANELA_ONLINE_MIN } from './tipos.js';

/** `include` para carregar tudo que a linha padrão precisa. */
export const INCLUDE_USUARIO_LISTA = {
  vinculos: { include: { entidade: { select: { id: true, nome: true } } } },
  dispositivos: { where: { ativo: true }, select: { plataforma: true, appVersao: true } },
  // Assinaturas da loja (mensal/anual) p/ a data de assinatura premium.
  assinaturas: {
    select: { iniciouEm: true, status: true },
    orderBy: { iniciouEm: 'desc' as const },
  },
  _count: { select: { registrosSync: { where: { tipo: 'armas', removido: false } } } },
} satisfies Prisma.UsuarioAppInclude;

/** Data de assinatura premium: início da assinatura vigente (ATIVA/EM_GRACA) ou,
 *  na falta, a mais recente. Null para quem nunca assinou na loja. */
export function dataAssinaturaPremium(u: {
  assinaturas: { iniciouEm: Date | null; status: string }[];
}): Date | null {
  const ativa = u.assinaturas.find((a) => a.status === 'ATIVA' || a.status === 'EM_GRACA');
  return (ativa ?? u.assinaturas[0])?.iniciouEm ?? null;
}

export type UsuarioComLista = Prisma.UsuarioAppGetPayload<{ include: typeof INCLUDE_USUARIO_LISTA }>;

/** Compara versões de marketing ("1.8.1" vs "1.8.0") por segmentos numéricos. */
export function compararVersao(a: string, b: string): number {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

export function estaOnline(ultimoAcessoEm: Date | null): boolean {
  if (!ultimoAcessoEm) return false;
  return Date.now() - ultimoAcessoEm.getTime() < JANELA_ONLINE_MIN * 60_000;
}

/** Mapeia o usuário para a linha padrão das listagens do backoffice. */
export function mapUsuarioLista(u: UsuarioComLista) {
  return {
    id: u.id,
    nome: u.nome,
    email: u.email,
    cpf: u.cpf,
    celular: u.celular,
    ativo: u.ativo,
    emailVerificado: u.emailVerificado,
    premium: u.premium,
    premiumTipo: u.premiumTipo,
    entidades: u.vinculos.map((v) => ({ id: v.entidade.id, nome: v.entidade.nome, origem: v.origem })),
    ultimoAcessoEm: u.ultimoAcessoEm,
    online: estaOnline(u.ultimoAcessoEm),
    dispositivos: u.dispositivos.length,
    plataformas: [...new Set(u.dispositivos.map((d) => d.plataforma))],
    appVersao:
      u.dispositivos
        .map((d) => d.appVersao)
        .filter((v): v is string => !!v)
        .sort(compararVersao)
        .at(-1) ?? null,
    armasSistema: u._count.registrosSync,
    criadoEm: u.criadoEm,
    assinaturaEm: dataAssinaturaPremium(u),
  };
}
