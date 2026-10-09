import React, { useCallback, useEffect, useState } from 'react';
import { AppState, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';

import { espaco, raio, tipo, useCores, useEstilos, type Paleta } from '@/tema';
import { Secao } from '@/ui/base';
import { formatarDiaMes, listarCompeticoes } from './api';
import type { CompeticaoResumo } from './tipos';

const QUANTIDADE = 4;

/**
 * Prévia das competições ativas no fim do Painel. "Ver tudo" leva à lista
 * completa. Falha em silêncio (some) quando offline, sem conta ou sem
 * competições — o Painel precisa funcionar sem rede.
 */
export function SecaoCompeticoesPainel() {
  const p = useEstilos(folha);
  const [itens, setItens] = useState<CompeticaoResumo[] | null>(null);

  const carregar = useCallback(() => {
    let vivo = true;
    listarCompeticoes()
      .then((r) => vivo && setItens(r))
      // Falha transitória não apaga uma lista que já veio — só mantém o estado.
      .catch(() => vivo && setItens((atual) => atual ?? []));
    return () => {
      vivo = false;
    };
  }, []);

  // Refaz ao FOCAR o Painel (troca de aba / cold start): pega o vínculo com a
  // entidade que pode ter sido criado DEPOIS do primeiro carregamento (o
  // reconhecimento na Shooting House roda em segundo plano no heartbeat).
  useFocusEffect(carregar);

  // E ao voltar do background estando no Painel (não há troca de foco aí).
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') carregar();
    });
    return () => sub.remove();
  }, [carregar]);

  if (!itens || itens.length === 0) return null;

  return (
    <Secao
      titulo="Competições"
      acao={
        itens.length > QUANTIDADE ? (
          <Pressable onPress={() => router.push('/competicoes')} hitSlop={10}>
            <Text style={p.verTudo}>Ver tudo</Text>
          </Pressable>
        ) : null
      }
    >
      <View style={{ gap: espaco.sm }}>
        {itens.slice(0, QUANTIDADE).map((c) => (
          <CartaoCompeticao
            key={c.id}
            competicao={c}
            aoTocar={() => router.push({ pathname: '/competicoes/[id]', params: { id: c.id } })}
          />
        ))}
      </View>
    </Secao>
  );
}

function CartaoCompeticao({
  competicao,
  aoTocar,
}: {
  competicao: CompeticaoResumo;
  aoTocar: () => void;
}) {
  const c = useCores();
  const p = useEstilos(folha);
  return (
    <Pressable
      onPress={aoTocar}
      accessibilityRole="button"
      accessibilityLabel={`Competição ${competicao.nome}, ${competicao.entidadeNome}`}
      style={({ pressed }) => [p.cartao, pressed ? { opacity: 0.7 } : null]}
    >
      {competicao.bannerUrl ? (
        <Image source={{ uri: competicao.bannerUrl }} style={p.miniatura} resizeMode="cover" />
      ) : (
        <View style={[p.miniatura, p.miniaturaVazia]}>
          <Ionicons name="trophy-outline" size={18} color={c.latao} />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <View style={p.topo}>
          {competicao.emAndamento ? (
            <View style={[p.ponto, { backgroundColor: c.primario }]} />
          ) : null}
          <Text style={p.meta} numberOfLines={1}>
            {competicao.emAndamento ? 'EM ANDAMENTO' : 'EM BREVE'} · {competicao.entidadeNome}
          </Text>
        </View>
        <Text style={p.titulo} numberOfLines={2}>
          {competicao.nome}
        </Text>
        <Text style={p.periodo}>
          {formatarDiaMes(competicao.dataInicio)}–{formatarDiaMes(competicao.dataFim)} ·{' '}
          {competicao.totalCategorias} categoria{competicao.totalCategorias === 1 ? '' : 's'}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={c.textoFraco} />
    </Pressable>
  );
}

const folha = (c: Paleta) =>
  StyleSheet.create({
    verTudo: { fontSize: 12.5, fontWeight: '600', color: c.primario },
    cartao: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: espaco.md,
      backgroundColor: c.superficie,
      borderRadius: raio.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.borda,
      padding: espaco.md,
    },
    miniatura: { width: 48, height: 48, borderRadius: raio.sm, backgroundColor: c.superficieAlta },
    miniaturaVazia: {
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: `${c.latao}55`,
      backgroundColor: c.lataoFraco,
    },
    topo: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 3 },
    ponto: { width: 6, height: 6, borderRadius: 3 },
    meta: { ...tipo.etiqueta, fontSize: 9, color: c.primario, flex: 1 },
    titulo: { ...tipo.subtitulo, fontSize: 14, color: c.texto },
    periodo: { ...tipo.legenda, color: c.textoFraco, marginTop: 2 },
  });
