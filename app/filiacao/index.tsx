import React, { useCallback, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';

import { espaco, raio, tipo, useCores, useEstilos, type Paleta } from '@/tema';
import { Botao, Carregando, Tela } from '@/ui/base';
import { CONTEUDO_LIGA_PADRAO, obterFiliacao, type ConfigFiliacao } from '@/filiacao/api';
import { filiacaoVigente } from '@/db/filiacoes';
import type { Filiacao } from '@/domain/tipos';

function precoAno(centavos: number): string {
  return `R$ ${(centavos / 100).toFixed(2).replace('.', ',')}`;
}

/**
 * Apresentação da filiação à liga esportiva. A filiação (anuidade via Asaas) é o
 * produto principal: concede Premium, carteirinha, certificado e assessoria
 * jurídica. Já filiado → atalho para a carteirinha. Pendente de pagamento →
 * retoma o checkout.
 */
export default function FiliacaoApresentacao() {
  const c = useCores();
  const s = useEstilos(folha);
  const { novidade } = useLocalSearchParams<{ novidade?: string }>();
  const [filiacao, setFiliacao] = useState<Filiacao | null>(null);
  const [config, setConfig] = useState<ConfigFiliacao | null>(null);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    const r = await obterFiliacao();
    if (r) {
      setFiliacao(r.filiacao);
      setConfig(r.config);
    }
    setCarregando(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar])
  );

  if (carregando) {
    return (
      <Tela voltar tituloCabecalho="Filiação">
        <Carregando />
      </Tela>
    );
  }

  const vigente = filiacao ? filiacaoVigente(filiacao) : false;
  const pendentePagamento = filiacao?.status === 'pendente_pagamento' && !!filiacao.invoiceUrl;
  const nomeLiga = config?.nomeLiga ?? 'Liga';
  const conteudo = config?.conteudo ?? CONTEUDO_LIGA_PADRAO;

  return (
    <Tela voltar tituloCabecalho="Filiação" estilo={s.conteudo}>
      <View style={s.topo}>
        {config?.logoUrl ? (
          <Image source={{ uri: config.logoUrl }} style={s.logo} resizeMode="contain" />
        ) : (
          <View style={s.selo}>
            <Ionicons name="ribbon" size={26} color={c.latao} />
          </View>
        )}
        <Text style={s.liga}>{nomeLiga}</Text>
      </View>

      {vigente ? (
        <>
          <Text style={s.titulo}>Você é filiado</Text>
          <Text style={s.sub}>
            Filiação {filiacao?.numeroFiliacao ?? ''} ativa. Acesse sua carteirinha digital e o
            certificado.
          </Text>
          <Botao
            titulo="Ver carteirinha"
            icone="card-outline"
            aoTocar={() => router.push('/filiacao/carteirinha')}
            estilo={{ alignSelf: 'stretch', marginTop: espaco.xl }}
          />
          {!filiacao?.documentacaoCompleta ? (
            <Botao
              titulo="Enviar documento de identificação"
              variante="secundario"
              icone="document-attach-outline"
              aoTocar={() => router.push('/filiacao/dados')}
              estilo={{ alignSelf: 'stretch', marginTop: espaco.sm }}
            />
          ) : null}
        </>
      ) : (
        <>
          {novidade === '1' ? (
            <View style={s.novidade}>
              <Ionicons name="sparkles" size={15} color={c.latao} />
              <Text style={s.novidadeTexto}>Novidade: agora somos uma liga esportiva!</Text>
            </View>
          ) : null}
          <Text style={s.titulo}>{conteudo.titulo}</Text>
          <Text style={s.sub}>{conteudo.subtitulo}</Text>

          <View style={s.beneficios}>
            {conteudo.vantagens.map((b) => (
              <View key={b} style={s.beneficio}>
                <Ionicons name="checkmark-circle-outline" size={17} color={c.primario} />
                <Text style={s.beneficioTexto}>{b}</Text>
              </View>
            ))}
          </View>

          {/* Credibilidade / legalidade — reforço de confiança. */}
          <View style={s.credCartao}>
            <Ionicons name="shield-checkmark" size={18} color={c.latao} />
            <Text style={s.credTexto}>{conteudo.credibilidade}</Text>
          </View>

          {config ? (
            <View style={s.precoCartao}>
              <Text style={s.preco}>
                {precoAno(config.valorCentavos)} <Text style={s.precoPeriodo}>/ ano</Text>
              </Text>
              <Text style={s.precoNota}>Assinatura anual via Asaas (PIX, crédito ou débito).</Text>
            </View>
          ) : null}

          {pendentePagamento ? (
            <Botao
              titulo="Concluir pagamento"
              icone="card-outline"
              aoTocar={() =>
                router.push({
                  pathname: '/filiacao/checkout',
                  params: { url: filiacao!.invoiceUrl! },
                })
              }
              estilo={{ alignSelf: 'stretch', marginTop: espaco.xl }}
            />
          ) : (
            <Botao
              titulo={config?.ativo ? 'Filiar-se' : 'Filiação indisponível'}
              icone="ribbon"
              desabilitado={!config?.ativo}
              aoTocar={() => router.push('/filiacao/dados')}
              estilo={{ alignSelf: 'stretch', marginTop: espaco.xl }}
            />
          )}
          <Text style={s.disclosure}>{conteudo.termos}</Text>
        </>
      )}
    </Tela>
  );
}

const folha = (c: Paleta) =>
  StyleSheet.create({
    conteudo: { alignItems: 'center', paddingHorizontal: espaco.lg },
    topo: { alignItems: 'center', marginBottom: espaco.md },
    logo: { width: 120, height: 72, marginBottom: espaco.sm },
    selo: {
      width: 58,
      height: 58,
      borderRadius: raio.sm,
      backgroundColor: c.lataoFraco,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: `${c.latao}88`,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: espaco.sm,
    },
    liga: { ...tipo.subtitulo, color: c.texto, textAlign: 'center' },
    novidade: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      alignSelf: 'center',
      marginTop: espaco.md,
      paddingHorizontal: espaco.md,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: c.lataoFraco,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: `${c.latao}88`,
    },
    novidadeTexto: { ...tipo.etiqueta, fontSize: 10.5, color: c.latao },
    titulo: { ...tipo.telaTitulo, color: c.texto, textAlign: 'center', marginTop: espaco.md },
    sub: {
      ...tipo.corpo,
      color: c.textoMedio,
      textAlign: 'center',
      marginTop: espaco.sm,
      maxWidth: 340,
    },
    beneficios: { alignSelf: 'stretch', marginTop: espaco.xl, gap: espaco.md },
    beneficio: { flexDirection: 'row', alignItems: 'center', gap: espaco.md },
    beneficioTexto: { flex: 1, ...tipo.corpo, color: c.texto },
    credCartao: {
      alignSelf: 'stretch',
      flexDirection: 'row',
      alignItems: 'center',
      gap: espaco.sm,
      marginTop: espaco.lg,
      padding: espaco.md,
      borderRadius: raio.md,
      backgroundColor: c.lataoFraco,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: `${c.latao}66`,
    },
    credTexto: { flex: 1, ...tipo.corpoPequeno, color: c.textoMedio, lineHeight: 18 },
    precoCartao: {
      alignSelf: 'stretch',
      marginTop: espaco.xl,
      padding: espaco.lg,
      borderRadius: raio.md,
      backgroundColor: c.primarioFraco,
      borderWidth: 1,
      borderColor: `${c.primario}66`,
      alignItems: 'center',
    },
    preco: { ...tipo.numero, fontSize: 26, color: c.texto },
    precoPeriodo: { ...tipo.corpoPequeno, color: c.textoFraco },
    precoNota: { ...tipo.legenda, color: c.textoFraco, marginTop: 4, textAlign: 'center' },
    disclosure: {
      ...tipo.legenda,
      fontSize: 11,
      lineHeight: 15,
      color: c.textoFraco,
      textAlign: 'center',
      marginTop: espaco.lg,
    },
  });
