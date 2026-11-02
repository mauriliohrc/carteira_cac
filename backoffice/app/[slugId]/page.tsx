import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';

/**
 * Página PÚBLICA de uma notícia, servida no subdomínio
 * `noticias.carteiracac.com/<titulo-escapado>-<id>` (o id é o trecho após o
 * último hífen; o resto é cosmético, como nas competições). Server component
 * para gerar OpenGraph (preview de link no WhatsApp) + CTA de download do app.
 *
 * Só responde no host `noticias.*` — em outros hosts (backoffice, subdomínios
 * de entidade) este catch-all de raiz não deve capturar nada. E só serve
 * notícias PUBLICADAS: o endpoint do servidor filtra por status, então rascunho
 * nunca é acessível por aqui.
 */

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333';
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

/** O id é o trecho após o último hífen (cuid não tem hífen); o resto é slug. */
function idDoSlug(slugId: string): string {
  const i = slugId.lastIndexOf('-');
  return i >= 0 ? slugId.slice(i + 1) : slugId;
}

async function noHostDeNoticias(): Promise<boolean> {
  const host = (await headers()).get('host') ?? '';
  return host.startsWith('noticias.');
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
  if (!(await noHostDeNoticias())) return {};
  const { slugId } = await params;
  const n = await buscar(idDoSlug(slugId));
  if (!n) return { title: 'Notícia — Carteira CAC' };
  const descricao = n.resumo ?? 'Confira esta notícia no Carteira CAC.';
  const url = `https://noticias.carteiracac.com/${slugId}`;
  return {
    title: `${n.titulo} — Carteira CAC`,
    description: descricao,
    openGraph: {
      type: 'article',
      title: n.titulo,
      description: descricao,
      url,
      siteName: 'Carteira CAC',
      images: n.imagemUrl ? [{ url: n.imagemUrl }] : undefined,
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
  // Fora do subdomínio de notícias este catch-all não serve nada (preserva o
  // backoffice e os subdomínios de entidade).
  if (!(await noHostDeNoticias())) notFound();

  const { slugId } = await params;
  const n = await buscar(idDoSlug(slugId));
  if (!n) notFound();

  return (
    <main className="np-wrap">
      <header className="np-topo">
        <a className="np-marca" href={DOWNLOAD}>
          <img src="/logo.png" alt="" />
          <span>Carteira CAC</span>
        </a>
      </header>

      <article className="np-art">
        {n.entidadeNome ? <div className="np-selo">★ {n.entidadeNome}</div> : null}
        <h1 className="np-tit">{n.titulo}</h1>
        {n.publicadaEm ? <div className="np-data">{dataBR(n.publicadaEm)}</div> : null}
        {n.imagemUrl ? <img className="np-capa" src={n.imagemUrl} alt={n.titulo} /> : null}
        {n.resumo ? <p className="np-resumo">{n.resumo}</p> : null}
        <div className="np-corpo" dangerouslySetInnerHTML={{ __html: n.conteudo }} />
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

      <style>{`
        .np-wrap { max-width: 720px; margin: 0 auto; padding: 20px 18px 60px; }
        .np-topo { padding: 6px 0 20px; border-bottom: 1px solid var(--borda); margin-bottom: 24px; }
        .np-marca { display: inline-flex; align-items: center; gap: 10px; font-weight: 700; font-size: 17px; }
        .np-marca img { width: 30px; height: 30px; border-radius: 7px; }
        .np-marca span { color: var(--latao); }
        .np-selo { display: inline-block; font-size: 12px; font-weight: 700; color: var(--latao); margin-bottom: 10px; }
        .np-tit { font-size: 28px; line-height: 1.2; margin: 0 0 10px; }
        .np-data { color: var(--texto-suave); font-size: 13px; margin-bottom: 18px; }
        .np-capa { width: 100%; max-height: 380px; object-fit: cover; border-radius: 14px; margin-bottom: 20px; }
        .np-resumo { font-size: 18px; color: var(--texto-suave); line-height: 1.5; margin: 0 0 20px; }
        .np-corpo { font-size: 16.5px; line-height: 1.6; }
        .np-corpo img { max-width: 100%; height: auto; border-radius: 10px; }
        .np-corpo a { color: var(--acento-forte); text-decoration: underline; }
        .np-corpo h2, .np-corpo h3 { line-height: 1.25; margin: 1.4em 0 .5em; }
        .np-corpo blockquote { border-left: 3px solid var(--borda-forte); margin: 1em 0; padding: 2px 0 2px 14px; color: var(--texto-suave); }
        .np-corpo iframe { max-width: 100%; border: 0; border-radius: 10px; aspect-ratio: 16 / 9; width: 100%; }
        .np-cta { margin-top: 40px; padding: 24px; border: 1px solid var(--borda); border-radius: 14px; background: var(--superficie); text-align: center; }
        .np-cta-tit { font-size: 20px; margin: 0 0 8px; }
        .np-cta-txt { color: var(--texto-suave); font-size: 14px; margin: 0 0 18px; line-height: 1.5; }
        .np-cta-btn { display: inline-block; background: var(--acento); color: var(--sobre-acento); font-weight: 700; padding: 12px 26px; border-radius: 10px; }
        .np-cta-btn:hover { filter: brightness(1.06); }
        .np-cta-url { margin-top: 10px; font-size: 12px; color: var(--texto-suave); }
      `}</style>
    </main>
  );
}
