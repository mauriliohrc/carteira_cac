# App Store Connect — Assinaturas (In-App Purchases)

> App Store Connect → Carteira CAC → **Subscriptions**. Os Product IDs precisam ser EXATAMENTE estes
> (o app procura por eles): `premium_anual` e `premium_mensal`.

## Grupo de assinaturas
- **Reference Name (interno):** Premium Carteira CAC
- **Localization (pt-BR) — Subscription Group Display Name:**
```
Premium Carteira CAC
```

---

## Assinatura 1 — Anual
- **Product ID:** `premium_anual`
- **Reference Name (interno):** Premium Anual
- **Duração:** 1 ano
- **Preço sugerido:** R$ 79,90/ano
- **Display Name (pt-BR):**
```
Premium Anual
```
- **Description (pt-BR):**
```
Acervo ilimitado de armas, documentos e anexos, com alertas de vencimento para todo o acervo e backup completo. Cobrança anual.
```

## Assinatura 2 — Mensal
- **Product ID:** `premium_mensal`
- **Reference Name (interno):** Premium Mensal
- **Duração:** 1 mês
- **Preço sugerido:** R$ 9,90/mês
- **Display Name (pt-BR):**
```
Premium Mensal
```
- **Description (pt-BR):**
```
Acervo ilimitado de armas, documentos e anexos, com alertas de vencimento para todo o acervo e backup completo. Cobrança mensal, cancele quando quiser.
```

---

## Review Screenshot (obrigatório em CADA assinatura)
Anexe o print do paywall: `store/screenshots/paywall.png` (o mesmo que já te enviei).

## Review Notes (para o revisor)
```
A assinatura é ativada tocando em "Assinar Premium" na tela de Premium (aba Mais → Plano).
Ela libera o acervo ilimitado (o plano grátis permite 1 arma). Há botão "Restaurar compra".
Não há login nem servidor: o desbloqueio é registrado no próprio aparelho via StoreKit.
```

## IMPORTANTE — como enviar (resolve o erro "must be submitted with an app version")
Assinatura de um grupo NOVO não é enviada sozinha. Faça:
1. Suba um build (eas build + eas submit) e crie a versão 1.0.
2. Na página da versão 1.0 → seção "In-App Purchases and Subscriptions" → adicione as duas.
3. Envie a VERSÃO para revisão (as assinaturas vão junto).
