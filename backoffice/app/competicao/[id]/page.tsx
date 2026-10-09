'use client';

import { useParams } from 'next/navigation';
import { RankingPublico } from '../RankingPublico';

// Rota legada (domínio do backoffice). Os links novos usam o subdomínio da
// entidade em /competicoes/[slug-id]; esta segue funcionando para os antigos.
export default function PaginaPublicaCompeticao() {
  const { id } = useParams<{ id: string }>();
  return <RankingPublico id={id} />;
}
