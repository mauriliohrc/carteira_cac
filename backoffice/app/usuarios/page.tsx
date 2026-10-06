'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { tempoRelativo } from '@/lib/formato';
import type { ListaUsuariosApp } from '@/lib/tipos';
import { Protegido } from '../componentes/Protegido';

export default function PaginaUsuarios() {
  return (
    <Protegido>
      <ListaUsuarios />
    </Protegido>
  );
}

function ListaUsuarios() {
  const [dados, setDados] = useState<ListaUsuariosApp | null>(null);
  const [busca, setBusca] = useState('');
  const [pagina, setPagina] = useState(1);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const params = new URLSearchParams({ pagina: String(pagina), limite: '20' });
    if (busca.trim()) params.set('busca', busca.trim());
    const r = await api<ListaUsuariosApp>(`/api/admin/usuarios-app?${params}`);
    setDados(r);
    setCarregando(false);
  }, [pagina, busca]);

  useEffect(() => {
    const t = setTimeout(carregar, 250); // debounce da busca
    return () => clearTimeout(t);
  }, [carregar]);

  return (
    <>
      <div className="cabeca-secao">
        <div>
          <h1>Usuários do app</h1>
          <p className="subtitulo">Quem tem conta na Carteira CAC — acesso, vínculo e push.</p>
        </div>
      </div>

      <input
        className="busca"
        placeholder="Buscar por nome, e-mail ou CPF…"
        value={busca}
        onChange={(e) => {
          setPagina(1);
          setBusca(e.target.value);
        }}
      />

      <div className="cartao" style={{ padding: 0 }}>
        {carregando ? (
          <div className="vazio">Carregando…</div>
        ) : !dados || dados.usuarios.length === 0 ? (
          <div className="vazio">Nenhum usuário encontrado.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Usuário</th>
                <th>Plano</th>
                <th>Último acesso</th>
                <th>Entidades</th>
                <th>Disp.</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {dados.usuarios.map((u) => (
                <tr key={u.id}>
                  <td>
                    <Link href={`/usuarios/${u.id}`}>{u.nome}</Link>
                    <div style={{ color: 'var(--texto-suave)', fontSize: 12 }}>{u.email}</div>
                  </td>
                  <td>
                    <span className={`etiqueta ${u.premium ? 'publicada' : 'rascunho'}`}>
                      {u.premium ? 'Premium' : 'Grátis'}
                    </span>
                  </td>
                  <td>
                    <span className={`ponto ${u.online ? 'online' : 'offline'}`} />
                    {u.online ? 'online' : tempoRelativo(u.ultimoAcessoEm)}
                  </td>
                  <td>
                    {u.entidades.length === 0 ? (
                      <span style={{ color: 'var(--texto-suave)', fontSize: 13 }}>—</span>
                    ) : (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                        {u.entidades.map((e) => (
                          <span key={e.id} className="etiqueta" title={e.origem === 'SHOOTING_HOUSE' ? 'Vínculo automático (Shooting House)' : 'Vínculo manual'}>
                            {e.nome}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td>{u.dispositivos}</td>
                  <td style={{ textAlign: 'right' }}>
                    <Link
                      href={`/push?usuarioId=${u.id}&nome=${encodeURIComponent(u.nome)}`}
                    >
                      <button className="secundario pequeno">Notificar</button>
                    </Link>
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
            Página {dados.pagina} de {dados.totalPaginas} · {dados.total} usuários
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
