# CAC Brasil — Servidor (API)

Backend do aplicativo e do backoffice. **Fastify + Prisma + Zod**, em TypeScript.

Hoje roda em **SQLite** (arquivo local). Trocar para **MySQL** é mudar 1 linha +
a connection string — o código de negócio não muda (ver no fim).

## Rodar

```bash
cd servidor
cp .env.example .env            # ajuste os segredos JWT antes de produção
npm install
npx prisma migrate dev          # cria o banco (SQLite em prisma/dados/)
npm run seed                    # cria o primeiro super admin (lê SEED_* do .env)
npm run dev                     # sobe em http://localhost:3333
```

Super admin padrão do seed: `admin@cacbrasil.app` / `mudar123` — **troque em produção**.

Scripts úteis: `npm run prisma:studio` (navegar no banco), `npm run typecheck`.

## Conceito

Três públicos de login **separados de propósito** (tabelas, segredos JWT e rotas distintas):

- **Admin do app** (`UsuarioAdmin`) — dono/operador do backoffice. Cria e gere as entidades.
- **Usuário de entidade** (`UsuarioEntidade`) — administra **uma** entidade. Nunca se mistura com o admin do app.
- **Usuário final do app** (`UsuarioApp`) — o CAC que usa o aplicativo Carteira CAC. Conta
  opcional (o app funciona offline). CPF e e-mail obrigatórios, únicos e validados.

Entidade de tiro (`EntidadeTiro`): `CLUBE | LIGA | FEDERACAO`.

## Versionamento da API

As rotas consumidas pelo **aplicativo** ficam sob `/api/v1/...`. A regra: uma mudança
que quebre compatibilidade entra como `/api/v2`, deixando a `v1` intacta para os apps
já instalados. As rotas do backoffice (`/api/admin`, `/api/entidade`) não são
versionadas porque o backoffice é publicado junto com o servidor.

## Endpoints

### Autenticação
| Método | Rota | Quem |
|---|---|---|
| POST | `/api/admin/auth/login` | admin do app |
| GET  | `/api/admin/auth/eu` | admin do app |
| POST | `/api/entidade/auth/login` | usuário de entidade |
| GET  | `/api/entidade/auth/eu` | usuário de entidade |

### Entidades (exigem token de admin)
| Método | Rota |
|---|---|
| GET | `/api/admin/entidades` |
| POST | `/api/admin/entidades` |
| GET | `/api/admin/entidades/:id` |
| PATCH | `/api/admin/entidades/:id` |
| DELETE | `/api/admin/entidades/:id` |

### Usuários de uma entidade (exigem token de admin)
| Método | Rota |
|---|---|
| GET | `/api/admin/entidades/:id/usuarios` |
| POST | `/api/admin/entidades/:id/usuarios` |
| PATCH | `/api/admin/entidades/:id/usuarios/:usuarioId` |
| DELETE | `/api/admin/entidades/:id/usuarios/:usuarioId` |

### Notícias — backoffice (exigem token de admin)
| Método | Rota | Observação |
|---|---|---|
| GET | `/api/admin/noticias?pagina=1&limite=20&status=` | paginação por página; `status` filtra |
| POST | `/api/admin/noticias` | cria (status RASCUNHO por padrão) |
| GET | `/api/admin/noticias/:id` | |
| PATCH | `/api/admin/noticias/:id` | edita; mudar status ajusta `publicadaEm` |
| POST | `/api/admin/noticias/:id/publicar` | corpo `{ "publicar": true|false }` |
| DELETE | `/api/admin/noticias/:id` | |

Status da notícia: `RASCUNHO` (invisível no app) | `PUBLICADA`. Só publicadas aparecem no app.

### Competições — entidade (exigem token de ENTIDADE)
Tudo é escopado à própria entidade do token (`/api/entidade/...`).

| Método | Rota | Observação |
|---|---|---|
| GET | `/api/entidade/competicoes` | lista as competições da entidade (com nº de categorias) |
| POST | `/api/entidade/competicoes` | cria (`nome`, `dataInicio`, `dataFim`, e opcionais `descricao`, `bannerUrl`, `regras`, `ativo`) |
| GET | `/api/entidade/competicoes/:id` | detalhe + categorias (com contagem de resultados) |
| PATCH | `/api/entidade/competicoes/:id` | edita |
| DELETE | `/api/entidade/competicoes/:id` | remove (cascata: categorias e resultados) |
| POST | `/api/entidade/competicoes/:id/categorias` | cria categoria (`nome`, `ordenamento` = `MAIOR`\|`MENOR`, opcionais `descricao`, `regras`) |
| PATCH | `/api/entidade/categorias/:id` | edita categoria |
| DELETE | `/api/entidade/categorias/:id` | remove categoria |
| GET | `/api/entidade/atirador/:cpf` | prévia do nome do CPF: usuário do app → Shooting House → `NAO_ENCONTRADO` |
| GET | `/api/entidade/categorias/:id/resultados` | ranking da categoria (com `posicao`) |
| POST | `/api/entidade/categorias/:id/resultados` | lança resultado (`cpf`, `pontuacao`, `nome?`). Nome resolvido automaticamente (app → SH → manual). Relançar o mesmo CPF **atualiza** (upsert) |
| DELETE | `/api/entidade/resultados/:id` | remove um resultado |

`ordenamento`: `MAIOR` = maior pontuação vence (pontos/acertos); `MENOR` = menor vence (tempo/penalidades).

### Aplicativo — usuário final (API versionada, `/api/v1`)
| Método | Rota | Observação |
|---|---|---|
| POST | `/api/v1/app/auth/cadastro` | nome, cpf, email, senha — devolve token |
| POST | `/api/v1/app/auth/login` | email, senha — devolve token |
| POST | `/api/v1/app/auth/logout` | requer token (logout real é no cliente) |
| GET  | `/api/v1/app/auth/eu` | requer token |
| POST | `/api/v1/app/auth/senha/esqueci` | email — gera token de reset |
| POST | `/api/v1/app/auth/senha/redefinir` | token + nova senha |
| GET  | `/api/v1/app/noticias?cursor=&limite=10` | **público**; só publicadas; lista infinita por cursor |
| GET  | `/api/v1/app/noticias/:id` | **público**; só se publicada |
| GET  | `/api/v1/app/habitualidades/importar` | requer token; importa da Shooting House (ver regra abaixo) |
| GET  | `/api/v1/app/competicoes` | requer token; competições **ativas** das entidades do usuário |
| GET  | `/api/v1/app/competicoes/:id` | requer token; categorias com **Top 10** + a posição do próprio usuário |

#### Habitualidades — Shooting House (regra de contagem)

`GET /api/v1/app/habitualidades/importar` varre as entidades com integração SH
ativa, confere o CPF e devolve as sessões **já deduplicadas**. Na Shooting House
lança-se **uma habitualidade por arma**; mas no **mesmo dia e no mesmo local**
todas contam como **uma única habitualidade — um crédito por grupo de armas**.
Por isso a resposta agrupa por `(atirador, data, local)`:

```jsonc
{
  "externoId": "sh_xxxx",       // estável por (atirador, data, local) → não duplica ao reimportar
  "data": "2026-01-10",
  "tipo": "TREINO",             // "COMPETICAO" se qualquer participação do dia for de competição
  "localNome": "Clube A",
  "armas": [                     // armas distintas do dia; o app credita cada GRUPO uma vez
    { "grupo": "CC_PERMITIDA", "armaNome": ".38 nº 111" },
    { "grupo": "CLR_PERMITIDA", "armaNome": ".308 nº 333" }
  ]
}
```

O app mescla por `externoId` e cria uma sessão local com essas armas; a contagem
por grupo (`domain/habitualidade.ts`) credita cada grupo uma só vez por sessão.

> **E-mail de reset:** ainda não há envio de e-mail (SMTP/provedor). Fora de produção, o
> endpoint `esqueci` devolve o token no corpo para permitir testar o fluxo. Em produção
> (`NODE_ENV=production`) ele não é devolvido — resta integrar o envio por e-mail.

`GET /api/saude` responde o status do serviço.

## Apontar o app para a API

O app lê `EXPO_PUBLIC_API_URL`. No simulador iOS, `http://localhost:3333` (padrão) já
funciona. Para rodar em **aparelho físico**, crie um `.env` na raiz do app com o IP da
sua máquina na rede, por exemplo:

```
EXPO_PUBLIC_API_URL=http://192.168.1.10:3333
```

## Trocar SQLite → MySQL (sem impacto no código)

O Prisma Client é agnóstico ao banco. Toda a camada de negócio (`src/`) continua igual.
Só muda a configuração:

1. Suba um MySQL (ex.: Docker):
   ```bash
   docker run --name cac-mysql -e MYSQL_ROOT_PASSWORD=segredo \
     -e MYSQL_DATABASE=cacbrasil -p 3306:3306 -d mysql:8
   ```
2. Em `prisma/schema.prisma`, troque o provider:
   ```prisma
   datasource db {
     provider = "mysql"   // era "sqlite"
     url      = env("DATABASE_URL")
   }
   ```
3. No `.env`:
   ```
   DATABASE_URL="mysql://root:segredo@localhost:3306/cacbrasil"
   ```
4. Recrie as migrações para o dialeto do MySQL e gere o client:
   ```bash
   rm -rf prisma/migrations        # as migrações atuais são SQL de SQLite
   npx prisma migrate dev --name inicial
   npm run seed
   ```

O schema já evita de propósito recursos não-portáveis (enums nativos, campos `Json`),
então não há nada mais a ajustar.
