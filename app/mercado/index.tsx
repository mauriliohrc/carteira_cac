import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { espaco, raio, tipo, useCores, useEstilos, type Paleta } from '@/tema';
import { Botao, Tela, Vazio } from '@/ui/base';
import { ErroConta } from '@/conta/api';
import {
  formatarPreco,
  listarAnuncios,
  obterCatalogo,
  type FiltrosMercado,
} from '@/mercado/api';
import type { Anuncio, CategoriaMarket } from '@/mercado/tipos';

export default function Mercado() {
  const c = useCores();
  const p = useEstilos(folha);

  const [categorias, setCategorias] = useState<CategoriaMarket[]>([]);
  const [catSel, setCatSel] = useState<string | null>(null);

  const [itens, setItens] = useState<Anuncio[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [acabou, setAcabou] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [carregandoMais, setCarregandoMais] = useState(false);
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    void obterCatalogo()
      .then((cat) => setCategorias(cat.categorias))
      .catch(() => setCategorias([]));
  }, []);

  const filtros: FiltrosMercado = catSel ? { categoria: catSel } : {};

  const carregarInicial = useCallback(async () => {
    setErro(null);
    try {
      const r = await listarAnuncios(null, catSel ? { categoria: catSel } : {});
      setItens(r.anuncios);
      setCursor(r.proximoCursor);
      setAcabou(r.proximoCursor === null);
    } catch (e) {
      setErro(e instanceof ErroConta ? e.message : 'Não foi possível carregar o mercado.');
    } finally {
      setCarregando(false);
      setAtualizando(false);
    }
  }, [catSel]);

  useEffect(() => {
    setCarregando(true);
    void carregarInicial();
  }, [carregarInicial]);

  const carregarMais = useCallback(async () => {
    if (carregandoMais || acabou || cursor === null) return;
    setCarregandoMais(true);
    try {
      const r = await listarAnuncios(cursor, catSel ? { categoria: catSel } : {});
      setItens((atual) => {
        const vistos = new Set(atual.map((a) => a.id));
        return [...atual, ...r.anuncios.filter((a) => !vistos.has(a.id))];
      });
      setCursor(r.proximoCursor);
      setAcabou(r.proximoCursor === null);
    } catch {
      /* paginação best-effort */
    } finally {
      setCarregandoMais(false);
    }
  }, [acabou, carregandoMais, cursor, catSel]);

  const aoAtualizar = useCallback(() => {
    setAtualizando(true);
    setAcabou(false);
    void carregarInicial();
  }, [carregarInicial]);

  const barraTopo = (
    <View style={p.topo}>
      <Botao titulo="Anunciar" icone="add" compacto aoTocar={() => router.push('/mercado/novo')} />
      <Botao
        titulo="Meus anúncios"
        variante="secundario"
        icone="pricetags-outline"
        compacto
        aoTocar={() => router.push('/mercado/meus')}
      />
    </View>
  );

  const filtroCategorias = (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={p.chips}
      style={{ flexGrow: 0 }}
    >
      <Chip rotulo="Tudo" ativo={catSel === null} aoTocar={() => setCatSel(null)} />
      {categorias.map((cat) => (
        <Chip key={cat.valor} rotulo={cat.rotulo} ativo={catSel === cat.valor} aoTocar={() => setCatSel(cat.valor)} />
      ))}
    </ScrollView>
  );

  if (carregando) {
    return (
      <Tela voltar rolavel={false} tituloCabecalho="Mercado">
        {barraTopo}
        {filtroCategorias}
        <View style={p.centro}>
          <ActivityIndicator color={c.primario} />
        </View>
      </Tela>
    );
  }

  return (
    <Tela
      voltar
      rolavel={false}
      tituloCabecalho="Mercado"
      acao={
        <Pressable onPress={() => router.push('/mercado/conversas')} hitSlop={10}>
          <Ionicons name="chatbubbles-outline" size={22} color={c.texto} />
        </Pressable>
      }
    >
      {barraTopo}
      {filtroCategorias}
      <FlatList
        data={itens}
        keyExtractor={(a) => a.id}
        numColumns={2}
        columnWrapperStyle={{ gap: espaco.md, paddingHorizontal: espaco.lg }}
        contentContainerStyle={p.lista}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={atualizando} onRefresh={aoAtualizar} tintColor={c.primario} />
        }
        onEndReached={carregarMais}
        onEndReachedThreshold={0.4}
        ListEmptyComponent={
          erro ? (
            <Vazio icone="cloud-offline-outline" titulo="Ops" descricao={erro} />
          ) : (
            <Vazio
              icone="pricetags-outline"
              titulo="Nada por aqui ainda"
              descricao="Seja o primeiro a anunciar um acessório nesta categoria."
            />
          )
        }
        ListFooterComponent={
          carregandoMais ? (
            <ActivityIndicator color={c.primario} style={{ marginVertical: espaco.lg }} />
          ) : null
        }
        renderItem={({ item }) => <CartaoAnuncio anuncio={item} />}
      />
    </Tela>
  );
}

function Chip({ rotulo, ativo, aoTocar }: { rotulo: string; ativo: boolean; aoTocar: () => void }) {
  const c = useCores();
  const p = useEstilos(folha);
  return (
    <Pressable
      onPress={aoTocar}
      style={[p.chip, ativo ? { backgroundColor: c.primario, borderColor: c.primario } : null]}
    >
      <Text style={[p.chipTexto, ativo ? { color: c.sobrePrimario } : null]}>{rotulo}</Text>
    </Pressable>
  );
}

function CartaoAnuncio({ anuncio: a }: { anuncio: Anuncio }) {
  const c = useCores();
  const p = useEstilos(folha);
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/mercado/[id]', params: { id: a.id } })}
      style={({ pressed }) => [p.cartao, pressed ? { opacity: 0.7 } : null]}
    >
      <View style={p.fotoCaixa}>
        {a.fotos[0] ? (
          <Image source={{ uri: a.fotos[0] }} style={p.foto} resizeMode="cover" />
        ) : (
          <Ionicons name="image-outline" size={28} color={c.textoFraco} />
        )}
        {a.destacado ? (
          <View style={p.destaque}>
            <Ionicons name="star" size={10} color={c.sobrePrimario} />
            <Text style={p.destaqueTxt}>Destaque</Text>
          </View>
        ) : null}
      </View>
      <View style={p.corpo}>
        <Text style={p.preco}>{formatarPreco(a.precoCentavos)}</Text>
        <Text style={p.titulo} numberOfLines={2}>
          {a.titulo}
        </Text>
        <Text style={p.meta} numberOfLines={1}>
          {a.cidade}/{a.uf}
          {a.loja ? ` · ${a.loja.nome}${a.loja.verificada ? ' ✓' : ''}` : ''}
        </Text>
      </View>
    </Pressable>
  );
}

const folha = (c: Paleta) =>
  StyleSheet.create({
    centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    topo: { flexDirection: 'row', gap: espaco.sm, paddingHorizontal: espaco.lg, paddingBottom: espaco.md },
    chips: { gap: espaco.sm, paddingHorizontal: espaco.lg, paddingBottom: espaco.md },
    chip: {
      paddingHorizontal: espaco.md,
      paddingVertical: 7,
      borderRadius: 999,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.borda,
      backgroundColor: c.superficie,
    },
    chipTexto: { fontSize: 12.5, fontWeight: '600', color: c.textoMedio },
    lista: { paddingBottom: 48, gap: espaco.md },
    cartao: {
      flex: 1,
      backgroundColor: c.superficie,
      borderRadius: raio.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.borda,
      overflow: 'hidden',
    },
    fotoCaixa: {
      height: 130,
      backgroundColor: c.superficieAlta,
      alignItems: 'center',
      justifyContent: 'center',
    },
    foto: { width: '100%', height: '100%' },
    destaque: {
      position: 'absolute',
      top: espaco.sm,
      left: espaco.sm,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      backgroundColor: c.primario,
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderRadius: 999,
    },
    destaqueTxt: { fontSize: 9.5, fontWeight: '700', color: c.sobrePrimario },
    corpo: { padding: espaco.md, gap: 3 },
    preco: { ...tipo.subtitulo, fontSize: 15, color: c.texto },
    titulo: { ...tipo.corpoPequeno, color: c.textoMedio },
    meta: { ...tipo.legenda, fontSize: 11, color: c.textoFraco },
  });
