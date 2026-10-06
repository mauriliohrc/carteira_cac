import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

import { espaco, raio, tipo, useCores, useEstilos, type Paleta } from '@/tema';
import { useApp } from '@/estado/AppContext';
import { CartaoDocumento } from '@/ui/cartoes';
import { JANELA_ALERTA_DIAS, type Situacao } from '@/domain/vencimento';
import type { DocumentoComContexto } from '@/domain/tipos';

/**
 * Só a janela de alerta. Prazos de 90 dias ou mais não têm o que fazer numa
 * tela de avisos: eles não geram notificação e diluem o que exige ação. O
 * estado de cada documento continua visível na ficha da arma e o panorama
 * completo, no painel.
 */
type ChaveFaixa = Extract<Situacao, 'VENCIDO' | 'CRITICO' | 'ALERTA'>;

const faixas = (c: Paleta): { chave: ChaveFaixa; titulo: string; descricao: string; cor: string }[] => [
  { chave: 'VENCIDO', titulo: 'Vencidos', descricao: 'Regularize com urgência', cor: c.perigo },
  { chave: 'CRITICO', titulo: 'Até 7 dias', descricao: 'Protocole agora', cor: c.critico },
  {
    chave: 'ALERTA',
    titulo: `Até ${JANELA_ALERTA_DIAS} dias`,
    descricao: 'Janela de alerta diário',
    cor: c.aviso,
  },
];

export function AgendaVencimentos() {
  const c = useCores();
  const g = useEstilos(folha);
  const { pendencias } = useApp();

  const grupos = useMemo(() => {
    const mapa = new Map<ChaveFaixa, DocumentoComContexto[]>();
    for (const doc of pendencias) {
      const chave = doc.info.situacao as ChaveFaixa;
      const lista = mapa.get(chave);
      if (lista) lista.push(doc);
      else mapa.set(chave, [doc]);
    }
    for (const lista of mapa.values()) {
      lista.sort((a, b) => a.dataValidade.localeCompare(b.dataValidade));
    }
    return mapa;
  }, [pendencias]);

  if (!pendencias.length) return null;

  return (
    <View>
      {faixas(c).map((faixa) => {
        const lista = grupos.get(faixa.chave);
        if (!lista?.length) return null;
        return (
          <View key={faixa.chave} style={{ marginTop: espaco.lg }}>
            <View style={g.cabecalhoFaixa}>
              <View style={[g.marcador, { backgroundColor: faixa.cor }]} />
              <View style={{ flex: 1 }}>
                <Text style={g.tituloFaixa}>
                  {faixa.titulo.toUpperCase()} · {lista.length}
                </Text>
                <Text style={g.descricaoFaixa}>{faixa.descricao}</Text>
              </View>
            </View>
            {lista.map((doc) => (
              <CartaoDocumento
                key={doc.id}
                documento={doc}
                aoTocar={() => router.push({ pathname: '/documento/[id]', params: { id: doc.id } })}
              />
            ))}
          </View>
        );
      })}
    </View>
  );
}

const folha = (c: Paleta) =>
  StyleSheet.create({
    cabecalhoFaixa: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: espaco.md,
      marginBottom: espaco.md,
    },
    marcador: { width: 2, height: 28, borderRadius: raio.sm },
    tituloFaixa: { ...tipo.carimbo, color: c.texto },
    descricaoFaixa: { ...tipo.legenda, fontSize: 11, color: c.textoFraco, marginTop: 2 },
  });
