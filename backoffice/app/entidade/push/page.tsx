'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ErroApi } from '@/lib/api';
import { dataHora } from '@/lib/formato';
import type { EnvioPush } from '@/lib/tipos';
import { ProtegidoEntidade } from '../../componentes/ProtegidoEntidade';

export default function PaginaPushEntidade() {
  return (
    <ProtegidoEntidade>
      <PushEntidade />
    </ProtegidoEntidade>
  );
}

function PushEntidade() {
  const [titulo, setTitulo] = useState('');
  const [corpo, setCorpo] = useState('');
  const [alcance, setAlcance] = useState<{ socios: number; dispositivos: number } | null>(null);
  const [historico, setHistorico] = useState<EnvioPush[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [resultado, setResultado] = useState<string | null>(null);

  const carregarHistorico = useCallback(async () => {
    const r = await api<{ envios: EnvioPush[] }>('/api/entidade/push?limite=20');
    setHistorico(r.envios);
  }, []);

  useEffect(() => {
    api<{ socios: number; dispositivos: number }>('/api/entidade/alcance').then(setAlcance);
    carregarHistorico();
  }, [carregarHistorico]);

  async function enviar() {
    setErro('');
    setResultado(null);
    setEnviando(true);
    try {
      const r = await api<{ totalUsuarios: number; totalTokens: number; aceitos: number; falhas: number }>(
        '/api/entidade/push',
        { metodo: 'POST', corpo: { titulo, corpo } }
      );
      setResultado(
        `Enviado para ${r.totalUsuarios} sócio(s) · ${r.totalTokens} dispositivo(s) · ${r.aceitos} aceito(s)` +
          (r.falhas ? ` · ${r.falhas} falha(s)` : '')
      );
      setTitulo('');
      setCorpo('');
      carregarHistorico();
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Falha ao enviar');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <h1>Notificações</h1>
      <p className="subtitulo">
        Envie um aviso push para os sócios da sua entidade.
        {alcance && (
          <>
            {' '}
            Alcance atual: <strong>{alcance.socios}</strong> sócio(s) ·{' '}
            <strong>{alcance.dispositivos}</strong> aparelho(s).
          </>
        )}
      </p>

      <div className="cartao">
        <div className="campo">
          <label>Título *</label>
          <input value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={120} />
        </div>
        <div className="campo">
          <label>Mensagem *</label>
          <textarea
            value={corpo}
            onChange={(e) => setCorpo(e.target.value)}
            maxLength={1000}
            style={{ minHeight: 90 }}
          />
        </div>

        {resultado && <div className="resultado-ok">{resultado}</div>}
        {erro && <p className="erro">{erro}</p>}

        <button onClick={enviar} disabled={enviando || !titulo || !corpo}>
          {enviando ? 'Enviando…' : 'Enviar notificação'}
        </button>
      </div>

      <h2>Histórico</h2>
      <div className="cartao" style={{ padding: 0 }}>
        {historico.length === 0 ? (
          <div className="vazio">Nenhum envio ainda.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Quando</th>
                <th>Título</th>
                <th>Sócios</th>
                <th>Aceitos</th>
              </tr>
            </thead>
            <tbody>
              {historico.map((e) => (
                <tr key={e.id}>
                  <td>{dataHora(e.criadoEm)}</td>
                  <td>{e.titulo}</td>
                  <td>{e.totalUsuarios}</td>
                  <td>
                    {e.totalAceitos}/{e.totalTokens}
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
