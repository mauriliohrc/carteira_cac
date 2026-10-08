import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { espaco, MONO, tipo, useCores, useEstilos, type Paleta } from '@/tema';
import { useApp } from '@/estado/AppContext';
import { Botao, Cartao, Secao } from '@/ui/base';
import { CartaoSessao, LinhaGrupo } from '@/ui/habitualidade';
import { isoParaBR } from '@/lib/data';
import { MESES_JANELA, MINIMO_POR_GRUPO } from '@/domain/habitualidade';

/** Quantas sessões aparecem no histórico da aba. */
const NO_HISTORICO = 8;

/**
 * Andamento da habitualidade.
 *
 * Responde a uma pergunta só: **em quais grupos eu ainda devo sessão?** Por
 * isso o andamento por grupo vem antes do histórico — o histórico é consulta, o
 * andamento é o que faz o atirador ir ao clube.
 */
export function ConteudoHabitualidade({ aoRegistrar }: { aoRegistrar: () => void }) {
  const c = useCores();
  const s = useEstilos(folha);
  const { habitualidades, progressoHabitualidade: p } = useApp();

  const g = p.generico;
  const tudoEmDia = p.exigido && (g ? g.cumprido : p.cumpridos === p.grupos.length);
  const algumProgresso = g ? g.feitas > 0 : p.cumpridos > 0;
  const corStatus = !p.exigido
    ? c.info
    : tudoEmDia
      ? c.primario
      : algumProgresso
        ? c.aviso
        : c.perigo;

  const statusTitulo = !p.exigido
    ? 'Habitualidade não exigida'
    : g
      ? g.cumprido
        ? 'Habitualidade em dia'
        : `Faltam ${g.faltam} sessões`
      : tudoEmDia
        ? 'Habitualidade em dia'
        : `Faltam ${p.faltamTotal} sessões`;

  const statusSub = !p.exigido
    ? 'Acervo só de defesa pessoal não exige habitualidade. Cadastre uma arma de atirador para acompanhar a habitualidade por grupo.'
    : g
      ? g.cumprido
        ? `Suas ${MINIMO_POR_GRUPO} sessões dos últimos 12 meses estão em dia.`
        : `Você ainda não tem arma de atirador: faça ${MINIMO_POR_GRUPO} sessões de qualquer grupo, treinando com arma do clube. ${g.feitas}/${MINIMO_POR_GRUPO} feitas.`
      : tudoEmDia
        ? `Os ${p.grupos.length} grupos do seu acervo de atirador têm as ${MINIMO_POR_GRUPO} sessões.`
        : `${p.cumpridos} de ${p.grupos.length} grupos do acervo de atirador estão em dia.`;

  return (
    <>
      <Cartao estilo={s.status}>
        <View style={[s.faixa, { backgroundColor: corStatus }]} />
        <View style={s.statusTopo}>
          <Ionicons
            name={
              !p.exigido
                ? 'information-circle-outline'
                : tudoEmDia
                  ? 'checkmark-circle-outline'
                  : 'alert-circle-outline'
            }
            size={24}
            color={corStatus}
          />
          <View style={{ flex: 1 }}>
            <Text style={s.statusTitulo}>{statusTitulo}</Text>
            <Text style={s.statusSub}>{statusSub}</Text>
          </View>
        </View>

        {p.exigido ? (
          g ? (
            <View style={s.numeros}>
              <Numero valor={g.feitas} rotulo="Feitas" cor={c.primario} />
              <Numero valor={g.faltam} rotulo="Faltam" cor={c.perigo} />
              <Numero valor={MINIMO_POR_GRUPO} rotulo="Mínimo" cor={c.textoMedio} />
            </View>
          ) : (
            <View style={s.numeros}>
              <Numero valor={p.grupos.length} rotulo="Grupos" cor={c.texto} />
              <Numero valor={p.cumpridos} rotulo="Em dia" cor={c.primario} />
              <Numero valor={p.grupos.length - p.cumpridos} rotulo="Pendentes" cor={c.perigo} />
              <Numero valor={p.sessoesNaJanela} rotulo="Sessões" cor={c.textoMedio} />
            </View>
          )
        ) : null}

        <Text style={s.janela}>
          JANELA EM VIGOR · {isoParaBR(p.inicio)} A {isoParaBR(p.hoje)}
        </Text>
      </Cartao>

      {p.exigido ? (
        g ? (
          <Secao titulo="Andamento">
            <LinhaGrupo progresso={g} rotulo="Habitualidade (qualquer grupo)" />
            <Text style={s.nota}>
              Sem arma de atirador, as {MINIMO_POR_GRUPO} sessões valem de qualquer grupo — você
              treina com a arma do clube. Ao cadastrar uma arma de atirador, a contagem passa a ser
              por grupo.
            </Text>
          </Secao>
        ) : (
          <Secao titulo="Andamento por grupo">
            {p.grupos.map((grupo) => (
              <LinhaGrupo key={grupo.grupo} progresso={grupo} />
            ))}
            <Text style={s.nota}>
              Um grupo só é cobrado se houver arma dele no acervo de atirador. Uma sessão com duas
              armas do mesmo grupo vale uma habitualidade; com armas de grupos diferentes, vale uma
              em cada.
            </Text>
          </Secao>
        )
      ) : null}

      <Secao
        titulo="Registros"
        acao={
          <Pressable onPress={() => router.push('/habitualidade/locais')} hitSlop={10}>
            <Text style={s.acaoSecao}>Locais</Text>
          </Pressable>
        }
      >
        {habitualidades.length ? (
          <>
            {habitualidades.slice(0, NO_HISTORICO).map((sessao) => (
              <CartaoSessao
                key={sessao.id}
                sessao={sessao}
                aoTocar={() =>
                  router.push({
                    pathname: '/habitualidade/editar',
                    params: { id: sessao.id },
                  })
                }
              />
            ))}
            {habitualidades.length > NO_HISTORICO ? (
              <Text style={s.nota}>
                Mostrando as {NO_HISTORICO} mais recentes de {habitualidades.length} registradas.
              </Text>
            ) : null}
          </>
        ) : (
          <Cartao plano>
            <Text style={s.vazioTexto}>
              Nenhuma sessão registrada. Depois do treino, toque em + , marque as armas que você
              usou e o app credita os grupos sozinho.
            </Text>
            <Botao
              titulo="Registrar habitualidade"
              icone="add"
              aoTocar={aoRegistrar}
              estilo={{ marginTop: espaco.lg }}
            />
          </Cartao>
        )}
      </Secao>

      <Text style={s.rodape}>
        {g
          ? `Mínimo de ${MINIMO_POR_GRUPO} sessões nos últimos ${MESES_JANELA} meses.`
          : `Mínimo de ${MINIMO_POR_GRUPO} sessões por grupo nos últimos ${MESES_JANELA} meses.`}
      </Text>
    </>
  );
}

function Numero({ valor, rotulo, cor }: { valor: number; rotulo: string; cor: string }) {
  const c = useCores();
  const s = useEstilos(folha);
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={[s.numeroValor, { color: valor ? cor : c.textoFraco }]}>{valor}</Text>
      <Text style={s.numeroRotulo}>{rotulo.toUpperCase()}</Text>
    </View>
  );
}

const folha = (c: Paleta) =>
  StyleSheet.create({
    status: { marginTop: espaco.lg, paddingLeft: espaco.lg + 6, overflow: 'hidden' },
    faixa: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3 },
    statusTopo: { flexDirection: 'row', alignItems: 'center', gap: espaco.md },
    statusTitulo: { ...tipo.titulo, color: c.texto },
    statusSub: { ...tipo.legenda, color: c.textoFraco, marginTop: 3 },
    numeros: {
      flexDirection: 'row',
      marginTop: espaco.lg,
      paddingTop: espaco.lg,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.borda,
    },
    numeroValor: { ...tipo.numero, fontSize: 21 },
    numeroRotulo: { ...tipo.etiqueta, fontSize: 9, color: c.textoFraco, marginTop: 3 },
    janela: {
      ...tipo.etiqueta,
      fontSize: 9,
      color: c.textoFraco,
      marginTop: espaco.lg,
      textAlign: 'center',
      fontFamily: MONO,
      letterSpacing: 0.2,
    },

    acaoSecao: { fontSize: 12.5, fontWeight: '600', color: c.primario },
    nota: { ...tipo.legenda, color: c.textoFraco, marginTop: espaco.sm },
    vazioTexto: { ...tipo.corpoPequeno, color: c.textoMedio },
    rodape: { ...tipo.legenda, color: c.textoFraco, textAlign: 'center', marginTop: espaco.xl },
  });
