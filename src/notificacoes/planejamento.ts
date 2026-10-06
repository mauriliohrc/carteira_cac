/**
 * Planejamento puro dos alertas — sem nenhuma dependência de plataforma, para
 * que a regra do teto diário e do orçamento do iOS possa ser lida e testada
 * isolada do agendador.
 *
 * Regra do produto: a partir de 30 dias antes do vencimento o usuário é
 * avisado TODO DIA até regularizar, com no máximo 10 avisos por dia. Os avisos
 * são agrupados por frente — uma notificação por arma, mais uma para os
 * documentos pessoais — para que cada um seja acionável ("Glock G25: CRAF
 * venceu há 3 dias") em vez de uma lista única e ilegível.
 *
 * Restrição do iOS: o sistema guarda no máximo 64 notificações locais
 * pendentes por app e descarta o excedente em silêncio. Com teto de 10 por
 * dia, cobrir 30 dias daria 300 — muito acima. Por isso o plano usa
 * granularidade decrescente dentro de um orçamento fixo:
 *
 *   dias 0–2   → detalhado, até 10 avisos por dia   (≤ 30)
 *   dias 3–30  → um resumo único por dia            (≤ 28)
 *   -----------------------------------------------------------
 *   pior caso                                         58  (< 60 < 64)
 *
 * Como o plano é refeito a cada abertura do app, ao voltar do background e
 * após qualquer alteração de dados, a janela detalhada se renova sempre: na
 * prática o usuário está permanentemente dentro dos 3 dias detalhados.
 */
import { diffDias, isoParaBR, somarDias, textoPrazo, type DataISO } from '@/lib/data';
import { JANELA_ALERTA_DIAS } from '@/domain/vencimento';

/** Teto de notificações por dia. */
export const TETO_DIARIO = 10;
/** Margem de segurança sob o limite de 64 pendentes do iOS. */
export const ORCAMENTO_PENDENTES = 60;
/** Dias em que o alerta sai detalhado, um por arma. */
export const DIAS_DETALHADOS = 3;
/** Horizonte total de agendamento. */
export const DIAS_AGENDADOS = JANELA_ALERTA_DIAS + 1;

export const CHAVE_PESSOAL = '__pessoais__';

/** Um documento já traduzido para o que o planejador precisa saber. */
export interface EntradaAlerta {
  /** Identificador da frente: id da arma, ou CHAVE_PESSOAL. */
  grupoChave: string;
  /** Como a frente aparece no título: nome da arma, ou "Meus documentos". */
  grupoTitulo: string;
  /** Como o documento aparece na linha: "CRAF", "Guia de Tráfego (Clube Alfa)". */
  rotulo: string;
  validade: DataISO;
}

interface ItemAlerta {
  rotulo: string;
  validade: DataISO;
  dias: number;
}

interface Grupo {
  chave: string;
  titulo: string;
  itens: ItemAlerta[];
  /** Menor prazo do grupo — define a urgência. */
  pior: number;
}

export interface Aviso {
  titulo: string;
  subtitulo: string;
  corpo: string;
  /** Vencido ou a ≤7 dias: fura o Foco/Não perturbe do iOS. */
  urgente: boolean;
}

/**
 * Uma frente já redigida por fora — hoje, a habitualidade.
 *
 * Ela não vem de um documento com data de validade, então não passa por
 * `agruparNoDia`: chega pronta e apenas **concorre no mesmo teto diário**. É o
 * que mantém o orçamento do iOS intacto: o teto é por dia, não por frente.
 */
export interface FrenteExtra {
  aviso: Aviso;
  /** Urgência na escala dos documentos: menor = mais urgente. */
  pior: number;
  /** Itens representados, somados ao badge. */
  itens: number;
}

export interface AvisoPlanejado extends Aviso {
  quando: Date;
  /** Quantos documentos estão em alerta naquele dia — vira o badge do app. */
  badge: number;
}

// ------------------------------------------------------------- agrupamento

/** O que estará em alerta no dia `data`: vencidos + vencendo em ≤30 dias. */
export function agruparNoDia(data: DataISO, entradas: EntradaAlerta[]): Grupo[] {
  const grupos = new Map<string, Grupo>();

  for (const entrada of entradas) {
    const dias = diffDias(data, entrada.validade);
    if (dias > JANELA_ALERTA_DIAS) continue;

    const item: ItemAlerta = { rotulo: entrada.rotulo, validade: entrada.validade, dias };
    const grupo = grupos.get(entrada.grupoChave);
    if (grupo) {
      grupo.itens.push(item);
      grupo.pior = Math.min(grupo.pior, dias);
    } else {
      grupos.set(entrada.grupoChave, {
        chave: entrada.grupoChave,
        titulo: entrada.grupoTitulo,
        itens: [item],
        pior: dias,
      });
    }
  }

  const lista = [...grupos.values()];
  for (const g of lista) g.itens.sort((a, b) => a.dias - b.dias);
  // Mais urgente primeiro; empate resolve pelo título, para a ordem ser estável.
  lista.sort((a, b) => a.pior - b.pior || a.titulo.localeCompare(b.titulo));
  return lista;
}

export function totalDeItens(grupos: Grupo[]): number {
  return grupos.reduce((n, g) => n + g.itens.length, 0);
}

// ----------------------------------------------------------------- redação

function rotuloCurto(dias: number): string {
  if (dias < 0) return 'Vencido';
  if (dias === 0) return 'Vence hoje';
  if (dias <= 7) return 'Vence esta semana';
  return 'Vence este mês';
}

function avisoDoGrupo(grupo: Grupo): Aviso {
  const vencidos = grupo.itens.filter((i) => i.dias < 0).length;
  const urgente = grupo.pior <= 7;

  if (grupo.itens.length === 1) {
    const i = grupo.itens[0];
    return {
      titulo: `${i.dias < 0 ? '🚨' : '⚠️'} ${grupo.titulo}`,
      subtitulo: rotuloCurto(i.dias),
      corpo: `${i.rotulo} ${textoPrazo(i.dias)} — ${isoParaBR(i.validade)}.`,
      urgente,
    };
  }

  const linhas = grupo.itens
    .slice(0, 4)
    .map((i) => `• ${i.rotulo} — ${textoPrazo(i.dias)}`)
    .join('\n');
  const resto = grupo.itens.length > 4 ? `\n+ ${grupo.itens.length - 4} outro(s)` : '';

  return {
    titulo: `${vencidos ? '🚨' : '⚠️'} ${grupo.titulo}`,
    subtitulo: `${grupo.itens.length} documentos${vencidos ? ` · ${vencidos} vencido(s)` : ''}`,
    corpo: `${linhas}${resto}`,
    urgente,
  };
}

/** Um único aviso cobrindo vários grupos — usado nos dias mais distantes. */
function avisoResumo(grupos: Grupo[]): Aviso {
  if (grupos.length === 1) return avisoDoGrupo(grupos[0]);

  const itens = grupos.flatMap((g) => g.itens);
  const vencidos = itens.filter((i) => i.dias < 0).length;

  const linhas = grupos
    .slice(0, 4)
    .map((g) => `• ${g.titulo} — ${textoPrazo(g.pior)}`)
    .join('\n');
  const resto = grupos.length > 4 ? `\n+ ${grupos.length - 4} outra(s)` : '';

  return {
    titulo: vencidos ? '🚨 Documentos exigem ação' : '⚠️ Documentos vencendo',
    subtitulo: `${itens.length} documento(s)${vencidos ? ` · ${vencidos} vencido(s)` : ''}`,
    corpo: `${linhas}${resto}`,
    urgente: grupos[0].pior <= 7,
  };
}

/**
 * Converte os grupos de um dia nos avisos que serão disparados, respeitando o
 * teto diário. Passando de `TETO_DIARIO`, os últimos grupos viram um único
 * aviso agregado — nada some da vista sem o usuário saber.
 */
export function avisosDoDia(grupos: Grupo[], detalhado: boolean, extra?: FrenteExtra): Aviso[] {
  if (!grupos.length && !extra) return [];

  if (!detalhado) {
    // Um único aviso no dia. A frente extra entra COMO LINHA dele, nunca como
    // um segundo aviso: os 28 resumos virariam 56 e estourariam o orçamento.
    if (!grupos.length) return [extra!.aviso];
    const resumo = avisoResumo(grupos);
    if (!extra) return [resumo];
    return [
      {
        ...resumo,
        corpo: `${resumo.corpo}\n• ${extra.aviso.subtitulo}`,
        urgente: resumo.urgente || extra.aviso.urgente,
      },
    ];
  }

  // Dias detalhados: a frente extra ocupa uma das vagas do dia, então o teto
  // disponível para documentos cai em uma — e o total do dia não muda.
  const teto = extra ? TETO_DIARIO - 1 : TETO_DIARIO;
  const documentos =
    grupos.length <= teto
      ? grupos.map(avisoDoGrupo)
      : (() => {
          const individuais = grupos.slice(0, teto - 1).map(avisoDoGrupo);
          const excedente = grupos.slice(teto - 1);
          const agregado = avisoResumo(excedente);
          return [
            ...individuais,
            {
              ...agregado,
              titulo: `⚠️ + ${excedente.length} frentes com pendência`,
              subtitulo: `${totalDeItens(excedente)} documento(s)`,
            },
          ];
        })();

  if (!extra) return documentos;
  // Entra na fila por urgência, em vez de furar a fila.
  const primeiro = extra.pior <= (grupos[0]?.pior ?? Number.POSITIVE_INFINITY);
  return primeiro ? [extra.aviso, ...documentos] : [...documentos, extra.aviso];
}

// --------------------------------------------------------------- o plano

export interface OpcoesPlano {
  hoje: DataISO;
  /** Hora cheia do disparo, 0–23. */
  hora: number;
  /** "Agora" — avisos cujo horário já passou são descartados. */
  agora: Date;
  /** Frente já redigida que acompanha todos os dias do plano (habitualidade). */
  extra?: FrenteExtra;
}

/**
 * Monta a lista completa de avisos a agendar. Nunca devolve mais que
 * `ORCAMENTO_PENDENTES` itens nem mais que `TETO_DIARIO` para um mesmo dia.
 */
export function planejar(
  entradas: EntradaAlerta[],
  { hoje, hora, agora, extra }: OpcoesPlano
): AvisoPlanejado[] {
  const plano: AvisoPlanejado[] = [];

  for (let offset = 0; offset < DIAS_AGENDADOS; offset += 1) {
    const dia = somarDias(hoje, offset);
    const grupos = agruparNoDia(dia, entradas);
    // Sem documento em alerta a habitualidade ainda merece o dia — ela é uma
    // pendência por si, não um acessório da agenda de documentos.
    if (!grupos.length && !extra) continue;

    const [ano, mes, d] = dia.split('-').map(Number);
    const quando = new Date(ano, mes - 1, d, hora, 0, 0, 0);
    if (quando.getTime() <= agora.getTime() + 60_000) continue; // horário já passou

    const avisos = avisosDoDia(grupos, offset < DIAS_DETALHADOS, extra);

    // Se o dia não cabe inteiro no orçamento, para aqui em vez de agendar um
    // dia pela metade — meio aviso é pior que nenhum.
    if (plano.length + avisos.length > ORCAMENTO_PENDENTES) break;

    const badge = totalDeItens(grupos) + (extra?.itens ?? 0);
    for (const aviso of avisos) plano.push({ ...aviso, quando, badge });
  }

  return plano;
}

/** Quantos documentos estão em alerta hoje — usado para o badge do app. */
export function contarEmAlertaHoje(entradas: EntradaAlerta[], hoje: DataISO): number {
  return totalDeItens(agruparNoDia(hoje, entradas));
}
