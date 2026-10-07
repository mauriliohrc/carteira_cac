import { apiApp, ErroConta } from '@/conta/api';
import { lerToken } from '@/conta/armazenamento';
import { importarExternas, type SessaoExterna } from '@/db/habitualidades';
import type { Grupo, TipoSessao } from '@/domain/tipos';

interface SessaoDTO {
  externoId: string;
  data: string;
  tipo: string;
  localNome: string | null;
  /** Armas do dia/local. Cada grupo conta uma habitualidade (regra da SH). */
  armas: { grupo: string; armaNome: string; serie: string | null }[];
}

interface RespostaImport {
  status: string;
  sessoes: SessaoDTO[];
  parceiros: { entidade: string; status: string; encontradas: number; mensagem?: string }[];
}

export interface ResultadoImportacao {
  /** OK | NAO_AUTORIZADO | ERRO | SEM_PARCEIROS | SEM_CONTA | OFFLINE */
  status: string;
  /** Novas sessões realmente inseridas (sem contar as que já existiam). */
  importadas: number;
  /** Total recebido da Shooting House (antes da deduplicação). */
  recebidas: number;
}

/**
 * Importa as habitualidades do usuário logado da Shooting House e mescla no
 * banco local sem duplicar (dedupe por id externo). Seguro para rodar de novo.
 */
export async function importarShootingHouse(): Promise<ResultadoImportacao> {
  const token = await lerToken();
  if (!token) return { status: 'SEM_CONTA', importadas: 0, recebidas: 0 };

  let r: RespostaImport;
  try {
    r = await apiApp<RespostaImport>('/habitualidades/importar', { token });
  } catch (e) {
    if (e instanceof ErroConta && e.offline) return { status: 'OFFLINE', importadas: 0, recebidas: 0 };
    throw e;
  }

  const sessoes: SessaoExterna[] = r.sessoes.map((s) => ({
    externoId: s.externoId,
    data: s.data,
    tipo: s.tipo as TipoSessao,
    localNome: s.localNome,
    armas: s.armas.map((a) => ({ grupo: a.grupo as Grupo, armaNome: a.armaNome, serie: a.serie })),
  }));

  const importadas = await importarExternas(sessoes);
  return { status: r.status, importadas, recebidas: r.sessoes.length };
}
