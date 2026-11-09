import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Unificação do site no backoffice.
 *
 * O MESMO app Next atende dois papéis por domínio:
 *   - carteiracac.com / www.carteiracac.com  → LANDING (arquivos estáticos em
 *     public/: index.html, privacidade.html, termos.html, download/).
 *   - backoffice.carteiracac.com             → painel admin (comportamento atual).
 *
 * Como `public/index.html` não é servido na raiz pelo Next (a rota app/page.tsx
 * vence), reescrevemos a "/" para "/index.html" apenas no apex. O painel e suas
 * rotas seguem intactos no subdomínio do backoffice.
 */
const HOSTS_LANDING = new Set(['carteiracac.com', 'www.carteiracac.com']);

export function middleware(req: NextRequest) {
  const host = (req.headers.get('host') ?? '').split(':')[0].toLowerCase();
  const { pathname } = req.nextUrl;

  // /download (sem index.html) → serve a página estática download/index.html.
  if (pathname === '/download') {
    return NextResponse.rewrite(new URL('/download/index.html', req.url));
  }

  // Raiz do apex: entrega a landing estática em vez do redirecionamento do admin.
  if (HOSTS_LANDING.has(host) && pathname === '/') {
    return NextResponse.rewrite(new URL('/index.html', req.url));
  }

  return NextResponse.next();
}

export const config = {
  // Só intercepta a raiz e /download — todo o resto (incl. /privacidade.html,
  // /termos.html, /screens/*, e as rotas do admin) segue o caminho normal.
  matcher: ['/', '/download'],
};
