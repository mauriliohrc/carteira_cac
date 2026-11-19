/**
 * Widget "Acervo" — resumo de documentos + habitualidade na tela inicial.
 *
 * ──────────────────────────────────────────────────────────────────────────
 * PADRÃO CROSS-PLATFORM ESCOLHIDO: arquivo único SwiftUI (iOS), com os arquivos
 * por plataforma (.ios.tsx / .android.tsx) como caminho canônico para o dia em
 * que o Android ganhar layout. Por quê, com base no código do expo-widgets
 * 57.0.28 instalado:
 *
 *  1. O bundle do widget NÃO é React Native comum: o metro.config.js do
 *     expo-widgets troca `react-native` por um stub que só exporta
 *     `PlatformColor`. Ou seja, `Platform.OS` é `undefined` aqui — branch por
 *     plataforma DENTRO do corpo do widget é impossível (quebraria no load).
 *  2. O corpo é serializado e reavaliado NO APARELHO: no iOS um JSContext
 *     (ios/Widgets/WidgetsJSRuntime.swift) roda a função com (props, environment)
 *     e monta a árvore SwiftUI. Logo os componentes têm de ser os do
 *     `@expo/ui/swift-ui`; não há sinal de plataforma dentro desse runtime.
 *  3. O Android AINDA é stub: ExpoWidgetsGlanceWidget.kt renderiza só
 *     `Text(widgetName)` e nunca avalia o layout JS. Código jetpack-compose
 *     aqui seria inerte. Quando o suporte chegar, cria-se um irmão
 *     `acervoWidget.android.tsx` com `@expo/ui/jetpack-compose` (Column/Row/
 *     Text/LinearProgressIndicator) — o Metro resolve .android.tsx no build
 *     `--platform android`, que é a forma canônica (já que não há branch em
 *     runtime). Misturar os dois conjuntos num só arquivo contaminaria a árvore
 *     serializada do iOS, então ficou de fora de propósito.
 *
 * REGRA DO CORPO 'widget': nada de hooks/estado/async e NENHUMA referência a
 * variável/constante/helper de escopo de módulo — tudo (cores, textos, limiares)
 * é literal inline ou vem de `props`/`environment`. Componentes e modificadores
 * do @expo/ui são a exceção: o bundler os resolve. Por isso as cores de marca
 * aparecem repetidas como strings dentro da função, não como consts.
 * ──────────────────────────────────────────────────────────────────────────
 */
import { HStack, Image, ProgressView, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  containerBackground,
  font,
  foregroundColor,
  frame,
  lineLimit,
  padding,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

/** Como cada grupo aparece na barra detalhada do widget médio. */
interface GrupoResumo {
  rotulo: string;
  feitas: number;
  minimo: number;
}

/** Espelha `src/widget/resumo.ts` (ResumoWidget) — o app envia exatamente isto. */
interface ResumoWidget {
  docEstado: 'OK' | 'ATENCAO' | 'VENCIDO';
  docMsg: string;
  docQtdAtencao: number;
  habExigido: boolean;
  habEmDia: boolean;
  habProgresso: number;
  habTexto: string;
  habGrupos: GrupoResumo[];
  estadoGeral: 'OK' | 'ATENCAO';
  atualizadoEm: string;
}

/**
 * Layout do widget. Marcado com a diretiva 'widget' — a partir daqui o corpo é
 * serializado para o runtime do aparelho, então todo literal fica inline.
 */
export const AcervoWidget = createWidget<ResumoWidget>(
  'Acervo',
  (props: ResumoWidget, environment: WidgetEnvironment) => {
    'widget';

    // systemSmall mostra UMA manchete; o resto (medium/Android futuro) mostra duas linhas.
    const compacto = environment.widgetFamily === 'systemSmall';

    // Prioridade do destaque no modo compacto: habitualidade atrasada > documento > tudo ok.
    const habAtrasada = props.habExigido && !props.habEmDia;

    return (
      <VStack
        alignment="leading"
        spacing={compacto ? 8 : 10}
        // containerBackground(_, 'widget') é exigido no iOS 17+; usa o fundo do app.
        modifiers={[containerBackground('#101310', 'widget'), padding({ all: 14 })]}>
        {compacto ? (
          // ───────── systemSmall: uma só manchete, terso ─────────
          habAtrasada ? (
            // Habitualidade: barra + texto ("3/8 sessões").
            <VStack alignment="leading" spacing={8}>
              <Text modifiers={[foregroundColor('#E7ECE3'), font({ size: 15, weight: 'semibold' })]}>
                Habitualidade
              </Text>
              <ProgressView
                value={props.habProgresso}
                modifiers={[tint('#93AD65'), frame({ maxWidth: 300 })]}
              />
              <Text modifiers={[foregroundColor('#E7ECE3'), font({ size: 13 })]}>
                {props.habTexto}
              </Text>
            </VStack>
          ) : props.docEstado !== 'OK' ? (
            // Documento pedindo atenção: ícone âmbar/vermelho + mensagem.
            <VStack alignment="leading" spacing={8}>
              <Image
                systemName={props.docEstado === 'VENCIDO' ? 'exclamationmark.octagon.fill' : 'exclamationmark.triangle.fill'}
                color={props.docEstado === 'VENCIDO' ? '#D14343' : '#E6A700'}
                size={34}
              />
              <Text
                modifiers={[foregroundColor('#E7ECE3'), font({ size: 14, weight: 'medium' }), lineLimit(3)]}>
                {props.docMsg}
              </Text>
            </VStack>
          ) : (
            // Tudo em ordem: check verde + frase.
            <VStack alignment="leading" spacing={8}>
              <Image systemName="checkmark.circle.fill" color="#93AD65" size={34} />
              <Text modifiers={[foregroundColor('#E7ECE3'), font({ size: 14, weight: 'medium' }), lineLimit(3)]}>
                Tudo em ordem
              </Text>
            </VStack>
          )
        ) : (
          // ───────── systemMedium: duas linhas (documentos + habitualidade) ─────────
          <VStack alignment="leading" spacing={12}>
            {/* Linha 1 — status dos documentos: ícone conforme a pior situação. */}
            <HStack spacing={8} alignment="center">
              <Image
                systemName={
                  props.docEstado === 'OK'
                    ? 'checkmark.circle.fill'
                    : props.docEstado === 'VENCIDO'
                      ? 'exclamationmark.octagon.fill'
                      : 'exclamationmark.triangle.fill'
                }
                color={
                  props.docEstado === 'OK' ? '#93AD65' : props.docEstado === 'VENCIDO' ? '#D14343' : '#E6A700'
                }
                size={22}
              />
              <Text modifiers={[foregroundColor('#E7ECE3'), font({ size: 15, weight: 'semibold' }), lineLimit(2)]}>
                {props.docMsg}
              </Text>
              <Spacer />
            </HStack>

            {/* Linha 2 — habitualidade. */}
            {props.habExigido ? (
              // Até 3 grupos: uma barrinha por grupo (feitas/minimo). Mais que isso, barra geral.
              props.habGrupos.length > 0 && props.habGrupos.length <= 3 ? (
                <VStack alignment="leading" spacing={6}>
                  <Text modifiers={[foregroundColor('#E7ECE3'), font({ size: 13 })]}>
                    {props.habTexto}
                  </Text>
                  {props.habGrupos.map((g) => (
                    <HStack key={g.rotulo} spacing={8} alignment="center">
                      <Text modifiers={[foregroundColor('#E7ECE3'), font({ size: 12 }), frame({ width: 86, alignment: 'leading' })]}>
                        {g.rotulo}
                      </Text>
                      <ProgressView
                        value={Math.min(g.feitas, g.minimo) / g.minimo}
                        modifiers={[tint(g.feitas >= g.minimo ? '#93AD65' : '#E6A700')]}
                      />
                    </HStack>
                  ))}
                </VStack>
              ) : (
                // Barra geral única + texto ("2 de 3 grupos em dia").
                <VStack alignment="leading" spacing={6}>
                  <ProgressView value={props.habProgresso} modifiers={[tint('#93AD65')]} />
                  <Text modifiers={[foregroundColor('#E7ECE3'), font({ size: 13 })]}>
                    {props.habTexto}
                  </Text>
                </VStack>
              )
            ) : (
              // Atirador sem acompanhamento: habitualidade não exigida.
              <HStack spacing={8} alignment="center">
                <Image systemName="checkmark.circle.fill" color="#93AD65" size={18} />
                <Text modifiers={[foregroundColor('#E7ECE3'), font({ size: 13 })]}>
                  Habitualidade não exigida
                </Text>
              </HStack>
            )}
          </VStack>
        )}
      </VStack>
    );
  }
);

export default AcervoWidget;
