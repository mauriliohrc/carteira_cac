# CAC Brasil — Carteira Digital do Atirador

App para caçadores, atiradores desportivos e colecionadores guardarem o acervo
e **todos os documentos da área** num lugar só — com alerta diário no último mês
antes de cada vencimento.

React Native / Expo, TypeScript. **O foco atual é iOS**: os scripts, o perfil de
build e o orçamento de notificações são calibrados para iPhone. O código Android
continua compilando e bundlando (`npm run android`), mas não é o alvo desta
fase.

## Por que Expo e não Swift + Kotlin

O app é, no fundo, um gerenciador de documentos: formulário, banco local, PDF e
notificação agendada. Nada disso ganha em performance com código nativo, e dois
codebases dobrariam o custo de manter as regras de prazo da PF e do Exército,
que mudam com frequência. Expo entrega os dois sistemas com uma base só e
acesso nativo a SQLite, câmera, arquivos e notificações locais.

## Rodando

Requer Node 20.19.4+ (o projeto tem `.nvmrc` apontando para 24).

```bash
nvm use
npm install
npm start          # expo start --ios
```

Abra no Expo Go (QR code) ou gere um **dev build** — recomendado, porque as
notificações locais só se comportam como no app final fora do Expo Go:

```bash
npm run ios            # simulador, precisa de Xcode
npm run ios:device     # iPhone conectado
npm run build:dev      # EAS, sem toolchain local
```

Verificações: `npm test`, `npm run typecheck` e `npm run doctor`.

`npm test` roda cinco arquivos, todos sem bundler (Node 24 remove os tipos
sozinho, e `testes/alias.mjs` resolve os imports `@/`):

- **`planejamento.test.ts`** — o núcleo dos alertas: teto diário, orçamento do
  iOS, agrupamento, fronteiras da janela.
- **`habitualidade.test.ts`** — a contagem por grupo: quem é cobrado, o que
  conta, e as duas bordas da janela móvel de 12 meses.
- **`variantes-plataforma.test.ts`** — garante que cada arquivo `.web` exporte
  tudo o que a versão nativa exporta. Existe por causa de um bug real:
  `caixa.web.ts` foi truncado numa edição e ficou vazio; o `tsc` não viu nada,
  porque **ele resolve o arquivo nativo e nunca o `.web`**, e o app quebrou só
  no navegador com "observarRecebidos is not a function". Nenhum typecheck pega
  essa classe de erro — só comparar os dois arquivos pega.

### Prévia no navegador (sem Xcode)

```bash
npm run web          # exporta e serve em http://localhost:8080
```

Serve para percorrer telas, cadastrar arma, preencher a ficha e ver o design
sem instalar Xcode. O que **não** funciona na web, por limite de plataforma:

| | Web | iOS |
| --- | --- | --- |
| Navegação, cadastro, ficha, agenda | ✅ | ✅ |
| Banco local (SQLite via wa-sqlite) | ✅ | ✅ |
| Anexar PDF/imagem e fotos da arma | ✅ até 6 MB, como data URL | ✅ sem limite |
| Fotografar com a câmera | ❌ | ✅ |
| Notificações de vencimento | ❌ | ✅ |

Dois detalhes que a web exigiu e valem registro:

- **`PRAGMA journal_mode = WAL` derruba o banco na web.** O WAL precisa de
  memória compartilhada (`xShmMap`), que o VFS do navegador
  (OPFS `AccessHandlePoolVFS`) não implementa. Pedir WAL lá fazia
  `openDatabaseAsync` rejeitar e o app abria sem nenhum dado — parecia que
  nada salvava. Hoje o WAL só é pedido fora da web, e a promise de abertura é
  descartada em caso de falha, para que uma nova tentativa seja possível.
- **`Alert.alert` é um no-op no react-native-web** (literalmente
  `static alert() {}`). Todo erro e toda confirmação sumiam em silêncio: falha
  ao salvar não avisava, e excluir não perguntava nem acontecia.

## Diálogos

Toda escolha é feita com **botão**, nunca digitando. `src/ui/DialogoProvider.tsx`
desenha uma folha de ações em vidro, igual nas três plataformas, e
`src/ui/dialogo.ts` expõe `avisar` / `confirmar` / `escolher`.

A folha precisa estar na árvore React para renderizar, mas `avisar` também é
chamado de fora de componente (o cofre de arquivos, por exemplo). Por isso o
provider registra seu apresentador num singleton do módulo, que cai nos
diálogos do sistema caso seja acionado antes de a folha montar — uma rede de
segurança que na prática nunca é usada, já que o provider monta na raiz.

As partes que dependem de módulo nativo têm variante `.web`
(`src/notificacoes/index.web.ts`, `caixa.web.ts`, `src/arquivos/cofre.web.ts`,
`src/ui/LeitorPdf.web.tsx`), então a prévia degrada de forma explícita em vez
de quebrar.

**Por que um servidor próprio** (`scripts/servir-web.mjs`) e não `expo start
--web`: o expo-sqlite usa wa-sqlite, que depende de `SharedArrayBuffer`, que o
navegador só libera em contexto cross-origin isolado — o que exige os
cabeçalhos `Cross-Origin-Opener-Policy` e `Cross-Origin-Embedder-Policy` no
*documento HTML*. O dev server do Expo serve o index.html num middleware que
roda antes do hook `enhanceMiddleware` do Metro, então não dá para injetar os
cabeçalhos por configuração. O `metro.config.js` cobre os assets; o servidor
estático cobre o documento.

### Simulador iOS

Precisa do Xcode completo (a App Store é o caminho; as Command Line Tools
sozinhas não trazem o Simulator). Depois de instalado:

```bash
npm run simulador    # aponta o xcode-select, aceita a licença, baixa o runtime e sobe o app
```

## Como o app se organiza

| Aba | O que faz |
| --- | --- |
| **Painel** | Semáforo do acervo: vencidos, ≤7 dias, ≤30 dias, em dia, e as 5 pendências mais urgentes. O cartão-herói cobre as **duas** cobranças — documento e habitualidade —, senão diria "tudo em dia" para quem está com sessões atrasadas. |
| **Acervo** | Duas faces do mesmo assunto, num seletor no topo: **Acervo** (lista de armas com filtro, cada uma abre a **ficha**) e **Habitualidade** (andamento das 8 sessões por grupo nos últimos 12 meses). |
| **Avisos** | Só o que exige ação: **Recebidos** (as notificações que chegaram) e **Vencendo** (documentos vencidos ou dentro da janela de 30 dias). Prazos mais folgados não geram aviso e por isso não aparecem aqui. |
| **Meus Docs** | Documentos do CAC: CR, laudo psicológico, capacidade técnica, filiação, habitualidade, certidões. Sugere o que ainda falta cadastrar. |
| **Mais** | Tema, assinatura, estatísticas. |

### Ficha da arma

Identificação em cima (modelo, série, acervo, grupo, calibre, registro), depois
a **galeria de fotos** do armamento, e abaixo os documentos **separados por
categoria**:

- **CRAF** — em destaque, com a data de validade em corpo grande.
- **Guias de tráfego** — cartão com `ORIGEM → DESTINO` e até quando vale.
- **Outros** — autorização de compra e anexos diversos.

Documentos **vencidos ficam recolhidos** em cada categoria (“Mostrar 2
vencidos”), com a data do último ao lado. Nada é apagado: o histórico continua
acessível a um toque.

### Galeria por arma

Fotos do armamento, da câmera, da galeria ou de arquivo. A **primeira é a
capa** e aparece na lista do acervo — reconhece a arma antes de o olho ler
modelo e número de série. Por isso a ação da grade é "usar como capa", em vez
de arrastar para reordenar: é o único movimento que muda alguma coisa. No
nativo as imagens vão para a área privada do app; na prévia web viram data URL
na linha do banco.

## Cabeçalho e barra de abas

Todas as telas usam o mesmo cabeçalho (`src/ui/Cabecalho.tsx`): brasão, a
marca **CAC BRASIL** e, nas telas empilhadas, o botão de retorno no lugar do
brasão mais um subtítulo discreto dizendo onde você está. O canto direito é um
espaço livre — editar, compartilhar. O header nativo do Stack foi desligado:
dois cabeçalhos empilhados cortariam o efeito de vidro.

A barra de abas flutua sobre o conteúdo, em vidro, e a aba ativa ganha uma
**cápsula própria que desliza** entre as posições (mola, native driver). O
destaque não é só cor: o ícone troca de contornado para preenchido, cresce um
pouco e sobe 1 px — então sobrevive a daltonismo e a tela sob sol forte.

`src/ui/Vidro.tsx` escolhe o melhor material disponível e cai com elegância:

| Ambiente | Material |
| --- | --- |
| iOS 26+ | `GlassView` — Liquid Glass real, refrata e deforma o que passa atrás |
| iOS < 26, Android, web | `BlurView` — borra sem refratar |
| "Reduzir transparência" ligado | superfície opaca |

Em todos os níveis é desenhada a **quina especular** — fio de luz no contorno e
brilho escorrendo do topo até o meio da peça. É ela que dá espessura; sem isso
vidro vira retângulo borrado. No iOS 26 a barra e a cápsula ficam dentro de um
`GlassContainer`, então se fundem ao se aproximarem — o gesto do Liquid Glass,
não uma imitação em CSS.

Cabeçalho e barra são ambos flutuantes pelo mesmo motivo: vidro sem nada atrás
não refrata nada, precisa ver a lista passando por baixo. A `Tela` reserva os
recuos correspondentes no topo e no rodapé — inclusive para o indicador de
rolagem, que senão correria escondido atrás deles.

O vidro é usado com parcimônia — barra de abas, ficha de identificação e o
cartão-herói do painel. Espalhado por tudo, vira ruído.

## Tema

Duas paletas de baixa saturação, no partido "manual de campo": verde-oliva e
latão sobre grafite no escuro, tinta sobre papel-osso no claro. A hierarquia
vem de tipografia, fio de cabelo e espaço — sem gradiente, sem neon.

A caixa alta é **reservada**: só cabeçalho de seção, rótulo de campo e o
carimbo da ficha. Botão, status, prazo, filtro e aba ficam em caixa normal —
caixa alta em tudo é o vício que faz interface parecer gerada, não desenhada.
Número de série, registro e datas técnicas usam monoespaçada, para dado
técnico parecer dado técnico.

O usuário escolhe em **Mais › Aparência** entre **Automático** (segue o
sistema), **Claro** e **Escuro**. A preferência fica na tabela `config` e
sobrevive ao fechar o app.

Como funciona por dentro: `StyleSheet.create` no topo do arquivo congelaria as
cores do tema carregado no boot, então cada folha de estilo é uma **função da
paleta**, consumida por `useEstilos(folha)`. O hook cacheia por
(fábrica, paleta) num `WeakMap`, de modo que trocar de tema custa uma criação
por folha — não uma por render. Nada no app importa cor fixa: `src/tema/` é a
única fonte, e até `avaliar()` em `domain/vencimento.ts` devolve só a situação,
com a cor resolvida à parte por `estiloSituacao(situacao, paleta)` para o
módulo seguir puro e utilizável pelas notificações.

## Regras de domínio

**Acervos**: Defesa Pessoal (SINARM), Atirador, Caça e Coleção (SIGMA).

**Grupos**: cano longo raiada permitida/restrita, cano curto permitida/restrita,
cano longo alma lisa permitida/restrita.

**Data de validade é sempre digitada pelo usuário.** O app nunca calcula nem
pré-preenche — os prazos legais aparecem só como texto de referência abaixo do
campo de emissão. É o que está impresso no documento que vale.

## Habitualidade

O atirador desportivo tem de comprovar, **por grupo de armas**, no mínimo **8
sessões de tiro nos últimos 12 meses**. A regra vive em
`src/domain/habitualidade.ts`, módulo puro que `npm test` exercita, e se apoia em
três decisões:

**Grupo de habitualidade = grupo da arma.** Os seis grupos exigidos pela norma
(curto permitida/restrita, longo alma lisa permitida/restrita, longo raiada
permitida/restrita) são exatamente o `Grupo` que o app já pedia no cadastro da
arma. Não foi preciso inventar taxonomia nova, e o atirador não preenche nada
duas vezes.

**Só o acervo de atirador é cobrado.** Caça, coleção e defesa pessoal não exigem
habitualidade, então um grupo só entra na cobrança se houver ao menos uma arma de
acervo **Atirador** nele. Quem só tem revólver de defesa pessoal não vê cobrança
nenhuma — a aba explica isso em vez de mostrar uma lista vazia.

**A janela é móvel, não é ano-calendário.** A contagem é sempre dos últimos 12
meses contados de hoje, então uma sessão sai da conta sozinha ao completar 12
meses. Uma sessão feita exatamente 12 meses atrás **não** conta mais: preferimos
errar para o lado conservador, porque um "em dia" errado é o app dizendo ao
atirador que ele pode ficar em casa. É daí que nasce o `perdeEm` de cada grupo —
o dia em que a 8ª sessão mais recente completa 12 meses e o grupo deixa de estar
em dia. A tela mostra esse dia (“Em dia até 12/03/2027”), então o prazo aparece
antes de estourar.

A habitualidade mora **dentro da aba Acervo**, no segundo segmento do seletor.
São duas faces do mesmo assunto — o que eu tenho e o que devo por causa do que
tenho —, e gastar duas das cinco posições da barra no mesmo tema era caro. O
segmento mostra um badge com o número de grupos atrasados, então a pendência
aparece sem precisar trocar de segmento.

### Registrar

Depois do treino: **Acervo › Habitualidade** → **+** → data, treino ou competição, local,
e as armas usadas. Os grupos creditados o app deduz das armas marcadas e mostra
**antes de salvar**, para o atirador conferir o que vai contar sem precisar
entender a tabela de grupos.

**Uma sessão credita cada grupo uma vez.** Levar três pistolas do mesmo grupo num
treino é uma habitualidade, não três; levar uma pistola e uma espingarda é uma em
cada grupo.

Os **locais** (clubes, estandes) são cadastrados pelo usuário e reaproveitados:
dá para cadastrar na hora, digitando o nome direto no seletor, ou gerenciar a
lista com cidade, UF e nº do CR do clube em **Registros › Locais**.

### Como o andamento é desenhado

As 8 sessões aparecem como **8 marcas contáveis**, não como barra de
porcentagem: a exigência é um número inteiro e pequeno, e o atirador quer saber
quantas faltam, não ler "62%". O semáforo tem três degraus — verde só com as 8
(não existe "quase em dia" perante a fiscalização), latão para todo o meio do
caminho, vermelho para quem não registrou nada nos 12 meses. No painel o mesmo
estado cabe em uma linha: um ponto por grupo, na cor do semáforo.

### A sessão sobrevive à venda da arma

A habitualidade aconteceu — vender a arma depois não a desfaz. Por isso a sessão
guarda o **grupo e o nome da arma no dia**, e `habitualidade_armas.arma_id` cai
para `NULL` (`ON DELETE SET NULL`) em vez de a linha ser apagada em cascata. Sem
isso, vender uma das duas pistolas do mesmo grupo apagaria o crédito de um grupo
que o usuário continua tendo de cumprir.

### Notificação de habitualidade

A habitualidade entra no plano de avisos como **uma frente**, do mesmo jeito que
cada arma e que "Meus documentos". Duas situações merecem aviso, e são
diferentes:

- **Grupo abaixo de 8** — já está irregular *hoje*. Como a janela é móvel, não
  há data a informar: há uma falta em aberto, cobrada todo dia até o atirador ir
  ao clube. Esta **não** usa `timeSensitive`: sem data, o aviso se repete por 31
  dias, e furar o Foco todo dia viraria ruído.
- **Grupo completo com a 8ª mais recente perto dos 12 meses** — este tem data, o
  `perdeEm`, e entra na mesma janela de 30 dias dos documentos. A ≤ 7 dias da
  perda, aí sim fura o Foco.

A redação usa **data absoluta**, nunca contagem regressiva ("cai para 7 em
07/10/2026"). É de propósito: assim o mesmo texto vale em qualquer dia em que
for disparado, e o planejador compõe a frente uma única vez em vez de recalcular
texto dia a dia.

**E custa zero notificação.** O teto do iOS é gasto **por dia**, não por frente:
nos 3 dias detalhados o dia emite `min(frentes, 10)` avisos, e nos dias 3–30 a
habitualidade entra como **linha do resumo** em vez de virar um segundo aviso —
senão os 28 resumos virariam 56 e estourariam o orçamento. O pior caso segue em
**58 de 64**, e `planejamento.test.ts` trava isso comparando o mesmo cenário com
e sem habitualidade (`58 -> 58`).

## Alertas de vencimento

A regra do produto é: **a partir de 30 dias antes do vencimento, um aviso por dia
até regularizar** — e os vencidos seguem sendo cobrados —, com **no máximo 10
notificações por dia**.

Os avisos são **agrupados por frente**: uma notificação por arma, mais uma para
os documentos pessoais. Isso torna cada aviso acionável em vez de virar uma
lista única e ilegível:

```
🚨 Glock G25
3 documentos · 1 vencido(s)
• CRAF — venceu há 3 dias
• Guia de Tráfego — vence em 11 dias
• Autorização de Compra — vence em 24 dias
```

Vencidos e prazos de até 7 dias saem com `interruptionLevel: 'timeSensitive'`,
então furam o Foco/Não perturbe do iOS.

### O orçamento de notificações

O iOS guarda no máximo **64 notificações locais pendentes por app** e descarta o
excedente em silêncio. Com teto de 10 por dia, cobrir 30 dias daria 300. Por
isso o plano usa granularidade decrescente:

| Dias à frente | Formato | Máximo |
| --- | --- | --- |
| 0–2 | detalhado, um aviso por arma | 10/dia → 30 |
| 3–30 | um resumo único por dia | 1/dia → 28 |
| | **pior caso** | **58** (< 60 < 64) |

Se em algum dia houver mais de 10 frentes, as 9 primeiras saem individuais e o
resto vira um décimo aviso agregado (“+ 31 frentes com pendência”) — nada some
da vista sem o usuário saber.

O plano é refeito no boot, ao voltar do background (o “hoje” pode ter mudado) e
após qualquer alteração de dados, então na prática o usuário está sempre dentro
dos 3 dias detalhados.

**Os alertas não são configuráveis.** Não há interruptor nem escolha de
horário: o app dispara às 9h e pronto. Em compensação, ele precisa pedir a
permissão de notificação por conta própria — o que faz no boot, numa chamada
idempotente que não reabre o pedido se o usuário já respondeu.

A regra vive em `src/notificacoes/planejamento.ts`, um módulo puro sem nenhuma
dependência de plataforma — é o que `npm test` exercita, incluindo o pior caso
de 60 armas com 3 documentos vencidos cada.

### Caixa de avisos

O sistema não guarda histórico: notificação dispensada some. O app captura por
dois caminhos complementares (`src/notificacoes/caixa.ts`):

1. `addNotificationReceivedListener` — o que chega com o app aberto;
2. `getPresentedNotificationsAsync` — varredura da Central de Notificações na
   abertura e ao voltar do background, recuperando o que chegou com o app
   fechado.

O registro é idempotente pelo identificador da notificação, então os dois
caminhos podem ver a mesma sem duplicar. O histórico guarda os 200 mais
recentes.

## Plano gratuito e Premium

O plano grátis guarda **1 arma** com documentos e anexos ilimitados. A partir da
segunda, o cadastro leva ao paywall. Editar a arma já cadastrada nunca é
bloqueado.

**Restaurar compra** aparece em dois lugares: no paywall e em **Mais ›
Assinatura** — a App Store exige que restaurar seja acessível sem passar pelo
paywall, para quem trocou de aparelho ou reinstalou.

A cobrança real ainda **não está conectada** — exige dev build com App Store
Connect configurado. Todo o estado está isolado em `src/billing/index.ts`, que
hoje grava um flag local. Para plugar o RevenueCat, só esse arquivo muda (as
instruções estão no topo dele).

## Onde ficam os dados

Tudo local, sem servidor: SQLite (`expo-sqlite`) para os registros e
`Paths.document/acervo/<documentoId>/` para os PDFs e fotos — área privada do
app, que entra no backup do aparelho. Nenhum documento sai do celular a não ser
que o usuário toque em compartilhar.

**Atualizar o app não perde dado.** O esquema é versionado pelo `user_version` do
SQLite e as migrações rodam em sequência na abertura (`src/db/index.ts`). A v5,
que trouxe a habitualidade, é puramente aditiva: só `CREATE TABLE`, nada de
alterar ou apagar o que já estava lá.

O **backup** (`src/backup/`) leva todas as tabelas, habitualidade e locais de
tiro incluídos, na ordem que respeita as chaves estrangeiras — `locais_tiro`
antes de `habitualidades`, e `habitualidade_armas` depois de `armas` e de
`habitualidades`. `ESQUEMA_ATUAL` acompanha o `VERSAO_ALVO` do banco, e
restaurar um arquivo gerado por uma versão mais nova do app é recusado com
mensagem explícita, em vez de falhar no meio do `INSERT`.

## Estrutura

```
app/                          rotas (expo-router)
  (tabs)/                     painel, acervo (+habitualidade), avisos, pessoais, mais
  arma/[id].tsx               ficha da arma
  arma/editar.tsx             cadastro/edição de arma
  documento/[id].tsx          detalhe + anexos
  documento/editar.tsx        cadastro/edição de documento
  habitualidade/editar.tsx    registro de treino / competição
  habitualidade/locais.tsx    cadastro de clubes e estandes
  visualizador.tsx            PDF/imagem
  premium.tsx
src/
  domain/                     tipos, catálogos, vencimento, rótulos
    habitualidade.ts          núcleo puro: janela de 12 meses e contagem por grupo
  db/                         SQLite: migrações e repositórios
  arquivos/cofre.ts           anexos: cópia, leitura, abertura, exclusão
  notificacoes/
    planejamento.ts           núcleo puro: teto diário e orçamento do iOS
    index.ts                  agendador (expo-notifications)
    caixa.ts                  histórico dos avisos recebidos
  billing/                    plano grátis × premium
  estado/AppContext.tsx       estado global
  ui/                         base, formulário, cartões, agenda
    ConteudoAcervo.tsx        lista de armas   } as duas faces da aba Acervo
    ConteudoHabitualidade.tsx andamento        } (cada arquivo em app/ seria rota)
  lib/data.ts                 datas 'AAAA-MM-DD' sem fuso
  tema.ts                     paleta verde-bandeira/ouro sobre grafite
testes/planejamento.test.ts   npm test
testes/habitualidade.test.ts
```

## Legislação de referência

Levantada em setembro de 2026 e resumida na tela **Mais › Legislação** — não
substitui a norma oficial:

- **Decreto nº 11.615/2023** — CRAF do acervo de CAC com validade de 3 anos.
- **IN DG/PF nº 330/2026** — calendário escalonado de renovação de CRAF por mês
  de aniversário (31/08/2026 a 30/06/2027).
- **Portaria nº 150-COLOG/2019** — Guia de Tráfego com validade de até 36 meses.
- **Portaria nº 260-COLOG/C Ex (2025)** — GTE física com autorização da DFPC e
  validade de até 3 meses para competição internacional.
- **CR** — validade de 10 anos, confirmada pela PF em outubro de 2025.
- **Laudo de aptidão psicológica** — validade usual de 2 anos.
