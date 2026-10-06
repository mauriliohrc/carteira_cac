import React, { useState } from 'react';
import {
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';

import { espaco, raio, tipo, useCores, useEstilos, type Paleta } from '@/tema';
import { Botao } from '@/ui/base';
import { Cabecalho } from '@/ui/Cabecalho';
import { LeitorPdf } from '@/ui/LeitorPdf';
import { abrirNoSistema, compartilhar } from '@/arquivos/cofre';
import type { Arquivo } from '@/domain/tipos';

export default function Visualizador() {
  const { uri, nome, mime } = useLocalSearchParams<{
    uri: string;
    nome: string;
    mime?: string;
  }>();
  const c = useCores();
  const v = useEstilos(folha);
  const [falhou, setFalhou] = useState(false);

  const ehPdf = (mime ?? '').includes('pdf') || nome?.toLowerCase().endsWith('.pdf');
  const ehImagem = (mime ?? '').startsWith('image/') || /\.(jpe?g|png|heic|webp|gif)$/i.test(nome ?? '');

  const arquivo = { id: '', documentoId: '', nome, uri, mime: mime ?? null, tamanho: null, criadoEm: '' } as Arquivo;

  const barra = (
    <Cabecalho
      voltar
      titulo={nome}
      acao={
        <Pressable onPress={() => void compartilhar(arquivo)} hitSlop={12}>
          <Ionicons name="share-outline" size={20} color={c.primario} />
        </Pressable>
      }
    />
  );

  if (ehImagem) {
    return (
      <View style={{ flex: 1, backgroundColor: c.leitor }}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={v.centro}
          maximumZoomScale={4}
          minimumZoomScale={1}
        >
          <Image source={{ uri }} style={v.imagem} resizeMode="contain" />
        </ScrollView>
        {barra}
      </View>
    );
  }

  // iOS e navegador renderizam PDF inline (WebView / iframe). No Android o
  // caminho confiável é entregar ao visualizador do sistema.
  if (ehPdf && Platform.OS !== 'android' && !falhou) {
    return (
      <View style={{ flex: 1 }}>
        <LeitorPdf uri={uri} aoFalhar={() => setFalhou(true)} />
        {barra}
      </View>
    );
  }

  return (
    <View style={[v.centro, { flex: 1, backgroundColor: c.fundo, padding: espaco.xl }]}>
      {barra}
      <View style={v.icone}>
        <Ionicons name={ehPdf ? 'document-text-outline' : 'document-outline'} size={28} color={c.primario} />
      </View>
      <Text style={v.nome} numberOfLines={2}>
        {nome}
      </Text>
      <Text style={v.descricao}>
        {ehPdf
          ? 'Abra no leitor de PDF do seu aparelho ou compartilhe o arquivo.'
          : 'Este formato abre no app do sistema.'}
      </Text>
      <Botao
        titulo="Abrir no aparelho"
        icone="open-outline"
        aoTocar={() => void abrirNoSistema(arquivo)}
        estilo={{ marginTop: espaco.xl, alignSelf: 'stretch' }}
      />
      <Botao
        titulo="Compartilhar"
        icone="share-outline"
        variante="secundario"
        aoTocar={() => void compartilhar(arquivo)}
        estilo={{ marginTop: espaco.md, alignSelf: 'stretch' }}
      />
    </View>
  );
}

const folha = (c: Paleta) =>
  StyleSheet.create({
    centro: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
    imagem: { width: '100%', height: '100%', minHeight: 500 },
    icone: {
      width: 58,
      height: 58,
      borderRadius: raio.sm,
      backgroundColor: c.primarioFraco,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: `${c.primario}55`,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: espaco.lg,
    },
    nome: { ...tipo.subtitulo, color: c.texto, textAlign: 'center' },
    descricao: {
      ...tipo.corpoPequeno,
      color: c.textoFraco,
      textAlign: 'center',
      marginTop: 7,
      maxWidth: 300,
    },
  });
