'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { linkRankingPublico, ROTULO_ORDENAMENTO, type Competicao } from '@/lib/tipos';
import {
  FormularioCompeticao,
  paraPayload as payloadCompeticao,
  type DadosCompeticao,
} from './FormularioCompeticao';
import {
  FormularioCategoria,
  paraPayload as payloadCategoria,
  type DadosCategoria,
} from './FormularioCategoria';
import { PainelResultados } from './PainelResultados';

function formatarData(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Edição de uma competição + gestão de categorias e resultados. Compartilhada
 * entre o painel da ENTIDADE e o do ADMIN do app — a única diferença são as
 * rotas da API, decididas por `adminEntidadeId` (ausente = entidade).
 */
export function GestaoCompeticao({
  competicaoId,
  voltarHref,
  adminEntidadeId,
}: {
  competicaoId: string;
  /** Para onde volta o link "← Competições". */
  voltarHref: string;
  /** Quando presente, usa as rotas do ADMIN (escopo pela entidade). */
  adminEntidadeId?: string;
}) {
  const router = useRouter();
  const [comp, setComp] = useState<Competicao | null>(null);
  const [editando, setEditando] = useState(false);
  const [erro, setErro] = useState('');

  const rotas = useMemo(
    () =>
      adminEntidadeId
        ? {
            detalhe: `/api/admin/competicoes/${competicaoId}`,
            criarCategoria: `/api/admin/competicoes/${competicaoId}/categorias`,
            categoria: (catId: string) => `/api/admin/categorias/${catId}`,
          }
        : {
            detalhe: `/api/entidade/competicoes/${competicaoId}`,
            criarCategoria: `/api/entidade/competicoes/${competicaoId}/categorias`,
            categoria: (catId: string) => `/api/entidade/categorias/${catId}`,
          },
    [adminEntidadeId, competicaoId]
  );

  const carregar = useCallback(async () => {
    try {
      const r = await api<{ competicao: Competicao }>(rotas.detalhe);
      setComp(r.competicao);
    } catch {
      setErro('Competição não encontrada.');
    }
  }, [rotas.detalhe]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function salvarComp(d: DadosCompeticao) {
    await api(rotas.detalhe, { metodo: 'PATCH', corpo: payloadCompeticao(d) });
    setEditando(false);
    await carregar();
  }

  async function excluirComp() {
    if (!confirm('Excluir a competição? Todas as categorias e resultados serão removidos.')) return;
    await api(rotas.detalhe, { metodo: 'DELETE' });
    router.replace(voltarHref);
  }

  if (erro) {
    return (
      <>
        <p style={{ marginTop: 0 }}>
          <Link href={voltarHref}>← Competições</Link>
        </p>
        <div className="vazio">{erro}</div>
      </>
    );
  }
  if (!comp) return <div className="centro-tela">Carregando…</div>;

  return (
    <>
      <p style={{ marginTop: 0 }}>
        <Link href={voltarHref}>← Competições</Link>
      </p>

      {editando ? (
        <>
          <h1>Editar competição</h1>
          <div style={{ marginTop: 16 }}>
            <FormularioCompeticao
              competicao={comp}
              aoSalvar={salvarComp}
              textoBotao="Salvar alterações"
              uploadPath={adminEntidadeId ? '/api/admin/uploads' : '/api/entidade/uploads'}
            />
            <button className="secundario" style={{ marginTop: 12 }} onClick={() => setEditando(false)}>
              Cancelar
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="cabeca-secao">
            <div>
              <h1>{comp.nome}</h1>
              <p className="subtitulo">
                {formatarData(comp.dataInicio)} – {formatarData(comp.dataFim)}
                {comp.ativo ? '' : ' · inativa'}
              </p>
            </div>
            <div className="linha-acoes">
              <button className="secundario pequeno" onClick={() => setEditando(true)}>
                Editar
              </button>
              <button className="perigo pequeno" onClick={excluirComp}>
                Excluir
              </button>
            </div>
          </div>

          <CompartilharRanking competicao={comp} />

          {comp.bannerUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={comp.bannerUrl}
              alt={comp.nome}
              style={{ width: '100%', maxHeight: 220, objectFit: 'cover', borderRadius: 12, marginBottom: 16 }}
            />
          )}
          {comp.descricao && <p style={{ marginTop: 0 }}>{comp.descricao}</p>}
          {comp.regras && (
            <details className="cartao" style={{ marginBottom: 16 }}>
              <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Regulamento</summary>
              <p style={{ whiteSpace: 'pre-wrap', marginBottom: 0 }}>{comp.regras}</p>
            </details>
          )}
        </>
      )}

      <Categorias
        competicao={comp}
        rotas={rotas}
        adminEntidadeId={adminEntidadeId}
        aoMudar={carregar}
      />
    </>
  );
}

/** Link público do ranking — pronto para copiar e compartilhar. */
function CompartilharRanking({ competicao }: { competicao: Competicao }) {
  const url = linkRankingPublico(competicao);
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      /* clipboard indisponível — o link continua visível para copiar à mão */
    }
  }

  return (
    <div
      className="cartao"
      style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}
    >
      <span style={{ fontSize: 13, color: 'var(--texto-suave)', whiteSpace: 'nowrap' }}>
        🔗 Ranking público:
      </span>
      <input
        readOnly
        value={url}
        onFocus={(e) => e.currentTarget.select()}
        style={{ flex: 1, minWidth: 220, fontSize: 13 }}
      />
      <button type="button" className="secundario pequeno" onClick={copiar}>
        {copiado ? 'Copiado!' : 'Copiar link'}
      </button>
      <a href={url} target="_blank" rel="noreferrer">
        <button type="button" className="secundario pequeno">Abrir</button>
      </a>
    </div>
  );
}

function Categorias({
  competicao,
  rotas,
  adminEntidadeId,
  aoMudar,
}: {
  competicao: Competicao;
  rotas: { criarCategoria: string; categoria: (id: string) => string };
  adminEntidadeId?: string;
  aoMudar: () => void;
}) {
  const categorias = competicao.categorias ?? [];
  const [adicionando, setAdicionando] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [abertaId, setAbertaId] = useState<string | null>(null);

  async function criar(d: DadosCategoria) {
    await api(rotas.criarCategoria, { metodo: 'POST', corpo: payloadCategoria(d) });
    setAdicionando(false);
    aoMudar();
  }

  async function salvar(categoriaId: string, d: DadosCategoria) {
    await api(rotas.categoria(categoriaId), { metodo: 'PATCH', corpo: payloadCategoria(d) });
    setEditandoId(null);
    aoMudar();
  }

  async function excluir(categoriaId: string) {
    if (!confirm('Excluir a categoria e todos os seus resultados?')) return;
    await api(rotas.categoria(categoriaId), { metodo: 'DELETE' });
    if (abertaId === categoriaId) setAbertaId(null);
    aoMudar();
  }

  return (
    <>
      <div className="cabeca-secao" style={{ marginTop: 28 }}>
        <h2 style={{ margin: 0 }}>Categorias</h2>
        {!adicionando && <button onClick={() => setAdicionando(true)}>+ Nova categoria</button>}
      </div>

      {adicionando && (
        <div className="cartao" style={{ marginBottom: 16 }}>
          <h3 style={{ marginTop: 0 }}>Nova categoria</h3>
          <FormularioCategoria
            aoSalvar={criar}
            aoCancelar={() => setAdicionando(false)}
            textoBotao="Criar categoria"
          />
        </div>
      )}

      {categorias.length === 0 && !adicionando ? (
        <div className="cartao">
          <p className="subtitulo" style={{ margin: 0 }}>
            Nenhuma categoria ainda. Crie uma para começar a lançar resultados.
          </p>
        </div>
      ) : (
        <div className="grade" style={{ gap: 14 }}>
          {categorias.map((cat) => (
            <div className="cartao" key={cat.id}>
              {editandoId === cat.id ? (
                <>
                  <h3 style={{ marginTop: 0 }}>Editar categoria</h3>
                  <FormularioCategoria
                    categoria={cat}
                    aoSalvar={(d) => salvar(cat.id, d)}
                    aoCancelar={() => setEditandoId(null)}
                    textoBotao="Salvar"
                  />
                </>
              ) : (
                <>
                  <div className="cabeca-secao" style={{ marginBottom: 8 }}>
                    <div>
                      <h3 style={{ margin: 0 }}>{cat.nome}</h3>
                      <p className="subtitulo" style={{ margin: '4px 0 0' }}>
                        {ROTULO_ORDENAMENTO[cat.ordenamento]}
                        {' · '}
                        {cat.totalResultados ?? 0} resultado(s)
                      </p>
                    </div>
                    <div className="linha-acoes">
                      <button
                        className="secundario pequeno"
                        onClick={() => setAbertaId(abertaId === cat.id ? null : cat.id)}
                      >
                        {abertaId === cat.id ? 'Fechar' : 'Resultados'}
                      </button>
                      <button className="secundario pequeno" onClick={() => setEditandoId(cat.id)}>
                        Editar
                      </button>
                      <button className="perigo pequeno" onClick={() => excluir(cat.id)}>
                        Excluir
                      </button>
                    </div>
                  </div>
                  {cat.descricao && <p style={{ marginTop: 0 }}>{cat.descricao}</p>}
                  {abertaId === cat.id && (
                    <div style={{ marginTop: 12, borderTop: '1px solid var(--borda)', paddingTop: 16 }}>
                      <PainelResultados categoria={cat} adminEntidadeId={adminEntidadeId} />
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
