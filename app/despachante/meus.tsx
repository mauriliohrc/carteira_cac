import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';

import { espaco, MONO, raio, tipo, useCores, useEstilos, type Paleta } from '@/tema';
import { Botao, Tela, TituloTela, Vazio } from '@/ui/base';
import { confirmar, avisar } from '@/ui/dialogo';
import { useApp } from '@/estado/AppContext';
import { excluirPedido, listarPedidos, type ProcessoDetalhe } from '@/despachante/api';
import { removerProcessoLocal } from '@/db/processos';
import { reais } from '@/despachante/formato';

/** Agrupa processos do mesmo pedido (por-arma) mantendo a ordem (mais novo 1º). */
function agrupar(itens: ProcessoDetalhe[]): ProcessoDetalhe[][] {
  const ordem: string[] = [];
  const mapa = new Map<string, ProcessoDetalhe[]>();
  for (const it of itens) {
    const g = it.grupoId;
    if (!mapa.has(g)) {
      mapa.set(g, []);
      ordem.push(g);
    }
    mapa.get(g)!.push(it);
  }
  return ordem.map((g) => mapa.get(g)!);
}

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
      titulo: 'Cancelar pedido?',
      mensagem: 'O pedido ainda não foi pago. A cobrança será cancelada e ele sairá da lista.',
      rotuloConfirmar: 'Cancelar pedido',
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

  const grupos = itens ? agrupar(itens) : [];

  return (
    <Tela voltar tituloCabecalho="Meus processos" aoAtualizar={atualizar}>
      <TituloTela titulo="Meus processos" sub="Acompanhe aqui tudo que você contratou com o despachante." />

      {itens === null ? (
        <Text style={p.carregando}>Carregando…</Text>
      ) : grupos.length ? (
        <View style={{ gap: espaco.md }}>
          {grupos.map((g) => (
            <Grupo key={g[0]!.grupoId} procs={g} aoExcluir={excluir} />
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

function Grupo({ procs, aoExcluir }: { procs: ProcessoDetalhe[]; aoExcluir: (p: ProcessoDetalhe) => void }) {
  const c = useCores();
  const p = useEstilos(folha);
  const primeiro = procs[0]!;
  const porArma = procs.length > 1;
  const total = procs.reduce((s, x) => s + x.valorCentavos, 0);
  const aguardandoPagamento = procs.every((x) => x.status === 'aguardando_pagamento');
  const invoiceUrl = procs.find((x) => x.invoiceUrl)?.invoiceUrl ?? null;

  return (
    <View style={p.card}>
      <View style={p.topo}>
        <Text style={p.titulo}>{primeiro.servicoNome}</Text>
        {porArma ? <Text style={p.qtd}>{procs.length} equipamentos</Text> : null}
      </View>

      <View style={p.linha}>
        <Text style={p.valor}>{reais(total)}</Text>
        <Text style={p.valorNota}>total (GRU + serviço)</Text>
      </View>

      {/* Itens do pedido — um por equipamento, cada um com o seu andamento. */}
      <View style={p.itens}>
        {procs.map((proc) => (
          <ItemArma key={proc.id} proc={proc} mostrarArma={porArma} aoExcluir={() => aoExcluir(proc)} />
        ))}
      </View>

      {aguardandoPagamento ? (
        <View style={p.acoes}>
          {invoiceUrl ? (
            <Botao
              titulo="Pagar agora"
              icone="card-outline"
              compacto
              aoTocar={() => router.push({ pathname: '/despachante/checkout', params: { url: invoiceUrl } })}
            />
          ) : null}
          <Botao
            titulo="Cancelar pedido"
            icone="close-circle-outline"
            variante="fantasma"
            compacto
            aoTocar={() => aoExcluir(primeiro)}
          />
        </View>
      ) : null}
    </View>
  );
}

function ItemArma({
  proc,
  mostrarArma,
  aoExcluir,
}: {
  proc: ProcessoDetalhe;
  mostrarArma: boolean;
  aoExcluir: () => void;
}) {
  const c = useCores();
  const p = useEstilos(folha);
  const cor = proc.statusCor || c.textoFraco;
  const prog = proc.progresso;
  const temDocs = (prog?.totalObrigatorios ?? 0) > 0;
  const aguardandoPagamento = proc.status === 'aguardando_pagamento';

  return (
    <Pressable
      style={p.item}
      onPress={() => {
        if (!aguardandoPagamento) router.push({ pathname: '/despachante/processo', params: { id: proc.id } });
      }}
    >
      <View style={{ flex: 1 }}>
        {mostrarArma ? <Text style={p.itemArma}>{proc.armaNome ?? 'Equipamento'}</Text> : null}
        <View style={p.itemStatusLinha}>
          <View style={[p.ponto, { backgroundColor: cor }]} />
          <Text style={[p.itemStatus, { color: cor }]}>{proc.statusLabel}</Text>
        </View>
        {temDocs && !aguardandoPagamento ? (
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
        ) : null}
      </View>
      {aguardandoPagamento ? (
        <Ionicons name="time-outline" size={18} color={c.textoFraco} />
      ) : temDocs ? (
        <View style={p.itemAcao}>
          <Ionicons name="document-attach-outline" size={16} color={c.primario} />
          <Text style={p.itemAcaoTexto}>{prog?.completo ? 'Ver' : 'Enviar'}</Text>
        </View>
      ) : (
        <Ionicons name="chevron-forward" size={18} color={c.textoFraco} />
      )}
    </Pressable>
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
    qtd: { ...tipo.etiqueta, fontSize: 11, color: c.textoMedio },
    linha: { flexDirection: 'row', alignItems: 'baseline', gap: espaco.sm, marginTop: espaco.xs },
    valor: { ...tipo.numero, fontFamily: MONO, fontSize: 18, color: c.texto },
    valorNota: { ...tipo.legenda, color: c.textoMedio },
    itens: { marginTop: espaco.sm, gap: espaco.xs },
    item: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: espaco.sm,
      paddingVertical: espaco.sm,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: c.borda,
    },
    itemArma: { ...tipo.corpo, fontWeight: '600', color: c.texto },
    itemStatusLinha: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
    ponto: { width: 8, height: 8, borderRadius: 4 },
    itemStatus: { ...tipo.legenda, fontWeight: '600' },
    progFundo: { height: 6, borderRadius: 3, backgroundColor: c.borda, overflow: 'hidden', marginTop: 6 },
    progBarra: { height: '100%', borderRadius: 3 },
    itemAcao: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    itemAcaoTexto: { ...tipo.legenda, color: c.primario, fontWeight: '700' },
    acoes: { flexDirection: 'row', gap: espaco.sm, marginTop: espaco.sm, flexWrap: 'wrap' },
  });
