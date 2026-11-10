import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { espaco, raio, tipo, useCores, useEstilos, type Paleta } from '@/tema';
import { useApp } from '@/estado/AppContext';
import { Secao, Tela, TituloTela } from '@/ui/base';
import { AcoesCabecalho } from '@/ui/AcoesCabecalho';
import type { TipoServicoDespachante } from '@/domain/tipos';

/** Serviços oferecidos — rótulos de vitrine. Preço/nota de GRU vêm do servidor
 *  (GET /despachante/servicos), exibidos no onboarding de cada serviço. */
const SERVICOS: {
  tipo: TipoServicoDespachante;
  icone: keyof typeof Ionicons.glyphMap;
  titulo: string;
  sub: string;
}[] = [
  {
    tipo: 'RENOVACAO_CRAF',
    icone: 'refresh-circle-outline',
    titulo: 'Renovação de CRAF',
    sub: 'Renovamos o registro de cada arma do seu acervo.',
  },
  {
    tipo: 'EMISSAO_GUIA',
    icone: 'document-text-outline',
    titulo: 'Emissão de Guias',
    sub: 'Emitimos a guia de tráfego do armamento que você precisar.',
  },
];

export default function Despachante() {
  const c = useCores();
  const s = useEstilos(folha);
  const { processos } = useApp();

  const emAberto = processos.filter((p) => p.status !== 'concluido' && p.status !== 'cancelado');

  return (
    <Tela sobBarra acao={<AcoesCabecalho />}>
      <TituloTela
        titulo="Serviços"
        sub="Deixe a burocracia com a gente. Você contrata, paga pelo app e acompanha por aqui."
      />

      <Secao titulo="Serviços">
        <View style={s.listaCards}>
        {SERVICOS.map((srv) => (
          <Pressable
            key={srv.tipo}
            onPress={() =>
              router.push({ pathname: '/despachante/servico', params: { tipo: srv.tipo } })
            }
            style={s.card}
          >
            <View style={s.icone}>
              <Ionicons name={srv.icone} size={24} color={c.primario} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.cardTitulo}>{srv.titulo}</Text>
              <Text style={s.cardSub}>{srv.sub}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={c.textoFraco} />
          </Pressable>
        ))}
        </View>
      </Secao>

      <Secao titulo="Acompanhamento">
        <Pressable onPress={() => router.push('/despachante/meus')} style={s.card}>
          <View style={s.icone}>
            <Ionicons name="list-outline" size={24} color={c.primario} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.cardTitulo}>Meus processos</Text>
            <Text style={s.cardSub}>
              {emAberto.length
                ? `${emAberto.length} em andamento`
                : 'Acompanhe aqui os processos contratados'}
            </Text>
          </View>
          {emAberto.length ? (
            <View style={s.badge}>
              <Text style={s.badgeTexto}>{emAberto.length > 9 ? '9+' : emAberto.length}</Text>
            </View>
          ) : (
            <Ionicons name="chevron-forward" size={20} color={c.textoFraco} />
          )}
        </Pressable>
      </Secao>
    </Tela>
  );
}

const folha = (c: Paleta) =>
  StyleSheet.create({
    listaCards: { gap: espaco.md },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: espaco.md,
      backgroundColor: c.superficie,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.borda,
      borderRadius: raio.lg,
      padding: espaco.md,
    },
    icone: {
      width: 46,
      height: 46,
      borderRadius: raio.md,
      backgroundColor: c.primarioFraco,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardTitulo: { ...tipo.corpo, fontWeight: '700', color: c.texto },
    cardSub: { ...tipo.legenda, color: c.textoMedio, marginTop: 2 },
    badge: {
      minWidth: 22,
      height: 22,
      paddingHorizontal: 6,
      borderRadius: 11,
      backgroundColor: c.primario,
      alignItems: 'center',
      justifyContent: 'center',
    },
    badgeTexto: { fontSize: 11, fontWeight: '800', color: '#FFF' },
  });
