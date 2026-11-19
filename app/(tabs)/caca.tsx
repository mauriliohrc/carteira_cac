import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { espaco, raio, tipo, useCores, useEstilos, type Paleta } from '@/tema';
import { useApp } from '@/estado/AppContext';
import { Secao, Tela, TituloTela } from '@/ui/base';
import { AcoesCabecalho } from '@/ui/AcoesCabecalho';
import { CartaoDocumento } from '@/ui/cartoes';
import { AnalisandoDocumento } from '@/ui/AnalisandoDocumento';
import { useNovoDocumento } from '@/ui/useNovoDocumento';
import type { DocumentoComContexto, TipoDocumento } from '@/domain/tipos';

/**
 * Documentos de caça. Duas áreas fixas, cada uma com seu botão de adicionar
 * (mesma lógica das demais abas de documento): Cadastro no IBAMA e Autorizações
 * de caça em propriedades rurais (locais). Usa tipos de documento que já existem
 * no catálogo (não cria tipo novo → sync seguro com apps antigos).
 */
export default function Caca() {
  const { documentosPessoais } = useApp();
  const { iniciar, analisando } = useNovoDocumento();

  const porTipo = useMemo(() => {
    const ibama = documentosPessoais.filter((d) => d.tipo === 'AUTORIZACAO_IBAMA');
    const locais = documentosPessoais.filter((d) => d.tipo === 'AUTORIZACAO_MANEJO');
    return { ibama, locais };
  }, [documentosPessoais]);

  const novo = (t: TipoDocumento) => void iniciar({ escopo: 'PESSOAL', tipo: t });

  return (
    <Tela sobBarra acao={<AcoesCabecalho />}>
      <TituloTela titulo="Caça" sub="Documentos de caça — de olho nos vencimentos" />

      <AreaDoc
        titulo="Cadastro IBAMA"
        icone="leaf-outline"
        vazioTexto="Adicione seu cadastro/registro no IBAMA (CTF). O app avisa antes de vencer."
        docs={porTipo.ibama}
        aoAdicionar={() => novo('AUTORIZACAO_IBAMA')}
      />

      <AreaDoc
        titulo="Autorizações de Caça (Locais)"
        icone="paw-outline"
        vazioTexto="Adicione as autorizações de caça/manejo em propriedades rurais, com o local de cada uma."
        docs={porTipo.locais}
        aoAdicionar={() => novo('AUTORIZACAO_MANEJO')}
      />

      <AnalisandoDocumento visivel={analisando} />
    </Tela>
  );
}

/** Uma área de documentos (título + botão adicionar + lista ou vazio). */
function AreaDoc({
  titulo,
  icone,
  vazioTexto,
  docs,
  aoAdicionar,
}: {
  titulo: string;
  icone: keyof typeof Ionicons.glyphMap;
  vazioTexto: string;
  docs: DocumentoComContexto[];
  aoAdicionar: () => void;
}) {
  const c = useCores();
  const m = useEstilos(folha);
  const ordenados = docs.slice().sort((a, b) => a.dataValidade.localeCompare(b.dataValidade));

  return (
    <Secao
      titulo={titulo}
      acao={
        <Pressable onPress={aoAdicionar} hitSlop={8} style={m.botaoMais}>
          <Ionicons name="add" size={20} color={c.sobrePrimario} />
        </Pressable>
      }
    >
      {ordenados.length ? (
        ordenados.map((doc) => (
          <CartaoDocumento
            key={doc.id}
            documento={doc}
            mostrarArma={false}
            aoTocar={() => router.push({ pathname: '/documento/[id]', params: { id: doc.id } })}
          />
        ))
      ) : (
        <Pressable onPress={aoAdicionar} style={({ pressed }) => [m.vazio, pressed && { opacity: 0.7 }]}>
          <View style={m.vazioIcone}>
            <Ionicons name={icone} size={20} color={c.primario} />
          </View>
          <Text style={m.vazioTexto}>{vazioTexto}</Text>
          <View style={m.vazioAdd}>
            <Ionicons name="add" size={15} color={c.primario} />
            <Text style={m.vazioAddTexto}>Adicionar</Text>
          </View>
        </Pressable>
      )}
    </Secao>
  );
}

const folha = (c: Paleta) =>
  StyleSheet.create({
    botaoMais: {
      width: 30,
      height: 30,
      borderRadius: raio.sm,
      backgroundColor: c.primario,
      alignItems: 'center',
      justifyContent: 'center',
    },
    vazio: {
      alignItems: 'center',
      gap: espaco.sm,
      padding: espaco.lg,
      borderRadius: raio.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderStyle: 'dashed',
      borderColor: c.bordaForte,
      backgroundColor: c.superficie,
    },
    vazioIcone: {
      width: 44,
      height: 44,
      borderRadius: raio.sm,
      backgroundColor: c.primarioFraco,
      alignItems: 'center',
      justifyContent: 'center',
    },
    vazioTexto: { ...tipo.corpoPequeno, color: c.textoMedio, textAlign: 'center', maxWidth: 300 },
    vazioAdd: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
    vazioAddTexto: { ...tipo.corpoPequeno, fontWeight: '700', color: c.primario },
  });
