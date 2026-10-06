/**
 * Tranca do app: PIN de 6 dígitos + desbloqueio por Face ID / digital.
 *
 * O PIN nunca é guardado em claro nem no banco (que sai no backup): fica só o
 * seu hash PBKDF2-SHA256, com salt, dentro do Keychain/Keystore via
 * expo-secure-store. A biometria é uma conveniência por cima do PIN — o PIN
 * continua sendo o segredo mestre e a saída caso a biometria falhe.
 */
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import * as Crypto from 'expo-crypto';

import { CHAVES, lerConfig } from '@/db/config';
import { conferirRegistro, criarRegistro, registroValido, type RegistroPin } from './pin';

export { TAMANHO_PIN } from './pin';

const CHAVE_PIN = 'cac.tranca.pin';
const CHAVE_BIOMETRIA = 'cac.tranca.biometria';

/** Lê o registro do cofre, já validado. Nulo se não houver PIN de fato. */
async function lerRegistro(): Promise<RegistroPin | null> {
  let bruto: string | null;
  try {
    bruto = await SecureStore.getItemAsync(CHAVE_PIN);
  } catch {
    return null;
  }
  if (!bruto) return null;
  try {
    const valor = JSON.parse(bruto);
    return registroValido(valor) ? valor : null;
  } catch {
    return null;
  }
}

// ------------------------------------------------------------------- PIN

export async function temPin(): Promise<boolean> {
  return (await lerRegistro()) != null;
}

export async function definirPin(pin: string): Promise<void> {
  const registro = criarRegistro(pin, Crypto.getRandomBytes(16));
  await SecureStore.setItemAsync(CHAVE_PIN, JSON.stringify(registro));
}

export async function verificarPin(pin: string): Promise<boolean> {
  const registro = await lerRegistro();
  return registro ? conferirRegistro(pin, registro) : false;
}

/** Remove PIN e biometria — desliga a tranca por completo. */
export async function removerTranca(): Promise<void> {
  await SecureStore.deleteItemAsync(CHAVE_PIN);
  await SecureStore.deleteItemAsync(CHAVE_BIOMETRIA);
}

/**
 * Zera qualquer PIN/biometria herdado de uma instalação anterior.
 *
 * No iOS o Keychain (onde o expo-secure-store guarda o PIN) SOBREVIVE à
 * desinstalação do app, mas o SQLite não. Numa reinstalação, portanto, os dados
 * somem e o `onboarding` volta a ser necessário — só o PIN antigo continua lá,
 * fazendo o app abrir trancado e disparar o Face ID antes de o usuário definir
 * qualquer coisa. Se o onboarding ainda não foi concluído, tratamos como
 * instalação nova e apagamos essa herança.
 */
export async function limparTrancaSeInstalacaoNova(): Promise<void> {
  const jaViu = (await lerConfig(CHAVES.onboardingVisto)) === '1';
  if (!jaViu) await removerTranca();
}

// ------------------------------------------------------------- biometria

export type TipoBiometria = 'face' | 'digital' | 'iris' | null;

export interface EstadoBiometria {
  disponivel: boolean;
  tipo: TipoBiometria;
}

/** O aparelho tem sensor E há biometria cadastrada nele? */
export async function biometriaDoAparelho(): Promise<EstadoBiometria> {
  try {
    const [temHardware, cadastrada, tipos] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
      LocalAuthentication.supportedAuthenticationTypesAsync(),
    ]);
    const disponivel = temHardware && cadastrada;
    let tipo: TipoBiometria = null;
    if (tipos.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) tipo = 'face';
    else if (tipos.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) tipo = 'digital';
    else if (tipos.includes(LocalAuthentication.AuthenticationType.IRIS)) tipo = 'iris';
    return { disponivel, tipo };
  } catch {
    return { disponivel: false, tipo: null };
  }
}

export async function biometriaAtiva(): Promise<boolean> {
  return (await SecureStore.getItemAsync(CHAVE_BIOMETRIA)) === '1';
}

export async function definirBiometria(ativa: boolean): Promise<void> {
  if (ativa) await SecureStore.setItemAsync(CHAVE_BIOMETRIA, '1');
  else await SecureStore.deleteItemAsync(CHAVE_BIOMETRIA);
}

/** Abre o prompt de Face ID / digital. Devolve true se autenticou. */
export async function autenticarBiometria(motivo = 'Desbloquear a Carteira CAC'): Promise<boolean> {
  try {
    const r = await LocalAuthentication.authenticateAsync({
      promptMessage: motivo,
      cancelLabel: 'Usar PIN',
      // Sem senha do aparelho como saída: aqui a saída é o PIN do próprio app.
      disableDeviceFallback: true,
    });
    return r.success;
  } catch {
    return false;
  }
}

/** Rótulo curto do tipo de biometria, para textos da interface. */
export function rotuloBiometria(tipo: TipoBiometria): string {
  switch (tipo) {
    case 'face':
      return 'Face ID';
    case 'digital':
      return 'impressão digital';
    case 'iris':
      return 'íris';
    default:
      return 'biometria';
  }
}
