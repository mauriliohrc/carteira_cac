/**
 * Camada de assinatura — StoreKit real via expo-iap.
 *
 * O plano gratuito permite 1 arma; o Premium libera o acervo inteiro. O direito
 * (entitlement) é a existência de uma assinatura ativa na Apple — não uma flag
 * local. A tabela `config` guarda só um cache do último estado conhecido, para
 * o app abrir com a resposta certa mesmo offline.
 *
 * Ambiente (sandbox x produção) é decidido pela própria App Store conforme a
 * conta e o build — não há chave a virar aqui.
 *
 * As compras são orientadas a evento: `requestPurchase` dispara o fluxo e o
 * resultado chega em `purchaseUpdatedListener`. Por isso mantemos a conexão e
 * os ouvintes vivos no módulo e expomos funções que resolvem quando o evento
 * correspondente chega.
 */
import { Platform } from 'react-native';
import {
  initConnection,
  fetchProducts,
  requestPurchase,
  finishTransaction,
  restorePurchases,
  getActiveSubscriptions,
  purchaseUpdatedListener,
  purchaseErrorListener,
  type Purchase,
  type ProductSubscription,
  type ActiveSubscription,
} from 'expo-iap';

import { CHAVES, gravarConfig, lerConfig } from '@/db/config';
import { filiacaoAtivaLocal } from '@/db/filiacoes';
import { apiApp } from '@/conta/api';
import { lerToken } from '@/conta/armazenamento';

export const LIMITE_GRATUITO_ARMAS = 1;

/** IDs dos produtos — precisam ser idênticos aos do App Store Connect. */
export const PRODUTOS_ASSINATURA = ['premium_anual', 'premium_mensal'] as const;
export type IdPlano = (typeof PRODUTOS_ASSINATURA)[number];

/** Plano Parceiro Premium (anual R$49,90), ofertado só a sócios de parceiros. */
export const PRODUTO_PARCEIRO = 'premium_parceiro';
export const PRECO_PARCEIRO_PADRAO = 'R$ 49,90';

/** Todos os produtos que, ativos na loja, valem como Premium. */
const TODOS_PRODUTOS = [...PRODUTOS_ASSINATURA, PRODUTO_PARCEIRO];

/** Tipo do premium ativo, para o backoffice distinguir a origem. */
export type TipoPremium = 'CUPOM' | 'MENSAL' | 'ANUAL' | 'ANUAL_PARCEIRO' | 'FILIACAO';

const TIPO_POR_PRODUTO: Record<string, TipoPremium> = {
  premium_mensal: 'MENSAL',
  premium_anual: 'ANUAL',
  [PRODUTO_PARCEIRO]: 'ANUAL_PARCEIRO',
};

/** A SKU ativa (parceiro > anual > mensal) traduzida em tipo; null se nenhuma. */
function tipoDasAssinaturas(assinaturas: ActiveSubscription[]): TipoPremium | null {
  const ids = new Set(assinaturas.map((a) => a.productId));
  if (ids.has(PRODUTO_PARCEIRO)) return 'ANUAL_PARCEIRO';
  if (ids.has('premium_anual')) return 'ANUAL';
  if (ids.has('premium_mensal')) return 'MENSAL';
  return null;
}

/**
 * Metadados de apresentação de cada plano. O PREÇO não vem daqui — vem da loja
 * (`displayPrice`, já localizado), montado em {@link carregarOfertas}.
 */
export const PLANOS: { id: IdPlano; rotulo: string; destaque: boolean; equivalente: string }[] = [
  { id: 'premium_anual', rotulo: 'Anual', destaque: true, equivalente: 'melhor custo por mês' },
  { id: 'premium_mensal', rotulo: 'Mensal', destaque: false, equivalente: 'cancele quando quiser' },
];

export const BENEFICIOS_PREMIUM = [
  'Acervo ilimitado de armas',
  'Documentos e anexos sem limite',
  'Alertas diários para todo o acervo',
  'Guias de tráfego ilimitadas por arma',
  'Exportação e backup do acervo',
];

export interface OfertaPlano {
  id: IdPlano;
  rotulo: string;
  destaque: boolean;
  equivalente: string;
  /** Preço já formatado e localizado pela loja (ex.: "R$ 79,90"). */
  preco: string;
}

/**
 * Corre a promessa contra um relógio. Se a loja não responder no prazo,
 * devolve `aoEstourar` em vez de travar a interface — StoreKit no aparelho
 * pode ficar pendente (sem rede, conta sandbox, produto ainda não liberado).
 */
function comTimeout<T>(promessa: Promise<T>, ms: number, aoEstourar: T): Promise<T> {
  return new Promise<T>((resolve) => {
    let pronto = false;
    const encerrar = (v: T) => {
      if (pronto) return;
      pronto = true;
      resolve(v);
    };
    const t = setTimeout(() => encerrar(aoEstourar), ms);
    promessa
      .then((v) => {
        clearTimeout(t);
        encerrar(v);
      })
      .catch(() => {
        clearTimeout(t);
        encerrar(aoEstourar);
      });
  });
}

// --------------------------------------------------------------- conexão

let conectado = false;
let iniciando: Promise<void> | null = null;
/** Resolve a compra em andamento quando o evento correspondente chega. */
let pendente: ((sucesso: boolean) => void) | null = null;
/** AppContext registra aqui para reagir a compras/renovações fora do paywall. */
let aoMudarPremium: ((ativo: boolean) => void) | null = null;

export function observarPremium(cb: (ativo: boolean) => void): void {
  aoMudarPremium = cb;
}

async function marcarPremium(ativo: boolean): Promise<void> {
  await gravarConfig(CHAVES.premium, ativo ? '1' : '0');
  aoMudarPremium?.(ativo);
}

/**
 * Zera TODO o premium local do aparelho: cache da loja, tipo e o cupom.
 *
 * Premium não é por conta no cliente — vive em flags do aparelho (cupom e cache
 * do StoreKit). Ao trocar de sessão (login, cadastro, logout) uma conta herdava
 * o premium de outra. Limpamos aqui; o premium legítimo volta pelo processo
 * normal: assinatura ativa no StoreKit (recuperação automática) ou re-resgate do
 * cupom. O cupom, em especial, NUNCA voltava sozinho (ele vencia tudo e não caía)
 * — era o que deixava toda conta nova "premium".
 */
export async function limparPremiumLocal(): Promise<void> {
  await gravarConfig(CHAVES.premium, '0');
  await gravarConfig(CHAVES.premiumTipo, '');
  await gravarConfig(CHAVES.premiumCodigo, null);
  await gravarConfig(CHAVES.premiumFiliacao, null);
  await gravarConfig(CHAVES.premiumVazioSeguido, null);
  limparVinculoAssinatura();
  aoMudarPremium?.(false);
}

/**
 * Número EXIGIDO de consultas vazias consecutivas para rebaixar um aparelho que
 * já estava premium. O Google Play devolve lista vazia de forma transitória
 * (conexão recém-aberta, cache frio, erro de billing traduzido como "sem
 * assinatura") — um único vazio rebaixava assinantes pagos, que então nem pela
 * restauração voltavam e sumiam da contagem no backoffice. Com 2, um vazio
 * espúrio é absorvido e só um estado realmente persistente derruba o premium.
 */
const VAZIOS_PARA_REBAIXAR = 2;

export async function iniciarBilling(): Promise<void> {
  if (conectado) return;
  if (iniciando) return iniciando;

  iniciando = (async () => {
    try {
      const conectou = await comTimeout(initConnection().then(() => true), 10_000, false);
      if (!conectou) {
        conectado = false;
        return;
      }

      purchaseUpdatedListener(async (compra: Purchase) => {
        // Pagamento aprovado pela loja: entrega o Premium e encerra a
        // transação (senão o iOS a repõe a cada abertura).
        try {
          await finishTransaction({ purchase: compra, isConsumable: false });
        } catch {
          // Já finalizada ou indisponível — segue mesmo assim.
        }
        await marcarPremium(true);
        pendente?.(true);
        pendente = null;
      });

      purchaseErrorListener(() => {
        pendente?.(false);
        pendente = null;
      });

      conectado = true;
    } catch {
      // Loja indisponível (simulador sem StoreKit, sem rede): billing fica
      // inativo e o app segue com o último estado conhecido.
      conectado = false;
    } finally {
      iniciando = null;
    }
  })();

  return iniciando;
}

// ------------------------------------------------------- código promocional

/** Código que, quando é um cupom válido, também mostra a figurinha (easter egg). */
const CODIGO_EASTER_EGG = 'rocambole do dino';

function normalizarCodigo(codigo: string): string {
  return codigo.trim().toLowerCase().replace(/\s+/g, ' ');
}

async function temCodigoPromocional(): Promise<boolean> {
  return (await lerConfig(CHAVES.premiumCodigo)) === '1';
}

/** Premium por filiação à liga (flag derivada do sync, ver sincronizarPremiumFiliacao). */
async function temFiliacaoAtiva(): Promise<boolean> {
  return (await lerConfig(CHAVES.premiumFiliacao)) === '1';
}

/**
 * Reconcilia o Premium por FILIAÇÃO a partir do espelho local (tabela
 * 'filiacoes', preenchida pelo pull). Chamado logo após cada sincronização.
 *
 * - Filiação ativa e vigente → grava a flag e concede o Premium.
 * - Sem filiação vigente → só limpa a flag; NÃO rebaixa o Premium aqui (a
 *   assinatura da loja/cupom pode seguir ativa; quem decide o downgrade da loja
 *   é consultarPremium, com a confirmação dupla).
 *
 */
export async function sincronizarPremiumFiliacao(): Promise<void> {
  const ativa = await filiacaoAtivaLocal();
  if (ativa) {
    const jaTinha = (await lerConfig(CHAVES.premiumFiliacao)) === '1';
    await gravarConfig(CHAVES.premiumFiliacao, '1');
    await gravarConfig(CHAVES.premiumTipo, 'FILIACAO');
    if (!jaTinha) await marcarPremium(true);
    else aoMudarPremium?.(true);
    return;
  }
  // Perdeu a vigência: limpa só a origem-filiação.
  if ((await lerConfig(CHAVES.premiumFiliacao)) === '1') {
    await gravarConfig(CHAVES.premiumFiliacao, '0');
  }
}

export interface ResultadoResgate {
  ok: boolean;
  /** true só quando o cupom VÁLIDO é o "rocambole do dino" (mostra a figurinha). */
  easterEgg: boolean;
  descricao?: string;
  /** Sem internet para validar o cupom. */
  offline?: boolean;
}

/**
 * Resgata um cupom. TODO código passa pelo backend (valida ativo/limite/validade
 * e computa o uso). Se o cupom válido for exatamente o "rocambole do dino", além
 * de liberar o Premium, sinaliza para o app abrir a figurinha (easter egg).
 */
export async function resgatarCodigo(codigo: string): Promise<ResultadoResgate> {
  const token = await lerToken();
  let r: { ok: boolean; descricao?: string };
  try {
    r = await apiApp<{ ok: boolean; descricao?: string }>('/cupom/resgatar', {
      metodo: 'POST',
      corpo: { codigo },
      token: token ?? null,
    });
  } catch {
    return { ok: false, easterEgg: false, offline: true };
  }

  if (!r.ok) return { ok: false, easterEgg: false };

  await gravarConfig(CHAVES.premiumCodigo, '1');
  await marcarPremium(true);
  return {
    ok: true,
    easterEgg: normalizarCodigo(codigo) === CODIGO_EASTER_EGG,
    descricao: r.descricao,
  };
}

// --------------------------------------------------------------- consultas

/**
 * Override SÓ DE TESTE: com EXPO_PUBLIC_FORCE_FREE=1, o app se comporta como
 * plano gratuito independentemente de cupom ou assinatura ativa na loja. Não
 * altera nada no aparelho nem na conta — é só uma lente para testar o paywall e
 * o acervo bloqueado. REMOVER antes de publicar.
 */
const FORCAR_GRATUITO = process.env.EXPO_PUBLIC_FORCE_FREE === '1';

/** Estado do cache local, sem tocar na loja — rápido, para o carregamento. */
export async function consultarPremiumCache(): Promise<boolean> {
  if (FORCAR_GRATUITO) return false;
  if (await temCodigoPromocional()) return true;
  if (await temFiliacaoAtiva()) return true;
  return (await lerConfig(CHAVES.premium)) === '1';
}

/**
 * Tipo do premium conhecido localmente, sem tocar a loja. Cupom vence tudo;
 * senão, lê o tipo da última assinatura vista. null = premium de origem ainda
 * desconhecida (ex.: assinatura ativa mas loja ainda não consultada).
 */
export async function consultarTipoPremiumCache(): Promise<TipoPremium | null> {
  if (FORCAR_GRATUITO) return null;
  if (await temCodigoPromocional()) return 'CUPOM';
  if (await temFiliacaoAtiva()) return 'FILIACAO';
  const t = await lerConfig(CHAVES.premiumTipo);
  return t === 'MENSAL' || t === 'ANUAL' || t === 'ANUAL_PARCEIRO' ? t : null;
}

/**
 * Checa a assinatura na loja e atualiza o cache. NÃO use no caminho de
 * carregamento do app — pode demorar; chame em segundo plano. Com timeout,
 * nunca trava: se a loja não responde, mantém o cache.
 */
export async function consultarPremium(): Promise<boolean> {
  if (FORCAR_GRATUITO) return false;
  // Código promocional vence tudo e nunca é rebaixado pela loja.
  if (await temCodigoPromocional()) return true;
  // Filiação ativa à liga também vence o downgrade da loja (quem a revoga é o
  // servidor, via sync — não a ausência de assinatura na Apple/Google).
  if (await temFiliacaoAtiva()) return true;
  try {
    await iniciarBilling();
    if (conectado) {
      const assinaturas = await comTimeout(
        getActiveSubscriptions([...TODOS_PRODUTOS]) as Promise<ActiveSubscription[]>,
        8_000,
        null
      );
      if (assinaturas !== null) {
        const ativo = assinaturas.length > 0;
        if (ativo) {
          // Assinatura presente: promover é sempre seguro e zera o contador de
          // vazios (um vazio anterior era transitório).
          await gravarConfig(CHAVES.premium, '1');
          await gravarConfig(CHAVES.premiumTipo, tipoDasAssinaturas(assinaturas) ?? '');
          await gravarConfig(CHAVES.premiumVazioSeguido, '0');
          // Casa a assinatura com a conta no servidor (uma vez por sessão).
          if (!jaReportouAssinatura) void reportarAssinaturaAtiva(assinaturas);
          return true;
        }
        // Lista vazia. Se o aparelho JÁ não era premium, nada a proteger: mantém
        // '0'. Se ERA premium, exige confirmação dupla antes de rebaixar — um
        // único vazio no Android costuma ser transitório (ver VAZIOS_PARA_REBAIXAR).
        const eraPremium = (await lerConfig(CHAVES.premium)) === '1';
        if (!eraPremium) {
          await gravarConfig(CHAVES.premiumTipo, '');
          return false;
        }
        const vazios = Number((await lerConfig(CHAVES.premiumVazioSeguido)) ?? '0') + 1;
        if (vazios < VAZIOS_PARA_REBAIXAR) {
          // Ainda não dá para confiar no rebaixamento: conta o vazio e mantém o
          // premium (não mexe no tipo) até a próxima consulta confirmar.
          await gravarConfig(CHAVES.premiumVazioSeguido, String(vazios));
          return true;
        }
        // Vazio confirmado (2x seguidas): aí sim rebaixa de verdade.
        await gravarConfig(CHAVES.premium, '0');
        await gravarConfig(CHAVES.premiumTipo, '');
        await gravarConfig(CHAVES.premiumVazioSeguido, '0');
        return false;
      }
    }
  } catch {
    // Cai no cache abaixo.
  }
  return consultarPremiumCache();
}

/** Planos disponíveis com preço da loja. Vazio se a loja não respondeu. */
export async function carregarOfertas(): Promise<OfertaPlano[]> {
  await iniciarBilling();
  if (!conectado) return [];
  const produtos = await comTimeout(
    fetchProducts({ skus: [...PRODUTOS_ASSINATURA], type: 'subs' }) as Promise<ProductSubscription[]>,
    8_000,
    [] as ProductSubscription[]
  );
  const porId = new Map(produtos.map((p) => [p.id, p]));

  return PLANOS.flatMap((meta) => {
    const produto = porId.get(meta.id);
    if (!produto) return [];
    return [{ id: meta.id, rotulo: meta.rotulo, destaque: meta.destaque, equivalente: meta.equivalente, preco: produto.displayPrice }];
  });
}

// ----------------------------------------------------------------- compra

/** Preço do plano Parceiro Premium (da loja; cai no padrão se indisponível). */
export async function carregarOfertaParceiro(): Promise<string> {
  await iniciarBilling();
  if (!conectado) return PRECO_PARCEIRO_PADRAO;
  const produtos = await comTimeout(
    fetchProducts({ skus: [PRODUTO_PARCEIRO], type: 'subs' }) as Promise<ProductSubscription[]>,
    8_000,
    [] as ProductSubscription[]
  );
  return produtos[0]?.displayPrice ?? PRECO_PARCEIRO_PADRAO;
}

// -------------------------------------------- vínculo conta ↔ assinatura

/** appAccountToken da conta (UUID do servidor) — casa a compra Apple à conta. */
let appAccountTokenCache: string | null = null;
/** Evita reportar a mesma assinatura repetidamente na mesma sessão. */
let jaReportouAssinatura = false;

/**
 * Busca (e cacheia) o appAccountToken da conta logada, para enviar na compra.
 * Anônimo (sem conta) → undefined: a compra segue sem token e a atribuição fica
 * para quando o usuário entrar e o app reportar a assinatura.
 */
async function obterAppAccountToken(): Promise<string | undefined> {
  if (appAccountTokenCache) return appAccountTokenCache;
  const token = await lerToken();
  if (!token) return undefined;
  try {
    const r = await apiApp<{ appAccountToken: string }>('/assinatura/preparar', { token });
    appAccountTokenCache = r.appAccountToken ?? null;
    return r.appAccountToken ?? undefined;
  } catch {
    return undefined;
  }
}

/** Esquece caches de vínculo (troca de sessão). */
export function limparVinculoAssinatura(): void {
  appAccountTokenCache = null;
  jaReportouAssinatura = false;
}

/**
 * Reporta ao servidor a assinatura ativa deste aparelho (um transactionId dela),
 * para o backend casá-la com a conta via App Store Server API. Best-effort; cobre
 * quem já assinava antes do appAccountToken. Reaproveita a lista já consultada
 * quando fornecida, para não bater na loja de novo.
 */
export async function reportarAssinaturaAtiva(assinaturas?: ActiveSubscription[]): Promise<void> {
  const token = await lerToken();
  if (!token) return;
  try {
    const lista =
      assinaturas ??
      ((await getActiveSubscriptions([...TODOS_PRODUTOS])) as ActiveSubscription[]);

    if (Platform.OS === 'android') {
      // Android: casa pela via do Google (purchaseToken → Android Publisher API).
      const a = lista.find((s) => s.purchaseTokenAndroid ?? s.purchaseToken);
      const purchaseToken = a?.purchaseTokenAndroid ?? a?.purchaseToken;
      if (!purchaseToken) return;
      await apiApp('/assinatura/vincular-google', {
        metodo: 'POST',
        corpo: { purchaseToken },
        token,
      });
      jaReportouAssinatura = true;
      return;
    }

    // iOS: casa pelo transactionId (App Store Server API resolve o original).
    const a = lista.find((s) => s.transactionId);
    if (!a?.transactionId) return;
    await apiApp('/assinatura/vincular', {
      metodo: 'POST',
      corpo: { transactionId: a.transactionId, environment: a.environmentIOS ?? undefined },
      token,
    });
    jaReportouAssinatura = true;
  } catch {
    // Silencioso: tenta de novo numa próxima oportunidade.
  }
}

/**
 * Avisa o servidor que o usuário INICIOU uma compra (abriu o fluxo da loja),
 * para a timeline do backoffice. Best-effort e sem bloquear a compra.
 */
async function reportarTentativaAssinatura(id: string): Promise<void> {
  const token = await lerToken();
  if (!token) return;
  try {
    await apiApp('/assinatura/tentativa', {
      metodo: 'POST',
      corpo: { produtoId: id, plataforma: Platform.OS === 'ios' ? 'IOS' : 'ANDROID' },
      token,
    });
  } catch {
    // Silencioso — a timeline é um extra.
  }
}

/** Inicia a compra e resolve true quando a loja confirma o pagamento. */
export async function comprarPlano(id: IdPlano | typeof PRODUTO_PARCEIRO): Promise<boolean> {
  await iniciarBilling();
  if (!conectado) throw new Error('A loja está indisponível no momento. Tente de novo mais tarde.');

  // Timeline: registra a tentativa de assinatura (em segundo plano).
  void reportarTentativaAssinatura(id);

  // Android: a assinatura do Google Play SÓ abre o fluxo de compra com o
  // `offerToken` do base plan. Sem ele, `requestPurchase` não faz nada (o
  // sintoma de "clico em comprar e nada acontece"). Buscamos o produto e
  // pegamos a primeira oferta. No iOS o `apple.sku` basta.
  let ofertasAndroid: { sku: string; offerToken: string }[] | undefined;
  if (Platform.OS === 'android') {
    const produtos = await comTimeout(
      fetchProducts({ skus: [id], type: 'subs' }) as Promise<ProductSubscription[]>,
      8_000,
      [] as ProductSubscription[]
    );
    const prod = produtos.find((p) => p.id === id) as
      | { subscriptionOffers?: { offerTokenAndroid?: string; offerToken?: string }[]; productStatusAndroid?: string }
      | undefined;
    // No expo-iap 5.6.3 o token da oferta no RETORNO do produto é
    // `offerTokenAndroid` (o `offerToken` só existe no INPUT da compra). Ler o
    // nome errado deixava o token undefined e quebrava 100% das compras Android.
    const oferta = prod?.subscriptionOffers?.[0];
    const offerToken = oferta?.offerTokenAndroid ?? oferta?.offerToken;
    // Log de diagnóstico (logcat do aparelho): separa os cenários que antes
    // caíam todos na MESMA mensagem genérica.
    console.warn(
      `[billing] android compra ${id}: produtos=${produtos.length} ` +
        `status=${prod?.productStatusAndroid ?? 'n/d'} ofertas=${prod?.subscriptionOffers?.length ?? 0}`
    );
    if (!offerToken) {
      // "Não encontrado" (SKU/app não servido pela Play) difere de "sem oferta"
      // (base plan/elegibilidade) — ajuda o suporte a triar.
      throw new Error(
        !prod
          ? 'Não encontramos este plano na Play Store. Verifique se o app foi instalado pela Google Play e tente novamente.'
          : 'Este plano não está disponível para a sua conta na Play Store agora. Tente mais tarde.'
      );
    }
    ofertasAndroid = [{ sku: id, offerToken }];
  }

  // UUID da conta: a Apple o ecoa na notificação (appAccountToken) e o Google o
  // devolve como obfuscatedExternalAccountId — nas DUAS lojas é a via de
  // atribuição automática da assinatura à conta no servidor. Anônimo → undefined.
  const appAccountToken = await obterAppAccountToken();

  return new Promise<boolean>((resolve) => {
    pendente = (sucesso) => {
      // Compra confirmada: grava o tipo pela SKU comprada já na hora (a
      // checagem da loja em segundo plano confirma depois) e reporta a
      // assinatura ao servidor (fallback de atribuição).
      if (sucesso) {
        void gravarConfig(CHAVES.premiumTipo, TIPO_POR_PRODUTO[id] ?? '');
        void reportarAssinaturaAtiva();
      }
      resolve(sucesso);
    };
    requestPurchase({
      request: {
        apple: { sku: id, appAccountToken },
        google: { skus: [id], subscriptionOffers: ofertasAndroid, obfuscatedAccountId: appAccountToken },
      },
      type: 'subs',
    }).catch(() => {
      if (pendente) {
        pendente = null;
        resolve(false);
      }
    });
  });
}

export async function restaurarCompras(): Promise<boolean> {
  // Quem já tem o código não perde o Premium por não achar compra na loja.
  if (await temCodigoPromocional()) return true;
  // Idem para o filiado: a restauração da loja nunca derruba a filiação.
  if (await temFiliacaoAtiva()) return true;
  try {
    await iniciarBilling();
    if (!conectado) return false;
    await comTimeout(restorePurchases().then(() => true).catch(() => true), 15_000, true);
    // A restauração só RECUPERA premium; nunca o revoga. Por isso o default do
    // timeout é null (INCONCLUSIVO), não lista vazia — antes um timeout virava
    // `[]` e rebaixava quem acabara de pedir para recuperar o acesso.
    const consultar = () =>
      comTimeout(
        getActiveSubscriptions([...TODOS_PRODUTOS]) as Promise<ActiveSubscription[]>,
        8_000,
        null as ActiveSubscription[] | null
      );
    // Uma 2ª tentativa quando a 1ª vem vazia/sem resposta: no Android o Play
    // costuma só popular a lista na 2ª passada após o restore.
    let assinaturas = await consultar();
    if (!assinaturas || assinaturas.length === 0) assinaturas = await consultar();

    if (assinaturas && assinaturas.length > 0) {
      await marcarPremium(true);
      await gravarConfig(CHAVES.premiumTipo, tipoDasAssinaturas(assinaturas) ?? '');
      await gravarConfig(CHAVES.premiumVazioSeguido, '0');
      void reportarAssinaturaAtiva(assinaturas);
      return true;
    }
    // Nada encontrado (ou loja muda): NÃO rebaixa — devolve o estado vigente.
    // Se já era premium, continua premium; senão, "nada a restaurar".
    return consultarPremiumCache();
  } catch {
    return false;
  }
}

export function podeCadastrarArma(qtdAtual: number, premium: boolean): boolean {
  return premium || qtdAtual < LIMITE_GRATUITO_ARMAS;
}
