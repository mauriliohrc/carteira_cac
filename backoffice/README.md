# CAC Brasil — Backoffice

Painel administrativo em **Next.js (App Router) + React**. Consome a API do `servidor/`.

## Rodar

Suba a API primeiro (ver `servidor/README.md`). Depois:

```bash
cd backoffice
cp .env.local.example .env.local   # NEXT_PUBLIC_API_URL aponta para a API
npm install
npm run dev                        # http://localhost:3000
```

Entre com o super admin criado pelo seed do servidor
(`admin@cacbrasil.app` / `mudar123` por padrão).

## O que dá para fazer

- Login do admin do app (token JWT guardado no navegador).
- Listar, criar, editar e excluir **entidades de tiro** (clube / liga / federação).
- Em cada entidade, gerenciar seus **usuários administrativos** (criar, ativar/desativar, excluir).

O login dos usuários de entidade é feito pela API (`/api/entidade/auth/login`) — este
backoffice é a ferramenta do **dono do app**.
