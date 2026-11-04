import type { StatusProcesso, TipoServicoDespachante } from '@/domain/tipos';

/** Centavos → "R$ 99,00". */
export function reais(centavos: number): string {
  return `R$ ${(centavos / 100).toFixed(2).replace('.', ',')}`;
}

/** (DD) 9XXXX-XXXX conforme o usuário digita. */
export function mascaraCelular(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export const ROTULO_SERVICO: Record<TipoServicoDespachante, string> = {
  RENOVACAO_CRAF: 'Renovação de CRAF',
  EMISSAO_GUIA: 'Emissão de Guia',
};

export const STATUS_INFO: Record<
  StatusProcesso,
  { rotulo: string; cor: 'alerta' | 'ok' | 'info' | 'neutro' }
> = {
  aguardando_pagamento: { rotulo: 'Aguardando pagamento', cor: 'alerta' },
  pago: { rotulo: 'Pago', cor: 'ok' },
  em_andamento: { rotulo: 'Em andamento', cor: 'info' },
  concluido: { rotulo: 'Concluído', cor: 'ok' },
  cancelado: { rotulo: 'Cancelado', cor: 'neutro' },
};
