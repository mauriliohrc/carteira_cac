'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, lerTipo, lerToken, limparToken, salvarToken } from './api';
import type { Admin } from './tipos';

/** Dados da sessão de uma entidade (clube/liga/federação). */
export interface SessaoEntidade {
  usuario: { id: string; nome: string; email: string; papel: string };
  entidade: { id: string; nome: string; tipo: string };
}

interface Sessao {
  /** Admin do app logado, ou null. */
  admin: Admin | null;
  /** Entidade logada, ou null. */
  entidade: SessaoEntidade | null;
  carregando: boolean;
  /** Login do admin do app. */
  entrar: (email: string, senha: string) => Promise<void>;
  /** Login de um usuário de entidade. */
  entrarEntidade: (email: string, senha: string) => Promise<void>;
  sair: () => void;
}

const Contexto = createContext<Sessao | null>(null);

export function ProvedorSessao({ children }: { children: React.ReactNode }) {
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [entidade, setEntidade] = useState<SessaoEntidade | null>(null);
  const [carregando, setCarregando] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (!lerToken()) {
      setCarregando(false);
      return;
    }
    const tipo = lerTipo();
    const restaurar =
      tipo === 'ENTIDADE'
        ? api<SessaoEntidade>('/api/entidade/auth/eu').then((r) => setEntidade(r))
        : api<{ usuario: Admin }>('/api/admin/auth/eu').then((r) => setAdmin(r.usuario));
    restaurar.catch(() => limparToken()).finally(() => setCarregando(false));
  }, []);

  async function entrar(email: string, senha: string) {
    const r = await api<{ token: string; usuario: Admin }>('/api/admin/auth/login', {
      metodo: 'POST',
      corpo: { email, senha },
      autenticar: false,
    });
    salvarToken(r.token, 'ADMIN');
    setEntidade(null);
    setAdmin(r.usuario);
  }

  async function entrarEntidade(email: string, senha: string) {
    const r = await api<SessaoEntidade & { token: string }>('/api/entidade/auth/login', {
      metodo: 'POST',
      corpo: { email, senha },
      autenticar: false,
    });
    salvarToken(r.token, 'ENTIDADE');
    setAdmin(null);
    setEntidade({ usuario: r.usuario, entidade: r.entidade });
  }

  function sair() {
    const eraEntidade = lerTipo() === 'ENTIDADE';
    limparToken();
    setAdmin(null);
    setEntidade(null);
    router.push(eraEntidade ? '/entidade/login' : '/login');
  }

  return (
    <Contexto.Provider value={{ admin, entidade, carregando, entrar, entrarEntidade, sair }}>
      {children}
    </Contexto.Provider>
  );
}

export function useSessao() {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error('useSessao fora do ProvedorSessao');
  return ctx;
}
