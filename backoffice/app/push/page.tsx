'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api, ErroApi } from '@/lib/api';
import { dataHora } from '@/lib/formato';
import type { Entidade, EnvioPush, PublicoPush, UsuarioApp } from '@/lib/tipos';
import { Protegido } from '../componentes/Protegido';

type Base = PublicoPush['base'];
type Plataforma = 'IOS' | 'ANDROID';

const ROTULO_BASE: Record<Base, string> = {
  CONTAS: 'Com conta',
  TODOS: 'Todos (contas + anônimos)',
  ANONIMOS: 'Sem cadastro (anônimos)',
  USUARIO: 'Um usuário',
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

  // Público = filtros combináveis (AND).
  const [base, setBase] = useState<Base>('CONTAS');
  const [plataformas, setPlataformas] = useState<Plataforma[]>([]); // vazio = todas
  const [usuarioId, setUsuarioId] = useState('');
  const [usuarioNome, setUsuarioNome] = useState('');
  const [entidadeAtiva, setEntidadeAtiva] = useState(false);
  const [entidadeId, setEntidadeId] = useState('');
  const [semArma, setSemArma] = useState(false);
  const [semEmail, setSemEmail] = useState(false);
  const [inativosAtivo, setInativosAtivo] = useState(false);
  const [dias, setDias] = useState(30);

  const [entidades, setEntidades] = useState<Entidade[]>([]);
  const [historico, setHistorico] = useState<EnvioPush[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [resultado, setResultado] = useState<string | null>(null);

  // Filtros de conta só valem para público com conta.
  const permiteFiltroConta = base === 'CONTAS' || base === 'TODOS';

  // Prefill vindo da lista de usuários ("Notificar").
  useEffect(() => {
    const uid = sp.get('usuarioId');
    const nome = sp.get('nome');
    if (uid) {
      setBase('USUARIO');
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

  function alternarPlataforma(p: Plataforma) {
    setPlataformas((atual) => (atual.includes(p) ? atual.filter((x) => x !== p) : [...atual, p]));
  }

  function montarPublico(): PublicoPush {
    const pub: PublicoPush = { base };
    if (plataformas.length) pub.plataformas = plataformas;
    if (base === 'USUARIO') pub.usuarioId = usuarioId;
    if (permiteFiltroConta) {
      if (entidadeAtiva && entidadeId) pub.entidadeId = entidadeId;
      if (semArma) pub.semArma = true;
      if (semEmail) pub.semEmail = true;
      if (inativosAtivo && dias >= 1) pub.inativosDias = Number(dias);
    }
    return pub;
  }

  const publicoValido =
    (base !== 'USUARIO' || !!usuarioId) &&
    (!permiteFiltroConta || !entidadeAtiva || !!entidadeId) &&
    (!permiteFiltroConta || !inativosAtivo || dias >= 1);

  async function enviar() {
    setErro('');
    setResultado(null);
    setEnviando(true);
    try {
      const r = await api<{ totalUsuarios: number; totalTokens: number; aceitos: number; falhas: number }>(
        '/api/admin/push',
        { metodo: 'POST', corpo: { titulo, corpo, publico: montarPublico() } }
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

        {/* ---------- Plataforma (checklist) ---------- */}
        <div className="campo">
          <label>Plataforma</label>
          <div className="radio-linha">
            {(['IOS', 'ANDROID'] as Plataforma[]).map((p) => (
              <label key={p} className={`radio-opcao ${plataformas.includes(p) ? 'sel' : ''}`}>
                <input
                  type="checkbox"
                  checked={plataformas.includes(p)}
                  onChange={() => alternarPlataforma(p)}
                  style={{ width: 'auto' }}
                />
                {p === 'IOS' ? 'iOS' : 'Android'}
              </label>
            ))}
          </div>
          <span style={{ color: 'var(--texto-suave)', fontSize: 12 }}>
            {plataformas.length === 0 || plataformas.length === 2
              ? 'Todas as plataformas'
              : `Só ${plataformas[0] === 'IOS' ? 'iOS' : 'Android'}`}
          </span>
        </div>

        {/* ---------- Público base (radio) ---------- */}
        <div className="campo">
          <label>Público</label>
          <div className="radio-linha">
            {(Object.keys(ROTULO_BASE) as Base[]).map((b) => (
              <label key={b} className={`radio-opcao ${base === b ? 'sel' : ''}`}>
                <input
                  type="radio"
                  name="base"
                  checked={base === b}
                  onChange={() => setBase(b)}
                  style={{ width: 'auto' }}
                />
                {ROTULO_BASE[b]}
              </label>
            ))}
          </div>

          {base === 'USUARIO' && (
            <BuscaUsuario
              selecionadoId={usuarioId}
              selecionadoNome={usuarioNome}
              aoEscolher={(u) => {
                setUsuarioId(u.id);
                setUsuarioNome(u.nome);
              }}
            />
          )}
        </div>

        {/* ---------- Filtros de conta (checklist, combináveis) ---------- */}
        {permiteFiltroConta && (
          <div className="campo">
            <label>Filtros (combináveis)</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <label className="radio-opcao" style={{ cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={entidadeAtiva}
                  onChange={(e) => setEntidadeAtiva(e.target.checked)}
                  style={{ width: 'auto' }}
                />
                Vinculados a uma entidade
              </label>
              {entidadeAtiva && (
                <select value={entidadeId} onChange={(e) => setEntidadeId(e.target.value)} style={{ marginLeft: 26, maxWidth: 360 }}>
                  <option value="">— escolha uma entidade —</option>
                  {entidades.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.nome}
                    </option>
                  ))}
                </select>
              )}

              <label className="radio-opcao" style={{ cursor: 'pointer' }}>
                <input type="checkbox" checked={semArma} onChange={(e) => setSemArma(e.target.checked)} style={{ width: 'auto' }} />
                Sem arma cadastrada
              </label>

              <label className="radio-opcao" style={{ cursor: 'pointer' }}>
                <input type="checkbox" checked={semEmail} onChange={(e) => setSemEmail(e.target.checked)} style={{ width: 'auto' }} />
                E-mail não validado
              </label>

              <label className="radio-opcao" style={{ cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={inativosAtivo}
                  onChange={(e) => setInativosAtivo(e.target.checked)}
                  style={{ width: 'auto' }}
                />
                Inativos
              </label>
              {inativosAtivo && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 26 }}>
                  <span style={{ color: 'var(--texto-suave)', fontSize: 14 }}>Sem acessar há mais de</span>
                  <input type="number" min={1} value={dias} onChange={(e) => setDias(Number(e.target.value))} style={{ width: 90 }} />
                  <span style={{ color: 'var(--texto-suave)', fontSize: 14 }}>dias</span>
                </div>
              )}
            </div>
          </div>
        )}

        {resultado && <div className="resultado-ok">{resultado}</div>}
        {erro && <p className="erro">{erro}</p>}

        <button onClick={enviar} disabled={enviando || !titulo || !corpo || !publicoValido}>
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
                <th>Público</th>
                <th>Usuários</th>
                <th>Aceitos</th>
              </tr>
            </thead>
            <tbody>
              {historico.map((e) => (
                <tr key={e.id}>
                  <td>{dataHora(e.criadoEm)}</td>
                  <td>{e.titulo}</td>
                  <td>{e.alvoTipo}</td>
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
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
    <div style={{ marginTop: 8 }}>
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
