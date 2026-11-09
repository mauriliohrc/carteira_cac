import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { espaco, raio, tipo, useCores, useEstilos, type Paleta } from '@/tema';
import { Tela, Vazio } from '@/ui/base';
import { ErroConta } from '@/conta/api';
import { formatarData, linkPublicoNoticia, marcarNoticiaLida, obterNoticia } from '@/noticias/api';
import { CorpoHtml } from '@/noticias/CorpoHtml';
import type { Noticia } from '@/noticias/tipos';

/** Rota da notícia. Corpo em `DetalheNoticia`, reutilizado no painel (tablet). */
export default function RotaNoticia() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <DetalheNoticia id={id} />;
}

export function DetalheNoticia({ id, embutido }: { id: string; embutido?: boolean }) {
  const c = useCores();
  const p = useEstilos(folha);

  const [noticia, setNoticia] = useState<Noticia | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  async function compartilhar() {
    if (!noticia) return;
    const url = linkPublicoNoticia(noticia.id, noticia.titulo);
    try {
      await Share.share({ title: noticia.titulo, message: `${noticia.titulo}\n${url}`, url });
    } catch {
      /* usuário cancelou */
    }
  }

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const n = await obterNoticia(String(id));
        if (vivo) setNoticia(n);
        void marcarNoticiaLida(String(id)); // conta o leitor (best-effort)
      } catch (e) {
        if (vivo) {
          setErro(
            e instanceof ErroConta && e.offline
              ? 'Sem conexão para abrir a notícia.'
              : 'Notícia indisponível.'
          );
        }
      } finally {
        if (vivo) setCarregando(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [id]);

  const acaoCompartilhar = noticia ? (
    <Pressable
      onPress={compartilhar}
      accessibilityRole="button"
      accessibilityLabel="Compartilhar notícia"
      hitSlop={8}
    >
      <Ionicons name="share-outline" size={20} color={c.primario} />
    </Pressable>
  ) : null;

  // Painel master-detail (tablet): sem a moldura de Tela — o painel já é o frame.
  if (embutido) {
    return (
      <View style={{ flex: 1 }}>
        <View style={p.cabEmbutido}>
          <Text style={p.titEmbutido} numberOfLines={1}>
            Notícia
          </Text>
          {acaoCompartilhar}
        </View>
        {carregando ? (
          <View style={p.centro}>
            <ActivityIndicator color={c.primario} />
          </View>
        ) : erro || !noticia ? (
          <Vazio
            icone="newspaper-outline"
            titulo="Não foi possível abrir"
            descricao={erro ?? 'Notícia indisponível.'}
          />
        ) : (
          <ScrollView
            contentContainerStyle={{ padding: espaco.lg, paddingBottom: 110 }}
            showsVerticalScrollIndicator={false}
          >
            {noticia.imagemUrl ? (
              <Image source={{ uri: noticia.imagemUrl }} style={p.imagem} resizeMode="cover" />
            ) : null}
            {noticia.publicadaEm ? (
              <Text style={p.data}>{formatarData(noticia.publicadaEm)}</Text>
            ) : null}
            <Text style={p.titulo}>{noticia.titulo}</Text>
            {noticia.resumo ? <Text style={p.resumo}>{noticia.resumo}</Text> : null}
            <View style={{ marginTop: espaco.lg }}>
              <CorpoHtml html={noticia.conteudo} />
            </View>
          </ScrollView>
        )}
      </View>
    );
  }

  if (carregando) {
    return (
      <Tela voltar rolavel={false} tituloCabecalho="Notícia">
        <View style={p.centro}>
          <ActivityIndicator color={c.primario} />
        </View>
      </Tela>
    );
  }

  if (erro || !noticia) {
    return (
      <Tela voltar tituloCabecalho="Notícia">
        <Vazio
          icone="newspaper-outline"
          titulo="Não foi possível abrir"
          descricao={erro ?? 'Notícia indisponível.'}
        />
      </Tela>
    );
  }

  return (
    <Tela
      voltar
      tituloCabecalho="Notícia"
      acao={
        <Pressable
          onPress={compartilhar}
          accessibilityRole="button"
          accessibilityLabel="Compartilhar notícia"
          hitSlop={8}
        >
          <Ionicons name="share-outline" size={20} color={c.primario} />
        </Pressable>
      }
    >
      {noticia.imagemUrl ? (
        <Image source={{ uri: noticia.imagemUrl }} style={p.imagem} resizeMode="cover" />
      ) : null}
      {noticia.publicadaEm ? <Text style={p.data}>{formatarData(noticia.publicadaEm)}</Text> : null}
      <Text style={p.titulo}>{noticia.titulo}</Text>
      {noticia.resumo ? <Text style={p.resumo}>{noticia.resumo}</Text> : null}
      <View style={{ marginTop: espaco.lg }}>
        <CorpoHtml html={noticia.conteudo} />
      </View>
    </Tela>
  );
}

const folha = (c: Paleta) =>
  StyleSheet.create({
    centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    cabEmbutido: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: espaco.md,
      paddingHorizontal: espaco.lg,
      paddingVertical: espaco.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.borda,
    },
    titEmbutido: { ...tipo.titulo, fontSize: 17, color: c.texto, flex: 1 },
    imagem: {
      width: '100%',
      height: 200,
      borderRadius: raio.md,
      backgroundColor: c.superficieAlta,
      marginBottom: espaco.lg,
    },
    data: { ...tipo.etiqueta, fontSize: 10.5, color: c.primario, marginBottom: 8 },
    titulo: { ...tipo.telaTitulo, fontSize: 23, color: c.texto },
    resumo: {
      ...tipo.corpo,
      color: c.textoMedio,
      fontWeight: '600',
      marginTop: espaco.md,
    },
    conteudo: {
      ...tipo.corpo,
      color: c.texto,
      marginTop: espaco.lg,
      lineHeight: 23,
    },
  });
