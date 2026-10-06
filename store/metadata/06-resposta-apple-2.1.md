# Resposta à Apple — Guideline 2.1 (Information Needed)

> Cole este texto na resposta do **Resolution Center** E também no campo
> **App Review Information → Notes** (para as próximas submissões). Está em inglês, o idioma dos revisores.

---

Hello, thank you for the review. Below are the requested details.

**1. Screen recording**
A screen recording captured on a physical iPhone is attached, starting from app launch and showing the typical user flow: onboarding, adding a firearm, adding a document with an expiration date, attaching a photo/PDF, the expiration alerts, and unlocking the paid Premium feature.

**2. Purpose and target audience**
Carteira CAC ("CAC Wallet") is a PERSONAL DOCUMENT ORGANIZER for Brazilian sport shooters, hunters and collectors — individuals legally registered as "CAC" (Colecionador, Atirador e Caçador) under Brazilian Army and Federal Police regulations. These citizens must keep several regulatory documents valid (CRAF – firearm registration card; Guia de Tráfego – transport permit; psychological/technical reports; CR – collector's certificate), each with its own expiration date. Missing a renewal deadline leads to fines and legal problems. The app solves this by storing the documents locally, tracking each expiration date, and reminding the user before each document expires. Target audience: the general public of legally registered Brazilian CACs (a consumer app — NOT an internal/enterprise app).

**3. Setup and how to access the main features**
- No account, login or registration is required. Just open the app.
- On first launch there is a short onboarding that requests notification permission (used only for LOCAL expiration reminders).
- Main flow to test: tap "Cadastrar primeira arma" to add a firearm → add a document (e.g., a CRAF) with a due date → attach a photo or PDF. The dashboard then shows what is expiring.
- To access the paid feature (Premium – unlimited collection) WITHOUT paying, for review: open the "Mais" tab → "Código promocional" → enter the code:  Rocambole do Dino
  This unlocks Premium (the free tier allows 1 firearm). The paywall ("Assinar Premium") also works with a StoreKit sandbox account.
- No sample files or credentials are needed; the reviewer creates their own records.

**4. External services / tools used for core functionality**
- Apple StoreKit — used only for the auto-renewable subscriptions (Premium). This is the only external service in the core functionality.
- There is NO backend server, NO third-party analytics, NO advertising, NO AI services, NO external data providers and NO authentication service. All data is stored locally on the device and nothing is transmitted.

**5. Regional differences**
The app functions consistently across all regions. It is offered in Portuguese (Brazil) and designed for Brazilian regulation. There are no region-locked features or content differences.

**6. Regulated industry / third-party protected material**
Carteira CAC does NOT provide a regulated service and does NOT sell, buy, trade, broker or facilitate the acquisition of firearms, ammunition or any weapon. It has no marketplace and no links to purchase weapons, and it does not display violence or firearms in use. It is simply a private organizer for the user's OWN legal documents — comparable to a digital folder or a license-renewal reminder. Therefore no special authorization or third-party credentials are required to offer this functionality. It is a consumer app for the general public, not intended for a specific business, organization or employees.

**User-generated content note:** the only user-generated content is the user's own private documents and photos, added by and for themselves. This content is stored locally, is never uploaded, shared or made public, and there is no social or sharing feature — so content reporting/blocking mechanisms do not apply.

Thank you.
