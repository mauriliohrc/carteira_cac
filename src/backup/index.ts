/**
 * Exportação e restauração do backup — a camada que fala com o disco, o banco
 * e a folha de compartilhamento. A criptografia mora em ./formato (puro).
 *
 * O backup carrega TODO o acervo num só arquivo: as linhas de cada tabela do
 * SQLite e o conteúdo de cada anexo/foto. O usuário salva esse arquivo onde
 * quiser — iCloud Drive, Google Drive, e-mail — pela folha nativa. Restaurar é
 * o caminho inverso: escolher o arquivo, digitar a senha e repor tudo.
 */
import * as FS from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import * as Crypto from 'expo-crypto';

import { abrirBanco } from '@/db';
import { CHAVES, gravarConfig, lerConfig } from '@/db/config';
import { agoraISO } from '@/lib/data';
import {
  ArquivoInvalido,
  empacotar,
  desempacotar,
  pareceEnvelope,
  type Envelope,
  type PlanoBackup,
} from './formato';

export { SenhaIncorreta, ArquivoInvalido } from './formato';

/** user_version alvo do banco — precisa acompanhar VERSAO_ALVO em db/index.ts. */
const ESQUEMA_ATUAL = 5;

/**
 * Ordem segura para inserir respeitando as chaves estrangeiras — a restauração
 * apaga na ordem inversa. `habitualidade_armas` aponta para `armas` e para
 * `habitualidades`, então vem depois das duas.
 */
const TABELAS: readonly string[] = [
  'armas',
  'documentos',
  'arquivos',
  'fotos',
  'avisos',
  'config',
  'locais_tiro',
  'habitualidades',
  'habitualidade_armas',
];

/** O Premium é direito da loja, não do arquivo: não viaja no backup. */
const CONFIG_IGNORADA = new Set<string>([CHAVES.premium]);

export interface ResumoBackup {
  armas: number;
  documentos: number;
  arquivos: number;
  habitualidades: number;
}

/**
 * Chave estável de um anexo, independente do aparelho.
 *
 * A `uri` gravada no banco é absoluta e contém o identificador do container do
 * app — que muda a cada instalação. O que é estável é o trecho a partir de
 * `acervo/` ou `fotos/`; é por ele que casamos o arquivo na restauração.
 */
function chaveRelativa(uri: string): string {
  const m = uri.match(/(?:acervo|fotos)\/.+$/);
  if (m) return m[0];
  const nome = uri.split('/').pop() || 'arquivo';
  return `acervo/orfaos/${nome}`;
}

/** Nomes de coluna só podem vir do nosso próprio esquema — barra injeção. */
function colunaSegura(nome: string): boolean {
  return /^[a-z_][a-z0-9_]*$/i.test(nome);
}

// --------------------------------------------------------------- exportar

/**
 * Gera o arquivo `.cacbackup` cifrado no cache e devolve seu caminho.
 *
 * É a parte pesada e bloqueante (lê o banco, os anexos e cifra tudo com
 * crypto-js, que roda síncrono). A folha de compartilhamento fica em
 * {@link compartilharBackup}, chamada depois — assim a tela consegue baixar o
 * véu de progresso antes de abrir a folha nativa, sem conflito de apresentação.
 */
export async function gerarBackup(senha: string): Promise<string> {
  const db = await abrirBanco();

  const tabelas: Record<string, Record<string, unknown>[]> = {};
  for (const t of TABELAS) {
    const linhas = await db.getAllAsync<Record<string, unknown>>(`SELECT * FROM ${t}`);
    tabelas[t] = t === 'config'
      ? linhas.filter((l) => !CONFIG_IGNORADA.has(String(l.chave)))
      : linhas;
  }

  // Lê do disco cada anexo e cada foto, guardando pela chave relativa.
  const arquivos: Record<string, string> = {};
  const comArquivo = [...(tabelas.arquivos ?? []), ...(tabelas.fotos ?? [])];
  for (const linha of comArquivo) {
    const uri = String(linha.uri ?? '');
    if (!uri) continue;
    try {
      const info = await FS.getInfoAsync(uri);
      if (!info.exists) continue;
      arquivos[chaveRelativa(uri)] = await FS.readAsStringAsync(uri, {
        encoding: FS.EncodingType.Base64,
      });
    } catch {
      // Arquivo sumiu do disco: o registro segue no backup, sem o binário.
    }
  }

  const plano: PlanoBackup = {
    assinatura: 'CAC-BRASIL-BACKUP',
    geradoEm: agoraISO(),
    esquema: ESQUEMA_ATUAL,
    versaoApp: '1.0.0',
    tabelas,
    arquivos,
  };

  const salt = Crypto.getRandomBytes(16);
  const iv = Crypto.getRandomBytes(16);
  const envelope = empacotar(plano, senha, salt, iv);

  const nome = `cac-brasil-${agoraISO().slice(0, 10)}.cacbackup`;
  const destino = `${FS.cacheDirectory}${nome}`;
  await FS.writeAsStringAsync(destino, JSON.stringify(envelope), {
    encoding: FS.EncodingType.UTF8,
  });
  return destino;
}

/** Abre a folha nativa para o usuário salvar o arquivo gerado onde quiser. */
export async function compartilharBackup(caminho: string): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Compartilhamento indisponível neste aparelho.');
  }
  await Sharing.shareAsync(caminho, {
    mimeType: 'application/octet-stream',
    dialogTitle: 'Salvar backup da Carteira CAC',
    UTI: 'public.data',
  });
}

// -------------------------------------------------------------- restaurar

/** Abre o seletor, lê o arquivo e confirma que é um envelope nosso. */
export async function escolherBackup(): Promise<Envelope | null> {
  const r = await DocumentPicker.getDocumentAsync({
    type: '*/*',
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (r.canceled || !r.assets?.length) return null;

  const texto = await FS.readAsStringAsync(r.assets[0].uri, { encoding: FS.EncodingType.UTF8 });
  let envelope: unknown;
  try {
    envelope = JSON.parse(texto);
  } catch {
    throw new ArquivoInvalido();
  }
  if (!pareceEnvelope(envelope)) throw new ArquivoInvalido();
  return envelope;
}

/**
 * Substitui todo o acervo atual pelo conteúdo do backup.
 *
 * Reescreve as `uri` de anexos e fotos para os caminhos deste aparelho, grava
 * os binários e repõe as linhas do banco numa transação. Preserva o Premium
 * local, que não vem no arquivo.
 */
export async function restaurarBackup(envelope: Envelope, senha: string): Promise<ResumoBackup> {
  const plano = desempacotar(envelope, senha); // lança SenhaIncorreta

  // Backup gerado por uma versão mais nova do app: tem tabelas que este banco
  // ainda não conhece. Sem esta barreira o INSERT falha no meio e o usuário vê
  // um "no such table" — melhor dizer o que fazer.
  if (plano.esquema > ESQUEMA_ATUAL) {
    throw new Error(
      'Este backup foi gerado por uma versão mais nova da Carteira CAC. Atualize o app e tente de novo.'
    );
  }

  const db = await abrirBanco();
  const premiumLocal = await lerConfig(CHAVES.premium);

  // 1. Materializa os arquivos no disco deste aparelho.
  const novaUri = new Map<string, string>();
  for (const [rel, base64] of Object.entries(plano.arquivos)) {
    const destino = `${FS.documentDirectory}${rel}`;
    const pasta = destino.slice(0, destino.lastIndexOf('/'));
    await FS.makeDirectoryAsync(pasta, { intermediates: true }).catch(() => {});
    await FS.writeAsStringAsync(destino, base64, { encoding: FS.EncodingType.Base64 });
    novaUri.set(rel, destino);
  }

  // 2. Aponta cada linha com anexo para o novo caminho local.
  const reapontar = (linhas: Record<string, unknown>[] = []) =>
    linhas.map((l) => {
      const destino = novaUri.get(chaveRelativa(String(l.uri ?? '')));
      return destino ? { ...l, uri: destino } : l;
    });
  const tabelas: Record<string, Record<string, unknown>[]> = { ...plano.tabelas };
  tabelas.arquivos = reapontar(tabelas.arquivos);
  tabelas.fotos = reapontar(tabelas.fotos);

  // 3. Troca os dados do banco de uma vez só.
  await db.withTransactionAsync(async () => {
    for (const t of [...TABELAS].reverse()) {
      await db.runAsync(`DELETE FROM ${t}`);
    }
    for (const t of TABELAS) {
      for (const linha of tabelas[t] ?? []) {
        await inserirLinha(db, t, linha);
      }
    }
  });

  // O Premium é do aparelho/loja: repõe o que havia antes da troca.
  if (premiumLocal != null) await gravarConfig(CHAVES.premium, premiumLocal);

  return {
    armas: (tabelas.armas ?? []).length,
    documentos: (tabelas.documentos ?? []).length,
    arquivos: novaUri.size,
    habitualidades: (tabelas.habitualidades ?? []).length,
  };
}

async function inserirLinha(
  db: Awaited<ReturnType<typeof abrirBanco>>,
  tabela: string,
  linha: Record<string, unknown>
): Promise<void> {
  const colunas = Object.keys(linha).filter(colunaSegura);
  if (!colunas.length) return;
  const marcas = colunas.map(() => '?').join(',');
  const valores = colunas.map((k) => {
    const v = linha[k];
    // SQLite aceita string/number/null/Uint8Array; o resto (objeto) não deveria
    // existir num backup nosso, mas por segurança vira null.
    return v === undefined || (typeof v === 'object' && v !== null) ? null : (v as never);
  });
  await db.runAsync(
    `INSERT INTO ${tabela} (${colunas.join(',')}) VALUES (${marcas})`,
    ...valores
  );
}
