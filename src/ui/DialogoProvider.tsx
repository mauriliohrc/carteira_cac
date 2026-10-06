import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { espaco, raio, tipo, useCores, useEstilos, type Paleta } from '@/tema';
import { Vidro } from './Vidro';
import { registrarApresentador, type PedidoDialogo } from './dialogo';

/**
 * Diálogos desenhados dentro do app, em vez dos do sistema.
 *
 * O motivo é o navegador: `Alert` do react-native-web é um no-op e a saída
 * anterior — um `prompt` pedindo o número da opção — obrigava o usuário a
 * digitar para escolher. Escolha se faz com botão. Como a folha precisa estar
 * na árvore para renderizar, o provider registra seu apresentador num
 * singleton, e o módulo `dialogo.ts` continua sendo chamável de qualquer
 * lugar, inclusive fora de componente.
 */

interface Estado extends PedidoDialogo {
  resolver: (valor: number | null) => void;
}

const Contexto = createContext<null>(null);

export function DialogoProvider({ children }: { children: React.ReactNode }) {
  const [pedido, setPedido] = useState<Estado | null>(null);
  const emAndamento = useRef<Estado | null>(null);

  const apresentar = useCallback((p: PedidoDialogo) => {
    return new Promise<number | null>((resolve) => {
      const estado: Estado = { ...p, resolver: resolve };
      emAndamento.current = estado;
      setPedido(estado);
    });
  }, []);

  // Registra uma vez; o apresentador é estável.
  useMemo(() => registrarApresentador(apresentar), [apresentar]);

  const fechar = useCallback((indice: number | null) => {
    const atual = emAndamento.current;
    emAndamento.current = null;
    setPedido(null);
    // Só resolve depois que a folha some. Se a ação escolhida abrir outro modal
    // nativo (seletor de arquivos, galeria, câmera), apresentá-lo enquanto esta
    // ainda está fechando dá conflito de apresentação no iOS — o seletor
    // simplesmente não abre, sem erro. A espera cobre a animação de saída.
    setTimeout(() => atual?.resolver(indice), 350);
  }, []);

  return (
    <Contexto.Provider value={null}>
      {children}
      <Folha pedido={pedido} aoFechar={fechar} />
    </Contexto.Provider>
  );
}

function Folha({
  pedido,
  aoFechar,
}: {
  pedido: Estado | null;
  aoFechar: (indice: number | null) => void;
}) {
  const c = useCores();
  const d = useEstilos(folha);
  const inferior = useSafeAreaInsets().bottom;

  if (!pedido) return null;

  const { titulo, mensagem, opcoes, cancelavel = true, rotuloCancelar = 'Cancelar' } = pedido;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => aoFechar(null)}>
      <Pressable
        style={d.fundo}
        onPress={cancelavel ? () => aoFechar(null) : undefined}
        accessibilityRole="button"
        accessibilityLabel="Fechar"
      />
      <View style={[d.ancora, { paddingBottom: Math.max(inferior, espaco.lg) }]} pointerEvents="box-none">
        <Vidro raioCanto={raio.lg} material="regular" estilo={d.painel}>
          <View style={d.cabecalho}>
            <Text style={d.titulo}>{titulo}</Text>
            {mensagem ? <Text style={d.mensagem}>{mensagem}</Text> : null}
          </View>

          <ScrollView style={{ maxHeight: 340 }} bounces={false}>
            {opcoes.map((op, i) => (
              <Pressable
                key={`${op.rotulo}-${i}`}
                accessibilityRole="button"
                onPress={() => aoFechar(i)}
                style={({ pressed }) => [d.opcao, pressed && { backgroundColor: c.primarioFraco }]}
              >
                {op.icone ? (
                  <Ionicons
                    name={op.icone as keyof typeof Ionicons.glyphMap}
                    size={19}
                    color={op.destrutivo ? c.perigo : c.primario}
                  />
                ) : null}
                <Text style={[d.opcaoTexto, op.destrutivo ? { color: c.perigo } : null]}>
                  {op.rotulo}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </Vidro>

        {cancelavel ? (
          <Pressable onPress={() => aoFechar(null)} style={({ pressed }) => pressed && { opacity: 0.7 }}>
            <Vidro raioCanto={raio.lg} material="regular" estilo={d.cancelar}>
              <Text style={d.cancelarTexto}>{rotuloCancelar}</Text>
            </Vidro>
          </Pressable>
        ) : null}
      </View>
    </Modal>
  );
}

export function useDialogoMontado(): boolean {
  return useContext(Contexto) !== undefined;
}

const folha = (c: Paleta) =>
  StyleSheet.create({
    fundo: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: c.nome === 'claro' ? 'rgba(20,22,15,0.28)' : 'rgba(0,0,0,0.55)',
    },
    ancora: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      padding: espaco.md,
      gap: espaco.sm,
    },
    painel: { overflow: 'hidden' },
    cabecalho: {
      paddingHorizontal: espaco.lg,
      paddingTop: espaco.lg,
      paddingBottom: espaco.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.borda,
    },
    titulo: { ...tipo.subtitulo, fontSize: 15, color: c.texto, textAlign: 'center' },
    mensagem: {
      ...tipo.legenda,
      color: c.textoFraco,
      textAlign: 'center',
      marginTop: 5,
    },
    opcao: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: espaco.md,
      paddingVertical: 16,
      paddingHorizontal: espaco.lg,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.borda,
    },
    opcaoTexto: { flex: 1, fontSize: 16, color: c.texto, fontWeight: '500' },
    cancelar: { paddingVertical: 16, alignItems: 'center' },
    cancelarTexto: { fontSize: 16, fontWeight: '600', color: c.textoMedio },
  });
