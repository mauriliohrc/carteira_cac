'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333';

interface LinhaTop {
  posicao: number;
  nome: string;
  pontuacao: number;
}
interface Categoria {
  id: string;
  nome: string;
  descricao: string | null;
  ordenamento: string;
  totalParticipantes: number;
  top: LinhaTop[];
}
interface Competicao {
  id: string;
  nome: string;
  descricao: string | null;
  bannerUrl: string | null;
  dataInicio: string;
  dataFim: string;
  entidadeNome: string;
  categorias: Categoria[];
}

function dataBR(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

const MEDALHA: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

export default function PaginaPublicaCompeticao() {
  const { id } = useParams<{ id: string }>();
  const [comp, setComp] = useState<Competicao | null>(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    let vivo = true;
    fetch(`${BASE}/api/publico/competicoes/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error('nao encontrada');
        return r.json();
      })
      .then((d) => vivo && setComp(d.competicao))
      .catch(() => vivo && setErro('Competição não encontrada.'));
    return () => {
      vivo = false;
    };
  }, [id]);

  if (erro) return <div className="pub-wrap"><div className="pub-vazio">{erro}</div></div>;
  if (!comp) return <div className="pub-wrap"><div className="pub-vazio">Carregando…</div></div>;

  return (
    <div className="pub-wrap">
      <style>{CSS}</style>
      <header className="pub-head">
        {comp.bannerUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="pub-banner" src={comp.bannerUrl} alt={comp.nome} />
        ) : null}
        <div className="pub-selo">{comp.entidadeNome}</div>
        <h1 className="pub-titulo">{comp.nome}</h1>
        <div className="pub-periodo">
          {dataBR(comp.dataInicio)} – {dataBR(comp.dataFim)}
        </div>
        {comp.descricao ? <p className="pub-desc">{comp.descricao}</p> : null}
      </header>

      {comp.categorias.length === 0 ? (
        <div className="pub-vazio">Esta competição ainda não tem categorias.</div>
      ) : (
        comp.categorias.map((cat) => (
          <section className="pub-cat" key={cat.id}>
            <div className="pub-cat-cabeca">
              <h2>{cat.nome}</h2>
              <span className="pub-cat-sub">
                {cat.totalParticipantes} participante{cat.totalParticipantes === 1 ? '' : 's'} ·{' '}
                {cat.ordenamento === 'MENOR' ? 'menor pontuação vence' : 'maior pontuação vence'}
              </span>
            </div>
            {cat.top.length === 0 ? (
              <p className="pub-cat-vazio">Sem resultados lançados ainda.</p>
            ) : (
              <ol className="pub-rank">
                {cat.top.map((l) => (
                  <li key={`${l.posicao}-${l.nome}`} className={l.posicao <= 3 ? 'pub-podio' : ''}>
                    <span className="pub-pos">{MEDALHA[l.posicao] ?? `${l.posicao}º`}</span>
                    <span className="pub-nome">{l.nome}</span>
                    <span className="pub-pts">{l.pontuacao}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        ))
      )}

      <footer className="pub-rodape">
        Ranking Top 10 · <strong>Carteira CAC</strong>
      </footer>
    </div>
  );
}

const CSS = `
.pub-wrap { max-width: 720px; margin: 0 auto; padding: 24px 16px 60px; }
.pub-head { text-align: center; margin-bottom: 24px; }
.pub-banner { width: 100%; max-height: 260px; object-fit: cover; border-radius: 14px; margin-bottom: 16px; }
.pub-selo { font-size: 12px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: var(--acento); }
.pub-titulo { font-size: 28px; margin: 6px 0; }
.pub-periodo { color: var(--texto-suave); font-size: 14px; }
.pub-desc { color: var(--texto-suave); margin-top: 12px; }
.pub-cat { background: var(--superficie); border: 1px solid var(--borda); border-radius: 14px; padding: 18px 18px 8px; margin-bottom: 18px; }
.pub-cat-cabeca { margin-bottom: 10px; }
.pub-cat-cabeca h2 { font-size: 18px; margin: 0; }
.pub-cat-sub { color: var(--texto-suave); font-size: 13px; }
.pub-cat-vazio { color: var(--texto-suave); padding: 8px 0 14px; }
.pub-rank { list-style: none; margin: 0; padding: 0; }
.pub-rank li { display: flex; align-items: center; gap: 12px; padding: 11px 10px; border-radius: 10px; }
.pub-rank li + li { border-top: 1px solid var(--borda); }
.pub-rank li.pub-podio { background: color-mix(in srgb, var(--acento) 7%, transparent); }
.pub-pos { width: 34px; text-align: center; font-weight: 800; font-variant-numeric: tabular-nums; }
.pub-nome { flex: 1; font-weight: 600; }
.pub-pts { font-variant-numeric: tabular-nums; font-weight: 700; font-size: 18px; }
.pub-vazio { text-align: center; color: var(--texto-suave); padding: 60px 0; }
.pub-rodape { text-align: center; color: var(--texto-suave); font-size: 13px; margin-top: 30px; }
`;
