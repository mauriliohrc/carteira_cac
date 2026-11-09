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
/** Diâmetro do círculo da aba central ("Serviços"), centrado DENTRO da barra. */
const CIRCULO = 56;

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

  // Só mostramos na barra as rotas que têm ícone declarado em `icones` — que é
  // exatamente o conjunto de abas visíveis. Rotas ocultas (ex.: Avisos, que
  // virou o sino do cabeçalho, com href:null) seguem no state do navegador mas
  // ficam de fora daqui. Filtrar por `icones` é determinístico e não depende de
  // o expo-router repassar o href nas options.
  const rotasVisiveis = state.routes.filter((r) => icones[r.name]);
  const rotaAtiva = state.routes[state.index];
  // Posição da aba ativa entre as VISÍVEIS. -1 quando estamos numa rota oculta
  // (ex.: Avisos pelo sino): aí nenhuma cápsula aparece.
  const indiceAtivo = rotasVisiveis.findIndex((r) => r.key === rotaAtiva?.key);

  const quantidade = rotasVisiveis.length;
  const larguraAba = larguraUtil ? larguraUtil / quantidade : 0;
  const deslocamento = useRef(new Animated.Value(0)).current;
  const primeiraMedida = useRef(true);

  const paddingBottom = Math.max(inferior, 10);

  // A aba "Serviços" (despachante) vira um círculo verde saltado, centrado na
  // coluna dela. Fica fora do vidro (que recorta) e navega no toque.
  const rotaCentral = rotasVisiveis.find((r) => r.name === 'despachante');
  const idxCentral = rotasVisiveis.findIndex((r) => r.name === 'despachante');
  const centralAtiva = rotaCentral?.key === rotaAtiva?.key;
  const irParaCentral = () => {
    if (!rotaCentral) return;
    const evento = navigation.emit({ type: 'tabPress', target: rotaCentral.key, canPreventDefault: true });
    if (!centralAtiva && !evento.defaultPrevented) navigation.navigate(rotaCentral.name, rotaCentral.params);
  };

  useEffect(() => {
    if (!larguraAba || indiceAtivo < 0) return;
    const destino = indiceAtivo * larguraAba;
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
  }, [deslocamento, larguraAba, indiceAtivo]);

  return (
    <View style={[b.raiz, { paddingBottom }]} pointerEvents="box-none">
      {/* Área relativa SEM padding: ancora o círculo central à borda de cima da
          barra, sem depender de como o Yoga trata padding em filho absoluto. */}
      <View style={b.barraArea} pointerEvents="box-none">
      <GrupoVidro proximidade={30} estilo={b.grupo}>
        <Vidro raioCanto={RAIO} material="regular" estilo={b.barra}>
          <View
            style={b.trilho}
            onLayout={(ev) => setLarguraUtil(ev.nativeEvent.layout.width)}
          >
            {larguraAba && indiceAtivo >= 0 ? (
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

            {rotasVisiveis.map((rota) => {
              const opcoes = descriptors[rota.key].options;
              const ativo = rota.key === rotaAtiva?.key;
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
                    // "Serviços" ganha o círculo verde saltado desenhado por
                    // cima; aqui dentro só fica o rótulo, sem ícone.
                    ocultarIcone={rota.name === 'despachante'}
                  />
                </Pressable>
              );
            })}
          </View>
        </Vidro>
      </GrupoVidro>

      {/* Círculo saltado da aba central, por cima do vidro (que recortaria).
          Ancorado ao topo da barra (top: -CIRCULO/2 → centro na borda) e
          centrado na largura (= centro da tela = coluna do meio das 5 abas). */}
      {idxCentral >= 0 ? (
        <View pointerEvents="box-none" style={b.centralCamada}>
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: centralAtiva }}
            accessibilityLabel="Serviços"
            onPress={irParaCentral}
            onLongPress={() =>
              rotaCentral && navigation.emit({ type: 'tabLongPress', target: rotaCentral.key })
            }
            style={({ pressed }) => [b.central, pressed ? { transform: [{ scale: 0.94 }] } : null]}
          >
            <Ionicons name="briefcase" size={23} color={c.sobrePrimario} />
            <Text style={b.centralRotulo} numberOfLines={1}>
              Serviços
            </Text>
          </Pressable>
        </View>
      ) : null}
      </View>
    </View>
  );
}

function ItemAba({
  ativo,
  rotulo,
  icone,
  badge,
  ocultarIcone,
}: {
  ativo: boolean;
  rotulo: string;
  icone: string;
  badge?: number | string;
  /** Esconde o ícone: a aba central o exibe num círculo saltado, desenhado fora
   *  do vidro (ver {@link BotaoCentral}). Mantém um vão para alinhar o rótulo. */
  ocultarIcone?: boolean;
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
        {ocultarIcone ? (
          <View style={{ width: 21, height: 21 }} />
        ) : (
          <Ionicons name={nome} size={21} color={cor} />
        )}
        {badge ? (
          <View style={b.badge}>
            <Text style={b.badgeTexto}>{badge}</Text>
          </View>
        ) : null}
      </Animated.View>
      {/* A aba central carrega ícone E rótulo dentro do círculo; aqui o slot
          fica sem texto para não duplicar. Com 6 abas cada fatia cai para ~58pt
          no iPhone de 375pt, e rótulos de 9 caracteres ("Meus docs") raspam no
          limite — por isso o adjustsFontSizeToFit nas demais. */}
      {ocultarIcone ? null : (
        <Text
          style={[b.rotulo, ativo ? b.rotuloAtivo : null]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.85}
        >
          {rotulo}
        </Text>
      )}
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
    // Envolve só a barra (sem padding) para ancorar o círculo central.
    barraArea: { position: 'relative' },
    // Camada do círculo: centrado DENTRO da barra (mesmo nível dos demais
    // ícones, sem saltar) e centrado na largura — despachante é a 3ª de 5 abas,
    // então o centro da tela coincide com a coluna do meio.
    centralCamada: {
      position: 'absolute',
      top: (ALTURA_BARRA - CIRCULO) / 2,
      left: 0,
      right: 0,
      alignItems: 'center',
    },
    central: {
      width: CIRCULO,
      height: CIRCULO,
      borderRadius: CIRCULO / 2,
      backgroundColor: c.primario,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
      ...Platform.select({
        ios: {
          shadowColor: c.nome === 'claro' ? c.sombra : '#000',
          shadowOpacity: c.nome === 'claro' ? 0.22 : 0.4,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 4 },
        },
        default: { elevation: 12 },
      }),
    },
    centralRotulo: {
      ...tipo.etiqueta,
      fontSize: 8.5,
      lineHeight: 10,
      fontWeight: '800',
      letterSpacing: 0.2,
      color: c.sobrePrimario,
    },
  });

/** Espaço que as telas precisam deixar livre no rodapé. */
export function useFolgaBarra(): number {
  const inferior = useSafeAreaInsets().bottom;
  return ALTURA_BARRA + Math.max(inferior, 10) + espaco.md;
}
