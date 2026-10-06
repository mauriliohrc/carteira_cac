import React, { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { espaco, raio, tipo, useCores, useEstilos, type Paleta } from '@/tema';
import { brParaISO, isoParaBR, mascaraData } from '@/lib/data';

export function Campo({
  rotulo,
  valor,
  aoMudar,
  placeholder,
  obrigatorio,
  erro,
  dica,
  multilinha,
  teclado = 'default',
  autoCapitalize = 'sentences',
  maxLength,
  segredo,
}: {
  rotulo: string;
  valor: string;
  aoMudar: (v: string) => void;
  placeholder?: string;
  obrigatorio?: boolean;
  erro?: string | null;
  dica?: string;
  multilinha?: boolean;
  teclado?: 'default' | 'numeric' | 'email-address';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  maxLength?: number;
  /** Campo de senha: oculta o texto e desliga autocorreção/caixa. */
  segredo?: boolean;
}) {
  const c = useCores();
  const f = useEstilos(folha);
  const [focado, setFocado] = useState(false);

  return (
    <View style={f.grupo}>
      <Rotulo texto={rotulo} obrigatorio={obrigatorio} />
      <TextInput
        style={[
          f.input,
          multilinha ? f.inputMulti : null,
          focado ? f.inputFocado : null,
          erro ? f.inputErro : null,
        ]}
        value={valor}
        onChangeText={aoMudar}
        onFocus={() => setFocado(true)}
        onBlur={() => setFocado(false)}
        placeholder={placeholder}
        placeholderTextColor={c.textoFraco}
        multiline={multilinha}
        keyboardType={teclado}
        autoCapitalize={segredo ? 'none' : autoCapitalize}
        autoCorrect={!segredo}
        secureTextEntry={segredo}
        maxLength={maxLength}
      />
      <Auxiliar erro={erro} dica={dica} />
    </View>
  );
}

/**
 * Data digitada pelo usuário no formato dd/mm/aaaa.
 * O app nunca preenche validade sozinho — sempre vem daqui.
 */
export function CampoData({
  rotulo,
  valorISO,
  aoMudar,
  obrigatorio,
  erro,
  dica,
}: {
  rotulo: string;
  valorISO: string | null;
  aoMudar: (iso: string | null, bruto: string) => void;
  obrigatorio?: boolean;
  erro?: string | null;
  dica?: string;
}) {
  const c = useCores();
  const f = useEstilos(folha);
  const [texto, setTexto] = useState(() => (valorISO ? isoParaBR(valorISO) : ''));
  const [focado, setFocado] = useState(false);

  const aoDigitar = (entrada: string) => {
    const mascarado = mascaraData(entrada);
    setTexto(mascarado);
    aoMudar(brParaISO(mascarado), mascarado);
  };

  return (
    <View style={f.grupo}>
      <Rotulo texto={rotulo} obrigatorio={obrigatorio} />
      <View style={[f.input, f.inputComIcone, focado ? f.inputFocado : null, erro ? f.inputErro : null]}>
        <Ionicons name="calendar-outline" size={16} color={c.textoFraco} />
        <TextInput
          style={f.inputInterno}
          value={texto}
          onChangeText={aoDigitar}
          onFocus={() => setFocado(true)}
          onBlur={() => setFocado(false)}
          placeholder="dd/mm/aaaa"
          placeholderTextColor={c.textoFraco}
          keyboardType="number-pad"
          maxLength={10}
        />
      </View>
      <Auxiliar erro={erro} dica={dica} />
    </View>
  );
}

export interface ItemSeletor {
  valor: string;
  rotulo: string;
  detalhe?: string;
}

/** Botões lado a lado — bom para 2 a 6 opções curtas. */
export function SeletorChips({
  rotulo,
  itens,
  selecionado,
  aoSelecionar,
  obrigatorio,
  erro,
  dica,
}: {
  rotulo: string;
  itens: ItemSeletor[];
  selecionado: string | null;
  aoSelecionar: (valor: string) => void;
  obrigatorio?: boolean;
  erro?: string | null;
  dica?: string;
}) {
  const f = useEstilos(folha);
  return (
    <View style={f.grupo}>
      <Rotulo texto={rotulo} obrigatorio={obrigatorio} />
      <View style={f.chips}>
        {itens.map((item) => {
          const ativo = item.valor === selecionado;
          return (
            <Pressable
              key={item.valor}
              accessibilityRole="radio"
              accessibilityState={{ selected: ativo }}
              onPress={() => aoSelecionar(item.valor)}
              style={({ pressed }) => [
                f.chip,
                ativo ? f.chipAtivo : null,
                pressed ? { opacity: 0.65 } : null,
              ]}
            >
              <Text style={[f.chipTexto, ativo ? f.chipTextoAtivo : null]}>{item.rotulo}</Text>
            </Pressable>
          );
        })}
      </View>
      <Auxiliar erro={erro} dica={dica} />
    </View>
  );
}

/** Lista longa (calibres, grupos) — abre em folha com busca e opção livre. */
export function SeletorLista({
  rotulo,
  itens,
  selecionado,
  aoSelecionar,
  obrigatorio,
  erro,
  dica,
  permiteLivre,
  placeholder = 'Selecionar…',
  tituloFolha,
}: {
  rotulo: string;
  itens: ItemSeletor[];
  selecionado: string | null;
  aoSelecionar: (valor: string) => void;
  obrigatorio?: boolean;
  erro?: string | null;
  dica?: string;
  permiteLivre?: boolean;
  placeholder?: string;
  tituloFolha?: string;
}) {
  const c = useCores();
  const f = useEstilos(folha);
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState('');

  const filtrados = useMemo(() => {
    const t = busca.trim().toLowerCase();
    if (!t) return itens;
    return itens.filter(
      (i) => i.rotulo.toLowerCase().includes(t) || (i.detalhe ?? '').toLowerCase().includes(t)
    );
  }, [busca, itens]);

  const atual = itens.find((i) => i.valor === selecionado);
  const textoAtual = atual?.rotulo ?? selecionado ?? '';
  const buscaLimpa = busca.trim();
  const podeUsarLivre =
    permiteLivre &&
    buscaLimpa.length > 0 &&
    !filtrados.some((i) => i.rotulo.toLowerCase() === buscaLimpa.toLowerCase());

  const escolher = (valor: string) => {
    aoSelecionar(valor);
    setAberto(false);
    setBusca('');
  };

  return (
    <View style={f.grupo}>
      <Rotulo texto={rotulo} obrigatorio={obrigatorio} />
      <Pressable
        accessibilityRole="button"
        onPress={() => setAberto(true)}
        style={({ pressed }) => [
          f.input,
          f.inputComIcone,
          erro ? f.inputErro : null,
          pressed ? { opacity: 0.65 } : null,
        ]}
      >
        <Text
          style={[f.valorSeletor, !textoAtual ? { color: c.textoFraco } : null]}
          numberOfLines={1}
        >
          {textoAtual || placeholder}
        </Text>
        <Ionicons name="chevron-down" size={16} color={c.textoFraco} />
      </Pressable>
      <Auxiliar erro={erro} dica={dica} />

      <Modal visible={aberto} animationType="slide" transparent onRequestClose={() => setAberto(false)}>
        <KeyboardAvoidingView
          style={f.modalRaiz}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <Pressable style={f.fundoModal} onPress={() => setAberto(false)} />
          <View style={f.folhaModal}>
            <View style={f.puxador} />
          <Text style={f.tituloFolha}>{(tituloFolha ?? rotulo).toUpperCase()}</Text>
          <View style={[f.input, f.inputComIcone, { marginBottom: espaco.md }]}>
            <Ionicons name="search" size={15} color={c.textoFraco} />
            <TextInput
              style={f.inputInterno}
              value={busca}
              onChangeText={setBusca}
              placeholder={permiteLivre ? 'Buscar ou digitar novo…' : 'Buscar…'}
              placeholderTextColor={c.textoFraco}
              autoFocus
            />
          </View>
          <ScrollView style={{ maxHeight: 380 }} keyboardShouldPersistTaps="handled">
            {podeUsarLivre ? (
              <Pressable style={f.opcao} onPress={() => escolher(buscaLimpa)}>
                <Ionicons name="add-circle-outline" size={17} color={c.primario} />
                <View style={{ flex: 1 }}>
                  <Text style={[f.opcaoRotulo, { color: c.primario }]}>Usar “{buscaLimpa}”</Text>
                  <Text style={f.opcaoDetalhe}>Adicionar valor personalizado</Text>
                </View>
              </Pressable>
            ) : null}
            {filtrados.map((item) => {
              const ativo = item.valor === selecionado;
              return (
                <Pressable key={item.valor} style={f.opcao} onPress={() => escolher(item.valor)}>
                  <Ionicons
                    name={ativo ? 'radio-button-on' : 'radio-button-off'}
                    size={17}
                    color={ativo ? c.primario : c.textoFraco}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={[f.opcaoRotulo, ativo ? { color: c.primario } : null]}>
                      {item.rotulo}
                    </Text>
                    {item.detalhe ? <Text style={f.opcaoDetalhe}>{item.detalhe}</Text> : null}
                  </View>
                </Pressable>
              );
            })}
            {!filtrados.length && !podeUsarLivre ? (
              <Text style={[f.opcaoDetalhe, { padding: espaco.lg, textAlign: 'center' }]}>
                Nenhum resultado.
              </Text>
            ) : null}
          </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function Rotulo({ texto, obrigatorio }: { texto: string; obrigatorio?: boolean }) {
  const c = useCores();
  const f = useEstilos(folha);
  return (
    <Text style={f.rotulo}>
      {texto.toUpperCase()}
      {obrigatorio ? <Text style={{ color: c.primario }}> •</Text> : null}
    </Text>
  );
}

function Auxiliar({ erro, dica }: { erro?: string | null; dica?: string }) {
  const f = useEstilos(folha);
  if (erro) return <Text style={f.erro}>{erro}</Text>;
  if (dica) return <Text style={f.dica}>{dica}</Text>;
  return null;
}

export function BlocoFormulario({
  titulo,
  children,
  estilo,
}: {
  titulo?: string;
  children: React.ReactNode;
  estilo?: StyleProp<ViewStyle>;
}) {
  const f = useEstilos(folha);
  return (
    <View style={[f.bloco, estilo]}>
      {titulo ? (
        <View style={f.cabecalhoBloco}>
          <View style={f.tracoBloco} />
          <Text style={f.tituloBloco}>{titulo.toUpperCase()}</Text>
          <View style={f.fioBloco} />
        </View>
      ) : null}
      {children}
    </View>
  );
}

const folha = (c: Paleta) =>
  StyleSheet.create({
    bloco: { marginBottom: espaco.xl },
    cabecalhoBloco: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: espaco.sm,
      marginBottom: espaco.lg,
    },
    tracoBloco: { width: 10, height: 2, backgroundColor: c.primario },
    fioBloco: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: c.borda },
    tituloBloco: { ...tipo.carimbo, color: c.textoFraco },

    grupo: { marginBottom: espaco.lg },
    rotulo: { ...tipo.etiqueta, color: c.textoMedio, marginBottom: 7 },

    input: {
      backgroundColor: c.nome === 'claro' ? c.superficieAlta : c.superficie,
      borderWidth: 1,
      borderColor: c.borda,
      borderRadius: raio.sm,
      paddingHorizontal: espaco.md,
      paddingVertical: 12,
      fontSize: 15,
      color: c.texto,
      minHeight: 46,
    },
    inputFocado: { borderColor: c.primario },
    inputMulti: { minHeight: 92, textAlignVertical: 'top' },
    inputErro: { borderColor: c.perigo },
    inputComIcone: { flexDirection: 'row', alignItems: 'center', gap: espaco.sm },
    inputInterno: { flex: 1, fontSize: 15, color: c.texto, padding: 0 },
    valorSeletor: { flex: 1, fontSize: 15, color: c.texto },

    erro: { ...tipo.legenda, color: c.perigo, marginTop: 5 },
    dica: { ...tipo.legenda, color: c.textoFraco, marginTop: 5 },

    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    chip: {
      paddingHorizontal: espaco.md,
      paddingVertical: 9,
      borderRadius: raio.sm,
      borderWidth: 1,
      borderColor: c.borda,
      backgroundColor: c.nome === 'claro' ? c.superficieAlta : c.superficie,
    },
    chipAtivo: { borderColor: c.primario, backgroundColor: c.primarioFraco },
    chipTexto: { fontSize: 13, color: c.textoMedio, fontWeight: '600' },
    chipTextoAtivo: { color: c.primario },

    modalRaiz: { flex: 1 },
    fundoModal: { flex: 1, backgroundColor: c.nome === 'claro' ? '#00000055' : '#000000AA' },
    folhaModal: {
      backgroundColor: c.superficie,
      borderTopLeftRadius: raio.lg,
      borderTopRightRadius: raio.lg,
      padding: espaco.lg,
      paddingBottom: espaco.xxl,
      borderTopWidth: 1,
      borderColor: c.bordaForte,
    },
    puxador: {
      width: 34,
      height: 3,
      borderRadius: 2,
      backgroundColor: c.bordaForte,
      alignSelf: 'center',
      marginBottom: espaco.lg,
    },
    tituloFolha: { ...tipo.carimbo, color: c.textoFraco, marginBottom: espaco.md },

    opcao: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: espaco.md,
      paddingVertical: 13,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.borda,
    },
    opcaoRotulo: { fontSize: 15, color: c.texto, fontWeight: '500' },
    opcaoDetalhe: { ...tipo.legenda, color: c.textoFraco, marginTop: 2 },
  });
