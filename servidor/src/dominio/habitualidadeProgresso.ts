/**
 * Progresso de habitualidade calculado NO SERVIDOR, a partir do JSON de
 * sincronização (registros_sync). É uma porta enxuta da regra de cobertura do
 * app (`src/domain/habitualidade.ts` → `calcularProgresso`): a obrigação é da
 * pessoa, 8 sessões por grupo balístico de acervo ATIRADOR dentro de uma janela
 * móvel de 12 meses; sem arma de atirador, 8 genéricas; acervo só de defesa
 * pessoal não é atirador e não deve nada.
 *
 * Usado pelo disparo de push de lembrete — para dizer a cada usuário quantas
 * habitualidades faltam. O número bate com o que o app mostra na tela.
 *
 * Limitações conhecidas (a config do app NÃO é sincronizada para o servidor):
 *  - Não conhece o "acompanhamento desligado" (`habitualidade.gerenciar`) nem o
 *    nível do atirador. Assume o padrão: acompanhamento LIGADO e piso do Nível 1
 *    (8 por grupo). Para quem desligou, pode cobrar algo que o app não mostra —
 *    aceitável para um lembrete, e o público é filtrável no backoffice.
 */

/** Formato cru da arma em registros_sync (tipo='armas'), colunas do SQLite. */
interface ArmaSync {
  acervo?: string;
  grupo?: string;
}

/** Formato cru da sessão em registros_sync (tipo='habitualidades'). */
interface HabitualidadeSync {
  data?: string;
  _armas?: { grupo?: string }[];
}

export interface ProgressoHabitualidade {
  /** Há habitualidade a cumprir (é atirador e o acompanhamento se aplica). */
  exigido: boolean;
  /** Soma das sessões que ainda faltam, somando todos os grupos exigidos. */
  faltamTotal: number;
  /** Sessões registradas dentro da janela de 12 meses (qualquer grupo). */
  feitasJanela: number;
  /** Todos os grupos exigidos em dia (faltamTotal === 0). */
  cumprido: boolean;
}

/** Sessões exigidas por grupo dentro da janela (piso legal / Nível 1). */
const MINIMO_POR_GRUPO = 8;
/** Tamanho da janela móvel, em meses. */
const MESES_JANELA = 12;

/** Hoje em horário de Brasília (UTC-3), como 'YYYY-MM-DD'. */
export function hojeBRT(agora: number = Date.now()): string {
  return new Date(agora - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/**
 * Primeira data que ainda conta hoje: 12 meses atrás + 1 dia. Uma sessão feita
 * exatamente 12 meses atrás já completou o prazo e sai da conta (igual ao app).
 */
export function inicioJanela(hoje: string): string {
  const [y, m, d] = hoje.split('-').map(Number);
  const base = new Date(Date.UTC(y, m - 1, d));
  base.setUTCMonth(base.getUTCMonth() - MESES_JANELA);
  base.setUTCDate(base.getUTCDate() + 1);
  return base.toISOString().slice(0, 10);
}

/**
 * Cruza o acervo com as sessões e devolve o andamento. Conta pelo grupo gravado
 * na sessão (`_armas[].grupo`), não pelo grupo atual da arma — vender a arma
 * depois não desfaz a habitualidade cumprida. Cada sessão credita um grupo uma
 * única vez, por mais armas daquele grupo que tenha levado.
 */
export function progressoHabitualidade(
  armas: ArmaSync[],
  sessoes: HabitualidadeSync[],
  hoje: string = hojeBRT()
): ProgressoHabitualidade {
  const inicio = inicioJanela(hoje);
  const naJanela = sessoes.filter(
    (s) => typeof s.data === 'string' && s.data >= inicio && s.data <= hoje
  );
  const feitasJanela = naJanela.length;

  // Grupos que o acervo de ATIRADOR obriga a comprovar.
  const gruposExigidos = new Set(
    armas.filter((a) => a.acervo === 'ATIRADOR' && a.grupo).map((a) => a.grupo as string)
  );

  if (gruposExigidos.size > 0) {
    let faltamTotal = 0;
    for (const grupo of gruposExigidos) {
      const feitas = naJanela.filter((s) =>
        (s._armas ?? []).some((a) => a.grupo === grupo)
      ).length;
      faltamTotal += Math.max(0, MINIMO_POR_GRUPO - feitas);
    }
    return { exigido: true, faltamTotal, feitasJanela, cumprido: faltamTotal === 0 };
  }

  // Sem arma de atirador. Acervo SÓ de defesa pessoal (SINARM/PF) não é de
  // atirador — não deve nada. Sem arma nenhuma segue sendo o atirador que ainda
  // não comprou: deve 8 genéricas de qualquer grupo.
  const soDefesaPessoal = armas.length > 0 && armas.every((a) => a.acervo === 'DEFESA_PESSOAL');
  if (soDefesaPessoal) {
    return { exigido: false, faltamTotal: 0, feitasJanela, cumprido: false };
  }

  const faltamTotal = Math.max(0, MINIMO_POR_GRUPO - feitasJanela);
  return { exigido: true, faltamTotal, feitasJanela, cumprido: faltamTotal === 0 };
}
