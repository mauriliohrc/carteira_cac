import { useCallback, useState } from 'react';
import { router } from 'expo-router';

import { confirmar } from '@/ui/dialogo';
import { escolherPdfOuImagem } from '@/arquivos/cofre';
import { extrairCamposDoArquivo } from '@/integracoes/extracao';
import type { TipoDocumento } from '@/domain/tipos';

interface Opcoes {
  escopo: 'PESSOAL' | 'ARMA';
  armaId?: string;
  tipo?: TipoDocumento;
}

/**
 * Novo fluxo de cadastro de documento: primeiro pergunta se o usuário quer
 * escolher o arquivo. Se sim, extrai os dados (PDF por texto; foto/scan por
 * OCR) e abre o editor já preenchido (com o arquivo pendente para anexar ao
 * salvar). "Não" abre o editor vazio, como antes.
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

    const querArquivo = await confirmar({
      titulo: 'Anexar um arquivo agora?',
      mensagem:
        'Quer escolher o arquivo deste documento agora? A gente lê (PDF ou foto) e já preenche o que der.',
      rotuloConfirmar: 'Escolher arquivo',
    });
    if (!querArquivo) return irParaEditor();

    const escolhido = await escolherPdfOuImagem();
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
