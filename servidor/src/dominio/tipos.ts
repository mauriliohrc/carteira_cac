// "Enums" do domínio modelados como uniões de string (portável para qualquer
// banco). A validação de fato acontece com os schemas Zod em `validacao.ts`.

export type TipoEntidade = 'CLUBE' | 'LIGA' | 'FEDERACAO';
export const TIPOS_ENTIDADE: TipoEntidade[] = ['CLUBE', 'LIGA', 'FEDERACAO'];

export type PapelAdmin = 'SUPER_ADMIN' | 'SUPORTE';
export const PAPEIS_ADMIN: PapelAdmin[] = ['SUPER_ADMIN', 'SUPORTE'];

export type PapelEntidade = 'ADMIN_ENTIDADE' | 'OPERADOR';
export const PAPEIS_ENTIDADE: PapelEntidade[] = ['ADMIN_ENTIDADE', 'OPERADOR'];

export type StatusNoticia = 'RASCUNHO' | 'PUBLICADA';
export const STATUS_NOTICIA: StatusNoticia[] = ['RASCUNHO', 'PUBLICADA'];

export type TipoMidia = 'IMAGEM' | 'YOUTUBE';
export const TIPOS_MIDIA: TipoMidia[] = ['IMAGEM', 'YOUTUBE'];

export type PlataformaPush = 'IOS' | 'ANDROID';
export const PLATAFORMAS_PUSH: PlataformaPush[] = ['IOS', 'ANDROID'];

/** Sentido do ranking de uma categoria de competição. */
export type Ordenamento = 'MAIOR' | 'MENOR';
export const ORDENAMENTOS: Ordenamento[] = ['MAIOR', 'MENOR'];

export type TipoAlvoPush = 'TODOS' | 'ENTIDADE' | 'USUARIO' | 'INATIVOS';

/** Janela, em minutos, para considerar um usuário "online" agora. */
export const JANELA_ONLINE_MIN = 5;

export type EscopoAutenticacao = 'ADMIN' | 'ENTIDADE' | 'APP';

/** Quem está autenticado numa requisição. */
export interface Autenticado {
  id: string;
  escopo: EscopoAutenticacao;
  papel?: PapelAdmin | PapelEntidade;
  /** Presente apenas quando escopo === 'ENTIDADE'. */
  entidadeId?: string;
}
