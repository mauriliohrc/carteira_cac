import { Platform } from 'react-native';

/**
 * URL base da API (servidor/).
 *
 * Em desenvolvimento:
 *  - iOS simulador / web: localhost funciona.
 *  - Android emulador: o host da máquina é 10.0.2.2.
 *  - Aparelho físico: use o IP da sua máquina na rede e defina
 *    EXPO_PUBLIC_API_URL no .env (ex.: http://192.168.1.10:3333).
 */
const padrao = Platform.OS === 'android' ? 'http://10.0.2.2:3333' : 'http://localhost:3333';

export const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? padrao;

/** Prefixo versionado da API pública do app. */
export const API_APP = `${API_BASE}/api/v1/app`;
