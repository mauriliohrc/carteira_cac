'use client';

import { useState } from 'react';
import { ErroApi } from '@/lib/api';
import { ROTULO_ORDENAMENTO, type CategoriaCompeticao, type Ordenamento } from '@/lib/tipos';

export interface DadosCategoria {
  nome: string;
  descricao: string;
  regras: string;
  ordenamento: Ordenamento;
}

function inicial(c?: CategoriaCompeticao): DadosCategoria {
  return {
    nome: c?.nome ?? '',
    descricao: c?.descricao ?? '',
    regras: c?.regras ?? '',
    ordenamento: c?.ordenamento ?? 'MAIOR',
  };
}

export function paraPayload(d: DadosCategoria) {
  const ou = (v: string) => (v.trim() === '' ? null : v.trim());
  return {
    nome: d.nome.trim(),
    descricao: ou(d.descricao),
    regras: ou(d.regras),
    ordenamento: d.ordenamento,
  };
}

export function FormularioCategoria({
  categoria,
  aoSalvar,
  aoCancelar,
  textoBotao = 'Salvar',
}: {
  categoria?: CategoriaCompeticao;
  aoSalvar: (d: DadosCategoria) => Promise<void>;
  aoCancelar?: () => void;
  textoBotao?: string;
}) {
  const [d, setD] = useState<DadosCategoria>(inicial(categoria));
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  function set<K extends keyof DadosCategoria>(k: K, v: DadosCategoria[K]) {
    setD((atual) => ({ ...atual, [k]: v }));
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    setSalvando(true);
    try {
      await aoSalvar(d);
    } catch (err) {
      setErro(err instanceof ErroApi ? err.message : 'Falha ao salvar');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={enviar}>
      <div className="campo">
        <label>Nome da categoria *</label>
        <input value={d.nome} onChange={(e) => set('nome', e.target.value)} required />
      </div>
      <div className="campo">
        <label>Ordenamento do ranking *</label>
        <select
          value={d.ordenamento}
          onChange={(e) => set('ordenamento', e.target.value as Ordenamento)}
        >
          {(Object.keys(ROTULO_ORDENAMENTO) as Ordenamento[]).map((o) => (
            <option key={o} value={o}>
              {ROTULO_ORDENAMENTO[o]}
            </option>
          ))}
        </select>
      </div>
      <div className="campo">
        <label>Descrição</label>
        <textarea
          value={d.descricao}
          onChange={(e) => set('descricao', e.target.value)}
          maxLength={2000}
          style={{ minHeight: 70 }}
        />
      </div>
      <div className="campo">
        <label>Regras</label>
        <textarea
          value={d.regras}
          onChange={(e) => set('regras', e.target.value)}
          maxLength={20000}
          style={{ minHeight: 90 }}
        />
      </div>
      {erro && <p className="erro">{erro}</p>}
      <div className="linha-acoes">
        <button type="submit" disabled={salvando}>
          {salvando ? 'Salvando…' : textoBotao}
        </button>
        {aoCancelar && (
          <button type="button" className="secundario" onClick={aoCancelar}>
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}
