import type { DataISO } from '@/lib/data';

export type Acervo = 'DEFESA_PESSOAL' | 'ATIRADOR' | 'CACA' | 'COLECAO';

export type Grupo =
  | 'CLR_PERMITIDA'
  | 'CLR_RESTRITA'
  | 'CC_PERMITIDA'
  | 'CC_RESTRITA'
  | 'CLL_PERMITIDA'
  | 'CLL_RESTRITA';

export type TipoDocumento =
  | 'CRAF'
  | 'GUIA_TRAFEGO'
  | 'CR'
  | 'LAUDO_PSICOLOGICO'
  | 'LAUDO_CAPACIDADE_TECNICA'
  | 'FILIACAO_CLUBE'
  | 'HABITUALIDADE'
  | 'CERTIDAO'
  | 'AUTORIZACAO_COMPRA'
  | 'AUTORIZACAO_MANEJO'
  | 'AUTORIZACAO_IBAMA'
  | 'OUTRO';

export type Orgao = 'PF' | 'EXERCITO' | 'CLUBE' | 'PROFISSIONAL' | 'IBAMA' | 'OUTRO';

export interface Arma {
  id: string;
  apelido: string | null;
  marca: string | null;
  modelo: string;
  numeroSerie: string;
  acervo: Acervo;
  grupo: Grupo;
  calibre: string;
  especie: string | null;
  funcionamento: string | null;
  fabricante: string | null;
  paisOrigem: string | null;
  anoFabricacao: string | null;
  numeroCano: string | null;
  capacidade: string | null;
  registroNumero: string | null;
  localGuarda: string | null;
  observacoes: string | null;
  criadoEm: string;
  atualizadoEm: string;
}

export interface Documento {
  id: string;
  tipo: TipoDocumento;
  armaId: string | null;
  titulo: string | null;
  numero: string | null;
  orgao: Orgao | null;
  dataEmissao: DataISO | null;
  /** Sempre informada pelo usuário — o app nunca calcula. */
  dataValidade: DataISO;
  origem: string | null;
  destino: string | null;
  /** Local onde ocorre o manejo — usado só pela Autorização de Manejo. */
  localManejo: string | null;
  observacoes: string | null;
  criadoEm: string;
  atualizadoEm: string;
}

export interface Arquivo {
  id: string;
  documentoId: string;
  nome: string;
  uri: string;
  mime: string | null;
  tamanho: number | null;
  criadoEm: string;
}

/** Documento + contexto já resolvido, usado nas telas e nas notificações. */
export interface DocumentoComContexto extends Documento {
  arma: Arma | null;
  arquivos: Arquivo[];
}

// ------------------------------------------------------- habitualidade

export type TipoSessao = 'TREINO' | 'COMPETICAO';

/** Onde a sessão foi feita: clube, estande, entidade. Cadastrado pelo usuário. */
export interface LocalTiro {
  id: string;
  nome: string;
  cidade: string | null;
  uf: string | null;
  /** Nº do CR do clube / entidade, como consta no comprovante. */
  cr: string | null;
  observacoes: string | null;
  criadoEm: string;
}

/** Uma arma usada numa sessão. */
export interface ArmaNaHabitualidade {
  /** Fica null se a arma sair do acervo — o crédito do grupo continua valendo. */
  armaId: string | null;
  /** Grupo no dia da sessão: é o que conta, mesmo que a arma mude depois. */
  grupo: Grupo;
  /** Nome no dia da sessão, para o registro continuar legível sem a arma. */
  nome: string;
}

/** Uma sessão de tiro registrada — treino ou competição. */
export interface Habitualidade {
  id: string;
  data: DataISO;
  tipo: TipoSessao;
  localId: string | null;
  /** Nome do local no dia — sobrevive à exclusão do cadastro do local. */
  localNome: string | null;
  observacoes: string | null;
  armas: ArmaNaHabitualidade[];
  criadoEm: string;
  atualizadoEm: string;
}
