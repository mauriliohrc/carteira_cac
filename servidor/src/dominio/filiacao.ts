import type { FiliacaoLiga } from '@prisma/client';
import { prisma } from '../db/cliente.js';
import { registrarEventoUsuario } from './eventoUsuario.js';
import { refletirFiliacaoNoSync } from './filiacaoSync.js';

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

export function adicionarMeses(base: Date, meses: number): Date {
  const d = new Date(base);
  d.setMonth(d.getMonth() + meses);
  return d;
}

/** Gera um número de filiação único e legível: "AAAA-000123". */
async function gerarNumeroFiliacao(): Promise<string> {
  const ano = new Date().getFullYear();
  for (let tentativa = 0; tentativa < 5; tentativa++) {
    const total = await prisma.filiacaoLiga.count({ where: { numeroFiliacao: { not: null } } });
    const candidato = `${ano}-${String(total + 1 + tentativa).padStart(6, '0')}`;
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
