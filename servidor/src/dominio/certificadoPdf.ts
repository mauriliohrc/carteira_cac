import type { FiliacaoLiga } from '@prisma/client';
import { PDFDocument, StandardFonts, rgb, type PDFFont } from 'pdf-lib';
import QRCode from 'qrcode';
import { ambiente } from '../config/ambiente.js';
import type { ConfigFiliacaoResolvida } from './filiacaoConfig.js';

/**
 * Gera o PDF (A4) do certificado de filiação para anexar ao acervo do usuário.
 * É o mesmo conteúdo do certificado HTML público (verificável por QR na página
 * da liga) — a "assinatura" é a verificabilidade, não uma assinatura ICP-Brasil.
 *
 * Puro JS (pdf-lib + qrcode), sem browser/headless — roda leve no servidor.
 */

const VERDE = rgb(0.086, 0.208, 0.122); // #16351f (mesma cor do certificado HTML)
const CINZA = rgb(0.353, 0.4, 0.459);
const PRETO = rgb(0.102, 0.133, 0.188);

function dataBR(d: Date): string {
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
}

function cpfFormatado(cpf: string): string {
  const d = (cpf || '').replace(/\D/g, '');
  if (d.length !== 11) return cpf;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

function urlVerificacao(numero: string): string {
  const base = (ambiente.backofficeOrigem || 'https://carteiracac.com').replace(/\/$/, '');
  return `${base}/filiacao/${encodeURIComponent(numero)}`;
}

/** Quebra o texto em linhas que cabem em `largura` (pt) para a fonte/tamanho. */
function quebrarLinhas(texto: string, fonte: PDFFont, tamanho: number, largura: number): string[] {
  const palavras = texto.split(/\s+/);
  const linhas: string[] = [];
  let atual = '';
  for (const p of palavras) {
    const tentativa = atual ? `${atual} ${p}` : p;
    if (fonte.widthOfTextAtSize(tentativa, tamanho) > largura && atual) {
      linhas.push(atual);
      atual = p;
    } else {
      atual = tentativa;
    }
  }
  if (atual) linhas.push(atual);
  return linhas;
}

export async function gerarPdfCertificadoFiliacao(
  filiacao: FiliacaoLiga,
  config: ConfigFiliacaoResolvida
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const pagina = doc.addPage([595.28, 841.89]); // A4 retrato
  const { width, height } = pagina.getSize();
  const fonte = await doc.embedFont(StandardFonts.TimesRoman);
  const fonteBold = await doc.embedFont(StandardFonts.TimesRomanBold);

  const margem = 56;
  const larguraUtil = width - margem * 2;

  // Moldura dupla (igual ao certificado HTML).
  pagina.drawRectangle({ x: 24, y: 24, width: width - 48, height: height - 48, borderColor: VERDE, borderWidth: 3 });
  pagina.drawRectangle({ x: 30, y: 30, width: width - 60, height: height - 60, borderColor: VERDE, borderWidth: 1 });

  const centro = (txt: string, y: number, f: PDFFont, tam: number, cor = PRETO) => {
    const w = f.widthOfTextAtSize(txt, tam);
    pagina.drawText(txt, { x: (width - w) / 2, y, size: tam, font: f, color: cor });
  };

  let y = height - 110;

  // Topo: nome da liga.
  centro((config.nomeLiga || 'Liga').toUpperCase(), y, fonteBold, 18, VERDE);
  y -= 16;
  pagina.drawLine({ start: { x: margem, y }, end: { x: width - margem, y }, thickness: 1.5, color: VERDE });

  // Título.
  y -= 60;
  centro('CERTIFICADO DE FILIAÇÃO', y, fonteBold, 22, PRETO);

  // Nome + CPF.
  y -= 54;
  centro(filiacao.nomeCompleto, y, fonteBold, 18, PRETO);
  y -= 22;
  centro(`CPF ${cpfFormatado(filiacao.cpf)}`, y, fonte, 12, CINZA);

  // Corpo.
  y -= 46;
  const corpo =
    'Certificamos que o(a) atleta acima é filiado(a) a esta entidade esportiva, estando ' +
    'apto(a) a participar de competições de tiro esportivo de nível nacional, com reconhecimento ' +
    'perante a Polícia Federal nos termos da legislação vigente. A presente filiação garante ' +
    'vínculo associativo de 1 (um) ano e dá direito à assessoria jurídica da liga durante a sua vigência.';
  for (const linha of quebrarLinhas(corpo, fonte, 13, larguraUtil)) {
    pagina.drawText(linha, { x: margem, y, size: 13, font: fonte, color: PRETO });
    y -= 20;
  }

  // Dados em três colunas.
  y -= 24;
  const col = larguraUtil / 3;
  const campo = (rotulo: string, valor: string, x: number) => {
    pagina.drawText(rotulo.toUpperCase(), { x, y, size: 9, font: fonteBold, color: VERDE });
    pagina.drawText(valor, { x, y: y - 16, size: 13, font: fonte, color: PRETO });
  };
  campo('Nº de Registro', filiacao.numeroFiliacao ?? '—', margem);
  campo('Situação', filiacao.status === 'ativa' ? 'ATIVA' : filiacao.status.toUpperCase(), margem + col);
  campo('Válido até', dataBR(filiacao.vigenteAte), margem + col * 2);

  // QR de verificação + texto.
  if (filiacao.numeroFiliacao) {
    const url = urlVerificacao(filiacao.numeroFiliacao);
    const qrPng = await QRCode.toBuffer(url, { margin: 1, width: 240, type: 'png' });
    const qrImg = await doc.embedPng(qrPng);
    const qrLado = 110;
    const qrX = width - margem - qrLado;
    const qrY = 70;
    pagina.drawImage(qrImg, { x: qrX, y: qrY, width: qrLado, height: qrLado });

    const texto = 'Documento verificável. Aponte a câmera para o QR Code ou acesse:';
    let ty = qrY + qrLado - 14;
    for (const linha of quebrarLinhas(texto, fonte, 10, larguraUtil - qrLado - 20)) {
      pagina.drawText(linha, { x: margem, y: ty, size: 10, font: fonte, color: CINZA });
      ty -= 14;
    }
    pagina.drawText(url, { x: margem, y: ty, size: 9, font: fonteBold, color: VERDE });
  }

  return doc.save();
}
