/**
 * Ordem de aplicação do pull por dependência de FK: pai antes de filho.
 *
 * O pull chega ordenado pelo carimbo do SERVIDOR, que NÃO respeita as FKs — um
 * documento editado há meses tem carimbo mais antigo que a arma repostada hoje,
 * então aplicar na ordem crua insere o filho antes do pai e estoura a FK
 * (`PRAGMA foreign_keys = ON`). Reordenar aqui, de forma pura e testável,
 * garante que `armas` entrem antes de `documentos`, `documentos` antes de
 * `arquivos`, e assim por diante.
 */
export const ORDEM_APLICACAO: Record<string, number> = {
  locais_tiro: 0,
  armas: 1,
  documentos: 2,
  arquivos: 3,
  fotos: 4,
  favoritos: 5,
  ambitos_competicao: 6,
  habitualidades: 7,
  processos: 8,
};

/** Ordena registros de sync por dependência de FK (pai antes de filho). */
export function ordenarParaAplicar<T extends { tipo: string }>(registros: T[]): T[] {
  return [...registros].sort(
    (a, b) => (ORDEM_APLICACAO[a.tipo] ?? 99) - (ORDEM_APLICACAO[b.tipo] ?? 99)
  );
}
