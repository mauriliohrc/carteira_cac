'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useSessao } from '@/lib/sessao';
import { ROTULO_TIPO, type TipoEntidade } from '@/lib/tipos';

const NAV = [
  { href: '/entidade/noticias', rotulo: 'Notícias' },
  { href: '/entidade/push', rotulo: 'Notificações' },
];

/** Envolve as páginas da ENTIDADE: redireciona para /entidade/login se não logada. */
export function ProtegidoEntidade({ children }: { children: React.ReactNode }) {
  const { entidade, carregando, sair } = useSessao();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!carregando && !entidade) router.replace('/entidade/login');
  }, [carregando, entidade, router]);

  if (carregando) return <div className="centro-tela">Carregando…</div>;
  if (!entidade) return null;

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
          <span style={{ color: 'var(--texto-suave)', fontSize: 13 }}>
            {entidade.entidade.nome}
            <span style={{ opacity: 0.6 }}>
              {' · '}
              {ROTULO_TIPO[entidade.entidade.tipo as TipoEntidade] ?? entidade.entidade.tipo}
            </span>
          </span>
          <button className="secundario pequeno" onClick={sair}>
            Sair
          </button>
        </div>
      </header>
      <main className="conteudo">{children}</main>
    </>
  );
}
