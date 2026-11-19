'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ErroApi } from '@/lib/api';
import { ROTULO_SERVICO_DESPACHANTE, type ListaServicosConfig, type ServicoConfigAdmin } from '@/lib/tipos';

/**
 * Seção gerencial dos valores do Despachante: preços (GRU + serviço) de cada
 * tipo, editáveis sem atualizar o app. Vive na tela de Gestão (/config); a fila
 * de processos segue em /despachante.
 */
export function SecaoDespachanteValores() {
  const [servicos, setServicos] = useState<ServicoConfigAdmin[] | null>(null);

  const carregar = useCallback(async () => {
    const r = await api<ListaServicosConfig>('/api/admin/despachante/servicos');
    setServicos(r.servicos);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  if (!servicos) return null;

  return (
    <div className="cartao" style={{ marginBottom: 16 }}>
      <h2 style={{ marginTop: 0, fontSize: 16 }}>Serviços de Despachante — valores</h2>
      <p className="subtitulo" style={{ marginTop: 0 }}>
        O valor cobrado é a soma da GRU (taxa do órgão) com o seu serviço, por item. Editável sem
        atualizar o app.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {servicos.map((s) => (
          <EditorServico key={s.tipo} servico={s} aoSalvar={carregar} />
        ))}
      </div>
    </div>
  );
}

function EditorServico({ servico, aoSalvar }: { servico: ServicoConfigAdmin; aoSalvar: () => void }) {
  const [gru, setGru] = useState((servico.gruCentavos / 100).toFixed(2));
  const [serv, setServ] = useState((servico.servicoCentavos / 100).toFixed(2));
  const [ativo, setAtivo] = useState(servico.ativo);
  const [salvando, setSalvando] = useState(false);

  const total = (Number(gru.replace(',', '.')) || 0) + (Number(serv.replace(',', '.')) || 0);

  async function salvar() {
    setSalvando(true);
    try {
      await api(`/api/admin/despachante/servicos/${servico.tipo}`, {
        metodo: 'PUT',
        corpo: {
          gruCentavos: Math.round((Number(gru.replace(',', '.')) || 0) * 100),
          servicoCentavos: Math.round((Number(serv.replace(',', '.')) || 0) * 100),
          ativo,
        },
      });
      aoSalvar();
    } catch (e) {
      alert(e instanceof ErroApi ? e.message : 'Falha ao salvar');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div style={{ borderTop: '1px solid var(--borda)', paddingTop: 12 }}>
      <strong>{ROTULO_SERVICO_DESPACHANTE[servico.tipo]}</strong>{' '}
      <span className="subtitulo">({servico.unidade})</span>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end', marginTop: 8 }}>
        <label style={{ display: 'flex', flexDirection: 'column', fontSize: 12 }}>
          GRU (R$)
          <input value={gru} onChange={(e) => setGru(e.target.value)} inputMode="decimal" style={{ width: 110 }} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', fontSize: 12 }}>
          Serviço (R$)
          <input value={serv} onChange={(e) => setServ(e.target.value)} inputMode="decimal" style={{ width: 110 }} />
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />
          Ativo
        </label>
        <span style={{ fontSize: 13 }}>
          Total: <strong>R$ {total.toFixed(2).replace('.', ',')}</strong>
        </span>
        <button className="secundario pequeno" disabled={salvando} onClick={salvar}>
          {salvando ? 'Salvando…' : 'Salvar'}
        </button>
      </div>
    </div>
  );
}
