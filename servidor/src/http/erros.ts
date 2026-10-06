/** Erro com status HTTP, tratado pelo handler global do Fastify. */
export class ErroHttp extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = 'ErroHttp';
  }
}

export const naoAutorizado = (msg = 'Não autorizado') => new ErroHttp(401, msg);
export const proibido = (msg = 'Acesso negado') => new ErroHttp(403, msg);
export const naoEncontrado = (msg = 'Não encontrado') => new ErroHttp(404, msg);
export const conflito = (msg = 'Conflito') => new ErroHttp(409, msg);
export const invalido = (msg = 'Requisição inválida') => new ErroHttp(400, msg);
