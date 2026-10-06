import React, { useRef, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { espaco, raio, tipo, useCores, useEstilos, type Paleta } from '@/tema';
import { pedirPermissao } from '@/notificacoes';
import { Botao } from './base';

interface Passo {
  chave: string;
  icone: keyof typeof Ionicons.glyphMap;
  titulo: string;
  descricao: string;
  /** Legenda curta abaixo do botão, quando o passo pede uma permissão. */
  nota?: string;
  /** Rótulo do botão principal. Sem permissão, é só "avançar". */
  acao: string;
  /** Roda ao tocar no botão principal. Ausente = passo puramente informativo. */
  permissao?: () => Promise<unknown>;
}

const PASSOS: Passo[] = [
  {
    chave: 'boas-vindas',
    icone: 'shield-checkmark',
    titulo: 'Sua carteira de CAC,\nsempre em ordem',
    descricao:
      'Armas, CRAF, guias de tráfego, laudos e CR num só lugar — no seu bolso, sem depender de papel.',
    acao: 'Começar',
  },
  {
    chave: 'avisos',
    icone: 'notifications',
    titulo: 'Nunca perca\num vencimento',
    descricao:
      'O app acompanha cada validade e te avisa todo dia no último mês antes do vencimento. Para isso, precisa mandar notificações.',
    nota: 'Você pode mudar isso depois nos ajustes do celular.',
    acao: 'Ativar avisos',
    permissao: pedirPermissao,
  },
  {
    chave: 'documentos',
    icone: 'images',
    titulo: 'Seus documentos\nà mão',
    descricao:
      'Anexe o CRAF, a guia ou o laudo como foto ou PDF. Você escolhe a imagem pelo seletor do próprio celular, sem dar acesso a toda a galeria.',
    nota: 'A câmera é pedida só quando você for fotografar um documento.',
    acao: 'Entendi',
  },
];

export function Onboarding({ aoConcluir }: { aoConcluir: () => Promise<void> | void }) {
  const c = useCores();
  const e = useEstilos(folha);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const scroll = useRef<ScrollView>(null);
  const [indice, setIndice] = useState(0);
  const [ocupado, setOcupado] = useState(false);

  const ultimo = indice === PASSOS.length - 1;
  const passo = PASSOS[indice];

  const irPara = (n: number) => {
    scroll.current?.scrollTo({ x: width * n, animated: true });
    setIndice(n);
  };

  const aoRolar = (ev: NativeSyntheticEvent<NativeScrollEvent>) => {
    const n = Math.round(ev.nativeEvent.contentOffset.x / width);
    if (n !== indice) setIndice(n);
  };

  const avancar = () => {
    // Fim dos passos de permissão: entra direto no app. Não sugerimos criar um
    // PIN aqui — quem quiser bloqueio define depois em Ajustes › Segurança.
    if (ultimo) void aoConcluir();
    else irPara(indice + 1);
  };

  // Botão principal: dispara a permissão do passo (se houver) e segue adiante.
  // Conceder ou não conceder leva ao mesmo lugar — a escolha é do usuário, e o
  // app pede de novo, em contexto, quando a função realmente for usada.
  const aoTocarPrincipal = async () => {
    if (!passo.permissao) {
      avancar();
      return;
    }
    setOcupado(true);
    try {
      await passo.permissao();
    } catch {
      // Uma permissão negada não é erro: seguimos mesmo assim.
    } finally {
      setOcupado(false);
    }
    avancar();
  };

  return (
    <View style={[e.raiz, { paddingTop: insets.top }]}>
      {/* Topo: marca à esquerda, escape à direita. */}
      <View style={e.topo}>
        <Text style={e.marca}>CARTEIRA CAC</Text>
        {ultimo ? (
          <View style={{ width: 44 }} />
        ) : (
          <Pressable
            hitSlop={12}
            onPress={() => void aoConcluir()}
            accessibilityRole="button"
          >
            <Text style={e.pular}>Pular</Text>
          </Pressable>
        )}
      </View>

      <ScrollView
        ref={scroll}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={aoRolar}
        keyboardShouldPersistTaps="handled"
      >
        {PASSOS.map((p) => (
          <View key={p.chave} style={[e.slide, { width }]}>
            {p.chave === 'boas-vindas' ? (
              <Image
                source={require('../../assets/logo.png')}
                style={e.logo}
                resizeMode="contain"
                accessibilityLabel="Carteira CAC"
              />
            ) : (
              <View style={e.emblema}>
                <Ionicons name={p.icone} size={40} color={c.primario} />
              </View>
            )}
            <Text style={e.titulo}>{p.titulo}</Text>
            <Text style={e.descricao}>{p.descricao}</Text>
          </View>
        ))}
      </ScrollView>

      {/* Rodapé fixo: pontos de progresso + ação do passo atual. */}
      <View style={[e.rodape, { paddingBottom: insets.bottom + espaco.lg }]}>
        <View style={e.pontos}>
          {PASSOS.map((p, i) => (
            <View key={p.chave} style={[e.ponto, i === indice ? e.pontoAtivo : null]} />
          ))}
        </View>

        {passo.nota ? <Text style={e.nota}>{passo.nota}</Text> : null}

        <Botao
          titulo={passo.acao}
          icone={ultimo ? 'checkmark' : undefined}
          aoTocar={() => void aoTocarPrincipal()}
          carregando={ocupado}
          estilo={{ alignSelf: 'stretch' }}
        />

        {/* Passos de permissão trazem uma saída discreta que não concede nada. */}
        {passo.permissao ? (
          <Pressable
            hitSlop={8}
            onPress={avancar}
            disabled={ocupado}
            style={e.saidaDiscreta}
            accessibilityRole="button"
          >
            <Text style={e.saidaDiscretaTexto}>Agora não</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const folha = (c: Paleta) =>
  StyleSheet.create({
    raiz: { flex: 1, backgroundColor: c.fundo },

    topo: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: espaco.lg,
      paddingTop: espaco.md,
      paddingBottom: espaco.sm,
    },
    marca: { ...tipo.marca, color: c.texto },
    pular: { ...tipo.subtitulo, color: c.textoFraco },

    slide: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: espaco.xl,
      paddingBottom: espaco.xxl,
    },
    emblema: {
      width: 92,
      height: 92,
      borderRadius: raio.lg,
      backgroundColor: c.primarioFraco,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: `${c.primario}55`,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: espaco.xl,
    },
    logo: {
      width: 108,
      height: 108,
      marginBottom: espaco.xl,
    },
    titulo: {
      ...tipo.telaTitulo,
      color: c.texto,
      textAlign: 'center',
      lineHeight: 32,
    },
    descricao: {
      ...tipo.corpo,
      fontSize: 15,
      lineHeight: 22,
      color: c.textoMedio,
      textAlign: 'center',
      marginTop: espaco.md,
      maxWidth: 330,
    },

    rodape: {
      paddingHorizontal: espaco.lg,
      paddingTop: espaco.lg,
      gap: espaco.md,
    },
    pontos: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 7,
      marginBottom: espaco.xs,
    },
    ponto: {
      width: 7,
      height: 7,
      borderRadius: raio.pill,
      backgroundColor: c.borda,
    },
    pontoAtivo: { backgroundColor: c.primario, width: 22 },

    nota: {
      ...tipo.legenda,
      color: c.textoFraco,
      textAlign: 'center',
      maxWidth: 320,
      alignSelf: 'center',
    },

    saidaDiscreta: { alignItems: 'center', paddingVertical: espaco.sm },
    saidaDiscretaTexto: { ...tipo.subtitulo, color: c.textoFraco },
  });
