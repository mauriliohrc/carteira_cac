'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import {
  ROTULO_PAPEL_STATUS,
  ROTULO_SERVICO_DESPACHANTE,
  type PapelStatusDespachante,
  type StatusDespachante,
} from '@/lib/tipos';
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
  grupoId: string;
  criadoEm: string;
  atualizadoEm: string;
  usuario: { id: string; nome: string; email: string; cpf: string; celular: string | null };
}

/** Agrupa processos do mesmo pedido (por-arma) mantendo a ordem. */
function agrupar(itens: ProcessoFila[]): ProcessoFila[][] {
  const ordem: string[] = [];
  const mapa = new Map<string, ProcessoFila[]>();
  for (const it of itens) {
    if (!mapa.has(it.grupoId)) {
      mapa.set(it.grupoId, []);
      ordem.push(it.grupoId);
    }
    mapa.get(it.grupoId)!.push(it);
  }
  return ordem.map((g) => mapa.get(g)!);
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
      <Suspense fallback={<div className="vazio">Carregando…</div>}>
        <FilaDespachante />
      </Suspense>
    </Protegido>
  );
}

function GrupoCard({ grupo }: { grupo: ProcessoFila[] }) {
  const primeiro = grupo[0];
  const porArma = grupo.length > 1;
  const total = grupo.reduce((s, x) => s + x.valorCentavos, 0);
  return (
    <div className="cartao">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <div>
          <strong>{nomeServico(primeiro.tipoServico)}</strong>
          {porArma ? <span className="etiqueta" style={{ marginLeft: 8 }}>{grupo.length} equipamentos</span> : null}
          <div style={{ color: 'var(--texto-suave)', fontSize: 13, marginTop: 2 }}>
            <Link href={`/usuarios/${primeiro.usuario.id}`}>{primeiro.usuario.nome}</Link>
            {primeiro.usuario.celular ? ` · ${primeiro.usuario.celular}` : ''} · {dataHora(primeiro.criadoEm)}
          </div>
        </div>
        <strong style={{ whiteSpace: 'nowrap' }}>{reais(total)}</strong>
      </div>

      <div style={{ marginTop: 10, overflowX: 'auto' }}>
        <table style={{ width: '100%' }}>
          <tbody>
            {grupo.map((p) => (
              <tr key={p.id}>
                <td>{porArma ? p.armaNome ?? 'Equipamento' : p.armaNome ?? '—'}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <span className="etiqueta" style={{ borderColor: p.statusCor, color: p.statusCor }}>
                    ● {p.statusLabel}
                  </span>
                </td>
                <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                  <Link href={`/despachante/${p.id}`} className="secundario pequeno" style={{ textDecoration: 'none' }}>
                    Abrir
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FilaDespachante() {
  const router = useRouter();
  const sp = useSearchParams();
  const papel = (sp.get('papel') ?? '') as PapelStatusDespachante | '';
  const status = sp.get('status') ?? '';
  const [dados, setDados] = useState<Resposta | null>(null);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const qs = status ? `?status=${encodeURIComponent(status)}` : papel ? `?papel=${encodeURIComponent(papel)}` : '';
    const r = await api<Resposta>(`/api/admin/despachante/processos${qs}`);
    setDados(r);
    setCarregando(false);
  }, [papel, status]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  function irPara(novoStatus: string) {
    router.push(novoStatus ? `/despachante?status=${encodeURIComponent(novoStatus)}` : '/despachante');
  }

  const titulo = papel ? ROTULO_PAPEL_STATUS[papel] ?? 'Processos' : 'Fila de processos';

  return (
    <>
      <div className="cabeca-secao">
        <div>
          <h1>{titulo}</h1>
          <p className="subtitulo">
            Processos contratados pelos usuários.{dados ? ` ${dados.total} no filtro.` : ''}
          </p>
        </div>
        <Link href="/despachante/catalogo" className="secundario pequeno" style={{ textDecoration: 'none' }}>
          Catálogo & status →
        </Link>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <button
          className="secundario pequeno"
          style={status === '' && papel === '' ? { borderColor: 'var(--acento)', fontWeight: 700 } : { opacity: 0.7 }}
          onClick={() => irPara('')}
        >
          Todos
        </button>
        {(dados?.status ?? []).map((s) => (
          <button
            key={s.codigo}
            className="secundario pequeno"
            style={status === s.codigo ? { borderColor: s.cor, color: s.cor, fontWeight: 700 } : { opacity: 0.7 }}
            onClick={() => irPara(s.codigo)}
          >
            {s.label}
          </button>
        ))}
      </div>

      {carregando ? (
        <div className="cartao"><div className="vazio">Carregando…</div></div>
      ) : !dados || dados.processos.length === 0 ? (
        <div className="cartao"><div className="vazio">Nenhum processo neste filtro.</div></div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {agrupar(dados.processos).map((grupo) => (
            <GrupoCard key={grupo[0].grupoId} grupo={grupo} />
          ))}
        </div>
      )}
    </>
  );
}
