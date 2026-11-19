'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { ROTULO_SERVICO_DESPACHANTE, type StatusDespachante } from '@/lib/tipos';
import { Protegido } from '../componentes/Protegido';

interface ProcessoFila {
  id: string;
  tipoServico: string;
  status: string;
  statusLabel: string;
  statusCor: string;
  statusIcone: string | null;
  valorCentavos: number;
  armaNome: string | null;
  invoiceUrl: string | null;
  criadoEm: string;
  atualizadoEm: string;
  usuario: { id: string; nome: string; email: string; cpf: string; celular: string | null };
}

interface Resposta {
  status: StatusDespachante[];
  processos: ProcessoFila[];
  total: number;
  pagina: number;
  tamanhoPagina: number;
}

function reais(c: number) {
  return `R$ ${(c / 100).toFixed(2).replace('.', ',')}`;
}
function dataHora(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function nomeServico(tipo: string) {
  return ROTULO_SERVICO_DESPACHANTE[tipo as keyof typeof ROTULO_SERVICO_DESPACHANTE] ?? tipo;
}

export default function PaginaDespachante() {
  return (
    <Protegido>
      <FilaDespachante />
    </Protegido>
  );
}

function FilaDespachante() {
  const [dados, setDados] = useState<Resposta | null>(null);
  const [filtro, setFiltro] = useState('');
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const q = filtro ? `?status=${encodeURIComponent(filtro)}` : '';
    const r = await api<Resposta>(`/api/admin/despachante/processos${q}`);
    setDados(r);
    setCarregando(false);
  }, [filtro]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  return (
    <>
      <div className="cabeca-secao">
        <div>
          <h1>Serviços — fila de processos</h1>
          <p className="subtitulo">
            Processos contratados pelos usuários.{dados ? ` ${dados.total} no total.` : ''}
          </p>
        </div>
        <Link href="/despachante/catalogo" className="secundario pequeno" style={{ textDecoration: 'none' }}>
          Catálogo & status →
        </Link>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <button
          className="secundario pequeno"
          style={filtro === '' ? { borderColor: 'var(--acento)', fontWeight: 700 } : { opacity: 0.7 }}
          onClick={() => setFiltro('')}
        >
          Todos
        </button>
        {(dados?.status ?? []).map((s) => (
          <button
            key={s.codigo}
            className="secundario pequeno"
            style={filtro === s.codigo ? { borderColor: s.cor, color: s.cor, fontWeight: 700 } : { opacity: 0.7 }}
            onClick={() => setFiltro(s.codigo)}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="cartao" style={{ padding: 0, overflowX: 'auto' }}>
        {carregando ? (
          <div className="vazio">Carregando…</div>
        ) : !dados || dados.processos.length === 0 ? (
          <div className="vazio">Nenhum processo neste filtro.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Contratado</th>
                <th>Serviço</th>
                <th>Arma</th>
                <th>Usuário</th>
                <th>Telefone</th>
                <th>Valor</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {dados.processos.map((p) => (
                <tr key={p.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{dataHora(p.criadoEm)}</td>
                  <td>{nomeServico(p.tipoServico)}</td>
                  <td>{p.armaNome ?? '—'}</td>
                  <td>
                    <Link href={`/usuarios/${p.usuario.id}`}>{p.usuario.nome}</Link>
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>{p.usuario.celular ?? '—'}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>{reais(p.valorCentavos)}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <span className="etiqueta" style={{ borderColor: p.statusCor, color: p.statusCor }}>
                      ● {p.statusLabel}
                    </span>
                  </td>
                  <td>
                    <Link href={`/despachante/${p.id}`} className="secundario pequeno" style={{ textDecoration: 'none' }}>
                      Abrir
                    </Link>
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
