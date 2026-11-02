import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { espaco, raio, tipo, useCores, useEstilos, type Paleta } from '@/tema';
import { Botao } from '@/ui/base';
import { useApp } from '@/estado/AppContext';
import { useNovoDocumento } from '@/ui/useNovoDocumento';
import { AnalisandoDocumento } from '@/ui/AnalisandoDocumento';

/**
 * Onboarding adicional de acervo (mostrado uma vez para quem ainda não tem
 * nenhuma arma). Guia, sem ser invasivo, o cadastro de CR/Posse-Porte e das
 * armas. Em vez de reimplementar formulários, LANÇA os editores que já existem
 * (`documento/editar`, `arma/editar`), que cuidam da extração por IA e do
 * cadastro. A pessoa pode pular em qualquer passo.
 *
 * Fluxo:
 *   início → "CR ou Posse/Porte?"
 *     CR          → cadastrar CR → armamento (CRAF/Guias via ficha da arma)
 *     POSSE/PORTE → cadastrar CRAF das armas (via ficha da arma)
 */
type Etapa = 'inicio' | 'cr' | 'arma';
type Perfil = 'CR' | 'POSSE_PORTE';

export default function AcervoOnboarding() {
  const c = useCores();
  const p = useEstilos(folha);
  const inset = useSafeAreaInsets();
  const { armas, documentos } = useApp();
  const { iniciar, analisando } = useNovoDocumento();

  const [etapa, setEtapa] = useState<Etapa>('inicio');
  const [perfil, setPerfil] = useState<Perfil | null>(null);

  const temCR = documentos.some((d) => d.tipo === 'CR');
  const qtdArmas = armas.length;

  const concluir = () => router.back();

  const escolher = (valor: Perfil) => {
    setPerfil(valor);
    setEtapa(valor === 'CR' ? 'cr' : 'arma');
  };

  return (
    <View style={[p.fundo, { paddingTop: inset.top + espaco.lg, paddingBottom: inset.bottom + espaco.lg }]}>
      <ScrollView contentContainerStyle={p.conteudo} showsVerticalScrollIndicator={false}>
        <View style={p.selo}>
          <Ionicons name="shield-checkmark" size={28} color={c.primario} />
          <Text style={p.seloTexto}>VAMOS ORGANIZAR SEU ACERVO</Text>
        </View>

        {etapa === 'inicio' ? (
          <>
            <Text style={p.titulo}>Você possui CR ou{'\n'}Posse/Porte?</Text>
            <Text style={p.sub}>
              Isso ajuda a montar seu cadastro do jeito certo. Leva menos de um minuto — e dá para
              pular se preferir cadastrar depois.
            </Text>
            <View style={p.opcoes}>
              <Opcao
                p={p}
                c={c}
                icone="ribbon-outline"
                titulo="Tenho CR"
                descricao="Colecionador, Atirador ou Caçador (SIGMA / Exército)"
                aoTocar={() => escolher('CR')}
              />
              <Opcao
                p={p}
                c={c}
                icone="shield-outline"
                titulo="Posse ou Porte"
                descricao="Defesa pessoal (SINARM / Polícia Federal)"
                aoTocar={() => escolher('POSSE_PORTE')}
              />
            </View>
          </>
        ) : null}

        {etapa === 'cr' ? (
          <>
            <Text style={p.titulo}>Cadastre seu CR</Text>
            <Text style={p.sub}>
              Envie a foto ou o PDF do seu Certificado de Registro — a gente lê e preenche os dados
              para você. Prefere digitar? Dá para preencher manualmente.
            </Text>
            {temCR ? (
              <View style={p.feito}>
                <Ionicons name="checkmark-circle" size={20} color={c.primario} />
                <Text style={p.feitoTexto}>CR cadastrado</Text>
              </View>
            ) : null}
            <View style={p.acoes}>
              <Botao
                titulo="Enviar documento do CR"
                icone="scan-outline"
                aoTocar={() => void iniciar({ escopo: 'PESSOAL', tipo: 'CR' })}
              />
              <Botao
                titulo="Preencher manualmente"
                variante="secundario"
                icone="create-outline"
                aoTocar={() =>
                  router.push({ pathname: '/documento/editar', params: { escopo: 'PESSOAL', tipo: 'CR' } })
                }
                estilo={{ marginTop: espaco.sm }}
              />
            </View>
          </>
        ) : null}

        {etapa === 'arma' ? (
          <>
            <Text style={p.titulo}>
              {perfil === 'CR' ? 'Você possui algum armamento?' : 'Cadastre o CRAF das suas armas'}
            </Text>
            <Text style={p.sub}>
              {perfil === 'CR'
                ? 'Se já tem armas, cadastre cada uma — depois é só anexar o CRAF e as guias de tráfego na ficha da arma.'
                : 'Cadastre cada arma e anexe o CRAF na ficha dela. A gente lê o documento e preenche os dados.'}
            </Text>
            {qtdArmas > 0 ? (
              <View style={p.feito}>
                <Ionicons name="checkmark-circle" size={20} color={c.primario} />
                <Text style={p.feitoTexto}>
                  {qtdArmas} arma{qtdArmas > 1 ? 's' : ''} cadastrada{qtdArmas > 1 ? 's' : ''}
                </Text>
              </View>
            ) : null}
            <View style={p.acoes}>
              <Botao
                titulo={qtdArmas > 0 ? 'Cadastrar outra arma' : 'Cadastrar arma'}
                icone="add"
                aoTocar={() => router.push('/arma/editar')}
              />
            </View>
          </>
        ) : null}
      </ScrollView>

      <View style={p.rodape}>
        {etapa === 'cr' ? (
          <Botao titulo="Continuar" icone="arrow-forward" aoTocar={() => setEtapa('arma')} />
        ) : null}
        {etapa === 'arma' ? <Botao titulo="Concluir" icone="checkmark" aoTocar={concluir} /> : null}
        <Botao
          titulo={etapa === 'inicio' ? 'Agora não' : 'Pular por enquanto'}
          variante="fantasma"
          aoTocar={concluir}
          estilo={{ marginTop: espaco.xs }}
        />
        <Text style={p.rodapeNota}>Você pode cadastrar tudo depois, direto no acervo.</Text>
      </View>

      <AnalisandoDocumento visivel={analisando} />
    </View>
  );
}

function Opcao({
  p,
  c,
  icone,
  titulo,
  descricao,
  aoTocar,
}: {
  p: ReturnType<typeof useEstilos<ReturnType<typeof folha>>>;
  c: ReturnType<typeof useCores>;
  icone: keyof typeof Ionicons.glyphMap;
  titulo: string;
  descricao: string;
  aoTocar: () => void;
}) {
  return (
    <Pressable onPress={aoTocar} style={({ pressed }) => [p.opcao, pressed && { opacity: 0.7 }]}>
      <Ionicons name={icone} size={24} color={c.primario} />
      <View style={{ flex: 1 }}>
        <Text style={p.opcaoTitulo}>{titulo}</Text>
        <Text style={p.opcaoDesc}>{descricao}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={c.textoFraco} />
    </Pressable>
  );
}

const folha = (c: Paleta) =>
  StyleSheet.create({
    fundo: { flex: 1, backgroundColor: c.fundo, paddingHorizontal: espaco.xl },
    conteudo: { flexGrow: 1, justifyContent: 'center', paddingVertical: espaco.xl },
    selo: {
      alignSelf: 'center',
      flexDirection: 'row',
      alignItems: 'center',
      gap: espaco.sm,
      paddingHorizontal: espaco.lg,
      paddingVertical: espaco.sm,
      borderRadius: raio.lg,
      backgroundColor: c.primarioFraco,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: `${c.primario}66`,
      marginBottom: espaco.xl,
    },
    seloTexto: { ...tipo.etiqueta, fontSize: 11.5, letterSpacing: 1.5, color: c.primario, fontWeight: '800' },
    titulo: { ...tipo.titulo, fontSize: 25, color: c.texto, textAlign: 'center' },
    sub: {
      ...tipo.corpo,
      color: c.textoMedio,
      textAlign: 'center',
      marginTop: espaco.md,
      lineHeight: 22,
    },
    opcoes: { marginTop: espaco.xxl, gap: espaco.md },
    opcao: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: espaco.md,
      padding: espaco.lg,
      borderRadius: raio.lg,
      backgroundColor: c.superficie,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.borda,
    },
    opcaoTitulo: { ...tipo.subtitulo, fontSize: 16, color: c.texto },
    opcaoDesc: { ...tipo.legenda, color: c.textoMedio, marginTop: 2 },
    acoes: { marginTop: espaco.xxl },
    feito: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: espaco.sm,
      marginTop: espaco.lg,
    },
    feitoTexto: { ...tipo.corpo, color: c.primario, fontWeight: '700' },
    rodape: { paddingTop: espaco.md },
    rodapeNota: {
      ...tipo.legenda,
      color: c.textoFraco,
      textAlign: 'center',
      marginTop: espaco.sm,
    },
  });
