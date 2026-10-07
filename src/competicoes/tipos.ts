/** Competições como o app as recebe. */

export interface CompeticaoResumo {
  id: string;
  nome: string;
  descricao: string | null;
  bannerUrl: string | null;
  dataInicio: string;
  dataFim: string;
  entidadeId: string;
  entidadeNome: string;
  totalCategorias: number;
  /** true quando já começou (dataInicio <= hoje). */
  emAndamento: boolean;
}

export interface LinhaRanking {
  posicao: number;
  nome: string;
  pontuacao: number;
  /** true quando a linha é do próprio usuário logado. */
  ehVoce: boolean;
}

export interface MinhaPosicao {
  posicao: number;
  pontuacao: number;
  /** true quando a posição está dentro do Top 10 exibido. */
  noTop: boolean;
}

export interface CategoriaRanking {
  id: string;
  nome: string;
  descricao: string | null;
  regras: string | null;
  /** MAIOR | MENOR — sentido do ranking. */
  ordenamento: string;
  totalParticipantes: number;
  /** Top 10. */
  top: LinhaRanking[];
  /** Posição do usuário, mesmo fora do Top 10; null se ele não participou. */
  minhaPosicao: MinhaPosicao | null;
}

export interface CompeticaoDetalhe {
  id: string;
  nome: string;
  descricao: string | null;
  bannerUrl: string | null;
  regras: string | null;
  dataInicio: string;
  dataFim: string;
  entidadeId: string;
  entidadeNome: string;
  categorias: CategoriaRanking[];
}
