import { apiApp } from '@/conta/api';
import { lerToken } from '@/conta/armazenamento';
import { CHAVES, gravarConfig, lerConfig } from '@/db/config';
import {
  aplicarRegistro,
  coletarExclusoes,
  coletarRegistros,
  limparExclusoes,
  type RegistroSync,
} from '@/db/sync';
import { sincronizarArquivos } from './arquivos';
import { importarArmasAuto } from '@/parceiro/armas';
import { importarDocumentosAuto } from '@/parceiro/documentos';

let rodando = false;

function emLotes<T>(itens: T[], n: number): T[][] {
  const r: T[][] = [];
  for (let i = 0; i < itens.length; i += n) r.push(itens.slice(i, i + n));
  return r;
}

export interface ResultadoSync {
  ok: boolean;
  /** Quantos registros desceram da nuvem (para decidir recarregar a UI). */
  baixados: number;
}

/**
 * Sincroniza o acervo com a nuvem (offline-first, espelho por usuário):
 * sobe o estado local (LWW) + tombstones, baixa o delta e aplica, e reconcilia
 * os arquivos. Best-effort: se faltar rede/sessão, não faz nada e não quebra.
 */
export async function sincronizar(): Promise<ResultadoSync> {
  const token = await lerToken();
  if (!token || rodando) return { ok: false, baixados: 0 };
  rodando = true;
  try {
    // PUSH — estado local + exclusões pendentes
    const registros = [...(await coletarRegistros()), ...(await coletarExclusoes())];
    for (const lote of emLotes(registros, 150)) {
      await apiApp('/sync/push', { metodo: 'POST', corpo: { registros: lote }, token });
    }
    await limparExclusoes();

    // PULL — só o que mudou desde o último cursor do servidor
    const desde = await lerConfig(CHAVES.syncCursor);
    const q = desde ? `?desde=${encodeURIComponent(desde)}` : '';
    const resp = await apiApp<{ registros: RegistroSync[]; servidorAgora: string }>(
      `/sync/pull${q}`,
      { token }
    );
    for (const r of resp.registros) await aplicarRegistro(r);
    await gravarConfig(CHAVES.syncCursor, resp.servidorAgora);

    // Arquivos (PDFs/fotos): sobe os que faltam, baixa os ausentes.
    await sincronizarArquivos(token);

    // Importa automaticamente o acervo e os documentos da Shooting House (sem duplicar).
    const armasImportadas = await importarArmasAuto();
    const docsImportados = await importarDocumentosAuto();

    return { ok: true, baixados: resp.registros.length + armasImportadas + docsImportados };
  } catch {
    return { ok: false, baixados: 0 };
  } finally {
    rodando = false;
  }
}
