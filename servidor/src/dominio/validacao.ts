import { z } from 'zod';
import {
  PAPEIS_ADMIN,
  PAPEIS_ENTIDADE,
  PLATAFORMAS_PUSH,
  STATUS_NOTICIA,
  TIPOS_ENTIDADE,
  TIPOS_MIDIA,
} from './tipos.js';
import { limparCPF, validarCPF } from './cpf.js';

const ufBR = z
  .string()
  .trim()
  .length(2, 'UF deve ter 2 letras')
  .transform((s) => s.toUpperCase());

// --------------------------------------------------------------- autenticação
export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('E-mail inválido'),
  senha: z.string().min(1, 'Informe a senha'),
});

// ------------------------------------------------------------------- entidades
export const criarEntidadeSchema = z.object({
  nome: z.string().trim().min(2, 'Nome muito curto'),
  tipo: z.enum(TIPOS_ENTIDADE as [string, ...string[]]),
  cr: z.string().trim().optional().nullable(),
  cnpj: z.string().trim().optional().nullable(),
  email: z.string().trim().toLowerCase().email('E-mail inválido').optional().nullable(),
  telefone: z.string().trim().optional().nullable(),
  cidade: z.string().trim().optional().nullable(),
  uf: ufBR.optional().nullable(),
  ativo: z.boolean().optional(),
  // Integração Shooting House
  shIntegracaoAtiva: z.boolean().optional(),
  shBaseUrl: z.string().trim().url('URL inválida').optional().nullable(),
  shLogin: z.string().trim().optional().nullable(),
  shSenha: z.string().optional().nullable(),
});

export const atualizarEntidadeSchema = criarEntidadeSchema.partial();

// ------------------------------------------------------- usuários da entidade
export const criarUsuarioEntidadeSchema = z.object({
  nome: z.string().trim().min(2, 'Nome muito curto'),
  email: z.string().trim().toLowerCase().email('E-mail inválido'),
  senha: z.string().min(6, 'Senha deve ter ao menos 6 caracteres'),
  papel: z.enum(PAPEIS_ENTIDADE as [string, ...string[]]).optional(),
  ativo: z.boolean().optional(),
});

export const atualizarUsuarioEntidadeSchema = z.object({
  nome: z.string().trim().min(2).optional(),
  email: z.string().trim().toLowerCase().email('E-mail inválido').optional(),
  senha: z.string().min(6, 'Senha deve ter ao menos 6 caracteres').optional(),
  papel: z.enum(PAPEIS_ENTIDADE as [string, ...string[]]).optional(),
  ativo: z.boolean().optional(),
});

// ----------------------------------------------- usuário final do app (CAC)
export const cadastroAppSchema = z.object({
  nome: z.string().trim().min(2, 'Informe seu nome'),
  cpf: z
    .string()
    .transform(limparCPF)
    .refine(validarCPF, 'CPF inválido'),
  email: z.string().trim().toLowerCase().email('E-mail inválido'),
  senha: z.string().min(6, 'A senha deve ter ao menos 6 caracteres'),
});

export const registrarDispositivoSchema = z.object({
  token: z.string().trim().min(1, 'Token ausente'),
  plataforma: z.enum(PLATAFORMAS_PUSH as [string, ...string[]]),
});

// ---------------------------------------------------- push (backoffice)
export const alvoPushSchema = z.discriminatedUnion('tipo', [
  z.object({ tipo: z.literal('TODOS') }),
  z.object({ tipo: z.literal('ENTIDADE'), entidadeId: z.string().min(1) }),
  z.object({ tipo: z.literal('USUARIO'), usuarioId: z.string().min(1) }),
  z.object({ tipo: z.literal('INATIVOS'), diasSemAcesso: z.number().int().min(1).max(3650) }),
]);

export const enviarPushSchema = z.object({
  titulo: z.string().trim().min(1, 'Informe o título').max(120),
  corpo: z.string().trim().min(1, 'Informe a mensagem').max(1000),
  /** Deep link opcional, ex.: { noticiaId: "..." }. */
  dados: z.record(z.string(), z.string()).optional(),
  alvo: alvoPushSchema,
});

/** Push disparado por uma entidade: o alvo é sempre a própria entidade. */
export const enviarPushEntidadeSchema = z.object({
  titulo: z.string().trim().min(1, 'Informe o título').max(120),
  corpo: z.string().trim().min(1, 'Informe a mensagem').max(1000),
  dados: z.record(z.string(), z.string()).optional(),
});

export const vincularEntidadeSchema = z.object({
  entidadeId: z.string().min(1).nullable(),
});

/** Edição dos dados do usuário do app pelo backoffice (todos opcionais). */
export const editarUsuarioAppSchema = z.object({
  nome: z.string().trim().min(2, 'Nome muito curto').optional(),
  email: z.string().trim().toLowerCase().email('E-mail inválido').optional(),
  cpf: z.string().transform(limparCPF).refine(validarCPF, 'CPF inválido').optional(),
  ativo: z.boolean().optional(),
});

/** Vincular manualmente o usuário a uma entidade (backoffice). */
export const addVinculoSchema = z.object({ entidadeId: z.string().min(1) });

// ---------------------------------------------------------------- cupons
export const resgatarCupomSchema = z.object({
  codigo: z.string().min(1, 'Informe o código'),
});

export const criarCupomSchema = z.object({
  codigo: z.string().trim().min(2, 'Código muito curto').optional(),
  descricao: z.string().trim().max(200).optional().nullable(),
  limiteUsos: z.number().int().positive().optional().nullable(),
  expiraEm: z.string().optional().nullable(),
  ativo: z.boolean().optional(),
});

export const editarCupomSchema = z.object({
  descricao: z.string().trim().max(200).optional().nullable(),
  limiteUsos: z.number().int().positive().nullable().optional(),
  expiraEm: z.string().nullable().optional(),
  ativo: z.boolean().optional(),
});

export const esqueciSenhaSchema = z.object({
  email: z.string().trim().toLowerCase().email('E-mail inválido'),
});

const codigo6 = z
  .string()
  .trim()
  .regex(/^\d{6}$/, 'O código tem 6 dígitos');

export const redefinirSenhaSchema = z.object({
  email: z.string().trim().toLowerCase().email('E-mail inválido'),
  codigo: codigo6,
  senha: z.string().min(6, 'A senha deve ter ao menos 6 caracteres'),
});

/** Confirmação de e-mail do app com o código de 6 dígitos. */
export const confirmarEmailSchema = z.object({
  codigo: codigo6,
});

/** Troca de senha pelo usuário logado (informando a senha atual). */
export const alterarSenhaSchema = z.object({
  senhaAtual: z.string().min(1, 'Informe a senha atual'),
  senhaNova: z.string().min(6, 'A nova senha deve ter ao menos 6 caracteres'),
});

// ----------------------------------------------------------------- notícias
export const midiaNoticiaSchema = z.object({
  tipo: z.enum(TIPOS_MIDIA as [string, ...string[]]),
  url: z.string().trim().url('URL de mídia inválida'),
  legenda: z.string().trim().max(200, 'Legenda muito longa').optional().nullable(),
});

/** Campos comuns a admin e entidade. */
const noticiaBaseSchema = z.object({
  titulo: z.string().trim().min(3, 'Título muito curto'),
  resumo: z.string().trim().max(300, 'Resumo muito longo').optional().nullable(),
  conteudo: z.string().trim().min(1, 'Escreva o conteúdo'),
  imagemUrl: z.string().trim().url('URL de imagem inválida').optional().nullable(),
  status: z.enum(STATUS_NOTICIA as [string, ...string[]]).optional(),
  /** Galeria opcional, na ordem em que deve aparecer. */
  midias: z.array(midiaNoticiaSchema).max(30, 'Muitas mídias').optional(),
});

/**
 * Notícia criada pelo admin do app: pode definir o alcance.
 * `entidadeId` nulo/ausente = GERAL (todos veem). Preenchido = restrita aos
 * sócios daquela entidade.
 */
export const criarNoticiaSchema = noticiaBaseSchema.extend({
  entidadeId: z.string().min(1).optional().nullable(),
});

export const atualizarNoticiaSchema = criarNoticiaSchema.partial();

/** Notícia criada por uma entidade: o alcance é sempre a própria entidade. */
export const criarNoticiaEntidadeSchema = noticiaBaseSchema;
export const atualizarNoticiaEntidadeSchema = noticiaBaseSchema.partial();

// ----------------------------------------------------------- usuários admin
export const criarUsuarioAdminSchema = z.object({
  nome: z.string().trim().min(2, 'Nome muito curto'),
  email: z.string().trim().toLowerCase().email('E-mail inválido'),
  senha: z.string().min(6, 'Senha deve ter ao menos 6 caracteres'),
  papel: z.enum(PAPEIS_ADMIN as [string, ...string[]]).optional(),
});
