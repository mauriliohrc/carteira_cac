/**
 * Para onde uma notificação / aviso leva ao ser tocado.
 *
 * Puro de propósito (sem importar expo-router): o planejador anexa estes dados
 * à notificação, a caixa os persiste, e tanto o handler de tap quanto a lista
 * de avisos resolvem o destino com `hrefDeDados`. Retrocompat: dados ausentes
 * ou desconhecidos → `null` (o chamador decide o fallback; avisos antigos, que
 * nunca gravaram rota, simplesmente não navegam).
 */

export interface DadosNotificacao {
  /** Classe da notificação — ajuda no roteamento e em métricas. */
  tipo?: 'vencimento' | 'habitualidade' | 'noticia' | 'competicao';
  documentoId?: string;
  armaId?: string;
  noticiaId?: string;
  competicaoId?: string;
  /** Rota literal (fallback de telas sem id, ex.: a caixa de avisos). */
  tela?: string;
}

/** Destino para `router.push`, ou null quando não há rota (sem ação). */
export type DestinoRota =
  | string
  | { pathname: string; params?: Record<string, string> };

export function hrefDeDados(dados: DadosNotificacao | null | undefined): DestinoRota | null {
  if (!dados) return null;
  if (dados.noticiaId) return { pathname: '/noticias/[id]', params: { id: String(dados.noticiaId) } };
  if (dados.competicaoId)
    return { pathname: '/competicoes/[id]', params: { id: String(dados.competicaoId) } };
  if (dados.documentoId)
    return { pathname: '/documento/[id]', params: { id: String(dados.documentoId) } };
  if (dados.armaId) return { pathname: '/arma/[id]', params: { id: String(dados.armaId) } };
  if (dados.tipo === 'habitualidade')
    return { pathname: '/(tabs)/acervo', params: { aba: 'habitualidade' } };
  if (dados.tela) return dados.tela;
  return null;
}

/** Lê a rota gravada num aviso (JSON) com tolerância a lixo. */
export function dadosDeJSON(bruto: string | null | undefined): DadosNotificacao | null {
  if (!bruto) return null;
  try {
    const o = JSON.parse(bruto);
    return o && typeof o === 'object' ? (o as DadosNotificacao) : null;
  } catch {
    return null;
  }
}
