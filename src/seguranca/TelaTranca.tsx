import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { espaco, raio, tipo, useCores, useEstilos, type Paleta } from '@/tema';
import { TecladoPin, type AtalhoBiometria } from './TecladoPin';
import { useTranca } from './TrancaProvider';
import { autenticarBiometria, rotuloBiometria, verificarPin, type TipoBiometria } from './tranca';

function iconeBiometria(tipo: TipoBiometria): keyof typeof Ionicons.glyphMap {
  if (tipo === 'digital') return 'finger-print';
  if (tipo === 'iris') return 'eye-outline';
  return 'scan-outline';
}

/** Tela cheia que cobre o app enquanto ele está trancado. */
export function TelaTranca() {
  const c = useCores();
  const t = useEstilos(folha);
  const insets = useSafeAreaInsets();
  const { biometria, biometriaLigada, desbloquear } = useTranca();

  const [pin, setPin] = useState('');
  const [erro, setErro] = useState(false);
  const bioUsavel = biometriaLigada && biometria.disponivel;

  const tentarBiometria = useCallback(async () => {
    const ok = await autenticarBiometria('Desbloquear a Carteira CAC');
    if (ok) desbloquear();
  }, [desbloquear]);

  // Ao abrir trancado com biometria ligada, já oferece o Face ID/digital.
  const jaOfereceu = useRef(false);
  useEffect(() => {
    if (bioUsavel && !jaOfereceu.current) {
      jaOfereceu.current = true;
      void tentarBiometria();
    }
  }, [bioUsavel, tentarBiometria]);

  const aoCompletar = async (valor: string) => {
    if (await verificarPin(valor)) {
      desbloquear();
      return;
    }
    setErro(true);
    setPin('');
  };

  const atalho: AtalhoBiometria | null = bioUsavel
    ? {
        icone: iconeBiometria(biometria.tipo),
        rotulo: `Usar ${rotuloBiometria(biometria.tipo)}`,
        aoUsar: () => void tentarBiometria(),
      }
    : null;

  return (
    <View style={[t.raiz, { paddingTop: insets.top + espaco.xxl, paddingBottom: insets.bottom + espaco.xl }]}>
      <View style={t.topo}>
        <Image
          source={require('../../assets/logo.png')}
          style={t.logo}
          resizeMode="contain"
          accessibilityLabel="Carteira CAC"
        />
        <Text style={t.marca}>CARTEIRA CAC</Text>
      </View>

      <View style={t.centro}>
        <TecladoPin
          titulo="Digite seu PIN"
          subtitulo={
            erro
              ? 'PIN incorreto. Tente de novo.'
              : bioUsavel
                ? `Ou use ${rotuloBiometria(biometria.tipo)} para entrar`
                : undefined
          }
          valor={pin}
          aoMudar={(v) => {
            setErro(false);
            setPin(v);
          }}
          aoCompletar={aoCompletar}
          erro={erro}
          biometria={atalho}
        />
      </View>
    </View>
  );
}

const folha = (c: Paleta) =>
  StyleSheet.create({
    raiz: {
      flex: 1,
      backgroundColor: c.fundo,
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    topo: { alignItems: 'center', gap: espaco.md },
    logo: { width: 76, height: 76 },
    marca: { ...tipo.marca, color: c.texto },
    centro: { flex: 1, justifyContent: 'center', width: '100%', alignItems: 'center' },
  });
