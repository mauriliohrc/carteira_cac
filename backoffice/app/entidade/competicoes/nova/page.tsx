'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import type { Competicao } from '@/lib/tipos';
import { ProtegidoEntidade } from '../../../componentes/ProtegidoEntidade';
import {
  FormularioCompeticao,
  paraPayload,
  type DadosCompeticao,
} from '../../../componentes/FormularioCompeticao';

export default function NovaCompeticao() {
  return (
    <ProtegidoEntidade>
      <Criar />
    </ProtegidoEntidade>
  );
}

function Criar() {
  const router = useRouter();

  async function criar(d: DadosCompeticao) {
    const r = await api<{ competicao: Competicao }>('/api/entidade/competicoes', {
      metodo: 'POST',
      corpo: paraPayload(d),
    });
    router.replace(`/entidade/competicoes/${r.competicao.id}`);
  }

  return (
    <>
      <p style={{ marginTop: 0 }}>
        <Link href="/entidade/competicoes">← Competições</Link>
      </p>
      <h1>Nova competição</h1>
      <p className="subtitulo">
        Depois de criar, você adiciona as categorias e lança os resultados.
      </p>
      <div style={{ marginTop: 16 }}>
        <FormularioCompeticao aoSalvar={criar} textoBotao="Criar competição" />
      </div>
    </>
  );
}
