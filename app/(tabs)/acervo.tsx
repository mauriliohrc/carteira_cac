import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { espaco, raio, tipo, useCores, useEstilos, type Paleta } from '@/tema';
import { useApp } from '@/estado/AppContext';
import { Sobreposicao, Tela, TituloTela } from '@/ui/base';
import { escolher } from '@/ui/dialogo';
import { escolherDocumento } from '@/arquivos/cofre';
import { extrairCamposDoArquivo } from '@/integracoes/extracao';
import { BotaoSino } from '@/ui/BotaoSino';
import { ConteudoAcervo } from '@/ui/ConteudoAcervo';
import { ConteudoHabitualidade } from '@/ui/ConteudoHabitualidade';
import { DuasColunas } from '@/ui/layout/DuasColunas';
import { useLargura } from '@/ui/layout/useLargura';
import { useFolgaBarra } from '@/ui/BarraAbas';
import { FichaArma } from '@/ui/detalhe/FichaArma';
import { LIMITE_GRATUITO_ARMAS, podeCadastrarArma } from '@/billing';
import { MESES_JANELA, MINIMO_POR_GRUPO } from '@/domain/habitualidade';

type Aba = 'ARMAS' | 'HABITUALIDADE';

/**
 * Acervo e habitualidade na mesma aba.
 *
 * As duas falam da mesma coisa — as armas —, então dividir a barra inferior
 * entre elas gastava uma das cinco posições para repetir o mesmo assunto. Aqui
 * o assunto é um, e as duas faces dele trocam por um seletor no topo: o acervo
 * (o que eu tenho) e a habitualidade (o que eu devo por causa do que tenho).
 */
export default function TelaAcervo() {
  const c = useCores();
  const s = useEstilos(folha);
  const { armas, premium, progressoHabitualidade, gerenciarHabitualidade, sincronizarAgora } =
    useApp();
  const { aba: abaPedida } = useLocalSearchParams<{ aba?: string }>();

  const [aba, setAba] = useState<Aba>(abaPedida === 'habitualidade' ? 'HABITUALIDADE' : 'ARMAS');

  // A aba fica montada quando o usuário sai dela, então um novo push com
  // `aba=habitualidade` (o atalho do painel) precisa trocar o seletor.
  useEffect(() => {
    if (abaPedida === 'habitualidade') setAba('HABITUALIDADE');
    else if (abaPedida === 'armas') setAba('ARMAS');
  }, [abaPedida]);

  // Tela larga (iPad, iPhone Duo aberto, tablet Android): acervo vira painel
  // master-detail (lista + ficha). No telefone segue empilhado (push).
  const { duasColunas } = useLargura();
  const folgaBarra = useFolgaBarra();
  const insets = useSafeAreaInsets();
  const [selArma, setSelArma] = useState<string | null>(null);

  // Com o acompanhamento desligado nas configurações, a habitualidade some: o
  // seletor nem aparece e a aba cai sempre no acervo.
  const ehHabitualidade = gerenciarHabitualidade && aba === 'HABITUALIDADE';
  const podeAdicionar = podeCadastrarArma(armas.length, premium);
  const [analisando, setAnalisando] = useState(false);

  // Fluxo "CRAF primeiro": escolhe o arquivo, a IA lê e abre o formulário já
  // preenchido para revisão (que anexa o CRAF ao salvar). Pular = manual.
  const cadastrarComCraf = async () => {
    const escolhido = await escolherDocumento();
    if (!escolhido) return;
    setAnalisando(true);
    let campos = {};
    try {
      campos = await extrairCamposDoArquivo(escolhido.uri, escolhido.mime ?? '', 'CRAF');
    } catch {
      /* IA é best-effort: sem campos, o usuário preenche na mão */
    } finally {
      setAnalisando(false);
    }
    router.push({
      pathname: '/arma/editar',
      params: {
        campos: JSON.stringify(campos),
        crafUri: escolhido.uri,
        crafNome: escolhido.nome,
        crafMime: escolhido.mime ?? '',
        crafTamanho: escolhido.tamanho != null ? String(escolhido.tamanho) : '',
      },
    });
  };

  const adicionar = () => {
    if (ehHabitualidade) {
      router.push('/habitualidade/editar');
      return;
    }
    if (!podeAdicionar) {
      router.push('/premium');
      return;
    }
    void escolher(
      'Cadastrar armamento',
      'Envie o CRAF (PDF ou foto) e a IA preenche a arma sozinha — ou prefira preencher manualmente.',
      [
        { rotulo: 'Enviar CRAF (preenche sozinho)', icone: 'sparkles-outline', acao: cadastrarComCraf },
        { rotulo: 'Preencher manualmente', icone: 'create-outline', acao: () => router.push('/arma/editar') },
      ]
    );
  };

  // No seletor, o que importa é o que exige ação: quantos grupos estão
  // pendentes. Sem pendência, nenhum número — o silêncio já é a boa notícia.
  const pendentes = !progressoHabitualidade.exigido
    ? 0
    : progressoHabitualidade.generico
      ? progressoHabitualidade.generico.cumprido
        ? 0
        : 1
      : progressoHabitualidade.grupos.length - progressoHabitualidade.cumpridos;

  // Two-pane só na aba de armas e com acervo não vazio.
  const usarDuas = duasColunas && !ehHabitualidade && armas.length > 0;
  const selId = usarDuas
    ? selArma && armas.some((a) => a.id === selArma)
      ? selArma
      : armas[0].id
    : null;

  const cabecalho = (
    <>
      <View style={s.topo}>
        <View style={{ flex: 1 }}>
          {ehHabitualidade ? (
            <TituloTela
              titulo="Habitualidade"
              sub={`Mínimo de ${MINIMO_POR_GRUPO} sessões por grupo em ${MESES_JANELA} meses`}
            />
          ) : (
            <TituloTela
              titulo="Acervo"
              sub={`${armas.length} arma${armas.length === 1 ? '' : 's'}${
                !premium ? ` · limite grátis ${LIMITE_GRATUITO_ARMAS}` : ''
              }`}
            />
          )}
        </View>
        <Pressable
          onPress={adicionar}
          accessibilityRole="button"
          accessibilityLabel={ehHabitualidade ? 'Registrar habitualidade' : 'Cadastrar arma'}
          style={({ pressed }) => [s.botaoMais, pressed && { opacity: 0.7 }]}
        >
          <Ionicons
            name={!ehHabitualidade && !podeAdicionar ? 'lock-closed' : 'add'}
            size={21}
            color={c.sobrePrimario}
          />
        </Pressable>
      </View>

      {gerenciarHabitualidade ? (
        <View style={s.seletor}>
          <Segmento
            rotulo="Acervo"
            icone="albums-outline"
            ativo={!ehHabitualidade}
            aoTocar={() => setAba('ARMAS')}
          />
          <Segmento
            rotulo="Habitualidade"
            icone="locate-outline"
            ativo={ehHabitualidade}
            badge={pendentes}
            aoTocar={() => setAba('HABITUALIDADE')}
          />
        </View>
      ) : null}
    </>
  );

  // Painel master-detail (tablet / Duo aberto): lista rola à esquerda, ficha à
  // direita. Sem a ScrollView única da Tela — cada coluna rola por si.
  if (usarDuas && selId) {
    return (
      <Tela
        sobBarra
        rolavel={false}
        acao={<BotaoSino />}
        estilo={{ paddingLeft: insets.left, paddingRight: insets.right }}
      >
        <View style={{ paddingHorizontal: espaco.lg }}>{cabecalho}</View>
        <DuasColunas
          lista={
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{
                paddingLeft: espaco.lg,
                paddingRight: espaco.md,
                paddingTop: espaco.md,
                paddingBottom: folgaBarra,
              }}
            >
              <ConteudoAcervo
                aoAdicionar={adicionar}
                aoSelecionar={setSelArma}
                selecionadoId={selId}
                compacto
              />
            </ScrollView>
          }
          detalhe={<FichaArma id={selId} embutido />}
        />
        <Sobreposicao visivel={analisando} texto="Analisando o CRAF…" />
      </Tela>
    );
  }

  return (
    <Tela sobBarra aoAtualizar={sincronizarAgora} acao={<BotaoSino />}>
      {cabecalho}
      {ehHabitualidade ? (
        <ConteudoHabitualidade aoRegistrar={() => router.push('/habitualidade/editar')} />
      ) : (
        <ConteudoAcervo aoAdicionar={adicionar} />
      )}
      <Sobreposicao visivel={analisando} texto="Analisando o CRAF…" />
    </Tela>
  );
}

function Segmento({
  rotulo,
  icone,
  ativo,
  badge,
  aoTocar,
}: {
  rotulo: string;
  icone: keyof typeof Ionicons.glyphMap;
  ativo: boolean;
  badge?: number;
  aoTocar: () => void;
}) {
  const c = useCores();
  const s = useEstilos(folha);
  const nome = (ativo ? icone.replace(/-outline$/, '') : icone) as keyof typeof Ionicons.glyphMap;

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: ativo }}
      onPress={aoTocar}
      style={({ pressed }) => [
        s.segmento,
        ativo ? s.segmentoAtivo : null,
        pressed ? { opacity: 0.7 } : null,
      ]}
    >
      <Ionicons name={nome} size={15} color={ativo ? c.primario : c.textoFraco} />
      <Text style={[s.segmentoTexto, ativo ? s.segmentoTextoAtivo : null]} numberOfLines={1}>
        {rotulo}
      </Text>
      {badge ? (
        <View style={s.badge}>
          <Text style={s.badgeTexto}>{badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const folha = (c: Paleta) =>
  StyleSheet.create({
    topo: { flexDirection: 'row', alignItems: 'center', gap: espaco.md },
    botaoMais: {
      width: 42,
      height: 42,
      borderRadius: raio.sm,
      backgroundColor: c.primario,
      alignItems: 'center',
      justifyContent: 'center',
    },

    seletor: {
      flexDirection: 'row',
      gap: 6,
      marginTop: espaco.lg,
      padding: 4,
      borderRadius: raio.sm + 4,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.borda,
      backgroundColor: c.nome === 'claro' ? c.superficieAlta : c.superficie,
    },
    segmento: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 9,
      borderRadius: raio.sm,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: 'transparent',
    },
    segmentoAtivo: { borderColor: `${c.primario}55`, backgroundColor: c.primarioFraco },
    segmentoTexto: { fontSize: 13, fontWeight: '600', color: c.textoFraco, flexShrink: 1 },
    segmentoTextoAtivo: { color: c.primario },
    badge: {
      minWidth: 17,
      height: 17,
      paddingHorizontal: 4,
      borderRadius: 9,
      backgroundColor: c.perigo,
      alignItems: 'center',
      justifyContent: 'center',
    },
    badgeTexto: { fontSize: 10, fontWeight: '800', color: '#FFF', includeFontPadding: false },
  });
