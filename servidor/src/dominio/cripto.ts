import crypto from 'node:crypto';
import { ambiente } from '../config/ambiente.js';

/**
 * Criptografia simétrica para segredos sensíveis em repouso (senha do gov.br,
 * chave do Asaas, senha de parceiro da Shooting House). Um dump do banco passa a
 * ser inútil sem a chave `APP_CRYPTO_KEY`, que vive só no ambiente do servidor.
 *
 * Formato do texto cifrado: `enc:v1:<iv>:<tag>:<ciphertext>` (cada parte em
 * base64), AES-256-GCM. A detecção por prefixo torna a leitura RETROCOMPATÍVEL:
 * valores antigos em texto puro passam direto por {@link decifrar} até o backfill
 * cifrar tudo. Assim dá para subir o código antes de migrar os dados, sem janela
 * de quebra.
 */
const PREFIXO = 'enc:v1:';
const ALGO = 'aes-256-gcm';

/** Deriva a chave de 32 bytes do env (hex de 64 ou base64 de 32 bytes). */
function resolverChave(): Buffer {
  const bruta = ambiente.cripto.chave;
  // 64 hex = 32 bytes.
  if (/^[0-9a-fA-F]{64}$/.test(bruta)) return Buffer.from(bruta, 'hex');
  const b64 = Buffer.from(bruta, 'base64');
  if (b64.length === 32) return b64;
  // Último recurso (só dev): deriva 32 bytes estáveis de qualquer string.
  return crypto.createHash('sha256').update(bruta).digest();
}

const CHAVE = resolverChave();

/**
 * Comparação de segredos em tempo constante (anti timing-attack). Usada para
 * validar tokens de webhook. Guarda o comprimento antes do timingSafeEqual
 * (que exige buffers do mesmo tamanho).
 */
export function comparaSegura(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

/** Indica se um valor já está no formato cifrado desta aplicação. */
export function estaCifrado(valor: string | null | undefined): boolean {
  return typeof valor === 'string' && valor.startsWith(PREFIXO);
}

/** Cifra um texto. `null`/`undefined`/vazio passam direto (nada a proteger). */
export function cifrar(texto: string | null | undefined): string | null {
  if (texto == null || texto === '') return texto ?? null;
  if (estaCifrado(texto)) return texto; // idempotente — não cifra duas vezes
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, CHAVE, iv);
  const ct = Buffer.concat([cipher.update(texto, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIXO}${iv.toString('base64')}:${tag.toString('base64')}:${ct.toString('base64')}`;
}

/**
 * Decifra um valor cifrado por {@link cifrar}. Valores sem o prefixo (legado em
 * texto puro) são devolvidos como estão — retrocompatível durante a migração.
 */
export function decifrar(valor: string | null | undefined): string | null {
  if (valor == null) return null;
  if (!estaCifrado(valor)) return valor; // legado em texto puro
  const [, , ivB64, tagB64, ctB64] = valor.split(':');
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const ct = Buffer.from(ctB64, 'base64');
  const decipher = crypto.createDecipheriv(ALGO, CHAVE, iv);
  decipher.setAuthTag(tag);
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  return pt.toString('utf8');
}
