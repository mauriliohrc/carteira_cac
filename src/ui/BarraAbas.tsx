import React, { useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
// O expo-router carrega sua própria cópia do bottom-tabs; este é o caminho público.
import type { BottomTabBarProps } from 'expo-router/tabs';

import { espaco, tipo, useCores, useEstilos, type Paleta } from '@/tema';
import { GrupoVidro, Vidro, VIDRO_NATIVO } from './Vidro';

/** Altura útil da barra, sem a área segura. */
export const ALTURA_BARRA = 60;
const MARGEM_LATERAL = 14;
const RAIO = 26;
const FOLGA_INTERNA = 5;

/**
 * Barra de abas flutuante em vidro.
 *
 * A aba ativa ganha uma cápsula própria que desliza entre as posições. No iOS
 * 26 as duas peças de vidro ficam dentro de um GrupoVidro, então a cápsula se
 * funde à barra ao se aproximar das bordas — é o gesto do Liquid Glass, não
 * uma imitação em CSS.
 *
 * A barra flutua sobre o conteúdo (a tela rola por baixo) porque vidro sem
 * nada atrás não refrata nada: precisa ver a lista passando para ter graça.
 */
export interface PropsBarraAbas extends BottomTabBarProps {
  /** Nome da rota → ícone Ionicons na variante "-outline". */
  icones: Record<string, string>;
}

export function BarraAbas({ state, descriptors, navigation, icones }: PropsBarraAbas) {
  const c = useCores();
  const b = useEstilos(folha);
  const inferior = useSafeAreaInsets().bottom;
  const [larguraUtil, setLarguraUtil] = useState(0);

  const quantidade = state.routes.length;
  const larguraAba = larguraUtil ? larguraUtil / quantidade : 0;
  const deslocamento = useRef(new Animated.Value(0)).current;
  const primeiraMedida = useRef(true);

  useEffect(() => {
    if (!larguraAba) return;
    const destino = state.index * larguraAba;
    // Na primeira medição a cápsula já nasce no lugar, sem deslizar da esquerda.
    if (primeiraMedida.current) {
      primeiraMedida.current = false;
      deslocamento.setValue(destino);
      return;
    }
    Animated.spring(deslocamento, {
      toValue: destino,
      useNativeDriver: true,
      stiffness: 220,
      damping: 26,
      mass: 0.9,
    }).start();
  }, [deslocamento, larguraAba, state.index]);

  return (
    <View style={[b.raiz, { paddingBottom: Math.max(inferior, 10) }]} pointerEvents="box-none">
      <GrupoVidro proximidade={30} estilo={b.grupo}>
        <Vidro raioCanto={RAIO} material="regular" estilo={b.barra}>
          <View
            style={b.trilho}
            onLayout={(ev) => setLarguraUtil(ev.nativeEvent.layout.width)}
          >
            {larguraAba ? (
              <Animated.View
                pointerEvents="none"
                style={[
                  b.capsulaSlot,
                  { width: larguraAba, transform: [{ translateX: deslocamento }] },
                ]}
              >
                <Vidro
                  raioCanto={RAIO - FOLGA_INTERNA}
                  material="clear"
                  tom={c.primarioFraco}
                  quina={!VIDRO_NATIVO}
                  estilo={[b.capsula, { borderColor: `${c.primario}55` }]}
                />
              </Animated.View>
            ) : null}

            {state.routes.map((rota, indice) => {
              const opcoes = descriptors[rota.key].options;
              const ativo = state.index === indice;
              const rotulo =
                typeof opcoes.tabBarLabel === 'string'
                  ? opcoes.tabBarLabel
                  : (opcoes.title ?? rota.name);

              const aoTocar = () => {
                const evento = navigation.emit({
                  type: 'tabPress',
                  target: rota.key,
                  canPreventDefault: true,
                });
                if (!ativo && !evento.defaultPrevented) {
                  navigation.navigate(rota.name, rota.params);
                }
              };

              return (
                <Pressable
                  key={rota.key}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: ativo }}
                  accessibilityLabel={opcoes.tabBarAccessibilityLabel ?? rotulo}
                  onPress={aoTocar}
                  onLongPress={() =>
                    navigation.emit({ type: 'tabLongPress', target: rota.key })
                  }
                  style={b.aba}
                >
                  <ItemAba
                    ativo={ativo}
                    rotulo={rotulo}
                    icone={icones[rota.name] ?? 'ellipse-outline'}
                    badge={opcoes.tabBarBadge}
                  />
                </Pressable>
              );
            })}
          </View>
        </Vidro>
      </GrupoVidro>
    </View>
  );
}

function ItemAba({
  ativo,
  rotulo,
  icone,
  badge,
}: {
  ativo: boolean;
  rotulo: string;
  icone: string;
  badge?: number | string;
}) {
  const c = useCores();
  const b = useEstilos(folha);
  const escala = useRef(new Animated.Value(ativo ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(escala, {
      toValue: ativo ? 1 : 0,
      useNativeDriver: true,
      stiffness: 260,
      damping: 22,
    }).start();
  }, [ativo, escala]);

  // O ícone preenche e cresce um toque quando ativo: o destaque não depende
  // só da cor, então sobrevive a daltonismo e a tela sob sol forte.
  const nome = (ativo ? icone.replace(/-outline$/, '') : icone) as keyof typeof Ionicons.glyphMap;
  const cor = ativo ? c.primario : c.textoFraco;

  return (
    <View style={b.item}>
      <Animated.View
        style={{
          transform: [
            { scale: escala.interpolate({ inputRange: [0, 1], outputRange: [1, 1.1] }) },
            { translateY: escala.interpolate({ inputRange: [0, 1], outputRange: [0, -1] }) },
          ],
        }}
      >
        <Ionicons name={nome} size={21} color={cor} />
        {badge ? (
          <View style={b.badge}>
            <Text style={b.badgeTexto}>{badge}</Text>
          </View>
        ) : null}
      </Animated.View>
      {/* Com 6 abas cada fatia cai para ~58pt no iPhone de 375pt, e rótulos de
          9 caracteres ("Meus docs", "Habitual.") raspam no limite. Encolher um
          fio é melhor que cortar a palavra com reticências; nas telas maiores
          nada muda, porque só reduz quando não cabe. */}
      <Text
        style={[b.rotulo, ativo ? b.rotuloAtivo : null]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.85}
      >
        {rotulo}
      </Text>
    </View>
  );
}

const folha = (c: Paleta) =>
  StyleSheet.create({
    raiz: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: MARGEM_LATERAL,
    },
    grupo: { borderRadius: RAIO },
    barra: {
      height: ALTURA_BARRA,
      // Sombra difusa dá o descolamento do conteúdo; no escuro ela some e
      // quem separa é a quina especular.
      ...Platform.select({
        ios: {
          shadowColor: c.nome === 'claro' ? c.sombra : '#000',
          shadowOpacity: c.nome === 'claro' ? 0.13 : 0.35,
          shadowRadius: 20,
          shadowOffset: { width: 0, height: 8 },
        },
        default: { elevation: 10 },
      }),
    },
    trilho: { flex: 1, flexDirection: 'row', alignItems: 'stretch' },
    capsulaSlot: {
      position: 'absolute',
      top: FOLGA_INTERNA,
      bottom: FOLGA_INTERNA,
      left: 0,
      paddingHorizontal: 6,
    },
    capsula: {
      flex: 1,
      borderWidth: StyleSheet.hairlineWidth,
    },
    aba: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    item: { alignItems: 'center', gap: 4 },
    rotulo: { ...tipo.etiqueta, fontSize: 9.5, color: c.textoFraco, letterSpacing: 0.4 },
    rotuloAtivo: { color: c.primario },
    badge: {
      position: 'absolute',
      top: -5,
      right: -9,
      minWidth: 15,
      height: 15,
      paddingHorizontal: 3,
      borderRadius: 8,
      backgroundColor: c.perigo,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1.5,
      borderColor: c.nome === 'claro' ? '#FFF' : c.fundo,
    },
    badgeTexto: {
      fontSize: 9,
      fontWeight: '800',
      color: '#FFF',
      includeFontPadding: false,
    },
  });

/** Espaço que as telas precisam deixar livre no rodapé. */
export function useFolgaBarra(): number {
  const inferior = useSafeAreaInsets().bottom;
  return ALTURA_BARRA + Math.max(inferior, 10) + espaco.md;
}
