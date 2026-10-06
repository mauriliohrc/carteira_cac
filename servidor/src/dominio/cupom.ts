/** Normaliza o código do cupom: minúsculo, sem espaços nas pontas e colapsados. */
export function normalizarCupom(codigo: string): string {
  return codigo.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Código do easter egg — nunca vira cupom de banco. */
export const CODIGO_EASTER_EGG = 'rocambole do dino';
