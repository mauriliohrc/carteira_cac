// ============================================================================
// Eventos de produto/analytics do APP (funil de onboarding e conversão da liga).
// REGRA DE OURO (igual à timeline do usuário): registrar um evento NUNCA pode
// quebrar nem atrasar o fluxo que o originou. Tudo aqui é best-effort: engole
// qualquer erro e trunca entradas para não deixar o cliente poluir a tabela.
// Diferente da timeline (eventos_usuario, ligada à CONTA), aqui a chave é o
// `anonId` do APARELHO — assim medimos o funil de quem ainda nem criou conta.
// ============================================================================
import { prisma } from '../db/cliente.js';

export interface EventoAppEntrada {
  evento: string;
  passo?: string | null;
  meta?: unknown;
}

export interface ContextoEventoApp {
  anonId: string;
  usuarioId?: string | null;
  plataforma?: string | null;
  appVersao?: string | null;
}

/** Teto de eventos por chamada (o schema da rota também limita; defesa dupla). */
const MAX_EVENTOS = 50;

/**
 * Grava um lote de eventos do app. Best-effort: qualquer erro (banco fora,
 * payload estranho) é engolido — métrica não derruba fluxo. Trunca strings e
 * serializa `meta` como JSON curto.
 */
export async function registrarEventosApp(
  eventos: EventoAppEntrada[],
  ctx: ContextoEventoApp
): Promise<void> {
  if (!eventos?.length || !ctx?.anonId) return;
  try {
    const data = eventos.slice(0, MAX_EVENTOS).map((e) => ({
      anonId: ctx.anonId.slice(0, 100),
      usuarioId: ctx.usuarioId ?? null,
      evento: String(e.evento).slice(0, 80),
      passo: e.passo ? String(e.passo).slice(0, 40) : null,
      meta: e.meta != null ? serializarMeta(e.meta) : null,
      plataforma: ctx.plataforma ? ctx.plataforma.slice(0, 20) : null,
      appVersao: ctx.appVersao ? ctx.appVersao.slice(0, 40) : null,
    }));
    await prisma.eventoApp.createMany({ data });
  } catch {
    /* best-effort: ignora */
  }
}

function serializarMeta(meta: unknown): string | null {
  try {
    return JSON.stringify(meta).slice(0, 2000);
  } catch {
    return null;
  }
}
