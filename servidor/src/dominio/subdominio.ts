/**
 * Slug de subdomínio de entidade. "3Gun Clube!" -> "3gun-clube".
 *
 * Puro de propósito (sem banco): a unicidade é resolvida na rota, que conhece o
 * Prisma. Aqui só normaliza e barra nomes reservados / inválidos.
 */

/** Subdomínios que o sistema usa — nunca podem virar entidade. */
export const SUBDOMINIOS_RESERVADOS = new Set([
  'www', 'api', 'app', 'admin', 'backoffice', 'painel', 'mail', 'email',
  'ftp', 'static', 'assets', 'cdn', 'ns1', 'ns2', 'carteiracac', 'download',
]);

/** Base do slug (sem garantir unicidade). Vazio se o nome não gera nada válido. */
export function slugSubdominio(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // tira acentos
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-') // nao-alfanumerico -> hifen
    .replace(/^-+|-+$/g, '') // sem hifen nas pontas
    .slice(0, 40);
}

/**
 * Candidatos em ordem de preferência: o slug base e, se reservado / colidir,
 * variações numeradas. A rota tenta cada um até achar um livre no banco.
 */
export function candidatosSubdominio(nome: string): string[] {
  let base = slugSubdominio(nome);
  if (!base) return [];
  // Reservado vira prefixado para nao sequestrar um subdominio do sistema.
  if (SUBDOMINIOS_RESERVADOS.has(base)) base = `e-${base}`;
  return [base, ...Array.from({ length: 50 }, (_, i) => `${base}-${i + 2}`)];
}
