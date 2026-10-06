/**
 * Caminhos de anexo à prova de atualização.
 *
 * O iOS guarda os arquivos do app dentro de um container cujo identificador
 * (UUID) MUDA a cada instalação/atualização. Por isso guardar o caminho
 * absoluto no banco perde o arquivo depois de atualizar o app — o caminho
 * velho não existe mais, mesmo com o arquivo ainda no aparelho.
 *
 * O que é estável é o trecho a partir de `acervo/` ou `fotos/` (a estrutura do
 * cofre). Guardamos/lemos por ele e reconstruímos o caminho absoluto ATUAL na
 * hora de usar.
 */
import { Paths } from 'expo-file-system';

/** Trecho estável (relativo ao Documents) de um caminho de anexo. */
export function relativoAnexo(caminho: string): string {
  const m = caminho.match(/(?:acervo|fotos)\/.+$/);
  return m ? m[0] : caminho;
}

/**
 * Recebe o valor guardado (absoluto de outra instalação OU relativo) e devolve
 * o caminho absoluto válido NESTE aparelho agora. Se não reconhecer o formato
 * (ex.: uri de blob na web), devolve como está.
 */
export function resolverAnexo(guardado: string): string {
  if (!guardado) return guardado;
  const m = guardado.match(/(?:acervo|fotos)\/.+$/);
  if (!m) return guardado;
  try {
    let base = Paths.document.uri;
    if (!base) return guardado;
    if (!base.endsWith('/')) base += '/';
    return base + m[0];
  } catch {
    return guardado;
  }
}
