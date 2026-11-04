'use client';

import { useState } from 'react';

/**
 * Barra de compartilhamento do portal de notícias. Abre o compartilhador
 * nativo do celular quando existe (navigator.share — cobre Instagram/Stories,
 * apps etc.) e sempre oferece os atalhos diretos de WhatsApp, X, Facebook e
 * Telegram, além de "copiar link" (útil para Instagram, que não tem intent web).
 */
export function BotoesCompartilhar({ url, titulo }: { url: string; titulo: string }) {
  const [copiado, setCopiado] = useState(false);
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(titulo);

  const redes = [
    { nome: 'WhatsApp', cor: '#25D366', href: `https://api.whatsapp.com/send?text=${t}%20${u}` },
    { nome: 'X', cor: '#000000', href: `https://twitter.com/intent/tweet?url=${u}&text=${t}` },
    { nome: 'Facebook', cor: '#1877F2', href: `https://www.facebook.com/sharer/sharer.php?u=${u}` },
    { nome: 'Telegram', cor: '#2AABEE', href: `https://t.me/share/url?url=${u}&text=${t}` },
  ];

  async function copiar() {
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Fallback silencioso: alguns navegadores bloqueiam clipboard sem HTTPS.
    }
  }

  async function nativo() {
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ title: titulo, url });
      } else {
        await copiar();
      }
    } catch {
      // Usuário cancelou o compartilhamento — nada a fazer.
    }
  }

  return (
    <div className="np-share">
      <span className="np-share-rot">Compartilhar</span>
      <div className="np-share-botoes">
        {redes.map((r) => (
          <a
            key={r.nome}
            className="np-share-btn"
            style={{ ['--cor' as string]: r.cor }}
            href={r.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Compartilhar no ${r.nome}`}
          >
            {r.nome}
          </a>
        ))}
        <button type="button" className="np-share-btn np-share-copiar" onClick={copiar}>
          {copiado ? '✓ Copiado' : 'Copiar link'}
        </button>
        <button type="button" className="np-share-btn np-share-nativo" onClick={nativo}>
          Mais…
        </button>
      </div>
    </div>
  );
}
