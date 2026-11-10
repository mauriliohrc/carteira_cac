import React, { useEffect, useRef, useState } from 'react';
import { Stack, router, type ErrorBoundaryProps } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import * as SplashScreen from 'expo-splash-screen';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { hrefDeDados, type DadosNotificacao } from '@/notificacoes/rotas';
import { consultarPremiumCache } from '@/billing';
import { AppProvider, useApp } from '@/estado/AppContext';
import { ContaProvider, useConta } from '@/conta/ContaContext';
import { CHAVES, gravarConfig, lerConfig } from '@/db/config';
import { Botao, Carregando, Tela, Vazio } from '@/ui/base';
import { Onboarding } from '@/ui/Onboarding';
import { TrancaProvider, useTranca } from '@/seguranca/TrancaProvider';
import { TelaTranca } from '@/seguranca/TelaTranca';
import { TemaProvider, useCores, useTema } from '@/tema';
import { DialogoProvider } from '@/ui/DialogoProvider';

void SplashScreen.preventAutoHideAsync();

/**
 * Rede de segurança de render.
 *
 * O expo-router usa este export quando algo lança durante o render da árvore.
 * Sem ele o resultado é uma tela branca e muda — o pior tipo de falha, porque
 * não há o que investigar. Aqui a mensagem e a pilha ficam na tela, com um
 * botão para tentar de novo.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <SafeAreaProvider>
      <TemaProvider>
        <TelaDeFalha error={error} retry={retry} />
      </TemaProvider>
    </SafeAreaProvider>
  );
}

function TelaDeFalha({ error, retry }: ErrorBoundaryProps) {
  const c = useCores();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.fundo }}
      contentContainerStyle={{ padding: 24, paddingTop: 72 }}
    >
      <Text style={{ fontSize: 18, fontWeight: '700', color: c.perigo, marginBottom: 6 }}>
        O app quebrou ao desenhar a tela
      </Text>
      <Text style={{ fontSize: 13, color: c.textoFraco, marginBottom: 20, lineHeight: 19 }}>
        Seus dados continuam salvos. A mensagem abaixo é o que falta para corrigir.
      </Text>
      <Text
        selectable
        style={{
          fontFamily: 'Courier',
          fontSize: 12,
          color: c.texto,
          backgroundColor: c.superficieAlta,
          borderRadius: 8,
          padding: 12,
          marginBottom: 20,
        }}
      >
        {error?.message ?? String(error)}
        {error?.stack ? `\n\n${error.stack}` : ''}
      </Text>
      <Pressable
        onPress={retry}
        style={{
          backgroundColor: c.primario,
          borderRadius: 8,
          paddingVertical: 14,
          alignItems: 'center',
        }}
      >
        <Text style={{ color: c.sobrePrimario, fontWeight: '700' }}>Tentar de novo</Text>
      </Pressable>
    </ScrollView>
  );
}

function Raiz() {
  const {
    pronto,
    erroInicial,
    tentarNovamente,
    precisaOnboarding,
    concluirOnboarding,
    armas,
    documentos,
    premium,
  } = useApp();
  const { logado, usuario, carregando: contaCarregando } = useConta();
  const { pronta: trancaPronta, bloqueado } = useTranca();
  const c = useCores();

  useEffect(() => {
    if (pronto && trancaPronta) void SplashScreen.hideAsync();
  }, [pronto, trancaPronta]);

  // Estas duas só podem navegar quando a Stack principal está REALMENTE na tela
  // (as mesmas condições do render do <Stack> abaixo). Navegar durante o
  // onboarding/tranca/loading — quando o navegador ainda não está montado —
  // trava o app num ciclo (tela piscando entre "Abrindo…" e o onboarding).
  const stackMontada = pronto && trancaPronta && !bloqueado && !erroInicial && !precisaOnboarding;

  // Fluxo guiado único (conta → validar e-mail → CR/Posse/Porte → CRAF →
  // premium). A própria tela deriva o passo do estado, então aqui só decidimos
  // QUANDO abrir — uma vez por sessão. Dispara para:
  //  • quem nunca viu o fluxo e ainda tem algo pendente (novo usuário);
  //  • qualquer usuário logado SEM documento (ex.: entrou com a conta aqui e
  //    precisa completar o cadastro) — mesmo que já tenha visto antes.
  // Só é seguro navegar quando a Stack está montada (no onboarding de permissões
  // o navegador ainda não existe).
  const [fluxoVisto, setFluxoVisto] = useState<boolean | null>(null);
  useEffect(() => {
    void lerConfig(CHAVES.onboardingFluxo).then((v) => setFluxoVisto(v === '1'));
  }, []);
  const fluxoDisparado = useRef(false);
  useEffect(() => {
    // Espera a sessão terminar de restaurar: no boot `logado` fica `false` por um
    // instante, e sem esse guarda o passo "conta" piscaria para quem já entrou.
    if (fluxoDisparado.current || fluxoVisto === null || !stackMontada || contaCarregando) return;
    const semDoc = logado && documentos.length === 0;
    const semArma = logado && armas.length === 0;
    const deveAbrir = (!fluxoVisto && (!logado || semDoc || semArma)) || semDoc;
    if (!deveAbrir) return;
    fluxoDisparado.current = true;
    void gravarConfig(CHAVES.onboardingFluxo, '1');
    router.push('/onboarding-fluxo');
  }, [stackMontada, fluxoVisto, logado, documentos.length, armas.length, contaCarregando]);

  // Voltamos ao onboarding inicial (ex.: logout rearma tudo em AppContext):
  // rearma o fluxo guiado para ele reaparecer assim que as permissões acabarem.
  useEffect(() => {
    if (precisaOnboarding) {
      fluxoDisparado.current = false;
      setFluxoVisto(false);
    }
  }, [precisaOnboarding]);

  // Fora do fluxo guiado: se a conta não está confirmada, leva a confirmar o
  // e-mail. Gated por `fluxoVisto` para não empilhar com o passo "validar" do
  // próprio fluxo (que já cuida disso na primeira sessão).
  const avisoAtivacao = useRef(false);
  useEffect(() => {
    if (avisoAtivacao.current || fluxoVisto !== true) return;
    if (stackMontada && logado && usuario && !usuario.emailVerificado) {
      avisoAtivacao.current = true;
      router.push('/conta/ativar');
    }
  }, [stackMontada, logado, usuario, fluxoVisto]);

  // Upsell: conta já confirmada, acervo acima do limite gratuito e sem Premium.
  // Mostra uma vez por sessão o convite para assinar e liberar tudo.
  const upsellMostrado = useRef(false);
  useEffect(() => {
    if (upsellMostrado.current || fluxoVisto !== true) return; // não empilha sobre o fluxo guiado
    if (stackMontada && logado && usuario?.emailVerificado && !premium && armas.length > 1) {
      upsellMostrado.current = true;
      router.push('/premium-upsell');
    }
  }, [stackMontada, logado, usuario, premium, armas.length, fluxoVisto]);

  // Tocar na notificação: abre direto no alvo (notícia, documento, arma,
  // habitualidade…). Dados ausentes/desconhecidos → caixa de avisos.
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((resposta) => {
      const dados = resposta.notification.request.content.data as DadosNotificacao | undefined;
      // Paywall só faz sentido para quem ainda não assinou; quem já é Premium
      // cai no acervo em vez de bater numa tela de "você já é Premium".
      if (dados?.tela === '/premium') {
        void consultarPremiumCache().then((ehPremium) =>
          router.push((ehPremium ? '/(tabs)/acervo' : '/premium') as never)
        );
        return;
      }
      const destino = hrefDeDados(dados);
      router.push((destino ?? '/(tabs)/avisos') as never);
    });
    return () => sub.remove();
  }, []);

  if (!pronto || !trancaPronta) return <Carregando texto="Abrindo sua carteira…" />;

  // O conteúdo do app. A tranca é desenhada POR CIMA dele (overlay), nunca no
  // lugar dele: desmontar a árvore ao bloquear fazia a Stack remontar ao
  // desbloquear, e a tela de confirmação de e-mail — ao remontar — reenviava o
  // código, invalidando o que o usuário acabara de buscar no e-mail. Como ler o
  // e-mail exige sair do app (o que bloqueia), cada retorno reenviava: loop.
  const conteudo = erroInicial ? (
    // Banco inacessível: melhor dizer isso do que abrir a carteira vazia e
    // deixar o usuário achar que perdeu o acervo.
    <Tela>
      <Vazio
        icone="warning-outline"
        titulo="Não consegui abrir seus dados"
        descricao={`O banco local não respondeu. Seus documentos continuam no aparelho — é a abertura que falhou.\n\n${erroInicial}`}
        acao={<Botao titulo="Tentar de novo" icone="refresh" aoTocar={() => void tentarNovamente()} />}
      />
    </Tela>
  ) : precisaOnboarding ? (
    // Primeiro acesso: o onboarding cobre a tela inteira, sem abas nem
    // cabeçalho, até o usuário passar pelas permissões.
    <Onboarding aoConcluir={concluirOnboarding} />
  ) : (
    <Stack
      screenOptions={{
        // O cabeçalho do app é desenhado pela Tela, em vidro e flutuante — o
        // nativo duplicaria a barra e cortaria o efeito.
        headerShown: false,
        contentStyle: { backgroundColor: c.fundo },
      }}
    >
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="arma/[id]" />
      <Stack.Screen name="arma/editar" options={{ presentation: 'modal' }} />
      <Stack.Screen name="habitualidade/editar" options={{ presentation: 'modal' }} />
      <Stack.Screen name="habitualidade/locais" options={{ presentation: 'modal' }} />
      <Stack.Screen name="documento/[id]" />
      <Stack.Screen name="documento/editar" options={{ presentation: 'modal' }} />
      <Stack.Screen name="visualizador" options={{ presentation: 'modal' }} />
      <Stack.Screen name="premium" options={{ presentation: 'modal' }} />
      <Stack.Screen name="premium-upsell" options={{ presentation: 'modal' }} />
      <Stack.Screen name="onboarding-fluxo" />
      {/* Tela empilhada (não modal): os diálogos de confirmação/aviso e o
          loading são apresentados a partir da raiz, e o iOS não mostra isso de
          forma confiável por cima de uma tela apresentada como modal — o
          diálogo fica invisível (às vezes aparece, às vezes não) e o fluxo de
          restaurar trava esperando um botão que não está na tela. */}
      {/* TODAS não-modais de propósito: estas telas abrem diálogos
          (avisar/confirmar/escolher), e o iOS não mostra o diálogo — um Modal
          renderizado na raiz — de forma confiável por cima de uma tela
          apresentada como modal. O diálogo fica invisível e o fluxo trava
          esperando um botão que não está na tela (ex.: o login parava ao abrir
          o "o que fazer com os dados deste aparelho"; o resgate de cupom não
          mostrava a confirmação; remover PIN travava no "confirmar"). */}
      <Stack.Screen name="backup" />
      <Stack.Screen name="seguranca" />
      <Stack.Screen name="resgatar" />
      <Stack.Screen name="conta/entrar" />
      <Stack.Screen name="conta/cadastrar" />
      <Stack.Screen name="conta/senha" />
      <Stack.Screen name="conta/ativar" />
      <Stack.Screen name="conta/verificar" />
      <Stack.Screen name="conta/alterar-senha" />
      <Stack.Screen name="conta/perfil" />
      <Stack.Screen name="noticias/index" />
      <Stack.Screen name="noticias/[id]" />
      <Stack.Screen name="despachante/servico" options={{ presentation: 'modal' }} />
      {/* pedido abre diálogos (avisar) e checkout/meus empilham — não-modais,
          pelo mesmo motivo das telas acima (iOS não mostra diálogo sobre modal). */}
      <Stack.Screen name="despachante/pedido" />
      <Stack.Screen name="despachante/checkout" />
      <Stack.Screen name="despachante/meus" />
      <Stack.Screen name="mercado/index" />
      <Stack.Screen name="mercado/[id]" />
      <Stack.Screen name="mercado/meus" />
      <Stack.Screen name="mercado/conversas" />
      <Stack.Screen name="mercado/conversa/[id]" />
      {/* criar/editar abre diálogos (avisar/escolher) — não-modal, como o despachante. */}
      <Stack.Screen name="mercado/novo" />
    </Stack>
  );

  return (
    <View style={{ flex: 1 }}>
      {conteudo}
      {/* Tranca: cobre o app por inteiro, mas o mantém montado por baixo. */}
      {bloqueado ? (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: c.fundo }]}>
          <TelaTranca />
        </View>
      ) : null}
    </View>
  );
}

/** A barra de status acompanha o tema em uso. */
function BarraStatus() {
  const { esquema } = useTema();
  return <StatusBar style={esquema === 'claro' ? 'dark' : 'light'} />;
}

function Casca() {
  const c = useCores();
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: c.fundo }}>
      <BarraStatus />
      <DialogoProvider>
        <TrancaProvider>
          <ContaProvider>
            <AppProvider>
              <Raiz />
            </AppProvider>
          </ContaProvider>
        </TrancaProvider>
      </DialogoProvider>
    </GestureHandlerRootView>
  );
}

export default function Layout() {
  return (
    <SafeAreaProvider>
      <TemaProvider>
        <Casca />
      </TemaProvider>
    </SafeAreaProvider>
  );
}
