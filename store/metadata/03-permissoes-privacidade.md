# Permissões, Capacidades e Privacidade — o que a Apple pede e os textos

## 1. Permissões (Info.plist) — já configuradas no app.json
Estas frases aparecem no diálogo que o iOS mostra ao usuário. Já estão no app, revisadas e em PT-BR:

| Permissão | Chave (Info.plist) | Texto |
|---|---|---|
| Câmera | `NSCameraUsageDescription` | "A Carteira CAC usa a câmera para você fotografar seus documentos — CRAF, guia de tráfego, laudo e CR — e anexá-los à carteira. As fotos ficam salvas só neste aparelho." |
| Fotos | `NSPhotoLibraryUsageDescription` | "A Carteira CAC usa suas fotos para você anexar imagens dos seus documentos — CRAF, guia de tráfego, laudo e CR — à carteira. As imagens ficam salvas só neste aparelho." |
| Face ID | `NSFaceIDUsageDescription` | "A Carteira CAC usa o Face ID para desbloquear o app sem digitar o PIN, mantendo seu acervo privado." |

**Notificações:** não têm frase no Info.plist — o iOS pede em tempo de execução. O app usa **apenas
notificações locais** (avisos de vencimento agendados no próprio aparelho). Não há push nem servidor.

**Não declaramos** microfone (removido de propósito) nem localização, contatos, calendário, etc.

## 2. Capacidades / Entitlements
| Capacidade | De onde vem | Uso real |
|---|---|---|
| In-App Purchase | Assinaturas | Premium (acervo ilimitado). |
| Keychain (`keychain-access-groups`) | expo-secure-store | Guardar o hash do PIN de bloqueio, com segurança. |
| Push (`aps-environment`) | expo-notifications | Só notificações **locais**; não há servidor de push. Pode manter — é inofensivo. |

## 3. App Privacy (Nutrition Label) — responda no App Store Connect
O app **NÃO coleta dados**. Não há servidor, login, analytics ou anúncios. Tudo fica no aparelho.

- **Data Collection:** selecione **"No, we do not collect data from this app."**
- Isso gera o rótulo **"Data Not Collected"** — o mais forte possível. Não precisa detalhar mais nada.

> Observação: câmera, fotos e documentos anexados **nunca saem do aparelho** — não são "coletados".

## 4. Export Compliance (criptografia)
O app usa criptografia **padrão** (AES-256) apenas para proteger os dados do próprio usuário
(backup com senha e hash do PIN). Isso se enquadra na **isenção**.
- No `app.json` já está `ITSAppUsesNonExemptEncryption: false`.
- Ao enviar, se perguntar: **"Does your app use encryption?" → Yes**;
  **"Does it qualify for the exemptions?" → Yes** (criptografia padrão, dados do próprio usuário).
- Resultado: **não precisa** de documentação extra (nem da ERN francesa).

## 5. Login / Conta
O app **não tem cadastro nem login**. Não é preciso conta para usar. Portanto:
- **Sign in with Apple:** não se aplica (o app não oferece login de terceiros).
- Não há credenciais de teste a fornecer.
