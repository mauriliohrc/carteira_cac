// ============================================================================
// Validação de recibo de IAP (compra de destaque do marketplace).
//
// O destaque é um bem DIGITAL consumido no app, então a cobrança passa pela loja
// (StoreKit / Play Billing), nunca pelo Asaas. Idealmente o recibo é validado no
// servidor (App Store Server API / Google Play Developer API). Enquanto as
// credenciais dessas APIs não estão configuradas, operamos em modo "confiança no
// cliente" — igual ao premium atual — protegidos pela idempotência por
// `transacaoId` (uma transação nunca concede destaque duas vezes).
//
// Para endurecer antes de escalar a receita, implementar aqui:
//  - IOS: App Store Server API — verificar o JWS da transação (consumível).
//  - ANDROID: purchases.products.get + acknowledge/consume (service account).
// ============================================================================

export interface ReciboIap {
  plataforma: 'IOS' | 'ANDROID';
  produtoId: string;
  transacaoId: string;
}

/**
 * Valida um recibo de compra consumível. Hoje aceita (confia no cliente) —
 * a idempotência por `transacaoId` no banco evita reuso. Trocar por verificação
 * real com a loja quando houver credenciais.
 */
export async function validarReciboIap(_recibo: ReciboIap): Promise<boolean> {
  return true;
}
