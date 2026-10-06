'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useSessao } from '@/lib/sessao';

const NAV = [
  { href: '/entidades', rotulo: 'Entidades' },
  { href: '/noticias', rotulo: 'Notícias' },
  { href: '/usuarios', rotulo: 'Usuários' },
  { href: '/push', rotulo: 'Push' },
  { href: '/cupons', rotulo: 'Cupons' },
];

/** Envolve páginas internas: redireciona para /login se não houver admin. */
export function Protegido({ children }: { children: React.ReactNode }) {
  const { admin, carregando, sair } = useSessao();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!carregando && !admin) router.replace('/login');
  }, [carregando, admin, router]);

  if (carregando) return <div className="centro-tela">Carregando…</div>;
  if (!admin) return null;

  return (
    <>
      <header className="topo">
        <div className="linha-acoes" style={{ gap: 24 }}>
          <div className="marca">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Carteira CAC" />
            Carteira <span>CAC</span>
          </div>
          <nav className="nav">
            {NAV.map((item) => {
              const ativo = pathname === item.href || pathname.startsWith(item.href + '/');
              return (
                <Link key={item.href} href={item.href} className={ativo ? 'nav-ativo' : ''}>
                  {item.rotulo}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="linha-acoes">
          <span style={{ color: 'var(--texto-suave)', fontSize: 13 }}>{admin.email}</span>
          <button className="secundario pequeno" onClick={sair}>
            Sair
          </button>
        </div>
      </header>
      <main className="conteudo">{children}</main>
    </>
  );
}
