/**
 * Agendador dos alertas de vencimento.
 *
 * Esta camada só fala com o sistema: traduz os documentos do app para o
 * formato do planejador, e entrega o plano ao expo-notifications. Toda a
 * regra (teto de 10 avisos por dia, agrupamento por arma e orçamento sob o
 * limite de 64 pendentes do iOS) vive em ./planejamento.ts.
 */
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

import { hojeISO } from '@/lib/data';
import { rotuloTipoDoc } from '@/domain/catalogos';
import { nomeArma } from '@/domain/rotulos';
import { avisoDeHabitualidade, calcularProgresso } from '@/domain/habitualidade';
import type { Arma, Documento, Habitualidade } from '@/domain/tipos';
import {
  CHAVE_PESSOAL,
  contarEmAlertaHoje,
  planejar,
  TETO_DIARIO,
  type EntradaAlerta,
} from './planejamento';

export { TETO_DIARIO, DIAS_DETALHADOS, ORCAMENTO_PENDENTES } from './planejamento';

export const CANAL_ANDROID = 'vencimentos';
export const HORA_PADRAO = 9;

/** Falso só na prévia web, onde não existe notificação local agendada. */
export const ALERTAS_DISPONIVEIS = true;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function prepararCanal(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CANAL_ANDROID, {
    name: 'Vencimentos de documentos',
    description: 'Avisos diários de CRAF, guias de tráfego, laudos e CR.',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#93AD65',
  });
}

export async function pedirPermissao(): Promise<boolean> {
  if (!Device.isDevice) return false;
  const atual = await Notifications.getPermissionsAsync();
  if (atual.granted) return true;
  if (!atual.canAskAgain) return false;
  const pedido = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: true, allowSound: true },
  });
  return pedido.granted;
}

export async function permissaoConcedida(): Promise<boolean> {
  const atual = await Notifications.getPermissionsAsync();
  return atual.granted;
}

/** Traduz os documentos do app para o formato do planejador. */
export function montarEntradas(documentos: Documento[], armas: Arma[]): EntradaAlerta[] {
  const porId = new Map(armas.map((a) => [a.id, a]));

  return documentos.map((doc) => {
    const arma = doc.armaId ? porId.get(doc.armaId) : null;
    return {
      grupoChave: arma ? arma.id : CHAVE_PESSOAL,
      grupoTitulo: arma ? nomeArma(arma) : 'Meus documentos',
      rotulo: doc.titulo
        ? `${rotuloTipoDoc(doc.tipo)} (${doc.titulo})`
        : rotuloTipoDoc(doc.tipo),
      validade: doc.dataValidade,
      documentoId: doc.id,
    };
  });
}

export interface ResultadoAgendamento {
  agendadas: number;
  proxima: Date | null;
  semPermissao: boolean;
}

export async function reagendarAlertas(
  documentos: Documento[],
  armas: Arma[],
  habitualidades: Habitualidade[] = [],
  gerenciar = true,
  hora: number = HORA_PADRAO
): Promise<ResultadoAgendamento> {
  await Notifications.cancelAllScheduledNotificationsAsync();

  if (!(await permissaoConcedida())) {
    return { agendadas: 0, proxima: null, semPermissao: true };
  }

  const entradas = montarEntradas(documentos, armas);
  const hoje = hojeISO();
  // A habitualidade entra como UMA frente: concorre no teto diário em vez de
  // somar avisos, então o orçamento de 64 pendentes do iOS não se move.
  //
  // O domínio devolve os campos soltos, sem conhecer o `Aviso` do planejador —
  // a costura entre as duas formas é daqui, da camada de plataforma.
  const frente = avisoDeHabitualidade(calcularProgresso(armas, habitualidades, hoje, gerenciar));
  const extra = frente
    ? {
        aviso: {
          titulo: frente.titulo,
          subtitulo: frente.subtitulo,
          corpo: frente.corpo,
          urgente: frente.urgente,
          // Toque na habitualidade abre o painel de habitualidade.
          dados: { tipo: 'habitualidade' as const },
        },
        pior: frente.pior,
        itens: frente.itens,
      }
    : undefined;
  const plano = planejar(entradas, { hoje, hora, agora: new Date(), extra });

  for (const aviso of plano) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: aviso.titulo,
        subtitle: aviso.subtitulo,
        body: aviso.corpo,
        sound: true,
        badge: aviso.badge,
        interruptionLevel: aviso.urgente ? 'timeSensitive' : 'active',
        // Destino do toque (deep-link). Retrocompat: sem destino → caixa de avisos.
        data: (aviso.dados ?? { tela: '/(tabs)/avisos' }) as Record<string, unknown>,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: aviso.quando,
        channelId: CANAL_ANDROID,
      },
    });
  }

  await Notifications.setBadgeCountAsync(contarEmAlertaHoje(entradas, hoje));

  return {
    agendadas: plano.length,
    proxima: plano[0]?.quando ?? null,
    semPermissao: false,
  };
}

export async function limparAlertas(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  await Notifications.setBadgeCountAsync(0);
}

/** Quantos avisos de vencimento estão agendados no sistema agora. */
export async function contarAgendadas(): Promise<number> {
  const lista = await Notifications.getAllScheduledNotificationsAsync();
  return lista.length;
}
