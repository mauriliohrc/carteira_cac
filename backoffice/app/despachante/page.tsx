'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api, ErroApi } from '@/lib/api';
import {
  ROTULO_SERVICO_DESPACHANTE,
  ROTULO_STATUS_PROCESSO,
  type ListaProcessosDespachante,
  type ProcessoAdmin,
  type StatusProcesso,
} from '@/lib/tipos';
import { Protegido } from '../componentes/Protegido';

export default function PaginaDespachante() {
  return (
    <Protegido>
      <FilaDespachante />
    </Protegido>
  );
}

const FILTROS: { valor: '' | StatusProcesso; rotulo: string }[] = [
  { valor: '', rotulo: 'Todos' },
  { valor: 'pago', rotulo: 'Pagos (a fazer)' },
  { valor: 'em_andamento', rotulo: 'Em andamento' },
  { valor: 'aguardando_pagamento', rotulo: 'Aguardando pagamento' },
  { valor: 'concluido', rotulo: 'Concluídos' },
  { valor: 'cancelado', rotulo: 'Cancelados' },
];

function reais(centavos: number) {
  return `R$ ${(centavos / 100).toFixed(2).replace('.', ',')}`;
}
function dataHora(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function FilaDespachante() {
  const [dados, setDados] = useState<ListaProcessosDespachante | null>(null);
  const [filtro, setFiltro] = useState<'' | StatusProcesso>('');
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const q = filtro ? `?status=${filtro}` : '';
    const r = await api<ListaProcessosDespachante>(`/api/admin/despachante/processos${q}`);
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
          <h1>Serviços</h1>
          <p className="subtitulo">
            Processos contratados pelos usuários (Renovação de CRAF e Emissão de Guias).
            {dados ? ` ${dados.total} no total.` : ''}
          </p>
        </div>
      </div>

      <p className="subtitulo" style={{ marginTop: -4, marginBottom: 16 }}>
        Os valores (GRU + serviço) de cada tipo agora ficam em{' '}
        <Link href="/config" style={{ fontWeight: 600 }}>
          Gestão
        </Link>
        .
      </p>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {FILTROS.map((f) => (
          <button
            key={f.valor || 'todos'}
            className="secundario pequeno"
            style={filtro === f.valor ? { borderColor: 'var(--acento)', fontWeight: 700 } : { opacity: 0.7 }}
            onClick={() => setFiltro(f.valor)}
          >
            {f.rotulo}
          </button>
        ))}
      </div>

      <div className="cartao" style={{ padding: 0 }}>
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
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {dados.processos.map((p) => (
                <LinhaProcesso key={p.id} proc={p} aoMudar={carregar} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

/** Classe da etiqueta de status (reusa as cores existentes do CSS). */
function classeStatus(status: StatusProcesso): string {
  if (status === 'concluido' || status === 'pago') return 'publicada';
  if (status === 'cancelado') return 'inativo';
  return ''; // aguardando_pagamento / em_andamento: etiqueta neutra
}

function LinhaProcesso({ proc, aoMudar }: { proc: ProcessoAdmin; aoMudar: () => void }) {
  const [salvando, setSalvando] = useState(false);

  async function mudar(status: StatusProcesso) {
    setSalvando(true);
    try {
      await api(`/api/admin/despachante/processos/${proc.id}`, {
        metodo: 'PATCH',
        corpo: { status },
      });
      aoMudar();
    } catch (e) {
      alert(e instanceof ErroApi ? e.message : 'Falha ao atualizar');
      setSalvando(false);
    }
  }

  return (
    <tr style={proc.status === 'cancelado' ? { opacity: 0.6 } : undefined}>
      <td style={{ whiteSpace: 'nowrap' }}>{dataHora(proc.criadoEm)}</td>
      <td>{ROTULO_SERVICO_DESPACHANTE[proc.tipoServico]}</td>
      <td>{proc.armaNome ?? '—'}</td>
      <td>{proc.usuario.nome}</td>
      <td style={{ whiteSpace: 'nowrap' }}>{proc.usuario.celular ?? '—'}</td>
      <td style={{ whiteSpace: 'nowrap' }}>{reais(proc.valorCentavos)}</td>
      <td>
        <span className={`etiqueta ${classeStatus(proc.status)}`}>
          {ROTULO_STATUS_PROCESSO[proc.status]}
        </span>
      </td>
      <td>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {proc.status === 'pago' ? (
            <button className="secundario pequeno" disabled={salvando} onClick={() => mudar('em_andamento')}>
              Iniciar
            </button>
          ) : null}
          {proc.status === 'em_andamento' ? (
            <button className="secundario pequeno" disabled={salvando} onClick={() => mudar('concluido')}>
              Concluir
            </button>
          ) : null}
          {proc.status !== 'concluido' && proc.status !== 'cancelado' ? (
            <button className="perigo pequeno" disabled={salvando} onClick={() => mudar('cancelado')}>
              Cancelar
            </button>
          ) : null}
        </div>
      </td>
    </tr>
  );
}
