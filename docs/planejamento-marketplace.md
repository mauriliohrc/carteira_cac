# Planejamento — Marketplace de acessórios (Carteira CAC)

> Classificados dentro do app para **equipamentos e acessórios** de tiro: o app
> **conecta** comprador e vendedor; **não** processa pagamento nem intermedeia a
> transação. Toda negociação e transferência seguem a legislação brasileira,
> por conta das partes.

---

## 1. Veredito de conformidade (Apple / Google Play) — o ponto crítico

### O que as lojas proíbem
- **Apple — Guideline 1.1.3:** proíbe conteúdo que "incentive o uso ilegal/irresponsável de armas" ou que **"facilite a compra de armas de fogo ou munição"**. Acessórios **não** são citados.
- **Google Play — Dangerous Products:** proíbe apps que facilitem a venda de **armas, munição e *certos* acessórios** — especificamente dispositivos que simulam/convertem para tiro automático (bump stocks, auto sears, kits de conversão) e **carregadores/cintos acima de 30 tiros**. Acessórios comuns (óptica, coldre, case, limpeza, sling) **não** estão na lista restrita.
- **Ambas (UGC / conteúdo gerado por usuário):** exigem **moderação**, **denúncia de conteúdo**, **bloqueio de usuários abusivos**, termos com tolerância zero e **classificação etária 17+**.

### Veredito
É **viável e defensável** — desde que o marketplace seja **somente de acessórios/equipamentos**, **sem transação no app**, com moderação e as restrições abaixo. O risco real é **discricionariedade do revisor** ("app de CAC + marketplace" chama atenção); mitigamos com escopo estrito, moderação e textos claros.

### REGRA DE OURO — o que NÃO pode ser anunciado (bloquear por categoria + moderação)
- ❌ **Armas de fogo** (qualquer tipo) — listar arma = "facilitar compra de arma" = rejeição Apple. **Decisão-chave abaixo.**
- ❌ **Munição** (já definido por você) e **componentes controlados**: pólvora, espoletas.
- ❌ **Carregadores > 30 tiros**, dispositivos de tiro automático, supressores.
- ❌ **Coletes balísticos / blindagem** (uso controlado no Brasil).
- ❌ Qualquer item que exija registro/autorização para transferência e que a loja interprete como "arma".

### ✅ Decisão #1 (precisa da sua definição): armas de fogo entram?
**Recomendação forte: NÃO no app.** Mesmo sendo legal a transferência entre CACs no Brasil, *anunciar a arma* dentro do app é o que a Apple barra. Opções:
- (a) **Acessórios-só no app** (recomendado) — baixo risco de rejeição.
- (b) Armas **só na web** (fora das lojas) — risco médio; o app não pode linkar pra isso sem contaminar a review.
- (c) Armas no app — **alto risco de rejeição/remoção**. Não recomendo.

### Requisitos de UGC que viram tarefa (obrigatórios p/ aprovação)
1. **EULA/termos** com tolerância zero a conteúdo censurável (Apple exige aceite).
2. Botão **"Denunciar anúncio"** e **"Bloquear usuário"** em todo anúncio/chat.
3. **Moderação**: fila de aprovação no backoffice (todo anúncio entra como *pendente*).
4. **Filtro** de termos proibidos (munição, pólvora, "vendo pistola", etc.) na criação.
5. **Remoção em 24h** de conteúdo denunciado + contato de suporte publicado.
6. **Classificação etária 17+** e aviso de que a transação/transferência é responsabilidade legal das partes.

Fontes: [Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) · [Google Play — Inappropriate Content / Dangerous Products](https://support.google.com/googleplay/android-developer/answer/9878810).

---

## 2. Escopo do produto

### Anúncio (campos)
- **Categoria** e **subcategoria** (lista fechada, curada — ver abaixo).
- **Estado de uso**: novo · seminovo · usado.
- **Preço** (ou "a combinar").
- **Região**: estado (UF) + cidade.
- **Fotos** (até N, ex. 6).
- **Título** + **descrição**.
- Gerado por: usuário logado (vendedor). Entra como **pendente de moderação**.

### Categorias iniciais (somente acessórios — curadas)
Óptica e miras · Coldres e transporte (cases, bolsas, slings) · Limpeza e manutenção · Acessórios de armamento permitidos (trilhos, bipés, empunhaduras, coronhas) · Recarga (equipamento: prensas, dies, balança — **sem** pólvora/espoleta) · Proteção (abafador, óculos, luvas) · Vestuário/EPI de tiro · Cofres e guarda · Alvos e estande · Outros.
> Cada categoria tem uma allow-list; o que não está nela não pode ser criado.

### Anonimato + fluxo de contato (segurança do anunciante)
1. Anúncio é **anônimo** (mostra só apelido/first name, região, fotos, preço — **nunca** telefone/CPF).
2. Interessado toca **"Tenho interesse"** → abre um **chat do anúncio** (in-app).
3. Conversam pelo chat; se o vendedor quiser, toca **"Liberar meu contato"** → o telefone (`celular`) é exibido **só para aquele interessado**, naquela conversa.
4. Liberação é **opt-in por conversa** e reversível; telefone nunca vaza sem ação do vendedor.

### Gestão (como OLX / Marketplace da Meta)
- **"Meus anúncios"**: ativos, pausados, pendentes de revisão, reprovados, vendidos.
- Ações: editar, pausar/reativar, marcar como vendido, excluir, ver interessados/conversas.
- **Minhas conversas**: lista de chats (como comprador e como vendedor).

---

## 3. Arquitetura técnica (o que reusar × o que é novo)

### Princípio: NÃO usar o sync por-usuário
O `RegistroSync` (acervo) é **estritamente por usuário** (`appSync.ts` filtra tudo por `usuarioId`) — inadequado para dados que **todos** veem. O modelo certo é o de **conteúdo público/compartilhado** já usado por **Notícias/Competições**.

### Reuso direto (padrões que já existem)
| Necessidade | Reusar |
|---|---|
| Lista + detalhe compartilhados, paginação por cursor, usuário anônimo opcional | `servidor/src/rotas/v1/appNoticias.ts` (`usuarioAppOpcional`, `filtroVisibilidade`) + cliente `src/noticias/*` |
| Endpoint público (web, sem login) | `servidor/src/rotas/publicoNoticias.ts` → novo `publicoMarketplace.ts` |
| Página web pública com OpenGraph (preview no WhatsApp) | `backoffice/app/[slugId]/page.tsx` (host-routed) |
| Fotos públicas (servíveis na web) | Model `Upload` + `GET /uploads/:id` (`servidor/src/rotas/uploads.ts`) — **adicionar** rota de upload autorizada ao usuário do app |
| Moderação/aprovação (status + publicar) | `servidor/src/rotas/noticias.ts` + telas `backoffice/app/noticias/*` |
| Notificar "novo interesse / nova mensagem" | Push Expo (`servidor/src/push/expo.ts`, `DispositivoPush`) |
| Identidade/contato do vendedor | `UsuarioApp.celular` + `exigirApp`/`usuarioAppOpcional` |
| Padrão de nova seção no app | A aba **Serviços/despachante** (precedente mais recente) |

### Novo (as peças que não existem)
1. **Tabela de anúncios (cross-user)** — Prisma `Anuncio`:
   `id, vendedorId, categoria, subcategoria, estadoUso, precoCentavos?, uf, cidade, titulo, descricao, status (PENDENTE|APROVADO|PAUSADO|VENDIDO|REJEITADO), criadoEm, atualizadoEm` + relação com fotos (`AnuncioFoto` → `uploadId`). Índices por `status`, `categoria`, `uf`. Servido por `GET /api/v1/app/marketplace` (lista, filtros: categoria, uf, texto, preço) e `GET /.../:id`.
2. **Chat por anúncio** (maior peça — **não há infra de mensagens**):
   - `Conversa { id, anuncioId, compradorId, vendedorId, contatoLiberado bool, criadoEm }` (único por anúncio+comprador).
   - `Mensagem { id, conversaId, autorId, texto, criadoEm, lidaEm? }`.
   - Transporte: **sem WebSocket** (não existe no stack). MVP = **polling** (cursor, como `appNoticias`) + **push Expo** no "nova mensagem". Evolução futura: SSE/WebSocket se necessário.
3. **Liberação de contato / anonimato** — flag `contatoLiberado` por conversa; o telefone só entra no payload quando `true` e só para os participantes. Nenhum endpoint hoje expõe telefone de um usuário a outro — lógica nova, com cuidado de **LGPD** (consentimento explícito do vendedor, registro de quando liberou).
4. **Denúncia/bloqueio** — `Denuncia { anuncioId|conversaId, denuncianteId, motivo }` + `BloqueioUsuario { usuarioId, bloqueadoId }`; fila no backoffice.
5. **Upload de foto pelo usuário do app** — nova rota `POST /api/v1/app/marketplace/fotos` (reusa `Upload` + `uploadImagemSchema`, hoje só admin/entidade).

### App (telas novas, sob `app/mercado/`)
- Entrada: como a barra tem **5 abas cheias**, a entrada vai no menu **"Mais"** (ou troca de um slot — decisão de UX). Ícone + lista.
- `mercado/index` (busca/listagem com filtros), `mercado/[id]` (detalhe + "Tenho interesse"), `mercado/novo` (criar anúncio — categorias, fotos, região), `mercado/meus` (gestão), `mercado/conversas` (lista de chats), `mercado/conversa/[id]` (chat + liberar contato).
- Clientes `src/mercado/api.ts` (espelha `src/noticias/api.ts`).

### Página web pública
- `mercado.carteiracac.com/<slug>-<id>` — novo segmento host-routed no backoffice (irmão do `[slugId]` de notícias), consumindo `GET /api/publico/marketplace/:id` e, opcionalmente, uma **listagem pública** `mercado.carteiracac.com` (busca por categoria/UF) para SEO e para quem ainda não tem o app (com CTA de download). OpenGraph p/ preview no WhatsApp. CORS `*.carteiracac.com` já está liberado.
- Contato **nunca** aparece na web (anonimato); a web leva o interessado a baixar o app para manifestar interesse.

### Backoffice (moderação)
- Nova aba **"Marketplace"**: fila de anúncios **pendentes** (aprovar/reprovar com motivo), busca, pausar/remover, fila de **denúncias**, métricas (total, por status, por categoria) — espelhando `noticias` + `contatos`.

---

## 4. Fases / milestones

- **M0 — Decisões + fundação**: fechar Decisão #1 (armas sim/não — recomendo não), categorias, limites (nº fotos, tamanho). Prisma models + migração (aditiva).
- **M1 — Anúncios (CRUD + público)**: criar/editar/listar/detalhe no app; upload de fotos; endpoint público; "Meus anúncios"; moderação no backoffice (pendente→aprovado). *Já dá valor: vitrine navegável.*
- **M2 — Página web pública**: `mercado.carteiracac.com` (detalhe + listagem + OpenGraph + CTA download).
- **M3 — Interesse + Chat + liberar contato**: conversas, mensagens (polling + push), anonimato, liberar telefone.
- **M4 — Segurança/UGC**: denúncia, bloqueio, filtro de termos, EULA, remoção 24h, 17+.
- **M5 — Polimento/monetização (opcional)**: destaque de anúncio, selo verificado, etc. *(ver risco de IAP abaixo).*

---

## 5. Riscos & decisões em aberto

- **Decisão #1 — armas de fogo no app?** Recomendo **não** (só acessórios). Define escopo e risco de review.
- **Review da Apple/Google**: risco de discricionariedade. Mitigar com escopo estrito, moderação ativa, 17+, textos de responsabilidade legal, e notas de revisão explicando que é classificados de **acessórios**, sem transação, sem armas/munição.
- **Chat em tempo real**: não há infra; MVP com **polling + push**. WebSocket/SSE é trabalho novo — deixar p/ depois.
- **LGPD**: liberar telefone é dado pessoal — consentimento explícito do vendedor, log de liberação, política de privacidade atualizada.
- **Moderação = custo operacional**: toda a carga de aprovar/denunciar. Dimensionar (ferramentas no backoffice + filtros automáticos ajudam).
- **Monetização e IAP**: "destaque/turbinar anúncio" é bem **digital consumido no app** → **exigiria IAP (StoreKit/Play Billing)**, diferente do Despachante (serviço do mundo real) e do contato (sem pagamento). Se for cobrar destaque, entra pela loja (15–30%). Classificados em si são grátis.
- **Abuso/segurança**: anonimato protege o vendedor; denúncia + bloqueio + moderação protegem a comunidade.

---

## 6. Verificação (como validar quando implementarmos)
- Criar anúncio no app → entra como **pendente** → aprovar no backoffice → aparece na lista e na web.
- Anonimato: detalhe/lista e página web **nunca** retornam telefone/CPF.
- Interesse → chat → "liberar contato" → telefone aparece **só** naquela conversa, **só** após ação do vendedor; push chega ao vendedor.
- Denúncia → cai na fila do backoffice → remoção reflete no app e na web.
- Back-compat: tudo é aditivo (novas tabelas/rotas); apps antigos não enxergam a seção e não quebram.
