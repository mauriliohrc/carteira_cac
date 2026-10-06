/**
 * "Segundo onboarding" (conta) — disparo diferido.
 *
 * O primeiro onboarding é renderizado ANTES do <Stack> montar (a Raiz mostra o
 * onboarding no lugar do navegador), então não dá para navegar de dentro dele.
 * Ao concluir o primeiro onboarding marcamos aqui que o convite de conta fica
 * pendente; a Raiz consome assim que a Stack principal monta (navegador pronto)
 * e aí sim abre a tela de cadastro/login. Fica em memória de propósito: é um
 * disparo único por conclusão de onboarding, não precisa persistir.
 */
let pendente = false;

/** Chamado ao concluir o PRIMEIRO onboarding. */
export function marcarContaOnboardingPendente(): void {
  pendente = true;
}

/** Devolve e limpa a pendência (consumo único). */
export function consumirContaOnboardingPendente(): boolean {
  const p = pendente;
  pendente = false;
  return p;
}
