/**
 * O resumo que alimenta o widget da tela inicial.
 *
 * O widget roda num processo à parte — não executa React Native nem lê o
 * SQLite do app. Por isso ele não calcula nada: o app reduz todo o acervo a
 * este punhado de campos e os entrega prontos (ver `./publicar`). Toda a regra
 * continua nos módulos puros de sempre — `avaliar` (vencimento) e
 * `calcularProgresso` (habitualidade) —, então o widget nunca diverge das
 * telas nem dos avisos.
 *
 * Módulo puro, sem SQLite nem React: é o que o teste exercita.
 */
import { rotuloTipoDoc } from '@/domain/catalogos';
import { GRUPO_POR_VALOR } from '@/domain/catalogos';
import {
  calcularProgresso,
  MINIMO_POR_GRUPO,
  type ProgressoHabitualidade,
} from '@/domain/habitualidade';
import { avaliar, PESO_SITUACAO, type Situacao } from '@/domain/vencimento';
import type { Arma, Documento, Grupo, Habitualidade } from '@/domain/tipos';
import { agoraISO, hojeISO, textoPrazo, type DataISO } from '@/lib/data';

/** Como cada grupo aparece na barra detalhada do widget médio. */
export interface GrupoResumo {
  rotulo: string;
  feitas: number;
  minimo: number;
}

export interface ResumoWidget {
  /** Pior situação dos documentos, para escolher ícone e cor. */
  docEstado: 'OK' | 'ATENCAO' | 'VENCIDO';
  /** Linha pronta: "Tudo em ordem com seu acervo" ou "CRAF vence em 12 dias". */
  docMsg: string;
  /** Quantos documentos estão dentro dos 30 dias ou já vencidos. */
  docQtdAtencao: number;

  /** Há habitualidade a cumprir (atirador que não desligou o acompanhamento). */
  habExigido: boolean;
  /** Todos os grupos (ou a exigência genérica) com o mínimo cumprido. */
  habEmDia: boolean;
  /** Fração 0..1 do total de sessões exigidas já feitas — move a barra. */
  habProgresso: number;
  /** Linha pronta: "3/8 sessões" ou "2 de 3 grupos em dia". */
  habTexto: string;
  /** Andamento por grupo, para o widget médio desenhar uma barra por grupo. */
  habGrupos: GrupoResumo[];

  /** Verde só quando documentos E habitualidade estão em ordem. */
  estadoGeral: 'OK' | 'ATENCAO';
  /** Quando o app recalculou — o widget mostra "atualizado há…". */
  atualizadoEm: string;
}

/** Situações que o produto considera "precisa de atenção" (dentro dos 30 dias). */
const EM_ATENCAO: Situacao[] = ['VENCIDO', 'CRITICO', 'ALERTA'];

/** Rótulo curto de um documento: "CRAF", "Guia de Tráfego (Clube Alfa)". */
function rotuloDoc(doc: Documento): string {
  return doc.titulo ? `${rotuloTipoDoc(doc.tipo)} (${doc.titulo})` : rotuloTipoDoc(doc.tipo);
}

/** Rótulo curto de um grupo balístico, com recuo seguro. */
function rotuloGrupo(g: Grupo): string {
  return GRUPO_POR_VALOR[g]?.curto ?? g;
}

/**
 * O lado da habitualidade do resumo. A barra precisa de UMA fração contínua,
 * então somamos as sessões que contam (teto de 8 por grupo) sobre o total
 * exigido — assim um atirador 8/8 + 4/8 mostra 75%, e não "1 de 2 grupos".
 */
function resumirHabitualidade(p: ProgressoHabitualidade): Pick<
  ResumoWidget,
  'habExigido' | 'habEmDia' | 'habProgresso' | 'habTexto' | 'habGrupos'
> {
  if (!p.exigido) {
    return { habExigido: false, habEmDia: true, habProgresso: 1, habTexto: '', habGrupos: [] };
  }

  // Exigência genérica (atirador sem arma de atirador): uma barra só.
  if (p.generico) {
    const feitas = Math.min(p.generico.feitas, MINIMO_POR_GRUPO);
    return {
      habExigido: true,
      habEmDia: p.generico.cumprido,
      habProgresso: feitas / MINIMO_POR_GRUPO,
      habTexto: `${p.generico.feitas}/${MINIMO_POR_GRUPO} sessões`,
      habGrupos: [{ rotulo: 'Habitualidade', feitas: p.generico.feitas, minimo: MINIMO_POR_GRUPO }],
    };
  }

  const alvo = MINIMO_POR_GRUPO * p.grupos.length;
  const contam = p.grupos.reduce((n, g) => n + Math.min(g.feitas, MINIMO_POR_GRUPO), 0);
  return {
    habExigido: true,
    habEmDia: p.faltamTotal === 0,
    // alvo nunca é 0 aqui: exigido com grupos implica ao menos um grupo.
    habProgresso: contam / alvo,
    habTexto: `${p.cumpridos} de ${p.grupos.length} grupo${p.grupos.length > 1 ? 's' : ''} em dia`,
    habGrupos: p.grupos.map((g) => ({
      rotulo: rotuloGrupo(g.grupo),
      feitas: g.feitas,
      minimo: MINIMO_POR_GRUPO,
    })),
  };
}

/**
 * Reduz o acervo inteiro ao resumo do widget. `gerenciar` é o mesmo flag das
 * configurações: desligado, a habitualidade não é exigida nem exibida.
 */
export function montarResumoWidget(
  documentos: Documento[],
  armas: Arma[],
  habitualidades: Habitualidade[],
  gerenciar = true,
  hoje: DataISO = hojeISO()
): ResumoWidget {
  // ---- documentos: a pior situação manda no ícone e na mensagem.
  let pior: { situacao: Situacao; dias: number; doc: Documento } | null = null;
  let qtdAtencao = 0;
  for (const doc of documentos) {
    const info = avaliar(doc.dataValidade, hoje);
    if (EM_ATENCAO.includes(info.situacao)) qtdAtencao += 1;
    if (!pior || PESO_SITUACAO[info.situacao] < PESO_SITUACAO[pior.situacao]) {
      pior = { situacao: info.situacao, dias: info.dias, doc };
    }
  }

  const docEstado: ResumoWidget['docEstado'] =
    pior?.situacao === 'VENCIDO' ? 'VENCIDO' : qtdAtencao > 0 ? 'ATENCAO' : 'OK';

  let docMsg: string;
  if (docEstado === 'OK') {
    docMsg = 'Tudo em ordem com seu acervo';
  } else if (qtdAtencao === 1 && pior) {
    // Um só: cabe a frase específica e acionável.
    docMsg = `${rotuloDoc(pior.doc)} ${textoPrazo(pior.dias)}`;
  } else {
    docMsg = `${qtdAtencao} documentos precisam de atenção`;
  }

  const hab = resumirHabitualidade(calcularProgresso(armas, habitualidades, hoje, gerenciar));

  return {
    docEstado,
    docMsg,
    docQtdAtencao: qtdAtencao,
    ...hab,
    estadoGeral: docEstado === 'OK' && hab.habEmDia ? 'OK' : 'ATENCAO',
    atualizadoEm: agoraISO(),
  };
}
