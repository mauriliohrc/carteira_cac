import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { espaco, raio, tipo, useCores, useEstilos, type Paleta } from '@/tema';
import { Botao } from '@/ui/base';
import { useConta } from '@/conta/ContaContext';

/**
 * Interstício mostrado após login/cadastro quando a conta ainda NÃO está
 * confirmada (e-mail não verificado). Deixa claro que a conta não está ativa e
 * convida a confirmar o e-mail — pré-requisito para importar o acervo da
 * Shooting House e proteger os dados. Mesmo formato do upsell de Premium.
 */
export default function AtivarConta() {
  const c = useCores();
  const p = useEstilos(folha);
  const inset = useSafeAreaInsets();
  const { usuario } = useConta();

  const itens = [
    { icone: 'shield-checkmark-outline' as const, texto: 'Ativa a sua conta e protege seus dados' },
    { icone: 'cloud-download-outline' as const, texto: 'Libera a importação do acervo da Shooting House' },
    { icone: 'lock-closed-outline' as const, texto: 'Garante que o e-mail é mesmo seu' },
  ];

  return (
    <View style={[p.fundo, { paddingTop: inset.top + espaco.lg, paddingBottom: inset.bottom + espaco.lg }]}>
      <ScrollView contentContainerStyle={p.conteudo} showsVerticalScrollIndicator={false}>
        <View style={p.selo}>
          <Ionicons name="alert-circle" size={30} color={c.critico} />
          <Text style={p.seloTexto}>CONTA NÃO ATIVADA</Text>
        </View>

        <Text style={p.titulo}>Falta confirmar seu e-mail</Text>
        <Text style={p.sub}>
          Sua conta foi criada, mas <Text style={p.destaque}>ainda não está ativa</Text>. Enviamos
          um código para {usuario?.email ? <Text style={p.destaque}>{usuario.email}</Text> : 'seu e-mail'}.
          Confirme para ativar a conta e usar tudo.
        </Text>

        <View style={p.lista}>
          {itens.map((it) => (
            <View key={it.texto} style={p.item}>
              <Ionicons name={it.icone} size={20} color={c.primario} />
              <Text style={p.itemTexto}>{it.texto}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={p.rodape}>
        <Botao
          titulo="Confirmar e-mail agora"
          icone="mail-unread-outline"
          aoTocar={() => router.replace('/conta/verificar')}
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
      backgroundColor: `${c.critico}1f`,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: `${c.critico}66`,
      marginBottom: espaco.xl,
    },
    seloTexto: { ...tipo.etiqueta, fontSize: 12, letterSpacing: 2, color: c.critico, fontWeight: '800' },
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
