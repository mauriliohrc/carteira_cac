'use client';

import { useState } from 'react';
import { ErroApi } from '@/lib/api';
import type { Entidade, TipoEntidade } from '@/lib/tipos';

export interface DadosEntidade {
  nome: string;
  subdominio: string;
  tipo: TipoEntidade;
  cr: string;
  cnpj: string;
  email: string;
  telefone: string;
  cidade: string;
  uf: string;
  ativo: boolean;
  shIntegracaoAtiva: boolean;
  shBaseUrl: string;
  shLogin: string;
  shSenha: string;
}

function inicial(e?: Entidade): DadosEntidade {
  return {
    nome: e?.nome ?? '',
    subdominio: e?.subdominio ?? '',
    tipo: e?.tipo ?? 'CLUBE',
    cr: e?.cr ?? '',
    cnpj: e?.cnpj ?? '',
    email: e?.email ?? '',
    telefone: e?.telefone ?? '',
    cidade: e?.cidade ?? '',
    uf: e?.uf ?? '',
    ativo: e?.ativo ?? true,
    shIntegracaoAtiva: e?.shIntegracaoAtiva ?? false,
    shBaseUrl: e?.shBaseUrl ?? '',
    shLogin: e?.shLogin ?? '',
    shSenha: '', // nunca vem preenchida; só envia se o admin digitar
  };
}

/** Transforma campos vazios em null para a API não gravar string vazia. */
export function paraPayload(d: DadosEntidade) {
  const ou = (v: string) => (v.trim() === '' ? null : v.trim());
  const payload: Record<string, unknown> = {
    nome: d.nome.trim(),
    subdominio: ou(d.subdominio),
    tipo: d.tipo,
    cr: ou(d.cr),
    cnpj: ou(d.cnpj),
    email: ou(d.email),
    telefone: ou(d.telefone),
    cidade: ou(d.cidade),
    uf: ou(d.uf),
    ativo: d.ativo,
    shIntegracaoAtiva: d.shIntegracaoAtiva,
    shBaseUrl: ou(d.shBaseUrl),
    shLogin: ou(d.shLogin),
  };
  // Só envia a senha quando o admin digitou algo — senão preserva a atual.
  if (d.shSenha.trim() !== '') payload.shSenha = d.shSenha;
  return payload;
}

export function FormularioEntidade({
  entidade,
  aoSalvar,
  aoCancelar,
  textoBotao = 'Salvar',
}: {
  entidade?: Entidade;
  aoSalvar: (d: DadosEntidade) => Promise<void>;
  aoCancelar?: () => void;
  textoBotao?: string;
}) {
  const [d, setD] = useState<DadosEntidade>(inicial(entidade));
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  function set<K extends keyof DadosEntidade>(k: K, v: DadosEntidade[K]) {
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
      <div className="grade cols-2">
        <div className="campo">
          <label>Nome *</label>
          <input value={d.nome} onChange={(e) => set('nome', e.target.value)} required />
        </div>
        <div className="campo">
          <label>Subdomínio</label>
          <input
            value={d.subdominio}
            onChange={(e) => set('subdominio', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
            placeholder="ex.: 3gun"
            autoComplete="off"
          />
          <small style={{ color: 'var(--texto-suave)' }}>
            {d.subdominio ? `${d.subdominio}.carteiracac.com` : 'Em branco: gerado do nome'}
          </small>
        </div>
        <div className="campo">
          <label>Tipo *</label>
          <select value={d.tipo} onChange={(e) => set('tipo', e.target.value as TipoEntidade)}>
            <option value="CLUBE">Clube</option>
            <option value="LIGA">Liga</option>
            <option value="FEDERACAO">Federação</option>
          </select>
        </div>
        <div className="campo">
          <label>CR (Exército)</label>
          <input value={d.cr} onChange={(e) => set('cr', e.target.value)} />
        </div>
        <div className="campo">
          <label>CNPJ</label>
          <input value={d.cnpj} onChange={(e) => set('cnpj', e.target.value)} />
        </div>
        <div className="campo">
          <label>E-mail</label>
          <input type="email" value={d.email} onChange={(e) => set('email', e.target.value)} />
        </div>
        <div className="campo">
          <label>Telefone</label>
          <input value={d.telefone} onChange={(e) => set('telefone', e.target.value)} />
        </div>
        <div className="campo">
          <label>Cidade</label>
          <input value={d.cidade} onChange={(e) => set('cidade', e.target.value)} />
        </div>
        <div className="campo">
          <label>UF</label>
          <input
            value={d.uf}
            maxLength={2}
            onChange={(e) => set('uf', e.target.value.toUpperCase())}
          />
        </div>
      </div>
      <div className="campo">
        <label>
          <input
            type="checkbox"
            checked={d.ativo}
            onChange={(e) => set('ativo', e.target.checked)}
            style={{ width: 'auto', marginRight: 8 }}
          />
          Ativa
        </label>
      </div>
      <div style={{ borderTop: '1px solid var(--borda)', margin: '18px 0', paddingTop: 16 }}>
        <label style={{ marginBottom: 10 }}>
          <input
            type="checkbox"
            checked={d.shIntegracaoAtiva}
            onChange={(e) => set('shIntegracaoAtiva', e.target.checked)}
            style={{ width: 'auto', marginRight: 8 }}
          />
          Integração Shooting House (importar habitualidades)
        </label>
        {d.shIntegracaoAtiva && (
          <div className="grade cols-2" style={{ marginTop: 10 }}>
            <div className="campo">
              <label>Login (parceiro SH)</label>
              <input value={d.shLogin} onChange={(e) => set('shLogin', e.target.value)} autoComplete="off" />
            </div>
            <div className="campo">
              <label>Senha (parceiro SH)</label>
              <input
                type="password"
                value={d.shSenha}
                onChange={(e) => set('shSenha', e.target.value)}
                placeholder={entidade?.shConfigurado ? '•••••• (manter atual)' : ''}
                autoComplete="new-password"
              />
            </div>
            <div className="campo" style={{ gridColumn: '1 / -1' }}>
              <label>Base URL (opcional — padrão: beta)</label>
              <input
                value={d.shBaseUrl}
                onChange={(e) => set('shBaseUrl', e.target.value)}
                placeholder="https://apibeta.shootinghouse.com.br/v1/partners"
              />
            </div>
          </div>
        )}
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
