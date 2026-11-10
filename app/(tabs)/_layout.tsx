import React from 'react';
import { Tabs } from 'expo-router';

import { useCores } from '@/tema';
import { BarraAbas } from '@/ui/BarraAbas';

/** Ícones na variante contornada; a barra preenche quando a aba fica ativa. */
const ICONES: Record<string, string> = {
  index: 'grid-outline',
  acervo: 'albums-outline',
  despachante: 'briefcase-outline',
  pessoais: 'person-outline',
  mercado: 'pricetags-outline',
};

export default function LayoutAbas() {
  const c = useCores();

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
      <Tabs.Screen name="despachante" options={{ title: 'Serviços' }} />
      {/* Avisos saiu da barra e virou o sino do cabeçalho (BotaoSino). A rota
          continua existindo — href:null só a tira da barra, preservando todos
          os destinos para /(tabs)/avisos (Painel, notificação tocada, push). */}
      <Tabs.Screen name="avisos" options={{ href: null }} />
      <Tabs.Screen name="pessoais" options={{ title: 'Meus docs' }} />
      <Tabs.Screen name="mercado" options={{ title: 'Mercado' }} />
      {/* "Mais" saiu da barra e virou a engrenagem do cabeçalho (AcoesCabecalho).
          A rota continua existindo — href:null só a tira da barra. */}
      <Tabs.Screen name="mais" options={{ href: null }} />
    </Tabs>
  );
}
