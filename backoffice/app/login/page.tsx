'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ErroApi } from '@/lib/api';
import { useSessao } from '@/lib/sessao';

export default function Login() {
  const { entrar } = useSessao();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function aoEnviar(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    setEnviando(true);
    try {
      await entrar(email, senha);
      router.replace('/entidades');
    } catch (err) {
      setErro(err instanceof ErroApi ? err.message : 'Falha ao entrar');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="centro-tela">
      <div className="caixa-login">
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="Carteira CAC"
            style={{ width: 72, height: 72, borderRadius: 16, marginBottom: 12 }}
          />
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '.3px' }}>
            Carteira <span style={{ color: 'var(--latao)' }}>CAC</span>
          </div>
          <p className="subtitulo" style={{ margin: '6px 0 0' }}>
            Backoffice — administração
          </p>
        </div>
        <form className="cartao" onSubmit={aoEnviar}>
          <div className="campo">
            <label>E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
              required
            />
          </div>
          <div className="campo">
            <label>Senha</label>
            <input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required
            />
          </div>
          {erro && <p className="erro">{erro}</p>}
          <button type="submit" disabled={enviando} style={{ width: '100%', marginTop: 6 }}>
            {enviando ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
        <p style={{ textAlign: 'center', marginTop: 16, fontSize: 13 }}>
          <Link href="/entidade/login">Sou de uma entidade (clube/liga/federação)</Link>
        </p>
      </div>
    </div>
  );
}
