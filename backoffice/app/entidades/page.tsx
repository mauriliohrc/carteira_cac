'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { ROTULO_TIPO, type Entidade } from '@/lib/tipos';
import { Protegido } from '../componentes/Protegido';
import {
  FormularioEntidade,
  paraPayload,
  type DadosEntidade,
} from '../componentes/FormularioEntidade';

export default function PaginaEntidades() {
  return (
    <Protegido>
      <ListaEntidades />
    </Protegido>
  );
}

function ListaEntidades() {
  const [entidades, setEntidades] = useState<Entidade[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [criando, setCriando] = useState(false);

  async function carregar() {
    const r = await api<{ entidades: Entidade[] }>('/api/admin/entidades');
    setEntidades(r.entidades);
    setCarregando(false);
  }

  useEffect(() => {
    carregar();
  }, []);

  async function criar(d: DadosEntidade) {
    await api('/api/admin/entidades', { metodo: 'POST', corpo: paraPayload(d) });
    setCriando(false);
    await carregar();
  }

  return (
    <>
      <div className="cabeca-secao">
        <div>
          <h1>Entidades de tiro</h1>
          <p className="subtitulo">Clubes, ligas e federações cadastrados.</p>
        </div>
        {!criando && <button onClick={() => setCriando(true)}>+ Nova entidade</button>}
      </div>

      {criando && (
        <div style={{ marginBottom: 24 }}>
          <h2>Nova entidade</h2>
          <FormularioEntidade
            aoSalvar={criar}
            aoCancelar={() => setCriando(false)}
            textoBotao="Criar entidade"
          />
        </div>
      )}

      <div className="cartao" style={{ padding: 0 }}>
        {carregando ? (
          <div className="vazio">Carregando…</div>
        ) : entidades.length === 0 ? (
          <div className="vazio">Nenhuma entidade cadastrada ainda.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Tipo</th>
                <th>Cidade/UF</th>
                <th>Usuários</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {entidades.map((e) => (
                <tr key={e.id} style={{ cursor: 'pointer' }}>
                  <td>
                    <Link href={`/entidades/${e.id}`}>{e.nome}</Link>
                  </td>
                  <td>{ROTULO_TIPO[e.tipo]}</td>
                  <td>{[e.cidade, e.uf].filter(Boolean).join(' / ') || '—'}</td>
                  <td>{e.totalUsuarios ?? 0}</td>
                  <td>
                    <span className={`etiqueta ${e.ativo ? 'ok' : 'inativo'}`}>
                      {e.ativo ? 'Ativa' : 'Inativa'}
                    </span>
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
