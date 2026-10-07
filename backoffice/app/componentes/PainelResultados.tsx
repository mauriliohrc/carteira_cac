'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, ErroApi } from '@/lib/api';
import {
  ROTULO_ORDENAMENTO,
  ROTULO_ORIGEM_NOME,
  type CategoriaCompeticao,
  type PreviaAtirador,
  type ResultadoCompeticao,
} from '@/lib/tipos';

function soDigitos(v: string): string {
  return v.replace(/\D/g, '');
}

/** 11 dígitos -> 000.000.000-00. */
function mascararCpf(cpf: string): string {
  const d = soDigitos(cpf);
  if (d.length !== 11) return cpf;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

export function PainelResultados({
  categoria,
  adminEntidadeId,
  aoMudarContagem,
}: {
  categoria: CategoriaCompeticao;
  /** Quando presente, usa as rotas do ADMIN do app (escopo pela entidade). */
  adminEntidadeId?: string;
  aoMudarContagem?: (n: number) => void;
}) {
  const api_ = useMemo(
    () =>
      adminEntidadeId
        ? {
            atirador: (cpf: string) => `/api/admin/entidades/${adminEntidadeId}/atirador/${cpf}`,
            resultados: `/api/admin/categorias/${categoria.id}/resultados`,
            excluir: (id: string) => `/api/admin/resultados/${id}`,
          }
        : {
            atirador: (cpf: string) => `/api/entidade/atirador/${cpf}`,
            resultados: `/api/entidade/categorias/${categoria.id}/resultados`,
            excluir: (id: string) => `/api/entidade/resultados/${id}`,
          },
    [adminEntidadeId, categoria.id]
  );
  const [resultados, setResultados] = useState<ResultadoCompeticao[] | null>(null);
  const [cpf, setCpf] = useState('');
  const [pontuacao, setPontuacao] = useState('');
  const [nome, setNome] = useState('');
  const [previa, setPrevia] = useState<PreviaAtirador | null>(null);
  const [verificando, setVerificando] = useState(false);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    const r = await api<{ resultados: ResultadoCompeticao[] }>(api_.resultados);
    setResultados(r.resultados);
    aoMudarContagem?.(r.resultados.length);
  }, [api_.resultados, aoMudarContagem]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // Ao completar o CPF, pré-busca o nome (app ou Shooting House).
  const verificarCpf = useCallback(async (valor: string) => {
    const d = soDigitos(valor);
    if (d.length !== 11) {
      setPrevia(null);
      return;
    }
    setVerificando(true);
    try {
      const r = await api<PreviaAtirador>(api_.atirador(d));
      setPrevia(r);
    } catch {
      setPrevia(null);
    } finally {
      setVerificando(false);
    }
  }, [api_]);

  async function lancar(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    const d = soDigitos(cpf);
    if (d.length !== 11) {
      setErro('Informe um CPF com 11 dígitos.');
      return;
    }
    if (pontuacao.trim() === '' || Number.isNaN(Number(pontuacao))) {
      setErro('Informe a pontuação.');
      return;
    }
    setSalvando(true);
    try {
      await api(api_.resultados, {
        metodo: 'POST',
        corpo: {
          cpf: d,
          pontuacao: Number(pontuacao),
          nome: nome.trim() === '' ? null : nome.trim(),
        },
      });
      setCpf('');
      setPontuacao('');
      setNome('');
      setPrevia(null);
      await carregar();
    } catch (err) {
      setErro(err instanceof ErroApi ? err.message : 'Falha ao lançar resultado');
    } finally {
      setSalvando(false);
    }
  }

  async function excluir(id: string) {
    if (!confirm('Remover este resultado?')) return;
    await api(api_.excluir(id), { metodo: 'DELETE' });
    await carregar();
  }

  // Sem nome resolvido: exige nome manual.
  const precisaNome = previa !== null && previa.nome === null;

  return (
    <div>
      <form onSubmit={lancar} style={{ marginBottom: 18 }}>
        <div className="grade cols-2">
          <div className="campo">
            <label>CPF do atirador *</label>
            <input
              value={cpf}
              inputMode="numeric"
              placeholder="000.000.000-00"
              onChange={(e) => {
                setCpf(e.target.value);
                setPrevia(null);
              }}
              onBlur={(e) => verificarCpf(e.target.value)}
            />
            {verificando && <p className="ajuda-previa">Verificando CPF…</p>}
            {previa?.nome && (
              <p className="ajuda-previa" style={{ color: 'var(--ok)' }}>
                ✓ {previa.nome}
                <span style={{ opacity: 0.7 }}>
                  {' · '}
                  {previa.origem === 'APP' ? 'usuário do app' : 'Shooting House'}
                </span>
              </p>
            )}
            {previa && previa.nome === null && (
              <p className="ajuda-previa" style={{ color: 'var(--texto-suave)' }}>
                CPF não encontrado no app nem na Shooting House — informe o nome abaixo.
              </p>
            )}
          </div>
          <div className="campo">
            <label>Pontuação *</label>
            <input
              value={pontuacao}
              inputMode="decimal"
              placeholder="Ex.: 98 ou 45.3"
              onChange={(e) => setPontuacao(e.target.value)}
            />
          </div>
        </div>
        <div className="campo">
          <label>Nome {precisaNome ? '*' : '(opcional — sobrescreve o automático)'}</label>
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder={previa?.nome ?? 'Nome do atirador'}
          />
        </div>
        {erro && <p className="erro">{erro}</p>}
        <button type="submit" disabled={salvando}>
          {salvando ? 'Lançando…' : 'Lançar resultado'}
        </button>
        <p className="ajuda-previa" style={{ marginTop: 8 }}>
          Relançar o mesmo CPF atualiza a pontuação (não duplica).
        </p>
      </form>

      <h4 style={{ margin: '0 0 8px' }}>
        Ranking · {ROTULO_ORDENAMENTO[categoria.ordenamento]}
      </h4>
      {resultados === null ? (
        <p className="subtitulo">Carregando…</p>
      ) : resultados.length === 0 ? (
        <p className="subtitulo">Nenhum resultado lançado ainda.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th style={{ width: 48 }}>#</th>
              <th>Atirador</th>
              <th>CPF</th>
              <th>Pontuação</th>
              <th>Origem</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {resultados.map((r) => (
              <tr key={r.id}>
                <td>{r.posicao}º</td>
                <td>{r.nome}</td>
                <td>{mascararCpf(r.cpf)}</td>
                <td>{r.pontuacao}</td>
                <td>
                  <span className="etiqueta">{ROTULO_ORIGEM_NOME[r.origemNome] ?? r.origemNome}</span>
                </td>
                <td>
                  <button className="secundario pequeno" onClick={() => excluir(r.id)}>
                    Remover
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
