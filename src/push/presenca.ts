import { apiApp } from '@/conta/api';
import { lerToken } from '@/conta/armazenamento';
import { consultarPremiumCache, consultarTipoPremiumCache } from '@/billing';

let ultimoEnvio = 0;
const INTERVALO_MIN_MS = 60_000; // no máximo um heartbeat por minuto

/**
 * Sinaliza que o usuário está ativo (usado ao renderizar notícias e ao voltar
 * ao foreground). Só vale para quem está logado; é best-effort e com throttle.
 */
export async function registrarPresenca(forcar = false): Promise<void> {
  const token = await lerToken();
  if (!token) return;
  const agora = Date.now();
  // `forcar` ignora o throttle — usado logo após uma compra, para o premium
  // chegar ao backoffice na hora (senão só sobe no próximo heartbeat de notícias).
  if (!forcar && agora - ultimoEnvio < INTERVALO_MIN_MS) return;
  ultimoEnvio = agora;
  try {
    const premium = await consultarPremiumCache();
    const premiumTipo = await consultarTipoPremiumCache();
    await apiApp('/presenca', { metodo: 'POST', corpo: { premium, premiumTipo }, token });
  } catch {
    ultimoEnvio = 0; // falhou: permite tentar de novo na próxima
  }
}
