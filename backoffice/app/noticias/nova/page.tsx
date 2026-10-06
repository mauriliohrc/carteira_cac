'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import type { Entidade, Noticia } from '@/lib/tipos';
import { Protegido } from '../../componentes/Protegido';
import {
  FormularioNoticia,
  paraPayload,
  type DadosNoticia,
} from '../../componentes/FormularioNoticia';

export default function NovaNoticia() {
  return (
    <Protegido>
      <Criar />
    </Protegido>
  );
}

function Criar() {
  const router = useRouter();
  const [entidades, setEntidades] = useState<Entidade[]>([]);

  useEffect(() => {
    api<{ entidades: Entidade[] }>('/api/admin/entidades').then((r) => setEntidades(r.entidades));
  }, []);

  async function criar(d: DadosNoticia) {
    const r = await api<{ noticia: Noticia }>('/api/admin/noticias', {
      metodo: 'POST',
      corpo: paraPayload(d),
    });
    router.replace(`/noticias/${r.noticia.id}`);
  }

  return (
    <>
      <p style={{ marginTop: 0 }}>
        <Link href="/noticias">← Notícias</Link>
      </p>
      <h1>Nova notícia</h1>
      <p className="subtitulo">
        Salve como rascunho para revisar depois, ou já publique para aparecer no app.
      </p>
      <div style={{ marginTop: 16 }}>
        <FormularioNoticia aoSalvar={criar} textoBotao="Criar notícia" entidades={entidades} />
      </div>
    </>
  );
}
