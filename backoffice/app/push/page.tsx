'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api, ErroApi } from '@/lib/api';
import { dataHora } from '@/lib/formato';
import type { Entidade, EnvioPush, TipoAlvoPush, UsuarioApp } from '@/lib/tipos';
import { Protegido } from '../componentes/Protegido';

const ROTULO_ALVO: Record<TipoAlvoPush, string> = {
  TODOS: 'Todos',
  ENTIDADE: 'Por entidade',
  USUARIO: 'Um usuário',
  INATIVOS: 'Inativos',
};

export default function PaginaPush() {
  return (
    <Protegido>
      <Suspense fallback={<div className="vazio">Carregando…</div>}>
        <Push />
      </Suspense>
    </Protegido>
  );
}

function Push() {
  const sp = useSearchParams();
  const [titulo, setTitulo] = useState('');
  const [corpo, setCorpo] = useState('');
  const [tipo, setTipo] = useState<TipoAlvoPush>('TODOS');
  const [entidadeId, setEntidadeId] = useState('');
  const [usuarioId, setUsuarioId] = useState('');
  const [usuarioNome, setUsuarioNome] = useState('');
  const [dias, setDias] = useState(30);

  const [entidades, setEntidades] = useState<Entidade[]>([]);
  const [historico, setHistorico] = useState<EnvioPush[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [resultado, setResultado] = useState<string | null>(null);

  // Prefill vindo da lista de usuários ("Notificar").
  useEffect(() => {
    const uid = sp.get('usuarioId');
    const nome = sp.get('nome');
    if (uid) {
      setTipo('USUARIO');
      setUsuarioId(uid);
      setUsuarioNome(nome ?? uid);
    }
  }, [sp]);

  const carregarHistorico = useCallback(async () => {
    const r = await api<{ envios: EnvioPush[] }>('/api/admin/push?limite=20');
    setHistorico(r.envios);
  }, []);

  useEffect(() => {
    api<{ entidades: Entidade[] }>('/api/admin/entidades').then((r) => setEntidades(r.entidades));
    carregarHistorico();
  }, [carregarHistorico]);

  function montarAlvo() {
    switch (tipo) {
      case 'ENTIDADE':
        return { tipo, entidadeId };
      case 'USUARIO':
        return { tipo, usuarioId };
      case 'INATIVOS':
        return { tipo, diasSemAcesso: Number(dias) };
      default:
        return { tipo: 'TODOS' };
    }
  }

  const alvoValido =
    tipo === 'TODOS' ||
    (tipo === 'ENTIDADE' && !!entidadeId) ||
    (tipo === 'USUARIO' && !!usuarioId) ||
    (tipo === 'INATIVOS' && dias >= 1);

  async function enviar() {
    setErro('');
    setResultado(null);
    setEnviando(true);
    try {
      const r = await api<{ totalUsuarios: number; totalTokens: number; aceitos: number; falhas: number }>(
        '/api/admin/push',
        { metodo: 'POST', corpo: { titulo, corpo, alvo: montarAlvo() } }
      );
      setResultado(
        `Enviado para ${r.totalUsuarios} usuário(s) · ${r.totalTokens} dispositivo(s) · ${r.aceitos} aceito(s)` +
          (r.falhas ? ` · ${r.falhas} falha(s)` : '')
      );
      setTitulo('');
      setCorpo('');
      carregarHistorico();
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Falha ao enviar');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <h1>Enviar push</h1>
      <p className="subtitulo">Notificação para os usuários do aplicativo.</p>

      <div className="cartao">
        <div className="campo">
          <label>Título *</label>
          <input value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={120} />
        </div>
        <div className="campo">
          <label>Mensagem *</label>
          <textarea
            value={corpo}
            onChange={(e) => setCorpo(e.target.value)}
            maxLength={1000}
            style={{ minHeight: 90 }}
          />
        </div>

        <div className="campo">
          <label>Enviar para</label>
          <div className="radio-linha">
            {(Object.keys(ROTULO_ALVO) as TipoAlvoPush[]).map((t) => (
              <label key={t} className={`radio-opcao ${tipo === t ? 'sel' : ''}`}>
                <input
                  type="radio"
                  name="alvo"
                  checked={tipo === t}
                  onChange={() => setTipo(t)}
                  style={{ width: 'auto' }}
                />
                {ROTULO_ALVO[t]}
              </label>
            ))}
          </div>

          {tipo === 'ENTIDADE' && (
            <select value={entidadeId} onChange={(e) => setEntidadeId(e.target.value)}>
              <option value="">— escolha uma entidade —</option>
              {entidades.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nome}
                </option>
              ))}
            </select>
          )}

          {tipo === 'USUARIO' && (
            <BuscaUsuario
              selecionadoId={usuarioId}
              selecionadoNome={usuarioNome}
              aoEscolher={(u) => {
                setUsuarioId(u.id);
                setUsuarioNome(u.nome);
              }}
            />
          )}

          {tipo === 'INATIVOS' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: 'var(--texto-suave)', fontSize: 14 }}>Sem acessar há mais de</span>
              <input
                type="number"
                min={1}
                value={dias}
                onChange={(e) => setDias(Number(e.target.value))}
                style={{ width: 90 }}
              />
              <span style={{ color: 'var(--texto-suave)', fontSize: 14 }}>dias</span>
            </div>
          )}
        </div>

        {resultado && <div className="resultado-ok">{resultado}</div>}
        {erro && <p className="erro">{erro}</p>}

        <button onClick={enviar} disabled={enviando || !titulo || !corpo || !alvoValido}>
          {enviando ? 'Enviando…' : 'Enviar push'}
        </button>
      </div>

      <h2>Histórico</h2>
      <div className="cartao" style={{ padding: 0 }}>
        {historico.length === 0 ? (
          <div className="vazio">Nenhum envio ainda.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Quando</th>
                <th>Título</th>
                <th>Alvo</th>
                <th>Usuários</th>
                <th>Aceitos</th>
              </tr>
            </thead>
            <tbody>
              {historico.map((e) => (
                <tr key={e.id}>
                  <td>{dataHora(e.criadoEm)}</td>
                  <td>{e.titulo}</td>
                  <td>{ROTULO_ALVO[e.alvoTipo]}</td>
                  <td>{e.totalUsuarios}</td>
                  <td>
                    {e.totalAceitos}/{e.totalTokens}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

function BuscaUsuario({
  selecionadoId,
  selecionadoNome,
  aoEscolher,
}: {
  selecionadoId: string;
  selecionadoNome: string;
  aoEscolher: (u: UsuarioApp) => void;
}) {
  const [termo, setTermo] = useState('');
  const [resultados, setResultados] = useState<UsuarioApp[]>([]);

  useEffect(() => {
    if (termo.trim().length < 2) {
      setResultados([]);
      return;
    }
    const t = setTimeout(async () => {
      const r = await api<{ usuarios: UsuarioApp[] }>(
        `/api/admin/usuarios-app?busca=${encodeURIComponent(termo.trim())}&limite=8`
      );
      setResultados(r.usuarios);
    }, 250);
    return () => clearTimeout(t);
  }, [termo]);

  if (selecionadoId) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span>
          Para: <strong>{selecionadoNome}</strong>
        </span>
        <button className="secundario pequeno" onClick={() => aoEscolher({ id: '', nome: '' } as UsuarioApp)}>
          Trocar
        </button>
      </div>
    );
  }

  return (
    <div>
      <input
        placeholder="Buscar usuário por nome, e-mail ou CPF…"
        value={termo}
        onChange={(e) => setTermo(e.target.value)}
      />
      {resultados.length > 0 && (
        <div className="cartao" style={{ marginTop: 6, padding: 6 }}>
          {resultados.map((u) => (
            <div
              key={u.id}
              onClick={() => {
                aoEscolher(u);
                setTermo('');
                setResultados([]);
              }}
              style={{ padding: '8px 10px', cursor: 'pointer', borderRadius: 6 }}
            >
              {u.nome} <span style={{ color: 'var(--texto-suave)', fontSize: 12 }}>· {u.email}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
