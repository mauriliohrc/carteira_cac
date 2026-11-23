import 'dotenv/config';

function obrigatorio(chave: string, valorPadrao?: string): string {
  const v = process.env[chave] ?? valorPadrao;
  if (v == null || v === '') {
    throw new Error(`Variável de ambiente ausente: ${chave}`);
  }
  return v;
}

/**
 * Segredo de produção com fail-closed: em produção NUNCA cai no default — se a
 * env estiver ausente, o servidor se recusa a subir. Em dev, aceita o default
 * só por conveniência local. Evita assinar/verificar JWT (ou autenticar webhooks)
 * com um segredo público versionado no repositório caso a env suma num deploy.
 */
function segredoProducao(chave: string, padraoDev: string): string {
  const v = process.env[chave];
  if (v != null && v !== '') return v;
  if (process.env.NODE_ENV === 'production') {
    throw new Error(`Segredo de produção ausente (obrigatório): ${chave}`);
  }
  return padraoDev;
}

export const ambiente = {
  porta: Number(process.env.PORTA ?? 3333),
  backofficeOrigem: process.env.BACKOFFICE_ORIGEM ?? 'http://localhost:3000',
  producao: process.env.NODE_ENV === 'production',
  /**
   * URL pública da API (ex.: https://api.carteiracac.com). Usada para montar o
   * link absoluto dos uploads (banners). Vazio = deriva do próprio request.
   */
  apiPublicaUrl: (process.env.API_PUBLICA_URL ?? '').replace(/\/$/, ''),
  jwt: {
    segredoAdmin: segredoProducao('JWT_SEGREDO_ADMIN', 'dev-segredo-admin'),
    segredoEntidade: segredoProducao('JWT_SEGREDO_ENTIDADE', 'dev-segredo-entidade'),
    segredoApp: segredoProducao('JWT_SEGREDO_APP', 'dev-segredo-app'),
    expiracao: process.env.JWT_EXPIRACAO ?? '12h',
    /** Sessão do usuário do app dura bem mais que a do backoffice. */
    expiracaoApp: process.env.JWT_EXPIRACAO_APP ?? '60d',
  },
  /**
   * Chave mestra para cifrar segredos sensíveis em repouso (senha gov.br, chave
   * do Asaas, senha de parceiro Shooting House). 32 bytes em hex (64 chars) ou
   * base64. Gere com `openssl rand -hex 32`. Fail-closed em produção: sem a
   * chave o servidor não sobe (dados cifrados ficariam ilegíveis).
   */
  cripto: {
    chave: segredoProducao('APP_CRYPTO_KEY', 'dev-chave-cripto-insegura-troque-em-producao'),
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
  /**
   * WhatsApp (Baileys) para campanhas de relacionamento do backoffice.
   * `authDir` guarda as credenciais da sessão (useMultiFileAuthState). Precisa
   * persistir no servidor de produção para não pedir QR a cada restart; por isso
   * fica fora do dist e é ignorado no git (.whatsapp-auth/).
   */
  whatsapp: {
    authDir: process.env.WHATS_AUTH_DIR ?? '.whatsapp-auth',
  },
  /**
   * Asaas — gateway de pagamento dos serviços do Despachante (Renovação de CRAF,
   * Emissão de Guias). Cobrança via checkout hospedado (PIX/cartão), confirmada
   * por webhook. Default aponta para o SANDBOX; produção define ASAAS_BASE_URL
   * como https://api.asaas.com/v3. Sem ASAAS_API_KEY o módulo fica inativo.
   * ASAAS_WEBHOOK_TOKEN é o token compartilhado que o Asaas envia no header
   * `asaas-access-token` de cada webhook (configurado no painel do Asaas).
   */
  asaas: {
    baseUrl: (process.env.ASAAS_BASE_URL ?? 'https://api-sandbox.asaas.com/v3').replace(/\/$/, ''),
    apiKey: process.env.ASAAS_API_KEY ?? '',
    webhookToken: process.env.ASAAS_WEBHOOK_TOKEN ?? '',
    get ativo(): boolean {
      return Boolean(this.apiKey);
    },
  },
  /**
   * Apple — App Store Server Notifications V2 (webhook de assinaturas) e App
   * Store Server API (consulta de status / backfill de churn).
   *
   * - `bundleId`: identificador do app (ex.: com.carteiracac.app).
   * - `appAppleId`: o "Apple ID" numérico do app no App Store Connect (necessário
   *   só para o cliente da App Store Server API em produção).
   * - Credenciais da API (chave privada .p8 gerada em Users and Access › Keys ›
   *   In-App Purchase): `keyId`, `issuerId` e `privateKey` (conteúdo do .p8, com
   *   as quebras de linha — aceitamos `\n` escapado no .env).
   * - `ambiente`: Production | Sandbox — decide a URL da API e o root esperado.
   *
   * Sem as credenciais da API, o webhook ainda funciona (verifica a assinatura e
   * registra churn); só o backfill/consulta sob demanda ficam desligados.
   */
  apple: {
    bundleId: process.env.APPLE_BUNDLE_ID ?? '',
    appAppleId: process.env.APPLE_APP_APPLE_ID ?? '',
    keyId: process.env.APPLE_ASC_KEY_ID ?? '',
    issuerId: process.env.APPLE_ASC_ISSUER_ID ?? '',
    privateKey: (process.env.APPLE_ASC_PRIVATE_KEY ?? '').replace(/\\n/g, '\n'),
    ambiente: (process.env.APPLE_AMBIENTE ?? 'Production') as 'Production' | 'Sandbox',
    /** Webhook ligado quando o bundleId está configurado. */
    get webhookAtivo(): boolean {
      return Boolean(this.bundleId);
    },
    /** Cliente da App Store Server API disponível (consulta/backfill). */
    get apiAtiva(): boolean {
      return Boolean(this.bundleId && this.keyId && this.issuerId && this.privateKey);
    },
  },

  /**
   * Google Play — Real-time Developer Notifications (RTDN, via Pub/Sub) e Android
   * Publisher API (consulta de assinaturas) para o churn Android, espelhando a
   * Apple. A RTDN só traz o `purchaseToken`; o estado atual vem da API, lida com
   * a Service Account (JSON de chave → clientEmail + privateKey).
   *
   * - `packageName`: applicationId do app Android (ex.: br.com.cacbrasil.carteira).
   * - `clientEmail` / `privateKey`: da Service Account com acesso ao app na Play
   *   Console (papel "Ver dados financeiros / Gerenciar pedidos").
   * - `pubsubToken`: segredo compartilhado exigido na query do webhook
   *   (`/webhooks/google?token=…`), já que o push do Pub/Sub não é assinado.
   */
  google: {
    packageName: process.env.GOOGLE_PACKAGE_NAME ?? '',
    clientEmail: process.env.GOOGLE_SA_CLIENT_EMAIL ?? '',
    privateKey: (process.env.GOOGLE_SA_PRIVATE_KEY ?? '').replace(/\\n/g, '\n'),
    pubsubToken: process.env.GOOGLE_PUBSUB_TOKEN ?? '',
    /** Webhook/consulta ligados quando há pacote + credenciais da Service Account. */
    get apiAtiva(): boolean {
      return Boolean(this.packageName && this.clientEmail && this.privateKey);
    },
  },
} as const;
