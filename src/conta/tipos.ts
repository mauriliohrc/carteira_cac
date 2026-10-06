/** Usuário final do app (Carteira CAC), como devolvido pela API v1. */
export interface UsuarioApp {
  id: string;
  nome: string;
  email: string;
  /** CPF só com dígitos. */
  cpf: string;
  emailVerificado: boolean;
  ativo: boolean;
  criadoEm: string;
}
