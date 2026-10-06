/**
 * Variante web da caixa de avisos.
 *
 * O navegador não tem notificação local agendada, então não há Central de
 * Notificações para varrer nem nada a receber em primeiro plano. As funções
 * existem para que as telas não precisem saber em que plataforma estão — e
 * precisam existir de fato: o módulo é resolvido pelo Metro no lugar de
 * `caixa.ts`, e o que faltar aqui vira `undefined` em tempo de execução.
 */

export async function sincronizarCaixa(): Promise<void> {}

export function observarRecebidos(aoRegistrar: () => void): { remove: () => void } {
  void aoRegistrar;
  return { remove() {} };
}

export async function limparCentral(): Promise<void> {}
