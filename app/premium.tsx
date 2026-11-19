import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Constants from 'expo-constants';

import { espaco, MONO, raio, tipo, useCores, useEstilos, type Paleta } from '@/tema';
import { useApp } from '@/estado/AppContext';
import { Botao, Tela } from '@/ui/base';
import { avisar } from '@/ui/dialogo';
import {
  BENEFICIOS_PREMIUM,
  LIMITE_GRATUITO_ARMAS,
  carregarOfertas,
  comprarPlano,
  restaurarCompras,
  type IdPlano,
  type OfertaPlano,
} from '@/billing';
import { registrarPresenca } from '@/push/presenca';
import { registrarDispositivo } from '@/push/registro';
import { lerToken } from '@/conta/armazenamento';

/** Sincroniza o premium com o servidor: por conta (presença) e por aparelho (registro). */
async function sincronizarPremiumServidor() {
  const tk = await lerToken();
  void registrarPresenca(true); // conta logada → UsuarioApp.premium
  void registrarDispositivo(tk ?? undefined); // aparelho (cobre anônimo) → DispositivoPush.premium
}

const LEGAL = (Constants.expoConfig?.extra as { legal?: { termosUrl?: string; privacidadeUrl?: string } })?.legal;
const TERMOS_URL = LEGAL?.termosUrl ?? 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';
const PRIVACIDADE_URL = LEGAL?.privacidadeUrl ?? '';

export default function Premium() {
  const c = useCores();
  const p = useEstilos(folha);
  const { armas, premium, definirPremium } = useApp();
  const [plano, setPlano] = useState<IdPlano>('premium_mensal');
  const [ofertas, setOfertas] = useState<OfertaPlano[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [processando, setProcessando] = useState(false);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        // A ANUAL saiu de vez: o vínculo anual agora é a FILIAÇÃO à liga (via
        // Asaas), inclusive para sócios de parceiro — não há mais plano anual
        // nem plano de parceiro na vitrine. Aqui fica só a mensalidade do app,
        // para quem quer apenas destravar o aplicativo sem se filiar. Assinantes
        // antigos seguem intactos (restore e renovação da anual continuam).
        const lista = (await carregarOfertas()).filter((o) => o.id === 'premium_mensal');
        if (!vivo) return;
        setOfertas(lista);
        if (lista.length) setPlano(lista[0].id);
      } finally {
        if (vivo) setCarregando(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, []);

  const assinar = async () => {
    setProcessando(true);
    try {
      const ok = await comprarPlano(plano);
      if (ok) {
        await definirPremium(true);
        void sincronizarPremiumServidor(); // reporta o premium (conta + aparelho)
        avisar('Premium ativo', 'Seu acervo está liberado. Bom tiro!');
        router.back();
      }
    } catch (e) {
      avisar('Não deu para assinar', e instanceof Error ? e.message : String(e));
    } finally {
      setProcessando(false);
    }
  };

  const restaurar = async () => {
    const ok = await restaurarCompras();
    await definirPremium(ok);
    void sincronizarPremiumServidor(); // sincroniza o premium (conta + aparelho)
    avisar(
      ok ? 'Assinatura restaurada' : 'Nada encontrado',
      ok ? 'Seu Premium foi reativado.' : 'Não encontramos uma assinatura ativa nesta conta.'
    );
  };

  if (premium) {
    return (
      <Tela voltar tituloCabecalho="Premium" estilo={p.conteudo}>
        <View style={p.coroa}>
          <Ionicons name="star" size={26} color={c.latao} />
        </View>
        <Text style={p.titulo}>Premium ativo</Text>
        <Text style={p.subtitulo}>
          Acervo ilimitado liberado. Você tem {armas.length} arma(s) cadastrada(s).
        </Text>
        <Botao
          titulo="Voltar ao acervo"
          icone="arrow-back"
          aoTocar={() => router.back()}
          estilo={{ marginTop: espaco.xl, alignSelf: 'stretch' }}
        />
      </Tela>
    );
  }

  return (
    <Tela voltar tituloCabecalho="Premium" estilo={p.conteudo}>
      <View style={p.coroa}>
        <Ionicons name="shield-half-outline" size={26} color={c.latao} />
      </View>
      <Text style={p.titulo}>Filie-se à liga</Text>
      <Text style={p.subtitulo}>
        A filiação à liga esportiva dá o vínculo anual (válido na Polícia Federal), assessoria
        jurídica e o Premium completo. Ou assine só a mensalidade do app.
      </Text>

      <Pressable style={p.filiacao} onPress={() => router.push('/filiacao')}>
        <View style={p.filiacaoSelo}>
          <Ionicons name="ribbon" size={14} color={c.latao} />
          <Text style={p.parceiroSeloTexto}>LIGA</Text>
        </View>
        <Text style={p.parceiroTitulo}>Filiação à liga esportiva</Text>
        <Text style={p.parceiroSub}>
          Vínculo de 1 ano, provas de nível nacional, carteirinha, certificado e Premium incluso.
        </Text>
        <View style={p.filiacaoCta}>
          <Text style={p.filiacaoCtaTexto}>Conhecer a filiação</Text>
          <Ionicons name="arrow-forward" size={16} color={c.sobrePrimario} />
        </View>
      </Pressable>

      <View style={p.beneficios}>
        {BENEFICIOS_PREMIUM.map((b) => (
          <View key={b} style={p.beneficio}>
            <Ionicons name="checkmark-circle-outline" size={17} color={c.primario} />
            <Text style={p.beneficioTexto}>{b}</Text>
          </View>
        ))}
      </View>

      {carregando ? (
        <ActivityIndicator color={c.primario} style={{ marginTop: espaco.xl }} />
      ) : ofertas.length ? (
        <>
          <View style={p.planos}>
            {ofertas.map((item) => {
              const ativo = plano === item.id;
              return (
                <Pressable
                  key={item.id}
                  onPress={() => setPlano(item.id)}
                  style={[p.plano, ativo ? p.planoAtivo : null]}
                >
                  <View style={p.planoTopo}>
                    <Ionicons
                      name={ativo ? 'radio-button-on' : 'radio-button-off'}
                      size={20}
                      color={ativo ? c.primario : c.textoFraco}
                    />
                    <Text style={p.planoRotulo}>{item.rotulo}</Text>
                    {item.destaque ? (
                      <View style={p.tagEconomia}>
                        <Text style={p.tagEconomiaTexto}>MELHOR VALOR</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={p.planoPreco}>{item.preco}</Text>
                  <Text style={p.planoEquivalente}>{item.equivalente}</Text>
                </Pressable>
              );
            })}
          </View>

          <Botao
            titulo="Assinar mensalidade do app"
            icone="star"
            aoTocar={assinar}
            carregando={processando}
            estilo={{ alignSelf: 'stretch', marginTop: espaco.lg }}
          />
        </>
      ) : (
        <Text style={p.indisponivel}>
          As assinaturas estão indisponíveis no momento. Verifique sua conexão e tente de novo.
        </Text>
      )}

      <Botao
        titulo="Restaurar compra"
        variante="fantasma"
        aoTocar={restaurar}
        estilo={{ alignSelf: 'stretch', marginTop: espaco.sm }}
      />

      <Text style={p.disclosure}>
        A assinatura renova automaticamente pelo mesmo período e preço, a menos que seja cancelada
        até 24 horas antes do fim do ciclo. O pagamento é cobrado na sua conta Apple ao confirmar a
        compra. Você gerencia ou cancela quando quiser nos Ajustes da App Store.
      </Text>

      <View style={p.links}>
        <Text style={p.link} onPress={() => void Linking.openURL(TERMOS_URL)}>
          Termos de Uso
        </Text>
        {PRIVACIDADE_URL ? (
          <>
            <Text style={p.linkSep}>·</Text>
            <Text style={p.link} onPress={() => void Linking.openURL(PRIVACIDADE_URL)}>
              Política de Privacidade
            </Text>
          </>
        ) : null}
      </View>
    </Tela>
  );
}

const folha = (c: Paleta) =>
  StyleSheet.create({
    conteudo: { alignItems: 'center', paddingHorizontal: espaco.lg },
    coroa: {
      width: 58,
      height: 58,
      borderRadius: raio.sm,
      backgroundColor: c.lataoFraco,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: `${c.latao}88`,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: espaco.lg,
    },
    titulo: { ...tipo.telaTitulo, color: c.texto, textAlign: 'center' },
    subtitulo: {
      ...tipo.corpo,
      color: c.textoMedio,
      textAlign: 'center',
      marginTop: espaco.sm,
      maxWidth: 320,
    },
    filiacao: {
      alignSelf: 'stretch',
      marginTop: espaco.xl,
      padding: espaco.lg,
      borderRadius: raio.md,
      backgroundColor: c.lataoFraco,
      borderWidth: 1,
      borderColor: `${c.latao}88`,
      alignItems: 'center',
    },
    filiacaoSelo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: `${c.latao}22`,
      borderRadius: raio.sm,
      paddingHorizontal: espaco.sm,
      paddingVertical: 4,
    },
    filiacaoCta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: c.primario,
      borderRadius: raio.sm,
      paddingHorizontal: espaco.lg,
      paddingVertical: 10,
      marginTop: espaco.md,
    },
    filiacaoCtaTexto: { ...tipo.corpoPequeno, fontWeight: '700', color: c.sobrePrimario },
    parceiroSeloTexto: { ...tipo.etiqueta, fontSize: 9, color: c.latao },
    parceiroTitulo: { ...tipo.titulo, color: c.texto, marginTop: espaco.sm },
    parceiroSub: {
      ...tipo.corpoPequeno,
      color: c.textoMedio,
      textAlign: 'center',
      marginTop: 4,
      maxWidth: 320,
    },

    beneficios: { alignSelf: 'stretch', marginTop: espaco.xl, gap: espaco.md },
    beneficio: { flexDirection: 'row', alignItems: 'center', gap: espaco.md },
    beneficioTexto: { flex: 1, ...tipo.corpo, color: c.texto },
    planos: { alignSelf: 'stretch', gap: espaco.md, marginTop: espaco.xl },
    plano: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.borda,
      borderRadius: raio.md,
      padding: espaco.lg,
      backgroundColor: c.superficie,
    },
    planoAtivo: { borderColor: c.primario, backgroundColor: c.primarioFraco },
    planoTopo: { flexDirection: 'row', alignItems: 'center', gap: espaco.sm },
    planoRotulo: { flex: 1, ...tipo.subtitulo, color: c.texto },
    tagEconomia: {
      backgroundColor: c.latao,
      paddingHorizontal: 6,
      paddingVertical: 3,
      borderRadius: 3,
    },
    tagEconomiaTexto: {
      ...tipo.etiqueta,
      fontSize: 8.5,
      color: c.nome === 'claro' ? '#FFF' : '#1A1403',
    },
    planoPreco: {
      ...tipo.numero,
      fontSize: 21,
      color: c.texto,
      marginTop: espaco.sm,
      fontFamily: MONO,
      letterSpacing: 0,
    },
    planoEquivalente: { ...tipo.legenda, color: c.textoFraco, marginTop: 3 },
    disclosure: {
      ...tipo.legenda,
      fontSize: 11,
      lineHeight: 15,
      color: c.textoFraco,
      textAlign: 'center',
      marginTop: espaco.xl,
    },
    links: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: espaco.sm,
      marginTop: espaco.md,
    },
    link: { ...tipo.legenda, fontSize: 11.5, color: c.primario, fontWeight: '600' },
    linkSep: { ...tipo.legenda, fontSize: 11.5, color: c.textoFraco },
    indisponivel: {
      ...tipo.corpoPequeno,
      color: c.textoFraco,
      textAlign: 'center',
      marginTop: espaco.xl,
      marginBottom: espaco.sm,
    },
  });
