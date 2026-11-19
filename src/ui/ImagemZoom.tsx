import React, { useRef } from 'react';
import { Animated, StyleSheet, useWindowDimensions, type StyleProp, type ImageStyle } from 'react-native';
import {
  PanGestureHandler,
  PinchGestureHandler,
  TapGestureHandler,
  State,
  type PanGestureHandlerStateChangeEvent,
  type PinchGestureHandlerStateChangeEvent,
  type TapGestureHandlerStateChangeEvent,
} from 'react-native-gesture-handler';

/**
 * Imagem com pinça (pinch) + arraste (pan) + toque duplo, funcionando em iOS e
 * Android. Antes o visualizador usava `ScrollView` com `maximumZoomScale`, que é
 * uma prop SÓ de iOS — no Android o `ScrollView` a ignora e a imagem nunca dava
 * zoom (o PDF funcionava porque vai por outro caminho).
 *
 * Usamos a API `Animated` do core do React Native (não o Reanimated): este
 * projeto não tem `babel.config.js`, então o plugin de worklets do Reanimated v4
 * não está garantido — depender dele arriscaria um crash em runtime. Os handlers
 * do gesture-handler alimentam `Animated.event` com `useNativeDriver`, tudo na
 * thread de UI, sem worklets.
 */
const MAX_ESCALA = 4;

export function ImagemZoom({ uri, style }: { uri: string; style?: StyleProp<ImageStyle> }) {
  const { width, height } = useWindowDimensions();

  const pinchRef = useRef(null);
  const panRef = useRef(null);
  const tapRef = useRef(null);

  // Escala: base (confirmada) × pinça (ao vivo). Em repouso ambas valem 1.
  const baseScale = useRef(new Animated.Value(1)).current;
  const pinchScale = useRef(new Animated.Value(1)).current;
  const scale = Animated.multiply(baseScale, pinchScale);
  const ultimaEscala = useRef(1);

  // Deslocamento do arraste, em espaço de tela (aplicado antes da escala).
  const panX = useRef(new Animated.Value(0)).current;
  const panY = useRef(new Animated.Value(0)).current;
  const offset = useRef({ x: 0, y: 0 }).current;

  const onPinchEvent = Animated.event([{ nativeEvent: { scale: pinchScale } }], {
    useNativeDriver: true,
  });
  const onPanEvent = Animated.event(
    [{ nativeEvent: { translationX: panX, translationY: panY } }],
    { useNativeDriver: true }
  );

  function voltarAoNormal() {
    ultimaEscala.current = 1;
    offset.x = 0;
    offset.y = 0;
    panX.setOffset(0);
    panY.setOffset(0);
    pinchScale.setValue(1);
    Animated.parallel([
      Animated.spring(baseScale, { toValue: 1, useNativeDriver: true }),
      Animated.spring(panX, { toValue: 0, useNativeDriver: true }),
      Animated.spring(panY, { toValue: 0, useNativeDriver: true }),
    ]).start();
  }

  function aoMudarPinca(e: PinchGestureHandlerStateChangeEvent) {
    if (e.nativeEvent.oldState !== State.ACTIVE) return;
    pinchScale.setValue(1);
    let nova = ultimaEscala.current * e.nativeEvent.scale;
    if (nova <= 1) {
      // Abaixo de 1: a imagem "quica" de volta ao enquadramento original.
      voltarAoNormal();
      return;
    }
    if (nova > MAX_ESCALA) nova = MAX_ESCALA;
    ultimaEscala.current = nova;
    baseScale.setValue(nova);
  }

  function aoMudarPan(e: PanGestureHandlerStateChangeEvent) {
    if (e.nativeEvent.oldState !== State.ACTIVE) return;
    // Confirma o deslocamento no offset e zera o valor ao vivo.
    offset.x += e.nativeEvent.translationX;
    offset.y += e.nativeEvent.translationY;
    panX.setOffset(offset.x);
    panX.setValue(0);
    panY.setOffset(offset.y);
    panY.setValue(0);
  }

  function aoTocarDuplo(e: TapGestureHandlerStateChangeEvent) {
    if (e.nativeEvent.state !== State.ACTIVE) return;
    if (ultimaEscala.current > 1) {
      voltarAoNormal();
    } else {
      ultimaEscala.current = 2;
      Animated.spring(baseScale, { toValue: 2, useNativeDriver: true }).start();
    }
  }

  return (
    <TapGestureHandler
      ref={tapRef}
      numberOfTaps={2}
      onHandlerStateChange={aoTocarDuplo}
      waitFor={[pinchRef, panRef]}
    >
      <Animated.View style={styles.area}>
        <PanGestureHandler
          ref={panRef}
          onGestureEvent={onPanEvent}
          onHandlerStateChange={aoMudarPan}
          minPointers={1}
          avgTouches
          simultaneousHandlers={pinchRef}
        >
          <Animated.View style={styles.area}>
            <PinchGestureHandler
              ref={pinchRef}
              onGestureEvent={onPinchEvent}
              onHandlerStateChange={aoMudarPinca}
              simultaneousHandlers={panRef}
            >
              <Animated.Image
                source={{ uri }}
                resizeMode="contain"
                style={[
                  { width, height },
                  style,
                  { transform: [{ translateX: panX }, { translateY: panY }, { scale }] },
                ]}
              />
            </PinchGestureHandler>
          </Animated.View>
        </PanGestureHandler>
      </Animated.View>
    </TapGestureHandler>
  );
}

const styles = StyleSheet.create({
  area: { flex: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
