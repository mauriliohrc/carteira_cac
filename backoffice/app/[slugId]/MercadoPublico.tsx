import type { Metadata } from 'next';

/**
 * Detalhe PÚBLICO de um anúncio do marketplace, servido em
 * `mercado.carteiracac.com/<titulo>-<id>`. Server component para gerar OpenGraph
 * (preview no WhatsApp) + CTA de download. NUNCA expõe contato do vendedor:
 * qualquer interesse/compra leva o visitante a baixar o app.
 */

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333';
const SITE = 'https://mercado.carteiracac.com';
const DOWNLOAD = 'https://www.carteiracac.com/download';

export interface AnuncioPublico {
  id: string;
  categoria: string;
  subcategoria: string | null;
  estadoUso: string;
  precoCentavos: number | null;
  uf: string;
  cidade: string;
  titulo: string;
  descricao: string;
  destacado: boolean;
  vendedor: { primeiroNome: string } | null;
  loja: { id: string; nome: string; verificada: boolean; logoUrl: string | null } | null;
  fotos: string[];
}

export async function buscarAnuncioPublico(id: string): Promise<AnuncioPublico | null> {
  try {
    const r = await fetch(`${BASE}/api/publico/marketplace/${encodeURIComponent(id)}`, {
      next: { revalidate: 120 },
    });
    if (!r.ok) return null;
    const j = (await r.json()) as { anuncio: AnuncioPublico };
    return j.anuncio ?? null;
  } catch {
    return null;
  }
}

function preco(centavos: number | null): string {
  if (centavos == null) return 'A combinar';
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function metadataAnuncio(a: AnuncioPublico | null, slugId: string): Metadata {
  if (!a) return { title: 'Anúncio — Carteira CAC' };
  const descricao = `${preco(a.precoCentavos)} · ${a.cidade}/${a.uf} — ${a.descricao}`.slice(0, 180);
  const url = `${SITE}/${slugId}`;
  const imagens = a.fotos[0] ? [{ url: a.fotos[0], alt: a.titulo }] : undefined;
  return {
    metadataBase: new URL(SITE),
    title: `${a.titulo} — Mercado Carteira CAC`,
    description: descricao,
    alternates: { canonical: url },
    openGraph: {
      type: 'website',
      locale: 'pt_BR',
      title: a.titulo,
      description: descricao,
      url,
      siteName: 'Mercado Carteira CAC',
      images: imagens,
    },
    twitter: {
      card: a.fotos[0] ? 'summary_large_image' : 'summary',
      title: a.titulo,
      description: descricao,
      images: a.fotos[0] ? [a.fotos[0]] : undefined,
    },
  };
}

export function MercadoDetalhe({ anuncio: a }: { anuncio: AnuncioPublico }) {
  return (
    <div className="mp">
      <header className="mp-topo">
        <div className="mp-topo-in">
          <a className="mp-marca" href={DOWNLOAD}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="" />
            <span>
              Carteira<b>CAC</b>
            </span>
          </a>
          <span className="mp-editoria">Mercado de acessórios</span>
          <a className="mp-topo-cta" href={DOWNLOAD}>
            Baixar o app
          </a>
        </div>
      </header>

      <div className="mp-grade">
        <div className="mp-fotos">
          {a.fotos.length ? (
            a.fotos.map((f) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={f} className="mp-foto" src={f} alt={a.titulo} />
            ))
          ) : (
            <div className="mp-foto mp-foto-vazia">sem foto</div>
          )}
        </div>

        <aside className="mp-info">
          {a.destacado ? <div className="mp-destaque">★ Destaque</div> : null}
          <div className="mp-preco">{preco(a.precoCentavos)}</div>
          <h1 className="mp-tit">{a.titulo}</h1>
          <div className="mp-meta">
            {a.categoria}
            {a.subcategoria ? ` · ${a.subcategoria}` : ''} · {a.estadoUso}
          </div>
          <div className="mp-meta">
            {a.cidade}/{a.uf}
          </div>

          {a.loja ? (
            <div className="mp-loja">
              {a.loja.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.loja.logoUrl} alt="" />
              ) : null}
              <span>
                {a.loja.nome} {a.loja.verificada ? '✓' : ''}
              </span>
            </div>
          ) : a.vendedor ? (
            <div className="mp-vend">Anunciante: {a.vendedor.primeiroNome}</div>
          ) : null}

          <p className="mp-desc">{a.descricao}</p>

          {/* Toda ação de interesse/compra leva ao app — sem chat/contato na web. */}
          <a className="mp-cta" href={DOWNLOAD}>
            Tenho interesse — abrir no app
          </a>
          <a className="mp-cta mp-cta-2" href={DOWNLOAD}>
            Comprar / falar com o vendedor
          </a>
          <div className="mp-nota">
            O contato acontece com segurança dentro do app Carteira CAC. Baixe grátis para conversar
            com o anunciante.
          </div>
        </aside>
      </div>

      <footer className="mp-rodape">
        <div className="mp-rodape-in">
          <span>© Carteira CAC · Mercado de acessórios</span>
          <a href={DOWNLOAD}>Baixar o app</a>
        </div>
      </footer>

      <style>{`
        .mp { --fundo:#F7F8F4; --superficie:#FFFFFF; --superficie-2:#EFF1EA; --borda:#E3E7DD;
          --borda-forte:#CED5C3; --texto:#1A1E16; --texto-suave:#5B6253; --acento:#4F6B2E;
          --acento-forte:#3C5420; --sobre-acento:#FFF; --latao:#94760F;
          min-height:100vh; display:flex; flex-direction:column; background:var(--fundo); color:var(--texto); }
        .mp-topo { border-bottom:1px solid var(--borda); background:var(--superficie); position:sticky; top:0; z-index:10; }
        .mp-topo-in { max-width:1080px; margin:0 auto; padding:12px 18px; display:flex; align-items:center; gap:14px; }
        .mp-marca { display:inline-flex; align-items:center; gap:10px; font-weight:700; font-size:18px; }
        .mp-marca img { width:32px; height:32px; border-radius:8px; }
        .mp-marca b { color:var(--latao); font-weight:800; }
        .mp-editoria { color:var(--texto-suave); font-size:13px; border-left:1px solid var(--borda-forte); padding-left:14px; }
        .mp-topo-cta { margin-left:auto; background:var(--acento); color:var(--sobre-acento); font-weight:700; font-size:13px; padding:8px 16px; border-radius:9px; }

        .mp-grade { flex:1; width:100%; max-width:1080px; margin:0 auto; padding:28px 18px 48px; display:grid; grid-template-columns:minmax(0,1fr) 360px; gap:32px; align-items:start; }
        .mp-fotos { display:flex; flex-direction:column; gap:12px; min-width:0; }
        .mp-foto { width:100%; border-radius:14px; object-fit:cover; max-height:520px; background:var(--superficie-2); }
        .mp-foto-vazia { height:300px; display:flex; align-items:center; justify-content:center; color:var(--texto-suave); }

        .mp-info { position:sticky; top:84px; background:var(--superficie); border:1px solid var(--borda); border-radius:14px; padding:22px; }
        .mp-destaque { display:inline-block; font-size:12px; font-weight:800; color:var(--latao); margin-bottom:8px; }
        .mp-preco { font-size:30px; font-weight:800; letter-spacing:-0.01em; }
        .mp-tit { font-size:21px; margin:6px 0 10px; line-height:1.25; }
        .mp-meta { color:var(--texto-suave); font-size:13.5px; margin-bottom:4px; }
        .mp-loja { display:flex; align-items:center; gap:8px; margin:14px 0; font-weight:700; }
        .mp-loja img { width:34px; height:34px; border-radius:8px; object-fit:cover; }
        .mp-vend { margin:14px 0; color:var(--texto-suave); font-size:14px; }
        .mp-desc { font-size:15px; line-height:1.6; color:var(--texto); margin:16px 0 22px; white-space:pre-wrap; }
        .mp-cta { display:block; text-align:center; background:var(--acento); color:var(--sobre-acento); font-weight:700; padding:13px; border-radius:11px; margin-bottom:10px; }
        .mp-cta:hover { filter:brightness(1.06); }
        .mp-cta-2 { background:var(--superficie-2); color:var(--acento-forte); border:1px solid var(--borda-forte); }
        .mp-nota { font-size:12.5px; color:var(--texto-suave); line-height:1.5; margin-top:6px; }

        .mp-rodape { border-top:1px solid var(--borda); background:var(--superficie); }
        .mp-rodape-in { max-width:1080px; margin:0 auto; padding:18px; display:flex; justify-content:space-between; align-items:center; color:var(--texto-suave); font-size:13px; }

        @media (max-width:880px) {
          .mp-grade { grid-template-columns:1fr; gap:18px; }
          .mp-info { position:static; }
        }
      `}</style>
    </div>
  );
}
