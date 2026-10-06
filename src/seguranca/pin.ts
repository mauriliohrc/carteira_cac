/**
 * Hash e verificação do PIN — núcleo puro, sem I/O nem Expo.
 *
 * O PIN de 6 dígitos nunca é guardado em claro: guarda-se só o hash
 * PBKDF2-SHA256 com salt. Como o espaço de um PIN é minúsculo (10^6), o que
 * protege de verdade é o Keychain/Keystore onde este registro vai parar — não
 * a força do hash. Ainda assim derivamos com custo alto por higiene.
 */
import CryptoJS from 'crypto-js';

export const TAMANHO_PIN = 6;
export const ITERACOES = 60_000;

export interface RegistroPin {
  v: 1;
  salt: string;
  hash: string;
  iteracoes: number;
}

function bytesParaWordArray(bytes: Uint8Array): CryptoJS.lib.WordArray {
  const palavras: number[] = [];
  for (let i = 0; i < bytes.length; i++) {
    palavras[i >>> 2] |= bytes[i] << (24 - (i % 4) * 8);
  }
  return CryptoJS.lib.WordArray.create(palavras, bytes.length);
}

function derivar(pin: string, salt: CryptoJS.lib.WordArray, iteracoes: number): string {
  return CryptoJS.PBKDF2(pin, salt, {
    keySize: 256 / 32,
    iterations: iteracoes,
    hasher: CryptoJS.algo.SHA256,
  }).toString(CryptoJS.enc.Base64);
}

/** Monta o registro a guardar. `saltBytes` vem de um CSPRNG (16 bytes). */
export function criarRegistro(pin: string, saltBytes: Uint8Array): RegistroPin {
  const salt = bytesParaWordArray(saltBytes);
  return {
    v: 1,
    salt: salt.toString(CryptoJS.enc.Base64),
    hash: derivar(pin, salt, ITERACOES),
    iteracoes: ITERACOES,
  };
}

/** O valor lido do cofre é mesmo um registro de PIN válido? */
export function registroValido(valor: unknown): valor is RegistroPin {
  const r = valor as RegistroPin;
  return (
    !!r &&
    typeof r.salt === 'string' &&
    r.salt.length > 0 &&
    typeof r.hash === 'string' &&
    r.hash.length > 0
  );
}

export function conferirRegistro(pin: string, registro: RegistroPin): boolean {
  const salt = CryptoJS.enc.Base64.parse(registro.salt);
  return derivar(pin, salt, registro.iteracoes || ITERACOES) === registro.hash;
}
