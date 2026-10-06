import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { useCores } from '@/tema';

/**
 * Leitor de PDF nativo. No iOS a WebView renderiza PDF direto do file://.
 * A variante web deste arquivo (LeitorPdf.web.tsx) usa um <iframe>.
 */
export function LeitorPdf({ uri, aoFalhar }: { uri: string; aoFalhar: () => void }) {
  const c = useCores();
  const [carregando, setCarregando] = useState(true);

  return (
    <View style={[l.raiz, { backgroundColor: c.leitor }]}>
      <WebView
        source={{ uri }}
        style={[l.raiz, { backgroundColor: c.leitor }]}
        originWhitelist={['file://', 'about:']}
        allowFileAccess
        allowFileAccessFromFileURLs
        allowUniversalAccessFromFileURLs
        onLoadEnd={() => setCarregando(false)}
        onError={() => {
          setCarregando(false);
          aoFalhar();
        }}
      />
      {carregando ? (
        <View style={[l.sobreposicao, { backgroundColor: c.fundo }]}>
          <ActivityIndicator color={c.primario} />
        </View>
      ) : null}
    </View>
  );
}

const l = StyleSheet.create({
  raiz: { flex: 1 },
  sobreposicao: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
