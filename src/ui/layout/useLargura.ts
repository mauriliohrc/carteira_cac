import { useWindowDimensions } from 'react-native';

/**
 * Classe de largura da janela — a espinha do layout adaptativo (iPhone Duo,
 * iPad, Split View, Stage Manager).
 *
 * Projetar por LARGURA, não por aparelho: o Duo FECHADO (tela externa ~5,4")
 * cai em `compact`, idêntico a um iPhone comum; ABERTO (tela interna ~7,6",
 * quase quadrada) vira `regular` e habilita duas colunas. iPad e paisagem
 * entram em `wide`. `useWindowDimensions` já re-renderiza ao dobrar/desdobrar,
 * então a transição é automática — sem API de dobradiça.
 */
export type ClasseLargura = 'compact' | 'regular' | 'wide';

/** Fronteiras em pontos. O Duo aberto expõe ~740pt de largura lógica. */
export const LARGURA_REGULAR = 600;
export const LARGURA_WIDE = 840;

export interface Largura {
  largura: number;
  altura: number;
  classe: ClasseLargura;
  /** `true` em regular/wide: há espaço para lista + detalhe lado a lado. */
  duasColunas: boolean;
}

export function useLargura(): Largura {
  const { width, height } = useWindowDimensions();
  const classe: ClasseLargura =
    width < LARGURA_REGULAR ? 'compact' : width < LARGURA_WIDE ? 'regular' : 'wide';
  return { largura: width, altura: height, classe, duasColunas: classe !== 'compact' };
}
