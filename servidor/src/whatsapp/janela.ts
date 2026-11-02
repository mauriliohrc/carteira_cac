/**
 * Janela de envio do WhatsApp (anti-ban / respeito ao usuário).
 *
 * Mensagens que NÃO sejam as de boas-vindas (cadastro imediato) só podem sair
 * entre 9h e 20h no horário de Brasília, e com intervalo mínimo de 30s entre
 * uma e outra. As boas-vindas continuam imediatas — o gate é aplicado nos
 * CHAMADORES (dispatcher de campanhas e varredura de automações), nunca em
 * `enviarTexto`/`dispararGatilho`.
 */

const TZ = 'America/Sao_Paulo';

/** Início da janela (inclusivo): 9h. */
export const JANELA_INICIO = 9;
/** Fim da janela (exclusivo): 20h — não envia a partir das 20:00. */
export const JANELA_FIM = 20;

/** Intervalo mínimo entre envios, em segundos. */
export const MIN_INTERVALO_SEG = 30;

const UM_DIA_S = 24 * 3600;

/** Segundos decorridos no dia atual no horário de Brasília (0..86399). */
function segundosNoDiaBR(): number {
  // Extrai hora/min/seg na TZ de Brasília independentemente da TZ do servidor.
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date());
  const pega = (tipo: string) => Number(partes.find((p) => p.type === tipo)?.value ?? '0');
  let h = pega('hour');
  if (h === 24) h = 0; // alguns ambientes retornam '24' à meia-noite
  return h * 3600 + pega('minute') * 60 + pega('second');
}

/** Estamos dentro da janela permitida de envio (9h ≤ agora < 20h, BRT)? */
export function dentroDaJanela(): boolean {
  const s = segundosNoDiaBR();
  return s >= JANELA_INICIO * 3600 && s < JANELA_FIM * 3600;
}

/**
 * Milissegundos até a próxima abertura da janela (próximo 9:00 BRT). Se já
 * estamos dentro da janela, retorna 0. Como é um delta de relógio de parede e o
 * Brasil não tem horário de verão, independe da TZ do servidor.
 */
export function msAteJanela(): number {
  const s = segundosNoDiaBR();
  const inicio = JANELA_INICIO * 3600;
  if (dentroDaJanela()) return 0;
  const faltam = s < inicio ? inicio - s : UM_DIA_S - s + inicio;
  return faltam * 1000;
}
