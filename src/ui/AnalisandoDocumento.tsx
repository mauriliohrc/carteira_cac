import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Modal, StyleSheet, Text, View } from 'react-native';

import { espaco, tipo, useEstilos, type Paleta } from '@/tema';

/**
 * Overlay enquanto o servidor lê o documento e extrai os dados.
 *
 * O "loading" é um tambor de revólver (vista frontal) girando, desenhado com
 * Views — sem dependência de SVG. As proporções seguem um tambor real: 6
 * câmaras quase se tocando num círculo de furação, parede externa fina e o
 * cubo/ratchet no centro. Tudo é derivado do diâmetro D, então fica sempre
 * alinhado e simétrico.
 */
const CAMARAS = 6;
const D = 128; // diâmetro do tambor
const BORDA = 4; // espessura da parede externa
// Filhos absolutos são posicionados a partir da área INTERNA (dentro da borda),
// então o centro usado para left/top é o centro dessa área, não D/2.
const CENTRO = (D - 2 * BORDA) / 2;
const R_CAMARA = 17; // raio de cada câmara (bore)
const D_CAMARA = R_CAMARA * 2;
const R_FURACAO = 35; // raio do círculo onde ficam os centros das câmaras
const D_CUBO = 24; // diâmetro do cubo central (ratchet)
const D_RECESSO = (R_FURACAO + R_CAMARA) * 2 + 6; // anel que contorna as bocas

// Acabamento metálico (gunmetal) — independe do tema; metal é metal.
const ACO_CLARO = '#aab4b9';
const ACO = '#79858b';
const ACO_ESCURO = '#4b555b';
const BORE = '#090c0b'; // o furo (escuro)

export function AnalisandoDocumento({ visivel }: { visivel: boolean }) {
  const s = useEstilos(folha);
  const giro = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visivel) return;
    giro.setValue(0);
    const anim = Animated.loop(
      Animated.timing(giro, {
        toValue: 1,
        duration: 1100,
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
            {/* anel interno que contorna as bocas das câmaras (recesso) */}
            <View style={s.recesso} />

            {Array.from({ length: CAMARAS }, (_, i) => {
              // começa no topo (12h) e distribui simétrico
              const ang = -Math.PI / 2 + (i / CAMARAS) * 2 * Math.PI;
              const left = CENTRO + R_FURACAO * Math.cos(ang) - R_CAMARA;
              const top = CENTRO + R_FURACAO * Math.sin(ang) - R_CAMARA;
              return (
                <View key={i} style={[s.camara, { left, top }]}>
                  <View style={s.bore} />
                </View>
              );
            })}

            {/* cubo central / ratchet */}
            <View style={s.cubo}>
              <View style={s.pino} />
            </View>
          </Animated.View>

          <Text style={s.titulo}>Estamos analisando o documento.</Text>
          <Text style={s.sub}>Lendo o documento e preenchendo o que der automaticamente…</Text>
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
    // corpo do tambor
    tambor: {
      width: D,
      height: D,
      borderRadius: D / 2,
      backgroundColor: ACO,
      borderWidth: BORDA,
      borderColor: ACO_ESCURO,
      marginBottom: espaco.xl,
    },
    recesso: {
      position: 'absolute',
      left: CENTRO - D_RECESSO / 2,
      top: CENTRO - D_RECESSO / 2,
      width: D_RECESSO,
      height: D_RECESSO,
      borderRadius: D_RECESSO / 2,
      borderWidth: 1,
      borderColor: ACO_ESCURO,
      backgroundColor: ACO_CLARO,
    },
    // parede de cada câmara (anel de aço claro ao redor do furo)
    camara: {
      position: 'absolute',
      width: D_CAMARA,
      height: D_CAMARA,
      borderRadius: R_CAMARA,
      backgroundColor: ACO_CLARO,
      borderWidth: 1.5,
      borderColor: ACO_ESCURO,
      alignItems: 'center',
      justifyContent: 'center',
    },
    // o furo em si
    bore: {
      width: D_CAMARA - 11,
      height: D_CAMARA - 11,
      borderRadius: (D_CAMARA - 11) / 2,
      backgroundColor: BORE,
      borderWidth: 1,
      borderColor: 'rgba(0,0,0,0.5)',
    },
    // cubo central (ratchet/eixo)
    cubo: {
      position: 'absolute',
      left: CENTRO - D_CUBO / 2,
      top: CENTRO - D_CUBO / 2,
      width: D_CUBO,
      height: D_CUBO,
      borderRadius: D_CUBO / 2,
      backgroundColor: ACO_CLARO,
      borderWidth: 1.5,
      borderColor: ACO_ESCURO,
      alignItems: 'center',
      justifyContent: 'center',
    },
    pino: {
      width: 9,
      height: 9,
      borderRadius: 4.5,
      backgroundColor: BORE,
    },
    titulo: { ...tipo.titulo, fontSize: 17, color: c.texto, textAlign: 'center' },
    sub: { ...tipo.legenda, color: c.textoFraco, textAlign: 'center', marginTop: 6 },
  });
