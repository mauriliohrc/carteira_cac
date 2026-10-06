import 'dotenv/config';

function obrigatorio(chave: string, valorPadrao?: string): string {
  const v = process.env[chave] ?? valorPadrao;
  if (v == null || v === '') {
    throw new Error(`Variável de ambiente ausente: ${chave}`);
  }
  return v;
}

export const ambiente = {
  porta: Number(process.env.PORTA ?? 3333),
  backofficeOrigem: process.env.BACKOFFICE_ORIGEM ?? 'http://localhost:3000',
  producao: process.env.NODE_ENV === 'production',
  jwt: {
    segredoAdmin: obrigatorio('JWT_SEGREDO_ADMIN', 'dev-segredo-admin'),
    segredoEntidade: obrigatorio('JWT_SEGREDO_ENTIDADE', 'dev-segredo-entidade'),
    segredoApp: obrigatorio('JWT_SEGREDO_APP', 'dev-segredo-app'),
    expiracao: process.env.JWT_EXPIRACAO ?? '12h',
    /** Sessão do usuário do app dura bem mais que a do backoffice. */
    expiracaoApp: process.env.JWT_EXPIRACAO_APP ?? '60d',
  },
  /**
   * SMTP para e-mails transacionais (verificação de conta, reset de senha).
   * Em produção usa o servidor da Hostinger; se faltar `MAIL_USER`/`MAIL_PASS`,
   * o envio fica desligado e o código é só logado (útil em dev).
   */
  mail: {
    host: process.env.MAIL_HOST ?? 'smtp.hostinger.com',
    porta: Number(process.env.MAIL_PORT ?? 465),
    usuario: process.env.MAIL_USER ?? '',
    senha: process.env.MAIL_PASS ?? '',
    remetente: process.env.MAIL_FROM ?? 'Carteira CAC <contato@carteiracac.com>',
    get ativo(): boolean {
      return Boolean(this.usuario && this.senha);
    },
  },
} as const;
