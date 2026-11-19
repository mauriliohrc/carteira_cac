'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import {
  ROTULO_STATUS_FILIACAO,
  type ListaFiliacoes,
  type StatusFiliacao,
} from '@/lib/tipos';
import { Protegido } from '../componentes/Protegido';

export default function PaginaFiliacoes() {
  return (
    <Protegido>
      <Suspense fallback={<div className="vazio">Carregando…</div>}>
        <ListaFiliados />
      </Suspense>
    </Protegido>
  );
}

const FILTROS: { valor: string; rotulo: string }[] = [
  { valor: '', rotulo: 'Todas' },
  { valor: 'ativa', rotulo: 'Ativas' },
  { valor: 'pendente_doc', rotulo: 'Pendente de documento' },
  { valor: 'pendente_pagamento', rotulo: 'Aguardando pagamento' },
  { valor: 'vencida', rotulo: 'Vencidas' },
  { valor: 'cancelada', rotulo: 'Canceladas' },
];

function reais(centavos: number) {
  return `R$ ${(centavos / 100).toFixed(2).replace('.', ',')}`;
}
function data(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR');
}
function classeStatus(status: StatusFiliacao): string {
  if (status === 'ativa') return 'publicada';
  if (status === 'cancelada' || status === 'vencida') return 'inativo';
  return '';
}

function ListaFiliados() {
  const sp = useSearchParams();
  const [dados, setDados] = useState<ListaFiliacoes | null>(null);
  const [filtro, setFiltro] = useState(sp.get('filtro') ?? '');
  const [busca, setBusca] = useState('');
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const params = new URLSearchParams();
    if (filtro === 'pendente_doc') params.set('pendenteDoc', '1');
    else if (filtro) params.set('status', filtro);
    if (busca.trim()) params.set('busca', busca.trim());
    const q = params.toString();
    const r = await api<ListaFiliacoes>(`/api/admin/filiacoes${q ? `?${q}` : ''}`);
    setDados(r);
    setCarregando(false);
  }, [filtro, busca]);

  useEffect(() => {
    const t = setTimeout(carregar, 250);
    return () => clearTimeout(t);
  }, [carregar]);

  return (
    <>
      <div className="cabeca-secao">
        <div>
          <h1>Filiações</h1>
          <p className="subtitulo">
            Filiados à liga esportiva (anuidade via Asaas).
            {dados ? ` ${dados.total} no total.` : ''}
          </p>
        </div>
      </div>

      <p className="subtitulo" style={{ marginTop: -4, marginBottom: 16 }}>
        Identidade, preço e textos da liga agora ficam em{' '}
        <Link href="/config" style={{ fontWeight: 600 }}>
          Gestão
        </Link>
        .
      </p>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        {FILTROS.map((f) => (
          <button
            key={f.valor || 'todas'}
            className="secundario pequeno"
            style={filtro === f.valor ? { borderColor: 'var(--acento)', fontWeight: 700 } : { opacity: 0.7 }}
            onClick={() => setFiltro(f.valor)}
          >
            {f.rotulo}
          </button>
        ))}
      </div>

      <input
        placeholder="Buscar por nome, CPF ou número…"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        style={{ width: '100%', maxWidth: 360, marginBottom: 16 }}
      />

      <div className="cartao" style={{ padding: 0 }}>
        {carregando ? (
          <div className="vazio">Carregando…</div>
        ) : !dados || dados.itens.length === 0 ? (
          <div className="vazio">Nenhuma filiação neste filtro.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Nº</th>
                <th>Filiado</th>
                <th>CPF</th>
                <th>Origem</th>
                <th>Documento</th>
                <th>Válido até</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {dados.itens.map((f) => (
                <tr key={f.id} style={f.status === 'cancelada' ? { opacity: 0.6 } : undefined}>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <Link href={`/usuarios/${f.usuario.id}?aba=filiacao`}>{f.numeroFiliacao ?? '—'}</Link>
                  </td>
                  <td>
                    <Link href={`/usuarios/${f.usuario.id}?aba=filiacao`}>{f.nomeCompleto}</Link>
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>{f.cpf}</td>
                  <td>{f.origem === 'CORTESIA_MIGRACAO' ? 'Cortesia' : 'Asaas'}</td>
                  <td>
                    {f.documentacaoCompleta ? (
                      <span className="etiqueta publicada">OK</span>
                    ) : (
                      <span className="etiqueta">Pendente</span>
                    )}
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>{data(f.vigenteAte)}</td>
                  <td>
                    <span className={`etiqueta ${classeStatus(f.status)}`}>
                      {ROTULO_STATUS_FILIACAO[f.status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
