import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { BotoesCompartilhar } from './BotoesCompartilhar';
import { buscarAnuncioPublico, MercadoDetalhe, metadataAnuncio } from './MercadoPublico';

/**
 * Página PÚBLICA de uma notícia, servida no subdomínio
 * `noticias.carteiracac.com/<titulo-escapado>-<id>` (o id é o trecho após o
 * último hífen; o resto é cosmético, como nas competições). Server component
 * para gerar OpenGraph (preview de link no WhatsApp/redes) + CTA de download.
 *
 * Tem ar de "portal": cabeçalho, coluna lateral com outras notícias, barra de
 * compartilhamento e rodapé. Só responde no host `noticias.*` — em outros hosts
 * (backoffice, subdomínios de entidade) este catch-all de raiz não captura nada.
 * E só serve notícias PUBLICADAS: o endpoint do servidor filtra por status.
 */

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333';
const SITE = 'https://noticias.carteiracac.com';
const DOWNLOAD = 'https://www.carteiracac.com/download';

interface Noticia {
  id: string;
  titulo: string;
  resumo: string | null;
  conteudo: string;
  imagemUrl: string | null;
  publicadaEm: string | null;
  entidadeNome: string | null;
}

interface NoticiaResumo {
  id: string;
  titulo: string;
  resumo: string | null;
  imagemUrl: string | null;
  publicadaEm: string | null;
  entidadeNome: string | null;
}

/** O id é o trecho após o último hífen (cuid não tem hífen); o resto é slug. */
function idDoSlug(slugId: string): string {
  const i = slugId.lastIndexOf('-');
  return i >= 0 ? slugId.slice(i + 1) : slugId;
}

/** Slug cosmético para montar os links das notícias relacionadas. */
function slugDe(titulo: string): string {
  return titulo
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70);
}

function caminhoNoticia(n: { id: string; titulo: string }): string {
  const slug = slugDe(n.titulo);
  return `/${slug ? `${slug}-${n.id}` : n.id}`;
}

async function noHostDeNoticias(): Promise<boolean> {
  const host = (await headers()).get('host') ?? '';
  return host.startsWith('noticias.');
}

async function noHostDeMercado(): Promise<boolean> {
  const host = (await headers()).get('host') ?? '';
  return host.startsWith('mercado.');
}

async function buscar(id: string): Promise<Noticia | null> {
  try {
    // O endpoint serve apenas status PUBLICADA — rascunho responde 404.
    const r = await fetch(`${BASE}/api/publico/noticias/${encodeURIComponent(id)}`, {
      next: { revalidate: 300 },
    });
    if (!r.ok) return null;
    const j = (await r.json()) as { noticia: Noticia };
    return j.noticia ?? null;
  } catch {
    return null;
  }
}

async function buscarOutras(excluir: string): Promise<NoticiaResumo[]> {
  try {
    const r = await fetch(
      `${BASE}/api/publico/noticias?excluir=${encodeURIComponent(excluir)}&limite=8`,
      { next: { revalidate: 300 } }
    );
    if (!r.ok) return [];
    const j = (await r.json()) as { noticias: NoticiaResumo[] };
    return j.noticias ?? [];
  } catch {
    return [];
  }
}

function dataBR(iso: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return '';
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slugId: string }>;
}): Promise<Metadata> {
  if (await noHostDeMercado()) {
    const { slugId } = await params;
    const a = await buscarAnuncioPublico(idDoSlug(slugId));
    return metadataAnuncio(a, slugId);
  }
  if (!(await noHostDeNoticias())) return {};
  const { slugId } = await params;
  const n = await buscar(idDoSlug(slugId));
  if (!n) return { title: 'Notícia — Carteira CAC' };
  const descricao = n.resumo ?? 'Confira esta notícia no Carteira CAC.';
  const url = `${SITE}/${slugId}`;
  const imagens = n.imagemUrl ? [{ url: n.imagemUrl, alt: n.titulo }] : undefined;
  return {
    metadataBase: new URL(SITE),
    title: `${n.titulo} — Carteira CAC`,
    description: descricao,
    alternates: { canonical: url },
    openGraph: {
      type: 'article',
      locale: 'pt_BR',
      title: n.titulo,
      description: descricao,
      url,
      siteName: 'Carteira CAC',
      images: imagens,
      publishedTime: n.publicadaEm ?? undefined,
      authors: n.entidadeNome ? [n.entidadeNome] : ['Carteira CAC'],
    },
    twitter: {
      card: n.imagemUrl ? 'summary_large_image' : 'summary',
      title: n.titulo,
      description: descricao,
      images: n.imagemUrl ? [n.imagemUrl] : undefined,
    },
  };
}

export default async function PaginaNoticiaPublica({
  params,
}: {
  params: Promise<{ slugId: string }>;
}) {
  // Mercado de acessórios: detalhe público do anúncio (host mercado.*).
  if (await noHostDeMercado()) {
    const { slugId } = await params;
    const a = await buscarAnuncioPublico(idDoSlug(slugId));
    if (!a) notFound();
    return <MercadoDetalhe anuncio={a} />;
  }

  // Fora dos subdomínios de notícias/mercado este catch-all não serve nada
  // (preserva o backoffice e os subdomínios de entidade).
  if (!(await noHostDeNoticias())) notFound();

  const { slugId } = await params;
  const n = await buscar(idDoSlug(slugId));
  if (!n) notFound();

  const outras = await buscarOutras(n.id);
  const urlAtual = `${SITE}/${slugId}`;

  return (
    <div className="np">
      <header className="np-topo">
        <div className="np-topo-in">
          <a className="np-marca" href={DOWNLOAD}>
            <img src="/logo.png" alt="" />
            <span>Carteira<b>CAC</b></span>
          </a>
          <span className="np-editoria">Portal de Notícias</span>
          <a className="np-topo-cta" href={DOWNLOAD}>Baixar o app</a>
        </div>
      </header>

      <div className="np-grade">
        <main className="np-main">
          <article className="np-art">
            {n.entidadeNome ? <div className="np-selo">★ {n.entidadeNome}</div> : null}
            <h1 className="np-tit">{n.titulo}</h1>
            {n.publicadaEm ? <div className="np-data">{dataBR(n.publicadaEm)}</div> : null}

            <BotoesCompartilhar url={urlAtual} titulo={n.titulo} />

            {n.imagemUrl ? <img className="np-capa" src={n.imagemUrl} alt={n.titulo} /> : null}
            {n.resumo ? <p className="np-resumo">{n.resumo}</p> : null}
            <div className="np-corpo" dangerouslySetInnerHTML={{ __html: n.conteudo }} />

            <div className="np-share-fim">
              <BotoesCompartilhar url={urlAtual} titulo={n.titulo} />
            </div>
          </article>

          <aside className="np-cta">
            <h2 className="np-cta-tit">Baixe o app Carteira CAC</h2>
            <p className="np-cta-txt">
              Organize seu CR, CRAFs, guias de tráfego e habitualidade — tudo na palma da mão,
              de graça.
            </p>
            <a className="np-cta-btn" href={DOWNLOAD}>Baixar agora</a>
            <div className="np-cta-url">www.carteiracac.com/download</div>
          </aside>
        </main>

        <aside className="np-lateral">
          <h2 className="np-lat-tit">Mais notícias</h2>
          {outras.length === 0 ? (
            <p className="np-lat-vazio">Nenhuma outra notícia por aqui ainda.</p>
          ) : (
            <ul className="np-lat-lista">
              {outras.map((o) => (
                <li key={o.id}>
                  <a className="np-lat-item" href={caminhoNoticia(o)}>
                    {o.imagemUrl ? (
                      <img className="np-lat-thumb" src={o.imagemUrl} alt="" />
                    ) : (
                      <span className="np-lat-thumb np-lat-thumb-vazia" aria-hidden>CAC</span>
                    )}
                    <span className="np-lat-txt">
                      <span className="np-lat-item-tit">{o.titulo}</span>
                      {o.publicadaEm ? (
                        <span className="np-lat-item-data">{dataBR(o.publicadaEm)}</span>
                      ) : null}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>

      <footer className="np-rodape">
        <div className="np-rodape-in">
          <span>© Carteira CAC</span>
          <a href={DOWNLOAD}>Baixar o app</a>
        </div>
      </footer>

      <style>{`
        /* Portal de notícias usa tema CLARO (o backoffice é escuro); redefine
           as variáveis de cor só dentro de .np, sem afetar o resto do app. */
        .np {
          --fundo: #F7F8F4;
          --superficie: #FFFFFF;
          --superficie-2: #EFF1EA;
          --borda: #E3E7DD;
          --borda-forte: #CED5C3;
          --texto: #1A1E16;
          --texto-suave: #5B6253;
          --acento: #4F6B2E;
          --acento-forte: #3C5420;
          --sobre-acento: #FFFFFF;
          --latao: #94760F;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          background: var(--fundo);
          color: var(--texto);
        }
        .np-topo { border-bottom: 1px solid var(--borda); background: var(--superficie); position: sticky; top: 0; z-index: 10; }
        .np-topo-in { max-width: 1080px; margin: 0 auto; padding: 12px 18px; display: flex; align-items: center; gap: 14px; }
        .np-marca { display: inline-flex; align-items: center; gap: 10px; font-weight: 700; font-size: 18px; }
        .np-marca img { width: 32px; height: 32px; border-radius: 8px; }
        .np-marca b { color: var(--latao); font-weight: 800; }
        .np-editoria { color: var(--texto-suave); font-size: 13px; border-left: 1px solid var(--borda-forte); padding-left: 14px; }
        .np-topo-cta { margin-left: auto; background: var(--acento); color: var(--sobre-acento); font-weight: 700; font-size: 13px; padding: 8px 16px; border-radius: 9px; }
        .np-topo-cta:hover { filter: brightness(1.06); }

        .np-grade { flex: 1; width: 100%; max-width: 1080px; margin: 0 auto; padding: 28px 18px 48px; display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: 36px; align-items: start; }
        .np-main { min-width: 0; }

        .np-selo { display: inline-block; font-size: 12px; font-weight: 700; color: var(--latao); margin-bottom: 10px; }
        .np-tit { font-size: 34px; line-height: 1.15; margin: 0 0 12px; letter-spacing: -0.01em; }
        .np-data { color: var(--texto-suave); font-size: 13px; margin-bottom: 16px; }
        .np-capa { width: 100%; max-height: 420px; object-fit: cover; border-radius: 14px; margin: 18px 0 22px; }
        .np-resumo { font-size: 19px; color: var(--texto-suave); line-height: 1.5; margin: 0 0 22px; font-weight: 500; border-left: 3px solid var(--acento); padding-left: 16px; }
        .np-corpo { font-size: 17px; line-height: 1.7; }
        .np-corpo p { margin: 0 0 1.1em; }
        .np-corpo img { max-width: 100%; height: auto; border-radius: 10px; }
        .np-corpo a { color: var(--acento-forte); text-decoration: underline; }
        .np-corpo h2, .np-corpo h3 { line-height: 1.25; margin: 1.5em 0 .5em; }
        .np-corpo blockquote { border-left: 3px solid var(--borda-forte); margin: 1em 0; padding: 2px 0 2px 16px; color: var(--texto-suave); }
        .np-corpo iframe { max-width: 100%; border: 0; border-radius: 10px; aspect-ratio: 16 / 9; width: 100%; }

        .np-share { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; padding: 14px 0; border-top: 1px solid var(--borda); border-bottom: 1px solid var(--borda); }
        .np-share-rot { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: var(--texto-suave); }
        .np-share-botoes { display: flex; flex-wrap: wrap; gap: 8px; }
        .np-share-btn { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; padding: 7px 14px; border-radius: 999px; border: 1px solid var(--borda-forte); background: var(--superficie-2); color: var(--texto); cursor: pointer; transition: all .15s; }
        .np-share-btn:hover { border-color: var(--cor, var(--acento)); color: #fff; background: var(--cor, var(--acento)); }
        .np-share-copiar:hover, .np-share-nativo:hover { background: var(--acento); border-color: var(--acento); color: var(--sobre-acento); }
        .np-share-fim { margin-top: 36px; }

        .np-cta { margin-top: 40px; padding: 26px; border: 1px solid var(--borda); border-radius: 14px; background: var(--superficie); text-align: center; }
        .np-cta-tit { font-size: 21px; margin: 0 0 8px; }
        .np-cta-txt { color: var(--texto-suave); font-size: 14px; margin: 0 0 18px; line-height: 1.5; }
        .np-cta-btn { display: inline-block; background: var(--acento); color: var(--sobre-acento); font-weight: 700; padding: 12px 26px; border-radius: 10px; }
        .np-cta-btn:hover { filter: brightness(1.06); }
        .np-cta-url { margin-top: 10px; font-size: 12px; color: var(--texto-suave); }

        .np-lateral { position: sticky; top: 84px; }
        .np-lat-tit { font-size: 15px; text-transform: uppercase; letter-spacing: .04em; color: var(--texto); margin: 0 0 14px; padding-bottom: 10px; border-bottom: 2px solid var(--latao); }
        .np-lat-vazio { color: var(--texto-suave); font-size: 14px; }
        .np-lat-lista { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px; }
        .np-lat-item { display: flex; gap: 12px; padding: 10px 8px; border-radius: 10px; align-items: center; transition: background .15s; }
        .np-lat-item:hover { background: var(--superficie); }
        .np-lat-thumb { width: 64px; height: 64px; border-radius: 9px; object-fit: cover; flex-shrink: 0; }
        .np-lat-thumb-vazia { display: flex; align-items: center; justify-content: center; background: var(--superficie-2); color: var(--latao); font-weight: 800; font-size: 13px; letter-spacing: .05em; }
        .np-lat-txt { min-width: 0; }
        .np-lat-item-tit { display: block; font-size: 14px; font-weight: 600; line-height: 1.3; color: var(--texto); display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
        .np-lat-item-data { display: block; margin-top: 4px; font-size: 12px; color: var(--texto-suave); }

        .np-rodape { border-top: 1px solid var(--borda); background: var(--superficie); }
        .np-rodape-in { max-width: 1080px; margin: 0 auto; padding: 18px; display: flex; justify-content: space-between; align-items: center; color: var(--texto-suave); font-size: 13px; }

        @media (max-width: 880px) {
          .np-grade { grid-template-columns: 1fr; gap: 10px; }
          .np-lateral { position: static; margin-top: 36px; padding-top: 24px; border-top: 1px solid var(--borda); }
          .np-tit { font-size: 27px; }
          .np-editoria { display: none; }
        }
      `}</style>
    </div>
  );
}
