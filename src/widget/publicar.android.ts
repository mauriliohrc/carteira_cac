/**
 * Android: o widget está adiado. O `expo-widgets@57.0.28` ainda renderiza um
 * stub no Android (o Glance só mostra o nome do widget, sem avaliar o layout JS),
 * então `enableAndroid` está desligado no app.json. Este arquivo é o que o Metro
 * escolhe no build `--platform android`, mantendo `widgets/acervoWidget`
 * (e o `createWidget` + `@expo/ui/swift-ui`) fora do bundle Android — sem risco
 * de crash no startup. Quando o Glance ganhar layout, troca-se este sem-op por
 * um publicador que fale com um `acervoWidget.android.tsx`.
 */
import type { Arma, Documento, Habitualidade } from '@/domain/tipos';

export function publicarResumoWidget(
  _documentos: Documento[],
  _armas: Arma[],
  _habitualidades: Habitualidade[],
  _gerenciar = true
): void {
  // sem-op no Android por ora
}
