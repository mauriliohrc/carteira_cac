/**
 * Habitualidade: a regra e a contagem.
 *
 * O atirador desportivo precisa comprovar, **por grupo de armas**, no mínimo 8
 * sessões de tiro nos últimos 12 meses. Três coisas fazem a regra funcionar:
 *
 * 1. **Só o acervo de atirador exige.** Caça, coleção e defesa pessoal não
 *    pedem habitualidade, então um grupo só entra na cobrança se houver ao
 *    menos uma arma de acervo ATIRADOR nele. Quem só tem revólver de defesa
 *    pessoal não deve ver cobrança nenhuma.
 * 2. **A janela é móvel.** Não há "ano-calendário": a contagem é sempre dos
 *    últimos 12 meses contados de hoje, então uma sessão sai da conta sozinha
 *    ao completar 12 meses. É por isso que existe `perdeEm`: dá para avisar o
 *    dia em que o grupo deixa de estar em dia, antes de acontecer.
 * 3. **Uma sessão credita cada grupo uma vez.** Levar três pistolas do mesmo
 *    grupo num treino é uma habitualidade, não três. Levar uma pistola e uma
 *    espingarda é uma em cada grupo.
 *
 * Módulo puro, sem SQLite nem React — é o que `npm test` exercita.
 */
import { diffDias, hojeISO, isoParaBR, somarDias, somarMeses, type DataISO } from '@/lib/data';
import { GRUPO_POR_VALOR, GRUPOS } from '@/domain/catalogos';
import { JANELA_ALERTA_DIAS } from '@/domain/vencimento';
import type { Arma, Grupo, Habitualidade } from './tipos';

/** Sessões exigidas por grupo dentro da janela. */
export const MINIMO_POR_GRUPO = 8;

/** Tamanho da janela móvel, em meses. */
export const MESES_JANELA = 12;

/**
 * Primeira data que ainda conta hoje.
 *
 * Uma sessão feita exatamente 12 meses atrás já completou o prazo e sai da
 * conta — daí o `+1 dia`. Preferimos errar para o lado conservador: melhor o
 * app cobrar uma sessão a mais do que dizer "em dia" para quem não está.
 */
export function inicioJanela(hoje: DataISO = hojeISO()): DataISO {
  return somarDias(somarMeses(hoje, -MESES_JANELA), 1);
}

/** O dia em que uma sessão feita em `data` deixa de contar. */
export function saiDaJanelaEm(data: DataISO): DataISO {
  return somarMeses(data, MESES_JANELA);
}

/**
 * Grupos que o acervo obriga a comprovar, na ordem do catálogo.
 * Só armas de acervo ATIRADOR entram: é o único que exige habitualidade.
 */
export function gruposExigidos(armas: Arma[]): Grupo[] {
  const presentes = new Set(armas.filter((a) => a.acervo === 'ATIRADOR').map((a) => a.grupo));
  return GRUPOS.map((g) => g.valor).filter((g) => presentes.has(g));
}

/** Grupos que a sessão credita — cada um uma única vez, por mais armas que tenha. */
export function gruposDaSessao(sessao: Habitualidade): Grupo[] {
  return [...new Set(sessao.armas.map((a) => a.grupo))];
}

export interface ProgressoGrupo {
  grupo: Grupo;
  /** Sessões dentro da janela que creditaram este grupo. */
  feitas: number;
  /** Quantas ainda faltam para o mínimo. Zero quando cumprido. */
  faltam: number;
  cumprido: boolean;
  /** Armas de acervo ATIRADOR neste grupo. */
  armas: number;
  /** Data da sessão mais recente na janela. */
  ultima: DataISO | null;
  /**
   * Dia em que o grupo deixa de estar em dia, porque a 8ª sessão mais recente
   * completa 12 meses e sai da janela. Null quando o grupo ainda não cumpriu.
   */
  perdeEm: DataISO | null;
}

export interface ProgressoHabitualidade {
  /** O acervo exige habitualidade de pelo menos um grupo. */
  exigido: boolean;
  grupos: ProgressoGrupo[];
  /** Grupos com as 8 sessões em dia. */
  cumpridos: number;
  /** Soma das sessões que ainda faltam, somando todos os grupos. */
  faltamTotal: number;
  /** Sessões registradas dentro da janela, independentemente do grupo. */
  sessoesNaJanela: number;
  /** Extremos da janela em vigor, para exibir na tela. */
  inicio: DataISO;
  hoje: DataISO;
}

/**
 * Cruza o acervo com as sessões registradas e devolve o andamento por grupo.
 *
 * Conta pelo grupo gravado na sessão, não pelo grupo atual da arma: a sessão
 * aconteceu com aquela arma naquele dia, e vender a arma depois não desfaz a
 * habitualidade cumprida.
 */
export function calcularProgresso(
  armas: Arma[],
  sessoes: Habitualidade[],
  hoje: DataISO = hojeISO()
): ProgressoHabitualidade {
  const inicio = inicioJanela(hoje);
  const naJanela = sessoes.filter((s) => s.data >= inicio && s.data <= hoje);

  // Datas de cada grupo, da mais recente para a mais antiga.
  const datasPorGrupo = new Map<Grupo, DataISO[]>();
  for (const sessao of naJanela) {
    for (const grupo of gruposDaSessao(sessao)) {
      const lista = datasPorGrupo.get(grupo);
      if (lista) lista.push(sessao.data);
      else datasPorGrupo.set(grupo, [sessao.data]);
    }
  }
  for (const lista of datasPorGrupo.values()) lista.sort((a, b) => b.localeCompare(a));

  const armasPorGrupo = new Map<Grupo, number>();
  for (const a of armas) {
    if (a.acervo !== 'ATIRADOR') continue;
    armasPorGrupo.set(a.grupo, (armasPorGrupo.get(a.grupo) ?? 0) + 1);
  }

  const grupos = gruposExigidos(armas).map<ProgressoGrupo>((grupo) => {
    const datas = datasPorGrupo.get(grupo) ?? [];
    const feitas = datas.length;
    const cumprido = feitas >= MINIMO_POR_GRUPO;
    return {
      grupo,
      feitas,
      faltam: Math.max(0, MINIMO_POR_GRUPO - feitas),
      cumprido,
      armas: armasPorGrupo.get(grupo) ?? 0,
      ultima: datas[0] ?? null,
      // A contagem cai no dia em que a 8ª mais recente completa 12 meses.
      perdeEm: cumprido ? saiDaJanelaEm(datas[MINIMO_POR_GRUPO - 1]) : null,
    };
  });

  return {
    exigido: grupos.length > 0,
    grupos,
    cumpridos: grupos.filter((g) => g.cumprido).length,
    faltamTotal: grupos.reduce((n, g) => n + g.faltam, 0),
    sessoesNaJanela: naJanela.length,
    inicio,
    hoje,
  };
}

// ------------------------------------------------------------------- avisos

/**
 * A habitualidade como uma frente do plano de notificações.
 *
 * Duas coisas merecem aviso, e são diferentes:
 *
 * - **Grupo abaixo do mínimo** — já está irregular HOJE. Como a janela é móvel,
 *   não existe "data de vencimento" a informar: existe uma falta em aberto, que
 *   segue sendo cobrada todo dia até o atirador ir ao clube.
 * - **Grupo completo com a 8ª mais recente perto dos 12 meses** — este sim tem
 *   data, o `perdeEm`, e entra na mesma janela de 30 dias dos documentos.
 *
 * A redação usa **data absoluta**, nunca contagem regressiva. É de propósito: o
 * mesmo aviso vale em qualquer dia em que for disparado, então o planejador
 * pode compor a frente uma única vez em vez de recalcular texto por dia.
 */
export interface FrenteHabitualidade {
  titulo: string;
  subtitulo: string;
  corpo: string;
  /** Fura o Foco do iOS. Reservado à perda iminente — ver abaixo. */
  urgente: boolean;
  /** Urgência na mesma escala dos documentos: dias até a perda, negativo = já irregular. */
  pior: number;
  /** Grupos representados, somados ao badge do app. */
  itens: number;
}

export function avisoDeHabitualidade(
  progresso: ProgressoHabitualidade
): FrenteHabitualidade | null {
  if (!progresso.exigido) return null;

  const curto = (g: Grupo) => GRUPO_POR_VALOR[g]?.curto ?? g;
  const plural = (n: number) => (n > 1 ? 's' : '');

  const atrasados = progresso.grupos.filter((g) => !g.cumprido);
  const aCair = progresso.grupos
    .filter(
      (g) =>
        g.cumprido && g.perdeEm && diffDias(progresso.hoje, g.perdeEm) <= JANELA_ALERTA_DIAS
    )
    .sort((a, b) => a.perdeEm!.localeCompare(b.perdeEm!));

  if (!atrasados.length && !aCair.length) return null;

  const linhas = [
    ...atrasados.map(
      (g) =>
        `• ${curto(g.grupo)} — ${g.feitas}/${MINIMO_POR_GRUPO}, faltam ${g.faltam}`
    ),
    ...aCair.map(
      (g) =>
        `• ${curto(g.grupo)} — cai para ${MINIMO_POR_GRUPO - 1} em ${isoParaBR(g.perdeEm)}`
    ),
  ];
  const mostradas = linhas.slice(0, 4);
  const resto = linhas.length > 4 ? `\n+ ${linhas.length - 4} outro(s)` : '';

  const diasParaCair = aCair.length ? diffDias(progresso.hoje, aCair[0].perdeEm!) : Infinity;

  return {
    titulo: atrasados.length ? '🎯 Habitualidade incompleta' : '🎯 Habitualidade a vencer',
    subtitulo: atrasados.length
      ? `${atrasados.length} grupo${plural(atrasados.length)} abaixo de ${MINIMO_POR_GRUPO}`
      : `${aCair.length} grupo${plural(aCair.length)} perde${aCair.length > 1 ? 'm' : ''} as ${MINIMO_POR_GRUPO} em até ${JANELA_ALERTA_DIAS} dias`,
    corpo: `${mostradas.join('\n')}${resto}`,
    // O grupo atrasado não fura o Foco: ele não tem data e seria cobrado todo
    // dia, o que transformaria "time sensitive" em ruído. Só a perda iminente
    // de um grupo que HOJE está em dia merece esse tratamento.
    urgente: diasParaCair <= 7,
    pior: atrasados.length ? -1 : diasParaCair,
    itens: atrasados.length + aCair.length,
  };
}

/** Ordena as sessões da mais recente para a mais antiga. */
export function ordenarSessoes(sessoes: Habitualidade[]): Habitualidade[] {
  return [...sessoes].sort(
    (a, b) => b.data.localeCompare(a.data) || b.criadoEm.localeCompare(a.criadoEm)
  );
}
