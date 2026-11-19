// ============================================================================
// Domínio de assinatura/churn — regras PURAS (sem I/O), reusadas pelo webhook,
// pelo cron de rede de segurança e pelo backfill.
//
// A verdade do Premium pago passa a ser derivada dos FATOS da transação/renovação
// (datas e flags da Apple), não do tipo de notificação — isso torna o cálculo
// robusto a eventos fora de ordem ou perdidos.
// ============================================================================

/** SKUs que valem Premium (idênticas às do App Store Connect e do app). */
export const PRODUTO_PREMIUM_TIPO: Record<string, 'MENSAL' | 'ANUAL' | 'ANUAL_PARCEIRO'> = {
  premium_mensal: 'MENSAL',
  premium_anual: 'ANUAL',
  premium_parceiro: 'ANUAL_PARCEIRO',
};

/** Tipos de premium que vêm de ASSINATURA de loja (não de cupom). */
export const TIPOS_ASSINATURA = ['MENSAL', 'ANUAL', 'ANUAL_PARCEIRO'] as const;

export type StatusAssinatura =
  | 'ATIVA'
  | 'EM_GRACA'
  | 'CANCELADA_RENOVACAO'
  | 'EXPIRADA'
  | 'REEMBOLSADA'
  | 'REVOGADA';

/** Status em que o usuário AINDA tem direito ao Premium. */
export const STATUS_COM_ACESSO: StatusAssinatura[] = ['ATIVA', 'EM_GRACA', 'CANCELADA_RENOVACAO'];

/** Status de churn consumado (perdeu o acesso). */
export const STATUS_CHURN: StatusAssinatura[] = ['EXPIRADA', 'REEMBOLSADA', 'REVOGADA'];

export function temAcesso(status: string): boolean {
  return (STATUS_COM_ACESSO as string[]).includes(status);
}

/** Fatos relevantes extraídos da transação + renewalInfo da Apple (ms epoch). */
export interface FatosAssinatura {
  produtoId?: string;
  expiresDate?: number;
  purchaseDate?: number;
  originalPurchaseDate?: number;
  revocationDate?: number;
  revocationReason?: number;
  /** AutoRenewStatus: 0 = desligado, 1 = ligado. */
  autoRenewStatus?: number;
  /** ExpirationIntent (1..5) quando a Apple informa o motivo da expiração. */
  expirationIntent?: number;
  gracePeriodExpiresDate?: number;
  isInBillingRetryPeriod?: boolean;
  environment?: string;
  /** Instante do sinal (signedDate da notificação) — usado p/ carimbar datas. */
  signedDate?: number;
}

export interface EstadoAssinatura {
  status: StatusAssinatura;
  autoRenova: boolean;
  premiumTipo: 'MENSAL' | 'ANUAL' | 'ANUAL_PARCEIRO' | null;
  expiraEm: Date | null;
  iniciouEm: Date | null;
  /** Data do desligamento da renovação (churn voluntário), se aplicável. */
  canceladaEm: Date | null;
  /** Data em que perdeu o acesso (expiração/reembolso/revogação), se aplicável. */
  expirouEm: Date | null;
  motivo: string | null;
}

/** Texto do expirationIntent da Apple. */
function motivoExpiracao(intent?: number): string | null {
  switch (intent) {
    case 1:
      return 'Cancelou (não renovou)';
    case 2:
      return 'Falha de cobrança';
    case 3:
      return 'Recusou aumento de preço';
    case 4:
      return 'Produto indisponível';
    case 5:
      return 'Outro';
    default:
      return null;
  }
}

/**
 * Deriva o estado atual da assinatura a partir dos fatos, no instante `agora`.
 * Não depende do tipo de notificação — só das datas/flags da Apple.
 */
export function derivarEstado(f: FatosAssinatura, agora: Date): EstadoAssinatura {
  const t = agora.getTime();
  const premiumTipo = f.produtoId ? PRODUTO_PREMIUM_TIPO[f.produtoId] ?? null : null;
  const expiraEm = f.expiresDate ? new Date(f.expiresDate) : null;
  const iniciouEm = f.originalPurchaseDate
    ? new Date(f.originalPurchaseDate)
    : f.purchaseDate
      ? new Date(f.purchaseDate)
      : null;
  const autoRenova = f.autoRenewStatus === undefined ? true : f.autoRenewStatus === 1;
  const carimbo = f.signedDate ? new Date(f.signedDate) : agora;

  // 1) Reembolso/revogação: a Apple marcou revocationDate.
  if (f.revocationDate) {
    const status: StatusAssinatura = f.revocationReason === 1 ? 'REVOGADA' : 'REEMBOLSADA';
    return {
      status,
      autoRenova: false,
      premiumTipo,
      expiraEm,
      iniciouEm,
      canceladaEm: null,
      expirouEm: new Date(f.revocationDate),
      motivo: status === 'REVOGADA' ? 'Revogada (problema no app)' : 'Reembolsada',
    };
  }

  // 2) Período pago terminou.
  if (expiraEm && expiraEm.getTime() <= t) {
    const emGraca = !!f.gracePeriodExpiresDate && f.gracePeriodExpiresDate > t;
    if (emGraca) {
      return {
        status: 'EM_GRACA',
        autoRenova,
        premiumTipo,
        expiraEm,
        iniciouEm,
        canceladaEm: null,
        expirouEm: null,
        motivo: 'Em recuperação de cobrança',
      };
    }
    return {
      status: 'EXPIRADA',
      autoRenova,
      premiumTipo,
      expiraEm,
      iniciouEm,
      canceladaEm: autoRenova ? null : carimbo,
      expirouEm: expiraEm,
      motivo: motivoExpiracao(f.expirationIntent) ?? 'Expirada',
    };
  }

  // 3) Ainda no período pago.
  if (!autoRenova) {
    return {
      status: 'CANCELADA_RENOVACAO',
      autoRenova: false,
      premiumTipo,
      expiraEm,
      iniciouEm,
      canceladaEm: carimbo,
      expirouEm: null,
      motivo: 'Renovação desligada',
    };
  }

  return {
    status: 'ATIVA',
    autoRenova: true,
    premiumTipo,
    expiraEm,
    iniciouEm,
    canceladaEm: null,
    expirouEm: null,
    motivo: null,
  };
}
