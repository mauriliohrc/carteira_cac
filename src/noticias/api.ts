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

/** Slug cosmético do título para a URL (o id no fim é o que vale). */
function slugNoticia(titulo: string): string {
  return titulo
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70);
}

/**
 * Link público compartilhável: noticias.carteiracac.com/titulo-escapado-<id>
 * (página web com preview + CTA de download). O id (cuid, sem hífen) é o trecho
 * após o último hífen; o resto é cosmético.
 */
export function linkPublicoNoticia(id: string, titulo = ''): string {
  const slug = slugNoticia(titulo);
  const cauda = slug ? `${slug}-${id}` : id;
  return `https://noticias.carteiracac.com/${cauda}`;
}

/** Marca a notícia como lida (conta leitores no backoffice). Só com conta. */
export async function marcarNoticiaLida(id: string): Promise<void> {
  const token = await lerToken();
  if (!token) return;
  try {
    await apiApp(`/noticias/${id}/lida`, { metodo: 'POST', token });
  } catch {
    /* leitura é best-effort; não atrapalha a tela */
  }
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
