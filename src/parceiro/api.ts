import { apiApp } from '@/conta/api';
import { lerToken } from '@/conta/armazenamento';

export interface Elegibilidade {
  elegivel: boolean;
  entidade?: { id: string; nome: string };
  atirador?: { nome?: string; matricula?: string; expiracao?: string };
  plano: { id: string; nome: string; precoLabel: string; periodo: string };
}

/**
 * Consulta se o usuário logado é elegível ao Parceiro Premium (sócio ativo e
 * adimplente de uma entidade parceira na Shooting House). Sem conta: não elegível.
 */
export async function verificarElegibilidade(): Promise<Elegibilidade | null> {
  const token = await lerToken();
  if (!token) return null;
  try {
    return await apiApp<Elegibilidade>('/parceiro/elegibilidade', { token });
  } catch {
    return null;
  }
}
