'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useSessao } from '@/lib/sessao';

// Itens de primeiro nível do menu. O restante vai para o submenu "Recursos".
const NAV = [
  { href: '/dashboard', rotulo: 'Dashboard' },
  { href: '/noticias', rotulo: 'Notícias' },
  { href: '/usuarios', rotulo: 'Usuários' },
  { href: '/filiacoes', rotulo: 'Liga' },
  { href: '/notificacoes', rotulo: 'Auditoria' },
];

// Submenu "Recursos" — menus menos frequentes, agrupados para enxugar a barra.
const OUTROS = [
  { href: '/entidades', rotulo: 'Entidades' },
  { href: '/despachante', rotulo: 'Serviços' },
  { href: '/marketplace', rotulo: 'Marketplace' },
  { href: '/push', rotulo: 'Push' },
  { href: '/churn', rotulo: 'Churn' },
  { href: '/metricas', rotulo: 'Métricas' },
  { href: '/whatsapp', rotulo: 'WhatsApp' },
  { href: '/automacoes', rotulo: 'Automações' },
  { href: '/cupons', rotulo: 'Cupons' },
  { href: '/contatos', rotulo: 'Contatos' },
  { href: '/config', rotulo: 'Gestão' },
];

/** Envolve páginas internas: redireciona para /login se não houver admin. */
export function Protegido({ children }: { children: React.ReactNode }) {
  const { admin, carregando, sair } = useSessao();
  const router = useRouter();
  const pathname = usePathname();
  const [outroAberto, setOutroAberto] = useState(false);
  const outroRef = useRef<HTMLDivElement>(null);
  const [buscaUsuario, setBuscaUsuario] = useState('');

  // Busca global de usuários: leva para /usuarios já filtrado (nome/e-mail/CPF).
  function buscarUsuario(e: React.FormEvent) {
    e.preventDefault();
    const q = buscaUsuario.trim();
    router.push(q ? `/usuarios?busca=${encodeURIComponent(q)}` : '/usuarios');
  }

  useEffect(() => {
    if (!carregando && !admin) router.replace('/login');
  }, [carregando, admin, router]);

  // Fecha o submenu ao clicar fora ou ao trocar de rota.
  useEffect(() => setOutroAberto(false), [pathname]);
  useEffect(() => {
    if (!outroAberto) return;
    function fora(e: MouseEvent) {
      if (outroRef.current && !outroRef.current.contains(e.target as Node)) setOutroAberto(false);
    }
    document.addEventListener('mousedown', fora);
    return () => document.removeEventListener('mousedown', fora);
  }, [outroAberto]);

  if (carregando) return <div className="centro-tela">Carregando…</div>;
  if (!admin) return null;

  const ehAtivo = (href: string) => pathname === href || pathname.startsWith(href + '/');
  const outroAtivo = OUTROS.some((o) => ehAtivo(o.href));

  return (
    <>
      <header className="topo">
        <div className="linha-acoes" style={{ gap: 24 }}>
          <Link href="/dashboard" className="marca" style={{ textDecoration: 'none' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Carteira CAC" />
            Carteira <span>CAC</span>
          </Link>
          <nav className="nav">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} className={ehAtivo(item.href) ? 'nav-ativo' : ''}>
                {item.rotulo}
              </Link>
            ))}

            {/* Submenu "Outro" */}
            <div ref={outroRef} style={{ position: 'relative', display: 'inline-block' }}>
              <button
                type="button"
                className={`nav-outro ${outroAtivo ? 'nav-ativo' : ''}`}
                aria-haspopup="menu"
                aria-expanded={outroAberto}
                onClick={() => setOutroAberto((v) => !v)}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                  font: 'inherit',
                  color: 'inherit',
                  cursor: 'pointer',
                }}
              >
                Recursos ▾
              </button>
              {outroAberto && (
                <div
                  role="menu"
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    left: 0,
                    minWidth: 180,
                    background: 'var(--superficie, #fff)',
                    border: '1px solid var(--borda)',
                    borderRadius: 8,
                    boxShadow: '0 8px 24px rgba(0,0,0,.18)',
                    padding: 6,
                    zIndex: 50,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                  }}
                >
                  {OUTROS.map((o) => (
                    <Link
                      key={o.href}
                      href={o.href}
                      role="menuitem"
                      className={ehAtivo(o.href) ? 'nav-ativo' : ''}
                      style={{ padding: '7px 10px', borderRadius: 6, whiteSpace: 'nowrap' }}
                    >
                      {o.rotulo}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </nav>
        </div>
        <div className="linha-acoes">
          <form onSubmit={buscarUsuario} role="search">
            <input
              type="search"
              value={buscaUsuario}
              onChange={(e) => setBuscaUsuario(e.target.value)}
              placeholder="Buscar usuário…"
              aria-label="Buscar usuário por nome, e-mail ou CPF"
              style={{
                width: 220,
                maxWidth: '40vw',
                padding: '7px 12px',
                borderRadius: 8,
                border: '1px solid var(--borda)',
                background: 'var(--superficie, #fff)',
                color: 'var(--texto)',
                font: 'inherit',
                fontSize: 13,
              }}
            />
          </form>
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
