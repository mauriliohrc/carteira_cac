import React from 'react';
import { StyleSheet, View } from 'react-native';

import { useCores } from '@/tema';

/** No navegador o próprio <iframe> renderiza o PDF. */
export function LeitorPdf({ uri, aoFalhar }: { uri: string; aoFalhar: () => void }) {
  void aoFalhar;
  const c = useCores();
  return (
    <View style={[l.raiz, { backgroundColor: c.leitor }]}>
      {React.createElement('iframe', {
        src: uri,
        style: { width: '100%', height: '100%', border: 'none', background: c.leitor },
        title: 'Documento',
      })}
    </View>
  );
}

const l = StyleSheet.create({ raiz: { flex: 1 } });
