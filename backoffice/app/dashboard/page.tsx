'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Protegido } from '../componentes/Protegido';

interface Dashboard {
  cards: {
    total: number;
    ativos: number;
    semAtivar: number;
    semVinculo: number;
    semDocumento: number;
    semCadastro: number;
  };
  armasSistema: number;
  plataformas: { ios: number; android: number };
  diasAtivo: number;
}

interface Ponto {
  rotulo: string;
  novos: number;
  acumulado: number;
}

const PERIODOS = [
  { dias: 7, rotulo: 'Última semana' },
  { dias: 30, rotulo: '30 dias' },
  { dias: 60, rotulo: '60 dias' },
  { dias: 90, rotulo: '90 dias' },
  { dias: 365, rotulo: '12 meses' },
];

export default function PaginaDashboard() {
  return (
    <Protegido>
      <Conteudo />
    </Protegido>
  );
}

function Conteudo() {
  const [d, setD] = useState<Dashboard | null>(null);

  useEffect(() => {
    api<Dashboard>('/api/admin/dashboard').then(setD).catch(() => setD(null));
  }, []);

  if (!d) return <div className="vazio">Carregando…</div>;

  const cards = [
    { chave: 'todos', titulo: 'Usuários', valor: d.cards.total, dica: 'Contas criadas no app' },
    { chave: 'ativos', titulo: `Ativos (${d.diasAtivo}d)`, valor: d.cards.ativos, dica: 'Acessaram recentemente' },
    { chave: 'semAtivar', titulo: 'Sem ativar e-mail', valor: d.cards.semAtivar, dica: 'Não confirmaram o e-mail' },
    { chave: 'semVinculo', titulo: 'Sem vínculo', valor: d.cards.semVinculo, dica: 'Sem entidade vinculada' },
    { chave: 'semDocumento', titulo: 'Sem documentos', valor: d.cards.semDocumento, dica: 'Nenhum documento cadastrado' },
    { chave: 'semCadastro', titulo: 'Sem cadastro', valor: d.cards.semCadastro, dica: 'Instalações anônimas', href: '/usuarios' },
  ];

  return (
    <>
      <div className="cabeca-secao">
        <div>
          <h1>Dashboard</h1>
          <p className="subtitulo">Panorama de uso do aplicativo.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 14 }}>
        {cards.map((c) => (
          <Link key={c.chave} href={c.href ?? `/dashboard/${c.chave}`} style={{ textDecoration: 'none' }}>
            <div className="cartao" style={{ cursor: 'pointer' }}>
              <div style={{ fontSize: 32, fontWeight: 800, lineHeight: 1 }}>{c.valor}</div>
              <div style={{ fontWeight: 600, marginTop: 6 }}>{c.titulo}</div>
              <div style={{ color: 'var(--texto-suave)', fontSize: 12.5, marginTop: 2 }}>{c.dica} ›</div>
            </div>
          </Link>
        ))}
      </div>

      <div className="cabeca-secao" style={{ marginTop: 32 }}>
        <h2 style={{ margin: 0 }}>Plataformas</h2>
      </div>
      <div className="cartao">
        <GraficoPlataformas ios={d.plataformas.ios} android={d.plataformas.android} />
      </div>

      <GraficoCrescimento />
    </>
  );
}

function GraficoPlataformas({ ios, android }: { ios: number; android: number }) {
  const total = ios + android;
  if (total === 0) return <p className="subtitulo" style={{ margin: 0 }}>Nenhum aparelho ativo ainda.</p>;
  const pIos = Math.round((ios / total) * 100);
  const pAnd = 100 - pIos;
  const COR_IOS = 'var(--texto)';
  const COR_AND = '#3DDC84';
  return (
    <div>
      <div style={{ display: 'flex', height: 26, borderRadius: 6, overflow: 'hidden', border: '1px solid var(--borda)' }}>
        {ios > 0 && <div style={{ width: `${pIos}%`, background: COR_IOS }} title={`iOS: ${ios}`} />}
        {android > 0 && <div style={{ width: `${pAnd}%`, background: COR_AND }} title={`Android: ${android}`} />}
      </div>
      <div style={{ display: 'flex', gap: 24, marginTop: 14, flexWrap: 'wrap' }}>
        <Legenda cor={COR_IOS} rotulo="iPhone (iOS)" valor={ios} pct={pIos} />
        <Legenda cor={COR_AND} rotulo="Android" valor={android} pct={pAnd} />
      </div>
    </div>
  );
}

function Legenda({ cor, rotulo, valor, pct }: { cor: string; rotulo: string; valor: number; pct: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ width: 12, height: 12, borderRadius: 3, background: cor, display: 'inline-block' }} />
      <span style={{ fontWeight: 600 }}>{rotulo}</span>
      <span style={{ color: 'var(--texto-suave)' }}>
        {valor} · {pct}%
      </span>
    </div>
  );
}

function GraficoCrescimento() {
  const [dias, setDias] = useState(30);
  const [pontos, setPontos] = useState<Ponto[] | null>(null);
  const [escala, setEscala] = useState<'dia' | 'mes'>('dia');

  const carregar = useCallback(async () => {
    setPontos(null);
    const r = await api<{ pontos: Ponto[]; escala: 'dia' | 'mes' }>(
      `/api/admin/dashboard/crescimento?dias=${dias}`
    );
    setPontos(r.pontos);
    setEscala(r.escala);
  }, [dias]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  return (
    <>
      <div className="cabeca-secao" style={{ marginTop: 32 }}>
        <h2 style={{ margin: 0 }}>Crescimento de usuários</h2>
        <div className="linha-acoes" style={{ flexWrap: 'wrap' }}>
          {PERIODOS.map((p) => (
            <button
              key={p.dias}
              className={`secundario pequeno ${dias === p.dias ? 'nav-ativo' : ''}`}
              onClick={() => setDias(p.dias)}
              style={dias === p.dias ? { borderColor: 'var(--acento)', color: 'var(--acento)' } : undefined}
            >
              {p.rotulo}
            </button>
          ))}
        </div>
      </div>
      <div className="cartao">
        {!pontos ? (
          <div className="vazio">Carregando…</div>
        ) : (
          <Grafico pontos={pontos} escala={escala} />
        )}
      </div>
    </>
  );
}

function Grafico({ pontos, escala }: { pontos: Ponto[]; escala: 'dia' | 'mes' }) {
  const W = 760;
  const H = 240;
  const padL = 36;
  const padB = 28;
  const padT = 14;
  const padR = 12;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const maxAcum = Math.max(1, ...pontos.map((p) => p.acumulado));
  const maxNovos = Math.max(1, ...pontos.map((p) => p.novos));
  const x = (i: number) => padL + (innerW * (i + 0.5)) / pontos.length;
  const yAcum = (v: number) => padT + innerH - (innerH * v) / maxAcum;
  const larguraBarra = Math.max(2, (innerW / pontos.length) * 0.6);
  const linha = pontos.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${yAcum(p.acumulado)}`).join(' ');

  // Rótulos esparsos: no máximo ~8 no eixo X.
  const passo = Math.max(1, Math.ceil(pontos.length / 8));
  const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const rotuloEixo = (r: string) => {
    if (escala === 'mes') {
      const [, mm] = r.split('-');
      return MESES[Number(mm) - 1] ?? r;
    }
    const [, mm, dd] = r.split('-');
    return `${dd}/${mm}`;
  };

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg width={W} height={H} role="img" aria-label="Crescimento de usuários" style={{ maxWidth: '100%' }}>
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <line key={f} x1={padL} x2={W - padR} y1={padT + innerH * f} y2={padT + innerH * f} stroke="var(--borda)" strokeWidth={1} />
        ))}
        {pontos.map((p, i) => {
          const h = (innerH * p.novos) / maxNovos;
          return (
            <g key={p.rotulo}>
              <rect x={x(i) - larguraBarra / 2} y={padT + innerH - h} width={larguraBarra} height={h} rx={2} fill="var(--acento)" opacity={0.28} />
              {i % passo === 0 && (
                <text x={x(i)} y={H - 10} textAnchor="middle" fontSize="10" fill="var(--texto-suave)">
                  {rotuloEixo(p.rotulo)}
                </text>
              )}
            </g>
          );
        })}
        <path d={linha} fill="none" stroke="var(--acento)" strokeWidth={2.5} />
        {pontos.length <= 31 &&
          pontos.map((p, i) => <circle key={`c-${p.rotulo}`} cx={x(i)} cy={yAcum(p.acumulado)} r={2.5} fill="var(--acento)" />)}
        <text x={x(pontos.length - 1)} y={yAcum(pontos[pontos.length - 1]!.acumulado) - 8} textAnchor="end" fontSize="11" fontWeight={700} fill="var(--texto)">
          {pontos[pontos.length - 1]!.acumulado}
        </text>
      </svg>
      <p className="subtitulo" style={{ margin: '8px 0 0' }}>
        Linha = total acumulado · barras = novos cadastros por {escala === 'mes' ? 'mês' : 'dia'}.
      </p>
    </div>
  );
}
