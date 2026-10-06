import React, { useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { espaco, raio, tipo, useCores, useEstilos, type Paleta } from '@/tema';
import { useApp } from '@/estado/AppContext';
import { Botao, Tela } from '@/ui/base';
import { avisar } from '@/ui/dialogo';
import { resgatarCodigo } from '@/billing';

const FIGURINHA = require('../assets/liberou-geral.png');

export default function Resgatar() {
  const c = useCores();
  const s = useEstilos(folha);
  const { premium } = useApp();

  const [codigo, setCodigo] = useState('');
  const [focado, setFocado] = useState(false);
  const [processando, setProcessando] = useState(false);
  const [mostrarEgg, setMostrarEgg] = useState(false);

  const liberar = async () => {
    setProcessando(true);
    try {
      const r = await resgatarCodigo(codigo);
      if (r.ok && r.easterEgg) {
        // Easter egg: a figurinha do "Liberou geral!".
        setMostrarEgg(true);
      } else if (r.ok) {
        avisar('Premium liberado', r.descricao || 'Acervo ilimitado ativado neste aparelho. Aproveite!');
        router.back();
      } else if (r.offline) {
        avisar('Sem conexão', 'Conecte-se à internet para validar o cupom.');
      } else {
        avisar('Código inválido', 'Confira o código ou peça um novo.');
      }
    } finally {
      setProcessando(false);
    }
  };

  const fecharEgg = () => {
    setMostrarEgg(false);
    router.back();
  };

  return (
    <Tela voltar tituloCabecalho="Código" teclado estilo={s.conteudo}>
      <View style={s.emblema}>
        <Ionicons name={premium ? 'gift' : 'gift-outline'} size={24} color={c.latao} />
      </View>
      <Text style={s.titulo}>Código promocional</Text>

      {premium ? (
        <>
          <Text style={s.subtitulo}>Seu Premium já está ativo neste aparelho. Bom uso!</Text>
          <Botao
            titulo="Voltar"
            icone="arrow-back"
            aoTocar={() => router.back()}
            estilo={{ alignSelf: 'stretch', marginTop: espaco.xl }}
          />
        </>
      ) : (
        <>
          <Text style={s.subtitulo}>
            Tem um código de liberação? Digite abaixo para ativar o acervo ilimitado — sem passar
            pela loja.
          </Text>

          <View style={[s.input, focado ? s.inputFocado : null]}>
            <Ionicons name="pricetag-outline" size={16} color={c.textoFraco} />
            <TextInput
              style={s.inputInterno}
              value={codigo}
              onChangeText={setCodigo}
              onFocus={() => setFocado(true)}
              onBlur={() => setFocado(false)}
              placeholder="Digite o código"
              placeholderTextColor={c.textoFraco}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={() => void liberar()}
            />
          </View>

          <Botao
            titulo="Liberar Premium"
            icone="checkmark-circle"
            aoTocar={() => void liberar()}
            carregando={processando}
            desabilitado={!codigo.trim()}
            estilo={{ alignSelf: 'stretch', marginTop: espaco.md }}
          />
        </>
      )}

      <Modal
        visible={mostrarEgg}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={fecharEgg}
      >
        <View style={s.eggFundo}>
          <View style={s.eggCartao}>
            <Image source={FIGURINHA} style={s.eggImg} resizeMode="contain" />
            <Text style={s.eggTitulo}>Premium liberado!</Text>
            <Text style={s.eggSub}>Acervo ilimitado ativado neste aparelho. Aproveite!</Text>
            <Botao
              titulo="Aproveitar"
              icone="rocket-outline"
              aoTocar={fecharEgg}
              estilo={{ alignSelf: 'stretch', marginTop: espaco.md }}
            />
          </View>
        </View>
      </Modal>
    </Tela>
  );
}

const folha = (c: Paleta) =>
  StyleSheet.create({
    conteudo: { alignItems: 'center', paddingHorizontal: espaco.lg },
    emblema: {
      width: 56,
      height: 56,
      borderRadius: raio.md,
      backgroundColor: c.lataoFraco,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: `${c.latao}88`,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: espaco.lg,
    },
    titulo: { ...tipo.telaTitulo, fontSize: 22, color: c.texto, textAlign: 'center' },
    subtitulo: {
      ...tipo.corpoPequeno,
      color: c.textoMedio,
      textAlign: 'center',
      marginTop: espaco.sm,
      marginBottom: espaco.lg,
      maxWidth: 320,
    },
    input: {
      alignSelf: 'stretch',
      flexDirection: 'row',
      alignItems: 'center',
      gap: espaco.sm,
      backgroundColor: c.nome === 'claro' ? c.superficieAlta : c.superficie,
      borderWidth: 1,
      borderColor: c.borda,
      borderRadius: raio.sm,
      paddingHorizontal: espaco.md,
      minHeight: 48,
    },
    inputFocado: { borderColor: c.primario },
    inputInterno: { flex: 1, fontSize: 16, color: c.texto, paddingVertical: 12 },

    eggFundo: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: espaco.lg,
      backgroundColor: 'rgba(0,0,0,0.78)',
    },
    eggCartao: {
      width: '100%',
      maxWidth: 360,
      backgroundColor: c.superficie,
      borderRadius: raio.lg,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: `${c.latao}88`,
      padding: espaco.lg,
      alignItems: 'center',
    },
    eggImg: {
      width: '100%',
      aspectRatio: 1,
      borderRadius: raio.md,
      marginBottom: espaco.lg,
    },
    eggTitulo: { ...tipo.titulo, color: c.latao, textAlign: 'center' },
    eggSub: {
      ...tipo.corpoPequeno,
      color: c.textoMedio,
      textAlign: 'center',
      marginTop: espaco.sm,
    },
  });
