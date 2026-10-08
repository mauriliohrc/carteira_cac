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
export type TipoPremium = 'CUPOM' | 'MENSAL' | 'ANUAL' | 'ANUAL_PARCEIRO';

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

/** Estado do cache local, sem tocar na loja — rápido, para o carregamento. */
export async function consultarPremiumCache(): Promise<boolean> {
  if (await temCodigoPromocional()) return true;
  return (await lerConfig(CHAVES.premium)) === '1';
}

/**
 * Tipo do premium conhecido localmente, sem tocar a loja. Cupom vence tudo;
 * senão, lê o tipo da última assinatura vista. null = premium de origem ainda
 * desconhecida (ex.: assinatura ativa mas loja ainda não consultada).
 */
export async function consultarTipoPremiumCache(): Promise<TipoPremium | null> {
  if (await temCodigoPromocional()) return 'CUPOM';
  const t = await lerConfig(CHAVES.premiumTipo);
  return t === 'MENSAL' || t === 'ANUAL' || t === 'ANUAL_PARCEIRO' ? t : null;
}

/**
 * Checa a assinatura na loja e atualiza o cache. NÃO use no caminho de
 * carregamento do app — pode demorar; chame em segundo plano. Com timeout,
 * nunca trava: se a loja não responde, mantém o cache.
 */
export async function consultarPremium(): Promise<boolean> {
  // Código promocional vence tudo e nunca é rebaixado pela loja.
  if (await temCodigoPromocional()) return true;
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
        await gravarConfig(CHAVES.premium, ativo ? '1' : '0');
        // Guarda o tipo pela SKU ativa; zera quando não há assinatura.
        await gravarConfig(CHAVES.premiumTipo, ativo ? tipoDasAssinaturas(assinaturas) ?? '' : '');
        return ativo;
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

/** Inicia a compra e resolve true quando a loja confirma o pagamento. */
export async function comprarPlano(id: IdPlano | typeof PRODUTO_PARCEIRO): Promise<boolean> {
  await iniciarBilling();
  if (!conectado) throw new Error('A loja está indisponível no momento. Tente de novo mais tarde.');

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
      | { subscriptionOffers?: { offerToken?: string }[] }
      | undefined;
    const offerToken = prod?.subscriptionOffers?.[0]?.offerToken;
    if (!offerToken) {
      throw new Error('Este plano não está disponível na Play Store agora. Tente mais tarde.');
    }
    ofertasAndroid = [{ sku: id, offerToken }];
  }

  return new Promise<boolean>((resolve) => {
    pendente = (sucesso) => {
      // Compra confirmada: grava o tipo pela SKU comprada já na hora (a
      // checagem da loja em segundo plano confirma depois).
      if (sucesso) void gravarConfig(CHAVES.premiumTipo, TIPO_POR_PRODUTO[id] ?? '');
      resolve(sucesso);
    };
    requestPurchase({
      request: {
        apple: { sku: id },
        google: { skus: [id], subscriptionOffers: ofertasAndroid },
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
  try {
    await iniciarBilling();
    if (!conectado) return false;
    await comTimeout(restorePurchases().then(() => true).catch(() => true), 15_000, true);
    const assinaturas = await comTimeout(
      getActiveSubscriptions([...TODOS_PRODUTOS]) as Promise<ActiveSubscription[]>,
      8_000,
      [] as ActiveSubscription[]
    );
    const ativo = assinaturas.length > 0;
    await marcarPremium(ativo);
    await gravarConfig(CHAVES.premiumTipo, ativo ? tipoDasAssinaturas(assinaturas) ?? '' : '');
    return ativo;
  } catch {
    return false;
  }
}

export function podeCadastrarArma(qtdAtual: number, premium: boolean): boolean {
  return premium || qtdAtual < LIMITE_GRATUITO_ARMAS;
}
