/** Mesma validação do servidor, repetida no cliente para feedback imediato. */

export function limparCPF(valor: string): string {
  return valor.replace(/\D/g, '');
}

/** Aplica a máscara 000.000.000-00 enquanto o usuário digita. */
export function mascaraCPF(texto: string): string {
  const n = limparCPF(texto).slice(0, 11);
  if (n.length <= 3) return n;
  if (n.length <= 6) return `${n.slice(0, 3)}.${n.slice(3)}`;
  if (n.length <= 9) return `${n.slice(0, 3)}.${n.slice(3, 6)}.${n.slice(6)}`;
  return `${n.slice(0, 3)}.${n.slice(3, 6)}.${n.slice(6, 9)}-${n.slice(9)}`;
}

export function validarCPF(valor: string): boolean {
  const cpf = limparCPF(valor);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  const digito = (ate: number): number => {
    let soma = 0;
    for (let i = 0; i < ate; i++) {
      soma += Number(cpf[i]) * (ate + 1 - i);
    }
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };

  return digito(9) === Number(cpf[9]) && digito(10) === Number(cpf[10]);
}

const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function emailValido(valor: string): boolean {
  return RE_EMAIL.test(valor.trim());
}
