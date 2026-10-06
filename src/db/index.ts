import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';

const NOME_BANCO = 'cacbrasil.db';
const VERSAO_ALVO = 7;

let instancia: SQLite.SQLiteDatabase | null = null;
let abrindo: Promise<SQLite.SQLiteDatabase> | null = null;

const MIGRACOES: ((db: SQLite.SQLiteDatabase) => Promise<void>)[] = [
  // v1 — esquema inicial
  async (db) => {
    await db.execAsync(`
      CREATE TABLE armas (
        id TEXT PRIMARY KEY NOT NULL,
        apelido TEXT,
        marca TEXT,
        modelo TEXT NOT NULL,
        numero_serie TEXT NOT NULL,
        acervo TEXT NOT NULL,
        grupo TEXT NOT NULL,
        calibre TEXT NOT NULL,
        especie TEXT,
        funcionamento TEXT,
        fabricante TEXT,
        pais_origem TEXT,
        ano_fabricacao TEXT,
        numero_cano TEXT,
        capacidade TEXT,
        registro_numero TEXT,
        local_guarda TEXT,
        observacoes TEXT,
        criado_em TEXT NOT NULL,
        atualizado_em TEXT NOT NULL
      );

      CREATE TABLE documentos (
        id TEXT PRIMARY KEY NOT NULL,
        tipo TEXT NOT NULL,
        arma_id TEXT REFERENCES armas(id) ON DELETE CASCADE,
        titulo TEXT,
        numero TEXT,
        orgao TEXT,
        data_emissao TEXT,
        data_validade TEXT NOT NULL,
        origem TEXT,
        destino TEXT,
        meio_transporte TEXT,
        observacoes TEXT,
        criado_em TEXT NOT NULL,
        atualizado_em TEXT NOT NULL
      );

      CREATE TABLE arquivos (
        id TEXT PRIMARY KEY NOT NULL,
        documento_id TEXT NOT NULL REFERENCES documentos(id) ON DELETE CASCADE,
        nome TEXT NOT NULL,
        uri TEXT NOT NULL,
        mime TEXT,
        tamanho INTEGER,
        criado_em TEXT NOT NULL
      );

      CREATE TABLE config (
        chave TEXT PRIMARY KEY NOT NULL,
        valor TEXT
      );

      CREATE INDEX idx_documentos_arma ON documentos (arma_id);
      CREATE INDEX idx_documentos_validade ON documentos (data_validade);
      CREATE INDEX idx_arquivos_documento ON arquivos (documento_id);
    `);
  },

  // v2 — caixa de avisos recebidos (histórico das notificações)
  async (db) => {
    await db.execAsync(`
      CREATE TABLE avisos (
        id TEXT PRIMARY KEY NOT NULL,
        titulo TEXT,
        subtitulo TEXT,
        corpo TEXT,
        recebido_em TEXT NOT NULL,
        lido INTEGER NOT NULL DEFAULT 0
      );

      CREATE INDEX idx_avisos_recebido ON avisos (recebido_em DESC);
    `);
  },

  // v3 — galeria de fotos da arma
  async (db) => {
    await db.execAsync(`
      CREATE TABLE fotos (
        id TEXT PRIMARY KEY NOT NULL,
        arma_id TEXT NOT NULL REFERENCES armas(id) ON DELETE CASCADE,
        uri TEXT NOT NULL,
        legenda TEXT,
        ordem INTEGER NOT NULL DEFAULT 0,
        criado_em TEXT NOT NULL
      );

      CREATE INDEX idx_fotos_arma ON fotos (arma_id, ordem);
    `);
  },

  // v4 — o meio de transporte saiu da guia de tráfego
  async (db) => {
    try {
      await db.execAsync('ALTER TABLE documentos DROP COLUMN meio_transporte;');
    } catch (e) {
      // DROP COLUMN exige SQLite 3.35+. Se o motor for mais antigo, a coluna
      // fica lá sem uso — o app já parou de ler e escrever nela, e ela é
      // anulável, então não atrapalha nada.
      console.warn('[CAC Brasil] não deu para remover meio_transporte', e);
    }
  },

  // v5 — habitualidade: locais de tiro e sessões registradas.
  //
  // Migração puramente aditiva: só cria tabelas novas. Nada é alterado nem
  // apagado, então quem atualiza o app abre a versão nova com todo o acervo,
  // os documentos e os anexos no lugar.
  async (db) => {
    await db.execAsync(`
      CREATE TABLE locais_tiro (
        id TEXT PRIMARY KEY NOT NULL,
        nome TEXT NOT NULL,
        cidade TEXT,
        uf TEXT,
        cr TEXT,
        observacoes TEXT,
        criado_em TEXT NOT NULL
      );

      CREATE TABLE habitualidades (
        id TEXT PRIMARY KEY NOT NULL,
        data TEXT NOT NULL,
        tipo TEXT NOT NULL,
        local_id TEXT REFERENCES locais_tiro(id) ON DELETE SET NULL,
        local_nome TEXT,
        observacoes TEXT,
        criado_em TEXT NOT NULL,
        atualizado_em TEXT NOT NULL
      );

      -- arma_id vira NULL (e não some) quando a arma sai do acervo: a sessão
      -- aconteceu, e o grupo gravado aqui continua valendo para a contagem.
      CREATE TABLE habitualidade_armas (
        id TEXT PRIMARY KEY NOT NULL,
        habitualidade_id TEXT NOT NULL REFERENCES habitualidades(id) ON DELETE CASCADE,
        arma_id TEXT REFERENCES armas(id) ON DELETE SET NULL,
        grupo TEXT NOT NULL,
        arma_nome TEXT NOT NULL
      );

      CREATE INDEX idx_habitualidades_data ON habitualidades (data DESC);
      CREATE INDEX idx_hab_armas_sessao ON habitualidade_armas (habitualidade_id);
      CREATE UNIQUE INDEX idx_hab_armas_par
        ON habitualidade_armas (habitualidade_id, arma_id);
    `);
  },

  // v6 — origem da habitualidade e id externo (importação Shooting House).
  //
  // Aditiva: colunas opcionais. `origem` nasce 'MANUAL' para tudo que já existe;
  // `externo_id` fica NULL (o índice único ignora NULLs no SQLite, então várias
  // sessões manuais convivem). É isso que impede duplicar o que vem da SH.
  async (db) => {
    await db.execAsync(`
      ALTER TABLE habitualidades ADD COLUMN origem TEXT NOT NULL DEFAULT 'MANUAL';
      ALTER TABLE habitualidades ADD COLUMN externo_id TEXT;
      CREATE UNIQUE INDEX idx_hab_externo ON habitualidades (externo_id);
    `);
  },

  // v7 — tombstones de exclusão, para a sincronização na nuvem propagar
  // remoções (um registro apagado aqui precisa sumir nos outros aparelhos).
  async (db) => {
    await db.execAsync(`
      CREATE TABLE exclusoes (
        tipo TEXT NOT NULL,
        registro_id TEXT NOT NULL,
        excluido_em TEXT NOT NULL,
        PRIMARY KEY (tipo, registro_id)
      );
    `);
  },
];

async function migrar(db: SQLite.SQLiteDatabase) {
  const linha = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let versao = linha?.user_version ?? 0;
  while (versao < VERSAO_ALVO) {
    await MIGRACOES[versao](db);
    versao += 1;
    await db.execAsync(`PRAGMA user_version = ${versao}`);
  }
}

export async function abrirBanco(): Promise<SQLite.SQLiteDatabase> {
  if (instancia) return instancia;
  if (abrindo) return abrindo;

  abrindo = (async () => {
    try {
      const db = await SQLite.openDatabaseAsync(NOME_BANCO);

      // Essencial: é o que faz apagar uma arma levar junto seus documentos e
      // anexos. Sem isso o banco acumula órfãos.
      await db.execAsync('PRAGMA foreign_keys = ON;');

      // WAL exige memória compartilhada (xShmMap), que o VFS da web
      // (OPFS AccessHandlePoolVFS) não implementa. Pedir WAL lá derruba a
      // abertura inteira do banco, então no navegador fica o journal padrão.
      if (Platform.OS !== 'web') {
        try {
          await db.execAsync('PRAGMA journal_mode = WAL;');
        } catch (e) {
          console.warn('[CAC Brasil] WAL indisponível, seguindo no modo padrão', e);
        }
      }

      await migrar(db);
      instancia = db;
      return db;
    } catch (e) {
      // Sem isso a promise rejeitada fica em cache e toda chamada seguinte
      // falha para sempre, mesmo que a causa já tenha passado.
      abrindo = null;
      throw e;
    }
  })();

  return abrindo;
}

export function novoId(): string {
  const aleatorio = Math.random().toString(36).slice(2, 10);
  return `${Date.now().toString(36)}-${aleatorio}`;
}

/** Converte '' em null para não poluir o banco com strings vazias. */
export function limpo(v: string | null | undefined): string | null {
  const t = (v ?? '').trim();
  return t.length ? t : null;
}
