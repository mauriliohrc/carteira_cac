import { rm } from 'node:fs/promises';
import {
  makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
  Browsers,
  type WASocket,
} from 'baileys';
import pino from 'pino';
import QRCode from 'qrcode';
import { ambiente } from '../config/ambiente.js';
import { CHAVE_SALVAR_CONTATO, lerBool } from '../config/configStore.js';
import { primeiroNome } from './mensagens.js';

/**
 * Gerenciador da conexão de WhatsApp (Baileys) — singleton isolado do resto do
 * servidor, no mesmo espírito de `src/push/expo.ts`. Mantém UMA sessão ativa cujo
 * estado vive em memória; as credenciais ficam em disco (useMultiFileAuthState)
 * para reconectar sem novo QR após restart.
 *
 * ⚠️ WhatsApp não-oficial: disparo em massa pode levar a bloqueio do número.
 */

export type EstadoWhatsapp = 'DESCONECTADO' | 'CONECTANDO' | 'QR' | 'CONECTADO';

// Logger silencioso exigido pelo socket (não poluir os logs do Fastify).
const logger = pino({ level: 'silent' });

let sock: WASocket | null = null;
let estado: EstadoWhatsapp = 'DESCONECTADO';
let qrDataUrl: string | null = null;
let numero: string | null = null;
/** Enquanto true, quedas disparam reconexão automática. */
let conectarDesejado = false;
/** Evita duas chamadas simultâneas de iniciar(). */
let iniciando = false;
/** Callback do dispatcher para retomar envios quando a conexão abre. */
let aoConectar: (() => void) | null = null;
/** JIDs já presentes na agenda (sincronizados pelo WA ou salvos por nós). */
const contatosConhecidos = new Set<string>();

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function registrarAoConectar(fn: () => void) {
  aoConectar = fn;
}

export function status(): { estado: EstadoWhatsapp; qr: string | null; numero: string | null } {
  return { estado, qr: estado === 'QR' ? qrDataUrl : null, numero };
}

export function estaConectado(): boolean {
  return estado === 'CONECTADO';
}

/** Sobe o socket. Reusa a sessão salva; só pede QR se não houver credenciais. */
export async function iniciar(): Promise<void> {
  if (estado === 'CONECTADO' || iniciando) return;
  iniciando = true;
  conectarDesejado = true;
  try {
    const { state, saveCreds } = await useMultiFileAuthState(ambiente.whatsapp.authDir);
    // Versão do protocolo: tenta a mais recente; cai no bundle se faltar rede.
    let version: [number, number, number] | undefined;
    try {
      version = (await fetchLatestBaileysVersion()).version;
    } catch {
      version = undefined;
    }

    estado = 'CONECTANDO';
    sock = makeWASocket({
      auth: state,
      version,
      logger,
      browser: Browsers.appropriate('Chrome'),
      // Não marca o número como "online" (evita parecer uso ativo o tempo todo).
      markOnlineOnConnect: false,
      // Não baixa histórico de conversas: só queremos enviar.
      syncFullHistory: false,
    });

    sock.ev.on('creds.update', saveCreds);

    // Mantém o conjunto de contatos conhecidos a partir da sincronização do WA,
    // para não re-gravar na agenda quem já é contato a cada envio.
    const registrarIds = (lista?: { id?: string | null }[]) =>
      lista?.forEach((c) => c.id && contatosConhecidos.add(c.id));
    sock.ev.on('contacts.upsert', (cs) => registrarIds(cs));
    sock.ev.on('contacts.update', (cs) => registrarIds(cs));
    sock.ev.on('messaging-history.set', ({ contacts }) => registrarIds(contacts));

    sock.ev.on('connection.update', async (u) => {
      const { connection, lastDisconnect, qr } = u;

      if (qr) {
        estado = 'QR';
        try {
          qrDataUrl = await QRCode.toDataURL(qr, { margin: 1, width: 300 });
        } catch {
          qrDataUrl = null;
        }
      }

      if (connection === 'open') {
        estado = 'CONECTADO';
        qrDataUrl = null;
        // JID próprio no formato 55DDDNUMERO:xx@s.whatsapp.net -> só os dígitos.
        numero = sock?.user?.id?.split(':')[0]?.replace(/\D/g, '') ?? null;
        aoConectar?.();
      }

      if (connection === 'close') {
        // O erro vem como Boom; só precisamos do statusCode (sem importar @hapi/boom).
        const motivo = (lastDisconnect?.error as { output?: { statusCode?: number } } | undefined)
          ?.output?.statusCode;
        numero = null;
        if (motivo === DisconnectReason.loggedOut) {
          // Sessão encerrada no celular: limpa credenciais e volta ao zero.
          await limparCredenciais();
          estado = 'DESCONECTADO';
          sock = null;
          conectarDesejado = false;
        } else if (conectarDesejado) {
          // Qualquer outra queda (incl. restartRequired=515): reconecta.
          estado = 'CONECTANDO';
          sock = null;
          void iniciar();
        } else {
          estado = 'DESCONECTADO';
          sock = null;
        }
      }
    });
  } finally {
    iniciando = false;
  }
}

/** Desconecta e apaga as credenciais (força novo QR na próxima conexão). */
export async function logout(): Promise<void> {
  conectarDesejado = false;
  try {
    await sock?.logout();
  } catch {
    // ignora: pode já estar caído
  }
  sock = null;
  await limparCredenciais();
  estado = 'DESCONECTADO';
  qrDataUrl = null;
  numero = null;
}

async function limparCredenciais(): Promise<void> {
  try {
    await rm(ambiente.whatsapp.authDir, { recursive: true, force: true });
  } catch {
    // pasta pode não existir
  }
}

/**
 * Resolve o JID real do número no WhatsApp (resolve o 9º dígito dos celulares
 * BR). Retorna null se o número não tem WhatsApp. `celular` só com dígitos.
 */
export async function resolverJid(celular: string): Promise<string | null> {
  if (!sock) return null;
  const digitos = celular.replace(/\D/g, '');
  // Garante DDI 55 (números brasileiros são gravados sem o país).
  const comDdi = digitos.startsWith('55') ? digitos : `55${digitos}`;
  const resultado = await sock.onWhatsApp(comDdi);
  const achado = resultado?.find((r) => r.exists);
  return achado?.jid ?? null;
}

/**
 * Salva o número na agenda do WhatsApp (se ainda não for contato). WhatsApp
 * trata melhor mensagens para contatos salvos. Retorna true se gravou agora.
 */
export async function salvarContatoSeNovo(jid: string, nome: string): Promise<boolean> {
  if (!sock || contatosConhecidos.has(jid)) return false;
  try {
    const nomeCompleto = (nome || '').trim() || jid.split('@')[0];
    await sock.addOrEditContact(jid, {
      fullName: nomeCompleto,
      firstName: primeiroNome(nomeCompleto),
      saveOnPrimaryAddressbook: true,
    });
    contatosConhecidos.add(jid);
    return true;
  } catch {
    // Não bloqueia o envio se a gravação do contato falhar.
    return false;
  }
}

/**
 * Envia um texto. Lança se não conectado ou se o número não tem WhatsApp.
 * Se a opção estiver ligada, garante o número como contato antes de enviar.
 */
export async function enviarTexto(celular: string, texto: string, nome?: string): Promise<void> {
  if (!sock || estado !== 'CONECTADO') {
    throw new Error('WhatsApp não conectado');
  }
  const jid = await resolverJid(celular);
  if (!jid) {
    throw new Error('Número sem WhatsApp');
  }
  if (await lerBool(CHAVE_SALVAR_CONTATO, true)) {
    const gravou = await salvarContatoSeNovo(jid, nome ?? '');
    // Pequena pausa após gravar o contato, antes de mandar a mensagem.
    if (gravou) await delay(2000 + Math.floor(Math.random() * 2000));
  }
  await sock.sendMessage(jid, { text: texto });
}
