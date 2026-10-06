import { diffDias, hojeISO, type DataISO } from '@/lib/data';
import type { Paleta } from '@/tema/paleta';

/** A partir de quantos dias antes do vencimento o app começa a alertar. */
export const JANELA_ALERTA_DIAS = 30;

export type Situacao = 'VENCIDO' | 'CRITICO' | 'ALERTA' | 'ATENCAO' | 'EM_DIA';

export interface InfoSituacao {
  situacao: Situacao;
  dias: number;
  rotulo: string;
  /** Está dentro da janela em que o app dispara aviso diário. */
  emAlerta: boolean;
}

export interface EstiloSituacao {
  cor: string;
  fundo: string;
}

const ROTULOS: Record<Situacao, string> = {
  VENCIDO: 'Vencido',
  CRITICO: 'Crítico',
  ALERTA: 'Vencendo',
  ATENCAO: 'Atenção',
  EM_DIA: 'Em dia',
};

export function classificar(dias: number): Situacao {
  if (dias < 0) return 'VENCIDO';
  if (dias <= 7) return 'CRITICO';
  if (dias <= JANELA_ALERTA_DIAS) return 'ALERTA';
  if (dias <= 90) return 'ATENCAO';
  return 'EM_DIA';
}

/** Avaliação pura: não sabe nada de cor, então serve também às notificações. */
export function avaliar(validade: DataISO, referencia: DataISO = hojeISO()): InfoSituacao {
  const dias = diffDias(referencia, validade);
  const situacao = classificar(dias);
  return {
    situacao,
    dias,
    rotulo: ROTULOS[situacao],
    emAlerta: dias <= JANELA_ALERTA_DIAS,
  };
}

/** A cor vem da paleta em uso, então depende do tema ativo. */
export function estiloSituacao(situacao: Situacao, c: Paleta): EstiloSituacao {
  switch (situacao) {
    case 'VENCIDO':
      return { cor: c.perigo, fundo: c.perigoFraco };
    case 'CRITICO':
      return { cor: c.critico, fundo: c.criticoFraco };
    case 'ALERTA':
      return { cor: c.aviso, fundo: c.avisoFraco };
    case 'ATENCAO':
      return { cor: c.info, fundo: c.infoFraco };
    case 'EM_DIA':
      return { cor: c.primario, fundo: c.primarioFraco };
  }
}

/** Avaliação + cores, para uso direto nas telas. */
export function avaliarComCor(
  validade: DataISO,
  c: Paleta,
  referencia: DataISO = hojeISO()
): InfoSituacao & EstiloSituacao {
  const info = avaliar(validade, referencia);
  return { ...info, ...estiloSituacao(info.situacao, c) };
}

export function ordenarPorUrgencia<T extends { dataValidade: DataISO }>(itens: T[]): T[] {
  return [...itens].sort((a, b) => a.dataValidade.localeCompare(b.dataValidade));
}

export const PESO_SITUACAO: Record<Situacao, number> = {
  VENCIDO: 0,
  CRITICO: 1,
  ALERTA: 2,
  ATENCAO: 3,
  EM_DIA: 4,
};
