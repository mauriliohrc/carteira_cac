import type {
  CampoServicoDespachante,
  FaixaPrecoDespachante,
  ServicoDespachante,
  StatusProcessoDespachante,
} from '@prisma/client';
import { prisma } from '../db/cliente.js';
import { SERVICOS_DESPACHANTE, precoUnitario } from './despachante.js';

/**
 * Catálogo DINÂMICO do despachante: serviços, status e campos de formulário são
 * editáveis no backoffice (tabelas próprias). Este módulo semeia os padrões uma
 * única vez (idempotente) e resolve o catálogo efetivo para o app e o admin.
 *
 * Compatibilidade: `codigo` do serviço = o antigo `tipoServico` (serviços
 * legados preservados). O `status` que vai no sync é sempre um dos 5 códigos
 * LEGADOS (mapeados pelo `papel`), para apps antigos nunca quebrarem.
 */

/** Códigos de status que apps antigos entendem (STATUS_INFO embutido no app). */
export type StatusBaseLegado =
  | 'aguardando_pagamento'
  | 'pago'
  | 'em_andamento'
  | 'concluido'
  | 'cancelado';

/** papel do status → código-base legado emitido no sync (old-app-safe). */
export function baseLegadoDoPapel(papel: string): StatusBaseLegado {
  switch (papel) {
    case 'INICIAL':
      return 'aguardando_pagamento';
    case 'PAGO':
      return 'pago';
    case 'FINAL':
      return 'concluido';
    case 'CANCELADO':
      return 'cancelado';
    // AGUARDANDO_DOC | EM_ANALISE | NORMAL e quaisquer novos → "em andamento".
    default:
      return 'em_andamento';
  }
}

/** Status padrão (seed). Inclui os 5 códigos legados + os novos do fluxo. */
const STATUS_PADRAO: Omit<StatusProcessoDespachante, 'id' | 'atualizadoEm'>[] = [
  { codigo: 'aguardando_pagamento', label: 'Aguardando pagamento', cor: '#c99a2e', icone: 'time-outline', papel: 'INICIAL', ordem: 10, ativo: true },
  { codigo: 'pago', label: 'Pago', cor: '#30a46c', icone: 'checkmark-circle-outline', papel: 'PAGO', ordem: 20, ativo: true },
  { codigo: 'aguardando_documentacao', label: 'Aguardando documentação', cor: '#c99a2e', icone: 'document-attach-outline', papel: 'AGUARDANDO_DOC', ordem: 30, ativo: true },
  { codigo: 'em_analise', label: 'Em análise', cor: '#5b8def', icone: 'search-outline', papel: 'EM_ANALISE', ordem: 40, ativo: true },
  { codigo: 'em_andamento', label: 'Em andamento', cor: '#5b8def', icone: 'sync-outline', papel: 'NORMAL', ordem: 50, ativo: true },
  { codigo: 'deferido', label: 'Deferido', cor: '#30a46c', icone: 'thumbs-up-outline', papel: 'NORMAL', ordem: 60, ativo: true },
  { codigo: 'concluido', label: 'Finalizado', cor: '#2f855a', icone: 'checkmark-done-outline', papel: 'FINAL', ordem: 70, ativo: true },
  { codigo: 'cancelado', label: 'Cancelado', cor: '#8a8f98', icone: 'close-circle-outline', papel: 'CANCELADO', ordem: 80, ativo: true },
];

let catalogoPronto = false;

/**
 * Garante que existam os status e serviços padrão (idempotente). Os serviços
 * herdam os preços já cadastrados em ServicoDespachanteConfig (se houver), para
 * não perder os valores de produção ao migrar para o catálogo dinâmico.
 */
export async function garantirCatalogoDespachante(): Promise<void> {
  if (catalogoPronto) return;

  // Status: cria os que faltarem (não sobrescreve edições do admin).
  for (const s of STATUS_PADRAO) {
    await prisma.statusProcessoDespachante.upsert({
      where: { codigo: s.codigo },
      create: s,
      update: {},
    });
  }

  // Serviços: semeia só se o catálogo estiver vazio (primeira migração).
  const totalServicos = await prisma.servicoDespachante.count();
  if (totalServicos === 0) {
    const configs = await prisma.servicoDespachanteConfig.findMany();
    const porTipo = new Map(configs.map((c) => [c.tipoServico, c]));
    let ordem = 0;
    for (const s of SERVICOS_DESPACHANTE) {
      const c = porTipo.get(s.tipo);
      await prisma.servicoDespachante.create({
        data: {
          codigo: s.tipo,
          nome: s.nome,
          descricao: s.descricao,
          icone: iconePadrao(s.tipo),
          gruCentavos: c?.gruCentavos ?? s.gruCentavos,
          servicoCentavos: c?.servicoCentavos ?? s.servicoCentavos,
          unidade: s.unidade,
          porArma: s.tipo === 'RENOVACAO_CRAF' || s.tipo === 'EMISSAO_GUIA',
          ativo: c?.ativo ?? true,
          ordem: (ordem += 10),
        },
      });
    }
  }

  catalogoPronto = true;
}

/** Ícone (Ionicons) inicial por serviço legado — editável depois no backoffice. */
function iconePadrao(codigo: string): string {
  switch (codigo) {
    case 'CADASTRO_RENOVACAO_IBAMA':
      return 'leaf-outline';
    case 'AQUISICAO_TRANSFERENCIA':
      return 'swap-horizontal-outline';
    case 'POSSE_PF':
      return 'home-outline';
    case 'PORTE_PF':
      return 'shield-checkmark-outline';
    case 'RENOVACAO_CRAF':
      return 'refresh-circle-outline';
    case 'EMISSAO_GUIA':
      return 'document-text-outline';
    default:
      return 'briefcase-outline';
  }
}

export interface ServicoComCampos extends ServicoDespachante {
  /** Preço por unidade, NÃO filiado, para 1 equipamento (compat: campo legado). */
  precoCentavos: number;
  /** Preço por unidade, FILIADO, para 1 equipamento (aditivo). */
  precoFiliadoCentavos: number;
  faixas: FaixaPrecoDespachante[];
  campos: CampoServicoDespachante[];
}

/** Anexa os preços-base resolvidos (1 unidade) a partir das faixas/legado. */
function comPrecos<T extends { gruCentavos: number; servicoCentavos: number; faixas: FaixaPrecoDespachante[] }>(
  s: T
): T & { precoCentavos: number; precoFiliadoCentavos: number } {
  return {
    ...s,
    precoCentavos: precoUnitario(s, 1, false),
    precoFiliadoCentavos: precoUnitario(s, 1, true),
  };
}

/** Serviços do catálogo (com campos ativos), ordenados. */
export async function resolverServicosDinamicos(apenasAtivos = false): Promise<ServicoComCampos[]> {
  await garantirCatalogoDespachante();
  const servicos = await prisma.servicoDespachante.findMany({
    where: apenasAtivos ? { ativo: true } : undefined,
    orderBy: [{ ordem: 'asc' }, { nome: 'asc' }],
    include: {
      campos: { where: { ativo: true }, orderBy: { ordem: 'asc' } },
      faixas: { orderBy: { qtdMin: 'asc' } },
    },
  });
  return servicos.map(comPrecos);
}

/** Um serviço do catálogo pelo código (= tipoServico). */
export async function resolverServicoDinamico(codigo: string): Promise<ServicoComCampos | undefined> {
  await garantirCatalogoDespachante();
  const s = await prisma.servicoDespachante.findUnique({
    where: { codigo },
    include: {
      campos: { where: { ativo: true }, orderBy: { ordem: 'asc' } },
      faixas: { orderBy: { qtdMin: 'asc' } },
    },
  });
  return s ? comPrecos(s) : undefined;
}

/** Lista de status (ordenada). */
export async function listarStatus(): Promise<StatusProcessoDespachante[]> {
  await garantirCatalogoDespachante();
  return prisma.statusProcessoDespachante.findMany({ orderBy: { ordem: 'asc' } });
}

/** Primeiro status ativo com o papel pedido (p/ automação). */
export async function statusPorPapel(papel: string): Promise<StatusProcessoDespachante | null> {
  await garantirCatalogoDespachante();
  return prisma.statusProcessoDespachante.findFirst({
    where: { papel, ativo: true },
    orderBy: { ordem: 'asc' },
  });
}

/** Um valor de campo "conta" como preenchido conforme o tipo. */
export function campoPreenchido(
  tipo: string,
  v: { conteudo?: Uint8Array | null; tamanho?: number | null; valorTexto?: string | null; status?: string } | undefined
): boolean {
  if (!v) return false;
  if (v.status === 'REJEITADO') return false; // rejeitado volta a pendente
  switch (tipo) {
    case 'ARQUIVO':
      return (v.tamanho ?? 0) > 0 || !!v.conteudo;
    case 'CHECKBOX':
      return v.valorTexto === 'true';
    default: // TEXTO | SENHA_GOV
      return !!(v.valorTexto && v.valorTexto.trim());
  }
}

export interface Progresso {
  totalObrigatorios: number;
  preenchidosObrigatorios: number;
  completo: boolean;
  faltantes: { id: string; nome: string; tipo: string }[];
}

/**
 * Progresso de preenchimento dos campos OBRIGATÓRIOS de um processo.
 * `campos` = campos ativos do serviço; `valores` = respostas do processo.
 */
export function calcularProgresso(
  campos: { id: string; nome: string; tipo: string; obrigatorio: boolean }[],
  valores: { campoId: string | null; tipo: string; conteudo?: Uint8Array | null; tamanho?: number | null; valorTexto?: string | null; status?: string }[]
): Progresso {
  const porCampo = new Map(valores.filter((v) => v.campoId).map((v) => [v.campoId!, v]));
  const obrig = campos.filter((c) => c.obrigatorio);
  const faltantes = obrig.filter((c) => !campoPreenchido(c.tipo, porCampo.get(c.id)));
  return {
    totalObrigatorios: obrig.length,
    preenchidosObrigatorios: obrig.length - faltantes.length,
    completo: faltantes.length === 0,
    faltantes: faltantes.map((c) => ({ id: c.id, nome: c.nome, tipo: c.tipo })),
  };
}
