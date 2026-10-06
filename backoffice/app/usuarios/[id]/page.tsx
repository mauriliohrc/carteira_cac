'use client';

import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api, ErroApi } from '@/lib/api';
import { dataHora, tempoRelativo } from '@/lib/formato';
import {
  ACERVOS,
  DEFS_DOC,
  DEF_DOC_POR_TIPO,
  ROTULO_ACERVO,
  ROTULO_GRUPO,
  type ArmaApp,
  type DocumentoApp,
  type Entidade,
  type PerfilUsuarioApp,
} from '@/lib/tipos';

const GRUPOS = Object.keys(ROTULO_GRUPO);
import { Protegido } from '../../componentes/Protegido';

export default function PaginaPerfil({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <Protegido>
      <Perfil id={id} />
    </Protegido>
  );
}

function dataBR(iso: string | null | undefined) {
  if (!iso) return '—';
  const s = String(iso).slice(0, 10);
  const [a, m, d] = s.split('-');
  return d ? `${d}/${m}/${a}` : s;
}
function venceu(iso: string | null) {
  if (!iso) return false;
  return String(iso).slice(0, 10) < new Date().toISOString().slice(0, 10);
}

interface EdicaoDoc {
  armaId: string | null;
  escopo: 'ARMA' | 'PESSOAL';
  documento?: DocumentoApp;
}

function Perfil({ id }: { id: string }) {
  const [perfil, setPerfil] = useState<PerfilUsuarioApp | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [edicao, setEdicao] = useState<EdicaoDoc | null>(null);
  const [novaArma, setNovaArma] = useState(false);
  const [novaHab, setNovaHab] = useState(false);
  const [editando, setEditando] = useState(false);
  const [entidadesDisp, setEntidadesDisp] = useState<Entidade[]>([]);

  const carregar = useCallback(async () => {
    const r = await api<PerfilUsuarioApp>(`/api/admin/usuarios-app/${id}/perfil`);
    setPerfil(r);
    setCarregando(false);
  }, [id]);

  useEffect(() => {
    carregar().catch(() => setCarregando(false));
    api<{ entidades: Entidade[] }>('/api/admin/entidades').then((r) => setEntidadesDisp(r.entidades));
  }, [carregar]);

  async function adicionarVinculo(entidadeId: string) {
    if (!entidadeId) return;
    await api(`/api/admin/usuarios-app/${id}/vinculos`, { metodo: 'POST', corpo: { entidadeId } });
    carregar();
  }
  async function removerVinculo(entidadeId: string) {
    await api(`/api/admin/usuarios-app/${id}/vinculos/${entidadeId}`, { metodo: 'DELETE' });
    carregar();
  }

  async function excluir(tipo: string, registroId: string, rotulo: string) {
    if (!confirm(`Excluir ${rotulo}? Também remove do app do usuário na próxima sincronização.`)) return;
    await api(`/api/admin/usuarios-app/${id}/registros/${tipo}/${registroId}`, { metodo: 'DELETE' });
    carregar();
  }

  async function verArquivo(registroId: string) {
    const r = await api<{ base64: string; mime: string | null }>(
      `/api/admin/usuarios-app/${id}/arquivo/${registroId}`
    );
    const win = window.open();
    if (win)
      win.document.write(
        `<iframe src="data:${r.mime ?? 'application/octet-stream'};base64,${r.base64}" style="border:0;width:100%;height:100%"></iframe>`
      );
  }

  if (carregando) return <div className="vazio">Carregando…</div>;
  if (!perfil) return <div className="vazio">Usuário não encontrado.</div>;

  const u = perfil.usuario;
  const online = u.ultimoAcessoEm && Date.now() - new Date(u.ultimoAcessoEm).getTime() < 5 * 60000;
  const arquivosPorDoc = new Map(perfil.arquivos.map((a) => [a.documento_id, a.id]));
  const docsDaArma = (armaId: string) => perfil.documentos.filter((d) => d.arma_id === armaId);
  const docsPessoais = perfil.documentos.filter((d) => !d.arma_id);

  function fecharEdicao(recarregar: boolean) {
    setEdicao(null);
    if (recarregar) carregar();
  }

  function LinhaDoc({ d }: { d: DocumentoApp }) {
    const def = DEF_DOC_POR_TIPO[d.tipo];
    const arqId = arquivosPorDoc.get(d.id);
    return (
      <div className="doc-linha">
        <span className="doc-badge">{def?.rotulo ?? d.tipo}</span>
        <div className="doc-info">
          <div className="doc-titulo">{d.titulo || d.numero || def?.rotulo || d.tipo}</div>
          <div className="doc-sub">
            {d.numero ? `${def?.numeroLabel ?? 'Nº'}: ${d.numero}` : ''}
            {def?.trajeto && (d.origem || d.destino)
              ? `${d.numero ? ' · ' : ''}${d.origem ?? '?'} → ${d.destino ?? '?'}`
              : ''}
            {d.data_emissao ? ` · emissão ${dataBR(d.data_emissao)}` : ''}
          </div>
        </div>
        <div className="doc-validade">
          vence{' '}
          <span className={venceu(d.data_validade) ? 'vencido' : 'ok'}>{dataBR(d.data_validade)}</span>
          {venceu(d.data_validade) ? ' (vencido)' : ''}
        </div>
        <div className="doc-acoes">
          {arqId ? (
            <button className="secundario pequeno" onClick={() => verArquivo(arqId)}>
              Ver arquivo
            </button>
          ) : (
            <span style={{ color: 'var(--texto-suave)', fontSize: 12, alignSelf: 'center' }}>
              sem arquivo
            </span>
          )}
          <button
            className="secundario pequeno"
            onClick={() => setEdicao({ armaId: d.arma_id, escopo: def?.escopo ?? 'PESSOAL', documento: d })}
          >
            Editar
          </button>
          <button className="perigo pequeno" onClick={() => excluir('documentos', d.id, def?.rotulo ?? 'documento')}>
            Excluir
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <p style={{ marginTop: 0 }}>
        <Link href="/usuarios">← Usuários</Link>
      </p>
      <div className="cabeca-secao">
        <div>
          <h1>{u.nome}</h1>
          <p className="subtitulo">
            {u.email} · CPF {u.cpf} {u.ativo ? '' : '· conta inativa'}
          </p>
        </div>
        {!editando && (
          <button className="secundario pequeno" onClick={() => setEditando(true)}>
            Editar dados
          </button>
        )}
      </div>

      {editando ? (
        <FormularioDadosUsuario
          usuarioId={id}
          inicial={{ nome: u.nome, email: u.email, cpf: u.cpf, ativo: u.ativo }}
          aoConcluir={() => {
            setEditando(false);
            carregar();
          }}
          aoCancelar={() => setEditando(false)}
        />
      ) : (
        <div className="cartao" style={{ marginBottom: 20 }}>
          <div className="grade cols-2">
            <Campo rotulo="Conta criada em" valor={dataHora(u.criadoEm)} />
            <Campo rotulo="Último acesso" valor={online ? 'online agora' : tempoRelativo(u.ultimoAcessoEm)} />
            <Campo rotulo="E-mail verificado" valor={u.emailVerificado ? 'Sim' : 'Não'} />
            <Campo rotulo="Plano" valor={u.premium ? 'Premium' : 'Grátis'} />
            <Campo rotulo="Status" valor={u.ativo ? 'Ativa' : 'Inativa'} />
          </div>
        </div>
      )}

      {/* Entidades vinculadas (automático via Shooting House ou manual) */}
      <div className="cartao" style={{ marginBottom: 24 }}>
        <label style={{ marginBottom: 10 }}>Entidades vinculadas</label>
        {u.entidades.length === 0 ? (
          <div className="vazio-inline">Nenhum vínculo. O vínculo entra sozinho quando o CPF é sócio ativo de um parceiro.</div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            {u.entidades.map((e) => (
              <span key={e.id} className="etiqueta" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                {e.nome}
                <span style={{ color: 'var(--texto-suave)', fontSize: 10 }}>
                  {e.origem === 'SHOOTING_HOUSE' ? 'auto' : 'manual'}
                </span>
                <span
                  onClick={() => removerVinculo(e.id)}
                  style={{ cursor: 'pointer', color: 'var(--perigo)', fontWeight: 700 }}
                  title="Remover vínculo"
                >
                  ×
                </span>
              </span>
            ))}
          </div>
        )}
        <select defaultValue="" onChange={(ev) => { adicionarVinculo(ev.target.value); ev.target.value = ''; }} style={{ maxWidth: 260 }}>
          <option value="">+ Vincular a uma entidade…</option>
          {entidadesDisp
            .filter((e) => !u.entidades.some((v) => v.id === e.id))
            .map((e) => (
              <option key={e.id} value={e.id}>
                {e.nome}
              </option>
            ))}
        </select>
      </div>

      {/* Formulário flutuante de documento (add/editar) */}
      {edicao && (
        <FormularioDocumento
          usuarioId={id}
          armaId={edicao.armaId}
          escopo={edicao.escopo}
          documento={edicao.documento}
          aoConcluir={() => fecharEdicao(true)}
          aoCancelar={() => fecharEdicao(false)}
        />
      )}

      {/* ------------------------------ Acervo ------------------------------ */}
      <div className="cabeca-secao">
        <h2 style={{ margin: 0 }}>
          Acervo ({perfil.armas.length} arma{perfil.armas.length !== 1 ? 's' : ''})
        </h2>
        {!novaArma && (
          <button className="pequeno" onClick={() => setNovaArma(true)}>
            + Nova arma
          </button>
        )}
      </div>
      {novaArma && (
        <FormularioArma
          usuarioId={id}
          aoConcluir={() => {
            setNovaArma(false);
            carregar();
          }}
          aoCancelar={() => setNovaArma(false)}
        />
      )}
      {perfil.armas.length === 0 ? (
        <div className="cartao" style={{ marginBottom: 24 }}>
          <div className="vazio-inline">Nenhuma arma cadastrada.</div>
        </div>
      ) : (
        perfil.armas.map((a: ArmaApp) => {
          const docs = docsDaArma(a.id);
          return (
            <div className="arma-card" key={a.id}>
              <div className="arma-topo">
                <div>
                  <div className="arma-nome">{a.apelido ? `${a.modelo} (${a.apelido})` : a.modelo}</div>
                  <div className="arma-meta">
                    {[a.calibre, ROTULO_GRUPO[a.grupo] ?? a.grupo, a.numero_serie ? `série ${a.numero_serie}` : '']
                      .filter(Boolean)
                      .join(' · ')}
                  </div>
                </div>
                <button className="perigo pequeno" onClick={() => excluir('armas', a.id, a.modelo)}>
                  Excluir arma
                </button>
              </div>
              <div className="arma-docs">
                {docs.length === 0 ? (
                  <div className="vazio-inline">Sem documentos vinculados.</div>
                ) : (
                  docs.map((d) => <LinhaDoc key={d.id} d={d} />)
                )}
                <div className="secao-add">
                  <button
                    className="pequeno"
                    onClick={() => setEdicao({ armaId: a.id, escopo: 'ARMA' })}
                  >
                    + Documento desta arma
                  </button>
                </div>
              </div>
            </div>
          );
        })
      )}

      {/* ----------------------- Documentos pessoais ----------------------- */}
      <div className="cabeca-secao" style={{ marginTop: 24 }}>
        <h2 style={{ margin: 0 }}>Documentos pessoais ({docsPessoais.length})</h2>
        <button className="pequeno" onClick={() => setEdicao({ armaId: null, escopo: 'PESSOAL' })}>
          + Documento pessoal
        </button>
      </div>
      <div className="cartao">
        {docsPessoais.length === 0 ? (
          <div className="vazio-inline">Nenhum documento pessoal (CR, laudos, filiação…).</div>
        ) : (
          docsPessoais.map((d) => <LinhaDoc key={d.id} d={d} />)
        )}
      </div>

      {/* --------------------------- Habitualidades --------------------------- */}
      <div className="cabeca-secao" style={{ marginTop: 24 }}>
        <h2 style={{ margin: 0 }}>Habitualidades ({perfil.habitualidades.length})</h2>
        {!novaHab && (
          <button className="pequeno" onClick={() => setNovaHab(true)}>
            + Lançar habitualidade
          </button>
        )}
      </div>
      {novaHab && (
        <FormularioHabitualidade
          usuarioId={id}
          armas={perfil.armas}
          aoConcluir={() => {
            setNovaHab(false);
            carregar();
          }}
          aoCancelar={() => setNovaHab(false)}
        />
      )}
      <div className="cartao" style={{ padding: 0 }}>
        {perfil.habitualidades.length === 0 ? (
          <div className="vazio">Nenhuma habitualidade.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Tipo</th>
                <th>Local</th>
                <th>Grupos</th>
                <th>Origem</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {perfil.habitualidades.map((h) => (
                <tr key={h.id}>
                  <td>{dataBR(h.data)}</td>
                  <td>{h.tipo === 'COMPETICAO' ? 'Competição' : 'Treino'}</td>
                  <td>{h.local_nome || '—'}</td>
                  <td>{(h._armas ?? []).map((x) => ROTULO_GRUPO[x.grupo] ?? x.grupo).join(', ') || '—'}</td>
                  <td>{h.origem === 'SHOOTING_HOUSE' ? 'Shooting House' : 'Manual'}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="perigo pequeno" onClick={() => excluir('habitualidades', h.id, 'habitualidade')}>
                      Excluir
                    </button>
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

function Campo({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div>
      <div style={{ color: 'var(--texto-suave)', fontSize: 12 }}>{rotulo}</div>
      <div>{valor}</div>
    </div>
  );
}

function FormularioDocumento({
  usuarioId,
  armaId,
  escopo,
  documento,
  aoConcluir,
  aoCancelar,
}: {
  usuarioId: string;
  armaId: string | null;
  escopo: 'ARMA' | 'PESSOAL';
  documento?: DocumentoApp;
  aoConcluir: () => void;
  aoCancelar: () => void;
}) {
  const tiposDisponiveis = DEFS_DOC.filter((d) => d.escopo === escopo);
  const [tipo, setTipo] = useState(documento?.tipo ?? tiposDisponiveis[0]?.valor ?? 'OUTRO');
  const [titulo, setTitulo] = useState(documento?.titulo ?? '');
  const [numero, setNumero] = useState(documento?.numero ?? '');
  const [origem, setOrigem] = useState(documento?.origem ?? '');
  const [destino, setDestino] = useState(documento?.destino ?? '');
  const [dataEmissao, setDataEmissao] = useState(documento?.data_emissao ?? '');
  const [dataValidade, setDataValidade] = useState(documento?.data_validade ?? '');
  const [observacoes, setObservacoes] = useState(documento?.observacoes ?? '');
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  const def = DEF_DOC_POR_TIPO[tipo];

  function lerBase64(f: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onerror = () => reject(new Error('Falha ao ler o arquivo'));
      r.onload = () => resolve(String(r.result).split(',')[1] ?? ''); // remove prefixo data:
      r.readAsDataURL(f);
    });
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!dataValidade) {
      setErro('Informe a data de validade.');
      return;
    }
    setErro('');
    setSalvando(true);
    try {
      const resp = await api<{ registroId: string }>(
        `/api/admin/usuarios-app/${usuarioId}/registros`,
        {
          metodo: 'POST',
          corpo: {
            tipo: 'documentos',
            registroId: documento?.id,
            dados: {
              ...(documento?.id ? { id: documento.id } : {}),
              tipo,
              arma_id: armaId,
              titulo: titulo.trim() || null,
              numero: numero.trim() || null,
              orgao: documento?.orgao ?? null,
              data_emissao: dataEmissao || null,
              data_validade: dataValidade,
              origem: def?.trajeto ? origem.trim() || null : null,
              destino: def?.trajeto ? destino.trim() || null : null,
              observacoes: observacoes.trim() || null,
            },
          },
        }
      );

      // Anexa o arquivo, se escolhido.
      if (arquivo) {
        const base64 = await lerBase64(arquivo);
        await api(`/api/admin/usuarios-app/${usuarioId}/arquivo`, {
          metodo: 'POST',
          corpo: { documentoId: resp.registroId, nome: arquivo.name, mime: arquivo.type || null, base64 },
        });
      }
      aoConcluir();
    } catch (err) {
      setErro(err instanceof ErroApi ? err.message : 'Falha ao salvar');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form className="cartao" onSubmit={salvar} style={{ marginBottom: 20, borderColor: 'var(--acento)' }}>
      <h3 style={{ marginTop: 0 }}>
        {documento ? 'Editar documento' : escopo === 'ARMA' ? 'Novo documento da arma' : 'Novo documento pessoal'}
      </h3>
      <div className="grade cols-2">
        <div className="campo">
          <label>Tipo *</label>
          <select value={tipo} onChange={(e) => setTipo(e.target.value)} disabled={!!documento}>
            {tiposDisponiveis.map((d) => (
              <option key={d.valor} value={d.valor}>
                {d.rotulo}
              </option>
            ))}
          </select>
        </div>
        <div className="campo">
          <label>{def?.numeroLabel ?? 'Número'}</label>
          <input value={numero} onChange={(e) => setNumero(e.target.value)} />
        </div>

        {def?.trajeto && (
          <>
            <div className="campo">
              <label>Origem</label>
              <input value={origem} onChange={(e) => setOrigem(e.target.value)} placeholder="Cidade/UF de origem" />
            </div>
            <div className="campo">
              <label>Destino</label>
              <input value={destino} onChange={(e) => setDestino(e.target.value)} placeholder="Cidade/UF de destino" />
            </div>
          </>
        )}

        <div className="campo">
          <label>Emissão</label>
          <input type="date" value={dataEmissao ?? ''} onChange={(e) => setDataEmissao(e.target.value)} />
        </div>
        <div className="campo">
          <label>Validade *</label>
          <input type="date" value={dataValidade ?? ''} onChange={(e) => setDataValidade(e.target.value)} required />
        </div>
        <div className="campo" style={{ gridColumn: '1 / -1' }}>
          <label>Título / observações (opcional)</label>
          <input value={titulo} onChange={(e) => setTitulo(e.target.value)} />
        </div>
        <div className="campo" style={{ gridColumn: '1 / -1' }}>
          <label>Arquivo (PDF ou imagem){documento ? ' — anexar um novo' : ''}</label>
          <input
            type="file"
            accept="application/pdf,image/*"
            onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
          />
        </div>
      </div>
      {erro && <p className="erro">{erro}</p>}
      <div className="linha-acoes">
        <button type="submit" disabled={salvando}>
          {salvando ? 'Salvando…' : documento ? 'Salvar alterações' : 'Adicionar'}
        </button>
        <button type="button" className="secundario" onClick={aoCancelar}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

function FormularioArma({
  usuarioId,
  aoConcluir,
  aoCancelar,
}: {
  usuarioId: string;
  aoConcluir: () => void;
  aoCancelar: () => void;
}) {
  const [modelo, setModelo] = useState('');
  const [apelido, setApelido] = useState('');
  const [numeroSerie, setNumeroSerie] = useState('');
  const [calibre, setCalibre] = useState('');
  const [acervo, setAcervo] = useState('ATIRADOR');
  const [grupo, setGrupo] = useState('CC_RESTRITA');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!modelo.trim() || !numeroSerie.trim() || !calibre.trim()) {
      setErro('Modelo, número de série e calibre são obrigatórios.');
      return;
    }
    setErro('');
    setSalvando(true);
    try {
      await api(`/api/admin/usuarios-app/${usuarioId}/registros`, {
        metodo: 'POST',
        corpo: {
          tipo: 'armas',
          dados: {
            modelo: modelo.trim(),
            apelido: apelido.trim() || null,
            numero_serie: numeroSerie.trim(),
            calibre: calibre.trim(),
            acervo,
            grupo,
          },
        },
      });
      aoConcluir();
    } catch (err) {
      setErro(err instanceof ErroApi ? err.message : 'Falha ao salvar');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form className="cartao" onSubmit={salvar} style={{ marginBottom: 16, borderColor: 'var(--acento)' }}>
      <h3 style={{ marginTop: 0 }}>Nova arma</h3>
      <div className="grade cols-2">
        <div className="campo">
          <label>Modelo *</label>
          <input value={modelo} onChange={(e) => setModelo(e.target.value)} required />
        </div>
        <div className="campo">
          <label>Apelido (opcional)</label>
          <input value={apelido} onChange={(e) => setApelido(e.target.value)} />
        </div>
        <div className="campo">
          <label>Nº de série *</label>
          <input value={numeroSerie} onChange={(e) => setNumeroSerie(e.target.value)} required />
        </div>
        <div className="campo">
          <label>Calibre *</label>
          <input value={calibre} onChange={(e) => setCalibre(e.target.value)} placeholder="Ex.: 9x19mm" required />
        </div>
        <div className="campo">
          <label>Acervo</label>
          <select value={acervo} onChange={(e) => setAcervo(e.target.value)}>
            {ACERVOS.map((a) => (
              <option key={a} value={a}>
                {ROTULO_ACERVO[a]}
              </option>
            ))}
          </select>
        </div>
        <div className="campo">
          <label>Grupo</label>
          <select value={grupo} onChange={(e) => setGrupo(e.target.value)}>
            {GRUPOS.map((g) => (
              <option key={g} value={g}>
                {ROTULO_GRUPO[g]}
              </option>
            ))}
          </select>
        </div>
      </div>
      {erro && <p className="erro">{erro}</p>}
      <div className="linha-acoes">
        <button type="submit" disabled={salvando}>
          {salvando ? 'Salvando…' : 'Adicionar arma'}
        </button>
        <button type="button" className="secundario" onClick={aoCancelar}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

function FormularioHabitualidade({
  usuarioId,
  armas,
  aoConcluir,
  aoCancelar,
}: {
  usuarioId: string;
  armas: ArmaApp[];
  aoConcluir: () => void;
  aoCancelar: () => void;
}) {
  const [data, setData] = useState('');
  const [tipo, setTipo] = useState('TREINO');
  const [localNome, setLocalNome] = useState('');
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [grupoAvulso, setGrupoAvulso] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  function alternar(id: string) {
    setSelecionadas((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!data) {
      setErro('Informe a data.');
      return;
    }
    const hid = crypto.randomUUID();
    const _armas: { id: string; habitualidade_id: string; arma_id: string | null; grupo: string; arma_nome: string }[] = [];
    for (const a of armas) {
      if (!selecionadas.has(a.id)) continue;
      _armas.push({
        id: crypto.randomUUID(),
        habitualidade_id: hid,
        arma_id: a.id,
        grupo: a.grupo,
        arma_nome: a.apelido ? `${a.modelo} (${a.apelido})` : a.modelo,
      });
    }
    if (grupoAvulso) {
      _armas.push({
        id: crypto.randomUUID(),
        habitualidade_id: hid,
        arma_id: null,
        grupo: grupoAvulso,
        arma_nome: ROTULO_GRUPO[grupoAvulso] ?? grupoAvulso,
      });
    }
    if (_armas.length === 0) {
      setErro('Selecione ao menos uma arma ou um grupo.');
      return;
    }
    setErro('');
    setSalvando(true);
    try {
      await api(`/api/admin/usuarios-app/${usuarioId}/registros`, {
        metodo: 'POST',
        corpo: {
          tipo: 'habitualidades',
          registroId: hid,
          dados: {
            id: hid,
            data,
            tipo,
            local_id: null,
            local_nome: localNome.trim() || null,
            observacoes: null,
            origem: 'MANUAL',
            externo_id: null,
            _armas,
          },
        },
      });
      aoConcluir();
    } catch (err) {
      setErro(err instanceof ErroApi ? err.message : 'Falha ao salvar');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form className="cartao" onSubmit={salvar} style={{ marginBottom: 16, borderColor: 'var(--acento)' }}>
      <h3 style={{ marginTop: 0 }}>Lançar habitualidade</h3>
      <div className="grade cols-2">
        <div className="campo">
          <label>Data *</label>
          <input type="date" value={data} onChange={(e) => setData(e.target.value)} required />
        </div>
        <div className="campo">
          <label>Tipo</label>
          <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
            <option value="TREINO">Treino</option>
            <option value="COMPETICAO">Competição</option>
          </select>
        </div>
        <div className="campo" style={{ gridColumn: '1 / -1' }}>
          <label>Local</label>
          <input value={localNome} onChange={(e) => setLocalNome(e.target.value)} placeholder="Clube / estande" />
        </div>
      </div>

      <label>Armas usadas</label>
      {armas.length === 0 ? (
        <p className="vazio-inline">O usuário não tem armas — use o grupo avulso abaixo.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, margin: '6px 0 12px' }}>
          {armas.map((a) => (
            <label key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--texto)' }}>
              <input
                type="checkbox"
                checked={selecionadas.has(a.id)}
                onChange={() => alternar(a.id)}
                style={{ width: 'auto' }}
              />
              {(a.apelido ? `${a.modelo} (${a.apelido})` : a.modelo)} · {ROTULO_GRUPO[a.grupo] ?? a.grupo}
            </label>
          ))}
        </div>
      )}

      <div className="campo">
        <label>Grupo avulso (sem arma do acervo)</label>
        <select value={grupoAvulso} onChange={(e) => setGrupoAvulso(e.target.value)}>
          <option value="">— nenhum —</option>
          {GRUPOS.map((g) => (
            <option key={g} value={g}>
              {ROTULO_GRUPO[g]}
            </option>
          ))}
        </select>
      </div>

      {erro && <p className="erro">{erro}</p>}
      <div className="linha-acoes">
        <button type="submit" disabled={salvando}>
          {salvando ? 'Salvando…' : 'Lançar habitualidade'}
        </button>
        <button type="button" className="secundario" onClick={aoCancelar}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

function FormularioDadosUsuario({
  usuarioId,
  inicial,
  aoConcluir,
  aoCancelar,
}: {
  usuarioId: string;
  inicial: { nome: string; email: string; cpf: string; ativo: boolean };
  aoConcluir: () => void;
  aoCancelar: () => void;
}) {
  const [nome, setNome] = useState(inicial.nome);
  const [email, setEmail] = useState(inicial.email);
  const [cpf, setCpf] = useState(inicial.cpf);
  const [ativo, setAtivo] = useState(inicial.ativo);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    setSalvando(true);
    try {
      await api(`/api/admin/usuarios-app/${usuarioId}`, {
        metodo: 'PATCH',
        corpo: { nome: nome.trim(), email: email.trim(), cpf: cpf.trim(), ativo },
      });
      aoConcluir();
    } catch (err) {
      setErro(err instanceof ErroApi ? err.message : 'Falha ao salvar');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form className="cartao" onSubmit={salvar} style={{ marginBottom: 20, borderColor: 'var(--acento)' }}>
      <h3 style={{ marginTop: 0 }}>Editar dados do cliente</h3>
      <div className="grade cols-2">
        <div className="campo">
          <label>Nome *</label>
          <input value={nome} onChange={(e) => setNome(e.target.value)} required />
        </div>
        <div className="campo">
          <label>E-mail *</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="campo">
          <label>CPF *</label>
          <input value={cpf} onChange={(e) => setCpf(e.target.value)} required />
        </div>
        <div className="campo">
          <label>Status</label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
            <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} style={{ width: 'auto' }} />
            Conta ativa
          </label>
        </div>
      </div>
      {erro && <p className="erro">{erro}</p>}
      <div className="linha-acoes">
        <button type="submit" disabled={salvando}>
          {salvando ? 'Salvando…' : 'Salvar dados'}
        </button>
        <button type="button" className="secundario" onClick={aoCancelar}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
