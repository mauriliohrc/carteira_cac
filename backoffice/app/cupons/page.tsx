'use client';

import { Fragment, useCallback, useEffect, useState } from 'react';
import { api, ErroApi } from '@/lib/api';
import { dataHora } from '@/lib/formato';
import type { Cupom, UsoCupom } from '@/lib/tipos';
import { Protegido } from '../componentes/Protegido';

export default function PaginaCupons() {
  return (
    <Protegido>
      <Cupons />
    </Protegido>
  );
}

function Cupons() {
  const [cupons, setCupons] = useState<Cupom[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [criando, setCriando] = useState(false);
  const [usos, setUsos] = useState<{ id: string; lista: UsoCupom[] } | null>(null);

  const carregar = useCallback(async () => {
    const r = await api<{ cupons: Cupom[] }>('/api/admin/cupons');
    setCupons(r.cupons);
    setCarregando(false);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function alternarAtivo(c: Cupom) {
    await api(`/api/admin/cupons/${c.id}`, { metodo: 'PATCH', corpo: { ativo: !c.ativo } });
    carregar();
  }
  async function excluir(c: Cupom) {
    if (!confirm(`Excluir o cupom ${c.codigo}? O histórico de usos some junto.`)) return;
    await api(`/api/admin/cupons/${c.id}`, { metodo: 'DELETE' });
    carregar();
  }
  async function verUsos(c: Cupom) {
    if (usos?.id === c.id) {
      setUsos(null);
      return;
    }
    const r = await api<{ usos: UsoCupom[] }>(`/api/admin/cupons/${c.id}/usos`);
    setUsos({ id: c.id, lista: r.usos });
  }

  const esgotado = (c: Cupom) => c.limiteUsos != null && c.usos >= c.limiteUsos;

  return (
    <>
      <div className="cabeca-secao">
        <div>
          <h1>Cupons promocionais</h1>
          <p className="subtitulo">Liberam o Premium. Controle usos, encerre e crie novos.</p>
        </div>
        {!criando && <button onClick={() => setCriando(true)}>+ Novo cupom</button>}
      </div>

      {criando && (
        <FormularioCupom
          aoConcluir={() => {
            setCriando(false);
            carregar();
          }}
          aoCancelar={() => setCriando(false)}
        />
      )}

      <div className="cartao" style={{ padding: 0 }}>
        {carregando ? (
          <div className="vazio">Carregando…</div>
        ) : cupons.length === 0 ? (
          <div className="vazio">Nenhum cupom criado ainda.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Código</th>
                <th>Descrição</th>
                <th>Usos</th>
                <th>Expira</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {cupons.map((c) => (
                <Fragment key={c.id}>
                  <tr>
                    <td style={{ fontFamily: 'var(--mono, monospace)', fontWeight: 600 }}>{c.codigo}</td>
                    <td>{c.descricao || '—'}</td>
                    <td>
                      {c.usos}
                      {c.limiteUsos != null ? ` / ${c.limiteUsos}` : ' / ∞'}
                    </td>
                    <td>{c.expiraEm ? dataHora(c.expiraEm) : '—'}</td>
                    <td>
                      <span
                        className={`etiqueta ${c.ativo && !esgotado(c) ? 'publicada' : 'rascunho'}`}
                      >
                        {!c.ativo ? 'Encerrado' : esgotado(c) ? 'Esgotado' : 'Ativo'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="linha-acoes" style={{ justifyContent: 'flex-end' }}>
                        <button className="secundario pequeno" onClick={() => verUsos(c)}>
                          {usos?.id === c.id ? 'Ocultar' : 'Usos'}
                        </button>
                        <button className="secundario pequeno" onClick={() => alternarAtivo(c)}>
                          {c.ativo ? 'Encerrar' : 'Reativar'}
                        </button>
                        <button className="perigo pequeno" onClick={() => excluir(c)}>
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                  {usos?.id === c.id && (
                    <tr>
                      <td colSpan={6} style={{ background: 'var(--superficie-2)' }}>
                        {usos.lista.length === 0 ? (
                          <span style={{ color: 'var(--texto-suave)', fontSize: 13 }}>
                            Ninguém resgatou ainda.
                          </span>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
                            {usos.lista.map((u, i) => (
                              <div key={i}>
                                {u.usuario ? `${u.usuario.nome} · ${u.usuario.email}` : 'Anônimo'}{' '}
                                <span style={{ color: 'var(--texto-suave)' }}>· {dataHora(u.criadoEm)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

function FormularioCupom({
  aoConcluir,
  aoCancelar,
}: {
  aoConcluir: () => void;
  aoCancelar: () => void;
}) {
  const [codigo, setCodigo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [limiteUsos, setLimiteUsos] = useState('');
  const [expiraEm, setExpiraEm] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    setSalvando(true);
    try {
      await api('/api/admin/cupons', {
        metodo: 'POST',
        corpo: {
          codigo: codigo.trim() || undefined,
          descricao: descricao.trim() || null,
          limiteUsos: limiteUsos.trim() ? Number(limiteUsos) : null,
          expiraEm: expiraEm || null,
        },
      });
      aoConcluir();
    } catch (err) {
      setErro(err instanceof ErroApi ? err.message : 'Falha ao criar');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form className="cartao" onSubmit={salvar} style={{ marginBottom: 20 }}>
      <div className="grade cols-2">
        <div className="campo">
          <label>Código (deixe vazio para gerar automático)</label>
          <input value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="ex.: LANCAMENTO2026" />
        </div>
        <div className="campo">
          <label>Descrição (opcional)</label>
          <input value={descricao} onChange={(e) => setDescricao(e.target.value)} />
        </div>
        <div className="campo">
          <label>Limite de usos (vazio = ilimitado)</label>
          <input type="number" min={1} value={limiteUsos} onChange={(e) => setLimiteUsos(e.target.value)} />
        </div>
        <div className="campo">
          <label>Expira em (opcional)</label>
          <input type="date" value={expiraEm} onChange={(e) => setExpiraEm(e.target.value)} />
        </div>
      </div>
      {erro && <p className="erro">{erro}</p>}
      <div className="linha-acoes">
        <button type="submit" disabled={salvando}>
          {salvando ? 'Criando…' : 'Criar cupom'}
        </button>
        <button type="button" className="secundario" onClick={aoCancelar}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
