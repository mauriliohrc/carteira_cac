import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { espaco, MONO, raio, tipo, useCores, useEstilos, type Paleta } from '@/tema';
import { isoParaBR } from '@/lib/data';
import { GRUPO_POR_VALOR, TIPO_SESSAO_POR_VALOR } from '@/domain/catalogos';
import {
  gruposDaSessao,
  MINIMO_POR_GRUPO,
  type ProgressoGrupo,
  type ProgressoHabitualidade,
} from '@/domain/habitualidade';
import type { Habitualidade } from '@/domain/tipos';
import { Etiqueta } from './base';

/**
 * Semáforo de três degraus: em dia, começou, não começou.
 *
 * Verde só quando o grupo tem as 8 — não existe "quase em dia" perante a
 * fiscalização, então o latão cobre todo o meio do caminho e o vermelho fica
 * para quem não registrou nada nos 12 meses.
 */
export function corDoGrupo(p: ProgressoGrupo, c: Paleta): { cor: string; fundo: string } {
  if (p.cumprido) return { cor: c.primario, fundo: c.primarioFraco };
  if (p.feitas === 0) return { cor: c.perigo, fundo: c.perigoFraco };
  return { cor: c.aviso, fundo: c.avisoFraco };
}

/**
 * As 8 sessões como 8 marcas contáveis, e não como barra de porcentagem.
 *
 * A exigência é um número inteiro e pequeno: o atirador quer bater o olho e
 * saber quantas faltam, não ler "62%". Por isso a marca é discreta e conta —
 * as cheias à esquerda, as vazias à direita.
 */
export function Marcas({ feitas, cor }: { feitas: number; cor: string }) {
  const h = useEstilos(folha);
  return (
    <View style={h.marcas}>
      {Array.from({ length: MINIMO_POR_GRUPO }, (_, i) => (
        <View
          key={i}
          style={[h.marca, i < feitas ? { backgroundColor: cor, borderColor: cor } : null]}
        />
      ))}
    </View>
  );
}

/** Uma linha do andamento: grupo, contagem, marcas e o que isso significa. */
export function LinhaGrupo({ progresso }: { progresso: ProgressoGrupo }) {
  const c = useCores();
  const h = useEstilos(folha);
  const { cor, fundo } = corDoGrupo(progresso, c);
  const grupo = GRUPO_POR_VALOR[progresso.grupo];
  const extras = Math.max(0, progresso.feitas - MINIMO_POR_GRUPO);

  const situacao = progresso.cumprido
    ? `Em dia até ${isoParaBR(progresso.perdeEm)}`
    : progresso.feitas === 0
      ? 'Nenhuma sessão nos últimos 12 meses'
      : `Faltam ${progresso.faltam}`;

  return (
    <View style={[h.linha, { borderLeftColor: cor, backgroundColor: fundo }]}>
      <View style={h.linhaTopo}>
        <Ionicons
          name={progresso.cumprido ? 'checkmark-circle' : 'ellipse-outline'}
          size={15}
          color={cor}
        />
        <Text style={h.grupoNome} numberOfLines={1}>
          {grupo?.curto ?? progresso.grupo}
        </Text>
        <Text style={[h.contagem, { color: cor }]}>
          {Math.min(progresso.feitas, MINIMO_POR_GRUPO)}/{MINIMO_POR_GRUPO}
        </Text>
        {extras ? <Text style={h.extras}>+{extras}</Text> : null}
      </View>

      <Marcas feitas={progresso.feitas} cor={cor} />

      <View style={h.linhaRodape}>
        <Text style={[h.situacao, { color: cor }]} numberOfLines={1}>
          {situacao}
        </Text>
        <Text style={h.ultima}>
          {progresso.ultima ? `última ${isoParaBR(progresso.ultima)}` : '—'}
        </Text>
      </View>
    </View>
  );
}

/**
 * Resumo de uma linha para o painel: um ponto por grupo exigido, na cor do
 * semáforo. Cabe no canto do olho e leva para a aba com um toque.
 */
export function ResumoHabitualidade({
  progresso,
  aoTocar,
  aoRegistrar,
}: {
  progresso: ProgressoHabitualidade;
  aoTocar: () => void;
  /** Atalho para registrar direto do painel, sem passar pela aba. */
  aoRegistrar?: () => void;
}) {
  const c = useCores();
  const h = useEstilos(folha);
  const total = progresso.grupos.length;
  const tudoEmDia = progresso.cumpridos === total;
  const cor = tudoEmDia ? c.primario : progresso.cumpridos ? c.aviso : c.perigo;

  return (
    <Pressable
      onPress={aoTocar}
      style={({ pressed }) => [h.resumo, pressed ? { opacity: 0.68 } : null]}
    >
      <View style={[h.resumoIcone, { backgroundColor: `${cor}1A`, borderColor: `${cor}44` }]}>
        <Ionicons name="locate" size={17} color={cor} />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={h.resumoTitulo}>Habitualidade</Text>
        <Text style={h.resumoSub} numberOfLines={1}>
          {tudoEmDia
            ? `${total} grupo${total > 1 ? 's' : ''} em dia nos últimos 12 meses`
            : `${progresso.cumpridos}/${total} grupos em dia · faltam ${progresso.faltamTotal} sessões`}
        </Text>
        <View style={h.pontos}>
          {progresso.grupos.map((g) => (
            <View
              key={g.grupo}
              style={[h.ponto, { backgroundColor: corDoGrupo(g, c).cor }]}
            />
          ))}
        </View>
      </View>

      {/* A ação fica ao lado do motivo dela: quem vê "faltam 5" registra ali
          mesmo, sem abrir a aba. O resto da linha continua levando para o
          andamento completo. */}
      {aoRegistrar ? (
        <Pressable
          onPress={aoRegistrar}
          accessibilityRole="button"
          accessibilityLabel="Registrar habitualidade"
          hitSlop={8}
          style={({ pressed }) => [h.registrar, pressed ? { opacity: 0.65 } : null]}
        >
          <Ionicons name="add" size={14} color={c.primario} />
          <Text style={h.registrarTexto}>Registrar</Text>
        </Pressable>
      ) : (
        <Ionicons name="chevron-forward" size={17} color={c.textoFraco} />
      )}
    </Pressable>
  );
}

/** Uma sessão registrada, como ela aparece no histórico. */
export function CartaoSessao({
  sessao,
  aoTocar,
}: {
  sessao: Habitualidade;
  aoTocar: () => void;
}) {
  const c = useCores();
  const h = useEstilos(folha);
  const competicao = sessao.tipo === 'COMPETICAO';
  const cor = competicao ? c.latao : c.primario;
  const grupos = gruposDaSessao(sessao);

  return (
    <Pressable
      onPress={aoTocar}
      style={({ pressed }) => [
        h.sessao,
        { borderLeftColor: cor },
        pressed ? { opacity: 0.65 } : null,
      ]}
    >
      <View style={[h.sessaoIcone, { backgroundColor: `${cor}1A`, borderColor: `${cor}44` }]}>
        <Ionicons name={competicao ? 'trophy' : 'locate'} size={16} color={cor} />
      </View>

      <View style={{ flex: 1 }}>
        <View style={h.sessaoTopo}>
          <Text style={h.sessaoData}>{isoParaBR(sessao.data)}</Text>
          <Text style={[h.sessaoTipo, { color: cor }]}>
            {(TIPO_SESSAO_POR_VALOR[sessao.tipo]?.curto ?? sessao.tipo).toUpperCase()}
          </Text>
        </View>

        <Text style={h.sessaoLocal} numberOfLines={1}>
          {sessao.localNome || 'Local não informado'}
        </Text>

        <View style={h.sessaoEtiquetas}>
          {grupos.map((g) => (
            <Etiqueta key={g} texto={GRUPO_POR_VALOR[g]?.curto ?? g} />
          ))}
        </View>

        {/* Cada arma registrada, com o grupo — para ficar claro o que contou. */}
        {sessao.armas.length ? (
          <View style={h.sessaoArmasLista}>
            {sessao.armas.slice(0, 4).map((a, i) => (
              <View key={`${a.armaId ?? a.nome}-${i}`} style={h.sessaoArmaLinha}>
                <Ionicons name="ellipse" size={5} color={c.textoFraco} />
                <Text style={h.sessaoArmaNome} numberOfLines={1}>
                  {a.nome}
                  <Text style={h.sessaoArmaGrupo}> · {GRUPO_POR_VALOR[a.grupo]?.curto ?? a.grupo}</Text>
                </Text>
              </View>
            ))}
            {sessao.armas.length > 4 ? (
              <Text style={h.sessaoArmaMais}>+{sessao.armas.length - 4} arma(s)</Text>
            ) : null}
          </View>
        ) : (
          <Text style={h.sessaoArmas}>Sem arma registrada</Text>
        )}
      </View>

      <Ionicons name="chevron-forward" size={16} color={c.textoFraco} />
    </Pressable>
  );
}

const folha = (c: Paleta) =>
  StyleSheet.create({
    linha: {
      borderRadius: raio.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.borda,
      borderLeftWidth: 2,
      padding: espaco.md,
      marginBottom: espaco.sm,
    },
    linhaTopo: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    grupoNome: { flex: 1, ...tipo.subtitulo, fontSize: 14, color: c.texto },
    contagem: { ...tipo.numero, fontSize: 15, fontFamily: MONO, letterSpacing: 0 },
    extras: { ...tipo.etiqueta, fontSize: 9.5, color: c.textoFraco },

    marcas: { flexDirection: 'row', gap: 3, marginTop: espaco.md },
    marca: {
      flex: 1,
      height: 9,
      borderRadius: 2,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.borda,
      backgroundColor: c.nome === 'claro' ? c.superficieAlta : c.fundo,
    },

    linhaRodape: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: espaco.sm,
      marginTop: espaco.sm,
    },
    situacao: { flexShrink: 1, fontSize: 11.5, fontWeight: '600' },
    ultima: { ...tipo.legenda, fontSize: 10.5, color: c.textoFraco, fontFamily: MONO },

    resumo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: espaco.md,
      backgroundColor: c.superficie,
      borderRadius: raio.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.borda,
      padding: espaco.lg,
      marginTop: espaco.md,
    },
    resumoIcone: {
      width: 36,
      height: 36,
      borderRadius: raio.sm,
      borderWidth: StyleSheet.hairlineWidth,
      alignItems: 'center',
      justifyContent: 'center',
    },
    resumoTitulo: { ...tipo.subtitulo, fontSize: 14.5, color: c.texto },
    resumoSub: { ...tipo.legenda, color: c.textoFraco, marginTop: 3 },
    pontos: { flexDirection: 'row', gap: 4, marginTop: 7 },
    ponto: { width: 16, height: 4, borderRadius: 2 },
    registrar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 3,
      paddingHorizontal: espaco.sm,
      paddingVertical: 6,
      borderRadius: raio.sm,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: `${c.primario}55`,
      backgroundColor: c.primarioFraco,
    },
    registrarTexto: { fontSize: 11.5, fontWeight: '700', color: c.primario },

    sessao: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: espaco.md,
      backgroundColor: c.superficie,
      borderRadius: raio.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.borda,
      borderLeftWidth: 2,
      padding: espaco.md,
      marginBottom: espaco.sm,
    },
    sessaoIcone: {
      width: 36,
      height: 36,
      borderRadius: raio.sm,
      borderWidth: StyleSheet.hairlineWidth,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sessaoTopo: { flexDirection: 'row', alignItems: 'center', gap: espaco.sm },
    sessaoData: {
      flex: 1,
      ...tipo.subtitulo,
      fontSize: 14.5,
      color: c.texto,
      fontFamily: MONO,
    },
    sessaoTipo: { ...tipo.etiqueta, fontSize: 9 },
    sessaoLocal: { ...tipo.legenda, color: c.textoMedio, marginTop: 3 },
    sessaoEtiquetas: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 7 },
    sessaoArmas: { ...tipo.legenda, fontSize: 10.5, color: c.textoFraco, marginTop: 6 },
    sessaoArmasLista: { marginTop: 7, gap: 3 },
    sessaoArmaLinha: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    sessaoArmaNome: { flex: 1, ...tipo.legenda, fontSize: 11.5, color: c.textoMedio },
    sessaoArmaGrupo: { color: c.textoFraco },
    sessaoArmaMais: { ...tipo.legenda, fontSize: 10.5, color: c.textoFraco, marginLeft: 11 },
  });
