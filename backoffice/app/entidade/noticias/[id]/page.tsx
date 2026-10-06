'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { ROTULO_STATUS, type Noticia } from '@/lib/tipos';
import { ProtegidoEntidade } from '../../../componentes/ProtegidoEntidade';
import {
  FormularioNoticia,
  paraPayload,
  type DadosNoticia,
} from '../../../componentes/FormularioNoticia';

export default function PaginaNoticiaEntidade({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <ProtegidoEntidade>
      <Editar id={id} />
    </ProtegidoEntidade>
  );
}

function Editar({ id }: { id: string }) {
  const router = useRouter();
  const [noticia, setNoticia] = useState<Noticia | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [ocupado, setOcupado] = useState(false);

  async function carregar() {
    const r = await api<{ noticia: Noticia }>(`/api/entidade/noticias/${id}`);
    setNoticia(r.noticia);
    setCarregando(false);
  }

  useEffect(() => {
    carregar().catch(() => setCarregando(false));
  }, [id]);

  async function salvar(d: DadosNoticia) {
    const r = await api<{ noticia: Noticia }>(`/api/entidade/noticias/${id}`, {
      metodo: 'PATCH',
      corpo: paraPayload(d),
    });
    setNoticia(r.noticia);
  }

  async function alternarPublicacao() {
    if (!noticia) return;
    setOcupado(true);
    const r = await api<{ noticia: Noticia }>(`/api/entidade/noticias/${id}/publicar`, {
      metodo: 'POST',
      corpo: { publicar: noticia.status !== 'PUBLICADA' },
    });
    setNoticia(r.noticia);
    setOcupado(false);
  }

  async function excluir() {
    if (!confirm('Excluir esta notícia? Esta ação é irreversível.')) return;
    await api(`/api/entidade/noticias/${id}`, { metodo: 'DELETE' });
    router.replace('/entidade/noticias');
  }

  if (carregando) return <div className="vazio">Carregando…</div>;
  if (!noticia) return <div className="vazio">Notícia não encontrada.</div>;

  const publicada = noticia.status === 'PUBLICADA';

  return (
    <>
      <p style={{ marginTop: 0 }}>
        <Link href="/entidade/noticias">← Notícias</Link>
      </p>
      <div className="cabeca-secao">
        <div>
          <h1>Editar notícia</h1>
          <p className="subtitulo">
            <span className={`etiqueta ${publicada ? 'publicada' : 'rascunho'}`}>
              {ROTULO_STATUS[noticia.status]}
            </span>
          </p>
        </div>
        <div className="linha-acoes">
          <button className="secundario" onClick={alternarPublicacao} disabled={ocupado}>
            {publicada ? 'Despublicar' : 'Publicar'}
          </button>
          <button className="perigo" onClick={excluir}>
            Excluir
          </button>
        </div>
      </div>

      <FormularioNoticia noticia={noticia} aoSalvar={salvar} textoBotao="Salvar alterações" />
    </>
  );
}
