import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { espaco, raio, tipo, useCores, useEstilos, type Paleta } from '@/tema';
import { Tela, Vazio } from '@/ui/base';
import { ErroConta } from '@/conta/api';
import { formatarData, marcarNoticiaLida, obterNoticia } from '@/noticias/api';
import { CorpoHtml } from '@/noticias/CorpoHtml';
import type { Noticia } from '@/noticias/tipos';

export default function DetalheNoticia() {
  const c = useCores();
  const p = useEstilos(folha);
  const { id } = useLocalSearchParams<{ id: string }>();

  const [noticia, setNoticia] = useState<Noticia | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

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
    <Tela voltar tituloCabecalho="Notícia">
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
