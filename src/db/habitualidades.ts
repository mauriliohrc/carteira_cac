import { agoraISO, type DataISO } from '@/lib/data';
import type {
  ArmaNaHabitualidade,
  Grupo,
  Habitualidade,
  TipoSessao,
} from '@/domain/tipos';
import { abrirBanco, limpo, novoId } from './index';
import { registrarExclusao } from './sync';

interface LinhaSessao {
  id: string;
  data: string;
  tipo: string;
  local_id: string | null;
  local_nome: string | null;
  observacoes: string | null;
  criado_em: string;
  atualizado_em: string;
}

interface LinhaArma {
  habitualidade_id: string;
  arma_id: string | null;
  grupo: string;
  arma_nome: string;
}

export interface EntradaHabitualidade {
  data: DataISO;
  tipo: TipoSessao;
  localId: string | null;
  localNome: string | null;
  observacoes: string | null;
  /** Armas usadas na sessão. O grupo e o nome vão gravados junto, de propósito. */
  armas: ArmaNaHabitualidade[];
}

export async function listarHabitualidades(): Promise<Habitualidade[]> {
  const db = await abrirBanco();
  const [sessoes, itens] = await Promise.all([
    db.getAllAsync<LinhaSessao>('SELECT * FROM habitualidades ORDER BY data DESC'),
    db.getAllAsync<LinhaArma>(
      'SELECT habitualidade_id, arma_id, grupo, arma_nome FROM habitualidade_armas'
    ),
  ]);

  const porSessao = new Map<string, ArmaNaHabitualidade[]>();
  for (const i of itens) {
    const arma: ArmaNaHabitualidade = {
      armaId: i.arma_id,
      grupo: i.grupo as Grupo,
      nome: i.arma_nome,
    };
    const lista = porSessao.get(i.habitualidade_id);
    if (lista) lista.push(arma);
    else porSessao.set(i.habitualidade_id, [arma]);
  }

  return sessoes.map((l) => ({
    id: l.id,
    data: l.data as DataISO,
    tipo: l.tipo as TipoSessao,
    localId: l.local_id,
    localNome: l.local_nome,
    observacoes: l.observacoes,
    armas: porSessao.get(l.id) ?? [],
    criadoEm: l.criado_em,
    atualizadoEm: l.atualizado_em,
  }));
}

async function gravarArmas(
  db: Awaited<ReturnType<typeof abrirBanco>>,
  habitualidadeId: string,
  armas: ArmaNaHabitualidade[]
): Promise<void> {
  // A mesma arma duas vezes na mesma sessão bateria no índice único e, de todo
  // modo, não vale duas habitualidades — então é filtrada aqui.
  const vistas = new Set<string>();
  for (const arma of armas) {
    const chave = arma.armaId ?? `_${arma.nome}`;
    if (vistas.has(chave)) continue;
    vistas.add(chave);
    await db.runAsync(
      'INSERT INTO habitualidade_armas (id, habitualidade_id, arma_id, grupo, arma_nome) VALUES (?,?,?,?,?)',
      novoId(),
      habitualidadeId,
      arma.armaId,
      arma.grupo,
      arma.nome
    );
  }
}

export async function criarHabitualidade(entrada: EntradaHabitualidade): Promise<string> {
  const db = await abrirBanco();
  const id = novoId();
  const agora = agoraISO();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO habitualidades (
        id, data, tipo, local_id, local_nome, observacoes, criado_em, atualizado_em
      ) VALUES (?,?,?,?,?,?,?,?)`,
      id,
      entrada.data,
      entrada.tipo,
      entrada.localId,
      limpo(entrada.localNome),
      limpo(entrada.observacoes),
      agora,
      agora
    );
    await gravarArmas(db, id, entrada.armas);
  });
  return id;
}

export async function atualizarHabitualidade(
  id: string,
  entrada: EntradaHabitualidade
): Promise<void> {
  const db = await abrirBanco();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE habitualidades SET
        data = ?, tipo = ?, local_id = ?, local_nome = ?, observacoes = ?, atualizado_em = ?
       WHERE id = ?`,
      entrada.data,
      entrada.tipo,
      entrada.localId,
      limpo(entrada.localNome),
      limpo(entrada.observacoes),
      agoraISO(),
      id
    );
    // A lista de armas é reescrita inteira: é mais simples e mais seguro do que
    // reconciliar item a item, e são poucas linhas por sessão.
    await db.runAsync('DELETE FROM habitualidade_armas WHERE habitualidade_id = ?', id);
    await gravarArmas(db, id, entrada.armas);
  });
}

export async function removerHabitualidade(id: string): Promise<void> {
  const db = await abrirBanco();
  await db.runAsync('DELETE FROM habitualidades WHERE id = ?', id);
  await registrarExclusao('habitualidades', id);
}

/** Sessão vinda de um parceiro externo (ex.: Shooting House). */
export interface SessaoExterna {
  externoId: string;
  data: DataISO;
  tipo: TipoSessao;
  localNome: string | null;
  /**
   * Armas usadas no dia/local. Na Shooting House lança-se uma habitualidade por
   * arma, mas no mesmo dia e local contam como UMA — por isso vêm agrupadas numa
   * sessão só. A contagem credita cada grupo uma vez (ver `gruposDaSessao`).
   */
  armas: { grupo: Grupo; armaNome: string; serie: string | null }[];
}

/**
 * Mescla sessões externas no banco local, sem duplicar: o índice único em
 * `externo_id` + INSERT OR IGNORE garante que reimportar não cria repetidas.
 * Devolve quantas foram realmente inseridas.
 */
export async function importarExternas(sessoes: SessaoExterna[]): Promise<number> {
  const db = await abrirBanco();
  let importadas = 0;
  // Casa a arma importada (por nº de série) com a cadastrada no app, para a
  // sessão já vir com as armas marcadas e ligadas ao acervo.
  const armasLocais = await db.getAllAsync<{ id: string; numero_serie: string }>(
    'SELECT id, numero_serie FROM armas'
  );
  const idPorSerie = new Map<string, string>();
  for (const a of armasLocais) {
    if (a.numero_serie) idPorSerie.set(a.numero_serie.trim().toUpperCase(), a.id);
  }
  await db.withTransactionAsync(async () => {
    for (const s of sessoes) {
      const id = novoId();
      const agora = agoraISO();
      const r = await db.runAsync(
        `INSERT OR IGNORE INTO habitualidades (
          id, data, tipo, local_id, local_nome, observacoes, origem, externo_id, criado_em, atualizado_em
        ) VALUES (?,?,?,?,?,?,?,?,?,?)`,
        id,
        s.data,
        s.tipo,
        null,
        limpo(s.localNome),
        null,
        'SHOOTING_HOUSE',
        s.externoId,
        agora,
        agora
      );
      if (r.changes > 0) {
        // Uma linha por arma distinta do dia/local. A contagem ainda credita
        // cada grupo uma só vez (ver `gruposDaSessao` no domínio).
        const vistas = new Set<string>();
        for (const arma of s.armas) {
          const chave = `${arma.grupo}|${arma.serie ?? arma.armaNome}`;
          if (vistas.has(chave)) continue;
          vistas.add(chave);
          const armaId = arma.serie ? idPorSerie.get(arma.serie.trim().toUpperCase()) ?? null : null;
          await db.runAsync(
            'INSERT OR IGNORE INTO habitualidade_armas (id, habitualidade_id, arma_id, grupo, arma_nome) VALUES (?,?,?,?,?)',
            novoId(),
            id,
            armaId,
            arma.grupo,
            arma.armaNome
          );
        }
        importadas += 1;
      }
    }
  });
  return importadas;
}
