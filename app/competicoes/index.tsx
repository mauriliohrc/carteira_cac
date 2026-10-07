import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { espaco, raio, tipo, useCores, useEstilos, type Paleta } from '@/tema';
import { Tela, Vazio } from '@/ui/base';
import { ErroConta } from '@/conta/api';
import { formatarData, listarCompeticoes } from '@/competicoes/api';
import type { CompeticaoResumo } from '@/competicoes/tipos';

export default function Competicoes() {
  const c = useCores();
  const p = useEstilos(folha);

  const [itens, setItens] = useState<CompeticaoResumo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setErro(null);
    try {
      setItens(await listarCompeticoes());
    } catch (e) {
      setErro(e instanceof ErroConta ? e.message : 'Não foi possível carregar as competições.');
    } finally {
      setCarregando(false);
      setAtualizando(false);
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const aoAtualizar = useCallback(() => {
    setAtualizando(true);
    void carregar();
  }, [carregar]);

  if (carregando) {
    return (
      <Tela voltar rolavel={false} tituloCabecalho="Competições">
        <View style={p.centro}>
          <ActivityIndicator color={c.primario} />
        </View>
      </Tela>
    );
  }

  if (erro && itens.length === 0) {
    return (
      <Tela voltar tituloCabecalho="Competições">
        <Vazio icone="cloud-offline-outline" titulo="Sem conexão" descricao={erro} />
      </Tela>
    );
  }

  return (
    <Tela voltar rolavel={false} tituloCabecalho="Competições">
      <FlatList
        data={itens}
        keyExtractor={(c) => c.id}
        contentContainerStyle={p.lista}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={atualizando} onRefresh={aoAtualizar} tintColor={c.primario} />
        }
        ListEmptyComponent={
          <Vazio
            icone="trophy-outline"
            titulo="Nenhuma competição ativa"
            descricao="Quando uma entidade da qual você faz parte abrir uma competição, ela aparece aqui."
          />
        }
        renderItem={({ item }) => (
          <CartaoCompeticao
            competicao={item}
            aoTocar={() => router.push({ pathname: '/competicoes/[id]', params: { id: item.id } })}
          />
        )}
      />
    </Tela>
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
      style={({ pressed }) => [p.cartao, pressed ? { opacity: 0.75 } : null]}
    >
      {competicao.bannerUrl ? (
        <Image source={{ uri: competicao.bannerUrl }} style={p.imagem} resizeMode="cover" />
      ) : (
        <View style={[p.imagem, p.imagemVazia]}>
          <Ionicons name="trophy-outline" size={32} color={c.latao} />
        </View>
      )}
      <View style={p.corpo}>
        <View style={p.topo}>
          {competicao.emAndamento ? <View style={p.ponto} /> : null}
          <Text style={p.meta} numberOfLines={1}>
            {competicao.emAndamento ? 'EM ANDAMENTO' : 'EM BREVE'} · {competicao.entidadeNome}
          </Text>
        </View>
        <Text style={p.titulo} numberOfLines={2}>
          {competicao.nome}
        </Text>
        {competicao.descricao ? (
          <Text style={p.descricao} numberOfLines={2}>
            {competicao.descricao}
          </Text>
        ) : null}
        <View style={p.rodape}>
          <Ionicons name="calendar-outline" size={13} color={c.textoFraco} />
          <Text style={p.rodapeTexto}>
            {formatarData(competicao.dataInicio)} – {formatarData(competicao.dataFim)}
          </Text>
          <Text style={p.rodapeTexto}>
            · {competicao.totalCategorias} categoria{competicao.totalCategorias === 1 ? '' : 's'}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const folha = (c: Paleta) =>
  StyleSheet.create({
    centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    lista: { paddingHorizontal: espaco.lg, paddingBottom: 48, gap: espaco.md },
    cartao: {
      backgroundColor: c.superficie,
      borderRadius: raio.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.borda,
      overflow: 'hidden',
    },
    imagem: { width: '100%', height: 150, backgroundColor: c.superficieAlta },
    imagemVazia: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.lataoFraco,
    },
    corpo: { padding: espaco.lg },
    topo: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 6 },
    ponto: { width: 7, height: 7, borderRadius: 4, backgroundColor: c.primario },
    meta: { ...tipo.etiqueta, fontSize: 10, color: c.primario, flex: 1 },
    titulo: { ...tipo.titulo, fontSize: 17, color: c.texto },
    descricao: { ...tipo.corpoPequeno, color: c.textoFraco, marginTop: 5 },
    rodape: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: espaco.md, flexWrap: 'wrap' },
    rodapeTexto: { ...tipo.legenda, color: c.textoFraco },
  });
