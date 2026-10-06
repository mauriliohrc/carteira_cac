import React from 'react';
import { AccessibilityInfo, Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { GlassContainer, GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { LinearGradient } from 'expo-linear-gradient';

import { useCores, useTema } from '@/tema';

/**
 * Superfície de vidro em três níveis, do melhor material disponível para baixo:
 *
 *   1. iOS 26+   → GlassView, o Liquid Glass de verdade (refrata e deforma o
 *                  conteúdo atrás, reage ao movimento)
 *   2. iOS < 26, Android, web → BlurView, que borra sem refratar
 *   3. Acessibilidade "Reduzir transparência" ligada → superfície opaca
 *
 * O que faz vidro parecer vidro não é só o borrão: é a **quina especular** —
 * o fio de luz no topo e a sombra no pé, que dão espessura à peça. Por isso a
 * moldura é desenhada em todos os níveis, inclusive no opaco.
 */

export const VIDRO_NATIVO = isLiquidGlassAvailable();

/** "Reduzir transparência" nos ajustes de acessibilidade desliga o vidro. */
export function useTransparenciaReduzida(): boolean {
  const [reduzida, setReduzida] = React.useState(false);

  React.useEffect(() => {
    let vivo = true;
    void AccessibilityInfo.isReduceTransparencyEnabled?.().then((v) => {
      if (vivo) setReduzida(!!v);
    });
    const sub = AccessibilityInfo.addEventListener?.('reduceTransparencyChanged', (v) =>
      setReduzida(!!v)
    );
    return () => {
      vivo = false;
      sub?.remove();
    };
  }, []);

  return reduzida;
}

export interface VidroProps {
  children?: React.ReactNode;
  estilo?: StyleProp<ViewStyle>;
  /** Raio dos cantos — precisa vir junto para o recorte do material. */
  raioCanto: number;
  /** 'regular' tem mais matéria; 'clear' é quase só refração. */
  material?: 'regular' | 'clear';
  /** Tingimento do vidro (use com parcimônia: vidro colorido suja rápido). */
  tom?: string;
  /** Reage ao toque com o brilho do sistema (só iOS 26+). */
  interativo?: boolean;
  /** Desenha a quina especular. Desligue em peças aninhadas. */
  quina?: boolean;
}

export function Vidro({
  children,
  estilo,
  raioCanto,
  material = 'regular',
  tom,
  interativo,
  quina = true,
}: VidroProps) {
  const c = useCores();
  const { esquema } = useTema();
  const reduzida = useTransparenciaReduzida();
  const escuro = esquema === 'escuro';
  const ehAndroid = Platform.OS === 'android';

  const moldura = quina ? (
    <Quina raioCanto={raioCanto} escuro={escuro} />
  ) : null;

  // 3. Sem transparência OU Android: superfície sólida, mas mantém a quina.
  // No Android o BlurView (dimezisBlurView) NÃO respeita o borderRadius — ele
  // pinta um retângulo borrado que vaza por baixo da cápsula (a "mancha
  // quadrada", visível sobretudo no tema claro). Então no Android usamos a
  // superfície sólida, que recorta os cantos corretamente.
  if (reduzida || ehAndroid) {
    return (
      <View
        style={[
          { borderRadius: raioCanto, backgroundColor: c.superficie, overflow: 'hidden' },
          estilo,
        ]}
      >
        {children}
        {moldura}
      </View>
    );
  }

  // 1. Liquid Glass nativo.
  if (VIDRO_NATIVO) {
    return (
      <GlassView
        glassEffectStyle={material}
        tintColor={tom}
        isInteractive={interativo}
        // O app tem seu próprio seletor de tema: o vidro não pode seguir o
        // sistema por conta própria, ou destoa quando o usuário fixa claro.
        colorScheme={escuro ? 'dark' : 'light'}
        style={[{ borderRadius: raioCanto, overflow: 'hidden' }, estilo]}
      >
        {children}
        {moldura}
      </GlassView>
    );
  }

  // 2. Borrão.
  return (
    <BlurView
      intensity={escuro ? 42 : 58}
      tint={escuro ? 'systemThickMaterialDark' : 'systemThickMaterialLight'}
      // Android nunca chega aqui (usa a superfície sólida acima); iOS<26/web
      // não precisam do método experimental.
      experimentalBlurMethod={undefined}
      style={[{ borderRadius: raioCanto, overflow: 'hidden' }, estilo]}
    >
      {tom ? <View style={[StyleSheet.absoluteFill, { backgroundColor: tom }]} /> : null}
      {children}
      {moldura}
    </BlurView>
  );
}

/**
 * Agrupa peças de vidro para que se fundam quando chegam perto — o gesto
 * característico do iOS 26. Fora do iOS 26 é uma View comum.
 */
export function GrupoVidro({
  children,
  estilo,
  proximidade = 24,
}: {
  children: React.ReactNode;
  estilo?: StyleProp<ViewStyle>;
  proximidade?: number;
}) {
  if (!VIDRO_NATIVO) return <View style={estilo}>{children}</View>;
  return (
    <GlassContainer spacing={proximidade} style={estilo}>
      {children}
    </GlassContainer>
  );
}

/**
 * A quina especular: um fio de luz no contorno e um brilho suave que escorre
 * do topo e morre no meio da peça. É o que dá espessura — sem isso, vidro vira
 * retângulo borrado. O brilho fica em opacidade baixa e confinado à metade de
 * cima, para não lavar o texto por baixo.
 */
function Quina({ raioCanto, escuro }: { raioCanto: number; escuro: boolean }) {
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: raioCanto }]}>
      <LinearGradient
        colors={
          escuro
            ? ['rgba(255,255,255,0.10)', 'rgba(255,255,255,0)']
            : ['rgba(255,255,255,0.70)', 'rgba(255,255,255,0)']
        }
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '55%',
          borderTopLeftRadius: raioCanto,
          borderTopRightRadius: raioCanto,
        }}
      />
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            borderRadius: raioCanto,
            borderWidth: StyleSheet.hairlineWidth,
            // Sobre fundo branco um contorno branco é invisível: no claro
            // quem desenha a quina é um cinza translúcido.
            borderColor: escuro ? 'rgba(255,255,255,0.16)' : 'rgba(20,22,15,0.10)',
          },
        ]}
      />
    </View>
  );
}
