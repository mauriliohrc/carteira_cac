export type TipoEntidade = 'CLUBE' | 'LIGA' | 'FEDERACAO';
export type PapelEntidade = 'ADMIN_ENTIDADE' | 'OPERADOR';

export const ROTULO_TIPO: Record<TipoEntidade, string> = {
  CLUBE: 'Clube',
  LIGA: 'Liga',
  FEDERACAO: 'Federação',
};

export const ROTULO_PAPEL: Record<PapelEntidade, string> = {
  ADMIN_ENTIDADE: 'Administrador',
  OPERADOR: 'Operador',
};

export interface Admin {
  id: string;
  nome: string;
  email: string;
  papel: string;
  ativo: boolean;
}

export interface Entidade {
  id: string;
  nome: string;
  /** Subdomínio público (ex.: "3gun" → 3gun.carteiracac.com). */
  subdominio?: string | null;
  tipo: TipoEntidade;
  cr: string | null;
  cnpj: string | null;
  email: string | null;
  telefone: string | null;
  cidade: string | null;
  uf: string | null;
  ativo: boolean;
  shIntegracaoAtiva?: boolean;
  shBaseUrl?: string | null;
  shLogin?: string | null;
  shConfigurado?: boolean;
  criadoEm: string;
  atualizadoEm: string;
  totalUsuarios?: number;
}

export type StatusNoticia = 'RASCUNHO' | 'PUBLICADA';

export const ROTULO_STATUS: Record<StatusNoticia, string> = {
  RASCUNHO: 'Rascunho',
  PUBLICADA: 'Publicada',
};

export interface Noticia {
  id: string;
  titulo: string;
  resumo: string | null;
  conteudo: string;
  imagemUrl: string | null;
  status: StatusNoticia;
  publicadaEm: string | null;
  autorId: string | null;
  /** Alcance: null = geral (todos); preenchido = restrita a uma entidade. */
  entidadeId: string | null;
  entidadeNome: string | null;
  /** Quantas pessoas leram no app. */
  leituras?: number;
  criadoEm: string;
  atualizadoEm: string;
}

export interface ListaNoticias {
  noticias: Noticia[];
  total: number;
  pagina: number;
  limite: number;
  totalPaginas: number;
}

export interface VinculoEntidade {
  id: string;
  nome: string;
  origem?: string;
}

export interface UsuarioApp {
  id: string;
  nome: string;
  email: string;
  cpf: string;
  celular?: string | null;
  ativo: boolean;
  emailVerificado?: boolean;
  premium: boolean;
  /** Origem do premium: CUPOM | MENSAL | ANUAL | ANUAL_PARCEIRO. Nulo = desconhecido. */
  premiumTipo?: string | null;
  entidades: VinculoEntidade[];
  ultimoAcessoEm: string | null;
  online: boolean;
  dispositivos: number;
  /** Plataformas dos aparelhos ativos: 'IOS' | 'ANDROID'. */
  plataformas?: string[];
  /** Armas cadastradas no app (acervo sincronizado). */
  armasSistema?: number;
  criadoEm: string;
}

export interface ListaUsuariosApp {
  usuarios: UsuarioApp[];
  total: number;
  pagina: number;
  limite: number;
  totalPaginas: number;
}

// ---- Perfil/acervo do usuário do app (registros espelhados da nuvem) ----
export interface DocumentoApp {
  id: string;
  tipo: string;
  arma_id: string | null;
  titulo: string | null;
  numero: string | null;
  orgao: string | null;
  data_emissao: string | null;
  data_validade: string | null;
  origem: string | null;
  destino: string | null;
  observacoes: string | null;
  criado_em?: string;
  atualizado_em?: string;
}

/** Definição de cada tipo de documento (espelha o catálogo do app). */
export interface DefDoc {
  valor: string;
  rotulo: string;
  escopo: 'ARMA' | 'PESSOAL';
  numeroLabel: string;
  /** Guia de tráfego: tem origem e destino. */
  trajeto?: boolean;
}

export const DEFS_DOC: DefDoc[] = [
  { valor: 'CRAF', rotulo: 'CRAF', escopo: 'ARMA', numeroLabel: 'Nº do CRAF' },
  { valor: 'GUIA_TRAFEGO', rotulo: 'Guia de Tráfego', escopo: 'ARMA', numeroLabel: 'Nº da guia', trajeto: true },
  { valor: 'AUTORIZACAO_COMPRA', rotulo: 'Autorização de Compra', escopo: 'ARMA', numeroLabel: 'Nº da autorização' },
  { valor: 'CR', rotulo: 'CR — Certificado de Registro', escopo: 'PESSOAL', numeroLabel: 'Nº do CR' },
  { valor: 'LAUDO_PSICOLOGICO', rotulo: 'Laudo Psicológico', escopo: 'PESSOAL', numeroLabel: 'Nº / CRP' },
  { valor: 'LAUDO_CAPACIDADE_TECNICA', rotulo: 'Capacidade Técnica', escopo: 'PESSOAL', numeroLabel: 'Nº / registro' },
  { valor: 'FILIACAO_CLUBE', rotulo: 'Filiação a Clube', escopo: 'PESSOAL', numeroLabel: 'Matrícula' },
  { valor: 'HABITUALIDADE', rotulo: 'Comprovante de Habitualidade', escopo: 'PESSOAL', numeroLabel: 'Nº do comprovante' },
  { valor: 'CERTIDAO', rotulo: 'Certidão Negativa', escopo: 'PESSOAL', numeroLabel: 'Nº da certidão' },
  { valor: 'OUTRO', rotulo: 'Outro documento', escopo: 'PESSOAL', numeroLabel: 'Número' },
];

export const DEF_DOC_POR_TIPO: Record<string, DefDoc> = Object.fromEntries(
  DEFS_DOC.map((d) => [d.valor, d])
);

export interface ArmaApp {
  id: string;
  modelo: string;
  apelido?: string | null;
  calibre: string;
  grupo: string;
  numero_serie: string;
  acervo: string;
}

export interface HabitualidadeApp {
  id: string;
  data: string;
  tipo: string;
  local_nome: string | null;
  origem?: string;
  _armas?: { grupo: string; arma_nome: string }[];
}

export interface ArquivoApp {
  id: string;
  documento_id: string;
  nome: string;
  mime: string | null;
  tamanho: number | null;
}

export interface PerfilUsuarioApp {
  usuario: {
    id: string;
    nome: string;
    email: string;
    cpf: string;
    ativo: boolean;
    premium: boolean;
    premiumTipo?: string | null;
    emailVerificado: boolean;
    entidades: VinculoEntidade[];
    ultimoAcessoEm: string | null;
    criadoEm: string;
  };
  armas: ArmaApp[];
  documentos: DocumentoApp[];
  habitualidades: HabitualidadeApp[];
  locais: Record<string, unknown>[];
  arquivos: ArquivoApp[];
}

/** Rótulo do tipo de premium reportado pelo app. */
export const ROTULO_PREMIUM: Record<string, string> = {
  CUPOM: 'Cupom',
  MENSAL: 'Mensal',
  ANUAL: 'Anual',
  ANUAL_PARCEIRO: 'Anual parceiro',
};

/** Texto do plano para exibir: "Grátis", "Premium" ou "Premium · <tipo>". */
export function rotuloPlano(premium: boolean, premiumTipo?: string | null): string {
  if (!premium) return 'Grátis';
  const tipo = premiumTipo ? ROTULO_PREMIUM[premiumTipo] : undefined;
  return tipo ? `Premium · ${tipo}` : 'Premium';
}

export const ROTULO_DOC: Record<string, string> = {
  CRAF: 'CRAF',
  GUIA_TRAFEGO: 'Guia de Tráfego',
  CR: 'CR',
  LAUDO_PSICOLOGICO: 'Laudo Psicológico',
  LAUDO_CAPACIDADE_TECNICA: 'Capacidade Técnica',
  FILIACAO_CLUBE: 'Filiação a Clube',
  HABITUALIDADE: 'Habitualidade',
  CERTIDAO: 'Certidão',
  AUTORIZACAO_COMPRA: 'Autorização de Compra',
  OUTRO: 'Outro',
};

export const TIPOS_DOC = Object.keys(ROTULO_DOC);

export const ROTULO_ACERVO: Record<string, string> = {
  DEFESA_PESSOAL: 'Defesa Pessoal (SINARM)',
  ATIRADOR: 'Atirador Desportivo (SIGMA)',
  CACA: 'Caça (SIGMA)',
  COLECAO: 'Coleção (SIGMA)',
};
export const ACERVOS = Object.keys(ROTULO_ACERVO);

export const ROTULO_GRUPO: Record<string, string> = {
  CLR_PERMITIDA: 'Longo raiada perm.',
  CLR_RESTRITA: 'Longo raiada restr.',
  CC_PERMITIDA: 'Curto permitida',
  CC_RESTRITA: 'Curto restrita',
  CLL_PERMITIDA: 'Longo lisa perm.',
  CLL_RESTRITA: 'Longo lisa restr.',
};

export interface Cupom {
  id: string;
  codigo: string;
  descricao: string | null;
  ativo: boolean;
  limiteUsos: number | null;
  usos: number;
  expiraEm: string | null;
  criadoEm: string;
}

export interface UsoCupom {
  criadoEm: string;
  usuario: { nome: string; email: string; cpf: string } | null;
}

export type TipoAlvoPush =
  | 'TODOS'
  | 'ENTIDADE'
  | 'USUARIO'
  | 'INATIVOS'
  | 'SEM_CADASTRO'
  | 'SEM_EMAIL'
  | 'SEM_ARMA';

export interface EnvioPush {
  id: string;
  titulo: string;
  corpo: string;
  alvoTipo: TipoAlvoPush;
  alvoRef: string | null;
  totalUsuarios: number;
  totalTokens: number;
  totalAceitos: number;
  criadoEm: string;
}

export interface UsuarioEntidade {
  id: string;
  entidadeId: string;
  nome: string;
  email: string;
  papel: PapelEntidade;
  ativo: boolean;
  criadoEm: string;
}

// ------------------------------------------------------------- competições
export type Ordenamento = 'MAIOR' | 'MENOR';

export const ROTULO_ORDENAMENTO: Record<Ordenamento, string> = {
  MAIOR: 'Maior pontuação vence',
  MENOR: 'Menor pontuação vence',
};

export const ROTULO_ORIGEM_NOME: Record<string, string> = {
  APP: 'Usuário do app',
  SHOOTING_HOUSE: 'Shooting House',
  MANUAL: 'Manual',
};

export interface Competicao {
  id: string;
  entidadeId: string;
  /** Subdomínio público da entidade dona (quando houver), p/ o link bonito. */
  entidadeSubdominio?: string | null;
  nome: string;
  descricao: string | null;
  bannerUrl: string | null;
  regras: string | null;
  dataInicio: string;
  dataFim: string;
  ativo: boolean;
  criadoEm: string;
  atualizadoEm: string;
  totalCategorias?: number;
  categorias?: CategoriaCompeticao[];
}

/** Slug cosmético do nome da competição para a URL (o id no fim é o que vale). */
export function slugCompeticao(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/**
 * Link público do ranking. Com subdomínio da entidade vira
 * `https://3gun.carteiracac.com/competicoes/nome-bonito-<id>`; sem ele, cai no
 * domínio do backoffice (entidades antigas sem subdomínio ainda funcionam).
 */
export function linkRankingPublico(
  comp: Pick<Competicao, 'id' | 'nome' | 'entidadeSubdominio'>
): string {
  if (comp.entidadeSubdominio) {
    const slug = slugCompeticao(comp.nome);
    const cauda = slug ? `${slug}-${comp.id}` : comp.id;
    return `https://${comp.entidadeSubdominio}.carteiracac.com/competicoes/${cauda}`;
  }
  return `https://backoffice.carteiracac.com/competicao/${comp.id}`;
}

export interface CategoriaCompeticao {
  id: string;
  competicaoId: string;
  nome: string;
  descricao: string | null;
  regras: string | null;
  dataInicio: string | null;
  dataFim: string | null;
  ordenamento: Ordenamento;
  criadoEm: string;
  atualizadoEm: string;
  totalResultados?: number;
}

export interface ResultadoCompeticao {
  id: string;
  cpf: string;
  nome: string;
  pontuacao: number;
  usuarioId: string | null;
  origemNome: string;
  observacao: string | null;
  criadoEm: string;
  posicao?: number;
}

export interface PreviaAtirador {
  cpf: string;
  nome: string | null;
  origem: 'APP' | 'SHOOTING_HOUSE' | 'NAO_ENCONTRADO';
}
