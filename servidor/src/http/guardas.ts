import type { FastifyReply, FastifyRequest } from 'fastify';
import { verificarToken } from '../auth/token.js';
import type { PapelAdmin } from '../dominio/tipos.js';
import { naoAutorizado, proibido } from './erros.js';

function extrairToken(req: FastifyRequest): string {
  const cabecalho = req.headers.authorization;
  if (!cabecalho?.startsWith('Bearer ')) {
    throw naoAutorizado('Token ausente');
  }
  return cabecalho.slice('Bearer '.length).trim();
}

/** Exige um admin do APP autenticado. */
export function exigirAdmin(papeis?: PapelAdmin[]) {
  return async (req: FastifyRequest, _reply: FastifyReply) => {
    let usuario;
    try {
      usuario = verificarToken(extrairToken(req), 'ADMIN');
    } catch {
      throw naoAutorizado('Token inválido ou expirado');
    }
    if (papeis && !papeis.includes(usuario.papel as PapelAdmin)) {
      throw proibido('Papel insuficiente');
    }
    req.usuario = usuario;
  };
}

/** Exige um usuário de ENTIDADE autenticado. */
export function exigirEntidade() {
  return async (req: FastifyRequest, _reply: FastifyReply) => {
    try {
      req.usuario = verificarToken(extrairToken(req), 'ENTIDADE');
    } catch {
      throw naoAutorizado('Token inválido ou expirado');
    }
  };
}

/** Exige um usuário FINAL do app (Carteira CAC) autenticado. */
export function exigirApp() {
  return async (req: FastifyRequest, _reply: FastifyReply) => {
    try {
      req.usuario = verificarToken(extrairToken(req), 'APP');
    } catch {
      throw naoAutorizado('Token inválido ou expirado');
    }
  };
}

/**
 * Lê o usuário do app se houver token válido; não falha se não houver.
 * Usado em rotas públicas que se comportam diferente para logados (ex.: registro
 * de dispositivo de push, que pode ser anônimo).
 */
export function usuarioAppOpcional(req: FastifyRequest): string | null {
  const cabecalho = req.headers.authorization;
  if (!cabecalho?.startsWith('Bearer ')) return null;
  try {
    return verificarToken(cabecalho.slice('Bearer '.length).trim(), 'APP').id;
  } catch {
    return null;
  }
}
