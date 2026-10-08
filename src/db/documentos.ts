import { agoraISO, type DataISO } from '@/lib/data';
import type { Documento, TipoDocumento } from '@/domain/tipos';
import { abrirBanco, limpo, novoId } from './index';
import { registrarExclusao } from './sync';

interface LinhaDoc {
  id: string;
  tipo: string;
  arma_id: string | null;
  titulo: string | null;
  numero: string | null;
  orgao: string | null;
  data_emissao: string | null;
  data_validade: string;
  origem: string | null;
  destino: string | null;
  local_manejo: string | null;
  observacoes: string | null;
  criado_em: string;
  atualizado_em: string;
}

function daLinha(l: LinhaDoc): Documento {
  return {
    id: l.id,
    tipo: l.tipo as TipoDocumento,
    armaId: l.arma_id,
    titulo: l.titulo,
    numero: l.numero,
    orgao: l.orgao as Documento['orgao'],
    dataEmissao: l.data_emissao,
    dataValidade: l.data_validade as DataISO,
    origem: l.origem,
    destino: l.destino,
    localManejo: l.local_manejo,
    observacoes: l.observacoes,
    criadoEm: l.criado_em,
    atualizadoEm: l.atualizado_em,
  };
}

export type EntradaDocumento = Omit<Documento, 'id' | 'criadoEm' | 'atualizadoEm'>;

export async function listarDocumentos(): Promise<Documento[]> {
  const db = await abrirBanco();
  const linhas = await db.getAllAsync<LinhaDoc>(
    'SELECT * FROM documentos ORDER BY data_validade ASC'
  );
  return linhas.map(daLinha);
}

export async function obterDocumento(id: string): Promise<Documento | null> {
  const db = await abrirBanco();
  const l = await db.getFirstAsync<LinhaDoc>('SELECT * FROM documentos WHERE id = ?', id);
  return l ? daLinha(l) : null;
}

export async function criarDocumento(entrada: EntradaDocumento): Promise<string> {
  const db = await abrirBanco();
  const id = novoId();
  const agora = agoraISO();
  await db.runAsync(
    `INSERT INTO documentos (
      id, tipo, arma_id, titulo, numero, orgao, data_emissao, data_validade,
      origem, destino, local_manejo, observacoes, criado_em, atualizado_em
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    id,
    entrada.tipo,
    entrada.armaId,
    limpo(entrada.titulo),
    limpo(entrada.numero),
    entrada.orgao,
    limpo(entrada.dataEmissao),
    entrada.dataValidade,
    limpo(entrada.origem),
    limpo(entrada.destino),
    limpo(entrada.localManejo),
    limpo(entrada.observacoes),
    agora,
    agora
  );
  return id;
}

export async function atualizarDocumento(
  id: string,
  entrada: EntradaDocumento
): Promise<void> {
  const db = await abrirBanco();
  await db.runAsync(
    `UPDATE documentos SET
      tipo = ?, arma_id = ?, titulo = ?, numero = ?, orgao = ?, data_emissao = ?,
      data_validade = ?, origem = ?, destino = ?, local_manejo = ?,
      observacoes = ?, atualizado_em = ?
     WHERE id = ?`,
    entrada.tipo,
    entrada.armaId,
    limpo(entrada.titulo),
    limpo(entrada.numero),
    entrada.orgao,
    limpo(entrada.dataEmissao),
    entrada.dataValidade,
    limpo(entrada.origem),
    limpo(entrada.destino),
    limpo(entrada.localManejo),
    limpo(entrada.observacoes),
    agoraISO(),
    id
  );
}

export async function removerDocumento(id: string): Promise<void> {
  const db = await abrirBanco();
  await db.runAsync('DELETE FROM documentos WHERE id = ?', id);
  await registrarExclusao('documentos', id);
}
