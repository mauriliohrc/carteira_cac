import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { espaco, raio, tipo, useCores, useEstilos, type Paleta } from '@/tema';
import { useApp } from '@/estado/AppContext';
import { Botao, Secao, Tela, Vazio } from '@/ui/base';
import { CartaoDocumento } from '@/ui/cartoes';
import { CartaoConta } from '@/conta/CartaoConta';
import { SecaoNoticiasPainel } from '@/noticias/SecaoNoticiasPainel';
import { SecaoCompeticoesPainel } from '@/competicoes/SecaoCompeticoesPainel';
import { ResumoHabitualidade } from '@/ui/habitualidade';

export default function Painel() {
  const c = useCores();
  const p = useEstilos(folha);
  const { armas, documentos, pendencias, premium, progressoHabitualidade, sincronizarAgora } =
    useApp();

  const semNada = armas.length === 0 && documentos.length === 0;

  return (
    <Tela
      sobBarra
      aoAtualizar={sincronizarAgora}
      acao={
        !premium ? (
          <Pressable onPress={() => router.push('/premium')} style={p.selo} hitSlop={8}>
            <Ionicons name="star" size={10} color={c.latao} />
            <Text style={p.seloTexto}>PREMIUM</Text>
          </Pressable>
        ) : null
      }
    >
      <CartaoConta />

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
  });
