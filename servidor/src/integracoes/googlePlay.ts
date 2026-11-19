// ============================================================================
// Integração com o Google Play — Android Publisher API (consulta de assinaturas)
// para o churn Android, espelhando o que a Apple faz no servidor.
//
// As Real-time Developer Notifications (RTDN) chegam via Pub/Sub e trazem só o
// `purchaseToken`; o ESTADO atual (ativa/cancelada/expirada/graça) é lido da
// `purchases.subscriptionsv2.get`. O token OAuth2 é obtido assinando um JWT com
// a chave da Service Account (RS256) — sem dependências externas (só node:crypto).
// ============================================================================
import { createSign } from 'node:crypto';
import { ambiente } from '../config/ambiente.js';
import { PRODUTO_PREMIUM_TIPO, type FatosAssinatura } from '../dominio/assinatura.js';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/androidpublisher';
const API_BASE = 'https://androidpublisher.googleapis.com/androidpublisher/v3';

/** notificationType da RTDN que representa reembolso/revogação (perda imediata). */
const RTDN_REVOKED = 12;

function base64url(b: Buffer | string): string {
  return Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Token de acesso memoizado até perto do vencimento.
let tokenCache: { valor: string; expiraEm: number } | null = null;

async function obterTokenAcesso(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiraEm - 60_000) return tokenCache.valor;

  const agora = Math.floor(Date.now() / 1000);
  const cabecalho = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const corpo = base64url(
    JSON.stringify({
      iss: ambiente.google.clientEmail,
      scope: SCOPE,
      aud: TOKEN_URL,
      iat: agora,
      exp: agora + 3600,
    })
  );
  const assinatura = base64url(
    createSign('RSA-SHA256').update(`${cabecalho}.${corpo}`).sign(ambiente.google.privateKey)
  );
  const jwt = `${cabecalho}.${corpo}.${assinatura}`;

  const resp = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  if (!resp.ok) throw new Error(`OAuth Google falhou: ${resp.status} ${await resp.text()}`);
  const json = (await resp.json()) as { access_token: string; expires_in: number };
  tokenCache = { valor: json.access_token, expiraEm: Date.now() + json.expires_in * 1000 };
  return json.access_token;
}

/** Forma parcial da SubscriptionPurchaseV2 que usamos. */
interface SubscriptionPurchaseV2 {
  subscriptionState?: string;
  startTime?: string;
  lineItems?: {
    productId?: string;
    expiryTime?: string;
    autoRenewingPlan?: { autoRenewEnabled?: boolean };
  }[];
  externalAccountIdentifiers?: { obfuscatedExternalAccountId?: string; externalAccountId?: string };
  latestOrderId?: string;
  linkedPurchaseToken?: string;
}

/** Busca o estado atual de uma assinatura pelo purchaseToken. */
export async function consultarAssinaturaV2(purchaseToken: string): Promise<SubscriptionPurchaseV2> {
  const token = await obterTokenAcesso();
  const url = `${API_BASE}/applications/${encodeURIComponent(
    ambiente.google.packageName
  )}/purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`;
  const resp = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
  if (!resp.ok) throw new Error(`subscriptionsv2.get falhou: ${resp.status} ${await resp.text()}`);
  return (await resp.json()) as SubscriptionPurchaseV2;
}

function ms(iso?: string): number | undefined {
  if (!iso) return undefined;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? undefined : t;
}

export interface MapeamentoAndroid {
  fatos: FatosAssinatura;
  /** UUID da conta (appAccountToken) que o app enviou como obfuscatedAccountId. */
  obfuscatedAccountId: string | null;
  produtoId: string;
}

/**
 * Traduz a SubscriptionPurchaseV2 para os FATOS genéricos que `derivarEstado`
 * entende (as MESMAS regras do churn Apple). Retorna null quando a SKU não é uma
 * assinatura Premium conhecida. `notificationType` (RTDN) só é usado para marcar
 * revogação/reembolso, nuance que o estado da API já não distingue.
 */
export function mapearAssinatura(
  sub: SubscriptionPurchaseV2,
  notificationType?: number
): MapeamentoAndroid | null {
  const itens = sub.lineItems ?? [];
  // Pega o line item cuja SKU é Premium (mensal/anual/parceiro).
  const item = itens.find((i) => i.productId && i.productId in PRODUTO_PREMIUM_TIPO) ?? itens[0];
  const produtoId = item?.productId;
  if (!produtoId || !(produtoId in PRODUTO_PREMIUM_TIPO)) return null;

  const estado = sub.subscriptionState ?? '';
  const expiryMs = ms(item?.expiryTime);
  const autoRenova = item?.autoRenewingPlan?.autoRenewEnabled ? 1 : 0;

  const fatos: FatosAssinatura = {
    produtoId,
    purchaseDate: ms(sub.startTime),
    originalPurchaseDate: ms(sub.startTime),
    autoRenewStatus: autoRenova,
    environment: 'Production',
    signedDate: Date.now(),
  };

  // Reembolso/revogação: perda imediata do acesso (derivarEstado → REEMBOLSADA).
  if (notificationType === RTDN_REVOKED) {
    fatos.revocationDate = Date.now();
    fatos.revocationReason = 0; // reembolso (não problema do app)
    return { fatos, obfuscatedAccountId: idConta(sub), produtoId };
  }

  if (estado === 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD') {
    // Em graça: expiração "passada" com janela de graça em aberto → EM_GRACA.
    fatos.expiresDate = Math.min(expiryMs ?? Date.now() - 1000, Date.now() - 1000);
    fatos.gracePeriodExpiresDate = expiryMs ?? Date.now() + 7 * 24 * 3600 * 1000;
    fatos.isInBillingRetryPeriod = true;
  } else {
    // ATIVA / CANCELED (auto-renovação off) / EXPIRED / ON_HOLD: o par
    // (expiresDate, autoRenewStatus) já leva derivarEstado ao status certo.
    fatos.expiresDate = expiryMs;
    if (estado === 'SUBSCRIPTION_STATE_ON_HOLD') {
      // Account hold = perdeu o acesso: garante expiração no passado.
      fatos.expiresDate = Math.min(expiryMs ?? Date.now() - 1000, Date.now() - 1000);
    }
  }

  return { fatos, obfuscatedAccountId: idConta(sub), produtoId };
}

function idConta(sub: SubscriptionPurchaseV2): string | null {
  return sub.externalAccountIdentifiers?.obfuscatedExternalAccountId ?? null;
}
