'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ErroApi } from '@/lib/api';
import { ROTULO_STATUS_ANUNCIO } from '@/lib/tipos';
import type {
  AnuncioAdmin,
  DenunciaAdmin,
  ListaAnunciosAdmin,
  LojaAdmin,
  MetricasMarket,
  StatusAnuncio,
} from '@/lib/tipos';
import { Protegido } from '../componentes/Protegido';

export default function PaginaMarketplace() {
  return (
    <Protegido>
      <Painel />
    </Protegido>
  );
}

type Aba = 'ANUNCIOS' | 'LOJAS' | 'DENUNCIAS';

function Painel() {
  const [aba, setAba] = useState<Aba>('ANUNCIOS');
  return (
    <>
      <div className="cabeca-secao">
        <div>
          <h1>Marketplace</h1>
          <p className="subtitulo">
            Classificados de acessórios — moderação de anúncios, lojas parceiras e denúncias.
          </p>
        </div>
      </div>

      <div className="filtros">
        <div className="filtro-grupo">
          {(
            [
              ['ANUNCIOS', 'Anúncios'],
              ['LOJAS', 'Lojas parceiras'],
              ['DENUNCIAS', 'Denúncias'],
            ] as [Aba, string][]
          ).map(([v, r]) => (
            <button key={v} className={`filtro-chip ${aba === v ? 'ativo' : ''}`} onClick={() => setAba(v)}>
              {r}
            </button>
          ))}
        </div>
      </div>

      {aba === 'ANUNCIOS' ? <Moderacao /> : aba === 'LOJAS' ? <Lojas /> : <Denuncias />}
    </>
  );
}

// ------------------------------------------------------------------ anúncios

const STATUS: { valor: StatusAnuncio | ''; rotulo: string }[] = [
  { valor: 'PENDENTE', rotulo: 'Pendentes' },
  { valor: 'APROVADO', rotulo: 'Aprovados' },
  { valor: 'REJEITADO', rotulo: 'Reprovados' },
  { valor: 'PAUSADO', rotulo: 'Pausados' },
  { valor: 'VENDIDO', rotulo: 'Vendidos' },
  { valor: '', rotulo: 'Todos' },
];

function formatarPreco(centavos: number | null): string {
  if (centavos == null) return 'A combinar';
  return (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function classeStatus(s: StatusAnuncio): string {
  if (s === 'APROVADO') return 'publicada';
  if (s === 'REJEITADO') return 'plano-cortesia';
  if (s === 'VENDIDO') return 'plano-anual';
  return 'rascunho';
}

function Moderacao() {
  const [status, setStatus] = useState<StatusAnuncio | ''>('PENDENTE');
  const [dados, setDados] = useState<ListaAnunciosAdmin | null>(null);
  const [metricas, setMetricas] = useState<MetricasMarket | null>(null);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const params = new URLSearchParams({ limite: '50' });
    if (status) params.set('status', status);
    const [lista, m] = await Promise.all([
      api<ListaAnunciosAdmin>(`/api/admin/marketplace/anuncios?${params}`),
      api<MetricasMarket>('/api/admin/marketplace/metricas').catch(() => null),
    ]);
    setDados(lista);
    if (m) setMetricas(m);
    setCarregando(false);
  }, [status]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  return (
    <>
      <div className="filtros">
        <div className="filtro-grupo">
          <span className="rotulo">Status</span>
          {STATUS.map((s) => (
            <button
              key={s.valor || 'TODOS'}
              className={`filtro-chip ${status === s.valor ? 'ativo' : ''}`}
              onClick={() => setStatus(s.valor)}
            >
              {s.rotulo}
              {metricas && s.valor && metricas.porStatus[s.valor] ? ` (${metricas.porStatus[s.valor]})` : ''}
            </button>
          ))}
        </div>
      </div>

      <div className="cartao" style={{ padding: 0 }}>
        {carregando ? (
          <div className="vazio">Carregando…</div>
        ) : !dados || dados.anuncios.length === 0 ? (
          <div className="vazio">Nenhum anúncio neste filtro.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Anúncio</th>
                <th>Vendedor</th>
                <th>Região</th>
                <th>Preço</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {dados.anuncios.map((a) => (
                <LinhaAnuncio key={a.id} anuncio={a} aoMudar={carregar} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

function LinhaAnuncio({ anuncio: a, aoMudar }: { anuncio: AnuncioAdmin; aoMudar: () => void }) {
  const [ocupado, setOcupado] = useState(false);

  async function acao(fn: () => Promise<unknown>) {
    setOcupado(true);
    try {
      await fn();
      aoMudar();
    } catch (e) {
      alert(e instanceof ErroApi ? e.message : 'Falha na ação');
      setOcupado(false);
    }
  }

  const aprovar = () => acao(() => api(`/api/admin/marketplace/anuncios/${a.id}/aprovar`, { metodo: 'POST' }));
  const reprovar = () => {
    const motivo = prompt('Motivo da reprovação (aparece para o vendedor):');
    if (!motivo?.trim()) return;
    acao(() => api(`/api/admin/marketplace/anuncios/${a.id}/reprovar`, { metodo: 'POST', corpo: { motivo } }));
  };
  const pausar = () => acao(() => api(`/api/admin/marketplace/anuncios/${a.id}/pausar`, { metodo: 'POST' }));
  const remover = () => {
    if (!confirm('Remover definitivamente este anúncio?')) return;
    acao(() => api(`/api/admin/marketplace/anuncios/${a.id}`, { metodo: 'DELETE' }));
  };

  return (
    <tr>
      <td style={{ maxWidth: 420 }}>
        <div style={{ display: 'flex', gap: 10 }}>
          {a.fotos[0] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={a.fotos[0]} alt="" width={56} height={56} style={{ objectFit: 'cover', borderRadius: 8, flexShrink: 0 }} />
          ) : (
            <div style={{ width: 56, height: 56, borderRadius: 8, background: 'var(--superficie-2)', flexShrink: 0 }} />
          )}
          <div>
            <strong>{a.titulo}</strong>
            <div style={{ color: 'var(--texto-suave)', fontSize: 12 }}>
              {a.categoria}
              {a.subcategoria ? ` · ${a.subcategoria}` : ''} · {a.estadoUso}
            </div>
            <div style={{ color: 'var(--texto-suave)', fontSize: 12, maxWidth: 360, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {a.descricao}
            </div>
            {a.status === 'REJEITADO' && a.motivoRejeicao && (
              <div style={{ color: 'var(--perigo)', fontSize: 12 }}>Motivo: {a.motivoRejeicao}</div>
            )}
          </div>
        </div>
      </td>
      <td style={{ fontSize: 13 }}>
        {a.loja ? (
          <span className="etiqueta plano-anual" title="Loja parceira">
            {a.loja.nome}
            {a.loja.verificada ? ' ✓' : ''}
          </span>
        ) : a.vendedor ? (
          <>
            {a.vendedor.nome}
            <div style={{ color: 'var(--texto-suave)', fontSize: 12 }}>{a.vendedor.email}</div>
          </>
        ) : (
          '—'
        )}
      </td>
      <td style={{ whiteSpace: 'nowrap' }}>
        {a.cidade}/{a.uf}
      </td>
      <td style={{ whiteSpace: 'nowrap' }}>{formatarPreco(a.precoCentavos)}</td>
      <td>
        <span className={`etiqueta ${classeStatus(a.status)}`}>{ROTULO_STATUS_ANUNCIO[a.status]}</span>
      </td>
      <td>
        <div className="linha-acoes" style={{ gap: 6, flexWrap: 'wrap' }}>
          {(a.status === 'PENDENTE' || a.status === 'REJEITADO') && (
            <button className="pequeno" disabled={ocupado} onClick={aprovar}>
              Aprovar
            </button>
          )}
          {a.status === 'PENDENTE' && (
            <button className="secundario pequeno" disabled={ocupado} onClick={reprovar}>
              Reprovar
            </button>
          )}
          {a.status === 'APROVADO' && (
            <button className="secundario pequeno" disabled={ocupado} onClick={pausar}>
              Pausar
            </button>
          )}
          <button className="secundario pequeno perigo" disabled={ocupado} onClick={remover}>
            Remover
          </button>
        </div>
      </td>
    </tr>
  );
}

// ------------------------------------------------------------------ lojas

function Lojas() {
  const [lojas, setLojas] = useState<LojaAdmin[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [form, setForm] = useState({ usuarioEmail: '', nome: '', whatsapp: '', uf: '', cidade: '', site: '', descricao: '', verificada: true });
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const r = await api<{ lojas: LojaAdmin[] }>('/api/admin/marketplace/lojas');
    setLojas(r.lojas);
    setCarregando(false);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function criar() {
    if (!form.usuarioEmail.trim() || !form.nome.trim()) {
      alert('Informe o e-mail do dono e o nome da loja.');
      return;
    }
    setSalvando(true);
    try {
      await api('/api/admin/marketplace/lojas', {
        metodo: 'POST',
        corpo: {
          usuarioEmail: form.usuarioEmail.trim(),
          nome: form.nome.trim(),
          whatsapp: form.whatsapp.trim() || null,
          uf: form.uf.trim() || null,
          cidade: form.cidade.trim() || null,
          site: form.site.trim() || null,
          descricao: form.descricao.trim() || null,
          verificada: form.verificada,
        },
      });
      setForm({ usuarioEmail: '', nome: '', whatsapp: '', uf: '', cidade: '', site: '', descricao: '', verificada: true });
      carregar();
    } catch (e) {
      alert(e instanceof ErroApi ? e.message : 'Falha ao criar loja');
    } finally {
      setSalvando(false);
    }
  }

  async function patch(id: string, dados: Record<string, unknown>) {
    try {
      await api(`/api/admin/marketplace/lojas/${id}`, { metodo: 'PATCH', corpo: dados });
      carregar();
    } catch (e) {
      alert(e instanceof ErroApi ? e.message : 'Falha');
    }
  }
  async function remover(id: string) {
    if (!confirm('Remover a loja? Os anúncios dela deixam de ser identificados.')) return;
    await api(`/api/admin/marketplace/lojas/${id}`, { metodo: 'DELETE' });
    carregar();
  }

  return (
    <>
      <div className="cartao" style={{ marginBottom: 16 }}>
        <strong>Nova loja parceira</strong>
        <p className="subtitulo" style={{ margin: '4px 0 12px' }}>
          O dono precisa ter conta no app (informe o e-mail). Loja ativa publica anúncios sem passar pela moderação.
        </p>
        <div className="grade cols-2" style={{ gap: 10 }}>
          <input placeholder="E-mail do dono (conta do app)" value={form.usuarioEmail} onChange={(e) => setForm({ ...form, usuarioEmail: e.target.value })} />
          <input placeholder="Nome da loja" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
          <input placeholder="WhatsApp (só dígitos)" value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} />
          <input placeholder="Site (https://…)" value={form.site} onChange={(e) => setForm({ ...form, site: e.target.value })} />
          <input placeholder="UF" maxLength={2} value={form.uf} onChange={(e) => setForm({ ...form, uf: e.target.value.toUpperCase() })} />
          <input placeholder="Cidade" value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} />
        </div>
        <input placeholder="Descrição (opcional)" value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} style={{ marginTop: 10 }} />
        <label className="radio-opcao" style={{ width: 'fit-content', marginTop: 10 }}>
          <input type="checkbox" checked={form.verificada} onChange={(e) => setForm({ ...form, verificada: e.target.checked })} style={{ width: 'auto' }} />
          Selo de verificada
        </label>
        <div style={{ marginTop: 12 }}>
          <button disabled={salvando} onClick={criar}>
            {salvando ? 'Criando…' : 'Criar loja'}
          </button>
        </div>
      </div>

      <div className="cartao" style={{ padding: 0 }}>
        {carregando ? (
          <div className="vazio">Carregando…</div>
        ) : lojas.length === 0 ? (
          <div className="vazio">Nenhuma loja parceira ainda.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Loja</th>
                <th>Dono</th>
                <th>Anúncios</th>
                <th>Estado</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {lojas.map((l) => (
                <tr key={l.id}>
                  <td>
                    <strong>{l.nome}</strong>
                    {l.verificada ? <span className="etiqueta publicada" style={{ marginLeft: 6 }}>Verificada</span> : null}
                    <div style={{ color: 'var(--texto-suave)', fontSize: 12 }}>
                      {[l.cidade, l.uf].filter(Boolean).join('/')} {l.whatsapp ? `· ${l.whatsapp}` : ''}
                    </div>
                  </td>
                  <td style={{ fontSize: 13 }}>
                    {l.usuario.nome}
                    <div style={{ color: 'var(--texto-suave)', fontSize: 12 }}>{l.usuario.email}</div>
                  </td>
                  <td>{l._count.anuncios}</td>
                  <td>
                    <span className={`etiqueta ${l.ativo ? 'publicada' : 'rascunho'}`}>{l.ativo ? 'Ativa' : 'Inativa'}</span>
                  </td>
                  <td>
                    <div className="linha-acoes" style={{ gap: 6, flexWrap: 'wrap' }}>
                      <button className="secundario pequeno" onClick={() => patch(l.id, { verificada: !l.verificada })}>
                        {l.verificada ? 'Tirar selo' : 'Verificar'}
                      </button>
                      <button className="secundario pequeno" onClick={() => patch(l.id, { ativo: !l.ativo })}>
                        {l.ativo ? 'Desativar' : 'Ativar'}
                      </button>
                      <button className="secundario pequeno perigo" onClick={() => remover(l.id)}>
                        Remover
                      </button>
                    </div>
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

// --------------------------------------------------------------- denúncias

function Denuncias() {
  const [itens, setItens] = useState<DenunciaAdmin[]>([]);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const r = await api<{ denuncias: DenunciaAdmin[] }>('/api/admin/marketplace/denuncias');
    setItens(r.denuncias);
    setCarregando(false);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function tratar(id: string, tratada: boolean) {
    await api(`/api/admin/marketplace/denuncias/${id}/tratar`, { metodo: 'POST', corpo: { tratada } });
    carregar();
  }

  return (
    <div className="cartao" style={{ padding: 0 }}>
      {carregando ? (
        <div className="vazio">Carregando…</div>
      ) : itens.length === 0 ? (
        <div className="vazio">Nenhuma denúncia.</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Quando</th>
              <th>Alvo</th>
              <th>Motivo</th>
              <th>Denunciante</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {itens.map((d) => (
              <tr key={d.id} style={d.tratada ? { opacity: 0.6 } : undefined}>
                <td style={{ whiteSpace: 'nowrap' }}>{new Date(d.criadoEm).toLocaleString('pt-BR')}</td>
                <td style={{ fontSize: 12 }}>
                  {d.anuncioId ? `Anúncio ${d.anuncioId.slice(0, 8)}…` : d.conversaId ? `Conversa ${d.conversaId.slice(0, 8)}…` : '—'}
                </td>
                <td style={{ maxWidth: 320, whiteSpace: 'pre-wrap' }}>{d.motivo}</td>
                <td style={{ fontSize: 12 }}>{d.denunciante?.email ?? 'anônimo'}</td>
                <td>
                  <span className={`etiqueta ${d.tratada ? 'publicada' : 'rascunho'}`}>{d.tratada ? 'Tratada' : 'Aberta'}</span>
                </td>
                <td>
                  <button className="secundario pequeno" onClick={() => tratar(d.id, !d.tratada)}>
                    {d.tratada ? 'Reabrir' : 'Marcar tratada'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
