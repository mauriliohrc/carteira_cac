'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api, ErroApi } from '@/lib/api';
import {
  ROTULO_SERVICO_DESPACHANTE,
  ROTULO_TIPO_CAMPO,
  type CampoDespachante,
  type ProcessoDespachanteDetalhe,
  type TipoCampoDespachante,
  type ValorCampoDespachante,
} from '@/lib/tipos';
import { Protegido } from '../../componentes/Protegido';

function reais(c: number) {
  return `R$ ${(c / 100).toFixed(2).replace('.', ',')}`;
}
function dataHora(iso: string) {
  return new Date(iso).toLocaleString('pt-BR');
}

/** File → base64 (sem o prefixo data:). */
function lerArquivo(file: File): Promise<{ mime: string; base64: string; nome: string }> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve({ mime: file.type || 'application/octet-stream', base64: String(r.result).split(',')[1] ?? '', nome: file.name });
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

export default function PaginaProcesso() {
  return (
    <Protegido>
      <Processo />
    </Protegido>
  );
}

function Processo() {
  const { id } = useParams<{ id: string }>();
  const [p, setP] = useState<ProcessoDespachanteDetalhe | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const carregar = useCallback(async () => {
    const r = await api<ProcessoDespachanteDetalhe>(`/api/admin/despachante/processos/${id}`);
    setP(r);
  }, [id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function verArquivo(valorId: string) {
    try {
      const r = await api<{ base64: string; mime: string; nome: string }>(
        `/api/admin/despachante/processos/${id}/arquivo/${valorId}`
      );
      const bin = atob(r.base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const url = URL.createObjectURL(new Blob([bytes], { type: r.mime }));
      window.open(url, '_blank');
    } catch (e) {
      alert(e instanceof ErroApi ? e.message : 'Falha ao abrir');
    }
  }

  async function mudarStatus(status: string) {
    setOcupado(true);
    try {
      await api(`/api/admin/despachante/processos/${id}`, { metodo: 'PATCH', corpo: { status } });
      await carregar();
    } catch (e) {
      alert(e instanceof ErroApi ? e.message : 'Falha ao mudar status');
    } finally {
      setOcupado(false);
    }
  }

  async function revisar(valorId: string, aprovar: boolean) {
    const motivo = aprovar ? undefined : prompt('Motivo da rejeição (o usuário verá):') ?? '';
    setOcupado(true);
    try {
      await api(`/api/admin/despachante/processos/${id}/valores/${valorId}/revisar`, {
        metodo: 'POST',
        corpo: { aprovar, motivo },
      });
      await carregar();
    } catch (e) {
      alert(e instanceof ErroApi ? e.message : 'Falha ao revisar');
    } finally {
      setOcupado(false);
    }
  }

  if (!p) return <div className="vazio">Carregando…</div>;

  const servicoNome = ROTULO_SERVICO_DESPACHANTE[p.tipoServico as keyof typeof ROTULO_SERVICO_DESPACHANTE] ?? p.servicoNome;
  const finais = p.valores.filter((v) => v.final);
  const porCampo = new Map(p.valores.filter((v) => v.campoId).map((v) => [v.campoId!, v]));

  return (
    <>
      <p style={{ marginTop: 0 }}>
        <Link href="/despachante">← Fila de processos</Link>
      </p>

      <div className="cabeca-secao">
        <div>
          <h1>{servicoNome}</h1>
          <p className="subtitulo">
            <Link href={`/usuarios/${p.usuario.id}`}>{p.usuario.nome}</Link> · {p.usuario.cpf}
            {p.usuario.celular ? ` · ${p.usuario.celular}` : ''} · {reais(p.valorCentavos)}
            {p.armaNome ? ` · ${p.armaNome}` : ''}
          </p>
        </div>
        <span className="etiqueta" style={{ borderColor: p.statusCor, color: p.statusCor }}>
          ● {p.statusLabel}
        </span>
      </div>

      {/* Status + progresso */}
      <div className="cartao" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="campo" style={{ margin: 0 }}>
            <label>Status do processo</label>
            <select value={p.status} onChange={(e) => mudarStatus(e.target.value)} disabled={ocupado} style={{ width: 'auto' }}>
              {p.statusDisponiveis.map((s) => (
                <option key={s.codigo} value={s.codigo}>{s.label}</option>
              ))}
            </select>
          </div>
          {p.invoiceUrl && (
            <a href={p.invoiceUrl} target="_blank" rel="noreferrer" className="secundario pequeno" style={{ textDecoration: 'none', marginTop: 18 }}>
              Ver cobrança
            </a>
          )}
          {p.progresso && (
            <div style={{ marginLeft: 'auto', minWidth: 220 }}>
              <BarraProgresso feitos={p.progresso.preenchidosObrigatorios} total={p.progresso.totalObrigatorios} completo={p.progresso.completo} />
            </div>
          )}
        </div>
        <ObservacaoInterna id={p.id} inicial={p.observacao ?? ''} />
      </div>

      {/* Checklist de campos */}
      <h2>Documentação do usuário</h2>
      {p.campos.length === 0 ? (
        <p className="subtitulo">Este serviço não exige documentos.</p>
      ) : (
        <div className="cartao" style={{ padding: 0 }}>
          <table>
            <thead>
              <tr>
                <th>Campo</th>
                <th>Tipo</th>
                <th>Resposta</th>
                <th>Situação</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {p.campos.map((c) => (
                <LinhaCampo key={c.id} campo={c} valor={porCampo.get(c.id)} onVer={verArquivo} onRevisar={revisar} ocupado={ocupado} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Documentos finais */}
      <h2 style={{ marginTop: 24 }}>Documentos finais (entregues ao cliente)</h2>
      <div className="cartao">
        {finais.length === 0 ? (
          <p className="subtitulo" style={{ marginTop: 0 }}>Nenhum documento final anexado ainda.</p>
        ) : (
          <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
            {finais.map((v) => (
              <div key={v.id} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <span style={{ flex: 1 }}>{v.nome}</span>
                <button className="secundario pequeno" onClick={() => verArquivo(v.id)}>Ver</button>
                <button className="perigo pequeno" disabled={ocupado} onClick={async () => {
                  if (!confirm('Remover este documento final?')) return;
                  await api(`/api/admin/despachante/processos/${id}/valores/${v.id}`, { metodo: 'DELETE' });
                  carregar();
                }}>Remover</button>
              </div>
            ))}
          </div>
        )}
        <AnexarFinal id={p.id} aoAnexar={carregar} />
      </div>
    </>
  );
}

function BarraProgresso({ feitos, total, completo }: { feitos: number; total: number; completo: boolean }) {
  const pct = total === 0 ? 100 : Math.round((feitos / total) * 100);
  const cor = completo ? 'var(--ok)' : '#c99a2e';
  return (
    <div>
      <div style={{ fontSize: 12, color: 'var(--texto-suave)', marginBottom: 4 }}>
        Documentação: {feitos}/{total} {completo ? '· completo ✓' : ''}
      </div>
      <div style={{ height: 10, background: 'var(--superficie-2)', borderRadius: 5, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: cor }} />
      </div>
    </div>
  );
}

function LinhaCampo({
  campo,
  valor,
  onVer,
  onRevisar,
  ocupado,
}: {
  campo: CampoDespachante;
  valor?: ValorCampoDespachante;
  onVer: (id: string) => void;
  onRevisar: (id: string, aprovar: boolean) => void;
  ocupado: boolean;
}) {
  const preenchido = valor?.preenchido ?? false;
  return (
    <tr>
      <td>
        <div style={{ fontWeight: 600 }}>
          {campo.nome} {campo.obrigatorio && <span style={{ color: 'var(--perigo, #d0585a)' }}>*</span>}
        </div>
        {campo.descricao && <div style={{ color: 'var(--texto-suave)', fontSize: 12 }}>{campo.descricao}</div>}
      </td>
      <td style={{ whiteSpace: 'nowrap', fontSize: 13 }}>{ROTULO_TIPO_CAMPO[campo.tipo as TipoCampoDespachante] ?? campo.tipo}</td>
      <td>{valor ? <ValorCampo campo={campo} valor={valor} onVer={onVer} /> : <span style={{ color: 'var(--texto-suave)' }}>—</span>}</td>
      <td style={{ whiteSpace: 'nowrap' }}>
        {!preenchido ? (
          <span className="etiqueta" style={{ color: '#c99a2e' }}>Pendente</span>
        ) : valor?.status === 'APROVADO' ? (
          <span className="etiqueta ok">Aprovado</span>
        ) : valor?.status === 'REJEITADO' ? (
          <span className="etiqueta" style={{ color: 'var(--perigo, #d0585a)' }} title={valor?.motivo ?? ''}>Rejeitado</span>
        ) : (
          <span className="etiqueta">Enviado</span>
        )}
      </td>
      <td style={{ whiteSpace: 'nowrap' }}>
        {valor && preenchido && (
          <>
            <button className="secundario pequeno" disabled={ocupado} onClick={() => onRevisar(valor.id, true)}>✓</button>
            <button className="perigo pequeno" disabled={ocupado} onClick={() => onRevisar(valor.id, false)} style={{ marginLeft: 4 }}>✕</button>
          </>
        )}
      </td>
    </tr>
  );
}

function ValorCampo({ campo, valor, onVer }: { campo: CampoDespachante; valor: ValorCampoDespachante; onVer: (id: string) => void }) {
  if (campo.tipo === 'ARQUIVO') {
    return valor.temArquivo ? (
      <button className="secundario pequeno" onClick={() => onVer(valor.id)}>Ver arquivo</button>
    ) : (
      <span style={{ color: 'var(--texto-suave)' }}>—</span>
    );
  }
  if (campo.tipo === 'CHECKBOX') {
    return <span>{valor.valorTexto === 'true' ? '✓ Sim' : '✕ Não'}</span>;
  }
  if (campo.tipo === 'SENHA_GOV') {
    return (
      <div style={{ fontFamily: 'monospace', fontSize: 13 }}>
        <div>CPF: {valor.valorCpf ?? '—'}</div>
        <div>Senha: {valor.valorTexto ? valor.valorTexto : <span style={{ color: 'var(--texto-suave)' }}>—</span>}</div>
      </div>
    );
  }
  return <span>{valor.valorTexto ?? '—'}</span>;
}

function ObservacaoInterna({ id, inicial }: { id: string; inicial: string }) {
  const [texto, setTexto] = useState(inicial);
  const [salvando, setSalvando] = useState(false);
  const alterado = texto !== inicial;
  return (
    <div className="campo" style={{ marginTop: 12, marginBottom: 0 }}>
      <label>Anotação interna (não vai para o app)</label>
      <textarea value={texto} onChange={(e) => setTexto(e.target.value)} style={{ minHeight: 48 }} />
      {alterado && (
        <button
          className="secundario pequeno"
          style={{ marginTop: 6, width: 'fit-content' }}
          disabled={salvando}
          onClick={async () => {
            setSalvando(true);
            try {
              await api(`/api/admin/despachante/processos/${id}`, { metodo: 'PATCH', corpo: { observacao: texto } });
            } finally {
              setSalvando(false);
            }
          }}
        >
          Salvar anotação
        </button>
      )}
    </div>
  );
}

function AnexarFinal({ id, aoAnexar }: { id: string; aoAnexar: () => void }) {
  const [enviando, setEnviando] = useState(false);
  async function escolher(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setEnviando(true);
    try {
      const { mime, base64, nome } = await lerArquivo(file);
      await api(`/api/admin/despachante/processos/${id}/final`, { metodo: 'POST', corpo: { nome, mime, dadosBase64: base64 } });
      aoAnexar();
    } catch (err) {
      alert(err instanceof ErroApi ? err.message : 'Falha ao anexar');
    } finally {
      setEnviando(false);
    }
  }
  return (
    <label className="secundario pequeno" style={{ cursor: 'pointer', display: 'inline-block' }}>
      {enviando ? 'Enviando…' : '+ Anexar documento final'}
      <input type="file" onChange={escolher} disabled={enviando} style={{ display: 'none' }} />
    </label>
  );
}
