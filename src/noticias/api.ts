import { apiApp } from '@/conta/api';
import { lerToken } from '@/conta/armazenamento';
import type { Noticia, PaginaNoticias } from './tipos';

/**
 * Página de notícias publicadas. `cursor` nulo = primeira página.
 * Envia o token da conta (quando logado) para o servidor incluir também as
 * notícias exclusivas das entidades a que o usuário é vinculado. Anônimo recebe
 * só as gerais.
 */
export async function listarNoticias(cursor: string | null, limite = 10): Promise<PaginaNoticias> {
  const params = new URLSearchParams({ limite: String(limite) });
  if (cursor) params.set('cursor', cursor);
  const token = await lerToken();
  return apiApp<PaginaNoticias>(`/noticias?${params.toString()}`, { token });
}

export async function obterNoticia(id: string): Promise<Noticia> {
  const token = await lerToken();
  const r = await apiApp<{ noticia: Noticia }>(`/noticias/${id}`, { token });
  return r.noticia;
}

/** 'AAAA-MM-DDThh:mm:ss…' -> '31/12/2026'. */
export function formatarData(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}
