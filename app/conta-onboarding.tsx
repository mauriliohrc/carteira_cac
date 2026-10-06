import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { espaco, raio, tipo, useCores, useEstilos, type Paleta } from '@/tema';
import { Botao } from '@/ui/base';

/**
 * "Segundo onboarding": convite para criar conta, mostrado uma vez logo após o
 * primeiro onboarding (disparado pela Raiz quando a Stack monta). Explica o
 * ganho da nuvem e empurra, com sutileza, para o cadastro — sem bloquear quem
 * prefere usar offline.
 */
export default function ContaOnboarding() {
  const c = useCores();
  const p = useEstilos(folha);
  const inset = useSafeAreaInsets();

  const beneficios = [
    { icone: 'cloud-done-outline' as const, texto: 'Backup automático na nuvem — nada se perde' },
    { icone: 'phone-portrait-outline' as const, texto: 'Troque de celular sem perder o acervo' },
    { icone: 'document-attach-outline' as const, texto: 'Documentos, fotos e anexos sincronizados' },
    { icone: 'ribbon-outline' as const, texto: 'Vínculo com clubes e parceiros' },
  ];

  return (
    <View style={[p.fundo, { paddingTop: inset.top + espaco.lg, paddingBottom: inset.bottom + espaco.lg }]}>
      <ScrollView contentContainerStyle={p.conteudo} showsVerticalScrollIndicator={false}>
        <View style={p.selo}>
          <Ionicons name="cloud-upload" size={30} color={c.primario} />
          <Text style={p.seloTexto}>SUA CONTA NA NUVEM</Text>
        </View>

        <Text style={p.titulo}>Seu acervo seguro{'\n'}em qualquer aparelho</Text>
        <Text style={p.sub}>
          Com uma conta grátis, seu acervo sincroniza na nuvem e você acessa de onde estiver.
          <Text style={p.subForte}> Sem conta, tudo fica só neste celular</Text> — e some se você
          trocar de aparelho.
        </Text>

        <View style={p.lista}>
          {beneficios.map((b) => (
            <View key={b.texto} style={p.item}>
              <Ionicons name={b.icone} size={20} color={c.primario} />
              <Text style={p.itemTexto}>{b.texto}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={p.rodape}>
        <Botao
          titulo="Criar conta grátis"
          icone="person-add-outline"
          aoTocar={() => router.replace('/conta/cadastrar')}
        />
        <Botao
          titulo="Já tenho conta"
          variante="secundario"
          icone="log-in-outline"
          aoTocar={() => router.replace('/conta/entrar')}
          estilo={{ marginTop: espaco.sm }}
        />
        <Botao
          titulo="Usar sem cadastro"
          variante="fantasma"
          aoTocar={() => router.back()}
          estilo={{ marginTop: espaco.xs }}
        />
        <Text style={p.rodapeNota}>Dá pra criar a conta depois, em Ajustes.</Text>
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
      backgroundColor: c.primarioFraco,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: `${c.primario}66`,
      marginBottom: espaco.xl,
    },
    seloTexto: { ...tipo.etiqueta, fontSize: 12, letterSpacing: 2, color: c.primario, fontWeight: '800' },
    titulo: { ...tipo.titulo, fontSize: 26, color: c.texto, textAlign: 'center' },
    sub: {
      ...tipo.corpo,
      color: c.textoMedio,
      textAlign: 'center',
      marginTop: espaco.md,
      lineHeight: 22,
    },
    subForte: { color: c.texto, fontWeight: '700' },
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
    rodapeNota: {
      ...tipo.legenda,
      color: c.textoFraco,
      textAlign: 'center',
      marginTop: espaco.sm,
    },
  });
