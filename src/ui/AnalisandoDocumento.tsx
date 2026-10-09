import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Modal, StyleSheet, Text, View } from 'react-native';

import { espaco, tipo, useCores, useEstilos, type Paleta } from '@/tema';

/**
 * Overlay enquanto o servidor lê o PDF e extrai os dados.
 *
 * O "loading" é um tambor de revólver girando — desenhado com Views (sem
 * dependência de SVG): aro externo, cubo central e 6 câmaras posicionadas por
 * trigonometria, tudo girando num Animated.loop infinito.
 */
const CAMARAS = 6;
const ARO = 92; // diâmetro do tambor
const RAIO_CAMARA = ARO / 2 - 16; // distância do centro a cada câmara

export function AnalisandoDocumento({ visivel }: { visivel: boolean }) {
  const c = useCores();
  const s = useEstilos(folha);
  const giro = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visivel) return;
    giro.setValue(0);
    const anim = Animated.loop(
      Animated.timing(giro, {
        toValue: 1,
        duration: 1400,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    anim.start();
    return () => anim.stop();
  }, [visivel, giro]);

  const rotacao = giro.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <Modal visible={visivel} transparent animationType="fade" statusBarTranslucent>
      <View style={s.fundo}>
        <View style={s.cartao}>
          <Animated.View style={[s.tambor, { transform: [{ rotate: rotacao }] }]}>
            {Array.from({ length: CAMARAS }, (_, i) => {
              const ang = (i / CAMARAS) * 2 * Math.PI;
              const cx = ARO / 2 + RAIO_CAMARA * Math.cos(ang) - 11;
              const cy = ARO / 2 + RAIO_CAMARA * Math.sin(ang) - 11;
              return <View key={i} style={[s.camara, { left: cx, top: cy }]} />;
            })}
            <View style={s.cubo} />
          </Animated.View>
          <Text style={s.titulo}>Estamos analisando o documento.</Text>
          <Text style={s.sub}>Lendo o PDF e preenchendo o que der automaticamente…</Text>
        </View>
      </View>
    </Modal>
  );
}

const folha = (c: Paleta) =>
  StyleSheet.create({
    fundo: {
      flex: 1,
      backgroundColor: 'rgba(5,7,6,0.6)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: espaco.xl,
    },
    cartao: {
      width: '100%',
      maxWidth: 320,
      alignItems: 'center',
      backgroundColor: c.superficie,
      borderRadius: 20,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.borda,
      paddingVertical: espaco.xxl,
      paddingHorizontal: espaco.xl,
    },
    tambor: {
      width: ARO,
      height: ARO,
      borderRadius: ARO / 2,
      borderWidth: 3,
      borderColor: c.primario,
      backgroundColor: c.primarioFraco,
      marginBottom: espaco.xl,
    },
    camara: {
      position: 'absolute',
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: c.nome === 'claro' ? c.superficieAlta : c.fundo,
      borderWidth: 2,
      borderColor: c.primario,
    },
    cubo: {
      position: 'absolute',
      left: ARO / 2 - 9,
      top: ARO / 2 - 9,
      width: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: c.primario,
    },
    titulo: { ...tipo.titulo, fontSize: 17, color: c.texto, textAlign: 'center' },
    sub: { ...tipo.legenda, color: c.textoFraco, textAlign: 'center', marginTop: 6 },
  });
