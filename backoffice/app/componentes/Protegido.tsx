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

type ItemMenu = { href: string; rotulo: string } | { sep: true };

// Submenu "Despachante" — a fila por etapa do processo + a gestão de status.
const DESPACHANTE_MENU: ItemMenu[] = [
  { href: '/despachante', rotulo: 'Todos os processos' },
  { href: '/despachante?papel=AGUARDANDO_DOC', rotulo: 'Aguardando documentação' },
  { href: '/despachante?papel=NORMAL', rotulo: 'Andamento interno' },
  { href: '/despachante?papel=EM_ANALISE', rotulo: 'Aguardando análise' },
  { sep: true },
  { href: '/despachante/catalogo', rotulo: 'Status' },
];

// Submenu "Recursos" — menus menos frequentes, agrupados para enxugar a barra.
const OUTROS: ItemMenu[] = [
  { href: '/entidades', rotulo: 'Entidades' },
  { href: '/despachante/catalogo', rotulo: 'Catálogo de serviços' },
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

  if (carregando) return <div className="centro-tela">Carregando…</div>;
  if (!admin) return null;

  const ehAtivo = (href: string) => pathname === href || pathname.startsWith(href + '/');

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

            <NavDropdown rotulo="Despachante" itens={DESPACHANTE_MENU} ativo={ehAtivo('/despachante')} />
            <NavDropdown rotulo="Recursos" itens={OUTROS} ativo={OUTROS.some((o) => 'href' in o && ehAtivo(o.href))} />
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

/** Dropdown de navegação (fecha ao clicar fora ou trocar de rota). */
function NavDropdown({ rotulo, itens, ativo }: { rotulo: string; itens: ItemMenu[]; ativo: boolean }) {
  const pathname = usePathname();
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => setAberto(false), [pathname]);
  useEffect(() => {
    if (!aberto) return;
    function fora(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false);
    }
    document.addEventListener('mousedown', fora);
    return () => document.removeEventListener('mousedown', fora);
  }, [aberto]);

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        className={`nav-outro ${ativo ? 'nav-ativo' : ''}`}
        aria-haspopup="menu"
        aria-expanded={aberto}
        onClick={() => setAberto((v) => !v)}
        style={{ background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'inherit', cursor: 'pointer' }}
      >
        {rotulo} ▾
      </button>
      {aberto && (
        <div
          role="menu"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            left: 0,
            minWidth: 200,
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
          {itens.map((o, i) =>
            'sep' in o ? (
              <div key={`sep-${i}`} style={{ height: 1, background: 'var(--borda)', margin: '4px 6px' }} />
            ) : (
              <Link
                key={o.href}
                href={o.href}
                role="menuitem"
                style={{ padding: '7px 10px', borderRadius: 6, whiteSpace: 'nowrap' }}
              >
                {o.rotulo}
              </Link>
            )
          )}
        </div>
      )}
    </div>
  );
}
