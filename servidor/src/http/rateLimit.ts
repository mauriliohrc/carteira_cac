import type { FastifyReply, FastifyRequest } from 'fastify';
import { muitasRequisicoes } from './erros.js';

/**
 * Rate-limit simples em memória (janela fixa por IP + rota), para endpoints
 * sensíveis não autenticados: login, cadastro e reset de senha. Protege contra
 * brute-force de senha/token e enumeração/spam de e-mail, sem dependência
 * externa. É por processo (não distribuído) — suficiente para o deploy atual de
 * instância única; se escalar horizontalmente, migrar para um store compartilhado.
 */
type Balde = { contagem: number; reset: number };
const baldes = new Map<string, Balde>();

function limpar(agora: number): void {
  // Varredura preguiçosa: só quando o mapa cresce, remove janelas expiradas.
  if (baldes.size < 5000) return;
  for (const [k, v] of baldes) if (v.reset < agora) baldes.delete(k);
}

export function limitarTaxa(opts: { max: number; janelaMs: number; nome: string }) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    const agora = Date.now();
    limpar(agora);
    const chave = `${opts.nome}:${req.ip}`;
    let b = baldes.get(chave);
    if (!b || b.reset < agora) {
      b = { contagem: 0, reset: agora + opts.janelaMs };
      baldes.set(chave, b);
    }
    b.contagem++;
    if (b.contagem > opts.max) {
      const retry = Math.max(1, Math.ceil((b.reset - agora) / 1000));
      reply.header('Retry-After', String(retry));
      throw muitasRequisicoes(`Muitas tentativas. Tente novamente em ${retry}s.`);
    }
  };
}
