import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { useCores } from '@/tema';
import { BotaoSino } from './BotaoSino';

/**
 * Ações do canto direito do cabeçalho das abas principais: a engrenagem de
 * ajustes (ex-aba "Mais") + o sino de avisos. "Mais" deixou de ocupar um slot
 * da barra — a barra agora é Painel · Acervo · Serviços · Meus docs · Mercado.
 */
export function AcoesCabecalho() {
  const c = useCores();
  return (
    <View style={s.raiz}>
      <Pressable
        onPress={() => router.push('/mais')}
        hitSlop={8}
        accessibilityLabel="Ajustes"
        style={s.botao}
      >
        <Ionicons name="settings-outline" size={21} color={c.texto} />
      </Pressable>
      <BotaoSino />
    </View>
  );
}

const s = StyleSheet.create({
  raiz: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  botao: { width: 26, height: 26, alignItems: 'center', justifyContent: 'center' },
});
