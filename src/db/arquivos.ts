import { agoraISO } from '@/lib/data';
import type { Arquivo } from '@/domain/tipos';
import { relativoAnexo, resolverAnexo } from '@/arquivos/caminho';
import { abrirBanco, novoId } from './index';
import { registrarExclusao } from './sync';

interface LinhaArquivo {
  id: string;
  documento_id: string;
  nome: string;
  uri: string;
  mime: string | null;
  tamanho: number | null;
  criado_em: string;
}

const daLinha = (l: LinhaArquivo): Arquivo => ({
  id: l.id,
  documentoId: l.documento_id,
  nome: l.nome,
  // Reconstrói o caminho para o container ATUAL — sobrevive a atualizações.
  uri: resolverAnexo(l.uri),
  mime: l.mime,
  tamanho: l.tamanho,
  criadoEm: l.criado_em,
});

export async function listarArquivos(): Promise<Arquivo[]> {
  const db = await abrirBanco();
  const linhas = await db.getAllAsync<LinhaArquivo>(
    'SELECT * FROM arquivos ORDER BY criado_em ASC'
  );
  return linhas.map(daLinha);
}

export async function listarArquivosDoDocumento(documentoId: string): Promise<Arquivo[]> {
  const db = await abrirBanco();
  const linhas = await db.getAllAsync<LinhaArquivo>(
    'SELECT * FROM arquivos WHERE documento_id = ? ORDER BY criado_em ASC',
    documentoId
  );
  return linhas.map(daLinha);
}

export async function registrarArquivo(dados: {
  documentoId: string;
  nome: string;
  uri: string;
  mime: string | null;
  tamanho: number | null;
}): Promise<Arquivo> {
  const db = await abrirBanco();
  // Guarda SEMPRE o caminho RELATIVO ('acervo/<id>/<arquivo>'), nunca o absoluto:
  // o absoluto embute o UUID do container, que muda a cada update/reinstalação do
  // iOS e difere entre aparelhos. Guardando relativo, `resolverAnexo` reconstrói
  // o absoluto atual na leitura e nada quebra em update/logout/troca de aparelho.
  const rel = relativoAnexo(dados.uri);
  const id = novoId();
  const criadoEm = agoraISO();
  await db.runAsync(
    'INSERT INTO arquivos (id, documento_id, nome, uri, mime, tamanho, criado_em) VALUES (?,?,?,?,?,?,?)',
    id,
    dados.documentoId,
    dados.nome,
    rel,
    dados.mime,
    dados.tamanho,
    criadoEm
  );
  return {
    id,
    documentoId: dados.documentoId,
    nome: dados.nome,
    uri: resolverAnexo(rel), // devolve absoluto atual, pronto para uso imediato
    mime: dados.mime,
    tamanho: dados.tamanho,
    criadoEm,
  };
}

export async function removerRegistroArquivo(id: string): Promise<void> {
  const db = await abrirBanco();
  await db.runAsync('DELETE FROM arquivos WHERE id = ?', id);
  await registrarExclusao('arquivos', id);
}
