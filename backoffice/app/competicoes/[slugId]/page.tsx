'use client';

import { useParams } from 'next/navigation';
import { RankingPublico } from '../../competicao/RankingPublico';

/** Subdomínios do sistema — nunca escopam para uma entidade. */
const RESERVADOS = new Set(['www', 'api', 'app', 'admin', 'backoffice', 'painel', 'download']);

/** O id é o trecho após o último hífen (cuid não tem hífen); o resto é cosmético. */
function idDoSlug(slugId: string): string {
  const i = slugId.lastIndexOf('-');
  return i >= 0 ? slugId.slice(i + 1) : slugId;
}

/** Subdomínio da entidade a partir do host (null em apex/www/reservados/dev). */
function subdominioAtual(): string | null {
  if (typeof window === 'undefined') return null;
  const partes = window.location.hostname.split('.');
  if (partes.length < 3) return null; // apex ou localhost
  const sub = partes[0];
  return sub && !RESERVADOS.has(sub) ? sub : null;
}

export default function PaginaCompeticaoPorSubdominio() {
  const { slugId } = useParams<{ slugId: string }>();
  return <RankingPublico id={idDoSlug(slugId)} subdominioEsperado={subdominioAtual()} />;
}
