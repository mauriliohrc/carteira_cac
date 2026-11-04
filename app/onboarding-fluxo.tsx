import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { espaco, raio, tipo, useCores, useEstilos, type Paleta } from '@/tema';
import { Botao } from '@/ui/base';
import { useApp } from '@/estado/AppContext';
import { useConta } from '@/conta/ContaContext';
import { CHAVES, gravarConfig } from '@/db/config';
import { AnalisandoDocumento } from '@/ui/AnalisandoDocumento';
import { capturarCraf, capturarDocumentoPessoal } from '@/ui/onboardingAcervo';

/**
 * Fluxo guiado único: conta → validar e-mail → CR/Posse/Porte → CRAF → premium.
 *
 * Os passos são DERIVADOS do estado (está logado? e-mail confirmado? tem
 * documento? tem arma?), não uma máquina manual. Assim ele "retoma" sozinho ao
 * voltar das telas de conta e serve tanto ao novo usuário quanto a quem já tem
 * conta mas ainda não cadastrou nada. Nada é obrigatório: dá para pular cada
 * passo. A captura de documento/CRAF NÃO abre formulário: sobe o arquivo, a IA
 * lê e a gente cria o esqueleto do acervo na hora.
 */
export default function OnboardingFluxo() {
  const c = useCores();
  const p = useEstilos(folha);
  const inset = useSafeAreaInsets();
  const { logado, usuario } = useConta();
  const { documentos, armas, recarregar } = useApp();

  const [pulouConta, setPulouConta] = useState(false);
  const [pulouValidar, setPulouValidar] = useState(false);
  const [pulouCR, setPulouCR] = useState(false);
  const [pulouCRAF, setPulouCRAF] = useState(false);
  const [analisando, setAnalisando] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  const etapa: 'conta' | 'validar' | 'cr' | 'craf' | 'premium' =
    !logado && !pulouConta
      ? 'conta'
      : logado && usuario && !usuario.emailVerificado && !pulouValidar
        ? 'validar'
        : documentos.length === 0 && !pulouCR
          ? 'cr'
          : armas.length === 0 && !pulouCRAF
            ? 'craf'
            : 'premium';

  const concluir = async () => {
    await gravarConfig(CHAVES.onboardingFluxo, '1').catch(() => {});
    router.back();
  };

  const enviarCR = async () => {
    if (ocupado) return;
    setOcupado(true);
    try {
      const r = await capturarDocumentoPessoal('CR', setAnalisando);
      if (r === 'criado') await recarregar(); // documentos.length muda → avança
    } finally {
      setOcupado(false);
    }
  };

  const enviarCRAF = async () => {
    if (ocupado) return;
    setOcupado(true);
    try {
      const r = await capturarCraf(setAnalisando);
      if (r === 'criado') await recarregar(); // armas.length muda → avança
    } finally {
      setOcupado(false);
    }
  };

  return (
    <View style={[p.fundo, { paddingTop: inset.top + espaco.lg, paddingBottom: inset.bottom + espaco.lg }]}>
      <ScrollView contentContainerStyle={p.conteudo} showsVerticalScrollIndicator={false}>
        {etapa === 'conta' ? (
          <Passo
            p={p}
            c={c}
            selo="SUA CONTA NA NUVEM"
            icone="cloud-upload"
            titulo={'Seu acervo seguro\nem qualquer aparelho'}
            sub="Com uma conta grátis, seu acervo sincroniza na nuvem e você acessa de qualquer celular. Sem conta, tudo fica só neste aparelho."
            itens={[
              { icone: 'cloud-done-outline', texto: 'Backup automático — nada se perde' },
              { icone: 'phone-portrait-outline', texto: 'Troque de celular sem perder o acervo' },
              { icone: 'document-attach-outline', texto: 'Documentos e fotos sincronizados' },
            ]}
          />
        ) : null}

        {etapa === 'validar' ? (
          <Passo
            p={p}
            c={c}
            selo="CONFIRME SEU E-MAIL"
            icone="mail-unread"
            titulo="Falta confirmar\nseu e-mail"
            sub={`Sua conta foi criada, mas ainda não está ativa. Enviamos um código para ${usuario?.email ?? 'seu e-mail'}. Confirmar ativa a conta e protege seus dados.`}
          />
        ) : null}

        {etapa === 'cr' ? (
          <Passo
            p={p}
            c={c}
            selo="PASSO 1 · SEU REGISTRO"
            icone="ribbon"
            titulo={'Envie seu CR,\nPosse ou Porte'}
            sub="Só tire uma foto ou escolha o PDF — a IA lê o documento e preenche tudo pra você. Nada de formulário: o que faltar, você completa depois."
          />
        ) : null}

        {etapa === 'craf' ? (
          <Passo
            p={p}
            c={c}
            selo="PASSO 2 · SUA ARMA"
            icone="shield-checkmark"
            titulo={'Envie o CRAF\nde uma arma'}
            sub="Suba o CRAF e a IA cria a ficha da arma automaticamente, com o documento já anexado. Você revisa e ajusta quando quiser."
          />
        ) : null}

        {etapa === 'premium' ? (
          <Passo
            p={p}
            c={c}
            selo="APOIE O PROJETO"
            icone="heart"
            titulo={'Ajude a manter\no app de pé'}
            sub="Esta ferramenta é feita por um atirador para facilitar a vida do CAC — justamente num momento em que querem desarmar a população. Sua assinatura mantém o desenvolvimento vivo. E fique tranquilo: dá pra usar de graça com uma arma."
            itens={[
              { icone: 'infinite-outline', texto: 'Armas e documentos ilimitados' },
              { icone: 'sparkles-outline', texto: 'Leitura de documentos por IA' },
              { icone: 'hand-left-outline', texto: 'Apoio direto a quem constrói o app' },
            ]}
          />
        ) : null}
      </ScrollView>

      <View style={p.rodape}>
        {etapa === 'conta' ? (
          <>
            <Botao titulo="Criar conta grátis" icone="person-add-outline" aoTocar={() => router.push('/conta/cadastrar')} />
            <Botao
              titulo="Já tenho conta"
              variante="secundario"
              icone="log-in-outline"
              aoTocar={() => router.push('/conta/entrar')}
              estilo={{ marginTop: espaco.sm }}
            />
            <Botao titulo="Usar sem conta" variante="fantasma" aoTocar={() => setPulouConta(true)} estilo={{ marginTop: espaco.xs }} />
          </>
        ) : null}

        {etapa === 'validar' ? (
          <>
            <Botao titulo="Confirmar e-mail agora" icone="mail-open-outline" aoTocar={() => router.push('/conta/verificar')} />
            <Botao titulo="Agora não" variante="fantasma" aoTocar={() => setPulouValidar(true)} estilo={{ marginTop: espaco.xs }} />
          </>
        ) : null}

        {etapa === 'cr' ? (
          <>
            <Botao titulo="Enviar documento" icone="scan-outline" aoTocar={enviarCR} carregando={ocupado} />
            <Botao titulo="Pular por enquanto" variante="fantasma" aoTocar={() => setPulouCR(true)} estilo={{ marginTop: espaco.xs }} />
          </>
        ) : null}

        {etapa === 'craf' ? (
          <>
            <Botao titulo="Enviar CRAF" icone="scan-outline" aoTocar={enviarCRAF} carregando={ocupado} />
            <Botao titulo="Pular por enquanto" variante="fantasma" aoTocar={() => setPulouCRAF(true)} estilo={{ marginTop: espaco.xs }} />
          </>
        ) : null}

        {etapa === 'premium' ? (
          <>
            <Botao titulo="Quero apoiar e assinar" icone="heart" aoTocar={() => router.push('/premium')} />
            <Botao titulo="Continuar grátis com 1 arma" variante="fantasma" aoTocar={() => void concluir()} estilo={{ marginTop: espaco.xs }} />
          </>
        ) : null}

        <Text style={p.rodapeNota}>Você pode completar tudo depois, direto no app.</Text>
      </View>

      <AnalisandoDocumento visivel={analisando} />
    </View>
  );
}

function Passo({
  p,
  c,
  selo,
  icone,
  titulo,
  sub,
  itens,
}: {
  p: ReturnType<typeof useEstilos<ReturnType<typeof folha>>>;
  c: ReturnType<typeof useCores>;
  selo: string;
  icone: keyof typeof Ionicons.glyphMap;
  titulo: string;
  sub: string;
  itens?: { icone: keyof typeof Ionicons.glyphMap; texto: string }[];
}) {
  return (
    <>
      <View style={p.selo}>
        <Ionicons name={icone} size={28} color={c.primario} />
        <Text style={p.seloTexto}>{selo}</Text>
      </View>
      <Text style={p.titulo}>{titulo}</Text>
      <Text style={p.sub}>{sub}</Text>
      {itens?.length ? (
        <View style={p.lista}>
          {itens.map((it) => (
            <View key={it.texto} style={p.item}>
              <Ionicons name={it.icone} size={20} color={c.primario} />
              <Text style={p.itemTexto}>{it.texto}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </>
  );
}

const folha = (c: Paleta) =>
  StyleSheet.create({
    fundo: { flex: 1, backgroundColor: c.fundo, paddingHorizontal: espaco.xl },
    conteudo: { flexGrow: 1, justifyContent: 'center', paddingVertical: espaco.xl },
    selo: {
      alignSelf: 'center',
      flexDirection: 'row',
      alignItems: 'center',
      gap: espaco.sm,
      paddingHorizontal: espaco.lg,
      paddingVertical: espaco.sm,
      borderRadius: raio.lg,
      backgroundColor: c.primarioFraco,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: `${c.primario}66`,
      marginBottom: espaco.xl,
    },
    seloTexto: { ...tipo.etiqueta, fontSize: 11.5, letterSpacing: 1.5, color: c.primario, fontWeight: '800' },
    titulo: { ...tipo.titulo, fontSize: 25, color: c.texto, textAlign: 'center' },
    sub: { ...tipo.corpo, color: c.textoMedio, textAlign: 'center', marginTop: espaco.md, lineHeight: 22 },
    lista: {
      marginTop: espaco.xxl,
      gap: espaco.md,
      backgroundColor: c.superficie,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.borda,
      borderRadius: raio.lg,
      padding: espaco.lg,
    },
    item: { flexDirection: 'row', alignItems: 'center', gap: espaco.md },
    itemTexto: { flex: 1, ...tipo.corpo, color: c.texto },
    rodape: { paddingTop: espaco.md },
    rodapeNota: { ...tipo.legenda, color: c.textoFraco, textAlign: 'center', marginTop: espaco.sm },
  });
