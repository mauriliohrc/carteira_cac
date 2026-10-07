'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { ROTULO_STATUS, type ListaNoticias } from '@/lib/tipos';
import { ProtegidoEntidade } from '../../componentes/ProtegidoEntidade';

export default function PaginaNoticiasEntidade() {
  return (
    <ProtegidoEntidade>
      <ListaDeNoticias />
    </ProtegidoEntidade>
  );
}

function formatarData(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function ListaDeNoticias() {
  const [dados, setDados] = useState<ListaNoticias | null>(null);
  const [pagina, setPagina] = useState(1);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const r = await api<ListaNoticias>(`/api/entidade/noticias?pagina=${pagina}&limite=20`);
    setDados(r);
    setCarregando(false);
  }, [pagina]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  return (
    <>
      <div className="cabeca-secao">
        <div>
          <h1>Notícias</h1>
          <p className="subtitulo">
            Exclusivas dos seus sócios. Só as publicadas aparecem no aplicativo.
          </p>
        </div>
        <Link href="/entidade/noticias/nova">
          <button>+ Nova notícia</button>
        </Link>
      </div>

      <div className="cartao" style={{ padding: 0 }}>
        {carregando ? (
          <div className="vazio">Carregando…</div>
        ) : !dados || dados.noticias.length === 0 ? (
          <div className="vazio">Nenhuma notícia cadastrada ainda.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Título</th>
                <th>Status</th>
                <th>Leituras</th>
                <th>Publicada em</th>
                <th>Criada em</th>
              </tr>
            </thead>
            <tbody>
              {dados.noticias.map((n) => (
                <tr key={n.id}>
                  <td>
                    <Link href={`/entidade/noticias/${n.id}`}>{n.titulo}</Link>
                  </td>
                  <td>
                    <span className={`etiqueta ${n.status === 'PUBLICADA' ? 'publicada' : 'rascunho'}`}>
                      {ROTULO_STATUS[n.status]}
                    </span>
                  </td>
                  <td title="Pessoas que leram no app">👁 {n.leituras ?? 0}</td>
                  <td>{formatarData(n.publicadaEm)}</td>
                  <td>{formatarData(n.criadoEm)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {dados && dados.totalPaginas > 1 && (
        <div className="paginacao">
          <span className="info">
            Página {dados.pagina} de {dados.totalPaginas} · {dados.total} no total
          </span>
          <div className="controles">
            <button
              className="secundario pequeno"
              disabled={pagina <= 1}
              onClick={() => setPagina((p) => p - 1)}
            >
              Anterior
            </button>
            <button
              className="secundario pequeno"
              disabled={pagina >= dados.totalPaginas}
              onClick={() => setPagina((p) => p + 1)}
            >
              Próxima
            </button>
          </div>
        </div>
      )}
    </>
  );
}
