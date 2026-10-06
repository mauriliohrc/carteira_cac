/** Notícia como o app a recebe (somente publicadas). */
export interface Noticia {
  id: string;
  titulo: string;
  resumo: string | null;
  conteudo: string;
  imagemUrl: string | null;
  publicadaEm: string | null;
  /** Quando preenchido, é uma notícia exclusiva daquela entidade. */
  entidadeId?: string | null;
  entidadeNome?: string | null;
}

export interface PaginaNoticias {
  noticias: Noticia[];
  proximoCursor: string | null;
}
