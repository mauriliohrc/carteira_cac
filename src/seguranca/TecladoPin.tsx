import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { espaco, raio, tipo, useCores, useEstilos, type Paleta } from '@/tema';
import { TAMANHO_PIN } from './tranca';

export interface AtalhoBiometria {
  icone: keyof typeof Ionicons.glyphMap;
  rotulo: string;
  aoUsar: () => void;
}

/**
 * Teclado numérico de PIN, controlado pelo pai.
 *
 * Mostra os pontos preenchidos, o teclado de 0–9 e, opcionalmente, um atalho de
 * biometria no canto. Não decide nada sobre acerto/erro: só edita os dígitos e
 * avisa quando completa os seis.
 */
export function TecladoPin({
  titulo,
  subtitulo,
  valor,
  aoMudar,
  aoCompletar,
  erro,
  biometria,
}: {
  titulo: string;
  subtitulo?: string;
  valor: string;
  aoMudar: (v: string) => void;
  aoCompletar?: (pin: string) => void;
  /** Sinaliza PIN errado: pinta os pontos e balança. */
  erro?: boolean;
  biometria?: AtalhoBiometria | null;
}) {
  const c = useCores();
  const t = useEstilos(folha);
  const balanco = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!erro) return;
    Animated.sequence([
      Animated.timing(balanco, { toValue: 1, duration: 60, useNativeDriver: true }),
      Animated.timing(balanco, { toValue: -1, duration: 60, useNativeDriver: true }),
      Animated.timing(balanco, { toValue: 1, duration: 60, useNativeDriver: true }),
      Animated.timing(balanco, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  }, [erro, balanco]);

  const digitar = (d: string) => {
    if (valor.length >= TAMANHO_PIN) return;
    const proximo = valor + d;
    aoMudar(proximo);
    if (proximo.length === TAMANHO_PIN) aoCompletar?.(proximo);
  };

  const apagar = () => {
    if (valor.length > 0) aoMudar(valor.slice(0, -1));
  };

  const deslocamento = balanco.interpolate({
    inputRange: [-1, 1],
    outputRange: [-9, 9],
  });

  const teclas = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

  return (
    <View style={t.raiz}>
      <Text style={t.titulo}>{titulo}</Text>
      {subtitulo ? <Text style={t.subtitulo}>{subtitulo}</Text> : null}

      <Animated.View style={[t.pontos, { transform: [{ translateX: deslocamento }] }]}>
        {Array.from({ length: TAMANHO_PIN }).map((_, i) => {
          const preenchido = i < valor.length;
          return (
            <View
              key={i}
              style={[
                t.ponto,
                preenchido ? { backgroundColor: erro ? c.perigo : c.primario, borderColor: erro ? c.perigo : c.primario } : null,
                erro && !preenchido ? { borderColor: c.perigo } : null,
              ]}
            />
          );
        })}
      </Animated.View>

      <View style={t.teclado}>
        {teclas.map((d) => (
          <Tecla key={d} rotulo={d} aoTocar={() => digitar(d)} />
        ))}

        {/* Canto inferior esquerdo: biometria, quando houver. */}
        {biometria ? (
          <Pressable
            onPress={biometria.aoUsar}
            style={({ pressed }) => [t.tecla, t.teclaAux, pressed ? t.pressionada : null]}
            accessibilityRole="button"
            accessibilityLabel={biometria.rotulo}
          >
            <Ionicons name={biometria.icone} size={26} color={c.primario} />
          </Pressable>
        ) : (
          <View style={t.tecla} />
        )}

        <Tecla rotulo="0" aoTocar={() => digitar('0')} />

        <Pressable
          onPress={apagar}
          style={({ pressed }) => [t.tecla, t.teclaAux, pressed ? t.pressionada : null]}
          accessibilityRole="button"
          accessibilityLabel="Apagar"
        >
          <Ionicons name="backspace-outline" size={26} color={c.textoMedio} />
        </Pressable>
      </View>
    </View>
  );
}

function Tecla({ rotulo, aoTocar }: { rotulo: string; aoTocar: () => void }) {
  const t = useEstilos(folha);
  return (
    <Pressable
      onPress={aoTocar}
      style={({ pressed }) => [t.tecla, pressed ? t.pressionada : null]}
      accessibilityRole="button"
    >
      <Text style={t.teclaTexto}>{rotulo}</Text>
    </Pressable>
  );
}

const folha = (c: Paleta) =>
  StyleSheet.create({
    raiz: { alignItems: 'center', width: '100%' },
    titulo: { ...tipo.titulo, color: c.texto, textAlign: 'center' },
    subtitulo: {
      ...tipo.corpoPequeno,
      color: c.textoMedio,
      textAlign: 'center',
      marginTop: espaco.sm,
      maxWidth: 300,
    },

    pontos: {
      flexDirection: 'row',
      gap: espaco.md,
      marginVertical: espaco.xxl,
    },
    ponto: {
      width: 15,
      height: 15,
      borderRadius: raio.pill,
      borderWidth: 1.5,
      borderColor: c.bordaForte,
      backgroundColor: 'transparent',
    },

    teclado: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      width: 300,
      justifyContent: 'space-between',
      rowGap: espaco.lg,
    },
    tecla: {
      width: 82,
      height: 82,
      borderRadius: raio.pill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    teclaAux: {},
    pressionada: { backgroundColor: c.primarioFraco },
    teclaTexto: { fontSize: 30, fontWeight: '500', color: c.texto },
  });
