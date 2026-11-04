import { escolherDocumento, guardarArquivo } from '@/arquivos/cofre';
import { extrairCamposDoArquivo, type CamposExtraidos } from '@/integracoes/extracao';
import { criarDocumento } from '@/db/documentos';
import { criarArma } from '@/db/armas';
import { TIPO_DOC_POR_VALOR } from '@/domain/catalogos';
import type { TipoDocumento } from '@/domain/tipos';

/**
 * Captura de acervo no onboarding: a ideia é NÃO fazer o usuário preencher um
 * formulário gigante. Ele só escolhe o arquivo (CR/Posse/Porte ou CRAF); a IA
 * extrai o que dá e a gente cria o "esqueleto" do registro na hora. O que não
 * veio fica em branco (nada é obrigatório) e ele completa depois, quando quiser.
 */
export type ResultadoCaptura = 'criado' | 'cancelado';

/** Sobe o documento de registro pessoal (CR/Posse/Porte) e cria o esqueleto. */
export async function capturarDocumentoPessoal(
  tipo: TipoDocumento = 'CR',
  aoAnalisar?: (ativo: boolean) => void
): Promise<ResultadoCaptura> {
  const escolhido = await escolherDocumento();
  if (!escolhido) return 'cancelado';

  let campos: CamposExtraidos = {};
  aoAnalisar?.(true);
  try {
    campos = await extrairCamposDoArquivo(escolhido.uri, escolhido.mime ?? '', tipo);
  } catch {
    /* IA é best-effort: sem campos, segue com o esqueleto vazio */
  } finally {
    aoAnalisar?.(false);
  }

  const id = await criarDocumento({
    tipo,
    armaId: null,
    titulo: null,
    numero: campos.numero ?? null,
    orgao: TIPO_DOC_POR_VALOR[tipo].orgaoPadrao,
    dataEmissao: campos.dataEmissao ?? null,
    dataValidade: campos.dataValidade ?? '',
    origem: null,
    destino: null,
    localManejo: null,
    observacoes: null,
  });
  await guardarArquivo(id, escolhido).catch(() => {});
  return 'criado';
}

/** Sobe o CRAF de uma arma: cria a ARMA esqueleto + o documento CRAF anexado. */
export async function capturarCraf(
  aoAnalisar?: (ativo: boolean) => void
): Promise<ResultadoCaptura> {
  const escolhido = await escolherDocumento();
  if (!escolhido) return 'cancelado';

  let campos: CamposExtraidos = {};
  aoAnalisar?.(true);
  try {
    campos = await extrairCamposDoArquivo(escolhido.uri, escolhido.mime ?? '', 'CRAF');
  } catch {
    /* best-effort */
  } finally {
    aoAnalisar?.(false);
  }

  // Esqueleto da arma com o que a IA conseguiu ler. Acervo/grupo entram num
  // default comum (Atirador / arma curta restrita) — o usuário ajusta depois.
  const armaId = await criarArma({
    apelido: '',
    marca: campos.marca ?? '',
    modelo: campos.modelo ?? '',
    numeroSerie: campos.numeroSerie ?? '',
    acervo: 'ATIRADOR',
    grupo: 'CC_RESTRITA',
    calibre: campos.calibre ?? '',
    especie: campos.especie ?? '',
    funcionamento: '',
    fabricante: campos.fabricante ?? '',
    paisOrigem: campos.paisOrigem ?? '',
    anoFabricacao: campos.anoFabricacao ?? '',
    numeroCano: '',
    capacidade: '',
    registroNumero: campos.numero ?? '',
    localGuarda: '',
    observacoes: '',
  });

  const docId = await criarDocumento({
    tipo: 'CRAF',
    armaId,
    titulo: null,
    numero: campos.numero ?? null,
    orgao: TIPO_DOC_POR_VALOR.CRAF.orgaoPadrao,
    dataEmissao: campos.dataEmissao ?? null,
    dataValidade: campos.dataValidade ?? '',
    origem: null,
    destino: null,
    localManejo: null,
    observacoes: null,
  });
  await guardarArquivo(docId, escolhido).catch(() => {});
  return 'criado';
}
