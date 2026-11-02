import { prisma } from '../db/cliente.js';

export type CanalLog = 'WHATSAPP' | 'PUSH';
export type TipoLog = 'BOAS_VINDAS' | 'SEM_ARMA_7D' | 'NOTICIA';
export type StatusLog = 'OK' | 'FALHOU' | 'PULADO';

/**
 * Registra uma linha no log de auditoria de envios (WhatsApp/push automáticos e
 * notícias). Best-effort: nunca lança — um problema ao gravar o log jamais pode
 * derrubar o envio em si.
 */
export async function registrarLog(e: {
  usuarioId?: string | null;
  canal: CanalLog;
  tipo: TipoLog;
  referenciaId?: string | null;
  titulo?: string | null;
  destino?: string | null;
  status: StatusLog;
  erro?: string | null;
}): Promise<void> {
  try {
    await prisma.logNotificacao.create({
      data: {
        usuarioId: e.usuarioId ?? null,
        canal: e.canal,
        tipo: e.tipo,
        referenciaId: e.referenciaId ?? null,
        titulo: e.titulo ?? null,
        destino: e.destino ?? null,
        status: e.status,
        erro: e.erro ?? null,
      },
    });
  } catch {
    /* log é auditoria best-effort */
  }
}

/**
 * Anti-repetição: a pessoa já recebeu (OK) algum LEMBRETE automático — qualquer
 * tipo que não seja boas-vindas — nos últimos `dias`? Usado para não repetir
 * mensagens automáticas para a mesma pessoa dentro de um mês.
 */
export async function lembreteRecenteExiste(usuarioId: string, dias = 30): Promise<boolean> {
  const desde = new Date(Date.now() - dias * 86_400_000);
  const n = await prisma.logNotificacao.count({
    where: {
      usuarioId,
      status: 'OK',
      tipo: { not: 'BOAS_VINDAS' },
      criadoEm: { gte: desde },
    },
  });
  return n > 0;
}
