import * as FS from 'expo-file-system/legacy';

import { apiApp } from '@/conta/api';
import { lerToken } from '@/conta/armazenamento';
import { novoId } from '@/db';
import type { Filiacao } from '@/domain/tipos';

/** Conteúdo editável da tela da liga (vem do backoffice, com fallback embutido). */
export interface ConteudoLiga {
  titulo: string;
  subtitulo: string;
  vantagens: string[];
  credibilidade: string;
  termos: string;
}

/** Identidade e preço da liga (configuráveis no backoffice). */
export interface ConfigFiliacao {
  valorCentavos: number;
  ativo: boolean;
  nomeLiga: string;
  logoUrl: string | null;
  conteudo?: ConteudoLiga;
  mesesVinculo: number;
}

export interface RespostaFiliacao {
  filiacao: Filiacao | null;
  config: ConfigFiliacao;
}

export interface DadosEndereco {
  cep?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
}

export type TipoDocIdentificacao = 'CNH' | 'RG' | 'RNE' | 'OUTRO';

/** Status + preço/identidade da liga para a tela de filiação. */
export async function obterFiliacao(): Promise<RespostaFiliacao | null> {
  const token = await lerToken();
  if (!token) return null;
  try {
    return await apiApp<RespostaFiliacao>('/filiacao', { token });
  } catch {
    return null;
  }
}

/** Solicita a filiação e abre a assinatura anual no Asaas. */
export async function filiar(dados: {
  nomeCompleto: string;
  endereco?: DadosEndereco;
  docTipo?: TipoDocIdentificacao;
  docArquivoId?: string;
}): Promise<{ filiacao: Filiacao; invoiceUrl: string | null }> {
  const token = await lerToken();
  return apiApp<{ filiacao: Filiacao; invoiceUrl: string | null }>('/filiacao', {
    metodo: 'POST',
    token,
    corpo: dados,
  });
}

/**
 * Sobe o documento de identificação (CNH/RG) e o vincula à filiação. O arquivo
 * vai pelo canal genérico de blobs do sync (ArquivoSync) com um registroId novo;
 * depois POST /filiacao/documento só guarda a referência.
 */
export async function enviarDocumentoFiliacao(
  docTipo: TipoDocIdentificacao,
  arquivo: { uri: string; mime: string | null }
): Promise<Filiacao> {
  const token = await lerToken();
  const docArquivoId = novoId();
  const base64 = await FS.readAsStringAsync(arquivo.uri, { encoding: FS.EncodingType.Base64 });
  await apiApp('/sync/arquivo', {
    metodo: 'POST',
    corpo: { registroId: docArquivoId, mime: arquivo.mime, base64 },
    token,
  });
  const r = await apiApp<{ filiacao: Filiacao }>('/filiacao/documento', {
    metodo: 'POST',
    token,
    corpo: { docTipo, docArquivoId },
  });
  return r.filiacao;
}

/** Benefícios da filiação, exibidos na apresentação (fallback das vantagens). */
export const BENEFICIOS_FILIACAO = [
  'Vínculo anual com entidade formalizada — requisito legal para o CAC',
  'Validade na Polícia Federal para provas de nível nacional',
  'Assessoria jurídica da liga durante toda a vigência',
  'Competições federais para manter e subir de nível',
  'Acesso Premium completo ao aplicativo (acervo ilimitado)',
];

/** Conteúdo padrão da tela da liga (fallback se o servidor não respondeu). */
export const CONTEUDO_LIGA_PADRAO: ConteudoLiga = {
  titulo: 'Faça parte da liga',
  subtitulo:
    'A filiação garante seu vínculo com uma entidade de tiro (exigência legal do CAC) e ainda libera o app completo.',
  vantagens: BENEFICIOS_FILIACAO,
  credibilidade:
    'Liga formalizada e atuante. Os responsáveis pelo app e pela liga estão no mercado de tiro esportivo há mais de 10 anos.',
  termos:
    'A anuidade renova automaticamente a cada ano, salvo cancelamento. O vínculo associativo e a assessoria jurídica valem durante a vigência.',
};
