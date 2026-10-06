'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import type { Noticia } from '@/lib/tipos';
import { ProtegidoEntidade } from '../../../componentes/ProtegidoEntidade';
import {
  FormularioNoticia,
  paraPayload,
  type DadosNoticia,
} from '../../../componentes/FormularioNoticia';

export default function NovaNoticiaEntidade() {
  return (
    <ProtegidoEntidade>
      <Criar />
    </ProtegidoEntidade>
  );
}

function Criar() {
  const router = useRouter();

  async function criar(d: DadosNoticia) {
    const r = await api<{ noticia: Noticia }>('/api/entidade/noticias', {
      metodo: 'POST',
      corpo: paraPayload(d),
    });
    router.replace(`/entidade/noticias/${r.noticia.id}`);
  }

  return (
    <>
      <p style={{ marginTop: 0 }}>
        <Link href="/entidade/noticias">← Notícias</Link>
      </p>
      <h1>Nova notícia</h1>
      <p className="subtitulo">
        Salve como rascunho para revisar depois, ou já publique para os seus sócios verem no app.
      </p>
      <div style={{ marginTop: 16 }}>
        <FormularioNoticia aoSalvar={criar} textoBotao="Criar notícia" />
      </div>
    </>
  );
}
