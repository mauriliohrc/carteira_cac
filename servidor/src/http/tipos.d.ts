import type { Autenticado } from '../dominio/tipos.js';

declare module 'fastify' {
  interface FastifyRequest {
    /** Preenchido pelos guards de autenticação. */
    usuario?: Autenticado;
  }
}
