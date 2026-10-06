import React, { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';

import { espaco, MONO, raio, tipo, useCores, useEstilos, type Paleta } from '@/tema';
import { useApp } from '@/estado/AppContext';
import { Secao, Tela, TituloTela, Vazio } from '@/ui/base';
import { AgendaVencimentos } from '@/ui/AgendaVencimentos';
import { confirmar } from '@/ui/dialogo';
import { sincronizarCaixa } from '@/notificacoes/caixa';
import { ALERTAS_DISPONIVEIS, TETO_DIARIO } from '@/notificacoes';
import { JANELA_ALERTA_DIAS } from '@/domain/vencimento';
import type { AvisoRecebido } from '@/db/avisos';

/**
 * A tela mostra só duas coisas, e as duas exigem ação: as notificações que
 * chegaram e os documentos dentro da janela de alerta (vencidos ou vencendo em
 * até 30 dias). Prazos mais folgados não geram aviso e por isso não aparecem
 * aqui — o panorama completo fica no painel, e o estado de cada documento, na
 * ficha da arma.
 */
export default function Avisos() {
  const c = useCores();
  const a = useEstilos(folha);
  const { avisos, avisosNaoLidos, pendencias, recarregarAvisos, marcarAvisosLidos, apagarAvisos } =
    useApp();

  const atualizar = useCallback(async () => {
    await sincronizarCaixa();
    await recarregarAvisos();
  }, [recarregarAvisos]);

  // Ao abrir a aba, recolhe o que chegou enquanto o app estava fora de foco.
  useFocusEffect(
    useCallback(() => {
      void atualizar();
    }, [atualizar])
  );

  const confirmarLimpeza = async () => {
    const ok = await confirmar({
      titulo: 'Limpar avisos',
      mensagem: 'O histórico de notificações será apagado. Seus documentos não são afetados.',
      rotuloConfirmar: 'Limpar',
      destrutivo: true,
    });
    if (ok) await apagarAvisos();
  };

  const vazio = !avisos.length && !pendencias.length;

  return (
    <Tela sobBarra>
      <View style={a.topo}>
        <View style={{ flex: 1 }}>
          <TituloTela
            titulo="Avisos"
            sub={
              avisosNaoLidos
                ? `${avisosNaoLidos} não lido${avisosNaoLidos > 1 ? 's' : ''}`
                : pendencias.length
                  ? `${pendencias.length} documento(s) exigindo ação`
                  : 'Nada exigindo ação'
            }
          />
        </View>
        {avisos.length ? (
          <Pressable onPress={() => void confirmarLimpeza()} hitSlop={10} style={a.botaoIcone}>
            <Ionicons name="trash-outline" size={18} color={c.textoFraco} />
          </Pressable>
        ) : null}
        {avisosNaoLidos ? (
          <Pressable onPress={() => void marcarAvisosLidos()} hitSlop={10} style={a.botaoIcone}>
            <Ionicons name="checkmark-done" size={19} color={c.primario} />
          </Pressable>
        ) : null}
      </View>

      {vazio ? (
        <Vazio
          icone="notifications-off-outline"
          titulo={ALERTAS_DISPONIVEIS ? 'Nada exigindo ação' : 'Alertas indisponíveis no navegador'}
          descricao={
            ALERTAS_DISPONIVEIS
              ? `Nenhum documento vencido ou vencendo nos próximos ${JANELA_ALERTA_DIAS} dias. Quando algum entrar nessa janela, o alerta chega aqui e no seu celular — agrupado por arma, no máximo ${TETO_DIARIO} por dia.`
              : 'Notificação local agendada não existe na web. Abra o app no iPhone para receber os avisos.'
          }
        />
      ) : null}

      {/* ------------------------------------------------ o que já chegou */}
      {avisos.length ? (
        <Secao titulo="Recebidos">
          {avisos.map((aviso) => (
            <ItemAviso key={aviso.id} aviso={aviso} />
          ))}
        </Secao>
      ) : null}

      {/* ------------------------------- o que está dentro da janela */}
      {pendencias.length ? (
        <Secao titulo="Vencendo">
          <AgendaVencimentos />
        </Secao>
      ) : null}
    </Tela>
  );
}

function ItemAviso({ aviso }: { aviso: AvisoRecebido }) {
  const c = useCores();
  const a = useEstilos(folha);
  const urgente = (aviso.titulo ?? '').startsWith('🚨');
  const cor = urgente ? c.perigo : c.aviso;

  return (
    <View style={[a.aviso, { borderLeftColor: aviso.lido ? c.borda : cor }]}>
      <View style={a.avisoTopo}>
        <Text
          style={[a.avisoTitulo, aviso.lido ? { color: c.textoMedio } : null]}
          numberOfLines={2}
        >
          {aviso.titulo ?? 'Aviso'}
        </Text>
        {!aviso.lido ? <View style={[a.pontoNaoLido, { backgroundColor: cor }]} /> : null}
      </View>
      {aviso.subtitulo ? <Text style={a.avisoSubtitulo}>{aviso.subtitulo}</Text> : null}
      {aviso.corpo ? <Text style={a.avisoCorpo}>{aviso.corpo}</Text> : null}
      <Text style={a.avisoData}>{formatarRecebido(aviso.recebidoEm)}</Text>
    </View>
  );
}

function formatarRecebido(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const agora = new Date();
  const hora = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  if (d.toDateString() === agora.toDateString()) return `Hoje ${hora}`;
  const data = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
  return `${data} ${hora}`;
}

function formatarQuando(d: Date | null): string {
  if (!d) return '';
  const hoje = new Date();
  const dias = Math.round(
    (new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() -
      new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()).getTime()) /
      86400000
  );
  const hora = `${String(d.getHours()).padStart(2, '0')}h`;
  if (dias === 0) return `hoje ${hora}`;
  if (dias === 1) return `amanhã ${hora}`;
  return `em ${dias}d`;
}

const folha = (c: Paleta) =>
  StyleSheet.create({
    topo: { flexDirection: 'row', alignItems: 'center', gap: espaco.sm },
    botaoIcone: { padding: espaco.sm },

    aviso: {
      backgroundColor: c.superficie,
      borderRadius: raio.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.borda,
      borderLeftWidth: 2,
      padding: espaco.md,
      marginBottom: espaco.sm,
    },
    avisoTopo: { flexDirection: 'row', alignItems: 'flex-start', gap: espaco.sm },
    avisoTitulo: { flex: 1, ...tipo.subtitulo, fontSize: 14, color: c.texto, lineHeight: 19 },
    pontoNaoLido: { width: 7, height: 7, borderRadius: 4, marginTop: 6 },
    avisoSubtitulo: { ...tipo.legenda, fontWeight: '600', color: c.textoMedio, marginTop: 5 },
    avisoCorpo: { ...tipo.corpoPequeno, color: c.textoMedio, marginTop: 7 },
    avisoData: { ...tipo.legenda, fontSize: 11, color: c.textoFraco, marginTop: espaco.md },

    agendado: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: espaco.md,
      paddingVertical: espaco.md,
    },
    agendadoSeparado: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.borda,
    },
    agendadoTitulo: { ...tipo.corpoPequeno, fontWeight: '600', color: c.texto },
    agendadoSub: { ...tipo.legenda, fontSize: 11, color: c.textoFraco, marginTop: 1 },
    agendadoQuando: { ...tipo.etiqueta, fontSize: 10, color: c.textoFraco, fontFamily: MONO },
    agendadoResto: {
      ...tipo.legenda,
      fontSize: 11,
      color: c.textoFraco,
      textAlign: 'center',
      paddingTop: espaco.md,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.borda,
    },
  });
