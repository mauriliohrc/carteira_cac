import React, { useEffect, useRef, useState } from 'react';
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
import { registrarOfertaExibida } from '@/liga/oferta';
import { registrarEvento, type PassoOnb } from '@/metricas';

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
          : !pulouCRAF
            ? 'craf'
            : 'premium';

  // Métricas do funil: 'onb_iniciou' uma vez e 'onb_passo_entrou' na 1ª vez que
  // cada passo aparece. O passo 'premium' vira 'liga' (nome do funil no server).
  // Chegar à liga também é a 1ª oferta: agenda o cooldown da reconversão e marca
  // 'liga_vista', tudo aqui para não disparar duas vezes.
  const iniciouRegistrado = useRef(false);
  const passosVistos = useRef<Set<PassoOnb>>(new Set());
  const ofertaRegistrada = useRef(false);
  useEffect(() => {
    if (!iniciouRegistrado.current) {
      iniciouRegistrado.current = true;
      void registrarEvento('onb_iniciou');
    }
    const passo: PassoOnb = etapa === 'premium' ? 'liga' : etapa;
    if (!passosVistos.current.has(passo)) {
      passosVistos.current.add(passo);
      void registrarEvento('onb_passo_entrou', { passo });
    }
    if (etapa === 'premium' && !ofertaRegistrada.current) {
      ofertaRegistrada.current = true;
      void registrarEvento('liga_vista');
      void registrarOfertaExibida();
    }
  }, [etapa]);

  // O passo do CRAF é um laço: enviou um, perguntamos "mais um?" e só saímos
  // quando ele disser que não quer mais. Assim ele cadastra o acervo inteiro já
  // no onboarding — e vê, logo em seguida, quanta coisa o Premium destrava.
  const jaInseriuCraf = armas.length > 0;

  const concluir = async () => {
    void registrarEvento('onb_concluiu');
    await gravarConfig(CHAVES.onboardingFluxo, '1').catch(() => {});
    router.back();
  };

  const enviarCR = async () => {
    if (ocupado) return;
    setOcupado(true);
    try {
      const r = await capturarDocumentoPessoal('CR', setAnalisando);
      if (r === 'criado') {
        void registrarEvento('onb_doc_subiu', { passo: 'cr', meta: { tipo: 'CR' } });
        await recarregar(); // documentos.length muda → avança
      }
    } finally {
      setOcupado(false);
    }
  };

  const enviarCRAF = async () => {
    if (ocupado) return;
    setOcupado(true);
    try {
      const r = await capturarCraf(setAnalisando);
      if (r === 'criado') {
        void registrarEvento('onb_doc_subiu', { passo: 'craf', meta: { tipo: 'CRAF' } });
        await recarregar(); // armas.length muda → avança
      }
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
            titulo={'Falta confirmar\nseu e-mail'}
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

        {etapa === 'craf' && !jaInseriuCraf ? (
          <Passo
            p={p}
            c={c}
            selo="PASSO 2 · SUA ARMA"
            icone="shield-checkmark"
            titulo={'Envie o CRAF\nde uma arma'}
            sub="Suba o CRAF e a IA cria a ficha da arma automaticamente, com o documento já anexado. Você revisa e ajusta quando quiser."
          />
        ) : null}

        {etapa === 'craf' && jaInseriuCraf ? (
          <Passo
            p={p}
            c={c}
            selo={`${armas.length} ARMA${armas.length > 1 ? 'S' : ''} NO ACERVO`}
            icone="checkmark-circle"
            titulo={'Deseja inserir\nmais um CRAF?'}
            sub="Tem mais de uma arma? Adicione o CRAF de cada uma agora — a IA monta a ficha de todas. Pare quando terminar."
          />
        ) : null}

        {etapa === 'premium' ? (
          <Passo
            p={p}
            c={c}
            selo="FILIE-SE À LIGA"
            icone="ribbon"
            titulo={'Faça parte da\nliga esportiva'}
            sub="A filiação à liga garante um ano de vínculo associativo, com validade na Polícia Federal para provas de nível nacional, assessoria jurídica — e libera o Premium completo do app. Prefere só o app? Dá pra usar de graça com uma arma, ou assinar a mensalidade."
            itens={[
              { icone: 'shield-checkmark-outline', texto: 'Vínculo de 1 ano válido na PF' },
              { icone: 'ribbon-outline', texto: 'Liga formalizada · responsáveis +10 anos no mercado' },
              { icone: 'card-outline', texto: 'Carteirinha e certificado de filiação' },
              { icone: 'sparkles-outline', texto: 'Premium completo do app incluso' },
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
            <Botao
              titulo="Usar sem conta"
              variante="fantasma"
              aoTocar={() => {
                void registrarEvento('onb_pulou', { passo: 'conta' });
                setPulouConta(true);
              }}
              estilo={{ marginTop: espaco.xs }}
            />
          </>
        ) : null}

        {etapa === 'validar' ? (
          <>
            <Botao titulo="Confirmar e-mail agora" icone="mail-open-outline" aoTocar={() => router.push('/conta/verificar')} />
            <Botao
              titulo="Agora não"
              variante="fantasma"
              aoTocar={() => {
                void registrarEvento('onb_pulou', { passo: 'validar' });
                setPulouValidar(true);
              }}
              estilo={{ marginTop: espaco.xs }}
            />
          </>
        ) : null}

        {etapa === 'cr' ? (
          <>
            <Botao titulo="Enviar documento" icone="scan-outline" aoTocar={enviarCR} carregando={ocupado} />
            <Botao
              titulo="Pular por enquanto"
              variante="fantasma"
              aoTocar={() => {
                void registrarEvento('onb_pulou', { passo: 'cr' });
                setPulouCR(true);
              }}
              estilo={{ marginTop: espaco.xs }}
            />
          </>
        ) : null}

        {etapa === 'craf' && !jaInseriuCraf ? (
          <>
            <Botao titulo="Enviar CRAF" icone="scan-outline" aoTocar={enviarCRAF} carregando={ocupado} />
            <Botao
              titulo="Pular por enquanto"
              variante="fantasma"
              aoTocar={() => {
                void registrarEvento('onb_pulou', { passo: 'craf' });
                setPulouCRAF(true);
              }}
              estilo={{ marginTop: espaco.xs }}
            />
          </>
        ) : null}

        {etapa === 'craf' && jaInseriuCraf ? (
          <>
            <Botao titulo="Inserir mais um CRAF" icone="add" aoTocar={enviarCRAF} carregando={ocupado} />
            <Botao titulo="Não, continuar" variante="fantasma" aoTocar={() => setPulouCRAF(true)} estilo={{ marginTop: espaco.xs }} />
          </>
        ) : null}

        {etapa === 'premium' ? (
          <>
            <Botao
              titulo="Quero me filiar à liga"
              icone="ribbon"
              aoTocar={() => {
                void registrarEvento('liga_filiou');
                router.push('/filiacao');
              }}
            />
            <Botao
              titulo="Ver só o Premium do app"
              variante="secundario"
              icone="star-outline"
              aoTocar={() => {
                void registrarEvento('liga_mensal');
                router.push('/premium');
              }}
              estilo={{ marginTop: espaco.sm }}
            />
            <Botao
              titulo="Continuar grátis com 1 arma"
              variante="fantasma"
              aoTocar={() => {
                void registrarEvento('liga_recusou');
                void concluir();
              }}
              estilo={{ marginTop: espaco.xs }}
            />
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
