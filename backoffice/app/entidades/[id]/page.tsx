'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, ErroApi } from '@/lib/api';
import { ROTULO_PAPEL, type Entidade, type PapelEntidade, type UsuarioEntidade } from '@/lib/tipos';
import { Protegido } from '../../componentes/Protegido';
import {
  FormularioEntidade,
  paraPayload,
  type DadosEntidade,
} from '../../componentes/FormularioEntidade';

export default function PaginaEntidade({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <Protegido>
      <DetalheEntidade id={id} />
    </Protegido>
  );
}

function DetalheEntidade({ id }: { id: string }) {
  const router = useRouter();
  const [entidade, setEntidade] = useState<Entidade | null>(null);
  const [usuarios, setUsuarios] = useState<UsuarioEntidade[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [novoUsuario, setNovoUsuario] = useState(false);

  async function carregar() {
    const [e, u] = await Promise.all([
      api<{ entidade: Entidade }>(`/api/admin/entidades/${id}`),
      api<{ usuarios: UsuarioEntidade[] }>(`/api/admin/entidades/${id}/usuarios`),
    ]);
    setEntidade(e.entidade);
    setUsuarios(u.usuarios);
    setCarregando(false);
  }

  useEffect(() => {
    carregar().catch(() => setCarregando(false));
  }, [id]);

  async function salvarEntidade(d: DadosEntidade) {
    const r = await api<{ entidade: Entidade }>(`/api/admin/entidades/${id}`, {
      metodo: 'PATCH',
      corpo: paraPayload(d),
    });
    setEntidade(r.entidade);
  }

  async function excluirEntidade() {
    if (!confirm('Excluir esta entidade e todos os seus usuários? Esta ação é irreversível.')) {
      return;
    }
    await api(`/api/admin/entidades/${id}`, { metodo: 'DELETE' });
    router.replace('/entidades');
  }

  if (carregando) return <div className="vazio">Carregando…</div>;
  if (!entidade) return <div className="vazio">Entidade não encontrada.</div>;

  return (
    <>
      <p style={{ marginTop: 0 }}>
        <Link href="/entidades">← Entidades</Link>
      </p>
      <div className="cabeca-secao">
        <div>
          <h1>{entidade.nome}</h1>
          <p className="subtitulo">Edite os dados da entidade.</p>
        </div>
        <button className="perigo" onClick={excluirEntidade}>
          Excluir entidade
        </button>
      </div>

      <FormularioEntidade entidade={entidade} aoSalvar={salvarEntidade} textoBotao="Salvar alterações" />

      <div className="cabeca-secao" style={{ marginTop: 32 }}>
        <h2 style={{ margin: 0 }}>Usuários administrativos</h2>
        {!novoUsuario && (
          <button className="pequeno" onClick={() => setNovoUsuario(true)}>
            + Novo usuário
          </button>
        )}
      </div>
      <p className="subtitulo" style={{ marginTop: 4 }}>
        Pessoas que administram esta entidade no backoffice.
      </p>

      {novoUsuario && (
        <div style={{ marginBottom: 20 }}>
          <FormularioUsuario
            entidadeId={id}
            aoConcluir={() => {
              setNovoUsuario(false);
              carregar();
            }}
            aoCancelar={() => setNovoUsuario(false)}
          />
        </div>
      )}

      <div className="cartao" style={{ padding: 0 }}>
        {usuarios.length === 0 ? (
          <div className="vazio">Nenhum usuário nesta entidade.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>E-mail</th>
                <th>Papel</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => (
                <LinhaUsuario key={u.id} entidadeId={id} usuario={u} aoMudar={carregar} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

function FormularioUsuario({
  entidadeId,
  aoConcluir,
  aoCancelar,
}: {
  entidadeId: string;
  aoConcluir: () => void;
  aoCancelar: () => void;
}) {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [papel, setPapel] = useState<PapelEntidade>('ADMIN_ENTIDADE');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    setSalvando(true);
    try {
      await api(`/api/admin/entidades/${entidadeId}/usuarios`, {
        metodo: 'POST',
        corpo: { nome, email, senha, papel },
      });
      aoConcluir();
    } catch (err) {
      setErro(err instanceof ErroApi ? err.message : 'Falha ao criar usuário');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form className="cartao" onSubmit={enviar}>
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
          <label>Senha * (mín. 6)</label>
          <input
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            minLength={6}
            required
          />
        </div>
        <div className="campo">
          <label>Papel</label>
          <select value={papel} onChange={(e) => setPapel(e.target.value as PapelEntidade)}>
            <option value="ADMIN_ENTIDADE">Administrador</option>
            <option value="OPERADOR">Operador</option>
          </select>
        </div>
      </div>
      {erro && <p className="erro">{erro}</p>}
      <div className="linha-acoes">
        <button type="submit" disabled={salvando}>
          {salvando ? 'Criando…' : 'Criar usuário'}
        </button>
        <button type="button" className="secundario" onClick={aoCancelar}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

function LinhaUsuario({
  entidadeId,
  usuario,
  aoMudar,
}: {
  entidadeId: string;
  usuario: UsuarioEntidade;
  aoMudar: () => void;
}) {
  const [ocupado, setOcupado] = useState(false);

  async function alternarAtivo() {
    setOcupado(true);
    await api(`/api/admin/entidades/${entidadeId}/usuarios/${usuario.id}`, {
      metodo: 'PATCH',
      corpo: { ativo: !usuario.ativo },
    });
    setOcupado(false);
    aoMudar();
  }

  async function excluir() {
    if (!confirm(`Excluir o usuário ${usuario.nome}?`)) return;
    setOcupado(true);
    await api(`/api/admin/entidades/${entidadeId}/usuarios/${usuario.id}`, { metodo: 'DELETE' });
    aoMudar();
  }

  return (
    <tr>
      <td>{usuario.nome}</td>
      <td>{usuario.email}</td>
      <td>{ROTULO_PAPEL[usuario.papel]}</td>
      <td>
        <span className={`etiqueta ${usuario.ativo ? 'ok' : 'inativo'}`}>
          {usuario.ativo ? 'Ativo' : 'Inativo'}
        </span>
      </td>
      <td>
        <div className="linha-acoes" style={{ justifyContent: 'flex-end' }}>
          <button className="secundario pequeno" onClick={alternarAtivo} disabled={ocupado}>
            {usuario.ativo ? 'Desativar' : 'Ativar'}
          </button>
          <button className="perigo pequeno" onClick={excluir} disabled={ocupado}>
            Excluir
          </button>
        </div>
      </td>
    </tr>
  );
}
