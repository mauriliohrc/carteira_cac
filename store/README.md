# Assets e textos para a App Store — Carteira CAC

Tudo o que você precisa para submeter o app e as assinaturas está aqui.

## 📁 Estrutura
```
store/
├─ icon/
│  ├─ icone-1024.png        ← ícone do app (1024×1024, já aplicado em assets/icon.png)
│  ├─ appstore-1024.png     ← mesma arte SEM canal alfa (exigência da App Store)
│  └─ android-foreground.png← foreground do adaptive icon (Android)
├─ splash/
│  └─ splash-full.png       ← arte da splash (já aplicada em assets/splash-icon.png)
├─ screenshots/
│  ├─ 6.9/                  ← 7 telas em 1320×2868 (iPhone 6,9" — tamanho exigido pela Apple)
│  └─ paywall.png           ← "Review Screenshot" das assinaturas
└─ metadata/                ← TODOS os textos (listagem, assinaturas, permissões, revisão)
```

## ✅ Já aplicado no código
- **Ícone** novo em `assets/icon.png` (+ favicon e foreground do Android).
- **Splash** nova em `assets/splash-icon.png`, fundo verde `#0F3D1E` (`app.json`).
- **Cores** do adaptive icon Android → verde.
- **iPad desativado** (`supportsTablet: false`) → não precisa de screenshots de iPad.
> Esses assets entram no binário no próximo build (EAS/prebuild).

## 🖼️ Screenshots (App Store Connect → versão 1.0 → Previews and Screenshots)
Suba a pasta `screenshots/6.9/` no slot **iPhone 6.9"**. Esse tamanho cobre todos os iPhones
menores automaticamente. Ordem sugerida: Painel → Acervo → Arma → Documento → Avisos → Segurança → Premium.

## 📝 Textos — pasta `metadata/`
1. `01-listagem-app-store.md` — nome, subtítulo, descrição, palavras-chave, categorias, etc.
2. `02-assinaturas.md` — textos das assinaturas + como enviá-las junto com a versão.
3. `03-permissoes-privacidade.md` — permissões, App Privacy, export compliance.
4. `04-notas-de-revisao.md` — nota para o revisor (importante: contexto de "documentos", não venda de armas).

## ⚠️ Pendências suas (fora do meu alcance)
- **URL de Política de Privacidade e de Suporte** no ar (obrigatórias).
- **Paid Apps Agreement** + dados bancários/fiscais assinados.
- **Subir um build** (eas build + eas submit) e criar a **versão 1.0** — as assinaturas vão junto.
