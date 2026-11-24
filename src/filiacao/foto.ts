import * as FS from 'expo-file-system/legacy';

import { lerConfig, gravarConfig, CHAVES } from '@/db/config';
import { relativoAnexo, resolverAnexo } from '@/arquivos/caminho';
import { escolherDaGaleria, fotografar } from '@/arquivos/cofre';
import { escolher } from '@/ui/dialogo';

/**
 * Foto do usuário para a carteira de filiado. Fica SÓ no aparelho (não sobe no
 * sync) — é um retrato pessoal, usado apenas na exibição da carteirinha. É
 * copiada para a pasta estável `fotos/carteirinha/` (sobrevive a updates, igual
 * às fotos de arma) e o caminho relativo é guardado em config.
 */
const PASTA = `${FS.documentDirectory ?? ''}fotos/carteirinha/`;

/** Caminho absoluto atual da foto, ou null se não houver. */
export async function obterFotoCarteirinha(): Promise<string | null> {
  const rel = await lerConfig(CHAVES.carteirinhaFoto);
  if (!rel) return null;
  const abs = resolverAnexo(rel);
  try {
    const info = await FS.getInfoAsync(abs);
    return info.exists ? abs : null;
  } catch {
    return null;
  }
}

/** Copia a imagem escolhida para a pasta estável e guarda o caminho. */
async function guardar(uriOrigem: string): Promise<string> {
  await FS.makeDirectoryAsync(PASTA, { intermediates: true }).catch(() => {});
  const destino = `${PASTA}foto-${Date.now()}.jpg`;
  await FS.copyAsync({ from: uriOrigem, to: destino });
  await gravarConfig(CHAVES.carteirinhaFoto, relativoAnexo(destino));
  return destino;
}

/** Abre a folha (câmera/galeria), guarda e devolve o caminho absoluto novo. */
export async function definirFotoCarteirinha(): Promise<string | null> {
  return new Promise((resolve) => {
    escolher('Foto da carteira', 'De onde vem a sua foto?', [
      {
        rotulo: 'Tirar foto agora',
        icone: 'camera-outline',
        acao: async () => {
          const a = await fotografar();
          resolve(a ? await guardar(a.uri) : null);
        },
      },
      {
        rotulo: 'Escolher da galeria',
        icone: 'images-outline',
        acao: async () => {
          const a = await escolherDaGaleria();
          resolve(a ? await guardar(a.uri) : null);
        },
      },
    ]).then(() => resolve(null));
  });
}

/** Remove a foto da carteirinha (volta ao placeholder). */
export async function removerFotoCarteirinha(): Promise<void> {
  const rel = await lerConfig(CHAVES.carteirinhaFoto);
  if (rel) {
    try {
      await FS.deleteAsync(resolverAnexo(rel), { idempotent: true });
    } catch {
      /* arquivo pode já não existir */
    }
  }
  await gravarConfig(CHAVES.carteirinhaFoto, null);
}
