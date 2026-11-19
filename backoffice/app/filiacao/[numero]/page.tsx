'use client';

import { use, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { VerificacaoFiliacao } from '@/lib/tipos';

/**
 * Página PÚBLICA de verificação de uma filiação (destino do QR do certificado).
 * Sem login: qualquer pessoa (clube, PF) confere a autenticidade pelo número.
 */
export default function PaginaVerificacao({ params }: { params: Promise<{ numero: string }> }) {
  const { numero } = use(params);
  // Next 15 não decodifica params de rota — decodifica manual (ver memória).
  const num = decodeURIComponent(numero);
  const [dados, setDados] = useState<VerificacaoFiliacao | null>(null);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    api<VerificacaoFiliacao>(`/filiacao/verificar/${encodeURIComponent(num)}`, { autenticar: false })
      .then(setDados)
      .catch(() => setErro(true));
  }, [num]);

  const valido = dados?.valido === true;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'var(--fundo, #0f1115)' }}>
      <div className="cartao" style={{ maxWidth: 440, width: '100%', textAlign: 'center' }}>
        <p className="subtitulo" style={{ letterSpacing: 2, textTransform: 'uppercase' }}>
          {dados?.nomeLiga ?? 'Verificação de filiação'}
        </p>

        {erro ? (
          <h1 style={{ margin: '12px 0' }}>Não foi possível verificar</h1>
        ) : !dados ? (
          <h1 style={{ margin: '12px 0' }}>Verificando…</h1>
        ) : (
          <>
            <div style={{ fontSize: 44, margin: '8px 0' }}>{valido ? '✅' : '⚠️'}</div>
            <h1 style={{ margin: '4px 0' }}>{valido ? 'Filiação válida' : 'Filiação não ativa'}</h1>
            {dados.nome ? (
              <>
                <p style={{ fontSize: 18, fontWeight: 700, marginTop: 16 }}>{dados.nome}</p>
                <p className="subtitulo" style={{ margin: 0 }}>CPF {dados.cpf}</p>
                <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: 20, gap: 12 }}>
                  <div>
                    <div className="subtitulo" style={{ fontSize: 11 }}>Nº DE REGISTRO</div>
                    <div style={{ fontWeight: 700 }}>{dados.numeroFiliacao ?? '—'}</div>
                  </div>
                  <div>
                    <div className="subtitulo" style={{ fontSize: 11 }}>VÁLIDO ATÉ</div>
                    <div style={{ fontWeight: 700 }}>
                      {dados.vigenteAte ? new Date(dados.vigenteAte).toLocaleDateString('pt-BR') : '—'}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <p className="subtitulo" style={{ marginTop: 16 }}>Nenhuma filiação encontrada com este número.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
