# Ativar o Churn Android (Google Play RTDN) — passo a passo

Guia completo para ligar o churn Android que já está no código (webhook
`/webhooks/google`, integração `src/integracoes/googlePlay.ts`). Ao final, o
cancelamento/expiração de assinaturas Android passa a: **contar no dashboard**,
aparecer na tela **Churn** (selo 🤖) e **atualizar o status do usuário** — igual
à Apple.

> Pré-requisitos: ser **Owner/Admin** da conta do app na **Play Console** e ter
> acesso de **Owner/Editor** a um projeto no **Google Cloud**. Idealmente use o
> projeto Google Cloud **vinculado** à Play Console (passo 3), mas pode ser um
> dedicado.

Nomes/valores usados abaixo (ajuste aos seus):
- Package do app: `br.com.cacbrasil.carteira`
- Projeto GCP: `<PROJECT_ID>` (ex.: `carteiracac`)
- Tópico Pub/Sub: `play-rtdn` → nome completo `projects/<PROJECT_ID>/topics/play-rtdn`
- Webhook: `https://api.carteiracac.com/webhooks/google?token=<GOOGLE_PUBSUB_TOKEN>`

---

## 1) Google Cloud — habilitar as APIs

1. Acesse o **Google Cloud Console**: https://console.cloud.google.com
2. No topo, selecione (ou crie) o **projeto** que vai hospedar o Pub/Sub.
3. Menu **APIs e serviços › Biblioteca** (`APIs & Services › Library`):
   https://console.cloud.google.com/apis/library
4. Habilite **duas** APIs (busque pelo nome e clique **Ativar/Enable**):
   - **Google Play Android Developer API**
   - **Cloud Pub/Sub API**

## 2) Google Cloud — criar o tópico Pub/Sub e dar permissão ao Google Play

1. Menu **Pub/Sub › Tópicos** (`Topics`):
   https://console.cloud.google.com/cloudpubsub/topic/list
2. **Criar tópico** → ID do tópico: `play-rtdn` → **Criar**.
   (Pode desmarcar "Adicionar uma assinatura padrão"; criamos a push manualmente.)
3. Dê ao **Google Play** permissão para PUBLICAR nesse tópico:
   - Abra o tópico `play-rtdn` → aba **Permissões** (`Permissions`) → **Adicionar
     principal** (`Add principal`).
   - Novo principal:
     `google-play-developer-notifications@system.gserviceaccount.com`
   - Papel: **Pub/Sub Publisher** (`Editor/Publicador do Pub/Sub`) → **Salvar**.

   > Sem isso, a Play Console recusa salvar o tópico ("não temos permissão para
   > publicar neste tópico").

## 3) Google Cloud — criar a assinatura PUSH para o nosso webhook

> **Verificação de domínio NÃO é necessária** se você ligar a **autenticação
> (OIDC)** na assinatura push (recomendado abaixo). O Google só exige verificar o
> domínio quando o push é **sem autenticação**. Como o Pub/Sub preserva a query
> string, o nosso `?token=` continua valendo junto com a OIDC — sem mudar código.

1. Menu **Pub/Sub › Assinaturas** (`Subscriptions`):
   https://console.cloud.google.com/cloudpubsub/subscription/list
2. **Criar assinatura**:
   - **ID**: `play-rtdn-webhook`
   - **Tópico**: `projects/<PROJECT_ID>/topics/play-rtdn`
   - **Tipo de entrega**: **Push**
   - **URL do endpoint**:
     `https://api.carteiracac.com/webhooks/google?token=<GOOGLE_PUBSUB_TOKEN>`
     (escolha um **segredo forte** para `<GOOGLE_PUBSUB_TOKEN>` — anote; vai no
     `.env` no passo 7)
   - **Ativar autenticação** (`Enable authentication`): **ligado**.
     - **Conta de serviço**: selecione uma (pode ser a `play-churn-api` do passo
       4, ou qualquer outra). Se o console pedir para conceder o papel
       **Criador de token da conta de serviço** (`Service Account Token Creator`)
       ao agente do Pub/Sub, confirme (botão **Conceder**).
     - **Público (audience)**: pode deixar o padrão (a própria URL).
   - **Prazo de confirmação (ack)**: 60s → **Criar**.

   > Ligar a OIDC é o que **dispensa** a verificação de domínio. Nosso webhook
   > ignora o cabeçalho OIDC e valida apenas o `?token=` da query — ou seja, a
   > segurança continua pelo segredo, e a OIDC só serve para o Google aceitar o
   > endpoint externo sem a etapa de domínio.

### (Alternativa) Verificação de domínio — só se você NÃO usar OIDC

Se preferir push **sem autenticação**, aí sim é preciso provar a posse do domínio.
O link direto costuma dar **404** (a página exige o projeto selecionado):

1. Selecione o projeto no topo e abra, com o id na URL:
   `https://console.cloud.google.com/apis/credentials/domainverification?project=<PROJECT_ID>`
   (ou **APIs e serviços › Credenciais** → aba **Verificação de domínio**).
2. Se mesmo assim não abrir, faça direto no **Search Console**:
   https://search.google.com/search-console → **Adicionar propriedade** →
   **Domínio** `carteiracac.com` → verifique por **TXT** no DNS. Depois o domínio
   verificado (mesma conta Google) é aceito pelo GCP ao criar a assinatura.

## 4) Google Cloud — criar a Service Account e a chave JSON

A API que lê o estado da assinatura (ativa/cancelada/expirada) autentica por
**Service Account**.

1. Menu **IAM e administrador › Contas de serviço**:
   https://console.cloud.google.com/iam-admin/serviceaccounts
2. **Criar conta de serviço** → nome: `play-churn-api` → **Concluir**.
3. Abra a conta criada → aba **Chaves** (`Keys`) → **Adicionar chave › Criar nova
   chave › JSON** → baixa um arquivo `.json`.
4. Guarde o arquivo com segurança. Dele você usará dois campos:
   - `client_email` → vira `GOOGLE_SA_CLIENT_EMAIL`
   - `private_key` → vira `GOOGLE_SA_PRIVATE_KEY`

## 5) Play Console — vincular o projeto e dar acesso à Service Account

1. Acesse a **Play Console**: https://play.google.com/console
2. (Nível conta, menu à esquerda) **Configurações › Acesso à API** (`Setup › API
   access`). Se pedir, **vincule** o projeto do Google Cloud `<PROJECT_ID>`.
3. Ainda em **Acesso à API**, encontre a Service Account `play-churn-api@…` na
   lista e clique **Conceder acesso** (`Grant access`). **Ou** vá em
   **Usuários e permissões** (`Users and permissions`) → **Convidar novo usuário**
   → e-mail da Service Account.
4. Dê as permissões **a nível do app** `br.com.cacbrasil.carteira`:
   - **Ver dados financeiros, pedidos e respostas da pesquisa de cancelamento**
   - **Gerenciar pedidos e assinaturas**
   Salve/convide.

## 6) Play Console — ligar as RTDN no app

1. Play Console → selecione o app **Carteira CAC**.
2. Menu **Monetizar › Configuração da monetização** (`Monetize › Monetization
   setup`).
3. Seção **Notificações para desenvolvedores em tempo real** (`Real-time
   developer notifications`):
   - Marque/ative e cole o **nome completo do tópico**:
     `projects/<PROJECT_ID>/topics/play-rtdn`
   - **Salvar**.
4. Clique **Enviar notificação de teste** (`Send test notification`).

## 7) Servidor — variáveis de ambiente e restart

No servidor, edite `~/carteiracac/servidor/.env` (NÃO comitar) e preencha:

```ini
GOOGLE_PACKAGE_NAME="br.com.cacbrasil.carteira"
GOOGLE_SA_CLIENT_EMAIL="play-churn-api@<PROJECT_ID>.iam.gserviceaccount.com"
# private_key do JSON, numa linha só, com as quebras como \n:
GOOGLE_SA_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
GOOGLE_PUBSUB_TOKEN="<o mesmo segredo que você pôs na URL da assinatura>"
```

Reinicie a API para carregar as envs (node/pm2 em `/home/app/.local/node/bin`):

```sh
export PATH=/home/app/.local/node/bin:$PATH
pm2 restart cac-api --update-env
```

## 8) Verificar ponta a ponta

- **Teste do passo 6**: depois de "Enviar notificação de teste", veja os logs:
  ```sh
  export PATH=/home/app/.local/node/bin:$PATH
  pm2 logs cac-api --lines 50 | grep -i google
  ```
  Deve responder **200** (o webhook trata `testNotification` como no-op OK).
- **Fim-a-fim real** (sandbox): com um testador de licença, assine o
  `premium_mensal`/`premium_anual` e depois **cancele** na Play. Em segundos o
  usuário deve aparecer na tela **Churn** (🤖) e o premium ser reconciliado.
- **Atribuição** (quem é o usuário):
  1. **Compras novas** já vêm atribuídas: o app 1.8.5+ envia o UUID da conta como
     `obfuscatedAccountId` (o Google o devolve como `obfuscatedExternalAccountId`).
  2. **Quem já assinava antes do 1.8.5**: o app reporta o `purchaseToken` em
     `POST /api/v1/app/assinatura/vincular-google` assim que abre/consulta premium
     — aí a assinatura é casada com a conta.

## Observações / limites

- **Chave estável** no servidor = o `purchaseToken` (usado como
  `originalTransactionId` da `AssinaturaApp`). Renovações mantêm o token; em
  upgrade/resubscribe o Google emite `linkedPurchaseToken` (não encadeado nesta
  v1 — o novo token vira uma nova linha; não afeta a contagem de churn).
- **Rede de segurança**: o cron `expirarVencidas` é plataforma-agnóstico — varre
  também assinaturas Android vencidas que, por algum motivo, não receberam RTDN.
- **Sem backfill retroativo** no Android (a Apple tem via histórico de
  notificações). O churn Android começa a ser capturado a partir da ativação.
- Segurança do webhook: como o push do Pub/Sub não é assinado, a autenticidade
  vem do `GOOGLE_PUBSUB_TOKEN` na query **+** a verificação de domínio (passo 3).
  Troque o token se suspeitar de vazamento (atualize a URL da assinatura e o
  `.env`).
