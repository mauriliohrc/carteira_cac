/**
 * Cliente da extração de PDF: lê o anexo em base64 e pede ao servidor os campos.
 * Só para PDF (o chamador garante). Best-effort — devolve {} em qualquer falha.
 */
import * as FS from 'expo-file-system/legacy';

import { apiApp } from '@/conta/api';
import { lerToken } from '@/conta/armazenamento';

export interface CamposExtraidos {
  numero?: string;
  dataValidade?: string;
  dataEmissao?: string;
  origem?: string;
  destino?: string;
  numeroSerie?: string;
  marca?: string;
  modelo?: string;
  calibre?: string;
  especie?: string;
  fabricante?: string;
  paisOrigem?: string;
  anoFabricacao?: string;
}

export async function extrairCamposDoPdf(uri: string, tipo?: string): Promise<CamposExtraidos> {
  try {
    const base64 = await FS.readAsStringAsync(uri, { encoding: FS.EncodingType.Base64 });
    const token = await lerToken();
    if (!token) return {}; // extração exige conta (endpoint autenticado)
    const r = await apiApp<{ campos?: CamposExtraidos }>('/documentos/extrair', {
      metodo: 'POST',
      corpo: { base64, tipo },
      token,
    });
    return r.campos ?? {};
  } catch {
    return {};
  }
}
