'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { dataHora } from '@/lib/formato';
import { Protegido } from '../componentes/Protegido';

const ROTULO_TIPO: Record<string, string> = {
  BOAS_VINDAS: 'Boas-vindas',
  SEM_ARMA_7D: '7 dias sem cadastro',
  INATIVO_30D: '30 dias sem acessar',
  NOTICIA: 'Notícia',
};

interface LogItem {
  id: string;
  canal: string;
  tipo: string;
  titulo: string | null;
  destino: string | null;
  status: string;
  erro: string | null;
  criadoEm: string;
  usuario: { id: string; nome: string; email: string } | null;
}

interface Resposta {
  logs: LogItem[];
  total: number;
  pagina: number;
  totalPaginas: number;
}

export default function PaginaAuditoria() {
  return (
    <Protegido>
      <Auditoria />
    </Protegido>
  );
}

function Auditoria() {
  const [canal, setCanal] = useState('');
  const [tipo, setTipo] = useState('');
  const [pagina, setPagina] = useState(1);
  const [dados, setDados] = useState<Resposta | null>(null);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const params = new URLSearchParams({ pagina: String(pagina), limite: '40' });
    if (canal) params.set('canal', canal);
    if (tipo) params.set('tipo', tipo);
    const r = await api<Resposta>(`/api/admin/logs-notificacao?${params.toString()}`);
    setDados(r);
    setCarregando(false);
  }, [canal, tipo, pagina]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // Trocar filtro volta para a página 1.
  function mudarCanal(v: string) {
    setCanal(v);
    setPagina(1);
  }
  function mudarTipo(v: string) {
    setTipo(v);
    setPagina(1);
  }

  return (
    <>
      <div className="cabeca-secao">
        <div>
          <h1>Auditoria de envios</h1>
          <p className="subtitulo">
            Mensagens automáticas (WhatsApp/push) e notificações de notícias enviadas aos usuários.
          </p>
        </div>
      </div>

      <div className="cartao" style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div className="campo" style={{ margin: 0 }}>
          <label>Canal</label>
          <select value={canal} onChange={(e) => mudarCanal(e.target.value)}>
            <option value="">Todos</option>
            <option value="WHATSAPP">WhatsApp</option>
            <option value="PUSH">Push</option>
          </select>
        </div>
        <div className="campo" style={{ margin: 0 }}>
          <label>Tipo</label>
          <select value={tipo} onChange={(e) => mudarTipo(e.target.value)}>
            <option value="">Todos</option>
            <option value="BOAS_VINDAS">Boas-vindas</option>
            <option value="SEM_ARMA_7D">7 dias sem cadastro</option>
            <option value="INATIVO_30D">30 dias sem acessar</option>
            <option value="NOTICIA">Notícia</option>
          </select>
        </div>
        {dados && <span className="subtitulo" style={{ margin: 0 }}>{dados.total} envio(s)</span>}
      </div>

      <div className="cartao" style={{ padding: 0, marginTop: 16 }}>
        {carregando ? (
          <div className="vazio">Carregando…</div>
        ) : !dados || dados.logs.length === 0 ? (
          <div className="vazio">Nenhum envio registrado para o filtro atual.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Quando</th>
                <th>Usuário</th>
                <th>Tipo</th>
                <th>Canal</th>
                <th>Título / destino</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {dados.logs.map((l) => (
                <tr key={l.id}>
                  <td>{dataHora(l.criadoEm)}</td>
                  <td>
                    {l.usuario ? (
                      <Link href={`/usuarios/${l.usuario.id}`}>{l.usuario.nome}</Link>
                    ) : (
                      <span style={{ color: 'var(--texto-suave)' }}>—</span>
                    )}
                  </td>
                  <td>{ROTULO_TIPO[l.tipo] ?? l.tipo}</td>
                  <td>{l.canal === 'WHATSAPP' ? 'WhatsApp' : 'Push'}</td>
                  <td>{l.titulo ?? l.destino ?? '—'}</td>
                  <td>
                    <span
                      className={`etiqueta ${l.status === 'OK' ? 'publicada' : 'rascunho'}`}
                      title={l.erro ?? ''}
                    >
                      {l.status}
                    </span>
                  </td>
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
            <button className="secundario pequeno" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>
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
