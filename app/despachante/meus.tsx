import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { espaco, MONO, raio, tipo, useCores, useEstilos, type Paleta } from '@/tema';
import { Botao, Tela, TituloTela, Vazio } from '@/ui/base';
import { confirmar, avisar } from '@/ui/dialogo';
import { useApp } from '@/estado/AppContext';
import { excluirPedido } from '@/despachante/api';
import { removerProcessoLocal } from '@/db/processos';
import { reais, ROTULO_SERVICO, STATUS_INFO } from '@/despachante/formato';
import type { Processo } from '@/domain/tipos';

export default function MeusProcessos() {
  const c = useCores();
  const p = useEstilos(folha);
  const { processos, sincronizarAgora, recarregar } = useApp();

  async function excluir(proc: Processo) {
    const ok = await confirmar({
      titulo: 'Excluir processo?',
      mensagem: 'Este processo ainda não foi pago. A cobrança será cancelada e ele sairá da lista.',
      rotuloConfirmar: 'Excluir',
      destrutivo: true,
    });
    if (!ok) return;
    try {
      await excluirPedido(proc.id);
      await removerProcessoLocal(proc.id);
      await recarregar();
    } catch {
      await avisar('Não foi possível excluir', 'Tente novamente em instantes.');
    }
  }

  const corDoStatus = (cor: (typeof STATUS_INFO)[keyof typeof STATUS_INFO]['cor']) =>
    cor === 'ok' ? c.primario : cor === 'alerta' ? c.latao : cor === 'info' ? c.info : c.textoFraco;

  function cartao(proc: Processo) {
    const info = STATUS_INFO[proc.status];
    const cor = corDoStatus(info.cor);
    return (
      <View key={proc.id} style={p.card}>
        <View style={p.topo}>
          <Text style={p.titulo}>{ROTULO_SERVICO[proc.tipoServico]}</Text>
          <View style={[p.chip, { backgroundColor: `${cor}22`, borderColor: `${cor}66` }]}>
            <Text style={[p.chipTexto, { color: cor }]}>{info.rotulo}</Text>
          </View>
        </View>

        {proc.armaNome ? <Text style={p.arma}>{proc.armaNome}</Text> : null}

        <View style={p.linha}>
          <Text style={p.valor}>{reais(proc.valorCentavos)}</Text>
          <Text style={p.valorNota}>total (GRU + serviço)</Text>
        </View>

        {proc.status === 'aguardando_pagamento' ? (
          <View style={p.acoes}>
            {proc.invoiceUrl ? (
              <Botao
                titulo="Pagar agora"
                icone="card-outline"
                compacto
                aoTocar={() =>
                  router.push({ pathname: '/despachante/checkout', params: { url: proc.invoiceUrl! } })
                }
              />
            ) : null}
            <Botao
              titulo="Excluir"
              icone="trash-outline"
              variante="fantasma"
              compacto
              aoTocar={() => void excluir(proc)}
            />
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <Tela voltar tituloCabecalho="Meus processos" aoAtualizar={sincronizarAgora}>
      <TituloTela titulo="Meus processos" sub="Acompanhe aqui tudo que você contratou com o despachante." />

      {processos.length ? (
        <View style={{ gap: espaco.md }}>{processos.map(cartao)}</View>
      ) : (
        <Vazio
          icone="briefcase-outline"
          titulo="Nenhum processo ainda"
          descricao="Contrate um serviço na aba Despachante e acompanhe o andamento por aqui."
        />
      )}
    </Tela>
  );
}

const folha = (c: Paleta) =>
  StyleSheet.create({
    card: {
      backgroundColor: c.superficie,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.borda,
      borderRadius: raio.lg,
      padding: espaco.md,
    },
    topo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: espaco.sm },
    titulo: { ...tipo.corpo, fontWeight: '700', color: c.texto, flex: 1 },
    chip: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth },
    chipTexto: { ...tipo.etiqueta, fontSize: 10 },
    arma: { ...tipo.legenda, color: c.textoMedio, marginTop: 2 },
    linha: { flexDirection: 'row', alignItems: 'baseline', gap: espaco.sm, marginTop: espaco.sm },
    valor: { ...tipo.numero, fontFamily: MONO, fontSize: 18, color: c.texto },
    valorNota: { ...tipo.legenda, color: c.textoMedio },
    acoes: { flexDirection: 'row', gap: espaco.sm, marginTop: espaco.sm, flexWrap: 'wrap' },
  });
