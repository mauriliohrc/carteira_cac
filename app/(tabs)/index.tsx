import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';

import { espaco, raio, tipo, useCores, useEstilos, type Paleta } from '@/tema';
import { useApp } from '@/estado/AppContext';
import { Botao, Secao, Tela, Vazio } from '@/ui/base';
import { CartaoDocumento } from '@/ui/cartoes';
import { CartaoConta } from '@/conta/CartaoConta';
import { AcoesCabecalho } from '@/ui/AcoesCabecalho';
import { SecaoNoticiasPainel } from '@/noticias/SecaoNoticiasPainel';
import { SecaoCompeticoesPainel } from '@/competicoes/SecaoCompeticoesPainel';
import { ResumoHabitualidade } from '@/ui/habitualidade';
import { obterFiliacao, filiacaoVigente } from '@/db/filiacoes';
import type { Filiacao } from '@/domain/tipos';

export default function Painel() {
  const c = useCores();
  const p = useEstilos(folha);
  const { armas, documentos, pendencias, premium, progressoHabitualidade, sincronizarAgora } =
    useApp();

  // Filiado vigente mas sem documento → empurra para completar (legados cortesia).
  const [filiacao, setFiliacao] = useState<Filiacao | null>(null);
  useFocusEffect(
    useCallback(() => {
      obterFiliacao().then(setFiliacao).catch(() => {});
    }, [])
  );
  const ehFiliado = !!(filiacao && filiacaoVigente(filiacao));
  const filiacaoPendenteDoc = ehFiliado && !filiacao!.documentacaoCompleta;

  const semNada = armas.length === 0 && documentos.length === 0;

  return (
    <Tela
      sobBarra
      aoAtualizar={sincronizarAgora}
      acao={
        <AcoesCabecalho
          antes={
            !premium ? (
              <Pressable onPress={() => router.push('/premium')} style={p.selo} hitSlop={8}>
                <Ionicons name="star" size={10} color={c.latao} />
                <Text style={p.seloTexto}>PREMIUM</Text>
              </Pressable>
            ) : null
          }
        />
      }
    >
      <CartaoConta />

      {/* Filiação ativa pendente de documento: um toque leva para completar. */}
      {filiacaoPendenteDoc ? (
        <Pressable style={p.filiacaoBanner} onPress={() => router.push('/filiacao/dados')}>
          <View style={p.filiacaoIcone}>
            <Ionicons name="ribbon" size={18} color={c.latao} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={p.filiacaoTitulo}>Complete sua filiação</Text>
            <Text style={p.filiacaoSub}>
              Você é filiado à liga. Envie seu documento de identificação para concluir.
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={c.textoFraco} />
        </Pressable>
      ) : null}

      {/* Habitualidade — só para quem tem acervo de atirador (o único que exige). */}
      {progressoHabitualidade.exigido ? (
        <ResumoHabitualidade
          progresso={progressoHabitualidade}
          aoTocar={() =>
            router.push({ pathname: '/(tabs)/acervo', params: { aba: 'habitualidade' } })
          }
          aoRegistrar={() => router.push('/habitualidade/editar')}
        />
      ) : null}

      {/* Convite à Liga — só para quem ainda não é filiado. Destaque entre a
          habitualidade e as notícias. Leva ao onboarding de filiação. */}
      {!ehFiliado ? (
        <Pressable style={p.liga} onPress={() => router.push('/filiacao')}>
          <View style={p.ligaIcone}>
            <Ionicons name="ribbon" size={22} color={c.latao} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={p.ligaSelo}>LIGA ESPORTIVA</Text>
            <Text style={p.ligaTitulo}>Faça parte da liga</Text>
            <Text style={p.ligaSub}>
              Vínculo anual com validade na PF, provas nacionais, assessoria jurídica e Premium.
            </Text>
          </View>
          <Ionicons name="arrow-forward-circle" size={26} color={c.latao} />
        </Pressable>
      ) : null}

      {/* Precisa de atenção — documentos vencidos/vencendo. Some quando não há nada. */}
      {pendencias.length ? (
        <Secao
          titulo="Precisa de atenção"
          acao={
            <Pressable onPress={() => router.push('/(tabs)/avisos')} hitSlop={10}>
              <Text style={p.verTudo}>Ver tudo</Text>
            </Pressable>
          }
        >
          {pendencias.slice(0, 5).map((doc) => (
            <CartaoDocumento
              key={doc.id}
              documento={doc}
              aoTocar={() => router.push({ pathname: '/documento/[id]', params: { id: doc.id } })}
            />
          ))}
        </Secao>
      ) : null}

      <SecaoCompeticoesPainel />

      <SecaoNoticiasPainel />

      {/* Primeiro acesso: um empurrão para começar o acervo. */}
      {semNada ? (
        <Vazio
          icone="shield-checkmark-outline"
          titulo="Sua carteira começa aqui"
          descricao="Cadastre uma arma, anexe o CRAF e o app passa a te avisar todo dia no último mês antes do vencimento."
          acao={
            <Botao
              titulo="Cadastrar primeira arma"
              icone="add"
              aoTocar={() => router.push('/arma/editar')}
            />
          }
        />
      ) : null}
    </Tela>
  );
}

const folha = (c: Paleta) =>
  StyleSheet.create({
    selo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: c.lataoFraco,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: `${c.latao}88`,
      paddingHorizontal: espaco.sm,
      paddingVertical: 5,
      borderRadius: raio.sm,
    },
    seloTexto: { ...tipo.etiqueta, fontSize: 9, color: c.latao },
    verTudo: { fontSize: 12.5, fontWeight: '600', color: c.primario },
    filiacaoBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: espaco.md,
      marginTop: espaco.md,
      padding: espaco.lg,
      borderRadius: raio.md,
      backgroundColor: c.lataoFraco,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: `${c.latao}88`,
    },
    filiacaoIcone: {
      width: 34,
      height: 34,
      borderRadius: raio.sm,
      backgroundColor: `${c.latao}22`,
      alignItems: 'center',
      justifyContent: 'center',
    },
    filiacaoTitulo: { ...tipo.subtitulo, color: c.texto },
    filiacaoSub: { ...tipo.corpoPequeno, color: c.textoMedio, marginTop: 2 },
    liga: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: espaco.md,
      marginTop: espaco.md,
      padding: espaco.lg,
      borderRadius: raio.md,
      backgroundColor: c.lataoFraco,
      borderWidth: 1,
      borderColor: `${c.latao}88`,
    },
    ligaIcone: {
      width: 40,
      height: 40,
      borderRadius: raio.sm,
      backgroundColor: `${c.latao}22`,
      alignItems: 'center',
      justifyContent: 'center',
    },
    ligaSelo: { ...tipo.etiqueta, fontSize: 9, color: c.latao, marginBottom: 2 },
    ligaTitulo: { ...tipo.subtitulo, color: c.texto },
    ligaSub: { ...tipo.corpoPequeno, color: c.textoMedio, marginTop: 2 },
  });
