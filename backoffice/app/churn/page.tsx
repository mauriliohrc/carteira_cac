'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import type { UsuarioApp } from '@/lib/tipos';
import { Protegido } from '../componentes/Protegido';
import {
  CabecalhoUsuario,
  CelulasUsuario,
  COLUNAS_USUARIO,
  formatarData,
} from '../componentes/ColunasUsuario';

interface Churn {
  id: string;
  originalTransactionId: string;
  plataforma: string;
  produtoId: string;
  premiumTipo: string | null;
  status: string;
  autoRenova: boolean;
  ambiente: string;
  expiraEm: string | null;
  iniciouEm: string | null;
  canceladaEm: string | null;
  expirouEm: string | null;
  motivo: string | null;
  winbackStatus: string | null;
  winbackEm: string | null;
  observacao: string | null;
  usuario: (UsuarioApp & { winbackParceiroEm?: string | null }) | null;
}

interface Metricas {
  canceladaRenovacao: number;
  emGraca: number;
  expirados30: number;
  aReconquistar: number;
  apiAtiva: boolean;
}

const STATUS_META: Record<string, { rotulo: string; cor: string }> = {
  CANCELADA_RENOVACAO: { rotulo: 'Cancelou renovação', cor: '#c99a2e' },
  EM_GRACA: { rotulo: 'Em recuperação', cor: '#c99a2e' },
  EXPIRADA: { rotulo: 'Expirada', cor: 'var(--perigo, #d0585a)' },
  REEMBOLSADA: { rotulo: 'Reembolsada', cor: 'var(--perigo, #d0585a)' },
  REVOGADA: { rotulo: 'Revogada', cor: 'var(--perigo, #d0585a)' },
};

const WINBACK_META: Record<string, { rotulo: string; cor: string }> = {
  PENDENTE: { rotulo: 'Pendente', cor: 'var(--texto-suave)' },
  CONTATADO: { rotulo: 'Contatado', cor: '#c99a2e' },
  RECUPERADO: { rotulo: 'Recuperado', cor: 'var(--ok)' },
  PERDIDO: { rotulo: 'Perdido', cor: 'var(--perigo, #d0585a)' },
};

const GRUPOS = [
  { id: 'todos', rotulo: 'Todos' },
  { id: 'risco', rotulo: 'Em risco (cancelaram)' },
  { id: 'perdidos', rotulo: 'Perdidos' },
];

// Churn consumado: o usuário perdeu o acesso Premium (deixou de ser VIP). Nestes
// status a coluna Plano mostra "Churn" (vermelho) no lugar do rótulo de premium
// — que fica obsoleto enquanto a conta ainda não é rebaixada. Os de "risco"
// (cancelaram a renovação mas seguem no período pago) continuam como Premium.
const STATUS_PERDIDOS = ['EXPIRADA', 'REEMBOLSADA', 'REVOGADA'];

export default function PaginaChurn() {
  return (
    <Protegido>
      <Suspense fallback={<div className="vazio">Carregando…</div>}>
        <Conteudo />
      </Suspense>
    </Protegido>
  );
}

const GRUPOS_VALIDOS = ['todos', 'risco', 'perdidos'];

function Conteudo() {
  const searchParams = useSearchParams();
  const grupoInicial = searchParams.get('grupo');
  const [grupo, setGrupo] = useState(
    grupoInicial && GRUPOS_VALIDOS.includes(grupoInicial) ? grupoInicial : 'todos'
  );
  const [winback, setWinback] = useState<string | null>(null);
  const [lista, setLista] = useState<Churn[] | null>(null);
  const [metricas, setMetricas] = useState<Metricas | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLista(null);
    const params = new URLSearchParams({ grupo });
    if (winback) params.set('winback', winback);
    const r = await api<{ assinaturas: Churn[] }>(`/api/admin/churn?${params}`);
    setLista(r.assinaturas);
  }, [grupo, winback]);

  useEffect(() => {
    carregar();
  }, [carregar]);
  useEffect(() => {
    api<Metricas>('/api/admin/churn/metricas').then(setMetricas).catch(() => {});
  }, []);

  async function winbackAcao(c: Churn, canal: 'parceiro' | 'cupom' | 'push' | 'whatsapp') {
    const nome = c.usuario?.nome ?? 'usuário';
    const rotulos: Record<string, string> = {
      parceiro: `Liberar a oferta Premium Parceiro (R$49,90) para ${nome}?`,
      cupom: `Gerar um cupom de reconquista (1 uso) para ${nome}?`,
      push: `Enviar push de reconquista para ${nome}?`,
      whatsapp: `Enviar WhatsApp de reconquista para ${nome}?`,
    };
    if (!confirm(rotulos[canal])) return;
    setOcupado(c.id);
    try {
      const r = await api<{
        ok: boolean;
        mensagem?: string;
        codigo?: string;
        aceitos?: number;
        titulo?: string;
        corpo?: string;
      }>(`/api/admin/churn/${c.id}/winback`, { metodo: 'POST', corpo: { canal } });
      if (canal === 'cupom' && r.codigo) alert(`Cupom gerado: ${r.codigo}`);
      else if (canal === 'push')
        alert(
          `Push enviado (${r.aceitos ?? 0} aparelho(s)).\n\n` +
            `${r.titulo ? r.titulo + '\n' : ''}${r.corpo ?? ''}`
        );
      else if (canal === 'whatsapp') alert(`WhatsApp enviado:\n\n${r.corpo ?? ''}`);
      else if (r.mensagem) alert(r.mensagem);
      else alert('Enviado.');
      await carregar();
    } catch (e) {
      alert((e as Error).message || 'Falha na ação.');
    } finally {
      setOcupado(null);
    }
  }

  async function mudarStatus(c: Churn, status: string) {
    setOcupado(c.id);
    try {
      await api(`/api/admin/churn/${c.id}`, { metodo: 'PATCH', corpo: { winbackStatus: status } });
      await carregar();
    } catch (e) {
      alert((e as Error).message || 'Falha ao atualizar.');
    } finally {
      setOcupado(null);
    }
  }

  async function reconsultar(c: Churn) {
    setOcupado(c.id);
    try {
      await api(`/api/admin/churn/${c.id}/reconsultar`, { metodo: 'POST' });
      await carregar();
    } catch (e) {
      alert((e as Error).message || 'Falha ao reconsultar.');
    } finally {
      setOcupado(null);
    }
  }

  function exportarCsv() {
    if (!lista) return;
    const cab = [
      'Nome', 'E-mail', 'CPF', 'Celular', 'Plano', 'Status', 'Cancelou em', 'Expira/Expirou',
      'Motivo', 'Win-back', 'Último acesso', 'Versão', 'Armas',
    ];
    const linhas = lista.map((c) => [
      c.usuario?.nome ?? '(não vinculado)',
      c.usuario?.email ?? '',
      c.usuario?.cpf ?? '',
      c.usuario?.celular ?? '',
      c.premiumTipo ?? '',
      STATUS_META[c.status]?.rotulo ?? c.status,
      c.canceladaEm ?? '',
      c.expirouEm ?? c.expiraEm ?? '',
      c.motivo ?? '',
      c.winbackStatus ?? 'PENDENTE',
      c.usuario?.ultimoAcessoEm ?? '',
      c.usuario?.appVersao ?? '',
      String(c.usuario?.armasSistema ?? ''),
    ]);
    const escapar = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
    const csv = [cab, ...linhas].map((l) => l.map(escapar).join(',')).join('\r\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `churn-${grupo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <div className="cabeca-secao">
        <div>
          <h1>Churn & Reconquista</h1>
          <p className="subtitulo">
            Quem cancelou ou deixou expirar o Premium — quando, por quê, e ações de win-back.
          </p>
        </div>
        <button className="secundario" onClick={exportarCsv} disabled={!lista || lista.length === 0}>
          Exportar CSV
        </button>
      </div>

      {/* Resumo */}
      <div
        style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 14, marginBottom: 16 }}
      >
        <Cartao valor={metricas?.canceladaRenovacao} titulo="Cancelaram renovação" dica="Ainda com acesso — resgatáveis" />
        <Cartao valor={metricas?.emGraca} titulo="Em recuperação" dica="Falha de cobrança (período de graça)" />
        <Cartao valor={metricas?.expirados30} titulo="Perdidos (30d)" dica="Expiraram/reembolsaram" />
        <Cartao valor={metricas?.aReconquistar} titulo="A reconquistar" dica="Perdidos sem contato" />
      </div>

      {metricas && !metricas.apiAtiva && (
        <div className="cartao" style={{ marginBottom: 16, borderColor: 'rgba(197,160,40,.4)' }}>
          <strong>App Store Server API não configurada.</strong>{' '}
          <span style={{ color: 'var(--texto-suave)' }}>
            O churn é capturado pelas notificações da Apple (iOS) e do Google Play (Android, via
            RTDN). Configure as chaves APPLE_* para backfill retroativo e reconsulta sob demanda no
            iOS; o Android depende das credenciais GOOGLE_*.
          </span>
        </div>
      )}

      {/* Filtros */}
      <div className="filtros">
        <div className="filtro-grupo">
          <span className="rotulo">Grupo</span>
          {GRUPOS.map((g) => (
            <button
              key={g.id}
              className={`filtro-chip ${grupo === g.id ? 'ativo' : ''}`}
              onClick={() => setGrupo(g.id)}
            >
              {g.rotulo}
            </button>
          ))}
        </div>
        <div className="filtro-grupo">
          <span className="rotulo">Win-back</span>
          {Object.entries(WINBACK_META).map(([k, m]) => (
            <button
              key={k}
              className={`filtro-chip ${winback === k ? 'ativo' : ''}`}
              onClick={() => setWinback((v) => (v === k ? null : k))}
            >
              {m.rotulo}
            </button>
          ))}
        </div>
      </div>

      <div className="cartao" style={{ padding: 0, overflowX: 'auto' }}>
        {!lista ? (
          <div className="vazio">Carregando…</div>
        ) : lista.length === 0 ? (
          <div className="vazio">Nenhum churn neste filtro. 🎉</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Status</th>
                <th>Cancelou</th>
                <th>Expira/Expirou</th>
                <th>Motivo</th>
                <th>Win-back</th>
                <CabecalhoUsuario />
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((c) => {
                const sm = STATUS_META[c.status] ?? { rotulo: c.status, cor: 'var(--texto-suave)' };
                const wm = WINBACK_META[c.winbackStatus ?? 'PENDENTE'];
                return (
                  <tr key={c.id} style={{ opacity: ocupado === c.id ? 0.5 : 1 }}>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <span className="etiqueta" style={{ borderColor: sm.cor, color: sm.cor }}>
                        {sm.rotulo}
                      </span>
                      <span
                        title={c.plataforma === 'ANDROID' ? 'Android' : 'iOS'}
                        style={{ marginLeft: 6, fontSize: 11, color: 'var(--texto-suave)' }}
                      >
                        {c.plataforma === 'ANDROID' ? '🤖' : ''}
                      </span>
                    </td>
                    <td style={{ whiteSpace: 'nowrap', fontSize: 13 }}>{formatarData(c.canceladaEm)}</td>
                    <td style={{ whiteSpace: 'nowrap', fontSize: 13 }}>
                      {formatarData(c.expirouEm ?? c.expiraEm)}
                    </td>
                    <td style={{ fontSize: 13, color: 'var(--texto-suave)' }}>{c.motivo ?? '—'}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <select
                        value={c.winbackStatus ?? 'PENDENTE'}
                        onChange={(e) => mudarStatus(c, e.target.value)}
                        style={{ width: 'auto', fontSize: 12, color: wm?.cor }}
                        disabled={ocupado === c.id}
                      >
                        {Object.entries(WINBACK_META).map(([k, m]) => (
                          <option key={k} value={k}>
                            {m.rotulo}
                          </option>
                        ))}
                      </select>
                    </td>

                    {c.usuario ? (
                      <CelulasUsuario u={c.usuario} churn={STATUS_PERDIDOS.includes(c.status)} />
                    ) : (
                      <td colSpan={COLUNAS_USUARIO} style={{ color: 'var(--texto-suave)', fontStyle: 'italic' }}>
                        Assinatura ainda não vinculada a uma conta
                        <div style={{ fontFamily: 'monospace', fontSize: 11 }}>{c.originalTransactionId}</div>
                      </td>
                    )}

                    <td style={{ whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        <button
                          className="secundario pequeno"
                          disabled={!c.usuario || ocupado === c.id}
                          title="Liberar Premium Parceiro (R$49,90)"
                          onClick={() => winbackAcao(c, 'parceiro')}
                        >
                          Parceiro
                        </button>
                        <button className="secundario pequeno" disabled={!c.usuario || ocupado === c.id} onClick={() => winbackAcao(c, 'cupom')}>
                          Cupom
                        </button>
                        <button className="secundario pequeno" disabled={!c.usuario || ocupado === c.id} onClick={() => winbackAcao(c, 'push')}>
                          Push
                        </button>
                        <button className="secundario pequeno" disabled={!c.usuario || !c.usuario.celular || ocupado === c.id} onClick={() => winbackAcao(c, 'whatsapp')}>
                          Zap
                        </button>
                        {metricas?.apiAtiva && (
                          <button className="secundario pequeno" disabled={ocupado === c.id} title="Reconsultar status na Apple" onClick={() => reconsultar(c)}>
                            ↻
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <p className="subtitulo" style={{ marginTop: 12 }}>
        <Link href="/dashboard">← Dashboard</Link>
        {'  ·  '}
        As mensagens de <strong>Push</strong> e <strong>Zap</strong> de reconquista são editáveis em{' '}
        <Link href="/automacoes">Mensagens automáticas</Link> (gatilho “Reconquista”) e ficam
        registradas em <Link href="/notificacoes">Auditoria de envios</Link>.
      </p>
    </>
  );
}

function Cartao({ valor, titulo, dica }: { valor?: number; titulo: string; dica: string }) {
  return (
    <div className="cartao" style={{ height: '100%' }}>
      <div style={{ fontSize: 32, fontWeight: 800, lineHeight: 1 }}>{valor ?? '—'}</div>
      <div style={{ fontWeight: 600, marginTop: 6 }}>{titulo}</div>
      <div style={{ color: 'var(--texto-suave)', fontSize: 12.5, marginTop: 2 }}>{dica}</div>
    </div>
  );
}
