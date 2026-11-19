// ============================================================================
// Timeline de ações do usuário — registro best-effort de eventos para o
// backoffice. REGRA DE OURO: registrar um evento NUNCA pode quebrar nem atrasar
// o fluxo que o originou. Por isso tudo aqui é try/catch silencioso e pensado
// para rodar em segundo plano (sem await no caminho crítico quando possível).
// ============================================================================
import { prisma } from '../db/cliente.js';

/** Tipos conhecidos (o backoffice traduz em rótulo/ícone). Strings livres são aceitas. */
export type TipoEventoUsuario =
  | 'CONTA_CRIADA'
  | 'ASSINATURA_TENTATIVA'
  | 'ASSINATURA_ATIVA'
  | 'ASSINATURA_CANCELADA'
  | 'ASSINATURA_EXPIRADA'
  | 'ASSINATURA_REEMBOLSADA'
  | 'ASSINATURA_REVOGADA'
  | 'DOC_CRIADO'
  | 'DOC_EDITADO'
  | 'DOC_REMOVIDO'
  | 'ARMA_CRIADA'
  | 'ARMA_EDITADA'
  | 'ARMA_REMOVIDA'
  | 'FILIACAO_SOLICITADA'
  | 'FILIACAO_ATIVA'
  | 'FILIACAO_ENCERRADA'
  | 'FILIACAO_DOC_ENVIADO'
  | 'PROCESSO_CRIADO'
  | 'PROCESSO_PAGO'
  | 'PROCESSO_STATUS'
  | 'PROCESSO_DOC_ENVIADO'
  | 'PROCESSO_FINALIZADO'
  | 'PROCESSO_CANCELADO';

interface OpcoesEvento {
  descricao?: string | null;
  /** IOS | ANDROID | APP | CUPOM | SISTEMA. */
  origem?: string | null;
  meta?: unknown;
}

/**
 * Registra um evento na timeline do usuário. Best-effort: engole qualquer erro
 * (inclusive usuário inexistente / FK) para não afetar o fluxo chamador.
 */
export async function registrarEventoUsuario(
  usuarioId: string,
  tipo: TipoEventoUsuario | string,
  opcoes: OpcoesEvento = {}
): Promise<void> {
  try {
    await prisma.eventoUsuario.create({
      data: {
        usuarioId,
        tipo,
        descricao: opcoes.descricao ?? null,
        origem: opcoes.origem ?? null,
        meta: opcoes.meta === undefined ? null : serializar(opcoes.meta),
      },
    });
  } catch {
    // Silencioso de propósito — a timeline é um extra, nunca um gargalo.
  }
}

function serializar(v: unknown): string | null {
  if (v === null) return null;
  try {
    return JSON.stringify(v, (_k, val) => (typeof val === 'bigint' ? Number(val) : val));
  } catch {
    return null;
  }
}
