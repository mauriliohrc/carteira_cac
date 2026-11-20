'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api, ErroApi } from '@/lib/api';
import {
  ROTULO_PAPEL_STATUS,
  ROTULO_TIPO_CAMPO,
  type CampoDespachante,
  type CatalogoDespachante,
  type PapelStatusDespachante,
  type ServicoDespachanteAdmin,
  type StatusDespachante,
  type TipoCampoDespachante,
} from '@/lib/tipos';
import { Protegido } from '../../componentes/Protegido';

const PAPEIS = Object.keys(ROTULO_PAPEL_STATUS) as PapelStatusDespachante[];
const TIPOS_CAMPO = Object.keys(ROTULO_TIPO_CAMPO) as TipoCampoDespachante[];

function reais(c: number) {
  return (c / 100).toFixed(2).replace('.', ',');
}
function paraCentavos(v: string) {
  return Math.round(parseFloat(v.replace(',', '.') || '0') * 100);
}

export default function PaginaCatalogo() {
  return (
    <Protegido>
      <Catalogo />
    </Protegido>
  );
}

function Catalogo() {
  const [cat, setCat] = useState<CatalogoDespachante | null>(null);
  const [aba, setAba] = useState<'servicos' | 'status'>('servicos');

  const carregar = useCallback(async () => {
    const r = await api<CatalogoDespachante>('/api/admin/despachante/catalogo');
    setCat(r);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  if (!cat) return <div className="vazio">Carregando…</div>;

  return (
    <>
      <div className="cabeca-secao">
        <div>
          <h1>Catálogo do despachante</h1>
          <p className="subtitulo">
            Serviços, formulários de documentos e status do processo — tudo editável, vale na hora.
          </p>
        </div>
        <Link href="/despachante" className="secundario pequeno" style={{ textDecoration: 'none' }}>
          Ver fila de processos →
        </Link>
      </div>

      <div className="filtros" style={{ marginBottom: 16 }}>
        <div className="filtro-grupo">
          <button className={`filtro-chip ${aba === 'servicos' ? 'ativo' : ''}`} onClick={() => setAba('servicos')}>
            Serviços
          </button>
          <button className={`filtro-chip ${aba === 'status' ? 'ativo' : ''}`} onClick={() => setAba('status')}>
            Status
          </button>
        </div>
      </div>

      {aba === 'status' && (
        <>
          <p className="subtitulo" style={{ marginTop: 0 }}>
            A cor pinta a bolinha/etiqueta. O “papel” define a automação (pago, aguardando
            documentação, final…). Status novos aparecem para apps antigos como o andamento
            equivalente.
          </p>
          <SecaoStatus status={cat.status} aoMudar={carregar} />
        </>
      )}

      {aba === 'servicos' && (
        <>
          <p className="subtitulo" style={{ marginTop: 0 }}>
            Cada serviço tem textos, preço, ícone e um formulário de documentos que o usuário preenche.
          </p>
          <ServicoNovo aoMudar={carregar} />
          {cat.servicos.map((s) => (
            <ServicoCard key={s.id} servico={s} aoMudar={carregar} />
          ))}
        </>
      )}
    </>
  );
}

// --------------------------------------------------------------- status
function SecaoStatus({ status, aoMudar }: { status: StatusDespachante[]; aoMudar: () => void }) {
  return (
    <div className="cartao" style={{ padding: 0, overflowX: 'auto' }}>
      <table>
        <thead>
          <tr>
            <th>Cor</th>
            <th>Label</th>
            <th>Ícone (Ionicons)</th>
            <th>Papel</th>
            <th>Ordem</th>
            <th>Ativo</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {status.map((s) => (
            <LinhaStatus key={s.id} status={s} aoMudar={aoMudar} />
          ))}
          <LinhaStatus aoMudar={aoMudar} />
        </tbody>
      </table>
    </div>
  );
}

function LinhaStatus({ status, aoMudar }: { status?: StatusDespachante; aoMudar: () => void }) {
  const novo = !status;
  const [label, setLabel] = useState(status?.label ?? '');
  const [cor, setCor] = useState(status?.cor ?? '#5b8def');
  const [icone, setIcone] = useState(status?.icone ?? '');
  const [papel, setPapel] = useState<PapelStatusDespachante>(status?.papel ?? 'NORMAL');
  const [ordem, setOrdem] = useState(String(status?.ordem ?? 999));
  const [ativo, setAtivo] = useState(status?.ativo ?? true);
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    if (!label.trim()) return;
    setSalvando(true);
    try {
      const corpo = { label, cor, icone: icone || null, papel, ordem: Number(ordem) || 0, ativo };
      if (novo) {
        await api('/api/admin/despachante/status', { metodo: 'POST', corpo });
        setLabel('');
        setIcone('');
      } else {
        await api(`/api/admin/despachante/status/${status!.id}`, { metodo: 'PUT', corpo });
      }
      aoMudar();
    } catch (e) {
      alert(e instanceof ErroApi ? e.message : 'Falha ao salvar');
    } finally {
      setSalvando(false);
    }
  }

  async function excluir() {
    if (!status || !confirm(`Excluir o status "${status.label}"?`)) return;
    try {
      await api(`/api/admin/despachante/status/${status.id}`, { metodo: 'DELETE' });
      aoMudar();
    } catch (e) {
      alert(e instanceof ErroApi ? e.message : 'Falha ao excluir');
    }
  }

  return (
    <tr>
      <td>
        <input type="color" value={cor} onChange={(e) => setCor(e.target.value)} style={{ width: 42, height: 30, padding: 0 }} />
      </td>
      <td>
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={novo ? 'Novo status…' : ''} style={{ minWidth: 150 }} />
      </td>
      <td>
        <input value={icone} onChange={(e) => setIcone(e.target.value)} placeholder="ex.: time-outline" style={{ minWidth: 140 }} />
      </td>
      <td>
        <select value={papel} onChange={(e) => setPapel(e.target.value as PapelStatusDespachante)} style={{ width: 'auto' }}>
          {PAPEIS.map((p) => (
            <option key={p} value={p}>{ROTULO_PAPEL_STATUS[p]}</option>
          ))}
        </select>
      </td>
      <td>
        <input value={ordem} onChange={(e) => setOrdem(e.target.value)} inputMode="numeric" style={{ width: 60 }} />
      </td>
      <td style={{ textAlign: 'center' }}>
        <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} style={{ width: 'auto' }} />
      </td>
      <td style={{ whiteSpace: 'nowrap' }}>
        <button className="secundario pequeno" disabled={salvando || !label.trim()} onClick={salvar}>
          {novo ? 'Adicionar' : 'Salvar'}
        </button>
        {!novo && (
          <button className="perigo pequeno" onClick={excluir} style={{ marginLeft: 4 }}>
            Excluir
          </button>
        )}
      </td>
    </tr>
  );
}

// --------------------------------------------------------------- serviços
function ServicoNovo({ aoMudar }: { aoMudar: () => void }) {
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState('');
  const [salvando, setSalvando] = useState(false);

  async function criar() {
    if (!nome.trim()) return;
    setSalvando(true);
    try {
      await api('/api/admin/despachante/servicos', {
        metodo: 'POST',
        corpo: { nome, descricao: '', gruCentavos: 0, servicoCentavos: 0 },
      });
      setNome('');
      setAberto(false);
      aoMudar();
    } catch (e) {
      alert(e instanceof ErroApi ? e.message : 'Falha ao criar');
    } finally {
      setSalvando(false);
    }
  }

  if (!aberto)
    return (
      <button className="secundario" onClick={() => setAberto(true)} style={{ marginBottom: 14 }}>
        + Novo serviço
      </button>
    );

  return (
    <div className="cartao" style={{ marginBottom: 14 }}>
      <div className="campo">
        <label>Nome do novo serviço</label>
        <input value={nome} onChange={(e) => setNome(e.target.value)} autoFocus />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={criar} disabled={salvando || !nome.trim()}>Criar</button>
        <button className="secundario" onClick={() => setAberto(false)}>Cancelar</button>
      </div>
    </div>
  );
}

function ServicoCard({ servico, aoMudar }: { servico: ServicoDespachanteAdmin; aoMudar: () => void }) {
  const [nome, setNome] = useState(servico.nome);
  const [subtitulo, setSubtitulo] = useState(servico.subtitulo ?? '');
  const [icone, setIcone] = useState(servico.icone);
  const [descricao, setDescricao] = useState(servico.descricao);
  const [comoFunciona, setComoFunciona] = useState(servico.comoFunciona ?? '');
  const [gru, setGru] = useState(reais(servico.gruCentavos));
  const [serv, setServ] = useState(reais(servico.servicoCentavos));
  const [unidade, setUnidade] = useState(servico.unidade);
  const [porArma, setPorArma] = useState(servico.porArma);
  const [ativo, setAtivo] = useState(servico.ativo);
  const [ordem, setOrdem] = useState(String(servico.ordem));
  const [msg, setMsg] = useState(servico.mensagemWhatsappInicio ?? '');
  const [termo, setTermo] = useState(servico.termoAceite ?? '');
  const [salvando, setSalvando] = useState(false);
  const [aberto, setAberto] = useState(false);
  const [abaServ, setAbaServ] = useState<'dados' | 'documentos'>('dados');

  async function salvar() {
    setSalvando(true);
    try {
      await api(`/api/admin/despachante/servicos/${servico.id}`, {
        metodo: 'PUT',
        corpo: {
          nome,
          subtitulo: subtitulo || null,
          descricao,
          comoFunciona: comoFunciona || null,
          icone,
          gruCentavos: paraCentavos(gru),
          servicoCentavos: paraCentavos(serv),
          unidade,
          porArma,
          ativo,
          ordem: Number(ordem) || 0,
          mensagemWhatsappInicio: msg || null,
          termoAceite: termo || null,
        },
      });
      aoMudar();
    } catch (e) {
      alert(e instanceof ErroApi ? e.message : 'Falha ao salvar');
    } finally {
      setSalvando(false);
    }
  }

  async function excluir() {
    if (!confirm(`Excluir o serviço "${servico.nome}"?`)) return;
    try {
      await api(`/api/admin/despachante/servicos/${servico.id}`, { metodo: 'DELETE' });
      aoMudar();
    } catch (e) {
      alert(e instanceof ErroApi ? e.message : 'Falha ao excluir');
    }
  }

  const total = paraCentavos(gru) + paraCentavos(serv);

  return (
    <div className="cartao" style={{ marginBottom: 12, opacity: servico.ativo ? 1 : 0.6 }}>
      <div
        onClick={() => setAberto((v) => !v)}
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', cursor: 'pointer' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <span style={{ color: 'var(--texto-suave)' }}>{aberto ? '▾' : '▸'}</span>
          <strong style={{ fontSize: 16 }}>{servico.nome}</strong>
          <span className="etiqueta" style={{ fontFamily: 'monospace' }}>{servico.codigo}</span>
          {!servico.ativo && <span className="etiqueta inativo">inativo</span>}
        </div>
        <span style={{ color: 'var(--texto-suave)', fontSize: 13, whiteSpace: 'nowrap' }}>
          R$ {reais(servico.precoCentavos)} · {servico.campos.length} campo(s)
        </span>
      </div>

      {aberto && (
      <>
      <div className="filtros" style={{ marginTop: 12 }}>
        <div className="filtro-grupo">
          <button className={`filtro-chip ${abaServ === 'dados' ? 'ativo' : ''}`} onClick={() => setAbaServ('dados')}>
            Dados
          </button>
          <button className={`filtro-chip ${abaServ === 'documentos' ? 'ativo' : ''}`} onClick={() => setAbaServ('documentos')}>
            Documentos ({servico.campos.length})
          </button>
        </div>
      </div>

      {abaServ === 'dados' && (
      <>
      <div className="grade cols-2" style={{ marginTop: 10 }}>
        <div className="campo"><label>Nome (título)</label><input value={nome} onChange={(e) => setNome(e.target.value)} /></div>
        <div className="campo"><label>Subtítulo (card)</label><input value={subtitulo} onChange={(e) => setSubtitulo(e.target.value)} /></div>
        <div className="campo"><label>Ícone (Ionicons)</label><input value={icone} onChange={(e) => setIcone(e.target.value)} placeholder="ex.: leaf-outline" /></div>
        <div className="campo"><label>Unidade</label><input value={unidade} onChange={(e) => setUnidade(e.target.value)} placeholder="por processo" /></div>
        <div className="campo"><label>GRU / taxa (R$)</label><input value={gru} onChange={(e) => setGru(e.target.value)} inputMode="decimal" /></div>
        <div className="campo"><label>Honorário (R$)</label><input value={serv} onChange={(e) => setServ(e.target.value)} inputMode="decimal" /></div>
      </div>

      <div className="campo"><label>Descrição</label><textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} style={{ minHeight: 70 }} /></div>
      <div className="campo"><label>Como funciona (passos / orientações)</label><textarea value={comoFunciona} onChange={(e) => setComoFunciona(e.target.value)} style={{ minHeight: 70 }} /></div>
      <div className="campo">
        <label>Mensagem de WhatsApp ao iniciar (use {'{{nome}}'})</label>
        <textarea value={msg} onChange={(e) => setMsg(e.target.value)} style={{ minHeight: 60 }} />
      </div>
      <div className="campo">
        <label>Termo de aceite (o usuário aceita antes de contratar — deixe vazio para não exigir)</label>
        <textarea value={termo} onChange={(e) => setTermo(e.target.value)} style={{ minHeight: 80 }} />
      </div>

      <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <label className="radio-opcao" style={{ width: 'fit-content' }}>
          <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} style={{ width: 'auto' }} /> Ativo
        </label>
        <label className="radio-opcao" style={{ width: 'fit-content' }} title="O usuário escolhe a(s) arma(s) e paga por item (um processo por arma).">
          <input type="checkbox" checked={porArma} onChange={(e) => setPorArma(e.target.checked)} style={{ width: 'auto' }} /> Vinculado a uma arma (cobra por arma)
        </label>
        <div className="campo" style={{ margin: 0 }}>
          <label>Ordem</label>
          <input value={ordem} onChange={(e) => setOrdem(e.target.value)} inputMode="numeric" style={{ width: 70 }} />
        </div>
        <strong style={{ marginLeft: 'auto' }}>Total: R$ {reais(total)}</strong>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <button onClick={salvar} disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar serviço'}</button>
        <button className="perigo" onClick={excluir}>Excluir</button>
      </div>
      </>
      )}

      {abaServ === 'documentos' && (
        <CamposServico servicoId={servico.id} campos={servico.campos} aoMudar={aoMudar} />
      )}
      </>
      )}
    </div>
  );
}

// --------------------------------------------------------------- campos do formulário
function CamposServico({
  servicoId,
  campos,
  aoMudar,
}: {
  servicoId: string;
  campos: CampoDespachante[];
  aoMudar: () => void;
}) {
  return (
    <div style={{ marginTop: 14, borderTop: '1px solid var(--borda)', paddingTop: 12 }}>
      <div style={{ fontWeight: 600, marginBottom: 8 }}>Formulário de documentos</div>
      {campos.length === 0 && (
        <p className="subtitulo" style={{ marginTop: 0 }}>Nenhum campo ainda. Adicione o que o usuário precisa enviar.</p>
      )}
      {campos.map((c) => (
        <CampoLinha key={c.id} servicoId={servicoId} campo={c} aoMudar={aoMudar} />
      ))}
      <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--texto-suave)', margin: '12px 0 6px' }}>
        Adicionar campo
      </div>
      <CampoLinha servicoId={servicoId} aoMudar={aoMudar} />
    </div>
  );
}

function CampoLinha({
  servicoId,
  campo,
  aoMudar,
}: {
  servicoId: string;
  campo?: CampoDespachante;
  aoMudar: () => void;
}) {
  const novo = !campo;
  const [tipo, setTipo] = useState<TipoCampoDespachante>(campo?.tipo ?? 'ARQUIVO');
  const [nome, setNome] = useState(campo?.nome ?? '');
  const [descricao, setDescricao] = useState(campo?.descricao ?? '');
  const [obrigatorio, setObrigatorio] = useState(campo?.obrigatorio ?? true);
  const [ordem, setOrdem] = useState(String(campo?.ordem ?? 999));
  const [ativo, setAtivo] = useState(campo?.ativo ?? true);
  const [salvando, setSalvando] = useState(false);
  const [aberto, setAberto] = useState(false);

  async function salvar() {
    if (!nome.trim()) return;
    setSalvando(true);
    try {
      const corpo = { tipo, nome, descricao: descricao || null, obrigatorio, ordem: Number(ordem) || 0, ativo };
      if (novo) {
        await api(`/api/admin/despachante/servicos/${servicoId}/campos`, { metodo: 'POST', corpo });
        setNome('');
        setDescricao('');
      } else {
        await api(`/api/admin/despachante/campos/${campo!.id}`, { metodo: 'PUT', corpo });
      }
      aoMudar();
    } catch (e) {
      alert(e instanceof ErroApi ? e.message : 'Falha ao salvar campo');
    } finally {
      setSalvando(false);
    }
  }

  async function excluir() {
    if (!campo || !confirm(`Excluir o campo "${campo.nome}"?`)) return;
    try {
      await api(`/api/admin/despachante/campos/${campo.id}`, { metodo: 'DELETE' });
      aoMudar();
    } catch (e) {
      alert(e instanceof ErroApi ? e.message : 'Falha ao excluir');
    }
  }

  return (
    <div
      className="cartao"
      style={{ background: 'var(--superficie-2)', padding: 10, marginBottom: 8, opacity: (campo?.ativo ?? true) ? 1 : 0.6 }}
    >
      {!novo && (
        <div onClick={() => setAberto((v) => !v)} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--texto-suave)' }}>{aberto ? '▾' : '▸'}</span>
          <strong style={{ fontSize: 14 }}>{campo!.nome}</strong>
          <span className="etiqueta">{ROTULO_TIPO_CAMPO[campo!.tipo]}</span>
          {campo!.obrigatorio && <span className="etiqueta" style={{ color: '#c99a2e' }}>obrigatório</span>}
          {!campo!.ativo && <span className="etiqueta inativo">inativo</span>}
        </div>
      )}
      {(novo || aberto) && (
      <>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end', marginTop: novo ? 0 : 10 }}>
        <div className="campo" style={{ margin: 0, minWidth: 180 }}>
          <label>Tipo</label>
          <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoCampoDespachante)}>
            {TIPOS_CAMPO.map((t) => (
              <option key={t} value={t}>{ROTULO_TIPO_CAMPO[t]}</option>
            ))}
          </select>
        </div>
        <div className="campo" style={{ margin: 0, flex: 1, minWidth: 160 }}>
          <label>Nome do campo</label>
          <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder={novo ? 'Novo campo…' : ''} />
        </div>
        <div className="campo" style={{ margin: 0 }}>
          <label>Ordem</label>
          <input value={ordem} onChange={(e) => setOrdem(e.target.value)} inputMode="numeric" style={{ width: 60 }} />
        </div>
        <label className="radio-opcao" style={{ width: 'fit-content', marginBottom: 6 }}>
          <input type="checkbox" checked={obrigatorio} onChange={(e) => setObrigatorio(e.target.checked)} style={{ width: 'auto' }} /> Obrigatório
        </label>
        {!novo && (
          <label className="radio-opcao" style={{ width: 'fit-content', marginBottom: 6 }}>
            <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} style={{ width: 'auto' }} /> Ativo
          </label>
        )}
      </div>
      <div className="campo" style={{ marginTop: 8, marginBottom: 8 }}>
        <label>Instruções (o que é / onde conseguir)</label>
        <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} style={{ minHeight: 46 }} />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="secundario pequeno" onClick={salvar} disabled={salvando || !nome.trim()}>
          {novo ? 'Adicionar campo' : 'Salvar campo'}
        </button>
        {!novo && <button className="perigo pequeno" onClick={excluir}>Excluir</button>}
      </div>
      </>
      )}
    </div>
  );
}
