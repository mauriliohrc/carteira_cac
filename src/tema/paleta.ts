/**
 * Duas paletas de campo, de baixa saturação.
 *
 * O partido visual é "manual de campo": verde-oliva e latão sobre grafite no
 * escuro, tinta sobre papel-osso no claro. Nada de neon nem gradiente — a
 * hierarquia vem de tipografia, fio de cabelo e espaço, não de cor forte.
 */

export interface Paleta {
  nome: 'claro' | 'escuro';

  fundo: string;
  superficie: string;
  superficieAlta: string;
  borda: string;
  bordaForte: string;

  texto: string;
  textoMedio: string;
  textoFraco: string;
  /** Texto sobre o preenchimento primário (botão sólido). */
  sobrePrimario: string;

  primario: string;
  primarioForte: string;
  primarioFraco: string;

  /** Latão: usado no Premium e no aviso de 30 dias. */
  latao: string;
  lataoFraco: string;

  perigo: string;
  perigoFraco: string;
  critico: string;
  criticoFraco: string;
  aviso: string;
  avisoFraco: string;
  info: string;
  infoFraco: string;

  acervoDefesa: string;
  acervoAtirador: string;
  acervoCaca: string;
  acervoColecao: string;

  sombra: string;
  /** Fundo do visualizador de documento, sempre neutro. */
  leitor: string;
}

export const PALETA_ESCURA: Paleta = {
  nome: 'escuro',

  fundo: '#101310',
  superficie: '#171B16',
  superficieAlta: '#1F241D',
  borda: '#2A3027',
  bordaForte: '#3B4336',

  texto: '#E7EAE1',
  textoMedio: '#A9B09E',
  textoFraco: '#79806F',
  sobrePrimario: '#0E1209',

  primario: '#93AD65',
  primarioForte: '#AEC585',
  primarioFraco: 'rgba(147, 173, 101, 0.14)',

  latao: '#C9A227',
  lataoFraco: 'rgba(201, 162, 39, 0.14)',

  perigo: '#CB5B45',
  perigoFraco: 'rgba(203, 91, 69, 0.16)',
  critico: '#D98E34',
  criticoFraco: 'rgba(217, 142, 52, 0.16)',
  aviso: '#C9A227',
  avisoFraco: 'rgba(201, 162, 39, 0.14)',
  info: '#6E8FAE',
  infoFraco: 'rgba(110, 143, 174, 0.16)',

  acervoDefesa: '#6E8FAE',
  acervoAtirador: '#93AD65',
  acervoCaca: '#B4763F',
  acervoColecao: '#C9A227',

  sombra: 'transparent',
  leitor: '#0A0C0A',
};

export const PALETA_CLARA: Paleta = {
  nome: 'claro',

  // Fundo branco puro e neutros sem viés de cor: a personalidade vem do
  // oliva e do latão dos acentos, não de um papel tingido.
  fundo: '#FFFFFF',
  superficie: '#FFFFFF',
  superficieAlta: '#F2F3EF',
  borda: '#E5E6E1',
  bordaForte: '#C6C8C0',

  texto: '#14160F',
  textoMedio: '#4A5044',
  textoFraco: '#81877B',
  sobrePrimario: '#FFFFFF',

  primario: '#4A6526',
  primarioForte: '#38501B',
  primarioFraco: 'rgba(74, 101, 38, 0.09)',

  latao: '#8A6A16',
  lataoFraco: 'rgba(138, 106, 22, 0.10)',

  perigo: '#A83C24',
  perigoFraco: 'rgba(168, 60, 36, 0.09)',
  critico: '#95590C',
  criticoFraco: 'rgba(149, 89, 12, 0.09)',
  aviso: '#8A6A16',
  avisoFraco: 'rgba(138, 106, 22, 0.10)',
  info: '#3A587A',
  infoFraco: 'rgba(58, 88, 122, 0.09)',

  acervoDefesa: '#3A587A',
  acervoAtirador: '#4A6526',
  acervoCaca: '#8A5220',
  acervoColecao: '#8A6A16',

  sombra: '#14160F',
  leitor: '#2A2C26',
};

export const espaco = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 36,
} as const;

/**
 * Raios concêntricos. O micro (etiqueta, chip, campo) fica reto, com ar de
 * ficha impressa; a peça grande curva o bastante para conversar com o vidro.
 */
export const raio = {
  sm: 7,
  md: 14,
  lg: 22,
  pill: 999,
} as const;

/** Fonte monoespaçada para número de série, registro e datas técnicas. */
export const MONO = 'Courier';
