import type { FastifyInstance } from 'fastify';
import QRCode from 'qrcode';
import { prisma } from '../db/cliente.js';
import { ambiente } from '../config/ambiente.js';
import { resolverConfigFiliacao } from '../dominio/filiacaoConfig.js';
import { htmlCertificadoFiliacao, mascararCpf } from '../dominio/certificadoFiliacao.js';

/** URL pública (backoffice) da página de verificação de uma filiação. */
function urlVerificacao(numero: string): string {
  const base = (ambiente.backofficeOrigem || 'https://carteiracac.com').replace(/\/$/, '');
  return `${base}/filiacao/${encodeURIComponent(numero)}`;
}

/** Uma filiação é válida se está ativa e dentro da vigência. */
function ehValida(status: string, vigenteAte: Date): boolean {
  return status === 'ativa' && vigenteAte.getTime() > Date.now();
}

/**
 * Rotas PÚBLICAS de verificação da filiação — sem auth. Destino do QR do
 * certificado: qualquer pessoa (clube, PF) confere a autenticidade pelo número.
 */
export async function rotasPublicoFiliacao(app: FastifyInstance) {
  // Verificação em JSON (consumida pela página pública do backoffice).
  app.get('/filiacao/verificar/:numero', async (req) => {
    const { numero } = req.params as { numero: string };
    const [filiacao, config] = await Promise.all([
      prisma.filiacaoLiga.findUnique({ where: { numeroFiliacao: numero } }),
      resolverConfigFiliacao(),
    ]);
    if (!filiacao) {
      return { valido: false, nomeLiga: config.nomeLiga };
    }
    return {
      valido: ehValida(filiacao.status, filiacao.vigenteAte),
      numeroFiliacao: filiacao.numeroFiliacao,
      nome: filiacao.nomeCompleto,
      cpf: mascararCpf(filiacao.cpf),
      status: filiacao.status,
      vigenteAte: filiacao.vigenteAte.toISOString(),
      nomeLiga: config.nomeLiga,
    };
  });

  // Certificado imprimível (HTML A4). Público para abrir no navegador do app.
  app.get('/filiacao/certificado/:numero', async (req, reply) => {
    const { numero } = req.params as { numero: string };
    const [filiacao, config] = await Promise.all([
      prisma.filiacaoLiga.findUnique({ where: { numeroFiliacao: numero } }),
      resolverConfigFiliacao(),
    ]);
    if (!filiacao) {
      reply.code(404).type('text/html; charset=utf-8');
      return '<!doctype html><meta charset="utf-8"><p>Filiação não encontrada.</p>';
    }
    const url = urlVerificacao(numero);
    const qrDataUrl = await QRCode.toDataURL(url, { margin: 1, width: 240 });
    reply.type('text/html; charset=utf-8');
    return htmlCertificadoFiliacao({ filiacao, config, qrDataUrl, urlVerificacao: url });
  });
}
