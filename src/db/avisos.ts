import { abrirBanco } from './index';

/** Um alerta que já chegou ao aparelho — o histórico da caixa de avisos. */
export interface AvisoRecebido {
  id: string;
  titulo: string | null;
  subtitulo: string | null;
  corpo: string | null;
  recebidoEm: string;
  lido: boolean;
}

interface LinhaAviso {
  id: string;
  titulo: string | null;
  subtitulo: string | null;
  corpo: string | null;
  recebido_em: string;
  lido: number;
}

const daLinha = (l: LinhaAviso): AvisoRecebido => ({
  id: l.id,
  titulo: l.titulo,
  subtitulo: l.subtitulo,
  corpo: l.corpo,
  recebidoEm: l.recebido_em,
  lido: l.lido === 1,
});

/** Guarda os 200 últimos; acima disso o histórico deixa de ser útil. */
const LIMITE_HISTORICO = 200;

export async function listarAvisos(): Promise<AvisoRecebido[]> {
  const db = await abrirBanco();
  const linhas = await db.getAllAsync<LinhaAviso>(
    'SELECT * FROM avisos ORDER BY recebido_em DESC LIMIT ?',
    LIMITE_HISTORICO
  );
  return linhas.map(daLinha);
}

/**
 * Registra um aviso. Idempotente pelo identificador da notificação: a mesma
 * notificação pode chegar pelo listener e pela varredura da Central de
 * Notificações, e não deve virar duas linhas.
 */
export async function registrarAviso(aviso: {
  id: string;
  titulo: string | null;
  subtitulo: string | null;
  corpo: string | null;
  recebidoEm: string;
}): Promise<void> {
  const db = await abrirBanco();
  await db.runAsync(
    `INSERT INTO avisos (id, titulo, subtitulo, corpo, recebido_em, lido)
     VALUES (?, ?, ?, ?, ?, 0)
     ON CONFLICT(id) DO NOTHING`,
    aviso.id,
    aviso.titulo,
    aviso.subtitulo,
    aviso.corpo,
    aviso.recebidoEm
  );
}

export async function marcarAvisoLido(id: string): Promise<void> {
  const db = await abrirBanco();
  await db.runAsync('UPDATE avisos SET lido = 1 WHERE id = ?', id);
}

export async function marcarTodosLidos(): Promise<void> {
  const db = await abrirBanco();
  await db.runAsync('UPDATE avisos SET lido = 1 WHERE lido = 0');
}

export async function limparAvisos(): Promise<void> {
  const db = await abrirBanco();
  await db.runAsync('DELETE FROM avisos');
}

/** Descarta o que passou do limite, mantendo os mais recentes. */
export async function podarHistorico(): Promise<void> {
  const db = await abrirBanco();
  await db.runAsync(
    `DELETE FROM avisos WHERE id NOT IN (
       SELECT id FROM avisos ORDER BY recebido_em DESC LIMIT ?
     )`,
    LIMITE_HISTORICO
  );
}
