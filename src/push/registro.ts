import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { apiApp } from '@/conta/api';

function obterProjectId(): string | undefined {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants as { easConfig?: { projectId?: string } }).easConfig?.projectId
  );
}

/** Pega o Expo push token deste aparelho, se possível. */
async function obterTokenExpo(): Promise<string | null> {
  if (!Device.isDevice) return null; // simulador não recebe push
  const perm = await Notifications.getPermissionsAsync();
  if (!perm.granted) return null;
  try {
    const projectId = obterProjectId();
    const r = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    return r.data;
  } catch {
    // APNs/FCM ainda não configurado no projeto: falha em silêncio.
    return null;
  }
}

/**
 * Registra o aparelho para receber push.
 * - Com `authToken`: associa à conta logada.
 * - Sem `authToken` (anônimo): registra mesmo assim, para alcançar quem ainda
 *   não tem conta. Um usuário pode registrar vários aparelhos.
 */
export async function registrarDispositivo(authToken?: string): Promise<void> {
  const token = await obterTokenExpo();
  if (!token) return;
  const plataforma = Platform.OS === 'ios' ? 'IOS' : 'ANDROID';
  try {
    await apiApp('/dispositivos', {
      metodo: 'POST',
      corpo: { token, plataforma },
      token: authToken ?? null,
    });
  } catch {
    /* não bloqueia o fluxo */
  }
}

/** Logout: desassocia o aparelho da conta (volta a anônimo, segue em "Todos"). */
export async function desassociarDispositivo(): Promise<void> {
  const token = await obterTokenExpo();
  if (!token) return;
  try {
    await apiApp('/dispositivos/desassociar', { metodo: 'POST', corpo: { token } });
  } catch {
    /* ignora */
  }
}
