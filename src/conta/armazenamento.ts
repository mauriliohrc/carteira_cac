import * as SecureStore from 'expo-secure-store';
import type { UsuarioApp } from './tipos';

const CHAVE_TOKEN = 'conta.token';
const CHAVE_USUARIO = 'conta.usuario';
const CHAVE_COD_EMAIL = 'conta.codigoEmailEnviado';

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
  await SecureStore.deleteItemAsync(CHAVE_COD_EMAIL);
}

// ---------------------------------------- verificação de e-mail (1º envio)
// Guarda o id do usuário para quem já disparamos o código automaticamente.
// Reabrir o app NÃO deve gerar outro código: a tela só auto-envia uma vez;
// depois o usuário aguarda o código já enviado e, se precisar, usa "Reenviar".

export async function marcarCodigoEmailEnviado(usuarioId: string): Promise<void> {
  await SecureStore.setItemAsync(CHAVE_COD_EMAIL, usuarioId);
}

export async function codigoEmailFoiEnviado(usuarioId: string): Promise<boolean> {
  return (await SecureStore.getItemAsync(CHAVE_COD_EMAIL)) === usuarioId;
}

export async function limparCodigoEmailEnviado(): Promise<void> {
  await SecureStore.deleteItemAsync(CHAVE_COD_EMAIL);
}
