/**
 * Variante web do agendador.
 *
 * O `expo-notifications` não tem implementação web, e o navegador não oferece
 * nada equivalente a notificação local agendada para daqui a 20 dias com o
 * site fechado. Então na prévia web os alertas ficam desligados: o app
 * continua calculando vencimentos e mostrando a agenda, só não dispara aviso.
 *
 * Mesma superfície pública de ./index.ts, para as telas não precisarem saber
 * em que plataforma estão.
 */
import { hojeISO } from '@/lib/data';
import { rotuloTipoDoc } from '@/domain/catalogos';
import { nomeArma } from '@/domain/rotulos';
import type { Arma, Documento, Habitualidade } from '@/domain/tipos';
import { CHAVE_PESSOAL, contarEmAlertaHoje, type EntradaAlerta } from './planejamento';

export { TETO_DIARIO, DIAS_DETALHADOS, ORCAMENTO_PENDENTES } from './planejamento';

export const CANAL_ANDROID = 'vencimentos';
export const HORA_PADRAO = 9;

/** As telas usam isto para explicar por que o interruptor não liga. */
export const ALERTAS_DISPONIVEIS = false;

export async function prepararCanal(): Promise<void> {}

export async function pedirPermissao(): Promise<boolean> {
  return false;
}

export async function permissaoConcedida(): Promise<boolean> {
  return false;
}

export function montarEntradas(documentos: Documento[], armas: Arma[]): EntradaAlerta[] {
  const porId = new Map(armas.map((a) => [a.id, a]));
  return documentos.map((doc) => {
    const arma = doc.armaId ? porId.get(doc.armaId) : null;
    return {
      grupoChave: arma ? arma.id : CHAVE_PESSOAL,
      grupoTitulo: arma ? nomeArma(arma) : 'Meus documentos',
      rotulo: doc.titulo
        ? `${rotuloTipoDoc(doc.tipo)} (${doc.titulo})`
        : rotuloTipoDoc(doc.tipo),
      validade: doc.dataValidade,
    };
  });
}

export interface ResultadoAgendamento {
  agendadas: number;
  proxima: Date | null;
  semPermissao: boolean;
}

export async function reagendarAlertas(
  documentos: Documento[],
  armas: Arma[],
  habitualidades: Habitualidade[] = [],
  gerenciar = true,
  hora: number = HORA_PADRAO
): Promise<ResultadoAgendamento> {
  void hora;
  void habitualidades;
  void gerenciar;
  // Mesmo sem agendar, atualiza o título da aba com o que está em alerta hoje.
  const emAlerta = contarEmAlertaHoje(montarEntradas(documentos, armas), hojeISO());
  if (typeof document !== 'undefined') {
    document.title = emAlerta ? `(${emAlerta}) Carteira CAC` : 'Carteira CAC';
  }
  return { agendadas: 0, proxima: null, semPermissao: true };
}

export async function limparAlertas(): Promise<void> {}

export async function contarAgendadas(): Promise<number> {
  return 0;
}
