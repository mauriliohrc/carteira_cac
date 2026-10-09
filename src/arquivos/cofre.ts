/**
 * "Cofre" de arquivos: os PDFs/imagens anexados ficam dentro da sandbox do app
 * (Paths.document/acervo/<documentoId>/), não em pasta pública. Assim o arquivo
 * sobrevive a limpezas de cache e sai junto no backup do dispositivo.
 */
import { Directory, File, Paths } from 'expo-file-system';
import { getContentUriAsync } from 'expo-file-system/legacy';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as Sharing from 'expo-sharing';
import * as IntentLauncher from 'expo-intent-launcher';
import { Linking, Platform } from 'react-native';

import { novoId } from '@/db';
import { registrarArquivo, removerRegistroArquivo } from '@/db/arquivos';
import { registrarFoto, removerRegistroFoto, type Foto } from '@/db/fotos';
import type { Arquivo } from '@/domain/tipos';
import { avisar, escolher } from '@/ui/dialogo';

const RAIZ = 'acervo';
const RAIZ_FOTOS = 'fotos';

function pastaDoDocumento(documentoId: string): Directory {
  return new Directory(Paths.document, RAIZ, documentoId);
}

function pastaDasFotos(armaId: string): Directory {
  return new Directory(Paths.document, RAIZ_FOTOS, armaId);
}

function garantirPasta(dir: Directory): Directory {
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

/** Remove caracteres que quebram nomes de arquivo em iOS/Android. */
function nomeSeguro(nome: string): string {
  const limpo = nome.replace(/[^\w.\-() ]+/g, '_').slice(-80);
  return limpo.length ? limpo : 'documento';
}

export interface ArquivoEscolhido {
  uri: string;
  nome: string;
  mime: string | null;
  tamanho: number | null;
}

/** Copia o arquivo escolhido para o cofre e registra no banco. */
/** Copia o arquivo escolhido para dentro da pasta indicada do cofre. */
async function copiarParaCofre(dir: Directory, escolhido: ArquivoEscolhido): Promise<File> {
  garantirPasta(dir);
  const origem = new File(escolhido.uri);
  const destino = new File(dir, `${novoId()}-${nomeSeguro(escolhido.nome)}`);
  await origem.copy(destino);
  return destino;
}

export async function guardarArquivo(
  documentoId: string,
  escolhido: ArquivoEscolhido
): Promise<Arquivo> {
  const destino = await copiarParaCofre(pastaDoDocumento(documentoId), escolhido);

  return registrarArquivo({
    documentoId,
    nome: escolhido.nome,
    uri: destino.uri,
    mime: escolhido.mime ?? destino.type ?? null,
    tamanho: escolhido.tamanho ?? (destino.exists ? destino.size : null),
  });
}

/** Guarda uma foto do armamento na galeria da arma. */
export async function guardarFoto(
  armaId: string,
  escolhida: ArquivoEscolhido
): Promise<Foto> {
  const destino = await copiarParaCofre(pastaDasFotos(armaId), escolhida);
  return registrarFoto({ armaId, uri: destino.uri });
}

export async function apagarFoto(foto: Foto): Promise<void> {
  try {
    const f = new File(foto.uri);
    if (f.exists) f.delete();
  } catch {
    // já sumiu do disco — limpa o registro do mesmo jeito
  }
  await removerRegistroFoto(foto.id);
}

export async function apagarPastaDeFotos(armaId: string): Promise<void> {
  try {
    const dir = pastaDasFotos(armaId);
    if (dir.exists) dir.delete();
  } catch {
    // nada a fazer
  }
}

export async function apagarArquivo(arquivo: Arquivo): Promise<void> {
  try {
    const f = new File(arquivo.uri);
    if (f.exists) f.delete();
  } catch {
    // arquivo já sumiu do disco — segue e limpa o registro mesmo assim
  }
  await removerRegistroArquivo(arquivo.id);
}

export async function apagarPastaDoDocumento(documentoId: string): Promise<void> {
  try {
    const dir = pastaDoDocumento(documentoId);
    if (dir.exists) dir.delete();
  } catch {
    // nada a fazer
  }
}

export function arquivoExiste(uri: string): boolean {
  try {
    return new File(uri).exists;
  } catch {
    return false;
  }
}

export function ehPdf(arquivo: { mime: string | null; nome: string }): boolean {
  if (arquivo.mime?.includes('pdf')) return true;
  return arquivo.nome.toLowerCase().endsWith('.pdf');
}

export function ehImagem(arquivo: { mime: string | null; nome: string }): boolean {
  if (arquivo.mime?.startsWith('image/')) return true;
  return /\.(jpe?g|png|heic|webp|gif)$/i.test(arquivo.nome);
}

export function tamanhoLegivel(bytes: number | null): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ---------------------------------------------------------------- seletores

export async function escolherPdfOuImagem(): Promise<ArquivoEscolhido | null> {
  try {
    const r = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/*'],
      copyToCacheDirectory: true,
      multiple: false,
    });
    if (r.canceled || !r.assets?.length) return null;
    const a = r.assets[0];
    return {
      uri: a.uri,
      nome: a.name ?? 'documento.pdf',
      mime: a.mimeType ?? null,
      tamanho: a.size ?? null,
    };
  } catch (e) {
    avisar('Não foi possível abrir os arquivos', e instanceof Error ? e.message : String(e));
    return null;
  }
}

/**
 * Pergunta a origem (Arquivos ou Galeria) e devolve o arquivo escolhido.
 * Cancelar a folha → null (segue sem anexar).
 */
export function escolherDocumento(): Promise<ArquivoEscolhido | null> {
  return new Promise((resolve) => {
    void escolher('Anexar documento', 'De onde você quer escolher?', [
      {
        rotulo: 'Arquivos',
        icone: 'folder-outline',
        acao: async () => resolve(await escolherPdfOuImagem()),
      },
      {
        rotulo: 'Galeria',
        icone: 'images-outline',
        acao: async () => resolve(await escolherDaGaleria()),
      },
    ]).then(() => resolve(null)); // cancelou a folha → sem anexo
  });
}

export async function escolherDaGaleria(): Promise<ArquivoEscolhido | null> {
  // Usa o seletor de fotos do sistema (Android Photo Picker / UIImagePicker).
  // Ele NÃO exige permissão de galeria (READ_MEDIA_IMAGES) — o usuário escolhe
  // a foto no seletor do próprio sistema, conforme a política do Google Play.
  try {
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
    });
    if (r.canceled || !r.assets?.length) return null;
    const a = r.assets[0];
    return {
      uri: a.uri,
      nome: a.fileName ?? `foto-${Date.now()}.jpg`,
      mime: a.mimeType ?? 'image/jpeg',
      tamanho: a.fileSize ?? null,
    };
  } catch (e) {
    avisar('Não foi possível abrir as fotos', e instanceof Error ? e.message : String(e));
    return null;
  }
}

export async function fotografar(): Promise<ArquivoEscolhido | null> {
  const permissao = await ImagePicker.requestCameraPermissionsAsync();
  if (!permissao.granted) {
    avisar(
      'Acesso à câmera',
      'Libere o acesso à câmera nos ajustes do celular para fotografar documentos.'
    );
    return null;
  }
  const r = await ImagePicker.launchCameraAsync({ quality: 0.85 });
  if (r.canceled || !r.assets?.length) return null;
  const a = r.assets[0];
  return {
    uri: a.uri,
    nome: a.fileName ?? `documento-${Date.now()}.jpg`,
    mime: a.mimeType ?? 'image/jpeg',
    tamanho: a.fileSize ?? null,
  };
}

// ------------------------------------------------------- abrir/compartilhar

/** Abre o arquivo no visualizador nativo do sistema (útil para PDF no Android). */
export async function abrirNoSistema(arquivo: Arquivo): Promise<void> {
  if (Platform.OS === 'android') {
    try {
      // O Android recusa file:// vindo de outro app — é preciso um content://
      // servido pelo FileProvider, que é o que getContentUriAsync devolve.
      const contentUri = await getContentUriAsync(arquivo.uri);
      await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
        data: contentUri,
        flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
        type: arquivo.mime ?? 'application/pdf',
      });
      return;
    } catch {
      // sem visualizador de PDF instalado: cai no compartilhamento
    }
  }
  await compartilhar(arquivo);
}

export async function compartilhar(arquivo: Arquivo): Promise<void> {
  try {
    if (!arquivoExiste(arquivo.uri)) {
      avisar('Arquivo indisponível', 'O anexo não está mais no aparelho. Anexe novamente.');
      return;
    }
    if (!(await Sharing.isAvailableAsync())) {
      await Linking.openURL(arquivo.uri).catch(() => {
        avisar('Não foi possível abrir', 'Nenhum app disponível para este arquivo.');
      });
      return;
    }
    await Sharing.shareAsync(arquivo.uri, {
      mimeType: arquivo.mime ?? undefined,
      dialogTitle: arquivo.nome,
      UTI: ehPdf(arquivo) ? 'com.adobe.pdf' : undefined,
    });
  } catch (e) {
    avisar('Não foi possível compartilhar', e instanceof Error ? e.message : String(e));
  }
}
