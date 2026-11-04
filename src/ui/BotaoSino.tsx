import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { useCores, useEstilos, type Paleta } from '@/tema';
import { useApp } from '@/estado/AppContext';

/**
 * Sino de avisos para o slot `acao` do cabeçalho. Os avisos deixaram de ser uma
 * aba; o acesso agora mora aqui, com um badge do que exige ação (não lidos ou,
 * na falta deles, pendências que ainda vão virar aviso) — a mesma conta que a
 * barra de abas fazia.
 */
export function BotaoSino() {
  const c = useCores();
  const s = useEstilos(folha);
  const { avisosNaoLidos, pendencias } = useApp();
  const badge = avisosNaoLidos || pendencias.length;

  return (
    <Pressable
      onPress={() => router.push('/(tabs)/avisos')}
      hitSlop={8}
      accessibilityLabel="Avisos"
      style={s.raiz}
    >
      <Ionicons name="notifications-outline" size={22} color={c.texto} />
      {badge ? (
        <View style={s.badge}>
          <Text style={s.badgeTexto}>{badge > 9 ? '9+' : badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const folha = (c: Paleta) =>
  StyleSheet.create({
    raiz: { width: 26, height: 26, alignItems: 'center', justifyContent: 'center' },
    badge: {
      position: 'absolute',
      top: -4,
      right: -7,
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
    badgeTexto: { fontSize: 9, fontWeight: '800', color: '#FFF', includeFontPadding: false },
  });
