import { apiApp } from '@/conta/api';
import { lerToken } from '@/conta/armazenamento';
import type { CompeticaoDetalhe, CompeticaoResumo } from './tipos';

/**
 * Lista as competições ativas das entidades às quais o usuário é vinculado.
 * Exige conta (as competições vêm por vínculo com a entidade). Sem token,
 * devolve lista vazia — o app simplesmente não mostra a seção.
 */
export async function listarCompeticoes(): Promise<CompeticaoResumo[]> {
  const token = await lerToken();
  if (!token) return [];
  const r = await apiApp<{ competicoes: CompeticaoResumo[] }>('/competicoes', { token });
  return r.competicoes;
}

/** Página pública (web) do ranking de uma competição — usada ao compartilhar. */
export function linkPublicoCompeticao(id: string): string {
  return `https://backoffice.carteiracac.com/competicao/${id}`;
}

export async function obterCompeticao(id: string): Promise<CompeticaoDetalhe> {
  const token = await lerToken();
  const r = await apiApp<{ competicao: CompeticaoDetalhe }>(`/competicoes/${id}`, { token });
  return r.competicao;
}

/** 'AAAA-MM-DD…' -> '31/12'. */
export function formatarDiaMes(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** 'AAAA-MM-DD…' -> '31/12/2026'. */
export function formatarData(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}
