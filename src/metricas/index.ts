import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { apiApp } from '@/conta/api';
import { lerToken } from '@/conta/armazenamento';
import { CHAVES, gravarConfig, lerConfig } from '@/db/config';
import { novoId } from '@/db';

/**
 * Cliente de métricas de produto. Envia eventos do funil (onboarding, conversão
 * da liga) para o backend. BEST-EFFORT por princípio: nada aqui pode quebrar ou
 * atrasar o fluxo que o chamou — todo erro é engolido e os chamadores usam
 * `void registrarEvento(...)` sem await no caminho crítico.
 *
 * A identidade é o `anonId` (estável no aparelho), então medimos o funil mesmo
 * antes de o usuário criar conta. Se já estiver logado, o token vai junto e o
 * servidor associa o evento à conta.
 */

let anonIdCache: string | null = null;

async function obterAnonId(): Promise<string> {
  if (anonIdCache) return anonIdCache;
  let id = await lerConfig(CHAVES.anonId);
  if (!id) {
    id = `${novoId()}-${novoId()}`;
    await gravarConfig(CHAVES.anonId, id);
  }
  anonIdCache = id;
  return id;
}

/** Nomes conhecidos de evento (strings livres também são aceitas pelo servidor). */
export type NomeEvento =
  | 'onb_iniciou'
  | 'onb_passo_entrou'
  | 'onb_pulou'
  | 'onb_doc_subiu'
  | 'onb_concluiu'
  | 'liga_vista'
  | 'liga_filiou'
  | 'liga_mensal'
  | 'liga_recusou';

/** Passo do onboarding associado ao evento, quando aplicável. */
export type PassoOnb = 'conta' | 'validar' | 'cr' | 'craf' | 'liga';

/**
 * Registra UM evento de produto. Fire-and-forget: chame com `void`. Nunca
 * lança — qualquer falha (offline, servidor fora) é silenciosa.
 */
export async function registrarEvento(
  evento: NomeEvento,
  opc?: { passo?: PassoOnb; meta?: unknown }
): Promise<void> {
  try {
    const anonId = await obterAnonId();
    const token = await lerToken().catch(() => null);
    await apiApp('/eventos', {
      metodo: 'POST',
      token,
      corpo: {
        anonId,
        plataforma: Platform.OS === 'ios' ? 'IOS' : 'ANDROID',
        appVersao: Constants.expoConfig?.version ?? undefined,
        eventos: [{ evento, passo: opc?.passo, meta: opc?.meta }],
      },
    });
  } catch {
    /* best-effort: métrica nunca afeta o fluxo */
  }
}
