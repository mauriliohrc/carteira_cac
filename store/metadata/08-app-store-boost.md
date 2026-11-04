# App Store — Boost de visualizações (Custom Product Pages + PPO)

Guia passo a passo para montar e inserir **tudo o que já foi gerado** neste repo.
Nada aqui exige design extra: textos, screenshots, ícones e cores estão prontos.

> **Onde está cada coisa** (por página, em `store/cpp/<página>/`)
> - `6.9/` — screenshots **1320×2868** (iPhone 6.9")
> - `6.3/` — screenshots **1206×2622** (iPhone com **Dynamic Island, "medium display"** — o slot que o App Store Connect exige)
> - `header.png` — **3840×1646** (21:9, asset de **Header** da product page)
> - `search.png` — **3840×2560** (3:2, asset de **Search Results**)
> - Ícones alternativos p/ A/B (1024×1024): `store/icon/icone-var-b-contraste.png`, `store/icon/icone-var-c-dourado.png` (o atual é `store/icon/icone-1024.png`)
> - Regenerar: `node store/cpp/gerar.mjs` (telas+header+search) · `node store/icon/variantes.mjs` (ícones)

---

## Como funciona (resumo prático)

| Recurso | O que é | O que muda | Para que serve |
|---|---|---|---|
| **Custom Product Pages (CPP)** | Até **70 versões** da sua página de produto | Texto promocional, **screenshots** e vídeo de preview (nome, ícone, descrição e keywords continuam os da página padrão) | Cada CPP tem **URL própria**; você manda um público específico para uma página feita sob medida → mais conversão |
| **Product Page Optimization (PPO)** | **Teste A/B** oficial da Apple | Testa **ícone, screenshots e/ou preview** (até 3 variações contra a original) | A Apple divide o tráfego real e mede qual **converte** melhor; você aplica o vencedor |
| **Assets / mídia** | O acervo de mídia que você sobe uma vez | — | **Reusa** os mesmos screenshots entre página padrão, CPPs e PPO, e entre idiomas, sem resubir |

> ⚠️ CPP e PPO só "dão boost" com **tráfego dirigido**. O motor é o **Apple Search Ads** (use a URL de cada CPP como destino do anúncio) + divulgação orgânica (clubes, grupos, influência).

---

## Paleta usada (para manter consistência em qualquer arte nova)

- Verde fundo (topo → base): `#17552A` → `#081F0F` (gradiente 165°)
- Verde da marca: `#1E6A34` / `#0C3016`
- Texto sobre verde: `#FFFFFF`
- Acento dourado: `#E8B64C` (realce de palavra) · ouro do ícone `#F4D06A → #B8891F`
- Fonte dos títulos: system / Helvetica Neue, **peso 800**, `letter-spacing -1px`

---

## As 4 Custom Product Pages (prontas)

Cada página tem **6 screenshots** já renderizados na ordem certa (o nº no nome é a posição).

### 1) Atirador desportivo / habitualidade — pasta `store/cpp/atirador/6.9/`
- **Texto promocional (≤170):**
  `Comprove sua habitualidade e nunca perca um prazo. CRAF, guias, laudos e avisos antes de cada vencimento — tudo no seu celular, com PIN e Face ID.`
- **Público/Anúncio:** Search Ads em "habitualidade", "IN 311", "CRAF", clubes/estandes.

### 2) Colecionador / acervo grande — pasta `store/cpp/colecionador/6.9/`
- **Texto promocional (≤170):**
  `Todo o seu acervo e CRAFs num só app: documentos anexados, avisos de vencimento e backup protegido. Seus dados ficam só no seu aparelho.`
- **Público/Anúncio:** grupos de colecionadores, "acervo", "coleção de armas".

### 3) Posse / Porte (defesa pessoal) — pasta `store/cpp/posse-porte/6.9/`
- **Texto promocional (≤170):**
  `Seu porte e seu laudo sempre em dia: avisos antes de cada vencimento, documentos à mão e tudo protegido por PIN e Face ID.`
- **Público/Anúncio:** Search Ads em "porte de arma", "renovação porte", "SINARM", "laudo".

### 4) Vencimentos (universal, alta intenção) — pasta `store/cpp/vencimentos/6.9/`
- **Texto promocional (≤170):**
  `Nunca mais um documento vencido. A Carteira CAC acompanha cada validade e te avisa todo dia no último mês. Simples, offline e privado.`
- **Público/Anúncio:** termos genéricos de alta intenção, remarketing.

---

## Assets novos da product page: Header e Search Results

A Apple adicionou dois assets à página (valem para a página padrão E para as CPPs). Já gerei os dois por página, opacos (sem alfa, como exigido):

| Asset | Aspecto | Resolução gerada | Arquivo | Onde aparece |
|---|---|---|---|---|
| **Header** | 21:9 | **3840 × 1646** | `store/cpp/<página>/header.png` | Banner no topo da página do app |
| **Search Results** | 3:2 | **3840 × 2560** | `store/cpp/<página>/search.png` | Prévia do app nos resultados de busca |

> Especificação Apple: Header 21:9 (3840×1646); Search Results 3:2 (mín. 1920×1280, máx. 3840×2560). Ambos aceitam png/jpg **sem transparência**. (Há também versão em vídeo — não gerada aqui.)

## Tamanhos de screenshot exigidos

O App Store Connect pede, no mínimo, o slot **"iPhone com Dynamic Island (medium display)" = 1206 × 2622** (pasta `6.3/`). Também deixei o **6.9" = 1320 × 2868** (pasta `6.9/`) para o slot maior. Suba o 6.3 (obrigatório) e, se o slot 6.9 aparecer, suba o 6.9 também.

## Deep Link (opcional) — deixe em branco por enquanto

O campo **Deep Link** da CPP exige um **Universal Link (https)** no seu domínio (ex.: `https://carteiracac.com/...`) — **não** aceita o esquema interno do app (`cacbrasil://`). Hoje o app **não tem Universal Links configurados** (`associatedDomains` + arquivo `apple-app-site-association` no `carteiracac.com`), então:

- **Agora:** deixe o Deep Link **vazio** (é opcional; a CPP abre normalmente a ficha do app).
- **Para habilitar depois:** me peça que eu configuro os Universal Links (associatedDomains no `app.json` + AASA no site + rebuild) e defino um deep link por público — ex.: Vencimentos → abre a aba **Avisos**; Atirador → abre **Habitualidade**.

## Product Page ID

O ID que aparece no editor (ex.: `628e37fb-363f-407f-a658-07edebade21f`) identifica aquela CPP — é o que você usa no **Apple Search Ads** (ao criar a campanha, escolhe a Custom Product Page por esse ID) e para montar a **URL de compartilhamento** da página. Anote o ID de cada página junto do público correspondente.

## Passo a passo — criar uma Custom Product Page

Em **App Store Connect → Carteira CAC → (coluna esquerda) Custom Product Pages → “+”**:

1. **Nome de referência** (interno, não aparece): ex. `Atirador - Habitualidade`.
2. Em **Localizations**, escolha **Portuguese (Brazil)**.
3. **Promotional Text:** cole o texto da página (acima).
4. **Deep Link:** deixe **vazio** por enquanto (ver seção "Deep Link").
5. **Screenshots** — arraste as **6 imagens** de cada tamanho, **na ordem do nome** (`1-…` a `6-…`):
   - **iPhone Dynamic Island / medium (1206×2622):** pasta `6.3/` (slot obrigatório).
   - **iPhone 6.9" (1320×2868):** pasta `6.9/` (se o slot aparecer).
6. **Header:** suba `header.png` da pasta da página.
7. **Search Results:** suba `search.png` da pasta da página.
8. **Save** → **Submit for review** (a CPP é revisada, mas separada do binário; pode ter várias ativas).
9. Anote o **Product Page ID** e, aprovada, copie a **URL da CPP** para usar como **destino** dos anúncios daquele público.
10. Repita para as 4 páginas.

> Dica: comece publicando **2** (Atirador e Vencimentos) e rode tráfego; depois as outras 2.

---

## Passo a passo — Product Page Optimization (teste A/B)

Em **App Store Connect → Carteira CAC → Product Page Optimization → “+”**:

1. **Nome do teste** (ex. `Icone v1`), **duração** (recomendado 30–90 dias) e **% de tráfego**.
2. **Tipo de teste:** escolha **App Icon** (ou Screenshots / Preview).
3. Para **ícone**, adicione **Treatment B** e **Treatment C** usando:
   - `store/icon/icone-var-b-contraste.png` (escudo maior, mais legível)
   - `store/icon/icone-var-c-dourado.png` (escudo dourado, premium)
   - A original fica como "baseline".
4. **Start test** → a Apple serve as variações ao tráfego real e reporta **melhoria de conversão com confiança**. Ao fim, **aplique o vencedor**.

> **Importante (ícone):** testar ícone exige que as imagens estejam **embutidas no binário** (asset catalog + `CFBundleIcons`/config do Expo). As PNGs já estão prontas; quando você quiser rodar o teste de ícone, me peça que eu **conecto as variantes no build** e gero uma nova versão. **Screenshots e preview NÃO precisam de build novo.**
>
> Sugestão de ordem dos testes: **1º Screenshots** (1ª tela: "Nunca perca um vencimento" vs. tela de recurso) → **2º Ícone** → **3º Preview em vídeo**.

---

## Reaproveitar a mídia (Assets)

- Suba cada screenshot **uma vez**; a App Store Connect permite **reutilizar** a mesma mídia entre a página padrão, as CPPs e os treatments do PPO (e entre idiomas).
- Mantenha um **set canônico 6.9"** por público (é o que está em `store/cpp/<página>/6.9/`). Os menores são derivados automaticamente pela Apple.
- Para regenerar com outro texto/ordem/cor: edite `store/cpp/gerar.mjs` (array `PAGINAS`) e rode `node store/cpp/gerar.mjs`.

---

## Antes de tudo: afie a PÁGINA PADRÃO (base de tudo)

As CPPs herdam nome/ícone/descrição/keywords da página padrão — então vale ajustar a base primeiro (ver `01-listagem-app-store.md`):
- **Subtítulo (30):** `CRAF, guias e vencimentos` ✔ (bom)
- **Keywords (100):** já otimizadas; considere incluir `habitualidade` se liberar espaço (teste trocando `SIGMA`↔`habitualidade`).
- **1º screenshot** da página padrão: use o de maior apelo universal — recomendo o de **Avisos** com "Nunca mais um documento vencido" (já gerado em `store/cpp/vencimentos/6.9/1-5-avisos.png`).

---

## Checklist rápido

- [ ] Ajustar página padrão (keywords/1ª screenshot).
- [ ] Criar CPP **Atirador** e **Vencimentos**, pegar URLs.
- [ ] Rodar **Apple Search Ads** apontando cada anúncio para a CPP do tema.
- [ ] Criar CPP **Colecionador** e **Posse/Porte**.
- [ ] Iniciar **PPO de screenshots** (sem build novo).
- [ ] Quando quiser, embutir ícones B/C no build e iniciar **PPO de ícone**.
