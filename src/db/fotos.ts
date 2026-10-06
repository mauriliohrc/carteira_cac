import { agoraISO } from '@/lib/data';
import { resolverAnexo } from '@/arquivos/caminho';
import { abrirBanco, limpo, novoId } from './index';
import { registrarExclusao } from './sync';

/** Uma foto do armamento. Vive na arma, não em documento. */
export interface Foto {
  id: string;
  armaId: string;
  uri: string;
  legenda: string | null;
  ordem: number;
  criadoEm: string;
}

interface LinhaFoto {
  id: string;
  arma_id: string;
  uri: string;
  legenda: string | null;
  ordem: number;
  criado_em: string;
}

const daLinha = (l: LinhaFoto): Foto => ({
  id: l.id,
  armaId: l.arma_id,
  // Reconstrói o caminho para o container ATUAL — sobrevive a atualizações.
  uri: resolverAnexo(l.uri),
  legenda: l.legenda,
  ordem: l.ordem,
  criadoEm: l.criado_em,
});

export async function listarFotos(): Promise<Foto[]> {
  const db = await abrirBanco();
  const linhas = await db.getAllAsync<LinhaFoto>(
    'SELECT * FROM fotos ORDER BY arma_id, ordem ASC, criado_em ASC'
  );
  return linhas.map(daLinha);
}

export async function registrarFoto(dados: {
  armaId: string;
  uri: string;
  legenda?: string | null;
}): Promise<Foto> {
  const db = await abrirBanco();

  // A nova entra no fim da fila desta arma.
  const ultima = await db.getFirstAsync<{ proxima: number }>(
    'SELECT COALESCE(MAX(ordem), -1) + 1 AS proxima FROM fotos WHERE arma_id = ?',
    dados.armaId
  );

  const foto: Foto = {
    id: novoId(),
    armaId: dados.armaId,
    uri: dados.uri,
    legenda: limpo(dados.legenda),
    ordem: ultima?.proxima ?? 0,
    criadoEm: agoraISO(),
  };

  await db.runAsync(
    'INSERT INTO fotos (id, arma_id, uri, legenda, ordem, criado_em) VALUES (?,?,?,?,?,?)',
    foto.id,
    foto.armaId,
    foto.uri,
    foto.legenda,
    foto.ordem,
    foto.criadoEm
  );
  return foto;
}

export async function removerRegistroFoto(id: string): Promise<void> {
  const db = await abrirBanco();
  await db.runAsync('DELETE FROM fotos WHERE id = ?', id);
  await registrarExclusao('fotos', id);
}

/** Promove a foto a primeira da arma — vira a capa. */
export async function definirComoCapa(foto: Foto): Promise<void> {
  const db = await abrirBanco();
  await db.runAsync(
    'UPDATE fotos SET ordem = ordem + 1 WHERE arma_id = ? AND id != ?',
    foto.armaId,
    foto.id
  );
  await db.runAsync('UPDATE fotos SET ordem = 0 WHERE id = ?', foto.id);
}
