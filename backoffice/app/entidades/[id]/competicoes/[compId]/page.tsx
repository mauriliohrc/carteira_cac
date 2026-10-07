'use client';

import { useParams } from 'next/navigation';
import { Protegido } from '../../../../componentes/Protegido';
import { GestaoCompeticao } from '../../../../componentes/GestaoCompeticao';

export default function PaginaDetalheCompeticaoAdmin() {
  const { id, compId } = useParams<{ id: string; compId: string }>();
  return (
    <Protegido>
      <GestaoCompeticao
        competicaoId={compId}
        adminEntidadeId={id}
        voltarHref={`/entidades/${id}/competicoes`}
      />
    </Protegido>
  );
}
