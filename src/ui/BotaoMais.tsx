import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { useCores, useEstilos, type Paleta } from '@/tema';

/**
 * Botão "Mais" para o slot `acao` do cabeçalho, ao lado do sino. Os ajustes
 * deixaram de ser uma aba (deram lugar à aba Caça); o acesso agora mora aqui.
 */
export function BotaoMais() {
  const c = useCores();
  const s = useEstilos(folha);
  return (
    <Pressable
      onPress={() => router.push('/mais')}
      hitSlop={8}
      accessibilityLabel="Mais"
      style={s.raiz}
    >
      <Ionicons name="settings-outline" size={22} color={c.texto} />
    </Pressable>
  );
}

const folha = (_c: Paleta) =>
  StyleSheet.create({
    raiz: { width: 26, height: 26, alignItems: 'center', justifyContent: 'center' },
  });
