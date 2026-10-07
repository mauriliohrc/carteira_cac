import React, { useEffect, useRef } from 'react';
import { Stack, router, type ErrorBoundaryProps } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import * as SplashScreen from 'expo-splash-screen';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppProvider, useApp } from '@/estado/AppContext';
import { ContaProvider, useConta } from '@/conta/ContaContext';
import { consumirContaOnboardingPendente } from '@/conta/intencaoOnboarding';
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
  const { pronto, erroInicial, tentarNovamente, precisaOnboarding, concluirOnboarding, armas, premium } =
    useApp();
  const { logado, usuario } = useConta();
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

  // Segundo onboarding: logo após concluir o PRIMEIRO onboarding e a Stack
  // montar, se o usuário não está logado, abre o convite de conta (uma vez).
  // Só agora é seguro navegar — durante o onboarding o navegador não existe.
  const contaOnbDisparado = useRef(false);
  useEffect(() => {
    if (contaOnbDisparado.current || !stackMontada) return;
    if (consumirContaOnboardingPendente() && !logado) {
      contaOnbDisparado.current = true;
      router.push('/conta-onboarding');
    }
  }, [stackMontada, logado]);

  // Após login/cadastro: se a conta ainda NÃO está confirmada, avisa que ela não
  // está ativa e leva a confirmar o e-mail. Tem prioridade sobre o upsell.
  const avisoAtivacao = useRef(false);
  useEffect(() => {
    if (avisoAtivacao.current) return;
    if (stackMontada && logado && usuario && !usuario.emailVerificado) {
      avisoAtivacao.current = true;
      router.push('/conta/ativar');
    }
  }, [stackMontada, logado, usuario]);

  // Upsell: conta já confirmada, acervo acima do limite gratuito e sem Premium.
  // Mostra uma vez por sessão o convite para assinar e liberar tudo.
  const upsellMostrado = useRef(false);
  useEffect(() => {
    if (upsellMostrado.current) return;
    if (stackMontada && logado && usuario?.emailVerificado && !premium && armas.length > 1) {
      upsellMostrado.current = true;
      router.push('/premium-upsell');
    }
  }, [stackMontada, logado, usuario, premium, armas.length]);

  // Tocar na notificação: push de notícia abre a notícia; demais vão aos avisos.
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((resposta) => {
      const dados = resposta.notification.request.content.data as
        | { noticiaId?: string; competicaoId?: string; tela?: string }
        | undefined;
      if (dados?.noticiaId) {
        router.push({ pathname: '/noticias/[id]', params: { id: String(dados.noticiaId) } });
      } else if (dados?.competicaoId) {
        router.push({ pathname: '/competicoes/[id]', params: { id: String(dados.competicaoId) } });
      } else if (dados?.tela) {
        router.push(dados.tela as never);
      } else {
        router.push('/(tabs)/avisos');
      }
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
      <Stack.Screen name="conta-onboarding" />
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
