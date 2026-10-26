'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ErroApi } from '@/lib/api';
import type { GatilhoMensagem, ModeloMensagem } from '@/lib/tipos';
import { Protegido } from '../componentes/Protegido';

const ROTULO_CANAL: Record<string, string> = { WHATSAPP: 'WhatsApp', PUSH: 'Notificação (push)' };

export default function PaginaAutomacoes() {
  return (
    <Protegido>
      <Automacoes />
    </Protegido>
  );
}

function Automacoes() {
  const [ativo, setAtivo] = useState(true);
  const [gatilhos, setGatilhos] = useState<GatilhoMensagem[]>([]);
  const [modelos, setModelos] = useState<ModeloMensagem[]>([]);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    const r = await api<{ ativo: boolean; gatilhos: GatilhoMensagem[]; modelos: ModeloMensagem[] }>(
      '/api/admin/mensagens-automaticas'
    );
    setAtivo(r.ativo);
    setGatilhos(r.gatilhos);
    setModelos(r.modelos);
    setCarregando(false);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function alternarMestre(v: boolean) {
    setAtivo(v); // otimista
    await api('/api/admin/mensagens-automaticas/config', { metodo: 'PATCH', corpo: { ativo: v } });
  }

  if (carregando) return <div className="vazio">Carregando…</div>;

  return (
    <>
      <h1>Mensagens automáticas</h1>
      <p className="subtitulo">
        Relacionamento automático com aquele toque pessoal: use <code>{'{{nome}}'}</code> para o
        primeiro nome. Cada gatilho pode ser enviado por WhatsApp e/ou push.
      </p>

      <div className="cartao">
        <label className="radio-opcao" style={{ width: 'fit-content' }}>
          <input
            type="checkbox"
            checked={ativo}
            onChange={(e) => alternarMestre(e.target.checked)}
            style={{ width: 'auto' }}
          />
          <strong>Mensagens automáticas {ativo ? 'ativadas' : 'desativadas'}</strong>
        </label>
        <p className="subtitulo" style={{ marginBottom: 0 }}>
          Interruptor-geral. Desligado, nenhum gatilho dispara — mesmo com modelos ativos abaixo.
        </p>
      </div>

      {gatilhos.map((g) => (
        <div key={g.id} style={{ opacity: ativo ? 1 : 0.6 }}>
          <h2>{g.rotulo}</h2>
          <p className="subtitulo" style={{ marginTop: -8 }}>{g.descricao}</p>
          {modelos
            .filter((m) => m.gatilho === g.id)
            .map((m) => (
              <CartaoModelo key={m.id} modelo={m} aoSalvar={carregar} />
            ))}
        </div>
      ))}
    </>
  );
}

function CartaoModelo({ modelo, aoSalvar }: { modelo: ModeloMensagem; aoSalvar: () => void }) {
  const [titulo, setTitulo] = useState(modelo.titulo ?? '');
  const [corpo, setCorpo] = useState(modelo.corpo);
  const [ativo, setAtivo] = useState(modelo.ativo);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [ok, setOk] = useState(false);

  const alterado = titulo !== (modelo.titulo ?? '') || corpo !== modelo.corpo || ativo !== modelo.ativo;

  async function salvar() {
    setErro('');
    setOk(false);
    setSalvando(true);
    try {
      await api(`/api/admin/mensagens-automaticas/${modelo.id}`, {
        metodo: 'PATCH',
        corpo: {
          titulo: modelo.canal === 'PUSH' ? titulo || null : undefined,
          corpo,
          ativo,
        },
      });
      setOk(true);
      aoSalvar();
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Falha ao salvar');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="cartao">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
        <span className="etiqueta">{ROTULO_CANAL[modelo.canal] ?? modelo.canal}</span>
        <label className="radio-opcao" style={{ width: 'fit-content' }}>
          <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} style={{ width: 'auto' }} />
          Ativo
        </label>
      </div>

      {modelo.canal === 'PUSH' && (
        <div className="campo">
          <label>Título (push)</label>
          <input value={titulo} onChange={(e) => setTitulo(e.target.value)} maxLength={120} />
        </div>
      )}

      <div className="campo">
        <label>{modelo.canal === 'PUSH' ? 'Corpo' : 'Mensagem'}</label>
        <textarea value={corpo} onChange={(e) => setCorpo(e.target.value)} maxLength={4096} style={{ minHeight: 100 }} />
      </div>

      {ok && <div className="resultado-ok">Salvo.</div>}
      {erro && <p className="erro">{erro}</p>}

      <button onClick={salvar} disabled={salvando || !alterado || !corpo.trim()}>
        {salvando ? 'Salvando…' : 'Salvar'}
      </button>
    </div>
  );
}
