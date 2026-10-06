import React, { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { espaco, raio, tipo, useCores, useEstilos, type Paleta } from '@/tema';
import { Secao } from '@/ui/base';
import { formatarData, listarNoticias } from './api';
import { registrarPresenca } from '@/push/presenca';
import type { Noticia } from './tipos';

const QUANTIDADE = 4;

/**
 * Resumo das últimas notícias no fim do Painel. É uma prévia: "Ver tudo" leva
 * à lista completa com rolagem infinita. Falha em silêncio (some) quando o app
 * está offline ou não há notícias — o Painel precisa funcionar sem rede.
 */
export function SecaoNoticiasPainel() {
  const p = useEstilos(folha);
  const [itens, setItens] = useState<Noticia[] | null>(null);

  useEffect(() => {
    let vivo = true;
    void registrarPresenca(); // renderizar notícias no painel conta como atividade
    listarNoticias(null, QUANTIDADE)
      .then((r) => vivo && setItens(r.noticias))
      .catch(() => vivo && setItens([]));
    return () => {
      vivo = false;
    };
  }, []);

  // Enquanto carrega (null) ou se não há nada para mostrar: não ocupa o Painel.
  if (!itens || itens.length === 0) return null;

  return (
    <Secao
      titulo="Notícias"
      acao={
        <Pressable onPress={() => router.push('/noticias')} hitSlop={10}>
          <Text style={p.verTudo}>Ver tudo</Text>
        </Pressable>
      }
    >
      <View style={{ gap: espaco.sm }}>
        {itens.map((n) => (
          <CartaoResumo
            key={n.id}
            noticia={n}
            aoTocar={() => router.push({ pathname: '/noticias/[id]', params: { id: n.id } })}
          />
        ))}
      </View>
    </Secao>
  );
}

function CartaoResumo({ noticia, aoTocar }: { noticia: Noticia; aoTocar: () => void }) {
  const c = useCores();
  const p = useEstilos(folha);
  return (
    <Pressable
      onPress={aoTocar}
      style={({ pressed }) => [p.cartao, pressed ? { opacity: 0.7 } : null]}
    >
      {noticia.imagemUrl ? (
        <Image source={{ uri: noticia.imagemUrl }} style={p.miniatura} resizeMode="cover" />
      ) : (
        <View style={[p.miniatura, p.miniaturaVazia]}>
          <Ionicons name="newspaper-outline" size={18} color={c.textoFraco} />
        </View>
      )}
      <View style={{ flex: 1 }}>
        {noticia.publicadaEm ? (
          <Text style={p.data}>{formatarData(noticia.publicadaEm)}</Text>
        ) : null}
        <Text style={p.titulo} numberOfLines={2}>
          {noticia.titulo}
        </Text>
        {noticia.resumo ? (
          <Text style={p.resumo} numberOfLines={1}>
            {noticia.resumo}
          </Text>
        ) : null}
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
      borderColor: c.borda,
    },
    data: { ...tipo.etiqueta, fontSize: 9, color: c.primario, marginBottom: 3 },
    titulo: { ...tipo.subtitulo, fontSize: 14, color: c.texto },
    resumo: { ...tipo.legenda, color: c.textoFraco, marginTop: 2 },
  });
