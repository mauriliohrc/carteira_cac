// Helpers compartilhados entre as rotas de competição da ENTIDADE
// (escopo pelo token) e do ADMIN do app (escopo pela entidade na URL).
import type { Competicao, CategoriaCompeticao, EntidadeTiro, ResultadoCompeticao } from '@prisma/client';
import { prisma } from '../db/cliente.js';
import { invalido } from '../http/erros.js';
import { verificarParceiro } from '../integracoes/shootinghouse.js';
import { enviarPush } from '../push/expo.js';

/**
 * Avisa o atirador (push) quando o resultado dele é lançado. Abre direto o
 * ranking da competição no app (deep link via `dados.competicaoId`).
 * Best-effort: sem conta/sem device, não faz nada; falha não quebra o lançamento.
 */
export async function notificarResultado(
  usuarioId: string | null,
  competicaoId: string,
  competicaoNome: string,
  categoriaNome: string
): Promise<void> {
  if (!usuarioId) return;
  const dispositivos = await prisma.dispositivoPush.findMany({
    where: { usuarioId, ativo: true },
    select: { token: true },
  });
  const tokens = dispositivos.map((d) => d.token);
  if (!tokens.length) return;
  await enviarPush(tokens, {
    titulo: `${competicaoNome} — ${categoriaNome}`,
    corpo: 'Resultado lançado',
    dados: { competicaoId },
  });
}

export function limpar<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;
}

export function apresentarCategoria(cat: CategoriaCompeticao, totalResultados?: number) {
  return {
    id: cat.id,
    competicaoId: cat.competicaoId,
    nome: cat.nome,
    descricao: cat.descricao,
    regras: cat.regras,
    dataInicio: cat.dataInicio,
    dataFim: cat.dataFim,
    ordenamento: cat.ordenamento,
    criadoEm: cat.criadoEm,
    atualizadoEm: cat.atualizadoEm,
    ...(totalResultados !== undefined ? { totalResultados } : {}),
  };
}

type CompComContagem = Competicao & {
  categorias?: CategoriaCompeticao[];
  _count?: { categorias: number };
};
export function apresentarCompeticao(c: CompComContagem) {
  return {
    id: c.id,
    entidadeId: c.entidadeId,
    nome: c.nome,
    descricao: c.descricao,
    bannerUrl: c.bannerUrl,
    regras: c.regras,
    dataInicio: c.dataInicio,
    dataFim: c.dataFim,
    ativo: c.ativo,
    criadoEm: c.criadoEm,
    atualizadoEm: c.atualizadoEm,
    totalCategorias: c._count?.categorias ?? c.categorias?.length ?? 0,
    ...(c.categorias ? { categorias: c.categorias.map((cat) => apresentarCategoria(cat)) } : {}),
  };
}

export function apresentarResultado(r: ResultadoCompeticao & { posicao?: number }) {
  return {
    id: r.id,
    cpf: r.cpf,
    nome: r.nome,
    pontuacao: r.pontuacao,
    usuarioId: r.usuarioId,
    origemNome: r.origemNome,
    observacao: r.observacao,
    criadoEm: r.criadoEm,
    ...(r.posicao !== undefined ? { posicao: r.posicao } : {}),
  };
}

/**
 * Resolve o nome do atirador a partir do CPF:
 *  1. nome informado manualmente (ainda tenta vincular à conta do app);
 *  2. usuário do app com aquele CPF (origem APP);
 *  3. cadastro na Shooting House da entidade (origem SHOOTING_HOUSE);
 *  4. senão, exige o nome manual.
 */
export async function resolverAtirador(
  entidade: Pick<EntidadeTiro, 'shIntegracaoAtiva' | 'shBaseUrl' | 'shLogin' | 'shSenha'>,
  cpf: string,
  nomeManual?: string | null
): Promise<{ nome: string; usuarioId: string | null; origemNome: string }> {
  const usuario = await prisma.usuarioApp.findUnique({ where: { cpf }, select: { id: true, nome: true } });

  if (nomeManual) {
    return { nome: nomeManual, usuarioId: usuario?.id ?? null, origemNome: 'MANUAL' };
  }
  if (usuario) {
    return { nome: usuario.nome, usuarioId: usuario.id, origemNome: 'APP' };
  }
  if (entidade.shIntegracaoAtiva && entidade.shLogin && entidade.shSenha) {
    const v = await verificarParceiro(
      { baseUrl: entidade.shBaseUrl, login: entidade.shLogin, senha: entidade.shSenha },
      cpf
    );
    if (v.membro && v.nome) {
      return { nome: v.nome, usuarioId: null, origemNome: 'SHOOTING_HOUSE' };
    }
  }
  throw invalido('Não foi possível identificar o nome deste CPF. Informe o nome manualmente.');
}

/** Prévia do nome de um CPF para a tela de lançamento (app → SH → não encontrado). */
export async function previaAtirador(
  entidade: Pick<EntidadeTiro, 'shIntegracaoAtiva' | 'shBaseUrl' | 'shLogin' | 'shSenha'> | null,
  cpf: string
): Promise<{ cpf: string; nome: string | null; origem: string }> {
  const usuario = await prisma.usuarioApp.findUnique({ where: { cpf }, select: { nome: true } });
  if (usuario) return { cpf, nome: usuario.nome, origem: 'APP' };
  if (entidade?.shIntegracaoAtiva && entidade.shLogin && entidade.shSenha) {
    const v = await verificarParceiro(
      { baseUrl: entidade.shBaseUrl, login: entidade.shLogin, senha: entidade.shSenha },
      cpf
    );
    if (v.membro && v.nome) return { cpf, nome: v.nome, origem: 'SHOOTING_HOUSE' };
  }
  return { cpf, nome: null, origem: 'NAO_ENCONTRADO' };
}
