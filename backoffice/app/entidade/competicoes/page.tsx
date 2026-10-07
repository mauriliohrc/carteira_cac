'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import type { Competicao } from '@/lib/tipos';
import { ProtegidoEntidade } from '../../componentes/ProtegidoEntidade';

export default function PaginaCompeticoes() {
  return (
    <ProtegidoEntidade>
      <ListaCompeticoes />
    </ProtegidoEntidade>
  );
}

function formatarData(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function situacao(c: Competicao): { rotulo: string; classe: string } {
  const agora = Date.now();
  const inicio = new Date(c.dataInicio).getTime();
  const fim = new Date(c.dataFim).getTime();
  if (!c.ativo) return { rotulo: 'Inativa', classe: 'inativo' };
  if (agora < inicio) return { rotulo: 'Agendada', classe: '' };
  if (agora > fim) return { rotulo: 'Encerrada', classe: 'inativo' };
  return { rotulo: 'Em andamento', classe: 'ok' };
}

function ListaCompeticoes() {
  const [itens, setItens] = useState<Competicao[] | null>(null);

  const carregar = useCallback(async () => {
    const r = await api<{ competicoes: Competicao[] }>('/api/entidade/competicoes');
    setItens(r.competicoes);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  return (
    <>
      <div className="cabeca-secao">
        <div>
          <h1>Competições</h1>
          <p className="subtitulo">
            Crie competições, organize categorias e lance os resultados por CPF. Os sócios
            acompanham o ranking no aplicativo.
          </p>
        </div>
        <Link href="/entidade/competicoes/nova">
          <button>+ Nova competição</button>
        </Link>
      </div>

      <div className="cartao" style={{ padding: 0 }}>
        {itens === null ? (
          <div className="vazio">Carregando…</div>
        ) : itens.length === 0 ? (
          <div className="vazio">Nenhuma competição cadastrada ainda.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Situação</th>
                <th>Categorias</th>
                <th>Período</th>
              </tr>
            </thead>
            <tbody>
              {itens.map((c) => {
                const s = situacao(c);
                return (
                  <tr key={c.id}>
                    <td>
                      <Link href={`/entidade/competicoes/${c.id}`}>{c.nome}</Link>
                    </td>
                    <td>
                      <span className={`etiqueta ${s.classe}`}>{s.rotulo}</span>
                    </td>
                    <td>{c.totalCategorias ?? 0}</td>
                    <td>
                      {formatarData(c.dataInicio)} – {formatarData(c.dataFim)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
