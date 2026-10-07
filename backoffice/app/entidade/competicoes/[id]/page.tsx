'use client';

import { useParams } from 'next/navigation';
import { ProtegidoEntidade } from '../../../componentes/ProtegidoEntidade';
import { GestaoCompeticao } from '../../../componentes/GestaoCompeticao';

export default function PaginaDetalheCompeticao() {
  const { id } = useParams<{ id: string }>();
  return (
    <ProtegidoEntidade>
      <GestaoCompeticao competicaoId={id} voltarHref="/entidade/competicoes" />
    </ProtegidoEntidade>
  );
}
