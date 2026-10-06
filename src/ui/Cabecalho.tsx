import React from 'react';
import { Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { espaco, raio, tipo, useCores, useEstilos, type Paleta } from '@/tema';
import { Vidro } from './Vidro';

/** Altura útil do cabeçalho, sem a área segura do topo. */
export const ALTURA_CABECALHO = 52;
const MARGEM_LATERAL = 14;
const RAIO = 20;

/**
 * Cabeçalho único do app: brasão, marca e — quando há para onde voltar — o
 * botão de retorno.
 *
 * Flutua sobre o conteúdo, como a barra de abas, pelo mesmo motivo: vidro sem
 * nada atrás não refrata nada. A `Tela` reserva o espaço correspondente no
 * topo, então a lista começa abaixo dele e passa por trás ao rolar.
 */
export function Cabecalho({
  voltar,
  acao,
  titulo,
}: {
  /** Mostra o botão de retorno. Telas de aba não passam nada. */
  voltar?: boolean;
  /** Canto direito: editar, compartilhar, marcar como lido… */
  acao?: React.ReactNode;
  /** Subtítulo discreto sob a marca, para telas empilhadas. */
  titulo?: string;
}) {
  const c = useCores();
  const h = useEstilos(folha);
  const superior = useSafeAreaInsets().top;

  return (
    <View style={[h.raiz, { paddingTop: superior + 6 }]} pointerEvents="box-none">
      <Vidro raioCanto={RAIO} material="regular" estilo={h.barra}>
        <View style={h.conteudo}>
          {voltar ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Voltar"
              onPress={() => router.back()}
              hitSlop={10}
              style={({ pressed }) => [h.voltar, pressed && { opacity: 0.6 }]}
            >
              <Ionicons name="chevron-back" size={22} color={c.primario} />
            </Pressable>
          ) : (
            <Image
              source={require('../../assets/logo.png')}
              style={h.brasao}
              resizeMode="contain"
              accessibilityLabel="Carteira CAC"
            />
          )}

          <View style={h.marcaBloco}>
            <Text style={h.marca} numberOfLines={1}>
              CARTEIRA CAC
            </Text>
            {titulo ? (
              <Text style={h.subtitulo} numberOfLines={1}>
                {titulo}
              </Text>
            ) : null}
          </View>

          <View style={h.acao}>{acao}</View>
        </View>
      </Vidro>
    </View>
  );
}

/** Espaço que o conteúdo precisa deixar livre no topo. */
export function useFolgaCabecalho(): number {
  const superior = useSafeAreaInsets().top;
  return superior + 6 + ALTURA_CABECALHO + espaco.md;
}

const folha = (c: Paleta) =>
  StyleSheet.create({
    raiz: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 10,
      paddingHorizontal: MARGEM_LATERAL,
    },
    barra: {
      height: ALTURA_CABECALHO,
      ...Platform.select({
        ios: {
          shadowColor: c.nome === 'claro' ? c.sombra : '#000',
          shadowOpacity: c.nome === 'claro' ? 0.1 : 0.3,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: 5 },
        },
        default: { elevation: 8 },
      }),
    },
    conteudo: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: espaco.md,
      paddingHorizontal: espaco.md,
    },
    voltar: {
      width: 32,
      height: 32,
      borderRadius: raio.sm,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: -4,
    },
    brasao: {
      width: 34,
      height: 34,
    },
    marcaBloco: { flex: 1 },
    marca: { ...tipo.marca, fontSize: 13, letterSpacing: 2.6, color: c.texto },
    subtitulo: { ...tipo.legenda, fontSize: 10.5, color: c.textoFraco, marginTop: 1 },
    acao: { minWidth: 26, alignItems: 'flex-end' },
  });
