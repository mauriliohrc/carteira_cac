'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { tempoRelativo } from '@/lib/formato';
import { Protegido } from '../../componentes/Protegido';

interface UsuarioLinha {
  id: string;
  nome: string;
  email: string;
  cpf: string;
  celular: string | null;
  emailVerificado: boolean;
  ultimoAcessoEm: string | null;
  criadoEm: string;
}

const TITULOS: Record<string, string> = {
  todos: 'Todos os usuários',
  ativos: 'Usuários ativos',
  semAtivar: 'Usuários sem ativar o e-mail',
  semVinculo: 'Usuários sem vínculo com entidade',
  semDocumento: 'Usuários sem documentos',
};

export default function PaginaMetrica() {
  return (
    <Protegido>
      <Lista />
    </Protegido>
  );
}

function Lista() {
  const { metrica } = useParams<{ metrica: string }>();
  const [usuarios, setUsuarios] = useState<UsuarioLinha[] | null>(null);

  const carregar = useCallback(async () => {
    const r = await api<{ usuarios: UsuarioLinha[] }>(
      `/api/admin/dashboard/usuarios?metrica=${encodeURIComponent(metrica)}`
    );
    setUsuarios(r.usuarios);
  }, [metrica]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  function exportarCsv() {
    if (!usuarios) return;
    const cab = ['Nome', 'E-mail', 'CPF', 'Celular', 'E-mail confirmado', 'Último acesso', 'Criado em'];
    const linhas = usuarios.map((u) => [
      u.nome,
      u.email,
      u.cpf,
      u.celular ?? '',
      u.emailVerificado ? 'sim' : 'nao',
      u.ultimoAcessoEm ?? '',
      u.criadoEm,
    ]);
    const escapar = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
    const csv = [cab, ...linhas].map((l) => l.map(escapar).join(',')).join('\r\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `usuarios-${metrica}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <p style={{ marginTop: 0 }}>
        <Link href="/dashboard">← Dashboard</Link>
      </p>
      <div className="cabeca-secao">
        <div>
          <h1>{TITULOS[metrica] ?? 'Usuários'}</h1>
          <p className="subtitulo">{usuarios ? `${usuarios.length} usuário(s)` : 'Carregando…'}</p>
        </div>
        <button className="secundario" onClick={exportarCsv} disabled={!usuarios || usuarios.length === 0}>
          Exportar CSV
        </button>
      </div>

      <div className="cartao" style={{ padding: 0 }}>
        {!usuarios ? (
          <div className="vazio">Carregando…</div>
        ) : usuarios.length === 0 ? (
          <div className="vazio">Nenhum usuário nesta lista.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>E-mail</th>
                <th>CPF</th>
                <th>Celular</th>
                <th>Último acesso</th>
                <th>Criado em</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={u.id}>
                  <td>
                    <Link href={`/usuarios/${u.id}`}>{u.nome}</Link>
                  </td>
                  <td>
                    {u.email}{' '}
                    {u.emailVerificado ? (
                      <span title="E-mail confirmado" style={{ color: 'var(--ok)' }}>✓</span>
                    ) : (
                      <span title="E-mail não confirmado" style={{ color: '#c99a2e' }}>⧗</span>
                    )}
                  </td>
                  <td>{u.cpf}</td>
                  <td>{u.celular || '—'}</td>
                  <td>{u.ultimoAcessoEm ? tempoRelativo(u.ultimoAcessoEm) : 'nunca'}</td>
                  <td>{new Date(u.criadoEm).toLocaleDateString('pt-BR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
