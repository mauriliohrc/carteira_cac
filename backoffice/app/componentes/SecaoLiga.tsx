'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ErroApi } from '@/lib/api';
import type { ConfigFiliacaoAdmin } from '@/lib/tipos';

/**
 * Seção gerencial da Liga: identidade (nome, logo), preço da anuidade e os
 * textos da tela de filiação no app. Editável sem atualizar o app. Vive na tela
 * de Gestão (/config); a lista de filiados segue em /filiacoes.
 */
export function SecaoLiga() {
  const [cfg, setCfg] = useState<ConfigFiliacaoAdmin | null>(null);
  const [valor, setValor] = useState('');
  const [nome, setNome] = useState('');
  const [logo, setLogo] = useState<string | null>(null);
  const [titulo, setTitulo] = useState('');
  const [subtitulo, setSubtitulo] = useState('');
  const [vantagens, setVantagens] = useState<string[]>([]);
  const [credibilidade, setCredibilidade] = useState('');
  const [termos, setTermos] = useState('');
  const [salvando, setSalvando] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const carregar = useCallback(async () => {
    const r = await api<ConfigFiliacaoAdmin>('/api/admin/filiacoes/config');
    setCfg(r);
    setValor((r.valorCentavos / 100).toFixed(2));
    setNome(r.nomeLiga ?? '');
    setLogo(r.logoUrl);
    setTitulo(r.conteudo.titulo);
    setSubtitulo(r.conteudo.subtitulo);
    setVantagens(r.conteudo.vantagens.length ? r.conteudo.vantagens : ['']);
    setCredibilidade(r.conteudo.credibilidade);
    setTermos(r.conteudo.termos);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  function escolherLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const arq = e.target.files?.[0];
    if (!arq) return;
    const leitor = new FileReader();
    leitor.onload = () => {
      // Redimensiona no navegador (máx. 320px) antes de virar data URI. A logo
      // aparece pequena no app/carteirinha, e o servidor rejeita base64 acima de
      // ~3 MB (logoUrl) — enviar o arquivo cru daria "Dados inválidos".
      const img = new Image();
      img.onload = () => {
        const MAX = 320;
        const escala = Math.min(1, MAX / Math.max(img.width, img.height));
        const w = Math.round(img.width * escala);
        const h = Math.round(img.height * escala);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          setLogo(leitor.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        setLogo(canvas.toDataURL('image/png')); // preserva transparência
      };
      img.src = leitor.result as string;
    };
    leitor.readAsDataURL(arq);
  }

  async function salvar() {
    setSalvando(true);
    try {
      await api('/api/admin/filiacoes/config', {
        metodo: 'PUT',
        corpo: {
          valorCentavos: Math.round((Number(valor.replace(',', '.')) || 0) * 100),
          nomeLiga: nome.trim() || null,
          // Só manda o logo quando o admin escolheu um novo (data URI). Mantendo
          // o atual (http/data já salvo) não reenvia à toa.
          logoUrl: logo && logo.startsWith('data:') ? logo : undefined,
          conteudo: {
            titulo: titulo.trim(),
            subtitulo: subtitulo.trim(),
            vantagens: vantagens.map((v) => v.trim()).filter(Boolean),
            credibilidade: credibilidade.trim(),
            termos: termos.trim(),
          },
        },
      });
      await carregar();
    } catch (e) {
      if (e instanceof ErroApi) {
        const det = e.detalhes?.map((d) => `${d.campo}: ${d.mensagem}`).join('\n');
        alert(det ? `${e.message}\n\n${det}` : e.message);
      } else {
        alert('Falha ao salvar');
      }
    } finally {
      setSalvando(false);
    }
  }

  if (!cfg) return null;

  return (
    <div className="cartao" style={{ marginBottom: 16 }}>
      <h2 style={{ marginTop: 0, fontSize: 16 }}>Liga — identidade, preço e textos</h2>
      <p className="subtitulo" style={{ marginTop: 0 }}>
        Editável sem atualizar o app. O nome e o logo aparecem no app, na carteirinha, no certificado
        e na verificação pública. Vínculo de {cfg.mesesVinculo} meses por anuidade.
      </p>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <label style={{ display: 'flex', flexDirection: 'column', fontSize: 12, flex: 2, minWidth: 200 }}>
          Nome da liga
          <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Liga ..." />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', fontSize: 12 }}>
          Anuidade (R$)
          <input value={valor} onChange={(e) => setValor(e.target.value)} inputMode="decimal" style={{ width: 120 }} />
        </label>
      </div>
      <div style={{ marginTop: 20, borderTop: '1px solid var(--borda)', paddingTop: 16 }}>
        <h3 style={{ margin: '0 0 4px', fontSize: 14 }}>Textos da tela da liga (app)</h3>
        <p className="subtitulo" style={{ marginTop: 0 }}>
          O que o usuário lê na tela de filiação. Deixe vazio para usar o texto padrão.
        </p>
        <div style={{ display: 'grid', gap: 10 }}>
          <label style={{ display: 'flex', flexDirection: 'column', fontSize: 12 }}>
            Título
            <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Faça parte da liga" />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', fontSize: 12 }}>
            Subtítulo
            <textarea value={subtitulo} onChange={(e) => setSubtitulo(e.target.value)} rows={2} />
          </label>
          <div>
            <div style={{ fontSize: 12, marginBottom: 4 }}>Vantagens</div>
            {vantagens.map((v, i) => (
              <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                <input
                  value={v}
                  onChange={(e) => setVantagens((a) => a.map((x, j) => (j === i ? e.target.value : x)))}
                  style={{ flex: 1 }}
                  placeholder={`Vantagem ${i + 1}`}
                />
                <button className="perigo pequeno" onClick={() => setVantagens((a) => a.filter((_, j) => j !== i))}>
                  ×
                </button>
              </div>
            ))}
            <button className="secundario pequeno" onClick={() => setVantagens((a) => [...a, ''])}>
              + Adicionar vantagem
            </button>
          </div>
          <label style={{ display: 'flex', flexDirection: 'column', fontSize: 12 }}>
            Credibilidade (ex.: liga formalizada · +10 anos de mercado)
            <textarea value={credibilidade} onChange={(e) => setCredibilidade(e.target.value)} rows={2} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', fontSize: 12 }}>
            Termos / disclaimer
            <textarea value={termos} onChange={(e) => setTermos(e.target.value)} rows={2} />
          </label>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginTop: 16 }}>
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt="logo" style={{ height: 48, maxWidth: 160, objectFit: 'contain', background: 'var(--superficie)', borderRadius: 6, padding: 4 }} />
        ) : (
          <span className="subtitulo">Sem logo</span>
        )}
        <input ref={fileRef} type="file" accept="image/*" onChange={escolherLogo} style={{ display: 'none' }} />
        <button className="secundario pequeno" onClick={() => fileRef.current?.click()}>
          {logo ? 'Trocar logo' : 'Enviar logo'}
        </button>
        <button className="secundario pequeno" disabled={salvando} onClick={salvar} style={{ marginLeft: 'auto' }}>
          {salvando ? 'Salvando…' : 'Salvar'}
        </button>
      </div>
      {(Number(valor.replace(',', '.')) || 0) <= 0 ? (
        <p className="subtitulo" style={{ marginTop: 10, color: 'var(--perigo, #c0392b)' }}>
          Defina um preço maior que zero para a filiação ficar disponível no app.
        </p>
      ) : null}
    </div>
  );
}
