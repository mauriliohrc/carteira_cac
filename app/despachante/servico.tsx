import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';

import { espaco, MONO, raio, tipo, useCores, useEstilos, type Paleta } from '@/tema';
import { Botao, Tela } from '@/ui/base';
import {
  listarServicos,
  type ServicoDespachante,
} from '@/despachante/api';
import { reais } from '@/despachante/formato';
import type { TipoServicoDespachante } from '@/domain/tipos';

/** Como o serviço funciona — passos mostrados no onboarding. */
const PASSOS: Record<
  TipoServicoDespachante,
  { icone: keyof typeof Ionicons.glyphMap; texto: string }[]
> = {
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
  const [gruNota, setGruNota] = useState<string>('');
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const cat = await listarServicos();
        if (!vivo) return;
        setServico(cat.servicos.find((s) => s.tipo === tipoParam) ?? null);
        setGruNota(cat.gruNota);
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

  const passos = PASSOS[tipoParam as TipoServicoDespachante] ?? [];

  return (
    <Tela voltar tituloCabecalho="Serviços" estilo={p.conteudo}>
      {carregando ? (
        <ActivityIndicator color={c.primario} style={{ marginTop: espaco.xl }} />
      ) : (
        <>
          <View style={p.coroa}>
            <Ionicons
              name={tipoParam === 'RENOVACAO_CRAF' ? 'refresh-circle-outline' : 'document-text-outline'}
              size={28}
              color={c.primario}
            />
          </View>
          <Text style={p.titulo}>{servico?.nome ?? 'Serviço de despachante'}</Text>
          <Text style={p.sub}>{servico?.descricao ?? ''}</Text>

          {servico ? (
            <View style={p.precoCartao}>
              <Text style={p.preco}>{reais(servico.precoCentavos)}</Text>
              <Text style={p.precoUnidade}>{servico.unidade}</Text>
              <View style={p.detalhe}>
                <Text style={p.detalheTexto}>
                  GRU {reais(servico.gruCentavos)} + serviço {reais(servico.servicoCentavos)}
                </Text>
              </View>
            </View>
          ) : null}

          <View style={p.passos}>
            {passos.map((it) => (
              <View key={it.texto} style={p.passo}>
                <Ionicons name={it.icone} size={20} color={c.primario} />
                <Text style={p.passoTexto}>{it.texto}</Text>
              </View>
            ))}
          </View>

          {gruNota ? (
            <View style={p.aviso}>
              <Ionicons name="information-circle-outline" size={18} color={c.textoMedio} />
              <Text style={p.avisoTexto}>{gruNota}</Text>
            </View>
          ) : null}

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
    precoUnidade: { ...tipo.legenda, color: c.textoMedio, marginTop: 2 },
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
