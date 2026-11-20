'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface PassoFunil {
  passo: string;
  entraram: number;
  pularam: number;
}

interface Funil {
  dias: number;
  iniciaram: number;
  passos: PassoFunil[];
  docSubiram: number;
  concluiram: number;
  liga: { vista: number; filiou: number; mensal: number; recusou: number };
}

const PERIODOS = [
  { dias: 7, rotulo: '7 dias' },
  { dias: 14, rotulo: '14 dias' },
  { dias: 30, rotulo: '30 dias' },
  { dias: 90, rotulo: '90 dias' },
];

const ROTULO_PASSO: Record<string, string> = {
  conta: 'Criar conta',
  validar: 'Confirmar e-mail',
  cr: 'Enviar CR/Posse/Porte',
  craf: 'Enviar CRAF (arma)',
  liga: 'Apresentação da liga',
};

function pct(parte: number, base: number): number {
  if (!base) return 0;
  return Math.round((parte / base) * 100);
}

/** Jornadas: funil de onboarding + conversão da liga (antigo /metricas). */
export function SecaoJornadas() {
  const [dias, setDias] = useState(30);
  const [d, setD] = useState<Funil | null>(null);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const r = await api<Funil>(`/api/admin/metricas/funil?dias=${dias}`);
      setD(r);
    } finally {
      setCarregando(false);
    }
  }, [dias]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const base = d?.iniciaram ?? 0;

  return (
    <>
      <div className="cabeca-secao" style={{ marginTop: 8 }}>
        <div>
          <h2 style={{ margin: 0 }}>Jornadas</h2>
          <p className="subtitulo" style={{ margin: 0 }}>Funil de onboarding e conversão da liga (aparelhos distintos).</p>
        </div>
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

      {carregando && !d ? (
        <div className="vazio">Carregando…</div>
      ) : !d ? (
        <div className="vazio">Sem dados.</div>
      ) : (
        <>
          <div className="cabeca-secao" style={{ marginTop: 20 }}>
            <h2 style={{ margin: 0, fontSize: 18 }}>Funil de onboarding</h2>
          </div>
          <div className="cartao">
            {base === 0 ? (
              <p className="subtitulo" style={{ margin: 0 }}>
                Nenhum aparelho iniciou o onboarding neste período.
              </p>
            ) : (
              <>
                <Barra rotulo="Iniciaram o fluxo" valor={d.iniciaram} base={base} destaque />
                {d.passos.map((p) => (
                  <Barra
                    key={p.passo}
                    rotulo={ROTULO_PASSO[p.passo] ?? p.passo}
                    valor={p.entraram}
                    base={base}
                    nota={p.pularam ? `${p.pularam} pularam` : undefined}
                  />
                ))}
              </>
            )}
          </div>

          <div className="cabeca-secao" style={{ marginTop: 28 }}>
            <h2 style={{ margin: 0, fontSize: 18 }}>Ativação & conclusão</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 14 }}>
            <Tile titulo="Documento enviado" valor={d.docSubiram} sub={`${pct(d.docSubiram, base)}% de quem iniciou`} />
            <Tile titulo="Concluíram" valor={d.concluiram} sub={`${pct(d.concluiram, base)}% de quem iniciou`} />
          </div>

          <div className="cabeca-secao" style={{ marginTop: 28 }}>
            <h2 style={{ margin: 0, fontSize: 18 }}>Conversão da liga</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 14 }}>
            <Tile titulo="Viram a liga" valor={d.liga.vista} />
            <Tile titulo="Clicaram em filiar" valor={d.liga.filiou} sub={`${pct(d.liga.filiou, d.liga.vista)}% de quem viu`} />
            <Tile titulo="Foram p/ mensal" valor={d.liga.mensal} sub={`${pct(d.liga.mensal, d.liga.vista)}% de quem viu`} />
            <Tile titulo="Recusaram" valor={d.liga.recusou} sub={`${pct(d.liga.recusou, d.liga.vista)}% de quem viu`} />
          </div>
        </>
      )}
    </>
  );
}

function Barra({
  rotulo,
  valor,
  base,
  nota,
  destaque,
}: {
  rotulo: string;
  valor: number;
  base: number;
  nota?: string;
  destaque?: boolean;
}) {
  const p = pct(valor, base);
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
        <span style={{ fontWeight: destaque ? 700 : 500 }}>{rotulo}</span>
        <span className="subtitulo" style={{ margin: 0, fontSize: 13 }}>
          <strong style={{ color: 'var(--texto)' }}>{valor}</strong> · {p}%
          {nota ? <span style={{ marginLeft: 8, opacity: 0.7 }}>({nota})</span> : null}
        </span>
      </div>
      <div style={{ height: 10, borderRadius: 6, background: 'var(--borda)', overflow: 'hidden' }}>
        <div
          style={{
            width: `${p}%`,
            height: '100%',
            borderRadius: 6,
            background: destaque ? 'var(--acento)' : 'var(--acento-fraco, var(--acento))',
            opacity: destaque ? 1 : 0.75,
            transition: 'width .3s',
          }}
        />
      </div>
    </div>
  );
}

function Tile({ titulo, valor, sub }: { titulo: string; valor: number; sub?: string }) {
  return (
    <div className="cartao" style={{ margin: 0 }}>
      <div className="subtitulo" style={{ margin: 0 }}>{titulo}</div>
      <div style={{ fontSize: 28, fontWeight: 700, marginTop: 4 }}>{valor}</div>
      {sub ? <div className="subtitulo" style={{ margin: '4px 0 0', fontSize: 12.5 }}>{sub}</div> : null}
    </div>
  );
}
