# Marketplace — pendências para a retomada

> Branch do trabalho: **`marketplace`**. A `main` tem só a API + backoffice do
> marketplace (em produção); o app do marketplace está só aqui.

## 🐛 BUG ABERTO (bloqueante) — chamadas do app não completam no device

**Sintoma (build de desenvolvimento no iPhone 12 Pro Max):**
- Em **Mercado → Anunciar**, as **categorias não aparecem** (o `obterCatalogo()` não popula).
- **Upload de foto fica eternamente no loading** (não erra, não conclui).
- O **Painel** (notícias/competições) também **não carrega tudo** — ou seja, **não é
  só o marketplace**: parece app-wide nas chamadas ao servidor.

**O que já foi descartado (não é a causa):**
- **Env/URL**: o bundle Hermes contém `https://api.carteiracac.com` e os caminhos
  (`/marketplace/catalogo`, `/uploads`). A build aponta pra produção. ✔
- **Servidor**: `GET /api/v1/app/marketplace/catalogo` → 200 com JSON; `cac-api`
  online; nginx `client_max_body_size 35m`. ✔
- **Device alcança a API**: no **Safari do próprio iPhone** a URL do catálogo
  retorna o JSON. ✔
- **ATS**: `nscurl --ats-diagnostics` → PASS (TLS 1.3/PFS). Info.plist:
  `NSAllowsArbitraryLoads=false`, `NSAllowsLocalNetworking=true`. ✔
- **Caminho do upload**: era `/app/uploads` (duplicava `/app` → 404). **Já
  corrigido** para `/uploads` (o `apiApp` já prefixa `/api/v1/app`). A rota certa
  responde 401. ⚠ Corrigido, mas não revalidado no device por causa do bug maior.

**Conclusão até aqui:** servidor OK + device alcança a API, mas o `fetch`/
NSURLSession **do app** não completa, app-wide. Logo, o problema é no cliente
(release/Hermes) ou na rede específica do app no device.

**Próximo passo (como continuar):**
1. Reinstrumentar o `apiApp` (`src/conta/api.ts`) com logs `[APIAPP] -> / <- / NETERR`
   (feito antes e revertido — reaplicar).
2. Build dev → instalar → **relançar com console**:
   `xcrun devicectl device process launch --console --terminate-existing --device <UDID> br.com.cacbrasil.carteira > /tmp/dev.log 2>&1`
   (o device estava via **SSH** antes, o que impedia o `codesign`; buildar de uma
   sessão **GUI local** do Mac — `claude --resume` no Terminal físico).
3. Reproduzir (Painel + Mercado/Anunciar + foto) e **ler `/tmp/dev.log`**: ver se é
   `NETERR` (erro de rede/TLS no NSURLSession) ou um status != 200.

**Hipóteses a investigar:**
- (a) Algo no `fetch`/NSURLSession do **release** (cabeçalho, keep-alive, HTTP/2,
  `Content-Type` no GET?) que não acontece no dev/Metro.
- (b) **Erro de JS no release/Hermes** interrompendo antes/depois do fetch (ex.:
  `Intl`/`toLocaleString('pt-BR',{style:'currency'})` em `formatarPreco` — Hermes
  pode não suportar `Intl` com opções e lançar; conferir se quebra render/fluxo).
- (c) **Rede do device**: iCloud Private Relay / VPN / Lockdown Mode afetando o app
  mas não o Safari.

## ✅ Já funciona / já feito
- API + backoffice do marketplace **em produção** (migração `20261110090000_marketplace`
  aplicada). Verificado por curl (catálogo 200, público 200, admin 401).
- Telas do app: vitrine (aba Mercado), detalhe, novo (fotos/categorias/EULA), meus,
  conversas, chat; navegação (Mercado na tab bar + engrenagem no header).

## ⏭️ Outras pendências (não-bloqueantes)
- **Destaque pago (IAP):** cadastrar `destaque_7d/15d/30d` no App Store Connect /
  Play Console; e trocar o hook `validarReciboIap` (`servidor/src/integracoes/iap.ts`)
  por validação real (App Store Server API / Play Developer API) antes de escalar
  receita. Hoje confia no cliente, com idempotência por `transacaoId`.
- **Lojas parceiras:** cadastrar a 1ª no backoffice (precisa do e-mail de uma conta
  do app como dono) para testar o fluxo identificado + auto-aprovação.
- **Vitrine web pública (listagem):** hoje só o **detalhe** host-routed
  (`mercado.carteiracac.com/<slug>-<id>`) está implementado; a listagem/SEO na raiz
  do subdomínio é um extra a fazer.
