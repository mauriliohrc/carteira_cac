'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api, ErroApi } from '@/lib/api';
import { ROTULO_STATUS, type ListaNoticias } from '@/lib/tipos';

type NoticiaItem = ListaNoticias['noticias'][number];

/** Dispara o push desta notícia, respeitando o alcance (entidade x geral). */
function BotaoNotificar({ noticia }: { noticia: NoticiaItem }) {
  const [enviando, setEnviando] = useState(false);
  const [msg, setMsg] = useState('');

  if (noticia.status !== 'PUBLICADA') {
    return <span style={{ color: 'var(--texto-suave)', fontSize: 12 }}>publique p/ notificar</span>;
  }

  async function notificar() {
    const escopo = noticia.entidadeId
      ? `os sócios de ${noticia.entidadeNome ?? 'da entidade'}`
      : 'TODOS os usuários do app';
    if (!window.confirm(`Enviar notificação desta notícia para ${escopo}?`)) return;
    setEnviando(true);
    setMsg('');
    try {
      const r = await api<{ enviados: number; tokens: number }>(
        `/api/admin/noticias/${noticia.id}/notificar`,
        { metodo: 'POST' }
      );
      setMsg(`✓ ${r.enviados}/${r.tokens} enviado(s)`);
    } catch (e) {
      setMsg(e instanceof ErroApi ? e.message : 'Falha ao enviar');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <button className="secundario pequeno" disabled={enviando} onClick={notificar}>
        {enviando ? 'Enviando…' : '🔔 Notificar usuários'}
      </button>
      {msg && <span style={{ fontSize: 12, color: 'var(--texto-suave)' }}>{msg}</span>}
    </div>
  );
}
import { Protegido } from '../componentes/Protegido';

export default function PaginaNoticias() {
  return (
    <Protegido>
      <ListaDeNoticias />
    </Protegido>
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
    const r = await api<ListaNoticias>(`/api/admin/noticias?pagina=${pagina}&limite=20`);
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
          <p className="subtitulo">Só as publicadas aparecem no aplicativo.</p>
        </div>
        <Link href="/noticias/nova">
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
                <th>Alcance</th>
                <th>Status</th>
                <th>Leituras</th>
                <th>Publicada em</th>
                <th>Criada em</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {dados.noticias.map((n) => (
                <tr key={n.id}>
                  <td>
                    <Link href={`/noticias/${n.id}`}>{n.titulo}</Link>
                  </td>
                  <td>
                    {n.entidadeId ? (
                      <span className="etiqueta rascunho">{n.entidadeNome ?? 'Entidade'}</span>
                    ) : (
                      <span style={{ color: 'var(--texto-suave)' }}>Geral</span>
                    )}
                  </td>
                  <td>
                    <span
                      className={`etiqueta ${n.status === 'PUBLICADA' ? 'publicada' : 'rascunho'}`}
                    >
                      {ROTULO_STATUS[n.status]}
                    </span>
                  </td>
                  <td title="Pessoas que leram no app">👁 {n.leituras ?? 0}</td>
                  <td>{formatarData(n.publicadaEm)}</td>
                  <td>{formatarData(n.criadoEm)}</td>
                  <td><BotaoNotificar noticia={n} /></td>
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
