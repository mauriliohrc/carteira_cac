'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
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

/** Ícone da plataforma do aparelho (Apple para iOS, robô para Android). */
function IconePlataforma({ plataforma }: { plataforma: string }) {
  const ios = plataforma === 'IOS';
  const cor = ios ? 'var(--texto)' : '#3DDC84';
  return (
    <span
      title={ios ? 'iOS' : 'Android'}
      aria-label={ios ? 'iOS' : 'Android'}
      style={{ display: 'inline-flex', verticalAlign: 'middle' }}
    >
      {ios ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill={cor} aria-hidden="true">
          <path d="M16.37 1.43c.06 1.02-.33 2-1 2.73-.7.77-1.84 1.37-2.94 1.28-.09-1 .4-2.03 1.05-2.72.72-.77 1.96-1.34 2.89-1.29zM20.3 17.2c-.5 1.16-.74 1.67-1.39 2.69-.9 1.42-2.17 3.19-3.75 3.2-1.4.02-1.76-.92-3.66-.9-1.9.01-2.3.92-3.7.9-1.58-.01-2.78-1.6-3.69-3.03C1.5 16.1 1.24 11.4 2.82 8.92c1.12-1.77 2.9-2.8 4.57-2.8 1.7 0 2.77.93 4.18.93 1.37 0 2.2-.93 4.17-.93 1.49 0 3.07.81 4.2 2.21-3.69 2.02-3.09 7.29.36 8.87z" />
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill={cor} aria-hidden="true">
          <path d="M6 9v7a1.5 1.5 0 0 0 1.5 1.5H8V21a1 1 0 0 0 2 0v-3.5h4V21a1 1 0 0 0 2 0v-3.5h.5A1.5 1.5 0 0 0 18 16V9H6zm-2.5 0A1.5 1.5 0 0 0 2 10.5v4a1.5 1.5 0 0 0 3 0v-4A1.5 1.5 0 0 0 3.5 9zm17 0A1.5 1.5 0 0 0 19 10.5v4a1.5 1.5 0 0 0 3 0v-4A1.5 1.5 0 0 0 20.5 9zM7.8 7.6h8.4c.2 0 .3-.2.3-.4 0-1.5-.86-2.82-2.16-3.57l.86-1.3a.3.3 0 0 0-.5-.33l-.9 1.35A5.3 5.3 0 0 0 12 2.9c-.64 0-1.26.1-1.84.3l-.9-1.34a.3.3 0 1 0-.5.33l.86 1.3C8.32 4.38 7.5 5.7 7.5 7.2c0 .22.1.4.3.4zm1.7-2.1a.6.6 0 1 1 0-1.2.6.6 0 0 1 0 1.2zm5 0a.6.6 0 1 1 0-1.2.6.6 0 0 1 0 1.2z" />
        </svg>
      )}
    </span>
  );
}

type Dir = 'asc' | 'desc';

/** Formata celular só-dígitos como (DD) 9XXXX-XXXX. */
function formatarCelular(c?: string | null): string | null {
  if (!c) return null;
  const d = c.replace(/\D/g, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return c;
}

function ListaUsuarios() {
  const [dados, setDados] = useState<ListaUsuariosApp | null>(null);
  const [busca, setBusca] = useState('');
  const [pagina, setPagina] = useState(1);
  const [ordenar, setOrdenar] = useState('criadoEm');
  const [direcao, setDirecao] = useState<Dir>('desc');
  const [carregando, setCarregando] = useState(true);

  // Contagem de armas na Shooting House — carregada sob demanda e cacheada por id.
  const [armasSH, setArmasSH] = useState<Record<string, number | null>>({});
  const cacheArmas = useRef<Record<string, number | null>>({});

  const carregar = useCallback(async () => {
    setCarregando(true);
    const params = new URLSearchParams({
      pagina: String(pagina),
      limite: '20',
      ordenar,
      direcao,
    });
    // 'armasSH' é ordenação client-side (valor externo) — não vai ao servidor.
    params.set('ordenar', ordenar === 'armasSH' ? 'criadoEm' : ordenar);
    if (busca.trim()) params.set('busca', busca.trim());
    const r = await api<ListaUsuariosApp>(`/api/admin/usuarios-app?${params}`);
    setDados(r);
    setCarregando(false);
  }, [pagina, busca, ordenar, direcao]);

  useEffect(() => {
    const t = setTimeout(carregar, 250); // debounce da busca
    return () => clearTimeout(t);
  }, [carregar]);

  // Busca a contagem de armas da SH só para os usuários ainda não cacheados.
  useEffect(() => {
    if (!dados) return;
    const faltam = dados.usuarios.filter((u) => !(u.id in cacheArmas.current));
    if (!faltam.length) return;
    let vivo = true;
    (async () => {
      await Promise.all(
        faltam.map(async (u) => {
          try {
            const r = await api<{ total: number; status: string }>(
              `/api/admin/usuarios-app/${u.id}/armas-sh`
            );
            cacheArmas.current[u.id] = r.status === 'SEM_PARCEIROS' ? null : r.total;
          } catch {
            cacheArmas.current[u.id] = null;
          }
        })
      );
      if (vivo) setArmasSH({ ...cacheArmas.current });
    })();
    return () => {
      vivo = false;
    };
  }, [dados]);

  function ordenarPor(coluna: string) {
    if (ordenar === coluna) setDirecao((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setOrdenar(coluna);
      setDirecao('asc');
    }
    setPagina(1);
  }

  function Th({ coluna, children }: { coluna?: string; children?: React.ReactNode }) {
    if (!coluna) return <th>{children}</th>;
    const ativa = ordenar === coluna;
    return (
      <th
        onClick={() => ordenarPor(coluna)}
        style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
        title="Ordenar"
      >
        {children}
        <span style={{ opacity: ativa ? 1 : 0.25, marginLeft: 4 }}>
          {ativa ? (direcao === 'asc' ? '▲' : '▼') : '↕'}
        </span>
      </th>
    );
  }

  // Ordenação por "Armas SH" é feita no cliente (valor carregado sob demanda);
  // só reordena a página atual.
  const usuariosExibidos =
    dados && ordenar === 'armasSH'
      ? [...dados.usuarios].sort((a, b) => {
          const va = armasSH[a.id] ?? -1;
          const vb = armasSH[b.id] ?? -1;
          return direcao === 'asc' ? va - vb : vb - va;
        })
      : dados?.usuarios ?? [];

  return (
    <>
      <div className="cabeca-secao">
        <div>
          <h1>Usuários do app</h1>
          <p className="subtitulo">Quem tem conta na Carteira CAC — acesso, vínculo e push.</p>
        </div>
      </div>

      <AnonimosResumo />

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
                <Th coluna="nome">Usuário</Th>
                <Th coluna="emailVerificado">E-mail</Th>
                <Th coluna="premium">Plano</Th>
                <Th coluna="ultimoAcesso">Último acesso</Th>
                <Th>Entidades</Th>
                <Th>Armas</Th>
                <Th coluna="armasSH">Armas SH</Th>
                <Th coluna="dispositivos">Disp.</Th>
                <Th></Th>
              </tr>
            </thead>
            <tbody>
              {usuariosExibidos.map((u) => (
                <tr key={u.id}>
                  <td>
                    <Link href={`/usuarios/${u.id}`}>{u.nome}</Link>
                    <div style={{ color: 'var(--texto-suave)', fontSize: 12 }}>{u.email}</div>
                    {formatarCelular(u.celular) && (
                      <div style={{ color: 'var(--texto-suave)', fontSize: 12 }}>📱 {formatarCelular(u.celular)}</div>
                    )}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {u.emailVerificado ? (
                      <span title="E-mail confirmado" aria-label="E-mail confirmado" style={{ color: 'var(--ok)', fontSize: 16, fontWeight: 700 }}>
                        ✓
                      </span>
                    ) : (
                      <span title="E-mail não confirmado" aria-label="E-mail não confirmado" style={{ color: '#c99a2e', fontSize: 15 }}>
                        ⧗
                      </span>
                    )}
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
                  <td title="Armas cadastradas no app">{u.armasSistema ?? 0}</td>
                  <td>
                    {!(u.id in armasSH) ? (
                      <span style={{ color: 'var(--texto-suave)' }}>…</span>
                    ) : armasSH[u.id] === null ? (
                      <span style={{ color: 'var(--texto-suave)' }}>—</span>
                    ) : (
                      <strong>{armasSH[u.id]}</strong>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {(u.plataformas ?? []).map((pl) => (
                        <IconePlataforma key={pl} plataforma={pl} />
                      ))}
                      <span>{u.dispositivos}</span>
                    </div>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <Link href={`/push?usuarioId=${u.id}&nome=${encodeURIComponent(u.nome)}`}>
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

interface Anonimo {
  id: string;
  plataforma: string;
  ativo: boolean;
  criadoEm: string;
  ultimoEm: string;
  online: boolean;
}

/** Instalações anônimas (sem conta) — uso do app por quem ainda não se cadastrou. */
function AnonimosResumo() {
  const [dados, setDados] = useState<{ total: number; ativos: number; dispositivos: Anonimo[] } | null>(null);
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    api<{ total: number; ativos: number; dispositivos: Anonimo[] }>('/api/admin/anonimos')
      .then(setDados)
      .catch(() => setDados(null));
  }, []);

  if (!dados) return null;

  return (
    <div className="cartao" style={{ marginBottom: 16 }}>
      <div className="cabeca-secao" style={{ margin: 0 }}>
        <div>
          <strong>{dados.total}</strong> instalação(ões) anônima(s){' '}
          <span style={{ color: 'var(--texto-suave)' }}>· {dados.ativos} ativa(s)</span>
          <p className="subtitulo" style={{ margin: '4px 0 0' }}>
            Aparelhos que usam o app sem conta. Cada um tem um id anônimo estável.
          </p>
        </div>
        <button className="secundario pequeno" onClick={() => setAberto((a) => !a)}>
          {aberto ? 'Ocultar' : 'Ver instalações'}
        </button>
      </div>
      {aberto && (
        <table style={{ marginTop: 12 }}>
          <thead>
            <tr>
              <th>ID anônimo</th>
              <th>Plataforma</th>
              <th>Instalado</th>
              <th>Visto por último</th>
            </tr>
          </thead>
          <tbody>
            {dados.dispositivos.map((d) => (
              <tr key={d.id}>
                <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{d.id}</td>
                <td>{d.plataforma === 'IOS' ? 'iOS' : 'Android'}</td>
                <td>{new Date(d.criadoEm).toLocaleDateString('pt-BR')}</td>
                <td>
                  <span className={`ponto ${d.online ? 'online' : 'offline'}`} />
                  {d.online ? 'online' : tempoRelativo(d.ultimoEm)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
