import type { Arma } from './tipos';

/** Como a arma aparece em listas, fichas e notificações. */
export function nomeArma(a: Arma): string {
  return a.apelido?.trim() || [a.marca, a.modelo].filter(Boolean).join(' ') || a.modelo;
}
