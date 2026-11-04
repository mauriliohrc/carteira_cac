import { agoraISO } from '@/lib/data';
import { abrirBanco } from './index';
import { CHAVES, gravarConfig } from './config';
import { ordenarParaAplicar } from './ordemSync';

/** Um registro no formato de sincronização (genérico por tabela). */
export interface RegistroSync {
  tipo: string;
  registroId: string;
  dados: Record<string, unknown>;
  atualizadoEm: string;
  removido?: boolean;
}

// Tabelas espelhadas. 'habitualidades' é especial: leva as armas aninhadas.
// (arquivos/fotos entram com tratamento de blob na camada de arquivos.)
// Ordem importa: pais antes dos filhos (FK). documentos antes de arquivos; armas antes de fotos.
// 'favoritos' usa o mesmo maquinário genérico (PK `id` = id da arma). Apps
// antigos não o conhecem: ignoram o tipo no pull (TABELAS_VALIDAS) e nunca o
// enviam — por isso é seguro sincronizá-lo sem quebrar versões anteriores.
const TABELAS_SIMPLES = ['locais_tiro', 'armas', 'documentos', 'arquivos', 'fotos', 'favoritos', 'ambitos_competicao'] as const;
// 'processos' é só de leitura no app (criado/tocado pelo servidor): entra em
// VALIDAS (aplica no pull) mas NÃO em SIMPLES (o app nunca faz push disso).
const TABELAS_VALIDAS = new Set<string>([...TABELAS_SIMPLES, 'habitualidades', 'processos']);

type Linha = Record<string, unknown> & { id: string };

function carimbo(l: Linha): string {
  return (l.atualizado_em as string) ?? (l.criado_em as string) ?? agoraISO();
}

/** Lê todo o acervo local no formato de sincronização. */
export async function coletarRegistros(): Promise<RegistroSync[]> {
  const db = await abrirBanco();
  const registros: RegistroSync[] = [];

  for (const t of TABELAS_SIMPLES) {
    const linhas = await db.getAllAsync<Linha>(`SELECT * FROM ${t}`);
    for (const l of linhas) {
      registros.push({ tipo: t, registroId: l.id, dados: l, atualizadoEm: carimbo(l) });
    }
  }

  // habitualidades + armas aninhadas
  const hs = await db.getAllAsync<Linha>('SELECT * FROM habitualidades');
  const armas = await db.getAllAsync<Record<string, unknown> & { habitualidade_id: string }>(
    'SELECT * FROM habitualidade_armas'
  );
  const porH = new Map<string, unknown[]>();
  for (const a of armas) {
    const lista = porH.get(a.habitualidade_id) ?? [];
    lista.push(a);
    porH.set(a.habitualidade_id, lista);
  }
  for (const h of hs) {
    registros.push({
      tipo: 'habitualidades',
      registroId: h.id,
      dados: { ...h, _armas: porH.get(h.id) ?? [] },
      atualizadoEm: carimbo(h),
    });
  }

  return registros;
}

/** Exclusões locais pendentes (tombstones) para empurrar como `removido`. */
export async function coletarExclusoes(): Promise<RegistroSync[]> {
  const db = await abrirBanco();
  const linhas = await db.getAllAsync<{ tipo: string; registro_id: string; excluido_em: string }>(
    'SELECT * FROM exclusoes'
  );
  return linhas.map((e) => ({
    tipo: e.tipo,
    registroId: e.registro_id,
    dados: {},
    atualizadoEm: e.excluido_em,
    removido: true,
  }));
}

export async function limparExclusoes(): Promise<void> {
  const db = await abrirBanco();
  await db.runAsync('DELETE FROM exclusoes');
}

/**
 * Aplica um lote de registros vindos do pull de forma resiliente.
 *
 * Dois problemas históricos travavam o acervo inteiro ao descer em outro
 * aparelho:
 *  1. ordem — o pull chega por carimbo do servidor, não por dependência de FK,
 *     então filhos chegavam antes dos pais e a FK estourava (ver [[ordemSync]]);
 *  2. propagação — uma única exceção abortava o `for` do pull, o cursor não era
 *     salvo e NADA era aplicado (ficava tentando o mesmo lote e falhando sempre).
 *
 * Aqui ordenamos pai→filho e isolamos cada registro: um órfão (ex.: documento de
 * uma arma já removida que ficou ativo no espelho) é ignorado, sem derrubar o
 * resto. Devolve quantos foram aplicados.
 */
export async function aplicarLote(registros: RegistroSync[]): Promise<number> {
  const ordenados = ordenarParaAplicar(registros);
  let aplicados = 0;
  for (const r of ordenados) {
    try {
      await aplicarRegistro(r);
      aplicados += 1;
    } catch (e) {
      console.warn('[CAC Brasil] registro ignorado no pull', r.tipo, r.registroId, e);
    }
  }
  return aplicados;
}

/**
 * Apaga todo o acervo local e o estado de sincronização. Usado no logout, para
 * voltar ao modo anônimo limpo — os dados seguem no espelho da nuvem e voltam
 * ao religar. Evita vazar dados de uma conta para outra no mesmo aparelho.
 */
export async function limparAcervoLocal(): Promise<void> {
  const db = await abrirBanco();
  await db.withTransactionAsync(async () => {
    // Filhos antes dos pais (FK). exclusoes não tem FK.
    for (const t of [
      'habitualidade_armas',
      'habitualidades',
      'ambitos_competicao',
      'arquivos',
      'fotos',
      'documentos',
      'favoritos',
      'processos',
      'armas',
      'locais_tiro',
      'exclusoes',
    ]) {
      await db.runAsync(`DELETE FROM ${t}`);
    }
  });
  // Zera cursor e marcadores de import para re-sincronizar do zero no próximo login.
  await gravarConfig(CHAVES.syncCursor, null);
  await gravarConfig(CHAVES.armasImportadasSH, null);
  await gravarConfig(CHAVES.docsImportadosSH, null);
}

/** Registra um tombstone — chamado pelas funções de remoção. */
export async function registrarExclusao(tipo: string, id: string): Promise<void> {
  const db = await abrirBanco();
  await db.runAsync(
    'INSERT OR REPLACE INTO exclusoes (tipo, registro_id, excluido_em) VALUES (?,?,?)',
    tipo,
    id,
    agoraISO()
  );
}

function upsertLinha(cols: string[]): string {
  const ph = cols.map(() => '?').join(',');
  const sets = cols.filter((c) => c !== 'id').map((c) => `${c}=excluded.${c}`).join(',');
  return `(${cols.join(',')}) VALUES (${ph}) ON CONFLICT(id) DO UPDATE SET ${sets}`;
}

/** Aplica um registro vindo da nuvem no banco local (upsert ou remoção). */
export async function aplicarRegistro(r: RegistroSync): Promise<void> {
  if (!TABELAS_VALIDAS.has(r.tipo)) return; // tipo desconhecido (versão futura): ignora
  const db = await abrirBanco();

  if (r.removido) {
    await db.runAsync(`DELETE FROM ${r.tipo} WHERE id = ?`, r.registroId);
    return;
  }

  if (r.tipo === 'habitualidades') {
    const { _armas, ...linha } = r.dados as Record<string, unknown> & { _armas?: Record<string, unknown>[] };
    const cols = Object.keys(linha);
    await db.withTransactionAsync(async () => {
      // Remove duplicata de outro aparelho com mesmo externo_id (dedupe).
      const externo = (linha as { externo_id?: string }).externo_id;
      if (externo) {
        await db.runAsync('DELETE FROM habitualidades WHERE externo_id = ? AND id <> ?', externo, r.registroId);
      }
      await db.runAsync(
        `INSERT INTO habitualidades ${upsertLinha(cols)}`,
        ...cols.map((c) => linha[c] as never)
      );
      await db.runAsync('DELETE FROM habitualidade_armas WHERE habitualidade_id = ?', r.registroId);
      for (const a of _armas ?? []) {
        const ac = Object.keys(a);
        await db.runAsync(
          `INSERT OR REPLACE INTO habitualidade_armas (${ac.join(',')}) VALUES (${ac.map(() => '?').join(',')})`,
          ...ac.map((c) => a[c] as never)
        );
      }
    });
    return;
  }

  // Tabelas simples: upsert por id (sem DELETE, para não disparar cascatas).
  const cols = Object.keys(r.dados);
  if (!cols.includes('id')) return;
  await db.runAsync(`INSERT INTO ${r.tipo} ${upsertLinha(cols)}`, ...cols.map((c) => r.dados[c] as never));
}
