'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { categoriaPlano } from '@/lib/tipos';
import type { UsuarioApp } from '@/lib/tipos';
import { Protegido } from '../../componentes/Protegido';
import { CabecalhoUsuario, CelulasUsuario } from '../../componentes/ColunasUsuario';

type UsuarioLinha = UsuarioApp;

const TITULOS: Record<string, string> = {
  todos: 'Usuários com conta',
  online: 'Usuários online agora',
  ativos: 'Usuários ativos',
  contasAtivas: 'Contas ativas',
  semAtivar: 'Usuários sem validar o e-mail',
  semVinculo: 'Usuários sem vínculo com entidade',
  comVinculo: 'Usuários com vínculo de entidade',
  comDocumento: 'Usuários com documentos',
  semDocumento: 'Usuários sem documentos',
  planoAnual: 'Assinantes do plano anual',
  planoMensal: 'Assinantes do plano mensal',
  premiumGratis: 'Premium grátis (cupom)',
  desatualizados: 'Usuários desatualizados (abaixo da última ou sem versão)',
  semVersao: 'Usuários sem versão reportada',
};

/**
 * Decodifica o parâmetro de rota. O Next 15 NÃO decodifica os params: um
 * segmento como `versao:1.8.1` chega aqui como `versao%3A1.8.1`, e sem decodar
 * ele não casa com a métrica esperada no servidor (lista viria vazia).
 */
function decodificarMetrica(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/** Título da métrica (trata `versao:<x>` dinamicamente). */
function tituloMetrica(metrica: string): string {
  if (metrica.startsWith('versao:')) return `Usuários na versão ${metrica.slice('versao:'.length)}`;
  return TITULOS[metrica] ?? 'Usuários';
}

export default function PaginaMetrica() {
  return (
    <Protegido>
      <Lista />
    </Protegido>
  );
}

function Lista() {
  const { metrica: metricaParam } = useParams<{ metrica: string }>();
  const metrica = decodificarMetrica(metricaParam);
  const [usuarios, setUsuarios] = useState<UsuarioLinha[] | null>(null);
  const [ordenar, setOrdenar] = useState('criado');
  const [direcao, setDirecao] = useState<'asc' | 'desc'>('desc');

  function aoOrdenar(coluna: string) {
    if (ordenar === coluna) setDirecao((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setOrdenar(coluna);
      setDirecao('asc');
    }
  }

  // Chave de ordenação por coluna (a lista já vem inteira → ordena no cliente).
  function chaveOrdenacao(u: UsuarioLinha, coluna: string): string | number {
    switch (coluna) {
      case 'nome':
        return (u.nome ?? '').toLowerCase();
      case 'email':
        return u.emailVerificado ? 1 : 0;
      case 'telefone':
        return u.celular ?? '';
      case 'plano':
        return categoriaPlano(u.premium, u.premiumTipo);
      case 'assinatura':
        return u.assinaturaEm ? new Date(u.assinaturaEm).getTime() : -1;
      case 'ultimoAcesso':
        return u.ultimoAcessoEm ? new Date(u.ultimoAcessoEm).getTime() : -1;
      case 'entidades':
        return u.entidades?.length ?? 0;
      case 'armas':
        return u.armasSistema ?? 0;
      case 'dispositivos':
        return u.dispositivos ?? 0;
      case 'versao':
        return u.appVersao ?? '';
      case 'criado':
      default:
        return u.criadoEm ? new Date(u.criadoEm).getTime() : -1;
    }
  }

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
    const cab = ['Nome', 'E-mail', 'CPF', 'Celular', 'Plano', 'Assinatura', 'E-mail confirmado', 'Último acesso', 'Versão', 'Armas', 'Criado em'];
    const linhas = usuarios.map((u) => [
      u.nome,
      u.email,
      u.cpf,
      u.celular ?? '',
      u.premium ? u.premiumTipo ?? 'Premium' : 'Grátis',
      u.assinaturaEm ?? '',
      u.emailVerificado ? 'sim' : 'nao',
      u.ultimoAcessoEm ?? '',
      u.appVersao ?? '',
      String(u.armasSistema ?? ''),
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
          <h1>{tituloMetrica(metrica)}</h1>
          <p className="subtitulo">{usuarios ? `${usuarios.length} usuário(s)` : 'Carregando…'}</p>
        </div>
        <button className="secundario" onClick={exportarCsv} disabled={!usuarios || usuarios.length === 0}>
          Exportar CSV
        </button>
      </div>

      <div className="cartao" style={{ padding: 0, overflowX: 'auto' }}>
        {!usuarios ? (
          <div className="vazio">Carregando…</div>
        ) : usuarios.length === 0 ? (
          <div className="vazio">Nenhum usuário nesta lista.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>CPF</th>
                <CabecalhoUsuario ordenavel ordenar={ordenar} direcao={direcao} aoOrdenar={aoOrdenar} />
              </tr>
            </thead>
            <tbody>
              {[...usuarios]
                .sort((a, b) => {
                  const va = chaveOrdenacao(a, ordenar);
                  const vb = chaveOrdenacao(b, ordenar);
                  const c =
                    typeof va === 'number' && typeof vb === 'number'
                      ? va - vb
                      : String(va).localeCompare(String(vb), 'pt-BR');
                  return direcao === 'asc' ? c : -c;
                })
                .map((u) => (
                  <tr key={u.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{u.cpf}</td>
                    <CelulasUsuario u={u} />
                  </tr>
                ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
