'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ErroApi } from '@/lib/api';
import type { ConfigAsaasAdmin } from '@/lib/tipos';
import { Protegido } from '../componentes/Protegido';

export default function PaginaConfig() {
  return (
    <Protegido>
      <div className="cabeca-secao">
        <div>
          <h1>Config</h1>
          <p className="subtitulo">Configurações de sistema e integrações.</p>
        </div>
      </div>
      <IntegracaoAsaas />
    </Protegido>
  );
}

/** Configuração da integração com o Asaas + passo a passo de setup. */
function IntegracaoAsaas() {
  const [cfg, setCfg] = useState<ConfigAsaasAdmin | null>(null);
  const [ambienteSel, setAmbienteSel] = useState<'sandbox' | 'producao'>('sandbox');
  const [apiKey, setApiKey] = useState('');
  const [webhookToken, setWebhookToken] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [copiado, setCopiado] = useState(false);

  const carregar = useCallback(async () => {
    const r = await api<ConfigAsaasAdmin>('/api/admin/despachante/asaas');
    setCfg(r);
    setAmbienteSel(r.ambiente);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function salvar() {
    setSalvando(true);
    try {
      await api('/api/admin/despachante/asaas', {
        metodo: 'PUT',
        // apiKey/webhookToken vazios = mantém o atual (não reenviar o segredo).
        corpo: { ambiente: ambienteSel, apiKey: apiKey || undefined, webhookToken: webhookToken || undefined },
      });
      setApiKey('');
      setWebhookToken('');
      await carregar();
      alert('Configuração do Asaas salva.');
    } catch (e) {
      alert(e instanceof ErroApi ? e.message : 'Falha ao salvar');
    } finally {
      setSalvando(false);
    }
  }

  async function copiarWebhook() {
    if (!cfg) return;
    try {
      await navigator.clipboard.writeText(cfg.webhookUrl);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1500);
    } catch {
      /* clipboard pode falhar em http; ignora */
    }
  }

  if (!cfg) return null;

  const campo: React.CSSProperties = { width: '100%', maxWidth: 480 };
  const rotulo: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, marginTop: 10 };

  return (
    <div className="cartao" style={{ marginBottom: 16 }}>
      <h2 style={{ marginTop: 0, fontSize: 16 }}>Integração Asaas (pagamentos)</h2>
      <p className="subtitulo" style={{ marginTop: 0 }}>
        Status:{' '}
        <strong style={{ color: cfg.apiKeyDefinida ? 'var(--ok)' : 'var(--perigo)' }}>
          {cfg.apiKeyDefinida ? `chave configurada (${cfg.apiKeyDica})` : 'sem chave — pagamentos desativados'}
        </strong>{' '}
        · ambiente atual: <strong>{cfg.ambiente === 'producao' ? 'Produção' : 'Sandbox (teste)'}</strong>
      </p>

      <ol style={{ fontSize: 13, lineHeight: 1.7, paddingLeft: 18, marginTop: 8 }}>
        <li>
          No painel do Asaas, vá em <strong>Configurações → Integrações → API</strong> e copie sua{' '}
          <strong>chave de API</strong> (use a chave de <em>Sandbox</em> para testar e a de{' '}
          <em>Produção</em> para cobrar de verdade).
        </li>
        <li>
          Cole a chave abaixo, escolha o <strong>ambiente</strong> correspondente e clique em Salvar.
        </li>
        <li>
          Defina um <strong>token de webhook</strong> (qualquer texto secreto, ex.: 32 caracteres
          aleatórios) abaixo e salve.
        </li>
        <li>
          No Asaas, vá em <strong>Configurações → Integrações → Webhooks</strong>, crie um webhook
          apontando para a URL abaixo, marque os eventos de <strong>Cobranças (PAYMENT_*)</strong> e
          cole o mesmo token no campo <em>Token de autenticação</em>.
        </li>
      </ol>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '8px 0 4px' }}>
        <code style={{ background: 'var(--fundo-sutil, rgba(0,0,0,.06))', padding: '6px 10px', borderRadius: 6, fontSize: 13 }}>
          {cfg.webhookUrl}
        </code>
        <button className="secundario pequeno" onClick={copiarWebhook}>
          {copiado ? 'Copiado!' : 'Copiar URL'}
        </button>
      </div>

      <label style={rotulo}>
        Ambiente
        <select value={ambienteSel} onChange={(e) => setAmbienteSel(e.target.value as 'sandbox' | 'producao')} style={{ ...campo, maxWidth: 240 }}>
          <option value="sandbox">Sandbox (teste)</option>
          <option value="producao">Produção</option>
        </select>
      </label>

      <label style={rotulo}>
        Chave de API {cfg.apiKeyDefinida ? <span className="subtitulo">(preenchida — deixe em branco para manter)</span> : null}
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={cfg.apiKeyDefinida ? `atual: ${cfg.apiKeyDica}` : 'cole a chave do Asaas'}
          autoComplete="off"
          style={campo}
        />
      </label>

      <label style={rotulo}>
        Token do webhook {cfg.webhookTokenDefinido ? <span className="subtitulo">(preenchido — deixe em branco para manter)</span> : null}
        <input
          type="password"
          value={webhookToken}
          onChange={(e) => setWebhookToken(e.target.value)}
          placeholder={cfg.webhookTokenDefinido ? `atual: ${cfg.webhookTokenDica}` : 'defina um texto secreto'}
          autoComplete="off"
          style={campo}
        />
      </label>

      <div style={{ marginTop: 12 }}>
        <button className="secundario pequeno" disabled={salvando} onClick={salvar}>
          {salvando ? 'Salvando…' : 'Salvar integração'}
        </button>
      </div>
    </div>
  );
}
