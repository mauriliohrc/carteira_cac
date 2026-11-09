import React from 'react';
import { StyleSheet, View } from 'react-native';

import { useCores } from '@/tema';
import { useLargura } from './useLargura';

/**
 * Layout master-detail. Em telas largas (iPad, iPhone Duo aberto, Android
 * tablet) renderiza LISTA | divisória | DETALHE lado a lado. Em `compact`
 * (telefone, Duo fechado) devolve só a lista — o detalhe continua sendo aberto
 * por navegação (`router.push`), como sempre. Assim o telefone não muda.
 */
export function DuasColunas({
  lista,
  detalhe,
  flexLista = 4,
  flexDetalhe = 6,
}: {
  lista: React.ReactNode;
  detalhe: React.ReactNode;
  /** Proporção das colunas (padrão 40% / 60%). */
  flexLista?: number;
  flexDetalhe?: number;
}) {
  const c = useCores();
  const { duasColunas } = useLargura();

  if (!duasColunas) return <>{lista}</>;

  return (
    <View style={{ flex: 1, flexDirection: 'row' }}>
      <View style={{ flex: flexLista }}>{lista}</View>
      <View
        style={{
          flex: flexDetalhe,
          borderLeftWidth: StyleSheet.hairlineWidth,
          borderLeftColor: c.borda,
        }}
      >
        {detalhe}
      </View>
    </View>
  );
}
