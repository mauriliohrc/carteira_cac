'use client';

import { useState } from 'react';
import { ErroApi } from '@/lib/api';
import type { Entidade, Noticia, StatusNoticia } from '@/lib/tipos';
import { EditorRico } from './EditorRico';

export interface DadosNoticia {
  titulo: string;
  resumo: string;
  conteudo: string;
  imagemUrl: string;
  status: StatusNoticia;
  /** '' = geral (todos); id = restrita àquela entidade. */
  entidadeId: string;
}

function inicial(n?: Noticia): DadosNoticia {
  return {
    titulo: n?.titulo ?? '',
    resumo: n?.resumo ?? '',
    conteudo: n?.conteudo ?? '',
    imagemUrl: n?.imagemUrl ?? '',
    status: n?.status ?? 'RASCUNHO',
    entidadeId: n?.entidadeId ?? '',
  };
}

export function paraPayload(d: DadosNoticia) {
  const ou = (v: string) => (v.trim() === '' ? null : v.trim());
  return {
    titulo: d.titulo.trim(),
    resumo: ou(d.resumo),
    conteudo: d.conteudo.trim(),
    imagemUrl: ou(d.imagemUrl),
    status: d.status,
    entidadeId: d.entidadeId === '' ? null : d.entidadeId,
  };
}

export function FormularioNoticia({
  noticia,
  aoSalvar,
  textoBotao = 'Salvar',
  entidades,
}: {
  noticia?: Noticia;
  aoSalvar: (d: DadosNoticia) => Promise<void>;
  textoBotao?: string;
  /** Quando informado (admin do app), mostra o seletor de alcance. */
  entidades?: Entidade[];
}) {
  const [d, setD] = useState<DadosNoticia>(inicial(noticia));
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  function set<K extends keyof DadosNoticia>(k: K, v: DadosNoticia[K]) {
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
    <form className="cartao" onSubmit={enviar}>
      <div className="campo">
        <label>Título *</label>
        <input value={d.titulo} onChange={(e) => set('titulo', e.target.value)} required />
      </div>
      <div className="campo">
        <label>Resumo (opcional — aparece na lista)</label>
        <input
          value={d.resumo}
          onChange={(e) => set('resumo', e.target.value)}
          maxLength={300}
        />
      </div>
      <div className="campo">
        <label>Imagem (URL, opcional)</label>
        <input
          value={d.imagemUrl}
          onChange={(e) => set('imagemUrl', e.target.value)}
          placeholder="https://…"
        />
      </div>
      <div className="campo">
        <label>Conteúdo *</label>
        <EditorRico valor={d.conteudo} aoMudar={(html) => set('conteudo', html)} />
      </div>
      {entidades && (
        <div className="campo">
          <label>Alcance</label>
          <select value={d.entidadeId} onChange={(e) => set('entidadeId', e.target.value)}>
            <option value="">Geral — todos os usuários do app</option>
            {entidades.map((ent) => (
              <option key={ent.id} value={ent.id}>
                Exclusiva — sócios de {ent.nome}
              </option>
            ))}
          </select>
          <p className="ajuda" style={{ color: 'var(--texto-suave)', fontSize: 12, marginTop: 4 }}>
            Notícia exclusiva só aparece para quem é vinculado àquela entidade.
          </p>
        </div>
      )}
      <div className="campo">
        <label>Status</label>
        <select value={d.status} onChange={(e) => set('status', e.target.value as StatusNoticia)}>
          <option value="RASCUNHO">Rascunho (não aparece no app)</option>
          <option value="PUBLICADA">Publicada (visível no app)</option>
        </select>
      </div>
      {erro && <p className="erro">{erro}</p>}
      <button type="submit" disabled={salvando}>
        {salvando ? 'Salvando…' : textoBotao}
      </button>
    </form>
  );
}
