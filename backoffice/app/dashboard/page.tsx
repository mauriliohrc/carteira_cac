'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { ESTADOS_BR, VIEWBOX_BR } from '@/lib/brasilMapa';
import { Protegido } from '../componentes/Protegido';

interface Dashboard {
  cards: {
    totalGeral: number;
    comConta: number;
    contasAtivas: number;
    semConta: number;
    semAtivar: number;
    comDocumento: number;
    semDocumento: number;
    comVinculo: number;
    planoAnual: number;
    planoMensal: number;
    premiumGratis: number;
    // compat
    total: number;
    ativos: number;
    semVinculo: number;
    semCadastro: number;
  };
  online: number;
  minOnline: number;
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

  // Ordem pedida: geral → com conta → ativas → sem conta → sem validar e-mail
  // → com documentos → sem documentos → com vínculo.
  const cards: {
    titulo: string;
    valor: number;
    dica: string;
    href?: string; // ausente = card não clicável (ex.: agregado)
  }[] = [
    { titulo: 'Total geral', valor: d.cards.totalGeral, dica: 'Contas + instalações anônimas' },
    { titulo: 'Com conta', valor: d.cards.comConta, dica: 'Contas criadas no app', href: '/dashboard/todos' },
    { titulo: 'Contas ativas', valor: d.cards.contasAtivas, dica: 'Conta habilitada', href: '/dashboard/contasAtivas' },
    { titulo: 'Sem conta', valor: d.cards.semConta, dica: 'Instalações anônimas', href: '/usuarios' },
    { titulo: 'Sem validar e-mail', valor: d.cards.semAtivar, dica: 'Não confirmaram o e-mail', href: '/dashboard/semAtivar' },
    { titulo: 'Com documentos', valor: d.cards.comDocumento, dica: 'Têm documentos cadastrados', href: '/dashboard/comDocumento' },
    { titulo: 'Sem documentos', valor: d.cards.semDocumento, dica: 'Nenhum documento cadastrado', href: '/dashboard/semDocumento' },
    { titulo: 'Com vínculo', valor: d.cards.comVinculo, dica: 'Vinculados a uma entidade', href: '/dashboard/comVinculo' },
    { titulo: 'Plano anual ativo', valor: d.cards.planoAnual, dica: 'Assinantes anuais', href: '/dashboard/planoAnual' },
    { titulo: 'Plano mensal ativo', valor: d.cards.planoMensal, dica: 'Assinantes mensais', href: '/dashboard/planoMensal' },
    { titulo: 'Premium grátis', valor: d.cards.premiumGratis, dica: 'Premium via cupom', href: '/dashboard/premiumGratis' },
  ];

  return (
    <>
      <div className="cabeca-secao">
        <div>
          <h1>Dashboard</h1>
          <p className="subtitulo">Panorama de uso do aplicativo.</p>
        </div>
      </div>

      <div
        className="cartao"
        style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16, borderColor: 'rgba(48,164,108,.4)' }}
      >
        <span className="ponto online" style={{ width: 12, height: 12 }} />
        <div style={{ fontSize: 30, fontWeight: 800, lineHeight: 1 }}>{d.online}</div>
        <div style={{ color: 'var(--texto-suave)', fontSize: 14 }}>
          online agora · ativos nos últimos {d.minOnline} min
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 14 }}>
        {cards.map((c) => {
          const corpo = (
            <div className="cartao" style={{ cursor: c.href ? 'pointer' : 'default', height: '100%' }}>
              <div style={{ fontSize: 32, fontWeight: 800, lineHeight: 1 }}>{c.valor}</div>
              <div style={{ fontWeight: 600, marginTop: 6 }}>{c.titulo}</div>
              <div style={{ color: 'var(--texto-suave)', fontSize: 12.5, marginTop: 2 }}>
                {c.dica}
                {c.href ? ' ›' : ''}
              </div>
            </div>
          );
          return c.href ? (
            <Link key={c.titulo} href={c.href} style={{ textDecoration: 'none' }}>
              {corpo}
            </Link>
          ) : (
            <div key={c.titulo}>{corpo}</div>
          );
        })}
      </div>

      <MapaRegioes />

      <div className="cabeca-secao" style={{ marginTop: 32 }}>
        <h2 style={{ margin: 0 }}>Plataformas</h2>
      </div>
      <div className="cartao">
        <GraficoPlataformas ios={d.plataformas.ios} android={d.plataformas.android} />
      </div>

      {/* Crescimento × Acessos por horário, lado a lado (uma coluna cada).
          Cada gráfico vai num wrapper próprio: senão o fragment (cabeçalho +
          cartão) espalha 4 itens no grid e desalinha. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 20, alignItems: 'start' }}>
        <div style={{ minWidth: 0 }}>
          <GraficoCrescimento />
        </div>
        <div style={{ minWidth: 0 }}>
          <GraficoAcessosHora />
        </div>
      </div>
    </>
  );
}

// ------------------------------------------------- mapa de calor por estado
interface Regioes {
  ufs: Record<string, number>;
  semDDD: number;
  semTelefone: number;
  comTelefone: number;
  total: number;
}

const REGIOES: Record<string, string[]> = {
  Norte: ['AC', 'AP', 'AM', 'PA', 'RO', 'RR', 'TO'],
  Nordeste: ['AL', 'BA', 'CE', 'MA', 'PB', 'PE', 'PI', 'RN', 'SE'],
  'Centro-Oeste': ['DF', 'GO', 'MT', 'MS'],
  Sudeste: ['ES', 'MG', 'RJ', 'SP'],
  Sul: ['PR', 'RS', 'SC'],
};

function MapaRegioes() {
  const [d, setD] = useState<Regioes | null>(null);
  const [regiao, setRegiao] = useState<string>('Todas');
  const [hover, setHover] = useState<string | null>(null);

  useEffect(() => {
    api<Regioes>('/api/admin/dashboard/regioes').then(setD).catch(() => setD(null));
  }, []);

  const ufsVisiveis = regiao === 'Todas' ? Object.keys(ESTADOS_BR) : REGIOES[regiao] ?? [];
  const max = Math.max(1, ...ufsVisiveis.map((uf) => d?.ufs[uf] ?? 0));
  const totalRegiao = ufsVisiveis.reduce((s, uf) => s + (d?.ufs[uf] ?? 0), 0);

  const ranking = ufsVisiveis
    .map((uf) => ({ uf, n: d?.ufs[uf] ?? 0 }))
    .filter((r) => r.n > 0)
    .sort((a, b) => b.n - a.n);

  function noEscopo(uf: string) {
    return regiao === 'Todas' || (REGIOES[regiao] ?? []).includes(uf);
  }
  function cor(uf: string): string {
    const n = d?.ufs[uf] ?? 0;
    if (!noEscopo(uf) || n === 0) return 'var(--superficie-2)';
    const alpha = 0.2 + 0.8 * (n / max);
    return `rgba(147, 173, 101, ${alpha.toFixed(3)})`;
  }

  return (
    <>
      <div className="cabeca-secao" style={{ marginTop: 32 }}>
        <h2 style={{ margin: 0 }}>Usuários por estado (via DDD)</h2>
        <select value={regiao} onChange={(e) => setRegiao(e.target.value)} style={{ width: 'auto' }}>
          <option value="Todas">Todas as regiões</option>
          {Object.keys(REGIOES).map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </div>

      <div className="cartao">
        {!d ? (
          <div className="vazio">Carregando…</div>
        ) : (
          <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            {/* Mapa do Brasil (choropleth) */}
            <div style={{ flex: '0 1 460px', minWidth: 280 }}>
              <svg
                viewBox={VIEWBOX_BR}
                width="100%"
                style={{ display: 'block', height: 'auto', maxHeight: 460 }}
                role="img"
                aria-label="Usuários por estado"
              >
                {Object.entries(ESTADOS_BR).map(([uf, e]) => {
                  const n = d.ufs[uf] ?? 0;
                  return (
                    <path
                      key={uf}
                      d={e.path}
                      fill={cor(uf)}
                      stroke="var(--fundo)"
                      strokeWidth={hover === uf ? 1.6 : 0.8}
                      style={{ opacity: noEscopo(uf) ? 1 : 0.25, cursor: 'default', transition: 'fill .2s' }}
                      onMouseEnter={() => setHover(uf)}
                      onMouseLeave={() => setHover(null)}
                    >
                      <title>{`${e.nome} (${uf}) — ${n} usuário(s)`}</title>
                    </path>
                  );
                })}
              </svg>
              {hover && (
                <p className="subtitulo" style={{ margin: '6px 0 0', textAlign: 'center' }}>
                  <strong>{ESTADOS_BR[hover]?.nome}</strong> · {d.ufs[hover] ?? 0} usuário(s)
                </p>
              )}
            </div>

            {/* Resumo + ranking */}
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 26, fontWeight: 800, lineHeight: 1 }}>{totalRegiao}</div>
                  <div className="subtitulo" style={{ margin: 0 }}>
                    {regiao === 'Todas' ? 'com DDD identificado' : `na região ${regiao}`}
                  </div>
                </div>
              </div>
              {ranking.length === 0 ? (
                <p className="subtitulo" style={{ margin: 0 }}>Sem dados de DDD neste escopo.</p>
              ) : (
                <div style={{ display: 'grid', gap: 6 }}>
                  {ranking.slice(0, 8).map((r) => (
                    <div key={r.uf} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 30, fontWeight: 700, fontSize: 13 }}>{r.uf}</span>
                      <div style={{ flex: 1, height: 10, background: 'var(--superficie-2)', borderRadius: 5, overflow: 'hidden' }}>
                        <div style={{ width: `${(r.n / max) * 100}%`, height: '100%', background: 'var(--acento)' }} />
                      </div>
                      <span style={{ width: 36, textAlign: 'right', fontSize: 13 }}>{r.n}</span>
                    </div>
                  ))}
                </div>
              )}
              <p className="subtitulo" style={{ margin: '12px 0 0', fontSize: 12.5 }}>
                {d.semTelefone} sem telefone · {d.semDDD} com DDD não reconhecido · {d.comTelefone} com telefone.
              </p>
            </div>
          </div>
        )}
      </div>
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
  const W = 780;
  const H = 260;
  const padL = 44; // espaço para os números do eixo Y
  const padB = 30;
  const padT = 20;
  const padR = 46; // espaço para o rótulo do valor final (não cortar)
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const maxAcum = Math.max(1, ...pontos.map((p) => p.acumulado));
  const maxNovos = Math.max(1, ...pontos.map((p) => p.novos));
  const x = (i: number) => padL + (innerW * (i + 0.5)) / pontos.length;
  const yAcum = (v: number) => padT + innerH - (innerH * v) / maxAcum;
  const larguraBarra = Math.max(2, (innerW / pontos.length) * 0.6);
  const linha = pontos.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${yAcum(p.acumulado)}`).join(' ');

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

  const ultimo = pontos[pontos.length - 1]!;
  const yFim = Math.max(padT + 10, yAcum(ultimo.acumulado)); // não deixa o rótulo subir demais

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Crescimento de usuários"
        style={{ display: 'block', minWidth: 560 }}
      >
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <g key={f}>
            <line x1={padL} x2={W - padR} y1={padT + innerH * f} y2={padT + innerH * f} stroke="var(--borda)" strokeWidth={1} />
            <text x={padL - 8} y={padT + innerH * f + 3.5} textAnchor="end" fontSize="10.5" fill="var(--texto-suave)">
              {Math.round(maxAcum * (1 - f))}
            </text>
          </g>
        ))}
        {pontos.map((p, i) => {
          const h = (innerH * p.novos) / maxNovos;
          return (
            <g key={p.rotulo}>
              <rect x={x(i) - larguraBarra / 2} y={padT + innerH - h} width={larguraBarra} height={h} rx={2} fill="var(--acento)" opacity={0.28}>
                <title>{`${rotuloEixo(p.rotulo)} · +${p.novos} novo(s) · ${p.acumulado} total`}</title>
              </rect>
              {i % passo === 0 && (
                <text x={x(i)} y={H - 10} textAnchor="middle" fontSize="10.5" fill="var(--texto-suave)">
                  {rotuloEixo(p.rotulo)}
                </text>
              )}
            </g>
          );
        })}
        <path d={linha} fill="none" stroke="var(--acento)" strokeWidth={2.5} />
        {pontos.length <= 31 &&
          pontos.map((p, i) => <circle key={`c-${p.rotulo}`} cx={x(i)} cy={yAcum(p.acumulado)} r={2.5} fill="var(--acento)" />)}
        <text x={Math.min(W - 4, x(pontos.length - 1) + 6)} y={yFim + 3.5} textAnchor="start" fontSize="11.5" fontWeight={700} fill="var(--texto)">
          {ultimo.acumulado}
        </text>
      </svg>
      <p className="subtitulo" style={{ margin: '8px 0 0' }}>
        Linha = total acumulado · barras = novos cadastros por {escala === 'mes' ? 'mês' : 'dia'}.
      </p>
    </div>
  );
}

interface HoraPonto {
  hora: number;
  total: number;
}

function GraficoAcessosHora() {
  const [horas, setHoras] = useState<HoraPonto[] | null>(null);

  useEffect(() => {
    api<{ horas: HoraPonto[] }>('/api/admin/dashboard/acessos-hora')
      .then((r) => setHoras(r.horas))
      .catch(() => setHoras([]));
  }, []);

  return (
    <>
      <div className="cabeca-secao" style={{ marginTop: 32 }}>
        <h2 style={{ margin: 0 }}>Acessos por horário</h2>
      </div>
      <div className="cartao">
        {!horas ? <div className="vazio">Carregando…</div> : <BarrasHora horas={horas} />}
      </div>
    </>
  );
}

function BarrasHora({ horas }: { horas: HoraPonto[] }) {
  const W = 780;
  const H = 220;
  const padL = 40;
  const padR = 12;
  const padT = 16;
  const padB = 28;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const max = Math.max(1, ...horas.map((h) => h.total));
  const bw = innerW / 24;
  const pico = horas.reduce((a, b) => (b.total > a.total ? b : a), horas[0] ?? { hora: 0, total: 0 });

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label="Acessos por horário"
        style={{ display: 'block', minWidth: 520 }}
      >
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line x1={padL} x2={W - padR} y1={padT + innerH * f} y2={padT + innerH * f} stroke="var(--borda)" strokeWidth={1} />
            <text x={padL - 6} y={padT + innerH * f + 3.5} textAnchor="end" fontSize="10.5" fill="var(--texto-suave)">
              {Math.round(max * (1 - f))}
            </text>
          </g>
        ))}
        {horas.map((h) => {
          const barH = (innerH * h.total) / max;
          const xb = padL + h.hora * bw;
          return (
            <g key={h.hora}>
              <rect
                x={xb + bw * 0.15}
                y={padT + innerH - barH}
                width={bw * 0.7}
                height={barH}
                rx={2}
                fill="var(--acento)"
                opacity={h.hora === pico.hora ? 0.95 : 0.6}
              >
                <title>{`${String(h.hora).padStart(2, '0')}h: ${h.total}`}</title>
              </rect>
              {h.hora % 3 === 0 && (
                <text x={xb + bw / 2} y={H - 10} textAnchor="middle" fontSize="10.5" fill="var(--texto-suave)">
                  {String(h.hora).padStart(2, '0')}h
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <p className="subtitulo" style={{ margin: '8px 0 0' }}>
        Horário (BRT) do último acesso de cada usuário — padrão aproximado de uso.
      </p>
    </div>
  );
}
