import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';

import { espaco, MONO, raio, tipo, useCores, useEstilos, type Paleta } from '@/tema';
import { Botao, Tela, TituloTela, Vazio } from '@/ui/base';
import { confirmar, avisar } from '@/ui/dialogo';
import { useApp } from '@/estado/AppContext';
import { excluirPedido, listarPedidos, type ProcessoDetalhe } from '@/despachante/api';
import { removerProcessoLocal } from '@/db/processos';
import { reais } from '@/despachante/formato';

export default function MeusProcessos() {
  const p = useEstilos(folha);
  const { sincronizarAgora, recarregar } = useApp();
  const [itens, setItens] = useState<ProcessoDetalhe[] | null>(null);

  const carregar = useCallback(async () => {
    try {
      setItens(await listarPedidos());
    } catch {
      setItens((v) => v ?? []);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void carregar();
    }, [carregar])
  );

  async function excluir(proc: ProcessoDetalhe) {
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
      await carregar();
    } catch {
      await avisar('Não foi possível excluir', 'Tente novamente em instantes.');
    }
  }

  async function atualizar() {
    await sincronizarAgora();
    await carregar();
  }

  return (
    <Tela voltar tituloCabecalho="Meus processos" aoAtualizar={atualizar}>
      <TituloTela titulo="Meus processos" sub="Acompanhe aqui tudo que você contratou com o despachante." />

      {itens === null ? (
        <Text style={p.carregando}>Carregando…</Text>
      ) : itens.length ? (
        <View style={{ gap: espaco.md }}>
          {itens.map((proc) => (
            <Cartao key={proc.id} proc={proc} aoExcluir={() => void excluir(proc)} />
          ))}
        </View>
      ) : (
        <Vazio
          icone="briefcase-outline"
          titulo="Nenhum processo ainda"
          descricao="Contrate um serviço na aba Serviços e acompanhe o andamento por aqui."
        />
      )}
    </Tela>
  );
}

function Cartao({ proc, aoExcluir }: { proc: ProcessoDetalhe; aoExcluir: () => void }) {
  const c = useCores();
  const p = useEstilos(folha);
  const cor = proc.statusCor || c.textoFraco;
  const prog = proc.progresso;
  const temDocs = (prog?.totalObrigatorios ?? 0) > 0;
  const aguardandoPagamento = proc.status === 'aguardando_pagamento';

  return (
    <View style={p.card}>
      <View style={p.topo}>
        <Text style={p.titulo}>{proc.servicoNome}</Text>
        <View style={[p.chip, { backgroundColor: `${cor}22`, borderColor: `${cor}66` }]}>
          <Text style={[p.chipTexto, { color: cor }]}>{proc.statusLabel}</Text>
        </View>
      </View>

      {proc.armaNome ? <Text style={p.arma}>{proc.armaNome}</Text> : null}

      <View style={p.linha}>
        <Text style={p.valor}>{reais(proc.valorCentavos)}</Text>
        <Text style={p.valorNota}>total (GRU + serviço)</Text>
      </View>

      {temDocs && !aguardandoPagamento ? (
        <View style={{ marginTop: espaco.sm }}>
          <View style={p.progFundo}>
            <View
              style={[
                p.progBarra,
                {
                  width: `${prog!.totalObrigatorios ? (prog!.preenchidosObrigatorios / prog!.totalObrigatorios) * 100 : 100}%`,
                  backgroundColor: prog!.completo ? c.primario : c.latao,
                },
              ]}
            />
          </View>
          <Text style={p.progTexto}>
            {prog!.completo
              ? 'Documentação completa ✓'
              : `Faltam ${prog!.totalObrigatorios - prog!.preenchidosObrigatorios} de ${prog!.totalObrigatorios} documento(s)`}
          </Text>
        </View>
      ) : null}

      <View style={p.acoes}>
        {aguardandoPagamento ? (
          <>
            {proc.invoiceUrl ? (
              <Botao
                titulo="Pagar agora"
                icone="card-outline"
                compacto
                aoTocar={() => router.push({ pathname: '/despachante/checkout', params: { url: proc.invoiceUrl! } })}
              />
            ) : null}
            <Botao titulo="Excluir" icone="trash-outline" variante="fantasma" compacto aoTocar={aoExcluir} />
          </>
        ) : temDocs ? (
          <Botao
            titulo={prog?.completo ? 'Ver documentos' : 'Enviar documentos'}
            icone="document-attach-outline"
            compacto
            aoTocar={() => router.push({ pathname: '/despachante/processo', params: { id: proc.id } })}
          />
        ) : (
          <Botao
            titulo="Ver processo"
            icone="eye-outline"
            variante="fantasma"
            compacto
            aoTocar={() => router.push({ pathname: '/despachante/processo', params: { id: proc.id } })}
          />
        )}
      </View>
    </View>
  );
}

const folha = (c: Paleta) =>
  StyleSheet.create({
    carregando: { ...tipo.corpo, color: c.textoMedio, textAlign: 'center', marginTop: espaco.lg },
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
    progFundo: { height: 8, borderRadius: 4, backgroundColor: c.borda, overflow: 'hidden' },
    progBarra: { height: '100%', borderRadius: 4 },
    progTexto: { ...tipo.legenda, color: c.textoMedio, marginTop: 4 },
    acoes: { flexDirection: 'row', gap: espaco.sm, marginTop: espaco.sm, flexWrap: 'wrap' },
  });
