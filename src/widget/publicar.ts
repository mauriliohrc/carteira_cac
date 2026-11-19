/**
 * A ponte entre o acervo e o widget da tela inicial.
 *
 * O widget vive num processo à parte e não recalcula nada: este módulo reduz o
 * acervo ao `ResumoWidget` (ver `./resumo`) e o entrega ao `expo-widgets`.
 *
 * Importar este arquivo registra o widget `Acervo` (o `createWidget` roda no
 * carregamento de `widgets/acervoWidget`), então basta chamar `publicar...` de
 * onde os dados são recalculados — hoje, dentro de `reagendarAlertas`.
 *
 * iOS × Android: no iOS montamos uma TIMELINE de alguns dias, porque a janela
 * dos 30 dias e a janela móvel da habitualidade viram com a DATA, não com uma
 * ação do usuário — assim o widget fica certo mesmo sem abrir o app. No Android
 * o `expo-widgets` não tem timeline (`updateTimeline` é no-op); lá o widget
 * reflete o estado da última vez que o app rodou, atualizado via `updateSnapshot`.
 */
import { Platform } from 'react-native';

import type { Arma, Documento, Habitualidade } from '@/domain/tipos';
import { hojeISO, somarDias } from '@/lib/data';
import { montarResumoWidget } from './resumo';

/** Quantos dias à frente a timeline do iOS cobre antes de pedir recálculo. */
const DIAS_TIMELINE = 31;

/** Meia-noite local do dia ISO — âncora de cada entrada da timeline. */
function meiaNoite(diaISO: string): Date {
  return new Date(`${diaISO}T00:00:00`);
}

/**
 * Recalcula o resumo e o publica no widget. Best-effort e robusto: o
 * `widgets/acervoWidget` (que roda `createWidget` e fala com o módulo nativo do
 * expo-widgets) só é carregado AQUI, via require tardio dentro do try — assim um
 * build sem a extensão linkada (ou um iOS 16, onde o widget nem existe) nunca
 * derruba o app no startup; no pior caso a publicação simplesmente não acontece.
 */
export function publicarResumoWidget(
  documentos: Documento[],
  armas: Arma[],
  habitualidades: Habitualidade[],
  gerenciar = true
): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { AcervoWidget } = require('../../widgets/acervoWidget') as typeof import('../../widgets/acervoWidget');
    const hoje = hojeISO();

    if (Platform.OS === 'ios') {
      // Uma entrada por dia: cada dia pode cruzar a janela de 30 dias de um
      // documento ou derrubar um grupo de habitualidade. Recalcular é barato.
      const entradas = Array.from({ length: DIAS_TIMELINE }, (_, i) => {
        const dia = somarDias(hoje, i);
        return {
          date: meiaNoite(dia),
          props: montarResumoWidget(documentos, armas, habitualidades, gerenciar, dia),
        };
      });
      AcervoWidget.updateTimeline(entradas);
      return;
    }

    AcervoWidget.updateSnapshot(montarResumoWidget(documentos, armas, habitualidades, gerenciar, hoje));
  } catch {
    // Widget indisponível neste aparelho — segue o jogo.
  }
}
