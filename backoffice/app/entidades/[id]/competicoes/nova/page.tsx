'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import type { Competicao } from '@/lib/tipos';
import { Protegido } from '../../../../componentes/Protegido';
import {
  FormularioCompeticao,
  paraPayload,
  type DadosCompeticao,
} from '../../../../componentes/FormularioCompeticao';

export default function NovaCompeticaoAdmin() {
  return (
    <Protegido>
      <Criar />
    </Protegido>
  );
}

function Criar() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  async function criar(d: DadosCompeticao) {
    const r = await api<{ competicao: Competicao }>(`/api/admin/entidades/${id}/competicoes`, {
      metodo: 'POST',
      corpo: paraPayload(d),
    });
    router.replace(`/entidades/${id}/competicoes/${r.competicao.id}`);
  }

  return (
    <>
      <p style={{ marginTop: 0 }}>
        <Link href={`/entidades/${id}/competicoes`}>← Competições</Link>
      </p>
      <h1>Nova competição</h1>
      <p className="subtitulo">Depois de criar, adicione as categorias e lance os resultados.</p>
      <div style={{ marginTop: 16 }}>
        <FormularioCompeticao aoSalvar={criar} textoBotao="Criar competição" uploadPath="/api/admin/uploads" />
      </div>
    </>
  );
}
