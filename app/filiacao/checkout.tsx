import React, { useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView, type WebViewNavigation } from 'react-native-webview';

import { espaco, tipo, useCores, useEstilos, type Paleta } from '@/tema';

/**
 * Checkout hospedado do Asaas da filiação (PIX/crédito/débito). A confirmação do
 * pagamento chega pelo webhook no servidor e volta ao app pela sincronização —
 * aqui basta concluir e ir para a carteirinha, que puxa o status atualizado.
 */
export default function CheckoutFiliacao() {
  const c = useCores();
  const s = useEstilos(folha);
  const inset = useSafeAreaInsets();
  const { url } = useLocalSearchParams<{ url: string }>();
  const [carregando, setCarregando] = useState(true);
  const webref = useRef<WebView>(null);

  function concluir() {
    if (router.canDismiss()) router.dismissAll();
    router.push('/filiacao/carteirinha');
  }

  function aoTentarNavegar(req: WebViewNavigation): boolean {
    if (/^https?:/i.test(req.url)) return true;
    void Linking.openURL(req.url).catch(() => {});
    return false;
  }

  return (
    <View style={[s.raiz, { paddingTop: inset.top }]}>
      <View style={s.barra}>
        <Text style={s.titulo}>Pagamento</Text>
        <Pressable onPress={concluir} hitSlop={8} style={s.fechar}>
          <Text style={s.fecharTexto}>Concluir</Text>
          <Ionicons name="close" size={20} color={c.texto} />
        </Pressable>
      </View>

      {url ? (
        <View style={{ flex: 1 }}>
          <WebView
            ref={webref}
            source={{ uri: url }}
            onLoadEnd={() => setCarregando(false)}
            onShouldStartLoadWithRequest={aoTentarNavegar}
            setSupportMultipleWindows={false}
            originWhitelist={['*']}
            javaScriptCanOpenWindowsAutomatically
            startInLoadingState
          />
          {carregando ? (
            <View style={s.carregando} pointerEvents="none">
              <ActivityIndicator color={c.primario} />
            </View>
          ) : null}
        </View>
      ) : (
        <View style={s.carregando}>
          <Text style={s.erro}>Checkout indisponível. Tente novamente.</Text>
        </View>
      )}
    </View>
  );
}

const folha = (c: Paleta) =>
  StyleSheet.create({
    raiz: { flex: 1, backgroundColor: c.fundo },
    barra: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: espaco.lg,
      paddingVertical: espaco.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.borda,
    },
    titulo: { ...tipo.titulo, color: c.texto },
    fechar: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    fecharTexto: { ...tipo.corpo, fontWeight: '600', color: c.texto },
    carregando: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.fundo,
    },
    erro: { ...tipo.corpo, color: c.textoMedio, textAlign: 'center', padding: espaco.xl },
  });
