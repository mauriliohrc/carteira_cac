'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ErroApi } from '@/lib/api';
import type { Contato, ListaContatos } from '@/lib/tipos';
import { Protegido } from '../componentes/Protegido';

export default function PaginaContatos() {
  return (
    <Protegido>
      <ListaDeContatos />
    </Protegido>
  );
}

function formatarDataHora(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function ListaDeContatos() {
  const [dados, setDados] = useState<ListaContatos | null>(null);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const r = await api<ListaContatos>('/api/admin/contatos');
    setDados(r);
    setCarregando(false);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  return (
    <>
      <div className="cabeca-secao">
        <div>
          <h1>Contatos</h1>
          <p className="subtitulo">
            Mensagens enviadas pelo formulário do site.
            {dados?.naoTratados ? ` ${dados.naoTratados} não tratado(s).` : ''}
          </p>
        </div>
      </div>

      <div className="cartao" style={{ padding: 0 }}>
        {carregando ? (
          <div className="vazio">Carregando…</div>
        ) : !dados || dados.contatos.length === 0 ? (
          <div className="vazio">Nenhum contato recebido ainda.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Recebido</th>
                <th>Nome</th>
                <th>Telefone</th>
                <th>Assunto</th>
                <th>Mensagem</th>
                <th>Status</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {dados.contatos.map((c) => (
                <LinhaContato key={c.id} contato={c} aoMudar={carregar} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

function LinhaContato({ contato, aoMudar }: { contato: Contato; aoMudar: () => void }) {
  const [salvando, setSalvando] = useState(false);

  async function alternar() {
    setSalvando(true);
    try {
      await api(`/api/admin/contatos/${contato.id}/tratar`, {
        metodo: 'POST',
        corpo: { tratado: !contato.tratado },
      });
      aoMudar();
    } catch (e) {
      alert(e instanceof ErroApi ? e.message : 'Falha ao atualizar');
      setSalvando(false);
    }
  }

  return (
    <tr style={contato.tratado ? { opacity: 0.6 } : undefined}>
      <td style={{ whiteSpace: 'nowrap' }}>{formatarDataHora(contato.criadoEm)}</td>
      <td>{contato.nome}</td>
      <td style={{ whiteSpace: 'nowrap' }}>{contato.telefone}</td>
      <td>{contato.assunto}</td>
      <td style={{ maxWidth: 360, whiteSpace: 'pre-wrap' }}>{contato.mensagem}</td>
      <td>
        <span className={`etiqueta ${contato.tratado ? 'publicada' : 'rascunho'}`}>
          {contato.tratado ? 'Tratado' : 'Novo'}
        </span>
      </td>
      <td>
        <button className="secundario pequeno" disabled={salvando} onClick={alternar}>
          {contato.tratado ? 'Reabrir' : 'Marcar tratado'}
        </button>
      </td>
    </tr>
  );
}
