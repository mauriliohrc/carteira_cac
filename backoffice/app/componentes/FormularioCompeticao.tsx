'use client';

import { useRef, useState } from 'react';
import { api, ErroApi } from '@/lib/api';
import type { Competicao } from '@/lib/tipos';

/** Lê um arquivo como base64 (sem o prefixo `data:`). */
function lerArquivoBase64(file: File): Promise<{ mime: string; dadosBase64: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Falha ao ler o arquivo'));
    reader.onload = () => {
      const r = String(reader.result ?? '');
      const base64 = r.includes(',') ? r.slice(r.indexOf(',') + 1) : r;
      resolve({ mime: file.type || 'image/jpeg', dadosBase64: base64 });
    };
    reader.readAsDataURL(file);
  });
}

export interface DadosCompeticao {
  nome: string;
  descricao: string;
  bannerUrl: string;
  regras: string;
  dataInicio: string; // YYYY-MM-DD
  dataFim: string; // YYYY-MM-DD
  ativo: boolean;
}

/** ISO (ou null) -> 'YYYY-MM-DD' para <input type="date">. */
function paraData(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function inicial(c?: Competicao): DadosCompeticao {
  return {
    nome: c?.nome ?? '',
    descricao: c?.descricao ?? '',
    bannerUrl: c?.bannerUrl ?? '',
    regras: c?.regras ?? '',
    dataInicio: paraData(c?.dataInicio ?? null),
    dataFim: paraData(c?.dataFim ?? null),
    ativo: c?.ativo ?? true,
  };
}

export function paraPayload(d: DadosCompeticao) {
  const ou = (v: string) => (v.trim() === '' ? null : v.trim());
  return {
    nome: d.nome.trim(),
    descricao: ou(d.descricao),
    bannerUrl: ou(d.bannerUrl),
    regras: ou(d.regras),
    dataInicio: d.dataInicio,
    dataFim: d.dataFim,
    ativo: d.ativo,
  };
}

export function FormularioCompeticao({
  competicao,
  aoSalvar,
  textoBotao = 'Salvar',
  uploadPath = '/api/entidade/uploads',
}: {
  competicao?: Competicao;
  aoSalvar: (d: DadosCompeticao) => Promise<void>;
  textoBotao?: string;
  /** Rota de upload do banner (entidade por padrão; admin passa a sua). */
  uploadPath?: string;
}) {
  const [d, setD] = useState<DadosCompeticao>(inicial(competicao));
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erroUpload, setErroUpload] = useState('');
  const inputArquivo = useRef<HTMLInputElement>(null);

  function set<K extends keyof DadosCompeticao>(k: K, v: DadosCompeticao[K]) {
    setD((atual) => ({ ...atual, [k]: v }));
  }

  async function enviarArquivo(file: File) {
    setErroUpload('');
    if (!file.type.startsWith('image/')) {
      setErroUpload('Selecione uma imagem.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErroUpload('Imagem muito grande (máx. 5 MB).');
      return;
    }
    setEnviando(true);
    try {
      const { mime, dadosBase64 } = await lerArquivoBase64(file);
      const r = await api<{ url: string }>(uploadPath, {
        metodo: 'POST',
        corpo: { mime, dadosBase64 },
      });
      set('bannerUrl', r.url);
    } catch (err) {
      setErroUpload(err instanceof ErroApi ? err.message : 'Falha ao enviar a imagem');
    } finally {
      setEnviando(false);
      if (inputArquivo.current) inputArquivo.current.value = '';
    }
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    if (!d.dataInicio || !d.dataFim) {
      setErro('Informe as datas de início e fim.');
      return;
    }
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
        <label>Nome *</label>
        <input value={d.nome} onChange={(e) => set('nome', e.target.value)} required />
      </div>
      <div className="campo">
        <label>Descrição (aparece no app)</label>
        <textarea
          value={d.descricao}
          onChange={(e) => set('descricao', e.target.value)}
          maxLength={2000}
          style={{ minHeight: 90 }}
        />
      </div>
      <div className="campo">
        <label>Banner / foto</label>
        {d.bannerUrl ? (
          <div style={{ marginBottom: 10 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={d.bannerUrl}
              alt="Prévia do banner"
              style={{
                width: '100%',
                maxHeight: 200,
                objectFit: 'cover',
                borderRadius: 10,
                border: '1px solid var(--borda)',
              }}
            />
          </div>
        ) : null}
        <div className="linha-acoes" style={{ flexWrap: 'wrap' }}>
          <button
            type="button"
            className="secundario"
            disabled={enviando}
            onClick={() => inputArquivo.current?.click()}
          >
            {enviando ? 'Enviando…' : d.bannerUrl ? 'Trocar imagem' : 'Enviar imagem'}
          </button>
          {d.bannerUrl ? (
            <button type="button" className="secundario" onClick={() => set('bannerUrl', '')}>
              Remover
            </button>
          ) : null}
        </div>
        <input
          ref={inputArquivo}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void enviarArquivo(f);
          }}
        />
        {erroUpload && <p className="erro">{erroUpload}</p>}
        <input
          value={d.bannerUrl}
          onChange={(e) => set('bannerUrl', e.target.value)}
          placeholder="ou cole uma URL: https://…"
          style={{ marginTop: 8 }}
        />
        <p className="ajuda-previa">JPG, PNG, WEBP ou GIF até 5 MB.</p>
      </div>
      <div className="grade cols-2">
        <div className="campo">
          <label>Data de início *</label>
          <input
            type="date"
            value={d.dataInicio}
            onChange={(e) => set('dataInicio', e.target.value)}
            required
          />
        </div>
        <div className="campo">
          <label>Data de fim *</label>
          <input
            type="date"
            value={d.dataFim}
            onChange={(e) => set('dataFim', e.target.value)}
            required
          />
        </div>
      </div>
      <div className="campo">
        <label>Regras / regulamento</label>
        <textarea value={d.regras} onChange={(e) => set('regras', e.target.value)} maxLength={20000} />
      </div>
      <div className="campo">
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={d.ativo}
            onChange={(e) => set('ativo', e.target.checked)}
            style={{ width: 'auto' }}
          />
          Ativa (visível no app enquanto dentro do prazo)
        </label>
      </div>
      {erro && <p className="erro">{erro}</p>}
      <button type="submit" disabled={salvando}>
        {salvando ? 'Salvando…' : textoBotao}
      </button>
    </form>
  );
}
