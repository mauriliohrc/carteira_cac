'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { dataHora } from '@/lib/formato';
import type { UsuarioApp } from '@/lib/tipos';
import { Protegido } from '../../../componentes/Protegido';
import { CabecalhoUsuario, CelulasUsuario } from '../../../componentes/ColunasUsuario';

interface Leitura {
  criadoEm: string;
  usuario: UsuarioApp;
}

export default function PaginaLeituras() {
  return (
    <Protegido>
      <Leituras />
    </Protegido>
  );
}

function Leituras() {
  const { id } = useParams<{ id: string }>();
  const [leituras, setLeituras] = useState<Leitura[] | null>(null);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    setCarregando(true);
    const r = await api<{ leituras: Leitura[] }>(`/api/admin/noticias/${id}/leituras`);
    setLeituras(r.leituras);
    setCarregando(false);
  }, [id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  return (
    <>
      <div className="cabeca-secao">
        <div>
          <h1>Leituras da notícia</h1>
          <p className="subtitulo">Quem abriu a notícia no app e quando.</p>
        </div>
        <Link href={`/noticias/${id}`}>
          <button className="secundario">← Voltar à notícia</button>
        </Link>
      </div>

      <div className="cartao" style={{ padding: 0, overflowX: 'auto' }}>
        {carregando ? (
          <div className="vazio">Carregando…</div>
        ) : !leituras || leituras.length === 0 ? (
          <div className="vazio">Ninguém leu esta notícia ainda.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Visualizou em</th>
                <CabecalhoUsuario />
              </tr>
            </thead>
            <tbody>
              {leituras.map((l) => (
                <tr key={l.usuario.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{dataHora(l.criadoEm)}</td>
                  <CelulasUsuario u={l.usuario} />
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {leituras && leituras.length > 0 ? (
        <p className="subtitulo" style={{ marginTop: 12 }}>
          {leituras.length} leitura(s) · uma por usuário (a mais recente).
        </p>
      ) : null}
    </>
  );
}
