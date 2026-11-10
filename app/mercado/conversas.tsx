import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';

import { espaco, raio, tipo, useCores, useEstilos, type Paleta } from '@/tema';
import { Tela, Vazio } from '@/ui/base';
import { listarConversas } from '@/mercado/api';
import type { ConversaResumo } from '@/mercado/tipos';

function tempoCurto(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export default function Conversas() {
  const c = useCores();
  const p = useEstilos(folha);
  const [itens, setItens] = useState<ConversaResumo[]>([]);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    try {
      setItens(await listarConversas());
    } catch {
      setItens([]);
    } finally {
      setCarregando(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void carregar();
      const t = setInterval(() => void carregar(), 8000);
      return () => clearInterval(t);
    }, [carregar])
  );

  if (carregando) {
    return (
      <Tela voltar rolavel={false} tituloCabecalho="Conversas">
        <View style={p.centro}><ActivityIndicator color={c.primario} /></View>
      </Tela>
    );
  }

  return (
    <Tela voltar tituloCabecalho="Conversas" aoAtualizar={carregar}>
      {itens.length === 0 ? (
        <Vazio icone="chatbubbles-outline" titulo="Nenhuma conversa" descricao="Quando alguém se interessar ou você falar com um vendedor, aparece aqui." />
      ) : (
        <View style={{ paddingHorizontal: espaco.lg, gap: espaco.sm }}>
          {itens.map((conv) => (
            <Pressable
              key={conv.id}
              style={p.cartao}
              onPress={() => router.push({ pathname: '/mercado/conversa/[id]', params: { id: conv.id } })}
            >
              {conv.anuncio.foto ? (
                <Image source={{ uri: conv.anuncio.foto }} style={p.foto} />
              ) : (
                <View style={[p.foto, { alignItems: 'center', justifyContent: 'center' }]}>
                  <Ionicons name="image-outline" size={18} color={c.textoFraco} />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={p.titulo} numberOfLines={1}>{conv.anuncio.titulo}</Text>
                <Text style={p.quem}>
                  {conv.souVendedor ? 'Interessado' : 'Vendedor'}: {conv.outro.primeiroNome}
                </Text>
                <Text style={p.ultima} numberOfLines={1}>
                  {conv.ultimaMensagem ? `${conv.ultimaMensagem.meu ? 'Você: ' : ''}${conv.ultimaMensagem.texto}` : 'Conversa iniciada'}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end', gap: 6 }}>
                <Text style={p.tempo}>{tempoCurto(conv.atualizadoEm)}</Text>
                {conv.naoLidas > 0 ? (
                  <View style={p.badge}><Text style={p.badgeTxt}>{conv.naoLidas}</Text></View>
                ) : null}
              </View>
            </Pressable>
          ))}
        </View>
      )}
    </Tela>
  );
}

const folha = (c: Paleta) =>
  StyleSheet.create({
    centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },
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
    foto: { width: 48, height: 48, borderRadius: raio.sm, backgroundColor: c.superficieAlta },
    titulo: { ...tipo.subtitulo, fontSize: 14, color: c.texto },
    quem: { ...tipo.legenda, color: c.primario, marginTop: 1 },
    ultima: { ...tipo.legenda, color: c.textoFraco, marginTop: 2 },
    tempo: { ...tipo.legenda, fontSize: 10, color: c.textoFraco },
    badge: { backgroundColor: c.primario, borderRadius: 999, minWidth: 20, paddingHorizontal: 6, paddingVertical: 2, alignItems: 'center' },
    badgeTxt: { fontSize: 11, fontWeight: '700', color: c.sobrePrimario },
  });
