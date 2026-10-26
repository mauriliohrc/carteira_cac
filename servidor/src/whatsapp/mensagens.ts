/** Primeiro nome, capitalizado. "maria DA silva" -> "Maria". */
export function primeiroNome(nome: string): string {
  const p = (nome ?? '').trim().split(/\s+/)[0] ?? '';
  if (!p) return '';
  return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
}

/**
 * Aplica a personalização num texto de mensagem. Quando `usarNome` é true,
 * substitui `{{nome}}` pelo primeiro nome; quando false (ou sem nome), remove o
 * placeholder e limpa espaços duplicados que sobrarem.
 */
export function aplicarNome(texto: string, nome: string, usarNome = true): string {
  const alvo = usarNome ? primeiroNome(nome) : '';
  return texto
    .replace(/\{\{\s*nome\s*\}\}/gi, alvo)
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/ +([,.!?])/g, '$1')
    .trim();
}
