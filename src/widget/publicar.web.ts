/**
 * Prévia web: não há widget de tela inicial nem `expo-widgets`. O Metro escolhe
 * este arquivo no lugar de `publicar.ts` na web, mantendo o import de
 * `widgets/acervoWidget` (e seus módulos nativos) longe do bundle do navegador.
 */
import type { Arma, Documento, Habitualidade } from '@/domain/tipos';

export function publicarResumoWidget(
  _documentos: Documento[],
  _armas: Arma[],
  _habitualidades: Habitualidade[],
  _gerenciar = true
): void {
  // sem-op na web
}
