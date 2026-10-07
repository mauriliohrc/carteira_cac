import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { abrirBanco } from '@/db';
import { listarArmas } from '@/db/armas';
import { listarArquivos } from '@/db/arquivos';
import { listarDocumentos } from '@/db/documentos';
import { listarFotos, type Foto } from '@/db/fotos';
import { listarHabitualidades } from '@/db/habitualidades';
import { listarLocais } from '@/db/locais';
import { CHAVES, gravarConfig, lerConfig } from '@/db/config';
import {
  listarAvisos,
  marcarTodosLidos,
  limparAvisos,
  type AvisoRecebido,
} from '@/db/avisos';
import { consultarPremium, consultarPremiumCache, observarPremium } from '@/billing';
import { useConta } from '@/conta/ContaContext';
import { marcarContaOnboardingPendente } from '@/conta/intencaoOnboarding';
import { sincronizar } from '@/sync';
import { pedirPermissao, prepararCanal, reagendarAlertas } from '@/notificacoes';
import { limparCentral, observarRecebidos, sincronizarCaixa } from '@/notificacoes/caixa';
import { avaliar, PESO_SITUACAO, type InfoSituacao } from '@/domain/vencimento';
import {
  calcularProgresso,
  ordenarSessoes,
  type ProgressoHabitualidade,
} from '@/domain/habitualidade';
import type {
  Arma,
  Arquivo,
  Documento,
  DocumentoComContexto,
  Habitualidade,
  LocalTiro,
} from '@/domain/tipos';

interface EstadoApp {
  pronto: boolean;
  /** Falha ao abrir o banco: sem isso o app abria vazio, parecendo sem dados. */
  erroInicial: string | null;
  tentarNovamente: () => Promise<void>;
  /** Primeiro acesso: mostra o onboarding no lugar da carteira. */
  precisaOnboarding: boolean;
  concluirOnboarding: () => Promise<void>;
  armas: Arma[];
  documentos: DocumentoComContexto[];
  premium: boolean;
  /** Documentos vencidos ou dentro da janela de 30 dias, do mais urgente ao menos. */
  pendencias: (DocumentoComContexto & { info: InfoSituacao })[];
  documentosDaArma: (armaId: string) => DocumentoComContexto[];
  documentosPessoais: DocumentoComContexto[];
  /** Fotos do armamento, já na ordem — a primeira é a capa. */
  fotosDaArma: (armaId: string) => Foto[];
  /** Sessões de tiro registradas, da mais recente para a mais antiga. */
  habitualidades: Habitualidade[];
  /** Clubes e estandes cadastrados pelo usuário. */
  locais: LocalTiro[];
  /** Andamento das 8 sessões por grupo na janela de 12 meses. */
  progressoHabitualidade: ProgressoHabitualidade;
  /** Histórico das notificações que já chegaram ao aparelho. */
  avisos: AvisoRecebido[];
  avisosNaoLidos: number;
  recarregarAvisos: () => Promise<void>;
  marcarAvisosLidos: () => Promise<void>;
  apagarAvisos: () => Promise<void>;
  recarregar: () => Promise<void>;
  /** Sincroniza com a nuvem (inclui importar da Shooting House) e recarrega. */
  sincronizarAgora: () => Promise<void>;
  definirPremium: (valor: boolean) => Promise<void>;
}

const Contexto = createContext<EstadoApp | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [pronto, setPronto] = useState(false);
  const [erroInicial, setErroInicial] = useState<string | null>(null);
  const [armas, setArmas] = useState<Arma[]>([]);
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [arquivos, setArquivos] = useState<Arquivo[]>([]);
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [habitualidades, setHabitualidades] = useState<Habitualidade[]>([]);
  const [locais, setLocais] = useState<LocalTiro[]>([]);
  const [premium, setPremium] = useState(false);
  const [avisos, setAvisos] = useState<AvisoRecebido[]>([]);
  const [precisaOnboarding, setPrecisaOnboarding] = useState(false);
  const estadoAnterior = useRef<AppStateStatus>(AppState.currentState);
  const { logado } = useConta();

  const recarregarAvisos = useCallback(async () => {
    setAvisos(await listarAvisos());
  }, []);

  const carregar = useCallback(async () => {
    await abrirBanco();
    setErroInicial(null);
    const [
      listaArmas,
      listaDocs,
      listaArquivos,
      listaFotos,
      listaHabitualidades,
      listaLocais,
      ehPremium,
    ] = await Promise.all([
      listarArmas(),
      listarDocumentos(),
      listarArquivos(),
      listarFotos(),
      listarHabitualidades(),
      listarLocais(),
      // Cache local: rápido e nunca bloqueia a abertura. A checagem real na
      // App Store roda em segundo plano (ver efeito abaixo).
      consultarPremiumCache(),
    ]);

    setArmas(listaArmas);
    setDocumentos(listaDocs);
    setArquivos(listaArquivos);
    setFotos(listaFotos);
    setHabitualidades(ordenarSessoes(listaHabitualidades));
    setLocais(listaLocais);
    setPremium(ehPremium);

    // Reagenda sempre: o conjunto de avisos depende da data de hoje — e agora
    // também da habitualidade, que entra no plano como uma frente.
    void reagendarAlertas(listaDocs, listaArmas, listaHabitualidades);

    // Recupera o que chegou enquanto o app estava fechado.
    await sincronizarCaixa();
    await recarregarAvisos();
  }, [recarregarAvisos]);

  // Sincroniza com a nuvem (se logado) e recarrega a carteira quando desceu algo.
  // Deslogado (ex.: após logout) recarrega para refletir o acervo local limpo.
  const sincronizarECarregar = useCallback(async () => {
    if (!logado) {
      await carregar();
      return;
    }
    await sincronizar();
    // SEMPRE recarrega após sincronizar (não só quando baixou algo): ao logar,
    // o pull aplica os dados no banco local e a UI precisa refletir na hora —
    // senão o acervo só aparecia ao reabrir o app (o foreground já recarregava).
    await carregar();
  }, [logado, carregar]);

  // Ao logar (ou abrir já logado): puxa o acervo da nuvem.
  useEffect(() => {
    void sincronizarECarregar();
  }, [sincronizarECarregar]);

  useEffect(() => {
    let vivo = true;
    (async () => {
      await prepararCanal();
      // No primeiro acesso o pedido de permissão fica a cargo do onboarding,
      // que explica antes por que o app precisa notificar. Para quem já passou
      // por ele, pedimos direto — a chamada é idempotente e não reabre o
      // diálogo se o usuário já respondeu.
      await abrirBanco();
      const jaViu = (await lerConfig(CHAVES.onboardingVisto)) === '1';
      if (jaViu) await pedirPermissao();
      else if (vivo) setPrecisaOnboarding(true);
      await carregar();
      if (vivo) setPronto(true);
    })().catch((e) => {
      console.error('[CAC Brasil] falha ao iniciar', e);
      if (!vivo) return;
      setErroInicial(e instanceof Error ? e.message : String(e));
      setPronto(true);
    });
    return () => {
      vivo = false;
    };
  }, [carregar]);

  // Compra ou renovação confirmada pela loja (inclusive fora do paywall):
  // reflete o Premium na hora.
  useEffect(() => {
    observarPremium(setPremium);
  }, []);

  // Confere a assinatura na App Store em segundo plano, uma vez. Tem timeout
  // interno, então nunca trava a interface se o StoreKit demorar.
  useEffect(() => {
    let vivo = true;
    void consultarPremium()
      .then((ativo) => {
        if (vivo) setPremium(ativo);
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, []);

  // Avisos que chegam com o app aberto entram na caixa na hora.
  useEffect(() => {
    const sub = observarRecebidos(() => void recarregarAvisos());
    return () => sub.remove();
  }, [recarregarAvisos]);

  // Ao voltar do background o "hoje" pode ter mudado: recalcula os alertas.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (proximo) => {
      if (estadoAnterior.current.match(/inactive|background/) && proximo === 'active') {
        // Volta do background: sincroniza (se logado) e recarrega.
        void (async () => {
          await sincronizarECarregar();
          await carregar();
        })();
      }
      estadoAnterior.current = proximo;
    });
    return () => sub.remove();
  }, [carregar, sincronizarECarregar]);

  const marcarAvisosLidos = useCallback(async () => {
    await marcarTodosLidos();
    await limparCentral();
    await recarregarAvisos();
  }, [recarregarAvisos]);

  const apagarAvisos = useCallback(async () => {
    await limparAvisos();
    await limparCentral();
    await recarregarAvisos();
  }, [recarregarAvisos]);

  const definirPremium = useCallback(async (valor: boolean) => {
    await gravarConfig(CHAVES.premium, valor ? '1' : '0');
    setPremium(valor);
  }, []);

  const concluirOnboarding = useCallback(async () => {
    await gravarConfig(CHAVES.onboardingVisto, '1');
    // Acabou o 1º onboarding: deixa o convite de conta pendente para a Raiz
    // abrir assim que a Stack montar (o navegador não existe durante o
    // onboarding). Ver [[intencaoOnboarding]].
    marcarContaOnboardingPendente();
    setPrecisaOnboarding(false);
    // O usuário pode ter concedido as notificações agora: recarrega para
    // reagendar os alertas já com a permissão em mãos.
    await carregar();
  }, [carregar]);

  const valor = useMemo<EstadoApp>(() => {
    const porArma = new Map(armas.map((a) => [a.id, a]));
    const porDocumento = new Map<string, Arquivo[]>();
    for (const arq of arquivos) {
      const lista = porDocumento.get(arq.documentoId);
      if (lista) lista.push(arq);
      else porDocumento.set(arq.documentoId, [arq]);
    }

    const completos: DocumentoComContexto[] = documentos.map((d) => ({
      ...d,
      arma: d.armaId ? porArma.get(d.armaId) ?? null : null,
      arquivos: porDocumento.get(d.id) ?? [],
    }));

    const pendencias = completos
      .map((d) => ({ ...d, info: avaliar(d.dataValidade) }))
      .filter((d) => d.info.emAlerta)
      .sort(
        (a, b) =>
          PESO_SITUACAO[a.info.situacao] - PESO_SITUACAO[b.info.situacao] ||
          a.dataValidade.localeCompare(b.dataValidade)
      );

    return {
      pronto,
      erroInicial,
      tentarNovamente: carregar,
      precisaOnboarding,
      concluirOnboarding,
      armas,
      documentos: completos,
      premium,
      pendencias,
      documentosDaArma: (armaId: string) => completos.filter((d) => d.armaId === armaId),
      documentosPessoais: completos.filter((d) => !d.armaId),
      fotosDaArma: (armaId: string) => fotos.filter((f) => f.armaId === armaId),
      habitualidades,
      locais,
      progressoHabitualidade: calcularProgresso(armas, habitualidades),
      avisos,
      avisosNaoLidos: avisos.filter((a) => !a.lido).length,
      recarregarAvisos,
      marcarAvisosLidos,
      apagarAvisos,
      recarregar: carregar,
      sincronizarAgora: sincronizarECarregar,
      definirPremium,
    };
  }, [
    apagarAvisos,
    armas,
    arquivos,
    avisos,
    carregar,
    concluirOnboarding,
    definirPremium,
    documentos,
    erroInicial,
    fotos,
    habitualidades,
    locais,
    marcarAvisosLidos,
    precisaOnboarding,
    premium,
    pronto,
    recarregarAvisos,
  ]);

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useApp(): EstadoApp {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error('useApp precisa estar dentro de <AppProvider>');
  return ctx;
}
