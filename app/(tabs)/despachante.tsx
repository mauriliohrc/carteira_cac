import React, { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { espaco, raio, tipo, useCores, useEstilos, type Paleta } from '@/tema';
import { useApp } from '@/estado/AppContext';
import { Secao, Tela, TituloTela } from '@/ui/base';
import { AcoesCabecalho } from '@/ui/AcoesCabecalho';
import { avisar } from '@/ui/dialogo';
import { listarServicos } from '@/despachante/api';
import type { TipoServicoDespachante } from '@/domain/tipos';

/** Serviços oferecidos — rótulos de vitrine. Preço/nota de GRU vêm do servidor
 *  (GET /despachante/servicos), exibidos no onboarding de cada serviço. */
const SERVICOS: {
  tipo: TipoServicoDespachante;
  icone: keyof typeof Ionicons.glyphMap;
  titulo: string;
  sub: string;
}[] = [
  {
    tipo: 'CADASTRO_RENOVACAO_IBAMA',
    icone: 'leaf-outline',
    titulo: 'Cadastro / Renovação IBAMA',
    sub: 'Cuidamos do seu cadastro ou renovação no IBAMA (CTF).',
  },
  {
    tipo: 'AQUISICAO_TRANSFERENCIA',
    icone: 'swap-horizontal-outline',
    titulo: 'Aquisição / Transferência de Equipamento (CAC)',
    sub: 'Conduzimos a aquisição ou transferência do seu armamento.',
  },
  {
    tipo: 'POSSE_PF',
    icone: 'home-outline',
    titulo: 'Posse - Polícia Federal',
    sub: 'Tocamos o seu processo de posse junto à Polícia Federal.',
  },
  {
    tipo: 'PORTE_PF',
    icone: 'shield-checkmark-outline',
    titulo: 'Porte - Polícia Federal',
    sub: 'Tocamos o seu processo de porte junto à Polícia Federal.',
  },
];

export default function Despachante() {
  const c = useCores();
  const s = useEstilos(folha);
  const { processos } = useApp();
  const [whatsappJuridico, setWhatsappJuridico] = useState('');

  useEffect(() => {
    let vivo = true;
    listarServicos()
      .then((cat) => {
        if (vivo) setWhatsappJuridico(cat.whatsappJuridico ?? '');
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, []);

  const emAberto = processos.filter((p) => p.status !== 'concluido' && p.status !== 'cancelado');

  const abrirWhatsapp = (mensagem: string) => {
    const num = (whatsappJuridico || '').replace(/\D/g, '');
    if (!num) {
      return avisar('Fale conosco', 'Canal de atendimento ainda não configurado. Tente mais tarde.');
    }
    Linking.openURL(`https://wa.me/${num}?text=${encodeURIComponent(mensagem)}`).catch(() =>
      avisar('Não foi possível abrir', 'Verifique se o WhatsApp está instalado.')
    );
  };

  return (
    <Tela sobBarra acao={<AcoesCabecalho />}>
      <TituloTela
        titulo="Serviços"
        sub="Deixe a burocracia com a gente. Você contrata, paga pelo app e acompanha por aqui."
      />

      <Secao titulo="Serviços">
        <View style={s.listaCards}>
        {SERVICOS.map((srv) => (
          <Pressable
            key={srv.tipo}
            onPress={() =>
              router.push({ pathname: '/despachante/servico', params: { tipo: srv.tipo } })
            }
            style={s.card}
          >
            <View style={s.icone}>
              <Ionicons name={srv.icone} size={24} color={c.primario} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.cardTitulo}>{srv.titulo}</Text>
              <Text style={s.cardSub}>{srv.sub}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={c.textoFraco} />
          </Pressable>
        ))}

          {/* Auxílio Jurídico — não é um serviço pago; abre o WhatsApp do Carteira CAC. */}
          <Pressable
            onPress={() => abrirWhatsapp('Olá! Preciso do auxílio jurídico da Carteira CAC.')}
            style={s.card}
          >
            <View style={s.icone}>
              <Ionicons name="chatbubbles-outline" size={24} color={c.primario} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.cardTitulo}>Auxílio Jurídico</Text>
              <Text style={s.cardSub}>Fale com o nosso time jurídico pelo WhatsApp.</Text>
            </View>
            <Ionicons name="logo-whatsapp" size={20} color={c.primario} />
          </Pressable>

          {/* Outros serviços — mesmo canal de atendimento (WhatsApp). */}
          <Pressable
            onPress={() => abrirWhatsapp('Olá! Gostaria de saber sobre outros serviços da Carteira CAC.')}
            style={s.card}
          >
            <View style={s.icone}>
              <Ionicons name="ellipsis-horizontal" size={24} color={c.primario} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.cardTitulo}>Outros serviços</Text>
              <Text style={s.cardSub}>Precisa de algo diferente? Fale com a gente pelo WhatsApp.</Text>
            </View>
            <Ionicons name="logo-whatsapp" size={20} color={c.primario} />
          </Pressable>
        </View>
      </Secao>

      <Secao titulo="Acompanhamento">
        <Pressable onPress={() => router.push('/despachante/meus')} style={s.card}>
          <View style={s.icone}>
            <Ionicons name="list-outline" size={24} color={c.primario} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.cardTitulo}>Meus processos</Text>
            <Text style={s.cardSub}>
              {emAberto.length
                ? `${emAberto.length} em andamento`
                : 'Acompanhe aqui os processos contratados'}
            </Text>
          </View>
          {emAberto.length ? (
            <View style={s.badge}>
              <Text style={s.badgeTexto}>{emAberto.length > 9 ? '9+' : emAberto.length}</Text>
            </View>
          ) : (
            <Ionicons name="chevron-forward" size={20} color={c.textoFraco} />
          )}
        </Pressable>
      </Secao>
    </Tela>
  );
}

const folha = (c: Paleta) =>
  StyleSheet.create({
    listaCards: { gap: espaco.md },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: espaco.md,
      backgroundColor: c.superficie,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.borda,
      borderRadius: raio.lg,
      padding: espaco.md,
    },
    icone: {
      width: 46,
      height: 46,
      borderRadius: raio.md,
      backgroundColor: c.primarioFraco,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardTitulo: { ...tipo.corpo, fontWeight: '700', color: c.texto },
    cardSub: { ...tipo.legenda, color: c.textoMedio, marginTop: 2 },
    badge: {
      minWidth: 22,
      height: 22,
      paddingHorizontal: 6,
      borderRadius: 11,
      backgroundColor: c.primario,
      alignItems: 'center',
      justifyContent: 'center',
    },
    badgeTexto: { fontSize: 11, fontWeight: '800', color: '#FFF' },
  });
