import React, { useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView, type WebViewNavigation } from 'react-native-webview';

import { espaco, tipo, useCores, useEstilos, type Paleta } from '@/tema';

/**
 * Checkout hospedado do Asaas (PIX/crédito/débito). O app só abre o `invoiceUrl`
 * numa WebView — a confirmação do pagamento chega pelo webhook do Asaas no
 * servidor e volta ao app pela sincronização. Por isso aqui não tentamos
 * "detectar pagamento": basta concluir e ir para "Meus processos", que puxa o
 * status atualizado.
 */
export default function CheckoutDespachante() {
  const c = useCores();
  const s = useEstilos(folha);
  const inset = useSafeAreaInsets();
  const { url } = useLocalSearchParams<{ url: string }>();
  const [carregando, setCarregando] = useState(true);
  const webref = useRef<WebView>(null);

  function concluir() {
    // Fecha toda a pilha do fluxo (servico → pedido → checkout, que ficam
    // empilhados, inclusive sobre o modal) e cai limpo em "Meus processos" —
    // assim o usuário não volta tela por tela ao finalizar.
    if (router.canDismiss()) router.dismissAll();
    router.push('/despachante/meus');
  }

  // PIX costuma abrir o app do banco por um scheme não-http. A WebView não
  // navega nesses schemes — encaminhamos ao sistema e barramos a navegação.
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
            // No iOS, links com target=_blank/window.open (comuns no checkout do
            // Asaas: "pagar com PIX", abrir app do banco) não abrem com múltiplas
            // janelas e a tela parece TRAVAR. Forçando janela única, a navegação
            // cai no onShouldStartLoadWithRequest e flui normal.
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
