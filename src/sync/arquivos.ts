import * as FS from 'expo-file-system/legacy';

import { apiApp } from '@/conta/api';
import { abrirBanco } from '@/db';
import { relativoAnexo } from '@/arquivos/caminho';

/** Extensão a partir do mime, para quando o nome original não tiver uma. */
function extDoMime(mime: string | null): string {
  if (!mime) return '';
  if (mime.includes('pdf')) return '.pdf';
  if (mime === 'image/jpeg' || mime === 'image/jpg') return '.jpg';
  if (mime === 'image/png') return '.png';
  if (mime === 'image/heic') return '.heic';
  if (mime === 'image/webp') return '.webp';
  return '';
}

interface ArquivoLocal {
  id: string;
  uri: string;
  mime: string | null;
  pasta: string; // subpasta no cofre (acervo/<docId> ou fotos/<armaId>)
}

/** Lê os arquivos e fotos locais com o caminho de destino no cofre. */
async function listarLocais(): Promise<ArquivoLocal[]> {
  const db = await abrirBanco();
  const arquivos = await db.getAllAsync<{ id: string; uri: string; mime: string | null; documento_id: string }>(
    'SELECT id, uri, mime, documento_id FROM arquivos'
  );
  const fotos = await db.getAllAsync<{ id: string; uri: string; arma_id: string }>(
    'SELECT id, uri, arma_id FROM fotos'
  );
  return [
    ...arquivos.map((a) => ({ id: a.id, uri: a.uri, mime: a.mime, pasta: `acervo/${a.documento_id}` })),
    ...fotos.map((f) => ({ id: f.id, uri: f.uri, mime: 'image/jpeg', pasta: `fotos/${f.arma_id}` })),
  ];
}

function existe(uri: string): Promise<boolean> {
  return FS.getInfoAsync(uri).then((i) => i.exists).catch(() => false);
}

/**
 * Reconcilia os blobs com a nuvem:
 *  - sobe os arquivos locais que ainda não estão no servidor;
 *  - baixa os que o metadado referencia mas não existem neste aparelho,
 *    gravando no cofre e corrigindo a uri local.
 */
export async function sincronizarArquivos(token: string): Promise<void> {
  const locais = await listarLocais();

  // Quais blobs o servidor já tem.
  const resp = await apiApp<{ arquivos: { registroId: string }[] }>('/sync/arquivos', { token });
  const noServidor = new Set(resp.arquivos.map((a) => a.registroId));

  // UPLOAD: arquivos locais (com bytes no disco) ausentes no servidor.
  for (const a of locais) {
    if (noServidor.has(a.id)) continue;
    if (!(await existe(a.uri))) continue;
    try {
      const base64 = await FS.readAsStringAsync(a.uri, { encoding: FS.EncodingType.Base64 });
      await apiApp('/sync/arquivo', {
        metodo: 'POST',
        corpo: { registroId: a.id, mime: a.mime, base64 },
        token,
      });
    } catch {
      /* segue para o próximo */
    }
  }

  // DOWNLOAD: metadados locais cujo arquivo não existe no disco e estão no servidor.
  const db = await abrirBanco();
  for (const a of locais) {
    // Re-baixa também os que já estão no disco mas SEM extensão (baixados por
    // versões antigas) — eram justamente os que abriam como "texto".
    const temExtensao = /\.[a-z0-9]{2,5}$/i.test(a.uri.split('/').pop() ?? '');
    if ((await existe(a.uri)) && temExtensao) continue;
    if (!noServidor.has(a.id)) continue;
    try {
      const r = await apiApp<{ base64: string; mime: string | null }>(`/sync/arquivo/${a.id}`, {
        token,
      });
      // Preserva o NOME e a EXTENSÃO do arquivo original (vêm no metadado). Sem
      // a extensão, PDFs/imagens baixados abrem como "texto" (caracteres
      // estranhos) no visualizador do sistema no Android e na WebView no iOS.
      // Mantém o mesmo sufixo `acervo|fotos/...` que resolverAnexo usa para
      // reencontrar o arquivo, então vale nos dois sentidos de sincronização.
      const rel = relativoAnexo(a.uri);
      const nomeArq = /^(?:acervo|fotos)\//.test(rel)
        ? (rel.split('/').pop() as string)
        : `${a.id}${extDoMime(a.mime ?? r.mime)}`;
      const dir = `${FS.documentDirectory}${a.pasta}`;
      await FS.makeDirectoryAsync(dir, { intermediates: true }).catch(() => {});
      const destino = `${dir}/${nomeArq}`;
      await FS.writeAsStringAsync(destino, r.base64, { encoding: FS.EncodingType.Base64 });
      // Corrige a uri local para apontar ao arquivo recém-baixado.
      const tabela = a.pasta.startsWith('fotos/') ? 'fotos' : 'arquivos';
      await db.runAsync(`UPDATE ${tabela} SET uri = ? WHERE id = ?`, destino, a.id);
    } catch {
      /* tenta de novo na próxima sincronização */
    }
  }
}
