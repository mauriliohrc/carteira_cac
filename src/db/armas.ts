import { agoraISO } from '@/lib/data';
import type { Arma } from '@/domain/tipos';
import { abrirBanco, limpo, novoId } from './index';
import { registrarExclusao } from './sync';

interface LinhaArma {
  id: string;
  apelido: string | null;
  marca: string | null;
  modelo: string;
  numero_serie: string;
  acervo: string;
  grupo: string;
  calibre: string;
  especie: string | null;
  funcionamento: string | null;
  fabricante: string | null;
  pais_origem: string | null;
  ano_fabricacao: string | null;
  numero_cano: string | null;
  capacidade: string | null;
  registro_numero: string | null;
  local_guarda: string | null;
  observacoes: string | null;
  criado_em: string;
  atualizado_em: string;
}

function daLinha(l: LinhaArma): Arma {
  return {
    id: l.id,
    apelido: l.apelido,
    marca: l.marca,
    modelo: l.modelo,
    numeroSerie: l.numero_serie,
    acervo: l.acervo as Arma['acervo'],
    grupo: l.grupo as Arma['grupo'],
    calibre: l.calibre,
    especie: l.especie,
    funcionamento: l.funcionamento,
    fabricante: l.fabricante,
    paisOrigem: l.pais_origem,
    anoFabricacao: l.ano_fabricacao,
    numeroCano: l.numero_cano,
    capacidade: l.capacidade,
    registroNumero: l.registro_numero,
    localGuarda: l.local_guarda,
    observacoes: l.observacoes,
    criadoEm: l.criado_em,
    atualizadoEm: l.atualizado_em,
  };
}

export type EntradaArma = Omit<Arma, 'id' | 'criadoEm' | 'atualizadoEm'>;

export async function listarArmas(): Promise<Arma[]> {
  const db = await abrirBanco();
  const linhas = await db.getAllAsync<LinhaArma>(
    'SELECT * FROM armas ORDER BY criado_em ASC'
  );
  return linhas.map(daLinha);
}

export async function obterArma(id: string): Promise<Arma | null> {
  const db = await abrirBanco();
  const linha = await db.getFirstAsync<LinhaArma>('SELECT * FROM armas WHERE id = ?', id);
  return linha ? daLinha(linha) : null;
}

export async function contarArmas(): Promise<number> {
  const db = await abrirBanco();
  const r = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM armas');
  return r?.n ?? 0;
}

export async function criarArma(entrada: EntradaArma): Promise<string> {
  const db = await abrirBanco();
  const id = novoId();
  const agora = agoraISO();
  await db.runAsync(
    `INSERT INTO armas (
      id, apelido, marca, modelo, numero_serie, acervo, grupo, calibre, especie,
      funcionamento, fabricante, pais_origem, ano_fabricacao, numero_cano, capacidade,
      registro_numero, local_guarda, observacoes, criado_em, atualizado_em
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    id,
    limpo(entrada.apelido),
    limpo(entrada.marca),
    entrada.modelo.trim(),
    entrada.numeroSerie.trim(),
    entrada.acervo,
    entrada.grupo,
    entrada.calibre.trim(),
    limpo(entrada.especie),
    limpo(entrada.funcionamento),
    limpo(entrada.fabricante),
    limpo(entrada.paisOrigem),
    limpo(entrada.anoFabricacao),
    limpo(entrada.numeroCano),
    limpo(entrada.capacidade),
    limpo(entrada.registroNumero),
    limpo(entrada.localGuarda),
    limpo(entrada.observacoes),
    agora,
    agora
  );
  return id;
}

export async function atualizarArma(id: string, entrada: EntradaArma): Promise<void> {
  const db = await abrirBanco();
  await db.runAsync(
    `UPDATE armas SET
      apelido = ?, marca = ?, modelo = ?, numero_serie = ?, acervo = ?, grupo = ?,
      calibre = ?, especie = ?, funcionamento = ?, fabricante = ?, pais_origem = ?,
      ano_fabricacao = ?, numero_cano = ?, capacidade = ?, registro_numero = ?,
      local_guarda = ?, observacoes = ?, atualizado_em = ?
     WHERE id = ?`,
    limpo(entrada.apelido),
    limpo(entrada.marca),
    entrada.modelo.trim(),
    entrada.numeroSerie.trim(),
    entrada.acervo,
    entrada.grupo,
    entrada.calibre.trim(),
    limpo(entrada.especie),
    limpo(entrada.funcionamento),
    limpo(entrada.fabricante),
    limpo(entrada.paisOrigem),
    limpo(entrada.anoFabricacao),
    limpo(entrada.numeroCano),
    limpo(entrada.capacidade),
    limpo(entrada.registroNumero),
    limpo(entrada.localGuarda),
    limpo(entrada.observacoes),
    agoraISO(),
    id
  );
}

export async function removerArma(id: string): Promise<void> {
  const db = await abrirBanco();
  await db.runAsync('DELETE FROM armas WHERE id = ?', id);
  await registrarExclusao('armas', id);
}

// Reexportado daqui por conveniência: as telas já importam deste módulo.
export { nomeArma } from '@/domain/rotulos';
