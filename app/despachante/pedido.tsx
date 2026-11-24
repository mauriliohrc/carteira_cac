import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';

import { espaco, raio, tipo, useCores, useEstilos, type Paleta } from '@/tema';
import { Botao, Carregando, Tela, TituloTela } from '@/ui/base';
import { Campo } from '@/ui/formulario';
import { avisar } from '@/ui/dialogo';
import { useApp } from '@/estado/AppContext';
import { useConta } from '@/conta/ContaContext';
import {
  criarPedido,
  listarServicos,
  precoTotalDespachante,
  precoUnitarioDespachante,
  temDescontoFiliado,
  type ServicoDespachante,
} from '@/despachante/api';
import { upsertProcessoLocal } from '@/db/processos';
import { mascaraCelular, reais, ROTULO_SERVICO } from '@/despachante/formato';
import type { Arma } from '@/domain/tipos';

function nomeArma(a: Arma): string {
  return a.apelido || [a.marca, a.modelo].filter(Boolean).join(' ') || 'Arma sem nome';
}

export default function PedidoDespachante() {
  const c = useCores();
  const p = useEstilos(folha);
  const { tipo: tipoParam } = useLocalSearchParams<{ tipo: string }>();

  const { armas, recarregar } = useApp();
  const { usuario, atualizarPerfil } = useConta();

  const [servico, setServico] = useState<ServicoDespachante | null | undefined>(undefined);
  const [filiado, setFiliado] = useState(false);
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [celular, setCelular] = useState('');
  const [tocado, setTocado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [aceito, setAceito] = useState(false);
  const [verTermo, setVerTermo] = useState(false);

  useEffect(() => {
    let vivo = true;
    listarServicos()
      .then((cat) => {
        if (!vivo) return;
        setServico(cat.servicos.find((s) => (s.codigo ?? s.tipo) === tipoParam) ?? null);
        setFiliado(!!cat.filiado);
      })
      .catch(() => {
        if (vivo) setServico(null);
      });
    return () => {
      vivo = false;
    };
  }, [tipoParam]);

  const precisaCelular = !usuario?.celular;
  const celularDigitos = celular.replace(/\D/g, '');
  const celularOk = celularDigitos.length === 10 || celularDigitos.length === 11;

  const porArma = servico?.porArma ?? false;
  const semAcervo = armas.length === 0;
  // Só mostra o seletor de armas quando o serviço é por arma E há acervo.
  const usaArmas = porArma && !semAcervo;
  const qtd = usaArmas ? selecionadas.size : 1;
  const exigeAceite = !!servico?.termoAceite;
  const podeEnviar = qtd > 0 && (!precisaCelular || celularOk) && (!exigeAceite || aceito);
  // Preço autoritativo é o do servidor; aqui só espelhamos p/ exibir.
  const unidade = servico ? precoUnitarioDespachante(servico, qtd, filiado) : 0;
  const totalCentavos = servico ? precoTotalDespachante(servico, qtd, filiado) : 0;
  const temDesconto = servico ? temDescontoFiliado(servico) : false;
  // Quanto economizaria SE fosse filiado (para o convite).
  const totalSeFiliado = servico ? precoTotalDespachante(servico, qtd, true) : 0;
  const economiaFiliado = totalCentavos - totalSeFiliado;

  function alternar(id: string) {
    setSelecionadas((atual) => {
      const nova = new Set(atual);
      if (nova.has(id)) nova.delete(id);
      else nova.add(id);
      return nova;
    });
  }

  async function contratar() {
    setTocado(true);
    if (!podeEnviar || !servico) return;
    setEnviando(true);
    try {
      if (precisaCelular) await atualizarPerfil({ celular: celularDigitos });

      const codigo = servico.codigo ?? servico.tipo;
      const corpo = usaArmas
        ? {
            tipoServico: codigo,
            armas: armas
              .filter((a) => selecionadas.has(a.id))
              .map((a) => ({ id: a.id as string | null, nome: nomeArma(a) as string | null })),
          }
        : { tipoServico: codigo };

      // Uma única chamada: o servidor cria 1 processo por arma + 1 cobrança (total).
      const { processos, invoiceUrl } = await criarPedido(corpo);
      for (const pr of processos) await upsertProcessoLocal(pr);

      await recarregar();

      if (invoiceUrl) router.replace({ pathname: '/despachante/checkout', params: { url: invoiceUrl } });
      else router.replace('/despachante/meus');
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      await avisar(
        'Não foi possível contratar',
        msg.includes('celular_requerido') ? 'Informe um celular válido para continuar.' : 'Tente novamente em instantes.'
      );
    } finally {
      setEnviando(false);
    }
  }

  if (servico === undefined) return <Tela voltar tituloCabecalho="Contratar"><Carregando /></Tela>;

  const nome = servico?.nome ?? ROTULO_SERVICO[tipoParam as keyof typeof ROTULO_SERVICO] ?? 'Contratar serviço';

  return (
    <Tela voltar teclado tituloCabecalho="Contratar" estilo={{ gap: espaco.md }}>
      <TituloTela
        titulo={nome}
        sub={
          usaArmas
            ? 'Escolha para quais armas você quer este serviço. Cobramos um processo por arma.'
            : porArma
              ? 'Vamos abrir seu processo. Você pode detalhar a arma depois, no contato.'
              : 'Vamos abrir seu processo com valor único.'
        }
      />

      {usaArmas ? (
        <View style={p.lista}>
          {armas.map((a) => {
            const on = selecionadas.has(a.id);
            return (
              <Pressable key={a.id} onPress={() => alternar(a.id)} style={p.item}>
                <Ionicons name={on ? 'checkbox' : 'square-outline'} size={22} color={on ? c.primario : c.textoFraco} />
                <View style={{ flex: 1 }}>
                  <Text style={p.itemTitulo}>{nomeArma(a)}</Text>
                  {a.calibre || a.numeroSerie ? (
                    <Text style={p.itemSub}>{[a.calibre, a.numeroSerie].filter(Boolean).join(' · ')}</Text>
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {servico ? (
        <View style={p.totalCartao}>
          <Text style={p.totalRotulo}>
            {usaArmas && qtd > 1 ? `Total (${qtd} × ${reais(unidade)})` : 'Total'}
            {temDesconto && filiado ? '  • filiado' : ''}
          </Text>
          <Text style={p.totalValor}>{reais(totalCentavos)}</Text>
        </View>
      ) : null}

      {servico && temDesconto && !filiado && economiaFiliado > 0 ? (
        <Pressable style={p.convite} onPress={() => router.push('/filiacao')}>
          <Ionicons name="shield-checkmark" size={20} color={c.primario} />
          <View style={{ flex: 1 }}>
            <Text style={p.conviteTitulo}>Filiado economizaria {reais(economiaFiliado)}</Text>
            <Text style={p.conviteSub}>Filie-se à liga para pagar o preço de filiado neste e nos outros serviços.</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={c.textoFraco} />
        </Pressable>
      ) : null}

      {precisaCelular ? (
        <View style={p.celular}>
          <Campo
            rotulo="Celular para contato"
            valor={celular}
            aoMudar={(v) => setCelular(mascaraCelular(v))}
            teclado="numeric"
            placeholder="(11) 99999-9999"
            obrigatorio
            maxLength={16}
            dica="O despachante usa este número para falar com você sobre o processo."
            erro={tocado && !celularOk ? 'Informe um celular válido com DDD.' : null}
          />
        </View>
      ) : null}

      {exigeAceite ? (
        <Pressable onPress={() => setAceito((v) => !v)} style={p.aceiteLinha}>
          <Ionicons name={aceito ? 'checkbox' : 'square-outline'} size={22} color={aceito ? c.primario : c.textoFraco} />
          <Text style={p.aceiteTexto}>
            Li e concordo com os{' '}
            <Text style={p.aceiteLink} onPress={() => setVerTermo(true)}>
              termos de aceite
            </Text>
            .
          </Text>
        </Pressable>
      ) : null}

      <Botao
        titulo={usaArmas && qtd > 1 ? `Contratar ${qtd} processos` : 'Contratar e pagar'}
        icone="card-outline"
        aoTocar={contratar}
        carregando={enviando}
        desabilitado={!podeEnviar}
        estilo={{ alignSelf: 'stretch', marginTop: espaco.sm }}
      />
      <Text style={p.rodape}>
        Você vai para um checkout seguro (PIX, crédito ou débito). O processo começa assim que o pagamento é confirmado.
      </Text>

      <Modal visible={verTermo} animationType="slide" transparent onRequestClose={() => setVerTermo(false)}>
        <View style={p.modalFundo}>
          <View style={p.modalCard}>
            <Text style={p.modalTitulo}>Termos de aceite</Text>
            <ScrollView style={{ maxHeight: 360 }}>
              <Text style={p.modalTexto}>{servico?.termoAceite ?? ''}</Text>
            </ScrollView>
            <View style={p.modalAcoes}>
              <Botao titulo="Fechar" variante="fantasma" compacto aoTocar={() => setVerTermo(false)} />
              <Botao
                titulo="Li e aceito"
                icone="checkmark"
                compacto
                aoTocar={() => {
                  setAceito(true);
                  setVerTermo(false);
                }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </Tela>
  );
}

const folha = (c: Paleta) =>
  StyleSheet.create({
    lista: {
      backgroundColor: c.superficie,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.borda,
      borderRadius: raio.lg,
      overflow: 'hidden',
    },
    item: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: espaco.md,
      padding: espaco.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.borda,
    },
    itemTitulo: { ...tipo.corpo, fontWeight: '600', color: c.texto },
    itemSub: { ...tipo.legenda, color: c.textoMedio, marginTop: 1 },
    totalCartao: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: c.primarioFraco,
      borderRadius: raio.lg,
      paddingVertical: espaco.sm,
      paddingHorizontal: espaco.md,
    },
    totalRotulo: { ...tipo.legenda, color: c.textoMedio },
    totalValor: { ...tipo.corpo, fontWeight: '800', color: c.texto },
    convite: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: espaco.sm,
      backgroundColor: c.primarioFraco,
      borderRadius: raio.lg,
      padding: espaco.md,
    },
    conviteTitulo: { ...tipo.corpo, fontWeight: '800', color: c.texto },
    conviteSub: { ...tipo.legenda, color: c.textoMedio, marginTop: 2, lineHeight: 17 },
    celular: { marginTop: espaco.xs },
    rodape: { ...tipo.legenda, color: c.textoMedio, textAlign: 'center', lineHeight: 18 },
    aceiteLinha: { flexDirection: 'row', alignItems: 'flex-start', gap: espaco.sm, marginTop: espaco.xs },
    aceiteTexto: { ...tipo.corpo, color: c.texto, flex: 1, lineHeight: 20 },
    aceiteLink: { color: c.primario, fontWeight: '700', textDecorationLine: 'underline' },
    modalFundo: { flex: 1, backgroundColor: 'rgba(0,0,0,.5)', justifyContent: 'flex-end' },
    modalCard: {
      backgroundColor: c.superficie,
      borderTopLeftRadius: raio.lg,
      borderTopRightRadius: raio.lg,
      padding: espaco.lg,
      gap: espaco.md,
    },
    modalTitulo: { ...tipo.titulo, fontSize: 18, color: c.texto },
    modalTexto: { ...tipo.corpo, color: c.textoMedio, lineHeight: 22 },
    modalAcoes: { flexDirection: 'row', justifyContent: 'flex-end', gap: espaco.sm },
  });
