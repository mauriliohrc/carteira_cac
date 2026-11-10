import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';

import { espaco, raio, tipo, useCores, useEstilos, type Paleta } from '@/tema';
import { Tela } from '@/ui/base';
import { avisar, confirmar, escolher } from '@/ui/dialogo';
import {
  bloquearNaConversa,
  denunciar,
  enviarMensagem,
  liberarContato,
  obterConversa,
} from '@/mercado/api';
import type { ConversaDetalhe, MensagemChat } from '@/mercado/tipos';

export default function Conversa() {
  const c = useCores();
  const p = useEstilos(folha);
  const { id } = useLocalSearchParams<{ id: string }>();

  const [conv, setConv] = useState<ConversaDetalhe | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const enviandoRef = useRef(false);

  const carregar = useCallback(async () => {
    if (!id || enviandoRef.current) return;
    try {
      const d = await obterConversa(id);
      setConv(d);
    } catch {
      /* mantém o que já tem */
    } finally {
      setCarregando(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void carregar();
      const t = setInterval(() => void carregar(), 5000); // polling do chat
      return () => clearInterval(t);
    }, [carregar])
  );

  const enviar = async () => {
    const t = texto.trim();
    if (!t || !id) return;
    setTexto('');
    setEnviando(true);
    enviandoRef.current = true;
    try {
      const msg = await enviarMensagem(id, t);
      setConv((cv) => (cv ? { ...cv, mensagens: [msg, ...cv.mensagens] } : cv));
    } catch (e) {
      setTexto(t);
      await avisar('Não enviou', 'Verifique sua conexão e tente de novo.');
    } finally {
      setEnviando(false);
      enviandoRef.current = false;
    }
  };

  const liberar = async () => {
    if (!id) return;
    const ok = await confirmar({
      titulo: 'Liberar seu telefone?',
      mensagem: 'O interessado verá seu número nesta conversa. Você faz isso por conta própria.',
      rotuloConfirmar: 'Liberar',
    });
    if (!ok) return;
    await liberarContato(id);
    await carregar();
  };

  const menu = () => {
    if (!id || !conv) return;
    const opcoes = [];
    if (conv.souVendedor && !conv.contatoLiberado)
      opcoes.push({ rotulo: 'Liberar meu contato', icone: 'call-outline' as const, acao: liberar });
    opcoes.push({
      rotulo: 'Denunciar',
      icone: 'flag-outline' as const,
      acao: async () => {
        await denunciar({ conversaId: id, motivo: 'Denúncia pelo chat' });
        await avisar('Denúncia enviada', 'Nossa equipe vai analisar. Obrigado.');
      },
    });
    opcoes.push({
      rotulo: 'Bloquear',
      icone: 'ban-outline' as const,
      destrutivo: true,
      acao: async () => {
        const ok = await confirmar({ titulo: 'Bloquear?', mensagem: 'Você não verá mais os anúncios dessa pessoa.', destrutivo: true, rotuloConfirmar: 'Bloquear' });
        if (ok) { await bloquearNaConversa(id); router.back(); }
      },
    });
    void escolher('Opções', 'O que deseja fazer?', opcoes);
  };

  const acaoCabecalho = (
    <Pressable onPress={menu} hitSlop={10}>
      <Ionicons name="ellipsis-vertical" size={20} color={c.texto} />
    </Pressable>
  );

  if (carregando) {
    return (
      <Tela voltar rolavel={false} tituloCabecalho="Conversa" acao={acaoCabecalho}>
        <View style={p.centro}><ActivityIndicator color={c.primario} /></View>
      </Tela>
    );
  }

  const tel = conv?.telefoneVendedor ?? null;

  return (
    <Tela voltar rolavel={false} tituloCabecalho={conv?.anuncio.titulo ?? 'Conversa'} acao={acaoCabecalho}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        {tel ? (
          <Pressable style={p.contato} onPress={() => Linking.openURL(`https://wa.me/55${tel.replace(/\D/g, '')}`)}>
            <Ionicons name="logo-whatsapp" size={16} color={c.primario} />
            <Text style={p.contatoTxt}>Contato liberado: {tel}</Text>
          </Pressable>
        ) : conv?.souVendedor === false ? (
          <View style={p.aguardando}>
            <Ionicons name="lock-closed-outline" size={14} color={c.textoFraco} />
            <Text style={p.aguardandoTxt}>O telefone aparece aqui se o vendedor liberar.</Text>
          </View>
        ) : null}

        <FlatList
          data={conv?.mensagens ?? []}
          keyExtractor={(m) => m.id}
          inverted
          contentContainerStyle={{ padding: espaco.lg, gap: espaco.sm }}
          renderItem={({ item }: { item: MensagemChat }) => (
            <View style={[p.bolha, item.meu ? p.minha : p.dela]}>
              <Text style={[p.bolhaTxt, item.meu ? { color: c.sobrePrimario } : { color: c.texto }]}>
                {item.texto}
              </Text>
            </View>
          )}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', marginTop: espaco.xl, transform: [{ scaleY: -1 }] }}>
              <Text style={p.vazio}>Diga olá e combine os detalhes com segurança.</Text>
            </View>
          }
        />

        <View style={p.barra}>
          <TextInput
            value={texto}
            onChangeText={setTexto}
            placeholder="Mensagem…"
            placeholderTextColor={c.textoFraco}
            style={p.input}
            multiline
            maxLength={2000}
          />
          <Pressable style={[p.enviar, { opacity: texto.trim() && !enviando ? 1 : 0.4 }]} onPress={enviar} disabled={!texto.trim() || enviando}>
            <Ionicons name="send" size={18} color={c.sobrePrimario} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Tela>
  );
}

const folha = (c: Paleta) =>
  StyleSheet.create({
    centro: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    contato: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: espaco.sm,
      backgroundColor: c.primarioFraco,
      paddingHorizontal: espaco.lg,
      paddingVertical: espaco.sm,
    },
    contatoTxt: { ...tipo.corpoPequeno, color: c.primario, fontWeight: '600' },
    aguardando: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: espaco.sm,
      backgroundColor: c.superficieAlta,
      paddingHorizontal: espaco.lg,
      paddingVertical: espaco.sm,
    },
    aguardandoTxt: { ...tipo.legenda, color: c.textoFraco },
    bolha: { maxWidth: '82%', borderRadius: raio.md, paddingHorizontal: espaco.md, paddingVertical: 9 },
    minha: { alignSelf: 'flex-end', backgroundColor: c.primario, borderBottomRightRadius: 4 },
    dela: { alignSelf: 'flex-start', backgroundColor: c.superficieAlta, borderBottomLeftRadius: 4 },
    bolhaTxt: { ...tipo.corpo, fontSize: 14.5 },
    vazio: { ...tipo.legenda, color: c.textoFraco },
    barra: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: espaco.sm,
      paddingHorizontal: espaco.md,
      paddingVertical: espaco.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.borda,
      backgroundColor: c.superficie,
    },
    input: {
      flex: 1,
      maxHeight: 120,
      backgroundColor: c.superficieAlta,
      borderRadius: raio.md,
      paddingHorizontal: espaco.md,
      paddingVertical: 10,
      color: c.texto,
      fontSize: 15,
    },
    enviar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: c.primario,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
