import { apiApp } from '@/conta/api';
import { lerToken } from '@/conta/armazenamento';
import { criarDocumento, listarDocumentos } from '@/db/documentos';
import { CHAVES, gravarConfig, lerConfig } from '@/db/config';
import type { DataISO } from '@/lib/data';
import type { TipoDocumento } from '@/domain/tipos';

interface DocumentoSH {
  tipo: string;
  numero: string | null;
  dataValidade: string;
  externoKey: string;
}

async function buscarDocumentosSH(): Promise<{ status: string; documentos: DocumentoSH[] }> {
  const token = await lerToken();
  if (!token) return { status: 'SEM_CONTA', documentos: [] };
  try {
    return await apiApp<{ status: string; documentos: DocumentoSH[] }>(
      '/documentos/shooting-house',
      { token }
    );
  } catch {
    return { status: 'ERRO', documentos: [] };
  }
}

/**
 * Importa automaticamente os documentos do sócio na Shooting House (hoje o CR).
 * Não duplica:
 *  - pula o CR se o usuário já tiver um documento de CR cadastrado;
 *  - guarda as chaves já importadas para não ressuscitar um documento apagado.
 */
export async function importarDocumentosAuto(): Promise<number> {
  const r = await buscarDocumentosSH();
  if (r.status !== 'OK' || r.documentos.length === 0) return 0;

  const acervo = await listarDocumentos();
  const temTipo = (t: string) => acervo.some((d) => d.tipo === t);

  let jaVistas: string[] = [];
  try {
    jaVistas = JSON.parse((await lerConfig(CHAVES.docsImportadosSH)) ?? '[]');
  } catch {
    jaVistas = [];
  }
  const vistas = new Set(jaVistas);

  let importados = 0;
  for (const d of r.documentos) {
    if (vistas.has(d.externoKey)) continue;
    // CR é único por pessoa: se já existe um, não duplica.
    if (d.tipo === 'CR' && temTipo('CR')) {
      vistas.add(d.externoKey);
      continue;
    }
    await criarDocumento({
      tipo: d.tipo as TipoDocumento,
      armaId: null,
      titulo: null,
      numero: d.numero,
      orgao: 'EXERCITO',
      dataEmissao: null,
      dataValidade: d.dataValidade as DataISO,
      origem: null,
      destino: null,
      observacoes: null,
    });
    vistas.add(d.externoKey);
    importados += 1;
  }

  if (importados > 0 || vistas.size !== jaVistas.length) {
    await gravarConfig(CHAVES.docsImportadosSH, JSON.stringify([...vistas]));
  }
  return importados;
}
