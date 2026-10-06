import { apiApp } from '@/conta/api';
import { lerToken } from '@/conta/armazenamento';
import { criarArma, listarArmas } from '@/db/armas';
import { CHAVES, gravarConfig, lerConfig } from '@/db/config';
import type { Acervo, Grupo } from '@/domain/tipos';

export interface ArmaSH {
  modelo: string;
  marca: string | null;
  calibre: string;
  especie: string | null;
  numeroSerie: string;
  registroNumero: string | null;
  acervo: string;
  grupo: string;
}

export interface RespostaArmasSH {
  /** OK | NAO_AUTORIZADO | ERRO | SEM_PARCEIROS | SEM_CONTA */
  status: string;
  armas: ArmaSH[];
}

/** Busca as armas do sócio na Shooting House (já normalizadas para o acervo). */
export async function buscarArmasSH(): Promise<RespostaArmasSH> {
  const token = await lerToken();
  if (!token) return { status: 'SEM_CONTA', armas: [] };
  try {
    return await apiApp<RespostaArmasSH>('/armas/shooting-house', { token });
  } catch {
    return { status: 'ERRO', armas: [] };
  }
}

/** Normaliza o nº de série para comparar com o acervo (sem espaços, maiúsculo). */
export function chaveSerie(serie: string | null): string {
  return (serie ?? '').replace(/\s+/g, '').toUpperCase();
}

/**
 * Importa automaticamente as armas da Shooting House para o acervo local.
 * - Não duplica: ignora séries já no acervo.
 * - Não ressuscita: guarda as séries já importadas, então uma arma apagada
 *   pelo usuário não volta na próxima sincronização.
 * Devolve quantas foram adicionadas agora. Silenciosa e idempotente.
 */
export async function importarArmasAuto(): Promise<number> {
  const r = await buscarArmasSH();
  if (r.status !== 'OK' || r.armas.length === 0) return 0;

  const acervo = await listarArmas();
  const noAcervo = new Set(acervo.map((a) => chaveSerie(a.numeroSerie)));

  let jaVistas: string[] = [];
  try {
    jaVistas = JSON.parse((await lerConfig(CHAVES.armasImportadasSH)) ?? '[]');
  } catch {
    jaVistas = [];
  }
  const vistas = new Set(jaVistas);

  const novas = r.armas.filter((a) => {
    const k = chaveSerie(a.numeroSerie);
    return k && !noAcervo.has(k) && !vistas.has(k);
  });
  if (novas.length === 0) return 0;

  for (const a of novas) {
    await criarArma({
      apelido: null,
      marca: a.marca,
      modelo: a.modelo,
      numeroSerie: a.numeroSerie,
      acervo: a.acervo as Acervo,
      grupo: a.grupo as Grupo,
      calibre: a.calibre,
      especie: a.especie,
      funcionamento: null,
      fabricante: a.marca,
      paisOrigem: null,
      anoFabricacao: null,
      numeroCano: null,
      capacidade: null,
      registroNumero: a.registroNumero,
      localGuarda: null,
      observacoes: null,
    });
    vistas.add(chaveSerie(a.numeroSerie));
  }
  await gravarConfig(CHAVES.armasImportadasSH, JSON.stringify([...vistas]));
  return novas.length;
}
