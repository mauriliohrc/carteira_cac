import { useCallback, useState } from 'react';
import { router } from 'expo-router';

import { escolherDocumento } from '@/arquivos/cofre';
import { extrairCamposDoArquivo } from '@/integracoes/extracao';
import type { TipoDocumento } from '@/domain/tipos';

interface Opcoes {
  escopo: 'PESSOAL' | 'ARMA';
  armaId?: string;
  tipo?: TipoDocumento;
}

/**
 * Novo fluxo de cadastro de documento: pergunta a origem do arquivo
 * (Arquivos ou Galeria). Escolhido o arquivo, extrai os dados e abre o editor
 * já preenchido (com o arquivo pendente para anexar ao salvar). Cancelar a
 * folha abre o editor vazio.
 *
 * Expõe `analisando` para a tela renderizar o modal "Estamos analisando…".
 */
export function useNovoDocumento() {
  const [analisando, setAnalisando] = useState(false);

  const iniciar = useCallback(async (opts: Opcoes) => {
    const base: Record<string, string> = { escopo: opts.escopo };
    if (opts.armaId) base.armaId = opts.armaId;
    if (opts.tipo) base.tipo = opts.tipo;

    const irParaEditor = (extra?: Record<string, string>) =>
      router.push({ pathname: '/documento/editar', params: { ...base, ...extra } });

    const escolhido = await escolherDocumento();
    if (!escolhido) return irParaEditor();

    const arquivo: Record<string, string> = {
      arquivoUri: escolhido.uri,
      arquivoNome: escolhido.nome,
      arquivoMime: escolhido.mime ?? '',
      arquivoTamanho: String(escolhido.tamanho ?? 0),
    };

    // PDF (texto) ou foto/scan (OCR): mostra o modal, extrai e abre o editor
    // já preenchido com o arquivo pendente.
    setAnalisando(true);
    let campos: Record<string, unknown> = {};
    try {
      campos = (await extrairCamposDoArquivo(escolhido.uri, escolhido.mime ?? '', opts.tipo)) as Record<
        string,
        unknown
      >;
    } finally {
      setAnalisando(false);
    }
    irParaEditor({
      ...arquivo,
      ...(Object.keys(campos).length ? { campos: JSON.stringify(campos) } : {}),
    });
  }, []);

  return { iniciar, analisando };
}
