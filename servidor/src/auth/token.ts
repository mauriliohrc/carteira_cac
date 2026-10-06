import jwt, { type SignOptions } from 'jsonwebtoken';
import { ambiente } from '../config/ambiente.js';

const opcoes: SignOptions = { expiresIn: ambiente.jwt.expiracao as SignOptions['expiresIn'] };
const opcoesApp: SignOptions = {
  expiresIn: ambiente.jwt.expiracaoApp as SignOptions['expiresIn'],
};
import type {
  Autenticado,
  EscopoAutenticacao,
  PapelAdmin,
  PapelEntidade,
} from '../dominio/tipos.js';

interface PayloadAdmin {
  sub: string;
  escopo: 'ADMIN';
  papel: PapelAdmin;
}

interface PayloadEntidade {
  sub: string;
  escopo: 'ENTIDADE';
  papel: PapelEntidade;
  entidadeId: string;
}

interface PayloadApp {
  sub: string;
  escopo: 'APP';
}

type Payload = PayloadAdmin | PayloadEntidade | PayloadApp;

export function assinarTokenAdmin(id: string, papel: PapelAdmin): string {
  const payload: PayloadAdmin = { sub: id, escopo: 'ADMIN', papel };
  return jwt.sign(payload, ambiente.jwt.segredoAdmin, opcoes);
}

export function assinarTokenEntidade(
  id: string,
  papel: PapelEntidade,
  entidadeId: string
): string {
  const payload: PayloadEntidade = { sub: id, escopo: 'ENTIDADE', papel, entidadeId };
  return jwt.sign(payload, ambiente.jwt.segredoEntidade, opcoes);
}

export function assinarTokenApp(id: string): string {
  const payload: PayloadApp = { sub: id, escopo: 'APP' };
  return jwt.sign(payload, ambiente.jwt.segredoApp, opcoesApp);
}

const SEGREDO: Record<EscopoAutenticacao, string> = {
  ADMIN: ambiente.jwt.segredoAdmin,
  ENTIDADE: ambiente.jwt.segredoEntidade,
  APP: ambiente.jwt.segredoApp,
};

/**
 * Verifica o token conforme o escopo esperado, usando o segredo correspondente.
 * Segredos distintos garantem que um token de um público nunca valha em outro.
 */
export function verificarToken(token: string, escopo: EscopoAutenticacao): Autenticado {
  const decodificado = jwt.verify(token, SEGREDO[escopo]) as Payload;

  if (decodificado.escopo !== escopo) {
    throw new Error('Escopo do token não corresponde');
  }

  return {
    id: decodificado.sub,
    escopo: decodificado.escopo,
    papel: decodificado.escopo === 'APP' ? undefined : decodificado.papel,
    entidadeId: decodificado.escopo === 'ENTIDADE' ? decodificado.entidadeId : undefined,
  };
}
