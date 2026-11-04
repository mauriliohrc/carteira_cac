import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';

import { espaco, raio, tipo, useCores, useEstilos, type Paleta } from '@/tema';
import { Botao, Tela, TituloTela } from '@/ui/base';
import { Campo } from '@/ui/formulario';
import { avisar } from '@/ui/dialogo';
import { useApp } from '@/estado/AppContext';
import { useConta } from '@/conta/ContaContext';
import { criarPedido } from '@/despachante/api';
import { upsertProcessoLocal } from '@/db/processos';
import { mascaraCelular, ROTULO_SERVICO } from '@/despachante/formato';
import type { Arma, TipoServicoDespachante } from '@/domain/tipos';

function nomeArma(a: Arma): string {
  return a.apelido || [a.marca, a.modelo].filter(Boolean).join(' ') || 'Arma sem nome';
}

export default function PedidoDespachante() {
  const c = useCores();
  const p = useEstilos(folha);
  const { tipo: tipoParam } = useLocalSearchParams<{ tipo: TipoServicoDespachante }>();
  const tipoServico = tipoParam as TipoServicoDespachante;

  const { armas, recarregar } = useApp();
  const { usuario, atualizarPerfil } = useConta();

  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [celular, setCelular] = useState('');
  const [tocado, setTocado] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const precisaCelular = !usuario?.celular;
  const celularDigitos = celular.replace(/\D/g, '');
  const celularOk = celularDigitos.length === 10 || celularDigitos.length === 11;

  // Sem armas no acervo, permite um pedido genérico (sem arma específica).
  const semAcervo = armas.length === 0;
  const qtd = semAcervo ? 1 : selecionadas.size;
  const podeEnviar = qtd > 0 && (!precisaCelular || celularOk);

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
    if (!podeEnviar) return;
    setEnviando(true);
    try {
      if (precisaCelular) {
        await atualizarPerfil({ celular: celularDigitos });
      }

      const alvos = semAcervo
        ? [{ id: null as string | null, nome: null as string | null }]
        : armas
            .filter((a) => selecionadas.has(a.id))
            .map((a) => ({ id: a.id, nome: nomeArma(a) }));

      let primeiroUrl: string | null = null;
      for (const alvo of alvos) {
        const { processo, invoiceUrl } = await criarPedido({
          tipoServico,
          armaId: alvo.id,
          armaNome: alvo.nome,
        });
        await upsertProcessoLocal(processo);
        if (!primeiroUrl) primeiroUrl = invoiceUrl;
      }

      await recarregar();

      if (primeiroUrl) {
        router.replace({ pathname: '/despachante/checkout', params: { url: primeiroUrl } });
      } else {
        router.replace('/despachante/meus');
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      await avisar(
        'Não foi possível contratar',
        msg.includes('celular_requerido')
          ? 'Informe um celular válido para continuar.'
          : 'Tente novamente em instantes.'
      );
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Tela voltar teclado tituloCabecalho="Contratar" estilo={{ gap: espaco.md }}>
      <TituloTela
        titulo={ROTULO_SERVICO[tipoServico] ?? 'Contratar serviço'}
        sub={
          semAcervo
            ? 'Vamos abrir seu processo. Você pode detalhar a arma depois, no contato.'
            : 'Escolha para quais armas você quer este serviço. Cobramos um processo por arma.'
        }
      />

      {!semAcervo ? (
        <View style={p.lista}>
          {armas.map((a) => {
            const on = selecionadas.has(a.id);
            return (
              <Pressable key={a.id} onPress={() => alternar(a.id)} style={p.item}>
                <Ionicons
                  name={on ? 'checkbox' : 'square-outline'}
                  size={22}
                  color={on ? c.primario : c.textoFraco}
                />
                <View style={{ flex: 1 }}>
                  <Text style={p.itemTitulo}>{nomeArma(a)}</Text>
                  {a.calibre || a.numeroSerie ? (
                    <Text style={p.itemSub}>
                      {[a.calibre, a.numeroSerie].filter(Boolean).join(' · ')}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>
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

      <Botao
        titulo={qtd > 1 ? `Contratar ${qtd} processos` : 'Contratar e pagar'}
        icone="card-outline"
        aoTocar={contratar}
        carregando={enviando}
        desabilitado={!podeEnviar}
        estilo={{ alignSelf: 'stretch', marginTop: espaco.sm }}
      />
      <Text style={p.rodape}>
        Você vai para um checkout seguro (PIX, crédito ou débito). O processo começa assim que o
        pagamento é confirmado.
      </Text>
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
    celular: { marginTop: espaco.xs },
    rodape: { ...tipo.legenda, color: c.textoMedio, textAlign: 'center', lineHeight: 18 },
  });
