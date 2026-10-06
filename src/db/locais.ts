import { agoraISO } from '@/lib/data';
import type { LocalTiro } from '@/domain/tipos';
import { abrirBanco, limpo, novoId } from './index';
import { registrarExclusao } from './sync';

interface LinhaLocal {
  id: string;
  nome: string;
  cidade: string | null;
  uf: string | null;
  cr: string | null;
  observacoes: string | null;
  criado_em: string;
}

const daLinha = (l: LinhaLocal): LocalTiro => ({
  id: l.id,
  nome: l.nome,
  cidade: l.cidade,
  uf: l.uf,
  cr: l.cr,
  observacoes: l.observacoes,
  criadoEm: l.criado_em,
});

export type EntradaLocal = Omit<LocalTiro, 'id' | 'criadoEm'>;

export async function listarLocais(): Promise<LocalTiro[]> {
  const db = await abrirBanco();
  const linhas = await db.getAllAsync<LinhaLocal>(
    'SELECT * FROM locais_tiro ORDER BY nome COLLATE NOCASE ASC'
  );
  return linhas.map(daLinha);
}

export async function criarLocal(entrada: EntradaLocal): Promise<string> {
  const db = await abrirBanco();
  const id = novoId();
  await db.runAsync(
    'INSERT INTO locais_tiro (id, nome, cidade, uf, cr, observacoes, criado_em) VALUES (?,?,?,?,?,?,?)',
    id,
    entrada.nome.trim(),
    limpo(entrada.cidade),
    limpo(entrada.uf)?.toUpperCase() ?? null,
    limpo(entrada.cr),
    limpo(entrada.observacoes),
    agoraISO()
  );
  return id;
}

export async function atualizarLocal(id: string, entrada: EntradaLocal): Promise<void> {
  const db = await abrirBanco();
  await db.runAsync(
    'UPDATE locais_tiro SET nome = ?, cidade = ?, uf = ?, cr = ?, observacoes = ? WHERE id = ?',
    entrada.nome.trim(),
    limpo(entrada.cidade),
    limpo(entrada.uf)?.toUpperCase() ?? null,
    limpo(entrada.cr),
    limpo(entrada.observacoes),
    id
  );
}

/**
 * Apagar o local NÃO apaga as sessões feitas nele: a coluna `local_id` cai para
 * null e o `local_nome` gravado na sessão continua na tela. A habitualidade
 * aconteceu — o que saiu do app foi só o cadastro do clube.
 */
export async function removerLocal(id: string): Promise<void> {
  const db = await abrirBanco();
  await db.runAsync('DELETE FROM locais_tiro WHERE id = ?', id);
  await registrarExclusao('locais_tiro', id);
}
