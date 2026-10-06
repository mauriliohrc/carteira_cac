import * as SecureStore from 'expo-secure-store';
import type { UsuarioApp } from './tipos';

const CHAVE_TOKEN = 'conta.token';
const CHAVE_USUARIO = 'conta.usuario';

export async function lerToken(): Promise<string | null> {
  return SecureStore.getItemAsync(CHAVE_TOKEN);
}

/** Usuário em cache: deixa o app abrir já "logado" sem esperar a rede. */
export async function lerUsuarioCache(): Promise<UsuarioApp | null> {
  const bruto = await SecureStore.getItemAsync(CHAVE_USUARIO);
  if (!bruto) return null;
  try {
    return JSON.parse(bruto) as UsuarioApp;
  } catch {
    return null;
  }
}

export async function guardarSessao(token: string, usuario: UsuarioApp): Promise<void> {
  await SecureStore.setItemAsync(CHAVE_TOKEN, token);
  await SecureStore.setItemAsync(CHAVE_USUARIO, JSON.stringify(usuario));
}

export async function guardarUsuario(usuario: UsuarioApp): Promise<void> {
  await SecureStore.setItemAsync(CHAVE_USUARIO, JSON.stringify(usuario));
}

export async function limparSessao(): Promise<void> {
  await SecureStore.deleteItemAsync(CHAVE_TOKEN);
  await SecureStore.deleteItemAsync(CHAVE_USUARIO);
}
