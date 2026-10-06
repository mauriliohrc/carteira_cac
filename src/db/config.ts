import { abrirBanco } from './index';

export async function lerConfig(chave: string): Promise<string | null> {
  const db = await abrirBanco();
  const r = await db.getFirstAsync<{ valor: string | null }>(
    'SELECT valor FROM config WHERE chave = ?',
    chave
  );
  return r?.valor ?? null;
}

export async function gravarConfig(chave: string, valor: string | null): Promise<void> {
  const db = await abrirBanco();
  await db.runAsync(
    'INSERT INTO config (chave, valor) VALUES (?, ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor',
    chave,
    valor
  );
}

export const CHAVES = {
  premium: 'premium.ativo',
  /** Premium liberado por código promocional (dono): não expira nem depende da loja. */
  premiumCodigo: 'premium.codigo',
  onboardingVisto: 'app.onboarding',
  tema: 'app.tema',
  /** Já pedimos a avaliação na loja (uma vez só, no cadastro da primeira arma). */
  avaliacaoPedida: 'app.avaliacao.pedida',
  /** Cursor (carimbo do servidor) do último pull de sincronização na nuvem. */
  syncCursor: 'sync.cursor',
  /** Séries de armas já importadas da Shooting House (não reimportar/ressuscitar). */
  armasImportadasSH: 'sh.armas.importadas',
  /** Chaves de documentos já importados da Shooting House (ex.: CR). */
  docsImportadosSH: 'sh.docs.importados',
} as const;
