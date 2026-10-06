/** Remove tudo que não for dígito. */
export function limparCPF(valor: string): string {
  return valor.replace(/\D/g, '');
}

/**
 * Valida CPF pelos dígitos verificadores. Recebe com ou sem máscara.
 * Rejeita tamanho errado e sequências repetidas (000..., 111..., etc.).
 */
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
