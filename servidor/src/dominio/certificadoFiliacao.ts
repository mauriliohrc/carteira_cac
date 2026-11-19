import type { FiliacaoLiga } from '@prisma/client';
import type { ConfigFiliacaoResolvida } from './filiacaoConfig.js';

/** CPF mascarado para exibição pública: 123.456.789-00 → ***.456.789-**. */
export function mascararCpf(cpf: string): string {
  const d = (cpf || '').replace(/\D/g, '').padStart(11, '•');
  return `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**`;
}

function dataBR(iso: Date): string {
  const d = iso;
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(
    2,
    '0'
  )}/${d.getUTCFullYear()}`;
}

/**
 * HTML do certificado/declaração de filiação — página A4 imprimível (o usuário
 * salva como PDF pelo navegador). Traz a identidade da liga (nome + logo
 * configuráveis), os dados do filiado, o número de registro e um QR que leva à
 * página pública de verificação. A "assinatura" é a verificabilidade: o QR/nº
 * conferem a autenticidade na página pública.
 */
export function htmlCertificadoFiliacao(opcoes: {
  filiacao: FiliacaoLiga;
  config: ConfigFiliacaoResolvida;
  qrDataUrl: string;
  urlVerificacao: string;
}): string {
  const { filiacao: f, config, qrDataUrl, urlVerificacao } = opcoes;
  const logo = config.logoUrl
    ? `<img class="logo" src="${config.logoUrl}" alt="${config.nomeLiga}" />`
    : '';
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Certificado de Filiação — ${f.numeroFiliacao ?? ''}</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin: 0; background: #e9edf2; font-family: Georgia, 'Times New Roman', serif; color: #1a2230; }
  .folha { width: 210mm; min-height: 297mm; margin: 16px auto; background: #fff; padding: 28mm 24mm; box-shadow: 0 2px 16px rgba(0,0,0,.15); border: 6px double #16351f; }
  .topo { text-align: center; border-bottom: 2px solid #16351f; padding-bottom: 16px; margin-bottom: 28px; }
  .logo { max-height: 88px; max-width: 220px; object-fit: contain; margin-bottom: 10px; }
  .liga { font-size: 22px; font-weight: bold; letter-spacing: .5px; color: #16351f; margin: 4px 0; }
  h1 { font-size: 26px; text-align: center; letter-spacing: 3px; text-transform: uppercase; margin: 24px 0; }
  .corpo { font-size: 15px; line-height: 1.9; text-align: justify; }
  .nome { font-size: 20px; font-weight: bold; text-align: center; margin: 18px 0 6px; }
  .cpf { text-align: center; color: #5a6675; margin-bottom: 18px; }
  .dados { display: flex; justify-content: space-between; gap: 16px; margin: 28px 0; font-size: 14px; }
  .dados div b { display: block; color: #16351f; letter-spacing: .5px; text-transform: uppercase; font-size: 11px; }
  .rodape { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 44px; gap: 24px; }
  .verif { font-size: 11px; color: #5a6675; max-width: 60%; }
  .verif a { color: #16351f; word-break: break-all; }
  .qr { width: 118px; height: 118px; }
  @media print { body { background: #fff; } .folha { margin: 0; box-shadow: none; } }
</style>
</head>
<body>
  <div class="folha">
    <div class="topo">
      ${logo}
      <div class="liga">${config.nomeLiga}</div>
    </div>
    <h1>Certificado de Filiação</h1>
    <div class="nome">${f.nomeCompleto}</div>
    <div class="cpf">CPF ${mascararCpf(f.cpf)}</div>
    <div class="corpo">
      Certificamos que o(a) atleta acima é <b>filiado(a)</b> a esta entidade esportiva,
      estando apto(a) a participar de competições de tiro esportivo de nível nacional,
      com reconhecimento perante a Polícia Federal nos termos da legislação vigente.
      A presente filiação garante <b>vínculo associativo de 1 (um) ano</b> e dá direito à
      assessoria jurídica da liga durante a sua vigência.
    </div>
    <div class="dados">
      <div><b>Nº de Registro</b>${f.numeroFiliacao ?? '—'}</div>
      <div><b>Situação</b>${f.status === 'ativa' ? 'ATIVA' : f.status.toUpperCase()}</div>
      <div><b>Válido até</b>${dataBR(f.vigenteAte)}</div>
    </div>
    <div class="rodape">
      <div class="verif">
        Documento verificável. Aponte a câmera para o QR Code ou acesse:<br />
        <a href="${urlVerificacao}">${urlVerificacao}</a>
      </div>
      <img class="qr" src="${qrDataUrl}" alt="QR de verificação" />
    </div>
  </div>
</body>
</html>`;
}
