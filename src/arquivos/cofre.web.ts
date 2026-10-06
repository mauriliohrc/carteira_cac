/**
 * Variante web do cofre de arquivos.
 *
 * O `expo-file-system` não tem implementação web, então não existe a pasta
 * privada do app para onde copiar o anexo. Na prévia web o arquivo escolhido
 * é convertido em data URL e guardado na própria linha do banco — assim ele
 * sobrevive ao recarregar a página e é renderizado direto por <img>/<iframe>,
 * sem depender de blob URL de sessão.
 *
 * Mesma superfície pública de ./cofre.ts.
 */
import * as DocumentPicker from 'expo-document-picker';

import { registrarArquivo, removerRegistroArquivo } from '@/db/arquivos';
import { registrarFoto, removerRegistroFoto, type Foto } from '@/db/fotos';
import { avisar } from '@/ui/dialogo';
import type { Arquivo } from '@/domain/tipos';

/** Acima disso o data URL incha demais o banco do navegador. */
const LIMITE_BYTES = 6 * 1024 * 1024;

export interface ArquivoEscolhido {
  uri: string;
  nome: string;
  mime: string | null;
  tamanho: number | null;
}

async function paraDataUrl(uri: string): Promise<string> {
  if (uri.startsWith('data:')) return uri;
  const resposta = await fetch(uri);
  const blob = await resposta.blob();
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(String(leitor.result));
    leitor.onerror = () => reject(leitor.error);
    leitor.readAsDataURL(blob);
  });
}

export async function guardarArquivo(
  documentoId: string,
  escolhido: ArquivoEscolhido
): Promise<Arquivo> {
  if (escolhido.tamanho && escolhido.tamanho > LIMITE_BYTES) {
    throw new Error(
      `Na prévia web o anexo precisa ter menos de ${Math.round(LIMITE_BYTES / 1024 / 1024)} MB. No app iOS não há esse limite.`
    );
  }

  const dataUrl = await paraDataUrl(escolhido.uri);
  return registrarArquivo({
    documentoId,
    nome: escolhido.nome,
    uri: dataUrl,
    mime: escolhido.mime,
    tamanho: escolhido.tamanho,
  });
}

export async function guardarFoto(armaId: string, escolhida: ArquivoEscolhido): Promise<Foto> {
  if (escolhida.tamanho && escolhida.tamanho > LIMITE_BYTES) {
    throw new Error(
      `Na prévia web a foto precisa ter menos de ${Math.round(LIMITE_BYTES / 1024 / 1024)} MB. No app iOS não há esse limite.`
    );
  }
  return registrarFoto({ armaId, uri: await paraDataUrl(escolhida.uri) });
}

export async function apagarFoto(foto: Foto): Promise<void> {
  await removerRegistroFoto(foto.id);
}

export async function apagarPastaDeFotos(armaId: string): Promise<void> {
  void armaId; // sem pasta no navegador: o cascade do banco resolve
}

export async function apagarArquivo(arquivo: Arquivo): Promise<void> {
  await removerRegistroArquivo(arquivo.id);
}

export async function apagarPastaDoDocumento(documentoId: string): Promise<void> {
  void documentoId; // sem pasta no navegador: o cascade do banco resolve
}

export function arquivoExiste(uri: string): boolean {
  return /^(data:|blob:|https?:)/.test(uri);
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

export async function escolherPdfOuImagem(): Promise<ArquivoEscolhido | null> {
  const r = await DocumentPicker.getDocumentAsync({
    type: ['application/pdf', 'image/*'],
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
}

/** No navegador a galeria é o mesmo seletor de arquivos. */
export const escolherDaGaleria = escolherPdfOuImagem;

export async function fotografar(): Promise<ArquivoEscolhido | null> {
  avisar(
    'Só no app',
    'Fotografar documento usa a câmera do celular. Na prévia web, escolha um arquivo.'
  );
  return null;
}

export async function abrirNoSistema(arquivo: Arquivo): Promise<void> {
  if (typeof window !== 'undefined') window.open(arquivo.uri, '_blank');
}

export const compartilhar = abrirNoSistema;
