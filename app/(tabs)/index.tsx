import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { espaco, raio, tipo, useCores, useEstilos, type Paleta } from '@/tema';
import { useApp } from '@/estado/AppContext';
import { Botao, Cartao, Secao, Tela, Vazio } from '@/ui/base';
import { Vidro } from '@/ui/Vidro';
import { CartaoDocumento } from '@/ui/cartoes';
import { CartaoConta } from '@/conta/CartaoConta';
import { SecaoNoticiasPainel } from '@/noticias/SecaoNoticiasPainel';
import { ResumoHabitualidade } from '@/ui/habitualidade';
import { avaliar } from '@/domain/vencimento';
import { LIMITE_GRATUITO_ARMAS } from '@/billing';

export default function Painel() {
  const c = useCores();
  const p = useEstilos(folha);
  const { armas, documentos, pendencias, premium, progressoHabitualidade } = useApp();

  const resumo = useMemo(() => {
    const avaliados = documentos.map((d) => avaliar(d.dataValidade));
    return {
      vencidos: avaliados.filter((i) => i.situacao === 'VENCIDO').length,
      criticos: avaliados.filter((i) => i.situacao === 'CRITICO').length,
      vencendo: avaliados.filter((i) => i.situacao === 'ALERTA').length,
      emDia: avaliados.filter((i) => i.situacao === 'ATENCAO' || i.situacao === 'EM_DIA').length,
    };
  }, [documentos]);

  const semNada = armas.length === 0 && documentos.length === 0;

  /**
   * O herói responde "está tudo certo?" — e por isso tem de falar das DUAS
   * cobranças. Contando só documentos, ele dizia "acervo regular" para quem
   * está com 5 habitualidades atrasadas: mentira por omissão, no lugar mais
   * visível do app.
   */
  const status = useMemo(() => {
    const plural = (n: number) => (n > 1 ? 's' : '');
    if (semNada) {
      return {
        cor: c.primario,
        icone: 'checkmark-circle-outline' as const,
        titulo: 'Carteira vazia',
        sub: 'Cadastre sua primeira arma para começar.',
      };
    }

    const h = progressoHabitualidade;
    const gruposAtrasados = h.exigido ? h.grupos.length - h.cumpridos : 0;
    const docs = pendencias.length;

    if (docs && gruposAtrasados) {
      return {
        cor: c.perigo,
        icone: 'warning-outline' as const,
        titulo: `${docs} pendência${plural(docs)} + habitualidade`,
        sub: `Documentos vencidos ou vencendo em até 30 dias, e ${gruposAtrasados} grupo${plural(gruposAtrasados)} de habitualidade atrasado${plural(gruposAtrasados)}.`,
      };
    }
    if (docs) {
      return {
        cor: c.critico,
        icone: 'warning-outline' as const,
        titulo: `${docs} pendência${plural(docs)}`,
        sub: 'Documentos vencidos ou vencendo em até 30 dias.',
      };
    }
    if (gruposAtrasados) {
      return {
        cor: c.aviso,
        icone: 'alert-circle-outline' as const,
        titulo: 'Habitualidade atrasada',
        sub: `Documentos em dia. Faltam ${h.faltamTotal} sessão${h.faltamTotal > 1 ? 'ões' : ''} em ${gruposAtrasados} grupo${plural(gruposAtrasados)}.`,
      };
    }
    return {
      cor: c.primario,
      icone: 'checkmark-circle-outline' as const,
      titulo: 'Tudo em dia',
      sub: progressoHabitualidade.exigido
        ? 'Nenhum documento vence em 30 dias e a habitualidade está completa.'
        : 'Nenhum documento vence nos próximos 30 dias.',
    };
  }, [c, pendencias.length, progressoHabitualidade, semNada]);

  return (
    <Tela
      sobBarra
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

      <Vidro raioCanto={raio.lg} material="regular" estilo={p.status}>
        <View style={[p.faixaStatus, { backgroundColor: status.cor }]} />
        <View style={p.statusTopo}>
          <Ionicons name={status.icone} size={24} color={status.cor} />
          <View style={{ flex: 1 }}>
            <Text style={p.statusTitulo}>{status.titulo}</Text>
            <Text style={p.statusSub}>{status.sub}</Text>
          </View>
        </View>

        {!semNada ? (
          <View style={p.numeros}>
            <Numero valor={resumo.vencidos} rotulo="Vencidos" cor={c.perigo} />
            <Numero valor={resumo.criticos} rotulo="≤ 7 dias" cor={c.critico} />
            <Numero valor={resumo.vencendo} rotulo="≤ 30 dias" cor={c.aviso} />
            <Numero valor={resumo.emDia} rotulo="Em dia" cor={c.primario} />
          </View>
        ) : null}
      </Vidro>

      <View style={p.atalhos}>
        <Atalho
          icone="add-circle-outline"
          titulo="Nova arma"
          descricao={
            premium
              ? `${armas.length} no acervo`
              : `${armas.length}/${LIMITE_GRATUITO_ARMAS} no plano grátis`
          }
          aoTocar={() => router.push('/arma/editar')}
        />
        <Atalho
          icone="document-attach-outline"
          titulo="Novo documento"
          descricao="CRAF, guia, laudo…"
          aoTocar={() => router.push('/documento/editar')}
        />
      </View>

      {/* Só aparece para quem tem acervo de atirador: é o único que exige. */}
      {progressoHabitualidade.exigido ? (
        <ResumoHabitualidade
          progresso={progressoHabitualidade}
          aoTocar={() =>
            router.push({ pathname: '/(tabs)/acervo', params: { aba: 'habitualidade' } })
          }
          aoRegistrar={() => router.push('/habitualidade/editar')}
        />
      ) : null}

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
      ) : (
        <Secao
          titulo="Precisa de atenção"
          acao={
            pendencias.length ? (
              <Pressable onPress={() => router.push('/(tabs)/avisos')} hitSlop={10}>
                <Text style={p.verTudo}>Ver tudo</Text>
              </Pressable>
            ) : null
          }
        >
          {pendencias.length ? (
            pendencias
              .slice(0, 5)
              .map((doc) => (
                <CartaoDocumento
                  key={doc.id}
                  documento={doc}
                  aoTocar={() =>
                    router.push({ pathname: '/documento/[id]', params: { id: doc.id } })
                  }
                />
              ))
          ) : (
            <Cartao plano>
              <View style={p.okLinha}>
                <Ionicons name="checkmark-circle-outline" size={19} color={c.primario} />
                <Text style={p.okTexto}>
                  Nada vencendo nos próximos 30 dias. Continue assim.
                </Text>
              </View>
            </Cartao>
          )}
        </Secao>
      )}

      <SecaoNoticiasPainel />
    </Tela>
  );
}

function Numero({ valor, rotulo, cor }: { valor: number; rotulo: string; cor: string }) {
  const c = useCores();
  const p = useEstilos(folha);
  return (
    <View style={p.numero}>
      <Text style={[p.numeroValor, { color: valor ? cor : c.textoFraco }]}>{valor}</Text>
      <Text style={p.numeroRotulo}>{rotulo.toUpperCase()}</Text>
    </View>
  );
}

function Atalho({
  icone,
  titulo,
  descricao,
  aoTocar,
}: {
  icone: keyof typeof Ionicons.glyphMap;
  titulo: string;
  descricao: string;
  aoTocar: () => void;
}) {
  const c = useCores();
  const p = useEstilos(folha);
  return (
    <Pressable
      onPress={aoTocar}
      style={({ pressed }) => [p.atalho, pressed ? { opacity: 0.65 } : null]}
    >
      <Ionicons name={icone} size={20} color={c.primario} />
      <Text style={p.atalhoTitulo}>{titulo}</Text>
      <Text style={p.atalhoDescricao} numberOfLines={1}>
        {descricao}
      </Text>
    </Pressable>
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

    status: { padding: espaco.lg, paddingLeft: espaco.lg + 6, overflow: 'hidden' },
    faixaStatus: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3 },
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
    numero: { flex: 1, alignItems: 'center' },
    numeroValor: { ...tipo.numero, fontSize: 21 },
    numeroRotulo: { ...tipo.etiqueta, fontSize: 9, color: c.textoFraco, marginTop: 3 },

    atalhos: { flexDirection: 'row', gap: espaco.md, marginTop: espaco.md },
    atalho: {
      flex: 1,
      backgroundColor: c.superficie,
      borderRadius: raio.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.borda,
      padding: espaco.lg,
      gap: 7,
    },
    atalhoTitulo: { ...tipo.subtitulo, fontSize: 14, color: c.texto },
    atalhoDescricao: { ...tipo.legenda, fontSize: 11, color: c.textoFraco },

    verTudo: { fontSize: 12.5, fontWeight: '600', color: c.primario },
    okLinha: { flexDirection: 'row', alignItems: 'center', gap: espaco.md },
    okTexto: { flex: 1, ...tipo.corpoPequeno, color: c.textoMedio },
  });
