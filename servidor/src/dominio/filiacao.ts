import type { FiliacaoLiga } from '@prisma/client';
import { prisma } from '../db/cliente.js';
import { registrarEventoUsuario } from './eventoUsuario.js';
import { garantirCertificadoNoAcervo, refletirFiliacaoNoSync } from './filiacaoSync.js';

/** Vínculo associativo de 1 ano (legislação / validade PF). */
export const MESES_VINCULO = 12;

/** Status possíveis de uma filiação. */
export const STATUS_FILIACAO = [
  'pendente_pagamento',
  'ativa',
  'suspensa',
  'vencida',
  'cancelada',
] as const;

/** True se o usuário tem filiação ATIVA e vigente (liga). Base do preço filiado. */
export async function usuarioFiliado(usuarioId: string): Promise<boolean> {
  const n = await prisma.filiacaoLiga.count({
    where: { usuarioId, status: 'ativa', vigenteAte: { gt: new Date() } },
  });
  return n > 0;
}

export function adicionarMeses(base: Date, meses: number): Date {
  const d = new Date(base);
  d.setMonth(d.getMonth() + meses);
  return d;
}

/**
 * Filiação ativa CONCEDE o Premium no servidor (premiumTipo='FILIACAO'), para o
 * backoffice refletir na hora — independente do heartbeat do app. O app também
 * libera localmente ao ver a filiação ativa no sync.
 */
export async function concederPremiumFiliacao(usuarioId: string): Promise<void> {
  await prisma.usuarioApp.update({
    where: { id: usuarioId },
    data: { premium: true, premiumTipo: 'FILIACAO' },
  });
}

/**
 * Ao encerrar a filiação, rebaixa o Premium SE ele veio da filiação e não há
 * OUTRA filiação ativa e vigente. Premium de loja/cupom (outro premiumTipo) não
 * é tocado. Corrige o "Federado" obsoleto quando a filiação vence/cancela.
 */
export async function revogarPremiumFiliacao(usuarioId: string): Promise<void> {
  const u = await prisma.usuarioApp.findUnique({
    where: { id: usuarioId },
    select: { premiumTipo: true },
  });
  if (u?.premiumTipo !== 'FILIACAO') return;
  const aindaAtiva = await prisma.filiacaoLiga.count({
    where: { usuarioId, status: 'ativa', vigenteAte: { gt: new Date() } },
  });
  if (aindaAtiva > 0) return;
  await prisma.usuarioApp.update({
    where: { id: usuarioId },
    data: { premium: false, premiumTipo: null },
  });
}

/**
 * Piso do número de filiação: a numeração começa num patamar alto para transmitir
 * volume (em vez de 000001). O próximo número é sempre MAIOR número já emitido + 1,
 * com piso aqui — então nunca regride, mesmo após renumerações.
 */
export const PISO_NUMERO_FILIACAO = 3292;

/** Sufixo numérico de um número de filiação ("2026-003292" → 3292). */
export function sufixoNumeroFiliacao(numero: string | null | undefined): number {
  const m = /(\d+)\s*$/.exec(numero ?? '');
  return m ? Number(m[1]) : 0;
}

/** Gera um número de filiação único e legível: "AAAA-003292" (começa alto). */
async function gerarNumeroFiliacao(): Promise<string> {
  const ano = new Date().getFullYear();
  const numeradas = await prisma.filiacaoLiga.findMany({
    where: { numeroFiliacao: { not: null } },
    select: { numeroFiliacao: true },
  });
  // Próximo = maior sufixo já usado + 1, com piso em PISO_NUMERO_FILIACAO.
  let prox = PISO_NUMERO_FILIACAO;
  for (const f of numeradas) prox = Math.max(prox, sufixoNumeroFiliacao(f.numeroFiliacao) + 1);
  for (let tentativa = 0; tentativa < 5; tentativa++) {
    const candidato = `${ano}-${String(prox + tentativa).padStart(6, '0')}`;
    const existe = await prisma.filiacaoLiga.findUnique({ where: { numeroFiliacao: candidato } });
    if (!existe) return candidato;
  }
  // Fallback improvável (corrida): sufixo por timestamp.
  return `${ano}-${Date.now().toString().slice(-6)}`;
}

/**
 * Ativa (ou renova) uma filiação: atribui número no 1º aceite, marca 'ativa' e
 * estende a vigência por {@link MESES_VINCULO} (renovação soma a partir do fim
 * atual se ainda vigente). Reflete no sync e registra na timeline. Reutilizado
 * pelo webhook do Asaas e pelo script de migração de legados.
 */
export async function ativarFiliacao(
  filiacao: FiliacaoLiga,
  opcoes: { meses?: number; origemEvento?: string } = {}
): Promise<FiliacaoLiga> {
  const meses = opcoes.meses ?? MESES_VINCULO;
  const agora = new Date();
  const baseVigencia = filiacao.vigenteAte > agora ? filiacao.vigenteAte : agora;
  const numeroFiliacao = filiacao.numeroFiliacao ?? (await gerarNumeroFiliacao());
  const atualizada = await prisma.filiacaoLiga.update({
    where: { id: filiacao.id },
    data: {
      status: 'ativa',
      numeroFiliacao,
      vigenteAte: adicionarMeses(baseVigencia, meses),
    },
  });
  await refletirFiliacaoNoSync(atualizada);
  await concederPremiumFiliacao(atualizada.usuarioId);
  // Anexa (ou atualiza) o certificado no acervo do usuário — não bloqueia a
  // ativação se a geração do PDF falhar (o lazy em GET /filiacao recupera).
  try {
    await garantirCertificadoNoAcervo(atualizada, { regenerar: true });
  } catch {
    /* geração do certificado é best-effort */
  }
  await registrarEventoUsuario(atualizada.usuarioId, 'FILIACAO_ATIVA', {
    origem: opcoes.origemEvento ?? 'ASAAS',
    descricao: `Filiação ${numeroFiliacao} ativa até ${atualizada.vigenteAte
      .toISOString()
      .slice(0, 10)}`,
  });
  return atualizada;
}

/** Encerra uma filiação (vencida/cancelada/suspensa). Reflete no sync. */
export async function encerrarFiliacao(
  filiacao: FiliacaoLiga,
  status: 'vencida' | 'cancelada' | 'suspensa',
  origemEvento = 'ASAAS'
): Promise<FiliacaoLiga> {
  const atualizada = await prisma.filiacaoLiga.update({
    where: { id: filiacao.id },
    data: { status },
  });
  await refletirFiliacaoNoSync(atualizada);
  await revogarPremiumFiliacao(atualizada.usuarioId);
  await registrarEventoUsuario(atualizada.usuarioId, 'FILIACAO_ENCERRADA', {
    origem: origemEvento,
    descricao: `Filiação ${filiacao.numeroFiliacao ?? ''} ${status}`.trim(),
  });
  return atualizada;
}

/**
 * Cria uma filiação ATIVA manualmente pelo backoffice (admin promove um usuário
 * a filiado, sem passar pelo Asaas). Atribui número, reflete no sync e registra
 * na timeline. `vigenteAte` padrão = hoje + {@link MESES_VINCULO}.
 */
export async function criarFiliacaoManual(opts: {
  usuarioId: string;
  nomeCompleto: string;
  cpf: string;
  vigenteAte?: Date;
  documentacaoCompleta?: boolean;
}): Promise<FiliacaoLiga> {
  const vigente = opts.vigenteAte ?? adicionarMeses(new Date(), MESES_VINCULO);
  const criada = await prisma.filiacaoLiga.create({
    data: {
      usuarioId: opts.usuarioId,
      origem: 'MANUAL',
      status: 'ativa',
      nomeCompleto: opts.nomeCompleto,
      cpf: opts.cpf,
      valorCentavos: 0,
      documentacaoCompleta: opts.documentacaoCompleta ?? false,
      vigenteAte: vigente,
      numeroFiliacao: await gerarNumeroFiliacao(),
    },
  });
  await refletirFiliacaoNoSync(criada);
  await concederPremiumFiliacao(criada.usuarioId);
  try {
    await garantirCertificadoNoAcervo(criada, { regenerar: true });
  } catch {
    /* geração do certificado é best-effort */
  }
  await registrarEventoUsuario(opts.usuarioId, 'FILIACAO_ATIVA', {
    origem: 'ADMIN',
    descricao: `Filiado manualmente (nº ${criada.numeroFiliacao})`,
  });
  return criada;
}

/** Prisma → camelCase consumido pelo app e pelo backoffice. */
export function apresentarFiliacao(f: FiliacaoLiga) {
  return {
    id: f.id,
    numeroFiliacao: f.numeroFiliacao,
    status: f.status,
    origem: f.origem,
    nomeCompleto: f.nomeCompleto,
    cpf: f.cpf,
    dataNascimento: f.dataNascimento,
    endereco: {
      cep: f.cep,
      logradouro: f.logradouro,
      numero: f.numero,
      complemento: f.complemento,
      bairro: f.bairro,
      cidade: f.cidade,
      uf: f.uf,
    },
    docTipo: f.docTipo,
    documentacaoCompleta: f.documentacaoCompleta,
    valorCentavos: f.valorCentavos,
    invoiceUrl: f.invoiceUrl,
    vigenteAte: f.vigenteAte.toISOString(),
    criadoEm: f.criadoEm.toISOString(),
    atualizadoEm: f.atualizadoEm.toISOString(),
  };
}
