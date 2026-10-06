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

import { espaco, raio, tipo, useCores, useEstilos, type Paleta } from '@/tema';
import { Tela, Vazio } from '@/ui/base';
import { ErroConta } from '@/conta/api';
import { formatarData, listarNoticias } from '@/noticias/api';
import { registrarPresenca } from '@/push/presenca';
import type { Noticia } from '@/noticias/tipos';

export default function Noticias() {
  const c = useCores();
  const p = useEstilos(folha);

  const [itens, setItens] = useState<Noticia[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [acabou, setAcabou] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [carregandoMais, setCarregandoMais] = useState(false);
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregarInicial = useCallback(async () => {
    setErro(null);
    void registrarPresenca(); // renderizar notícias conta como atividade
    try {
      const r = await listarNoticias(null);
      setItens(r.noticias);
      setCursor(r.proximoCursor);
      setAcabou(r.proximoCursor === null);
    } catch (e) {
      setErro(e instanceof ErroConta ? e.message : 'Não foi possível carregar as notícias.');
    } finally {
      setCarregando(false);
      setAtualizando(false);
    }
  }, []);

  useEffect(() => {
    void carregarInicial();
  }, [carregarInicial]);

  const carregarMais = useCallback(async () => {
    if (carregandoMais || acabou || cursor === null) return;
    setCarregandoMais(true);
    try {
      const r = await listarNoticias(cursor);
      // Evita duplicatas caso algo publique durante a rolagem.
      setItens((atual) => {
        const vistos = new Set(atual.map((n) => n.id));
        return [...atual, ...r.noticias.filter((n) => !vistos.has(n.id))];
      });
      setCursor(r.proximoCursor);
      setAcabou(r.proximoCursor === null);
    } catch {
      // Falha ao paginar não derruba a lista já carregada; tenta de novo ao rolar.
    } finally {
      setCarregandoMais(false);
    }
  }, [acabou, carregandoMais, cursor]);

  const aoAtualizar = useCallback(() => {
    setAtualizando(true);
    setAcabou(false);
    void carregarInicial();
  }, [carregarInicial]);

  if (carregando) {
    return (
      <Tela voltar rolavel={false} tituloCabecalho="Notícias">
        <View style={p.centro}>
          <ActivityIndicator color={c.primario} />
        </View>
      </Tela>
    );
  }

  if (erro && itens.length === 0) {
    return (
      <Tela voltar tituloCabecalho="Notícias">
        <Vazio
          icone="cloud-offline-outline"
          titulo="Sem conexão"
          descricao={erro}
        />
      </Tela>
    );
  }

  return (
    <Tela voltar rolavel={false} tituloCabecalho="Notícias">
      <FlatList
        data={itens}
        keyExtractor={(n) => n.id}
        contentContainerStyle={p.lista}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={atualizando} onRefresh={aoAtualizar} tintColor={c.primario} />
        }
        onEndReached={carregarMais}
        onEndReachedThreshold={0.4}
        ListEmptyComponent={
          <Vazio
            icone="newspaper-outline"
            titulo="Nenhuma notícia ainda"
            descricao="Quando houver novidades, elas aparecem aqui."
          />
        }
        ListFooterComponent={
          carregandoMais ? (
            <ActivityIndicator color={c.primario} style={{ marginVertical: espaco.lg }} />
          ) : acabou && itens.length > 0 ? (
            <Text style={p.fim}>• fim das notícias •</Text>
          ) : null
        }
        renderItem={({ item }) => (
          <CartaoNoticia
            noticia={item}
            aoTocar={() => router.push({ pathname: '/noticias/[id]', params: { id: item.id } })}
          />
        )}
      />
    </Tela>
  );
}

function CartaoNoticia({ noticia, aoTocar }: { noticia: Noticia; aoTocar: () => void }) {
  const p = useEstilos(folha);
  return (
    <Pressable
      onPress={aoTocar}
      style={({ pressed }) => [p.cartao, pressed ? { opacity: 0.7 } : null]}
    >
      {noticia.imagemUrl ? (
        <Image source={{ uri: noticia.imagemUrl }} style={p.imagem} resizeMode="cover" />
      ) : null}
      <View style={p.corpo}>
        {noticia.entidadeNome ? (
          <Text style={p.selo} numberOfLines={1}>
            ★ Exclusivo · {noticia.entidadeNome}
          </Text>
        ) : null}
        {noticia.publicadaEm ? (
          <Text style={p.data}>{formatarData(noticia.publicadaEm)}</Text>
        ) : null}
        <Text style={p.titulo} numberOfLines={2}>
          {noticia.titulo}
        </Text>
        {noticia.resumo ? (
          <Text style={p.resumo} numberOfLines={3}>
            {noticia.resumo}
          </Text>
        ) : null}
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
    imagem: { width: '100%', height: 160, backgroundColor: c.superficieAlta },
    corpo: { padding: espaco.lg },
    selo: { ...tipo.etiqueta, fontSize: 10, color: c.latao, marginBottom: 6 },
    data: { ...tipo.etiqueta, fontSize: 10, color: c.primario, marginBottom: 6 },
    titulo: { ...tipo.subtitulo, color: c.texto },
    resumo: { ...tipo.corpoPequeno, color: c.textoFraco, marginTop: 5 },
    fim: {
      ...tipo.legenda,
      color: c.textoFraco,
      textAlign: 'center',
      marginVertical: espaco.lg,
    },
  });
