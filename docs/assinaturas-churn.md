# Assinaturas & Churn (Apple)

Controle de ciclo de vida das assinaturas Premium da App Store: o Premium pago
passa a ser **verdade no servidor** (derivado das notificações da Apple e da App
Store Server API), com histórico de churn e ações de reconquista no backoffice.
Premium por **cupom** continua controlado pelo app e não é tocado aqui.

> Escopo atual: **Apple**. Google Play (RTDN) fica para uma 2ª etapa.

## Como funciona

- **Webhook** `POST /webhooks/apple` recebe as App Store Server Notifications V2.
  A autenticidade vem da **assinatura JWS da Apple** (verificada contra os roots
  embutidos em `src/integracoes/appleAssinatura.ts`), não de um token. Produção e
  sandbox chegam na mesma URL.
- Cada evento atualiza `AssinaturaApp` (status/datas/motivo), grava
  `EventoAssinatura` (auditoria + idempotência por `notificationUUID`) e
  **reconcilia** `UsuarioApp.premium` (sem mexer em quem é CUPOM).
- **Atribuição conta↔assinatura** (3 mecanismos):
  1. `appAccountToken` — o app envia um UUID da conta na compra; a Apple o devolve
     na notificação (atribuição automática). `GET /api/v1/app/assinatura/preparar`.
  2. App **reporta** a assinatura ativa: `POST /api/v1/app/assinatura/vincular`
     (resolve o `originalTransactionId` pela Server API). Cobre quem já assinava.
  3. Notificação **órfã** (sem conta) fica guardada e é re-vinculada quando (1)/(2)
     acontecem.
- **Rede de segurança** (`dominio/assinaturaCron.ts`): a cada 6h expira no banco
  as assinaturas vencidas há +72h sem notificação, rebaixando o premium.
- **Backfill** retroativo: `scripts/backfill-assinaturas.ts` (reconsulta a Server
  API). Útil logo após ligar a integração.

## Backoffice

- Menu **Outro › Churn** (`/churn`): quem cancelou/expirou, quando e por quê, com
  as mesmas colunas de usuário das demais telas. Filtros (em risco / perdidos /
  win-back), export CSV, e ações de reconquista por linha:
  - **Parceiro**: libera a oferta Premium Parceiro (R$49,90) mesmo sem vínculo.
  - **Cupom**: gera um cupom de reconquista (1 uso).
  - **Push / WhatsApp**: dispara mensagem de volta.
  - **↻**: reconsulta o status atual na Apple (requer a Server API ligada).
- Dashboard: cards "Cancelaram renovação" e "Churn (30d)".

## Configuração (App Store Connect)

1. **App Store Server Notifications V2**
   App Store Connect › seu app › **App Information** › *App Store Server
   Notifications* → defina a **Production URL** e a **Sandbox URL** como:
   `https://api.carteiracac.com/webhooks/apple` (versão **V2**).
2. **App Store Server API Key**
   Users and Access › **Integrations** › *In-App Purchase* › gerar chave.
   Guarde o **Key ID**, o **Issuer ID** e o arquivo **.p8**.
3. Preencha no `.env` do servidor: `APPLE_BUNDLE_ID`, `APPLE_APP_APPLE_ID`,
   `APPLE_ASC_KEY_ID`, `APPLE_ASC_ISSUER_ID`, `APPLE_ASC_PRIVATE_KEY`,
   `APPLE_AMBIENTE` (ver `.env.example`).

## Deploy

```sh
# 1) Migração no MySQL de produção (via túnel SSH; usar deploy, nunca dev)
cd servidor
npx prisma migrate deploy

# 2) Subir API + backoffice (rsync Mac → servidor) e reiniciar
#    (node/pm2 em /home/app/.local/node/bin — prefixe o PATH)
#    Lembrar de levar node_modules (a lib @apple/app-store-server-library é nova).
#    Backoffice: excluir .env* no rsync (NEXT_PUBLIC é assado em build time).
pm2 restart cac-api

# 3) (opcional) Backfill retroativo do churn já existente
npx tsx scripts/backfill-assinaturas.ts
```

A **Fase 2** (atribuição no app) exige um novo **build local do app** (iOS) e
release — `appAccountToken` na compra e report da assinatura ativa.

## Android (Google Play RTDN) — espelho do churn Apple

O churn Android usa as **Real-time Developer Notifications (RTDN)** entregues via
**Pub/Sub** e a **Android Publisher API**. O desenho reaproveita 100% do domínio
da Apple: a RTDN só traz o `purchaseToken`; o **estado atual** é lido de
`purchases.subscriptionsv2.get` e **mapeado para os mesmos fatos** que
`derivarEstado` entende (`src/integracoes/googlePlay.ts`). O `aplicarEventoAssinatura`
grava em `AssinaturaApp` (`plataforma: 'ANDROID'`), reconcilia o premium e alimenta
a timeline — igual ao iOS.

- **Webhook** `POST /webhooks/google?token=…` (`src/rotas/webhookGoogle.ts`). Como
  o push do Pub/Sub **não é assinado**, exige o segredo `GOOGLE_PUBSUB_TOKEN` na
  query. Chave estável = o **purchaseToken** (usado como `originalTransactionId`).
- **Atribuição conta↔assinatura**:
  1. `obfuscatedAccountId` — o app envia o UUID da conta (o mesmo `appAccountToken`)
     na compra; o Google o devolve como `obfuscatedExternalAccountId`.
  2. App **reporta**: `POST /api/v1/app/assinatura/vincular-google` com o
     `purchaseToken` (cobre quem assinou antes do obfuscatedAccountId).
- **Rede de segurança**: o cron `expirarVencidas` é plataforma-agnóstico — varre
  também assinaturas Android vencidas sem notificação.

### Configuração (Google)

1. **Service Account** (Google Cloud) com a **Android Publisher API** habilitada;
   conceda acesso ao app na **Play Console** (Usuários e permissões → papel com
   "Ver dados financeiros / Gerenciar pedidos e assinaturas").
2. **Pub/Sub**: crie um **tópico**, dê ao service agent do Google Play
   (`google-play-developer-notifications@system.gserviceaccount.com`) o papel
   **Publisher** nele, e uma **subscription push** apontando para
   `https://api.carteiracac.com/webhooks/google?token=<GOOGLE_PUBSUB_TOKEN>`.
3. **Play Console → Monetização → Monetization setup**: cole o nome do tópico em
   *Real-time developer notifications* e use **Enviar notificação de teste**.
4. Preencha o `.env`: `GOOGLE_PACKAGE_NAME`, `GOOGLE_SA_CLIENT_EMAIL`,
   `GOOGLE_SA_PRIVATE_KEY`, `GOOGLE_PUBSUB_TOKEN` (ver `.env.example`).

A atribuição no app (obfuscatedAccountId + report) exige um novo **build local do
app Android** e release.

## Timeline de ações do usuário (backoffice)

Histórico por usuário (`EventoUsuario` → aba no `/usuarios/[id]`), alimentado de
forma **aditiva e best-effort** (nunca quebra o fluxo nem apps antigos):

- **Criou conta** — no cadastro (`appAuth`).
- **Tentou assinar** — o app chama `POST /app/assinatura/tentativa` ao abrir o
  checkout da loja (apps antigos não chamam → só não registram esse evento).
- **Assinou / Cancelou / Expirou / Reembolsado** — derivados da TRANSIÇÃO de
  status em `aplicarEventoAssinatura` (iOS **e** Android convergem ali).
- **Cadastrou / Editou / Removeu documento (e arma)** — derivados do `sync/push`
  (cria/edita/remove por transição real, sem repetir em re-push idêntico).

