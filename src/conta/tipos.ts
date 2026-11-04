/** Usuário final do app (Carteira CAC), como devolvido pela API v1. */
export interface UsuarioApp {
  id: string;
  nome: string;
  email: string;
  /** CPF só com dígitos. */
  cpf: string;
  /** Celular só com dígitos (DDD + número). Null se não informado. */
  celular: string | null;
  emailVerificado: boolean;
  ativo: boolean;
  criadoEm: string;
}
