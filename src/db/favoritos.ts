import { agoraISO } from '@/lib/data';
import { abrirBanco } from './index';

/**
 * Favoritos do acervo (armas fixadas no topo). Guardados numa tabela própria
 * (`favoritos`, `id` = id da arma) que sincroniza como o tipo 'favoritos' — um
 * registro que apps antigos ignoram no pull, mantendo a compatibilidade. LWW
 * por `atualizado_em`, como o resto do sync.
 */

/** Conjunto de ids de armas marcadas como favoritas. */
export async function listarFavoritos(): Promise<Set<string>> {
  const db = await abrirBanco();
  const linhas = await db.getAllAsync<{ id: string }>(
    'SELECT id FROM favoritos WHERE favorito = 1'
  );
  return new Set(linhas.map((l) => l.id));
}

/** Define (liga/desliga) o favorito de uma arma, carimbando `atualizado_em`. */
export async function definirFavorito(armaId: string, valor: boolean): Promise<void> {
  const db = await abrirBanco();
  await db.runAsync(
    `INSERT INTO favoritos (id, favorito, atualizado_em) VALUES (?,?,?)
     ON CONFLICT(id) DO UPDATE SET favorito = excluded.favorito, atualizado_em = excluded.atualizado_em`,
    armaId,
    valor ? 1 : 0,
    agoraISO()
  );
}

/** Remove o registro de favorito (usado ao excluir a arma). */
export async function removerFavorito(armaId: string): Promise<void> {
  const db = await abrirBanco();
  await db.runAsync('DELETE FROM favoritos WHERE id = ?', armaId);
}
