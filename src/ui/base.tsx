import React from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { KeyboardAvoidingView, Platform } from 'react-native';

import { espaco, MONO, raio, tipo, useCores, useEstilos, type Paleta } from '@/tema';
import { useFolgaBarra } from './BarraAbas';
import { Cabecalho, useFolgaCabecalho } from './Cabecalho';

// ------------------------------------------------------------------- layout

export function Tela({
  children,
  rolavel = true,
  estilo,
  sobBarra,
  voltar,
  acao,
  tituloCabecalho,
  semCabecalho,
  teclado,
  aoAtualizar,
}: {
  children: React.ReactNode;
  rolavel?: boolean;
  estilo?: StyleProp<ViewStyle>;
  /** Telas de aba: reserva o rodapé para a barra de vidro flutuante. */
  sobBarra?: boolean;
  /** Telas empilhadas: mostra o botão de retorno no cabeçalho. */
  voltar?: boolean;
  /** Canto direito do cabeçalho. */
  acao?: React.ReactNode;
  /** Subtítulo discreto sob a marca. */
  tituloCabecalho?: string;
  semCabecalho?: boolean;
  /** Formulários: afasta o conteúdo do teclado. */
  teclado?: boolean;
  /** Habilita "puxar para atualizar" na tela rolável. */
  aoAtualizar?: () => Promise<void> | void;
}) {
  const c = useCores();
  const e = useEstilos(folha);
  const folgaBarra = useFolgaBarra();
  const folgaCabecalho = useFolgaCabecalho();
  const [atualizando, setAtualizando] = React.useState(false);

  const topo = semCabecalho ? espaco.lg : folgaCabecalho;
  const rodape = sobBarra ? folgaBarra : 48;

  const puxarParaAtualizar = React.useCallback(async () => {
    if (!aoAtualizar) return;
    setAtualizando(true);
    try {
      await aoAtualizar();
    } finally {
      setAtualizando(false);
    }
  }, [aoAtualizar]);

  const conteudo = rolavel ? (
    <ScrollView
      contentContainerStyle={[
        { paddingHorizontal: espaco.lg, paddingTop: topo, paddingBottom: rodape },
        estilo,
      ]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      // Garante o gesto de "puxar para atualizar" mesmo com conteúdo curto.
      alwaysBounceVertical={!!aoAtualizar}
      refreshControl={
        aoAtualizar ? (
          <RefreshControl
            refreshing={atualizando}
            onRefresh={puxarParaAtualizar}
            tintColor={c.primario}
            // Puxa a partir do topo do conteúdo, abaixo do cabeçalho flutuante.
            progressViewOffset={semCabecalho ? 0 : folgaCabecalho}
          />
        ) : undefined
      }
      // Cabeçalho e barra flutuam sobre a lista; sem estes recuos o indicador
      // de rolagem corre por baixo deles.
      scrollIndicatorInsets={{
        top: semCabecalho ? 0 : folgaCabecalho - espaco.md,
        bottom: sobBarra ? folgaBarra - 24 : 0,
      }}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[{ flex: 1, paddingTop: topo }, estilo]}>{children}</View>
  );

  const corpo = teclado ? (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {conteudo}
    </KeyboardAvoidingView>
  ) : (
    conteudo
  );

  return (
    <View style={e.tela}>
      {corpo}
      {semCabecalho ? null : (
        <Cabecalho voltar={voltar} acao={acao} titulo={tituloCabecalho} />
      )}
    </View>
  );
}

/**
 * Cabeçalho de seção em "carimbo": fio de cabelo curto à esquerda e rótulo em
 * caixa alta com entreletra larga, como campo de formulário militar.
 */
export function Secao({
  titulo,
  acao,
  children,
  estilo,
}: {
  titulo: string;
  acao?: React.ReactNode;
  children?: React.ReactNode;
  estilo?: StyleProp<ViewStyle>;
}) {
  const e = useEstilos(folha);
  return (
    <View style={[{ marginTop: espaco.xl }, estilo]}>
      <View style={e.linhaSecao}>
        <View style={e.tracoSecao} />
        <Text style={e.carimbo}>{titulo.toUpperCase()}</Text>
        <View style={e.fioSecao} />
        {acao}
      </View>
      {children}
    </View>
  );
}

export function Cartao({
  children,
  aoTocar,
  estilo,
  corBorda,
  plano,
}: {
  children: React.ReactNode;
  aoTocar?: () => void;
  estilo?: StyleProp<ViewStyle>;
  corBorda?: string;
  /** Sem elevação: para cartões aninhados. */
  plano?: boolean;
}) {
  const e = useEstilos(folha);
  const conteudo = (
    <View
      style={[
        e.cartao,
        plano ? null : e.elevado,
        corBorda ? { borderLeftColor: corBorda, borderLeftWidth: 2 } : null,
        estilo,
      ]}
    >
      {children}
    </View>
  );
  if (!aoTocar) return conteudo;
  return (
    <Pressable onPress={aoTocar} style={({ pressed }) => (pressed ? e.pressionado : null)}>
      {conteudo}
    </Pressable>
  );
}

export function Divisor({ estilo }: { estilo?: StyleProp<ViewStyle> }) {
  const e = useEstilos(folha);
  return <View style={[e.divisor, estilo]} />;
}

// ------------------------------------------------------------------ textos

export function Titulo({
  children,
  estilo,
}: {
  children: React.ReactNode;
  estilo?: StyleProp<TextStyle>;
}) {
  const e = useEstilos(folha);
  return <Text style={[e.titulo, estilo]}>{children}</Text>;
}

export function TituloTela({ titulo, sub }: { titulo: string; sub?: string }) {
  const e = useEstilos(folha);
  return (
    <View>
      <Text style={e.tituloTela}>{titulo}</Text>
      {sub ? <Text style={e.subTela}>{sub}</Text> : null}
    </View>
  );
}

/** Linha rótulo → valor da ficha. */
export function Linha({
  rotulo,
  valor,
  monoespacado,
}: {
  rotulo: string;
  valor?: string | null;
  monoespacado?: boolean;
}) {
  const e = useEstilos(folha);
  if (!valor) return null;
  return (
    <View style={e.linhaDado}>
      <Text style={e.rotuloDado}>{rotulo}</Text>
      <Text style={[e.valorDado, monoespacado ? e.mono : null]} selectable>
        {valor}
      </Text>
    </View>
  );
}

// ------------------------------------------------------------------ botões

type VarianteBotao = 'primario' | 'secundario' | 'fantasma' | 'perigo';

export function Botao({
  titulo,
  aoTocar,
  variante = 'primario',
  icone,
  carregando,
  desabilitado,
  estilo,
  compacto,
}: {
  titulo: string;
  aoTocar: () => void;
  variante?: VarianteBotao;
  icone?: keyof typeof Ionicons.glyphMap;
  carregando?: boolean;
  desabilitado?: boolean;
  estilo?: StyleProp<ViewStyle>;
  compacto?: boolean;
}) {
  const c = useCores();
  const e = useEstilos(folha);
  const v = variantes(c)[variante];
  const inativo = desabilitado || carregando;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inativo, busy: !!carregando }}
      onPress={aoTocar}
      disabled={inativo}
      style={({ pressed }) => [
        e.botao,
        compacto ? e.botaoCompacto : null,
        { backgroundColor: v.fundo, borderColor: v.borda },
        pressed && !inativo ? e.pressionado : null,
        inativo ? { opacity: 0.4 } : null,
        estilo,
      ]}
    >
      {carregando ? (
        <ActivityIndicator color={v.texto} size="small" />
      ) : (
        <>
          {icone ? <Ionicons name={icone} size={16} color={v.texto} /> : null}
          <Text style={[e.textoBotao, { color: v.texto }]}>{titulo}</Text>
        </>
      )}
    </Pressable>
  );
}

const variantes = (c: Paleta): Record<VarianteBotao, { fundo: string; borda: string; texto: string }> => ({
  primario: { fundo: c.primario, borda: c.primario, texto: c.sobrePrimario },
  secundario: { fundo: c.superficieAlta, borda: c.bordaForte, texto: c.texto },
  fantasma: { fundo: 'transparent', borda: c.borda, texto: c.textoMedio },
  perigo: { fundo: c.perigoFraco, borda: c.perigo, texto: c.perigo },
});

// --------------------------------------------------------------- etiquetas

export function Etiqueta({
  texto,
  cor,
  fundo,
  icone,
}: {
  texto: string;
  cor?: string;
  fundo?: string;
  icone?: keyof typeof Ionicons.glyphMap;
}) {
  const c = useCores();
  const e = useEstilos(folha);
  const corFinal = cor ?? c.textoMedio;
  return (
    <View style={[e.etiqueta, { backgroundColor: fundo ?? c.superficieAlta, borderColor: `${corFinal}44` }]}>
      {icone ? <Ionicons name={icone} size={10} color={corFinal} /> : null}
      <Text style={[e.textoEtiqueta, { color: corFinal }]} numberOfLines={1}>
        {texto}
      </Text>
    </View>
  );
}

export function Vazio({
  icone,
  titulo,
  descricao,
  acao,
}: {
  icone: keyof typeof Ionicons.glyphMap;
  titulo: string;
  descricao: string;
  acao?: React.ReactNode;
}) {
  const c = useCores();
  const e = useEstilos(folha);
  return (
    <View style={e.vazio}>
      <View style={e.vazioIcone}>
        <Ionicons name={icone} size={24} color={c.primario} />
      </View>
      <Text style={e.vazioTitulo}>{titulo}</Text>
      <Text style={e.vazioDescricao}>{descricao}</Text>
      {acao ? <View style={{ marginTop: espaco.xl }}>{acao}</View> : null}
    </View>
  );
}

export function Carregando({ texto = 'Carregando…' }: { texto?: string }) {
  const c = useCores();
  const e = useEstilos(folha);
  return (
    <View style={e.carregando}>
      <ActivityIndicator color={c.primario} />
      <Text style={[e.legenda, { marginTop: espaco.md }]}>{texto}</Text>
    </View>
  );
}

/**
 * Véu de progresso que cobre a tela durante um trabalho pesado e bloqueante.
 *
 * O `ActivityIndicator` é uma view nativa que anima na thread da interface, não
 * na de JavaScript — então continua girando mesmo enquanto a criptografia do
 * backup (síncrona, em crypto-js) segura a thread de JS. Basta montá-lo antes
 * de começar o trabalho: por isso quem chama cede um quadro após ligar o véu.
 */
export function Sobreposicao({ visivel, texto }: { visivel: boolean; texto: string }) {
  const c = useCores();
  const e = useEstilos(folha);
  return (
    <Modal visible={visivel} transparent animationType="fade" statusBarTranslucent onRequestClose={() => {}}>
      <View style={e.sobreposicao}>
        <View style={e.sobreposicaoCartao}>
          <ActivityIndicator color={c.primario} size="large" />
          <Text style={[e.legenda, { marginTop: espaco.md, textAlign: 'center' }]}>{texto}</Text>
        </View>
      </View>
    </Modal>
  );
}

const folha = (c: Paleta) =>
  StyleSheet.create({
    tela: { flex: 1, backgroundColor: c.fundo },

    linhaSecao: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: espaco.sm,
      marginBottom: espaco.md,
    },
    tracoSecao: { width: 10, height: 2, backgroundColor: c.primario },
    fioSecao: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: c.borda },
    carimbo: { ...tipo.carimbo, color: c.textoFraco },

    cartao: {
      backgroundColor: c.superficie,
      borderRadius: raio.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.borda,
      padding: espaco.lg,
    },
    // No claro o cartão é branco sobre branco: sem a sombra ele some. No
    // escuro a separação já vem do contraste entre superfície e fundo.
    elevado:
      c.nome === 'claro'
        ? {
            shadowColor: c.sombra,
            shadowOpacity: 0.09,
            shadowRadius: 14,
            shadowOffset: { width: 0, height: 3 },
            elevation: 2,
          }
        : {},
    pressionado: { opacity: 0.62 },
    divisor: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: c.borda,
      marginVertical: espaco.md,
    },

    titulo: { ...tipo.titulo, color: c.texto },
    tituloTela: { ...tipo.telaTitulo, color: c.texto },
    subTela: { ...tipo.legenda, color: c.textoFraco, marginTop: 3 },
    legenda: { ...tipo.legenda, color: c.textoMedio },

    linhaDado: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: espaco.lg,
      paddingVertical: 7,
    },
    rotuloDado: { ...tipo.corpoPequeno, color: c.textoFraco, flexShrink: 0 },
    valorDado: {
      ...tipo.corpoPequeno,
      color: c.texto,
      fontWeight: '600',
      flexShrink: 1,
      textAlign: 'right',
    },
    mono: { fontFamily: MONO, letterSpacing: 0.4 },

    botao: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: espaco.sm,
      paddingVertical: 14,
      paddingHorizontal: espaco.lg,
      borderRadius: raio.sm,
      borderWidth: 1,
    },
    botaoCompacto: { paddingVertical: 9, paddingHorizontal: espaco.md },
    textoBotao: { fontSize: 15, fontWeight: '600', letterSpacing: 0.1 },

    etiqueta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 7,
      paddingVertical: 4,
      borderRadius: raio.sm,
      borderWidth: StyleSheet.hairlineWidth,
      alignSelf: 'flex-start',
      maxWidth: '100%',
    },
    textoEtiqueta: { fontSize: 11.5, fontWeight: '600', letterSpacing: 0.1 },

    vazio: { alignItems: 'center', paddingVertical: espaco.xxl, paddingHorizontal: espaco.lg },
    vazioIcone: {
      width: 52,
      height: 52,
      borderRadius: raio.sm,
      backgroundColor: c.primarioFraco,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: `${c.primario}55`,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: espaco.lg,
    },
    vazioTitulo: { ...tipo.subtitulo, color: c.texto, textAlign: 'center', marginBottom: 6 },
    vazioDescricao: {
      ...tipo.corpoPequeno,
      color: c.textoFraco,
      textAlign: 'center',
      maxWidth: 310,
    },

    carregando: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: espaco.xl, backgroundColor: c.fundo },

    sobreposicao: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: espaco.xl,
      backgroundColor: c.nome === 'claro' ? 'rgba(20,22,15,0.32)' : 'rgba(0,0,0,0.6)',
    },
    sobreposicaoCartao: {
      minWidth: 200,
      maxWidth: 300,
      backgroundColor: c.superficie,
      borderRadius: raio.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.borda,
      paddingVertical: espaco.xl,
      paddingHorizontal: espaco.xl,
      alignItems: 'center',
    },
  });
