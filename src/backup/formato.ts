/**
 * Formato e criptografia do backup — núcleo puro, sem I/O nem Expo.
 *
 * Um backup é um único arquivo `.cacbackup`: um envelope JSON legível (versão,
 * parâmetros de derivação, salt e iv) com o conteúdo cifrado em AES-256-CBC.
 * A chave nasce da senha do usuário via PBKDF2-SHA256 — sem a senha, o arquivo
 * é inútil, mesmo que vaze do iCloud ou do Drive.
 *
 * O salt e o iv NÃO são segredos: viajam em claro no envelope, como manda o
 * protocolo. Quem os gera é a camada de I/O, com um CSPRNG (expo-crypto), e
 * passa os bytes para cá — assim este módulo continua puro e testável no node.
 */
import CryptoJS from 'crypto-js';

/** Marca no texto decifrado: se não bate, a senha estava errada. */
export const ASSINATURA = 'CAC-BRASIL-BACKUP';
export const VERSAO_BACKUP = 1;
/** Custo do PBKDF2. Alto o bastante para doer no ataque, tolerável no aparelho. */
export const ITERACOES = 120_000;

export interface PlanoBackup {
  assinatura: string;
  geradoEm: string;
  /** user_version do SQLite na origem — barra restaurar um backup mais novo. */
  esquema: number;
  versaoApp: string;
  /** Cada tabela do banco, linha a linha, como veio do SELECT *. */
  tabelas: Record<string, Record<string, unknown>[]>;
  /** Caminho relativo (acervo/… ou fotos/…) → conteúdo do arquivo em base64. */
  arquivos: Record<string, string>;
}

export interface Envelope {
  app: 'cac-brasil';
  tipo: 'backup';
  v: number;
  kdf: 'pbkdf2-sha256';
  iteracoes: number;
  salt: string;
  iv: string;
  conteudo: string;
}

export class SenhaIncorreta extends Error {
  constructor() {
    super('Senha incorreta ou arquivo corrompido.');
    this.name = 'SenhaIncorreta';
  }
}

export class ArquivoInvalido extends Error {
  constructor() {
    super('Este arquivo não é um backup da Carteira CAC.');
    this.name = 'ArquivoInvalido';
  }
}

function bytesParaWordArray(bytes: Uint8Array): CryptoJS.lib.WordArray {
  const palavras: number[] = [];
  for (let i = 0; i < bytes.length; i++) {
    palavras[i >>> 2] |= bytes[i] << (24 - (i % 4) * 8);
  }
  return CryptoJS.lib.WordArray.create(palavras, bytes.length);
}

function derivarChave(senha: string, salt: CryptoJS.lib.WordArray, iteracoes: number) {
  return CryptoJS.PBKDF2(senha, salt, {
    keySize: 256 / 32,
    iterations: iteracoes,
    hasher: CryptoJS.algo.SHA256,
  });
}

/** Cifra o plano em um envelope. `salt` e `iv` são bytes de um CSPRNG (16 cada). */
export function empacotar(
  plano: PlanoBackup,
  senha: string,
  salt: Uint8Array,
  iv: Uint8Array
): Envelope {
  const saltWA = bytesParaWordArray(salt);
  const ivWA = bytesParaWordArray(iv);
  const chave = derivarChave(senha, saltWA, ITERACOES);
  const cifrado = CryptoJS.AES.encrypt(JSON.stringify(plano), chave, {
    iv: ivWA,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });
  return {
    app: 'cac-brasil',
    tipo: 'backup',
    v: VERSAO_BACKUP,
    kdf: 'pbkdf2-sha256',
    iteracoes: ITERACOES,
    salt: CryptoJS.enc.Base64.stringify(saltWA),
    iv: CryptoJS.enc.Base64.stringify(ivWA),
    conteudo: cifrado.toString(),
  };
}

/** Confere se o JSON tem cara de envelope nosso, antes de pedir a senha. */
export function pareceEnvelope(valor: unknown): valor is Envelope {
  const e = valor as Envelope;
  return !!e && e.app === 'cac-brasil' && e.tipo === 'backup' && typeof e.conteudo === 'string';
}

/** Decifra e valida o envelope. Lança SenhaIncorreta se a senha não bater. */
export function desempacotar(envelope: Envelope, senha: string): PlanoBackup {
  const salt = CryptoJS.enc.Base64.parse(envelope.salt);
  const iv = CryptoJS.enc.Base64.parse(envelope.iv);
  const chave = derivarChave(senha, salt, envelope.iteracoes || ITERACOES);

  const decifrado = CryptoJS.AES.decrypt(envelope.conteudo, chave, {
    iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });

  let texto: string;
  try {
    texto = decifrado.toString(CryptoJS.enc.Utf8);
  } catch {
    // Senha errada quase sempre quebra o unpad PKCS7 ou o UTF-8.
    throw new SenhaIncorreta();
  }
  if (!texto) throw new SenhaIncorreta();

  let plano: PlanoBackup;
  try {
    plano = JSON.parse(texto);
  } catch {
    throw new SenhaIncorreta();
  }
  if (!plano || plano.assinatura !== ASSINATURA) throw new SenhaIncorreta();
  return plano;
}
