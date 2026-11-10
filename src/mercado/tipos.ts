/** Tipos do marketplace (classificados de acessórios) no app. */

export type StatusAnuncio = 'PENDENTE' | 'APROVADO' | 'PAUSADO' | 'VENDIDO' | 'REJEITADO';
export type EstadoUso = 'NOVO' | 'SEMINOVO' | 'USADO';

export interface AnuncioLoja {
  id: string;
  nome: string;
  verificada: boolean;
  logoUrl: string | null;
  uf: string | null;
  cidade: string | null;
  /** Contato público da loja — só vem na API do app (nunca na web pública). */
  whatsapp?: string | null;
  site?: string | null;
}

export interface Anuncio {
  id: string;
  categoria: string;
  subcategoria: string | null;
  estadoUso: EstadoUso;
  precoCentavos: number | null;
  uf: string;
  cidade: string;
  titulo: string;
  descricao: string;
  status: StatusAnuncio;
  destacado: boolean;
  criadoEm: string;
  /** Anônimo em P2P (só primeiro nome); nulo quando é anúncio de loja. */
  vendedor: { primeiroNome: string } | null;
  loja: AnuncioLoja | null;
  fotos: string[];
}

export interface PaginaAnuncios {
  anuncios: Anuncio[];
  proximoCursor: string | null;
}

export interface SubcategoriaMarket {
  valor: string;
  rotulo: string;
}
export interface CategoriaMarket {
  valor: string;
  rotulo: string;
  subcategorias: SubcategoriaMarket[];
}
export interface CatalogoMarket {
  categorias: CategoriaMarket[];
  estadosUso: EstadoUso[];
}

/** Campos para criar/editar um anúncio. */
export interface DadosAnuncio {
  categoria: string;
  subcategoria?: string | null;
  estadoUso: EstadoUso;
  precoCentavos?: number | null;
  uf: string;
  cidade: string;
  titulo: string;
  descricao: string;
  fotos?: string[]; // ids de Upload
  lojaId?: string | null;
}

// ------------------------------------------------------------------ chat
export interface ConversaResumo {
  id: string;
  anuncio: { id: string; titulo: string; foto: string | null };
  outro: { primeiroNome: string };
  souVendedor: boolean;
  ultimaMensagem: { texto: string; criadoEm: string; meu: boolean } | null;
  naoLidas: number;
  atualizadoEm: string;
}

export interface MensagemChat {
  id: string;
  meu: boolean;
  texto: string;
  criadoEm: string;
}

export interface ConversaDetalhe {
  id: string;
  anuncio: { id: string; titulo: string };
  souVendedor: boolean;
  outro: { primeiroNome: string };
  contatoLiberado: boolean;
  /** Só chega ao comprador quando o vendedor libera. */
  telefoneVendedor: string | null;
  mensagens: MensagemChat[];
  proximoCursor: string | null;
}

export const ROTULO_ESTADO_USO: Record<EstadoUso, string> = {
  NOVO: 'Novo',
  SEMINOVO: 'Seminovo',
  USADO: 'Usado',
};

export const ROTULO_STATUS_ANUNCIO: Record<StatusAnuncio, string> = {
  PENDENTE: 'Em análise',
  APROVADO: 'No ar',
  PAUSADO: 'Pausado',
  VENDIDO: 'Vendido',
  REJEITADO: 'Reprovado',
};
