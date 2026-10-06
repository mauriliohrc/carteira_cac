// Envio de e-mails transacionais via SMTP (Hostinger).
//
// Um único transporte é reaproveitado no processo. Se o SMTP não estiver
// configurado (sem MAIL_USER/MAIL_PASS), o envio é um no-op que apenas loga —
// assim o fluxo não quebra em desenvolvimento, e as rotas devolvem o código no
// corpo só fora de produção.
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import nodemailer, { type Transporter } from 'nodemailer';
import { ambiente } from '../config/ambiente.js';

let transporte: Transporter | null = null;

function obterTransporte(): Transporter | null {
  if (!ambiente.mail.ativo) return null;
  if (!transporte) {
    transporte = nodemailer.createTransport({
      host: ambiente.mail.host,
      port: ambiente.mail.porta,
      secure: ambiente.mail.porta === 465, // 465 = SSL; 587 = STARTTLS
      auth: { user: ambiente.mail.usuario, pass: ambiente.mail.senha },
    });
  }
  return transporte;
}

// Logo embutido via CID (mais confiável que data:/URL remota). Fica em
// servidor/assets/logo-email.png; se faltar, o wordmark carrega a marca.
const CID_LOGO = 'logocac';
const CAMINHO_LOGO = resolve(dirname(fileURLToPath(import.meta.url)), '../../assets/logo-email.png');
const TEM_LOGO = existsSync(CAMINHO_LOGO);

export interface Email {
  para: string;
  assunto: string;
  html: string;
  texto: string;
}

/**
 * Envia o e-mail. Devolve `true` se foi entregue ao SMTP; `false` se o envio
 * está desligado (sem infra) — nesse caso o chamador decide o fallback.
 */
export async function enviarEmail(email: Email): Promise<boolean> {
  const t = obterTransporte();
  if (!t) return false;
  await t.sendMail({
    from: ambiente.mail.remetente,
    to: email.para,
    subject: email.assunto,
    text: email.texto,
    html: email.html,
    attachments: TEM_LOGO
      ? [{ filename: 'carteira-cac.png', path: CAMINHO_LOGO, cid: CID_LOGO }]
      : undefined,
  });
  return true;
}

// --------------------------------------------------------------- templates
// Identidade "manual de campo": verde-oliva e latão sobre grafite.
const COR = {
  grafite: '#101310',
  superficie: '#171B16',
  caixa: '#1F241D',
  borda: '#2A3027',
  oliva: '#93AD65',
  olivaForte: '#AEC585',
  latao: '#C9A227',
  texto: '#E7EAE1',
  textoMedio: '#A9B09E',
  textoFraco: '#79806F',
} as const;

function cabecalhoMarca(): string {
  const logo = TEM_LOGO
    ? `<img src="cid:${CID_LOGO}" width="56" height="56" alt="Carteira CAC"
         style="display:block;margin:0 auto 10px;border-radius:12px" />`
    : '';
  return `${logo}
    <div style="text-align:center;font-size:13px;font-weight:700;letter-spacing:3px;
                text-transform:uppercase;color:${COR.oliva}">Carteira CAC</div>
    <div style="height:2px;width:40px;background:${COR.latao};margin:12px auto 0;border-radius:2px"></div>`;
}

function moldura(titulo: string, corpo: string): string {
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${COR.grafite};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COR.grafite};">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
             style="max-width:460px;background:${COR.superficie};border:1px solid ${COR.borda};
                    border-radius:16px;overflow:hidden;
                    font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
        <tr><td style="padding:28px 28px 20px;border-bottom:1px solid ${COR.borda};">
          ${cabecalhoMarca()}
        </td></tr>
        <tr><td style="padding:26px 28px 30px;">
          <h1 style="margin:0 0 10px;font-size:19px;line-height:1.3;color:${COR.texto};">${titulo}</h1>
          ${corpo}
          <p style="font-size:12px;color:${COR.textoFraco};margin:26px 0 0;line-height:1.5;">
            Se você não solicitou isto, ignore este e-mail com segurança. Nunca compartilhe este
            código — a equipe da Carteira CAC jamais vai pedi-lo.
          </p>
        </td></tr>
        <tr><td style="padding:16px 28px;background:${COR.grafite};border-top:1px solid ${COR.borda};">
          <div style="font-size:11px;color:${COR.textoFraco};text-align:center;">
            Carteira CAC · seu acervo de CAC organizado e sempre à mão
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function blocoCodigo(codigo: string): string {
  return `<div style="font-size:34px;font-weight:800;letter-spacing:10px;color:${COR.olivaForte};
              background:${COR.caixa};border:1px solid ${COR.borda};border-radius:12px;
              padding:18px 0;text-align:center;margin:18px 0 6px;">${codigo}</div>`;
}

/** E-mail com o código de 6 dígitos para confirmar a conta. */
export function emailCodigoVerificacao(codigo: string): Omit<Email, 'para'> {
  const html = moldura(
    'Confirme seu e-mail',
    `<p style="font-size:14px;color:${COR.textoMedio};line-height:1.6;margin:0;">
       Use o código abaixo no app para confirmar sua conta e liberar a importação do seu acervo.
       Ele expira em <strong style="color:${COR.texto};">15 minutos</strong>.</p>
     ${blocoCodigo(codigo)}`
  );
  return {
    assunto: `${codigo} é o seu código de confirmação — Carteira CAC`,
    html,
    texto: `Carteira CAC\n\nSeu código de confirmação é ${codigo}. Ele expira em 15 minutos.\n\nSe você não solicitou, ignore este e-mail.`,
  };
}

/** E-mail com o código para redefinir a senha. */
export function emailResetSenha(codigo: string): Omit<Email, 'para'> {
  const html = moldura(
    'Redefinir sua senha',
    `<p style="font-size:14px;color:${COR.textoMedio};line-height:1.6;margin:0;">
       Use o código abaixo no app para criar uma nova senha. Ele expira em
       <strong style="color:${COR.texto};">1 hora</strong>.</p>
     ${blocoCodigo(codigo)}`
  );
  return {
    assunto: `${codigo} é o seu código para redefinir a senha — Carteira CAC`,
    html,
    texto: `Carteira CAC\n\nSeu código para redefinir a senha é ${codigo}. Ele expira em 1 hora.\n\nSe você não solicitou, ignore este e-mail.`,
  };
}
