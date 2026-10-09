'use client';

import { useEffect, useState } from 'react';

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
  entidadeSubdominio: string | null;
  categorias: Categoria[];
}

function dataBR(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

const MEDALHA: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

/**
 * Ranking público de uma competição. Serve tanto a rota legada
 * `/competicao/[id]` quanto a bonita `/competicoes/[slug-id]` por subdomínio.
 *
 * `subdominioEsperado`: quando a página é aberta num subdomínio de entidade
 * (ex.: 3gun.carteiracac.com), exige que a competição seja daquela entidade —
 * evita que `3gun.carteiracac.com/...` mostre o ranking de outra entidade.
 */
export function RankingPublico({
  id,
  subdominioEsperado,
}: {
  id: string;
  subdominioEsperado?: string | null;
}) {
  const [comp, setComp] = useState<Competicao | null>(null);
  const [erro, setErro] = useState('');
  const [promo, setPromo] = useState(false);

  const fecharPromo = () => {
    setPromo(false);
    try {
      sessionStorage.setItem('cac_promo_download', '1');
    } catch {
      // sessionStorage indisponível (modo privado): tudo bem, só não lembra.
    }
  };

  // Abre a propaganda 2s DEPOIS que o ranking renderizou — não concorre com o
  // conteúdo e aparece uma vez por sessão, para não incomodar quem volta.
  useEffect(() => {
    if (!comp) return;
    try {
      if (sessionStorage.getItem('cac_promo_download')) return;
    } catch {
      // ignora e mostra mesmo assim
    }
    const t = setTimeout(() => setPromo(true), 2000);
    return () => clearTimeout(t);
  }, [comp]);

  // Esc fecha a propaganda.
  useEffect(() => {
    if (!promo) return;
    const aoTecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') fecharPromo();
    };
    window.addEventListener('keydown', aoTecla);
    return () => window.removeEventListener('keydown', aoTecla);
  }, [promo]);

  useEffect(() => {
    let vivo = true;
    fetch(`${BASE}/api/publico/competicoes/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error('nao encontrada');
        return r.json();
      })
      .then((d) => {
        if (!vivo) return;
        const c = d.competicao as Competicao;
        // Scoping por subdomínio: a competição precisa ser da entidade do host.
        if (subdominioEsperado && c.entidadeSubdominio && c.entidadeSubdominio !== subdominioEsperado) {
          setErro('Competição não encontrada.');
          return;
        }
        setComp(c);
      })
      .catch(() => vivo && setErro('Competição não encontrada.'));
    return () => {
      vivo = false;
    };
  }, [id, subdominioEsperado]);

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

      {promo ? (
        <div
          className="cac-promo-bg"
          role="dialog"
          aria-modal="true"
          aria-label="Baixe o Carteira CAC"
          onClick={fecharPromo}
        >
          <div className="cac-promo" onClick={(e) => e.stopPropagation()}>
            <button className="cac-promo-x" onClick={fecharPromo} aria-label="Fechar">
              ×
            </button>
            <div className="cac-promo-qr" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 37 37" shapeRendering="crispEdges" width="150" height="150">
                <path fill="#ffffff" d="M0 0h37v37H0z" />
                <path stroke="#000000" d="M4 4.5h7m6 0h1m1 0h1m2 0h3m1 0h7M4 5.5h1m5 0h1m2 0h1m1 0h1m1 0h3m1 0h2m1 0h1m1 0h1m5 0h1M4 6.5h1m1 0h3m1 0h1m1 0h1m1 0h2m1 0h1m1 0h2m5 0h1m1 0h3m1 0h1M4 7.5h1m1 0h3m1 0h1m1 0h3m1 0h1m1 0h2m1 0h2m3 0h1m1 0h3m1 0h1M4 8.5h1m1 0h3m1 0h1m1 0h2m2 0h1m3 0h5m1 0h1m1 0h3m1 0h1M4 9.5h1m5 0h1m1 0h1m1 0h1m4 0h3m2 0h1m1 0h1m5 0h1M4 10.5h7m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h7M12 11.5h5m1 0h2m2 0h2M4 12.5h1m1 0h5m5 0h1m2 0h1m1 0h1m4 0h5M4 13.5h1m1 0h4m2 0h3m2 0h2m1 0h1m1 0h7m3 0h1M4 14.5h1m1 0h1m1 0h1m1 0h4m2 0h7m1 0h2M5 15.5h1m2 0h1m2 0h1m2 0h2m1 0h1m2 0h1m5 0h2m1 0h1m1 0h1M8 16.5h3m1 0h2m1 0h2m1 0h1m2 0h1m7 0h2M4 17.5h1m1 0h2m1 0h1m1 0h1m4 0h1m3 0h7m1 0h1m3 0h1M5 18.5h1m1 0h2m1 0h2m7 0h1m1 0h1m3 0h1m1 0h1m1 0h2M4 19.5h3m1 0h1m2 0h1m2 0h1m3 0h3m2 0h1m3 0h2m2 0h1M4 20.5h1m1 0h1m1 0h1m1 0h1m2 0h4m4 0h1m2 0h1m2 0h1m1 0h2M4 21.5h2m3 0h1m2 0h1m2 0h4m1 0h5m1 0h3m1 0h1m1 0h1M4 22.5h1m1 0h3m1 0h1m4 0h5m4 0h2m1 0h1m2 0h1M4 23.5h1m2 0h2m2 0h2m4 0h1m2 0h1m4 0h4m2 0h1M4 24.5h1m1 0h2m2 0h4m2 0h1m1 0h1m2 0h8m1 0h3M12 25.5h2m6 0h3m1 0h1m3 0h5M4 26.5h7m2 0h3m3 0h3m1 0h2m1 0h1m1 0h3M4 27.5h1m5 0h1m1 0h1m3 0h1m1 0h1m1 0h1m2 0h2m3 0h1m2 0h1M4 28.5h1m1 0h3m1 0h1m1 0h1m1 0h1m4 0h3m2 0h5m1 0h1M4 29.5h1m1 0h3m1 0h1m1 0h3m2 0h2m1 0h1m1 0h2m3 0h1m1 0h4M4 30.5h1m1 0h3m1 0h1m1 0h2m1 0h2m2 0h2m2 0h1m2 0h6M4 31.5h1m5 0h1m5 0h3m1 0h1m1 0h1m1 0h1m2 0h1m1 0h1m1 0h1M4 32.5h7m1 0h5m1 0h1m2 0h1m1 0h1m1 0h1m1 0h4" />
              </svg>
            </div>
            <h3 className="cac-promo-tit">Baixe o Carteira CAC de graça</h3>
            <p className="cac-promo-txt">
              Tenha toda a sua documentação de CAC — CR, CRAFs, guias de tráfego e habitualidade —
              segura e sempre no bolso. Aponte a câmera para o QR code.
            </p>
            <a
              className="cac-promo-btn"
              href="https://www.carteiracac.com/download"
              target="_blank"
              rel="noopener noreferrer"
              onClick={fecharPromo}
            >
              Baixar agora
            </a>
            <div className="cac-promo-url">www.carteiracac.com/download</div>
          </div>
        </div>
      ) : null}
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

/* Propaganda do app — overlay dispensável, não interfere no ranking atrás. */
.cac-promo-bg {
  position: fixed; inset: 0; z-index: 1000;
  display: flex; align-items: center; justify-content: center;
  padding: 20px;
  background: rgba(0, 0, 0, 0.55);
  animation: cac-fade 0.2s ease-out;
}
.cac-promo {
  position: relative;
  width: 100%; max-width: 360px;
  background: var(--superficie); color: var(--texto, inherit);
  border: 1px solid var(--borda); border-radius: 18px;
  padding: 26px 22px 22px; text-align: center;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.35);
  animation: cac-pop 0.22s cubic-bezier(0.2, 0.8, 0.2, 1);
}
.cac-promo-x {
  position: absolute; top: 8px; right: 10px;
  width: 32px; height: 32px; border: 0; border-radius: 50%;
  background: transparent; color: var(--texto-suave);
  font-size: 24px; line-height: 1; cursor: pointer;
}
.cac-promo-x:hover { background: color-mix(in srgb, var(--texto-suave) 15%, transparent); }
.cac-promo-qr {
  width: 172px; height: 172px; margin: 4px auto 16px;
  background: #fff; border-radius: 12px; padding: 11px;
  display: flex; align-items: center; justify-content: center;
}
.cac-promo-qr svg { width: 100%; height: 100%; display: block; }
.cac-promo-tit { font-size: 19px; margin: 0 0 8px; line-height: 1.25; }
.cac-promo-txt { font-size: 14px; color: var(--texto-suave); margin: 0 0 18px; line-height: 1.45; }
.cac-promo-btn {
  display: block; width: 100%;
  background: var(--acento); color: #fff;
  font-weight: 700; font-size: 15px; text-decoration: none;
  padding: 13px 16px; border-radius: 11px;
}
.cac-promo-btn:hover { filter: brightness(1.06); }
.cac-promo-url { margin-top: 10px; font-size: 12px; color: var(--texto-suave); }
@keyframes cac-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes cac-pop { from { opacity: 0; transform: translateY(10px) scale(0.97); } to { opacity: 1; transform: none; } }
@media (prefers-reduced-motion: reduce) {
  .cac-promo-bg, .cac-promo { animation: none; }
}
`;
