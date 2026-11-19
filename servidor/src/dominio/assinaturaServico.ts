// ============================================================================
// Serviço de assinatura — orquestra a gravação de um evento (notificação da
// Apple, cron ou backfill) na AssinaturaApp e reconcilia o Premium do usuário no
// servidor. É o ÚNICO ponto que decide o premium a partir de assinatura de loja.
// ============================================================================
import type { ResponseBodyV2DecodedPayload } from '@apple/app-store-server-library';
import { prisma } from '../db/cliente.js';
import {
  derivarEstado,
  temAcesso,
  PRODUTO_PREMIUM_TIPO,
  type FatosAssinatura,
  type StatusAssinatura,
} from './assinatura.js';
import {
  statusAssinaturaApi,
  verificarTransacao,
  verificarRenewalInfo,
  verificarNotificacao,
  historicoNotificacoes,
  lookupOrderId,
} from '../integracoes/appleAssinatura.js';
import { registrarEventoUsuario, type TipoEventoUsuario } from './eventoUsuario.js';
import { consultarAssinaturaV2, mapearAssinatura } from '../integracoes/googlePlay.js';

/** Evento de timeline correspondente a cada status de assinatura (ou null). */
const EVENTO_TIMELINE_POR_STATUS: Record<StatusAssinatura, TipoEventoUsuario | null> = {
  ATIVA: 'ASSINATURA_ATIVA',
  EM_GRACA: null, // recuperação de cobrança — não é um marco de churn
  CANCELADA_RENOVACAO: 'ASSINATURA_CANCELADA',
  EXPIRADA: 'ASSINATURA_EXPIRADA',
  REEMBOLSADA: 'ASSINATURA_REEMBOLSADA',
  REVOGADA: 'ASSINATURA_REVOGADA',
};

export interface EntradaEvento {
  originalTransactionId: string;
  plataforma?: 'IOS' | 'ANDROID';
  fatos: FatosAssinatura;
  /** appAccountToken da transação (casa a assinatura com a conta, quando houver). */
  appAccountToken?: string | null;
  /** notificationType da Apple ou sintético (CRON_EXPIRADA, BACKFILL). */
  tipoEvento: string;
  subtipo?: string | null;
  /** UUID da notificação (idempotência). Null/ausente em eventos sintéticos. */
  notificationUUID?: string | null;
  /** Objeto decodificado para auditoria (será serializado em JSON). */
  payloadAuditoria?: unknown;
  /** Força o vínculo com uma conta (ex.: app reportou a assinatura dele). */
  usuarioIdForcado?: string | null;
  agora?: Date;
}

export interface ResultadoEvento {
  duplicado: boolean;
  assinaturaId?: string;
  usuarioId?: string | null;
  status?: StatusAssinatura;
}

/**
 * Aplica um evento à assinatura (upsert por originalTransactionId), registra o
 * histórico e reconcilia o premium do usuário atribuído. Idempotente por
 * `notificationUUID` quando informado.
 */
export async function aplicarEventoAssinatura(e: EntradaEvento): Promise<ResultadoEvento> {
  const agora = e.agora ?? new Date();

  // Idempotência: a mesma notificação nunca é aplicada duas vezes.
  if (e.notificationUUID) {
    const ja = await prisma.eventoAssinatura.findUnique({
      where: { notificationUUID: e.notificationUUID },
      select: { id: true },
    });
    if (ja) return { duplicado: true };
  }

  const estado = derivarEstado(e.fatos, agora);
  const existente = await prisma.assinaturaApp.findUnique({
    where: { originalTransactionId: e.originalTransactionId },
  });

  // Atribuição: forçada (app reportou) > appAccountToken > vínculo existente.
  let usuarioId: string | null = existente?.usuarioId ?? null;
  if (e.appAccountToken) {
    const u = await prisma.usuarioApp.findUnique({
      where: { appAccountToken: e.appAccountToken },
      select: { id: true },
    });
    if (u) usuarioId = u.id;
  }
  if (e.usuarioIdForcado) usuarioId = e.usuarioIdForcado;

  // canceladaEm: só vale quando NÃO está renovando; preserva a data mais antiga.
  const renovando = estado.status === 'ATIVA' || estado.status === 'EM_GRACA';
  const canceladaEm = renovando
    ? null
    : estado.canceladaEm ?? existente?.canceladaEm ?? null;

  const dados = {
    usuarioId,
    plataforma: e.plataforma ?? existente?.plataforma ?? 'IOS',
    produtoId: e.fatos.produtoId ?? existente?.produtoId ?? '',
    premiumTipo: estado.premiumTipo,
    status: estado.status,
    autoRenova: estado.autoRenova,
    ambiente: e.fatos.environment ?? existente?.ambiente ?? 'Production',
    expiraEm: estado.expiraEm,
    iniciouEm: estado.iniciouEm ?? existente?.iniciouEm ?? null,
    canceladaEm,
    expirouEm: estado.expirouEm ?? existente?.expirouEm ?? null,
    motivo: estado.motivo,
    ultimoEventoEm: agora,
  };

  const assinatura = existente
    ? await prisma.assinaturaApp.update({ where: { id: existente.id }, data: dados })
    : await prisma.assinaturaApp.create({
        data: { originalTransactionId: e.originalTransactionId, ...dados },
      });

  await prisma.eventoAssinatura.create({
    data: {
      assinaturaId: assinatura.id,
      tipo: e.tipoEvento,
      subtipo: e.subtipo ?? null,
      notificationUUID: e.notificationUUID ?? null,
      payload: e.payloadAuditoria ? serializar(e.payloadAuditoria) : null,
    },
  });

  // Reconcilia o premium da conta atual e, se a atribuição mudou, da anterior.
  if (usuarioId) await reconciliarPremium(usuarioId);
  if (existente?.usuarioId && existente.usuarioId !== usuarioId) {
    await reconciliarPremium(existente.usuarioId);
  }

  // Timeline: registra a TRANSIÇÃO de status (assinou/cancelou/expirou/...). Só
  // quando o status mudou de fato — renovações (ATIVA→ATIVA) não geram ruído. Vale
  // para iOS E Android (ambos passam por aqui). Best-effort, em segundo plano.
  const statusAnterior = existente?.status ?? null;
  if (usuarioId && estado.status !== statusAnterior) {
    const evento = EVENTO_TIMELINE_POR_STATUS[estado.status];
    if (evento) {
      void registrarEventoUsuario(usuarioId, evento, {
        origem: dados.plataforma,
        descricao: estado.premiumTipo ?? dados.produtoId,
        meta: { produtoId: dados.produtoId, status: estado.status, motivo: estado.motivo },
      });
    }
  }

  return { duplicado: false, assinaturaId: assinatura.id, usuarioId, status: estado.status };
}

/** JSON.stringify tolerante a BigInt e ciclos (payload de auditoria). */
function serializar(v: unknown): string {
  try {
    return JSON.stringify(v, (_k, val) => (typeof val === 'bigint' ? Number(val) : val));
  } catch {
    return '"<não serializável>"';
  }
}

/**
 * Recalcula `premium`/`premiumTipo` do usuário a partir das assinaturas de loja.
 * NUNCA mexe em quem é premium por CUPOM (origem controlada pelo app). Só rebaixa
 * quando não há assinatura com acesso E o premium atual não é de cupom.
 */
export async function reconciliarPremium(usuarioId: string): Promise<void> {
  const [u, subs] = await Promise.all([
    prisma.usuarioApp.findUnique({
      where: { id: usuarioId },
      select: { premium: true, premiumTipo: true },
    }),
    prisma.assinaturaApp.findMany({
      where: { usuarioId },
      select: { status: true, premiumTipo: true, expiraEm: true },
    }),
  ]);
  if (!u) return;

  const comAcesso = subs.filter((s) => temAcesso(s.status));
  if (comAcesso.length) {
    // Melhor assinatura = a que expira mais tarde.
    const melhor = comAcesso.reduce((a, b) =>
      (b.expiraEm?.getTime() ?? 0) > (a.expiraEm?.getTime() ?? 0) ? b : a
    );
    if (!u.premium || u.premiumTipo !== melhor.premiumTipo) {
      await prisma.usuarioApp.update({
        where: { id: usuarioId },
        data: { premium: true, premiumTipo: melhor.premiumTipo },
      });
    }
    return;
  }

  // Sem assinatura com acesso: cupom continua mandando; senão, rebaixa.
  if (u.premiumTipo === 'CUPOM') return;
  if (u.premium) {
    await prisma.usuarioApp.update({
      where: { id: usuarioId },
      data: { premium: false, premiumTipo: null },
    });
  }
}

function num(v: unknown): number | undefined {
  return typeof v === 'number' ? v : undefined;
}

/**
 * Processa uma notificação JÁ verificada/decodificada (ResponseBodyV2): verifica
 * a transação/renewal embutidas e aplica o evento. Compartilhado pelo webhook e
 * pelo backfill por histórico. Retorna null quando não é uma assinatura Premium.
 */
export async function processarNotificacaoDecodificada(
  notif: ResponseBodyV2DecodedPayload,
  usuarioIdForcado?: string | null
): Promise<ResultadoEvento | null> {
  const data = notif.data;
  if (!data?.signedTransactionInfo) return null;

  const tx = await verificarTransacao(data.environment, data.signedTransactionInfo);
  const renewal = data.signedRenewalInfo
    ? await verificarRenewalInfo(data.environment, data.signedRenewalInfo)
    : undefined;

  if (!tx.originalTransactionId || !tx.productId || !(tx.productId in PRODUTO_PREMIUM_TIPO)) {
    return null;
  }

  return aplicarEventoAssinatura({
    originalTransactionId: tx.originalTransactionId,
    plataforma: 'IOS',
    fatos: {
      produtoId: tx.productId,
      expiresDate: num(tx.expiresDate),
      purchaseDate: num(tx.purchaseDate),
      originalPurchaseDate: num(tx.originalPurchaseDate),
      revocationDate: num(tx.revocationDate),
      revocationReason: num(tx.revocationReason),
      autoRenewStatus: num(renewal?.autoRenewStatus),
      expirationIntent: num(renewal?.expirationIntent),
      gracePeriodExpiresDate: num(renewal?.gracePeriodExpiresDate),
      isInBillingRetryPeriod: renewal?.isInBillingRetryPeriod,
      environment: data.environment,
      signedDate: num(notif.signedDate),
    },
    appAccountToken: tx.appAccountToken ?? renewal?.appAccountToken ?? null,
    tipoEvento: String(notif.notificationType ?? 'DESCONHECIDO'),
    subtipo: notif.subtype ? String(notif.subtype) : null,
    notificationUUID: notif.notificationUUID ?? null,
    payloadAuditoria: {
      notificationType: notif.notificationType,
      subtype: notif.subtype,
      transacao: tx,
      renovacao: renewal,
    },
    usuarioIdForcado,
  });
}

/**
 * Churn Android: lê o estado atual de uma assinatura do Google Play pelo
 * `purchaseToken`, mapeia para os mesmos FATOS do churn Apple e aplica o evento
 * (upsert por purchaseToken, que é a chave estável entre renovações). Atribui a
 * conta pelo `obfuscatedAccountId` (= appAccountToken que o app envia na compra)
 * ou pelo `usuarioIdForcado` (app reportando a própria assinatura).
 * Retorna o purchaseToken sincronizado, ou null quando não é assinatura Premium.
 */
export async function processarAssinaturaAndroid(
  purchaseToken: string,
  notificationType?: number,
  usuarioIdForcado?: string | null
): Promise<string | null> {
  const sub = await consultarAssinaturaV2(purchaseToken);
  const mapeado = mapearAssinatura(sub, notificationType);
  if (!mapeado) return null;

  await aplicarEventoAssinatura({
    originalTransactionId: purchaseToken,
    plataforma: 'ANDROID',
    fatos: mapeado.fatos,
    // O obfuscatedAccountId é o appAccountToken da conta — mesma via de
    // atribuição da Apple (lookup por usuarioApp.appAccountToken).
    appAccountToken: mapeado.obfuscatedAccountId,
    tipoEvento: notificationType ? `GOOGLE_RTDN_${notificationType}` : 'GOOGLE_SYNC',
    subtipo: sub.subscriptionState ?? null,
    notificationUUID: null,
    payloadAuditoria: { subscriptionState: sub.subscriptionState, notificationType, sub },
    usuarioIdForcado,
  });
  return purchaseToken;
}

/**
 * Importa a assinatura de um cliente a partir do Order ID do recibo da Apple:
 * resolve o pedido nas transações, pega o originalTransactionId e puxa o status
 * atual (vincula à conta se informada). Retorna o originalTransactionId ou null.
 */
export async function backfillPorOrderId(
  orderId: string,
  env: string | undefined,
  usuarioIdForcado?: string | null
): Promise<string | null> {
  const resp = await lookupOrderId(orderId, env);
  const assinado = (resp.signedTransactions ?? [])[0];
  if (!assinado) return null;
  const tx = await verificarTransacao(env, assinado);
  if (!tx.originalTransactionId) return null;
  // Com o originalTransactionId em mãos, puxa o status atual completo.
  return backfillPorTransacao(tx.originalTransactionId, env, usuarioIdForcado);
}

/**
 * Backfill por HISTÓRICO de notificações (App Store Server API — até 180 dias).
 * Puxa os eventos passados que a Apple já registrou (mesmo sem a URL de
 * notificações ter sido configurada antes) e os aplica, populando o churn que já
 * aconteceu. Idempotente por notificationUUID.
 */
export async function backfillHistoricoNotificacoes(
  desdeMs: number,
  ateMs: number
): Promise<{ itens: number; processados: number; assinaturasPremium: number }> {
  let token: string | null = null;
  let itens = 0;
  let processados = 0;
  let premium = 0;

  do {
    const resp = await historicoNotificacoes({ startDate: desdeMs, endDate: ateMs }, token);
    for (const item of resp.notificationHistory ?? []) {
      itens += 1;
      if (!item.signedPayload) continue;
      try {
        const notif = await verificarNotificacao(item.signedPayload);
        const r = await processarNotificacaoDecodificada(notif);
        if (r) {
          premium += 1;
          if (!r.duplicado) processados += 1;
        }
      } catch {
        // Item inválido/não-assinatura: ignora e segue.
      }
    }
    token = resp.hasMore ? resp.paginationToken ?? null : null;
  } while (token);

  return { itens, processados, assinaturasPremium: premium };
}

/**
 * Rede de segurança: expira, no banco, assinaturas cujo período pago venceu há
 * mais de `bufferMs` e que ainda constam com acesso — cobre notificações
 * perdidas. O buffer dá margem para período de graça/retentativa e para a
 * notificação chegar atrasada. Rebaixa o premium de cada usuário afetado.
 */
export async function expirarVencidas(agora: Date, bufferMs: number): Promise<number> {
  const corte = new Date(agora.getTime() - bufferMs);
  const vencidas = await prisma.assinaturaApp.findMany({
    where: {
      status: { in: ['ATIVA', 'EM_GRACA', 'CANCELADA_RENOVACAO'] },
      expiraEm: { not: null, lt: corte },
    },
  });
  for (const a of vencidas) {
    await prisma.assinaturaApp.update({
      where: { id: a.id },
      data: {
        status: 'EXPIRADA',
        expirouEm: a.expirouEm ?? a.expiraEm,
        canceladaEm: a.canceladaEm ?? (a.autoRenova ? null : a.expiraEm),
        motivo: a.motivo ?? 'Expirada (sem notificação)',
        ultimoEventoEm: agora,
      },
    });
    await prisma.eventoAssinatura.create({
      data: { assinaturaId: a.id, tipo: 'CRON_EXPIRADA', subtipo: null, notificationUUID: null },
    });
    if (a.usuarioId) await reconciliarPremium(a.usuarioId);
  }
  return vencidas.length;
}

/**
 * Backfill/reconsulta pela App Store Server API: busca o status atual da
 * assinatura e aplica como evento sintético. Usado para descobrir churn
 * retroativo e re-vincular notificações órfãs. Requer `ambiente.apple.apiAtiva`.
 * Retorna o originalTransactionId efetivamente sincronizado, ou null.
 */
export async function backfillPorTransacao(
  anyTransactionId: string,
  env: string | undefined,
  usuarioIdForcado?: string | null
): Promise<string | null> {
  const resp = await statusAssinaturaApi(anyTransactionId, env);
  const itens = (resp.data ?? []).flatMap((g) => g.lastTransactions ?? []);
  // Preferir o item cujo originalTransactionId casa; senão, o primeiro.
  const alvo =
    itens.find((t) => t.originalTransactionId === anyTransactionId) ?? itens[0];
  if (!alvo?.signedTransactionInfo) return null;

  const ambienteResp = resp.environment ?? env;
  const tx = await verificarTransacao(ambienteResp, alvo.signedTransactionInfo);
  const renewal = alvo.signedRenewalInfo
    ? await verificarRenewalInfo(ambienteResp, alvo.signedRenewalInfo)
    : undefined;
  if (!tx.originalTransactionId || !tx.productId) return null;

  await aplicarEventoAssinatura({
    originalTransactionId: tx.originalTransactionId,
    plataforma: 'IOS',
    fatos: {
      produtoId: tx.productId,
      expiresDate: num(tx.expiresDate),
      purchaseDate: num(tx.purchaseDate),
      originalPurchaseDate: num(tx.originalPurchaseDate),
      revocationDate: num(tx.revocationDate),
      revocationReason: num(tx.revocationReason),
      autoRenewStatus: num(renewal?.autoRenewStatus),
      expirationIntent: num(renewal?.expirationIntent),
      gracePeriodExpiresDate: num(renewal?.gracePeriodExpiresDate),
      isInBillingRetryPeriod: renewal?.isInBillingRetryPeriod,
      environment: ambienteResp,
      signedDate: Date.now(),
    },
    appAccountToken: tx.appAccountToken ?? renewal?.appAccountToken ?? null,
    tipoEvento: 'BACKFILL',
    subtipo: null,
    notificationUUID: null,
    payloadAuditoria: { transacao: tx, renovacao: renewal },
    usuarioIdForcado,
  });
  return tx.originalTransactionId;
}
