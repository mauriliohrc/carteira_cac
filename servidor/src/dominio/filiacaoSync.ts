import type { FiliacaoLiga } from '@prisma/client';
import { prisma } from '../db/cliente.js';
import { resolverConfigFiliacao } from './filiacaoConfig.js';
import { gerarPdfCertificadoFiliacao } from './certificadoPdf.js';

/**
 * Reflete a filiação à liga no espelho de sincronização do usuário
 * (RegistroSync tipo 'filiacoes'), para o app receber o status/validade pelo
 * pull — mesmo mecanismo do despachante (ver despachanteSync.ts).
 *
 * As chaves do JSON são snake_case, idênticas às colunas da tabela local do app.
 * `atualizado_em` avança para "agora" a cada reflexo, empurrando o cursor do
 * pull. NÃO vazamos ids internos do Asaas (asaasSubscriptionId) para o cliente.
 *
 * ADITIVO: 'filiacoes' é um NOVO tipo de registro. Apps antigos que não o
 * conhecem simplesmente o ignoram no pull — nada quebra.
 */
export async function refletirFiliacaoNoSync(f: FiliacaoLiga): Promise<void> {
  const agora = new Date();
  const dados = {
    id: f.id,
    numero_filiacao: f.numeroFiliacao,
    status: f.status,
    origem: f.origem,
    nome_completo: f.nomeCompleto,
    cpf: f.cpf,
    cep: f.cep,
    logradouro: f.logradouro,
    numero: f.numero,
    complemento: f.complemento,
    bairro: f.bairro,
    cidade: f.cidade,
    uf: f.uf,
    doc_tipo: f.docTipo,
    // 0/1 (não boolean): o upsert genérico do SQLite do app não liga boolean JS.
    documentacao_completa: f.documentacaoCompleta ? 1 : 0,
    valor_centavos: f.valorCentavos,
    vigente_ate: f.vigenteAte.toISOString(),
    invoice_url: f.invoiceUrl,
    criado_em: f.criadoEm.toISOString(),
    atualizado_em: agora.toISOString(),
  };
  await prisma.registroSync.upsert({
    where: {
      usuarioId_tipo_registroId: {
        usuarioId: f.usuarioId,
        tipo: 'filiacoes',
        registroId: f.id,
      },
    },
    create: {
      usuarioId: f.usuarioId,
      tipo: 'filiacoes',
      registroId: f.id,
      dados: JSON.stringify(dados),
      atualizadoEm: agora,
      removido: false,
    },
    update: { dados: JSON.stringify(dados), atualizadoEm: agora, removido: false },
  });
}

/** YYYY-MM-DD (UTC) para as colunas de data do acervo (DataISO do app). */
function dataISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Deixa o CERTIFICADO de filiação anexado ao ACERVO de documentos do usuário:
 * cria um documento `FILIACAO_CLUBE` + o PDF do certificado, via o mesmo pipeline
 * de sync do acervo (RegistroSync 'documentos'/'arquivos' + ArquivoSync bytes).
 * O app baixa o PDF no próximo pull — nenhuma mudança no app é necessária.
 *
 * Idempotente: ids determinísticos por filiação; só gera/regenera o PDF quando
 * pedido (ativação/renovação) ou quando o arquivo ainda não existe. Só roda para
 * filiação ATIVA e vigente com número atribuído.
 *
 * COMPAT: 'documentos'/'arquivos' são tipos de sync que o app JÁ entende e
 * `FILIACAO_CLUBE` é um tipo de documento JÁ existente — não quebra apps antigos.
 */
export async function garantirCertificadoNoAcervo(
  f: FiliacaoLiga,
  opcoes: { regenerar?: boolean } = {}
): Promise<void> {
  if (f.status !== 'ativa' || !f.numeroFiliacao || f.vigenteAte.getTime() <= Date.now()) return;

  const docId = `filiacao-doc-${f.id}`;
  const fileId = `filiacao-cert-${f.id}`;
  const agora = new Date();

  const [arquivoExiste, config] = await Promise.all([
    prisma.registroSync.findUnique({
      where: { usuarioId_tipo_registroId: { usuarioId: f.usuarioId, tipo: 'arquivos', registroId: fileId } },
    }),
    resolverConfigFiliacao(),
  ]);

  // Gera/atualiza o PDF do certificado quando preciso (ativação/renovação ou
  // primeira vez). O conteúdo embute a validade, então renovar deve regenerar.
  if (opcoes.regenerar || !arquivoExiste) {
    const pdf = await gerarPdfCertificadoFiliacao(f, config);
    const conteudo = new Uint8Array(pdf.byteLength);
    conteudo.set(pdf);

    await prisma.arquivoSync.upsert({
      where: { usuarioId_registroId: { usuarioId: f.usuarioId, registroId: fileId } },
      create: { usuarioId: f.usuarioId, registroId: fileId, mime: 'application/pdf', tamanho: conteudo.length, conteudo },
      update: { mime: 'application/pdf', tamanho: conteudo.length, conteudo },
    });

    const dadosArquivo = {
      id: fileId,
      documento_id: docId,
      nome: 'certificado-filiacao.pdf',
      uri: '',
      mime: 'application/pdf',
      tamanho: conteudo.length,
      criado_em: f.criadoEm.toISOString(),
    };
    await prisma.registroSync.upsert({
      where: { usuarioId_tipo_registroId: { usuarioId: f.usuarioId, tipo: 'arquivos', registroId: fileId } },
      create: { usuarioId: f.usuarioId, tipo: 'arquivos', registroId: fileId, dados: JSON.stringify(dadosArquivo), atualizadoEm: agora, removido: false },
      update: { dados: JSON.stringify(dadosArquivo), atualizadoEm: agora, removido: false },
    });
  }

  // Documento do acervo (sempre atualiza a validade vigente). As chaves são
  // EXATAMENTE as colunas da tabela `documentos` do app.
  const nomeLiga = (config.nomeLiga ?? '').trim();
  const dadosDoc = {
    id: docId,
    tipo: 'FILIACAO_CLUBE',
    arma_id: null,
    titulo: nomeLiga ? `Filiação — ${nomeLiga}` : 'Certificado de Filiação',
    numero: f.numeroFiliacao,
    orgao: 'CLUBE',
    data_emissao: dataISO(f.criadoEm),
    data_validade: dataISO(f.vigenteAte),
    origem: null,
    destino: null,
    local_manejo: null,
    observacoes: 'Certificado de filiação à liga (gerado automaticamente).',
    criado_em: f.criadoEm.toISOString(),
    atualizado_em: agora.toISOString(),
  };
  await prisma.registroSync.upsert({
    where: { usuarioId_tipo_registroId: { usuarioId: f.usuarioId, tipo: 'documentos', registroId: docId } },
    create: { usuarioId: f.usuarioId, tipo: 'documentos', registroId: docId, dados: JSON.stringify(dadosDoc), atualizadoEm: agora, removido: false },
    update: { dados: JSON.stringify(dadosDoc), atualizadoEm: agora, removido: false },
  });
}

/** Tombstone da filiação no sync (some do app no próximo pull). */
export async function removerFiliacaoDoSync(usuarioId: string, id: string): Promise<void> {
  const agora = new Date();
  await prisma.registroSync.upsert({
    where: { usuarioId_tipo_registroId: { usuarioId, tipo: 'filiacoes', registroId: id } },
    create: {
      usuarioId,
      tipo: 'filiacoes',
      registroId: id,
      dados: '{}',
      atualizadoEm: agora,
      removido: true,
    },
    update: { dados: '{}', atualizadoEm: agora, removido: true },
  });
}
