/**
 * Caixa de avisos: mantém no app o histórico das notificações que chegaram.
 *
 * O sistema não guarda isso para a gente — uma notificação dispensada some.
 * Então o app captura por dois caminhos complementares:
 *
 *   1. `addNotificationReceivedListener` — pega o que chega com o app aberto;
 *   2. `getPresentedNotificationsAsync` — varre a Central de Notificações na
 *      abertura e ao voltar do background, recuperando o que chegou enquanto
 *      o app estava fechado e ainda não foi dispensado.
 *
 * O registro é idempotente pelo identificador, então os dois caminhos podem
 * ver a mesma notificação sem duplicar.
 */
import * as Notifications from 'expo-notifications';

import { podarHistorico, registrarAviso } from '@/db/avisos';

function daNotificacao(n: Notifications.Notification) {
  const { content } = n.request;
  return {
    id: n.request.identifier,
    titulo: content.title ?? null,
    subtitulo: content.subtitle ?? null,
    corpo: content.body ?? null,
    recebidoEm: new Date(n.date || Date.now()).toISOString(),
  };
}

/** Varre a Central de Notificações e guarda o que ainda não estava no app. */
export async function sincronizarCaixa(): Promise<void> {
  try {
    const presentes = await Notifications.getPresentedNotificationsAsync();
    for (const n of presentes) await registrarAviso(daNotificacao(n));
    await podarHistorico();
  } catch {
    // Central indisponível (Expo Go em alguns casos) — o listener cobre o resto.
  }
}

/** Escuta o que chega com o app em primeiro plano. */
export function observarRecebidos(aoRegistrar: () => void) {
  return Notifications.addNotificationReceivedListener((n) => {
    void registrarAviso(daNotificacao(n)).then(aoRegistrar);
  });
}

/** Limpa a Central de Notificações do sistema (não mexe no histórico do app). */
export async function limparCentral(): Promise<void> {
  try {
    await Notifications.dismissAllNotificationsAsync();
    await Notifications.setBadgeCountAsync(0);
  } catch {
    // sem permissão ou plataforma sem suporte — ignora
  }
}
