import React from 'react';
import { View } from 'react-native';

import { espaco } from '@/tema';
import { BotaoMais } from './BotaoMais';
import { BotaoSino } from './BotaoSino';

/**
 * Ações padrão do canto direito do cabeçalho: "Mais" (ajustes) + sino de avisos.
 * Usado por todas as abas, para o acesso aos ajustes e aos avisos ser o mesmo
 * em qualquer tela.
 */
export function AcoesCabecalho({ antes }: { antes?: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: espaco.md }}>
      {antes}
      <BotaoMais />
      <BotaoSino />
    </View>
  );
}
