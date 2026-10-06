import React from 'react';
import { Tabs } from 'expo-router';

import { useCores } from '@/tema';
import { useApp } from '@/estado/AppContext';
import { BarraAbas } from '@/ui/BarraAbas';

/** Ícones na variante contornada; a barra preenche quando a aba fica ativa. */
const ICONES: Record<string, string> = {
  index: 'grid-outline',
  acervo: 'albums-outline',
  avisos: 'notifications-outline',
  pessoais: 'person-outline',
  mais: 'ellipsis-horizontal-circle-outline',
};

export default function LayoutAbas() {
  const c = useCores();
  const { pendencias, avisosNaoLidos } = useApp();

  // O badge mostra o que exige ação: avisos não lidos, ou as pendências que
  // ainda vão virar aviso.
  const badge = avisosNaoLidos || pendencias.length;

  return (
    <Tabs
      tabBar={(props) => <BarraAbas {...props} icones={ICONES} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: c.fundo },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Painel' }} />
      {/* Acervo e habitualidade moram na mesma aba, em duas faces do mesmo
          assunto: gastar duas das cinco posições no mesmo tema seria caro. */}
      <Tabs.Screen name="acervo" options={{ title: 'Acervo' }} />
      <Tabs.Screen
        name="avisos"
        options={{ title: 'Avisos', tabBarBadge: badge ? (badge > 9 ? '9+' : badge) : undefined }}
      />
      <Tabs.Screen name="pessoais" options={{ title: 'Meus docs' }} />
      <Tabs.Screen name="mais" options={{ title: 'Mais' }} />
    </Tabs>
  );
}
