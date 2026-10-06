import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { espaco, raio, tipo, useCores, useEstilos, type Paleta } from '@/tema';
import { Botao } from '@/ui/base';
import { useApp } from '@/estado/AppContext';
import { BENEFICIOS_PREMIUM, LIMITE_GRATUITO_ARMAS } from '@/billing';

/**
 * Interstício de upsell mostrado ao logar quando o acervo tem mais de uma arma.
 * No plano gratuito só 1 arma fica ativa; aqui convidamos a assinar o Premium
 * para liberar o acervo inteiro. Puramente promocional: "ver planos" leva ao
 * paywall; "agora não" dispensa.
 */
export default function PremiumUpsell() {
  const c = useCores();
  const p = useEstilos(folha);
  const inset = useSafeAreaInsets();
  const { armas } = useApp();

  return (
    <View style={[p.fundo, { paddingTop: inset.top + espaco.lg, paddingBottom: inset.bottom + espaco.lg }]}>
      <ScrollView contentContainerStyle={p.conteudo} showsVerticalScrollIndicator={false}>
        <View style={p.selo}>
          <Ionicons name="shield-checkmark" size={30} color={c.latao} />
          <Text style={p.seloTexto}>PREMIUM</Text>
        </View>

        <Text style={p.titulo}>Seu acervo pede mais espaço</Text>
        <Text style={p.sub}>
          Você tem <Text style={p.destaque}>{armas.length} armas</Text> no acervo. No plano
          gratuito só {LIMITE_GRATUITO_ARMAS === 1 ? 'uma' : LIMITE_GRATUITO_ARMAS} fica ativa — o
          resto fica bloqueado. Com o Premium, seu acervo inteiro volta a funcionar.
        </Text>

        <View style={p.lista}>
          {BENEFICIOS_PREMIUM.map((b) => (
            <View key={b} style={p.item}>
              <Ionicons name="checkmark-circle" size={20} color={c.primario} />
              <Text style={p.itemTexto}>{b}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={p.rodape}>
        <Botao
          titulo="Ver planos Premium"
          icone="sparkles-outline"
          aoTocar={() => router.replace('/premium')}
        />
        <Botao
          titulo="Agora não"
          variante="fantasma"
          aoTocar={() => router.back()}
          estilo={{ marginTop: espaco.sm }}
        />
      </View>
    </View>
  );
}

const folha = (c: Paleta) =>
  StyleSheet.create({
    fundo: { flex: 1, backgroundColor: c.fundo, paddingHorizontal: espaco.xl },
    conteudo: { flexGrow: 1, justifyContent: 'center', paddingVertical: espaco.xl },
    selo: {
      alignSelf: 'center',
      flexDirection: 'row',
      alignItems: 'center',
      gap: espaco.sm,
      paddingHorizontal: espaco.lg,
      paddingVertical: espaco.sm,
      borderRadius: raio.lg,
      backgroundColor: c.lataoFraco,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: `${c.latao}66`,
      marginBottom: espaco.xl,
    },
    seloTexto: { ...tipo.etiqueta, fontSize: 12, letterSpacing: 2, color: c.latao, fontWeight: '800' },
    titulo: { ...tipo.titulo, fontSize: 26, color: c.texto, textAlign: 'center' },
    sub: {
      ...tipo.corpo,
      color: c.textoMedio,
      textAlign: 'center',
      marginTop: espaco.md,
      lineHeight: 22,
    },
    destaque: { color: c.texto, fontWeight: '800' },
    lista: {
      marginTop: espaco.xxl,
      gap: espaco.md,
      backgroundColor: c.superficie,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.borda,
      borderRadius: raio.lg,
      padding: espaco.lg,
    },
    item: { flexDirection: 'row', alignItems: 'center', gap: espaco.md },
    itemTexto: { flex: 1, ...tipo.corpo, color: c.texto },
    rodape: { paddingTop: espaco.md },
  });
