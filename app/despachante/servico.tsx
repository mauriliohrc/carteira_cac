import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';

import { espaco, MONO, raio, tipo, useCores, useEstilos, type Paleta } from '@/tema';
import { Botao, Tela } from '@/ui/base';
import {
  listarServicos,
  precoUnitarioDespachante,
  temDescontoFiliado,
  type ServicoDespachante,
} from '@/despachante/api';
import { reais } from '@/despachante/formato';
import type { TipoServicoDespachante } from '@/domain/tipos';

/** Passos genéricos (serviços novos usam estes). */
const PASSOS_PADRAO: { icone: keyof typeof Ionicons.glyphMap; texto: string }[] = [
  { icone: 'checkmark-circle-outline', texto: 'Você solicita o serviço aqui pelo app.' },
  { icone: 'card-outline', texto: 'Paga o serviço (PIX, crédito ou débito).' },
  { icone: 'briefcase-outline', texto: 'Nosso despachante protocola e cuida de todo o processo.' },
  { icone: 'notifications-outline', texto: 'Você acompanha o andamento em "Meus processos".' },
];

/** Como o serviço funciona — passos mostrados no onboarding. */
const PASSOS: Partial<Record<
  TipoServicoDespachante,
  { icone: keyof typeof Ionicons.glyphMap; texto: string }[]
>> = {
  RENOVACAO_CRAF: [
    { icone: 'checkmark-circle-outline', texto: 'Você escolhe de qual arma renovar o CRAF.' },
    { icone: 'card-outline', texto: 'Paga o serviço aqui pelo app (PIX, crédito ou débito).' },
    { icone: 'briefcase-outline', texto: 'Nosso despachante protocola e cuida de todo o processo.' },
    { icone: 'notifications-outline', texto: 'Você acompanha o andamento em "Meus processos".' },
  ],
  EMISSAO_GUIA: [
    { icone: 'checkmark-circle-outline', texto: 'Você escolhe o armamento da guia de tráfego.' },
    { icone: 'card-outline', texto: 'Paga o serviço aqui pelo app (PIX, crédito ou débito).' },
    { icone: 'briefcase-outline', texto: 'Emitimos a guia e orientamos você do início ao fim.' },
    { icone: 'notifications-outline', texto: 'Você acompanha o andamento em "Meus processos".' },
  ],
};

export default function ServicoDespachanteTela() {
  const c = useCores();
  const p = useEstilos(folha);
  const { tipo: tipoParam } = useLocalSearchParams<{ tipo: TipoServicoDespachante }>();

  const [servico, setServico] = useState<ServicoDespachante | null>(null);
  const [filiado, setFiliado] = useState(false);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const cat = await listarServicos();
        if (!vivo) return;
        setServico(cat.servicos.find((s) => (s.codigo ?? s.tipo) === tipoParam) ?? null);
        setFiliado(!!cat.filiado);
      } catch {
        /* sem rede: deixa o fallback abaixo */
      } finally {
        if (vivo) setCarregando(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [tipoParam]);

  const passos = PASSOS[tipoParam as TipoServicoDespachante] ?? PASSOS_PADRAO;

  // Preço por unidade (1 equipamento) para cada público. Se houver desconto de
  // filiado e o usuário NÃO for filiado, a tela mostra os dois e convida a filiar.
  const precoNaoFiliado = servico ? precoUnitarioDespachante(servico, 1, false) : 0;
  const precoFiliado = servico ? precoUnitarioDespachante(servico, 1, true) : 0;
  const temDesconto = servico ? temDescontoFiliado(servico) : false;
  const economia = precoNaoFiliado - precoFiliado;

  return (
    <Tela voltar tituloCabecalho="Serviços" estilo={p.conteudo}>
      {carregando ? (
        <ActivityIndicator color={c.primario} style={{ marginTop: espaco.xl }} />
      ) : (
        <>
          <View style={p.coroa}>
            <Ionicons
              name={(servico?.icone ?? 'briefcase-outline') as keyof typeof Ionicons.glyphMap}
              size={28}
              color={c.primario}
            />
          </View>
          <Text style={p.titulo}>{servico?.nome ?? 'Serviço de despachante'}</Text>
          <Text style={p.sub}>{servico?.descricao ?? ''}</Text>

          {servico ? (
            temDesconto ? (
              <View style={p.precoCartao}>
                {filiado ? (
                  <>
                    <View style={p.selo}>
                      <Ionicons name="shield-checkmark" size={13} color={c.primario} />
                      <Text style={p.seloTexto}>preço de filiado</Text>
                    </View>
                    <Text style={p.preco}>{reais(precoFiliado)}</Text>
                    <Text style={p.precoRiscado}>{reais(precoNaoFiliado)}</Text>
                    <Text style={p.precoUnidade}>{servico.unidade}</Text>
                  </>
                ) : (
                  <>
                    <View style={p.linhaPreco}>
                      <View style={p.colPreco}>
                        <Text style={p.precoRotulo}>Não filiado</Text>
                        <Text style={p.precoMedio}>{reais(precoNaoFiliado)}</Text>
                      </View>
                      <View style={[p.colPreco, p.colPrecoDestaque]}>
                        <Text style={[p.precoRotulo, { color: c.primario }]}>Filiado</Text>
                        <Text style={p.preco}>{reais(precoFiliado)}</Text>
                      </View>
                    </View>
                    <Text style={p.precoUnidade}>{servico.unidade}</Text>
                  </>
                )}
              </View>
            ) : (
              <View style={p.precoCartao}>
                <Text style={p.preco}>{reais(filiado ? precoFiliado : precoNaoFiliado)}</Text>
                <Text style={p.precoUnidade}>{servico.unidade}</Text>
              </View>
            )
          ) : null}

          {servico && temDesconto && !filiado ? (
            <Pressable style={p.convite} onPress={() => router.push('/filiacao')}>
              <Ionicons name="shield-checkmark" size={20} color={c.primario} />
              <View style={{ flex: 1 }}>
                <Text style={p.conviteTitulo}>
                  Filie-se à liga e economize{economia > 0 ? ` ${reais(economia)}` : ''}
                </Text>
                <Text style={p.conviteSub}>
                  Filiados pagam menos em todos os serviços do despachante — e ainda têm Premium no app.
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={c.textoFraco} />
            </Pressable>
          ) : null}

          {servico?.comoFunciona ? (
            <View style={p.passos}>
              <Text style={p.passoTexto}>{servico.comoFunciona}</Text>
            </View>
          ) : (
            <View style={p.passos}>
              {passos.map((it) => (
                <View key={it.texto} style={p.passo}>
                  <Ionicons name={it.icone} size={20} color={c.primario} />
                  <Text style={p.passoTexto}>{it.texto}</Text>
                </View>
              ))}
            </View>
          )}

          <View style={p.termos}>
            <Text style={p.termosTitulo}>Antes de contratar, fique ciente:</Text>
            {[
              'Este serviço NÃO garante a aprovação do processo. Você deve cumprir todos os requisitos e exigências legais dos órgãos competentes.',
              'É de sua total responsabilidade enviar toda a documentação necessária para a finalização do processo.',
              'Um processo ainda não pago pode ser excluído a qualquer momento.',
            ].map((t) => (
              <View key={t} style={p.termoItem}>
                <Ionicons name="ellipse" size={6} color={c.textoMedio} style={{ marginTop: 7 }} />
                <Text style={p.termoTexto}>{t}</Text>
              </View>
            ))}
          </View>

          <Botao
            titulo="Contratar"
            icone="arrow-forward"
            aoTocar={() =>
              router.push({ pathname: '/despachante/pedido', params: { tipo: tipoParam } })
            }
            desabilitado={!servico}
            estilo={{ alignSelf: 'stretch', marginTop: espaco.lg }}
          />
        </>
      )}
    </Tela>
  );
}

const folha = (c: Paleta) =>
  StyleSheet.create({
    conteudo: { gap: espaco.md, paddingBottom: espaco.xl },
    coroa: {
      alignSelf: 'center',
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: c.primarioFraco,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: espaco.md,
    },
    titulo: { ...tipo.titulo, fontSize: 25, textAlign: 'center', color: c.texto },
    sub: { ...tipo.corpo, color: c.textoMedio, textAlign: 'center', lineHeight: 22 },
    precoCartao: {
      alignItems: 'center',
      backgroundColor: c.primarioFraco,
      borderRadius: raio.lg,
      paddingVertical: espaco.md,
      marginTop: espaco.sm,
    },
    preco: { ...tipo.numero, fontFamily: MONO, fontSize: 32, color: c.texto },
    precoMedio: { ...tipo.numero, fontFamily: MONO, fontSize: 24, color: c.textoMedio },
    precoRiscado: {
      ...tipo.legenda,
      fontFamily: MONO,
      color: c.textoFraco,
      textDecorationLine: 'line-through',
      marginTop: 2,
    },
    precoUnidade: { ...tipo.legenda, color: c.textoMedio, marginTop: 2 },
    precoRotulo: { ...tipo.legenda, color: c.textoMedio, marginBottom: 2 },
    linhaPreco: { flexDirection: 'row', alignItems: 'stretch', gap: espaco.sm },
    colPreco: { flex: 1, alignItems: 'center', paddingVertical: espaco.xs },
    colPrecoDestaque: {
      backgroundColor: c.superficie,
      borderRadius: raio.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.primario,
    },
    selo: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 },
    seloTexto: { ...tipo.legenda, color: c.primario, fontWeight: '700' },
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
    detalhe: { marginTop: espaco.sm },
    detalheTexto: { ...tipo.legenda, color: c.textoMedio },
    passos: {
      backgroundColor: c.superficie,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.borda,
      borderRadius: raio.lg,
      padding: espaco.lg,
      gap: espaco.md,
    },
    passo: { flexDirection: 'row', alignItems: 'center', gap: espaco.md },
    passoTexto: { ...tipo.corpo, color: c.texto, flex: 1 },
    aviso: {
      flexDirection: 'row',
      gap: espaco.sm,
      backgroundColor: c.lataoFraco,
      borderRadius: raio.md,
      padding: espaco.md,
    },
    avisoTexto: { ...tipo.legenda, color: c.textoMedio, flex: 1, lineHeight: 18 },
    termos: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.borda,
      borderRadius: raio.md,
      padding: espaco.md,
      gap: espaco.xs,
    },
    termosTitulo: { ...tipo.etiqueta, color: c.texto, marginBottom: 2 },
    termoItem: { flexDirection: 'row', gap: espaco.sm, alignItems: 'flex-start' },
    termoTexto: { ...tipo.legenda, color: c.textoMedio, flex: 1, lineHeight: 18 },
  });
