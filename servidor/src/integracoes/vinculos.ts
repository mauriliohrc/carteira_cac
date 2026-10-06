import { prisma } from '../db/cliente.js';
import { verificarParceiro } from './shootinghouse.js';

/**
 * Verifica a filiação do usuário nas entidades parceiras (Shooting House) e
 * cria o vínculo usuário↔entidade quando ele consta como sócio ATIVO e
 * ADIMPLENTE. Um usuário pode ficar vinculado a várias entidades.
 * Só adiciona (não remove vínculos existentes). Devolve quantos vínculos novos.
 */
export async function sincronizarVinculosSH(usuarioId: string, cpf: string): Promise<number> {
  const entidades = await prisma.entidadeTiro.findMany({
    where: { shIntegracaoAtiva: true, shLogin: { not: null }, shSenha: { not: null } },
    select: { id: true, shBaseUrl: true, shLogin: true, shSenha: true },
  });
  if (entidades.length === 0) return 0;

  const elegiveis: string[] = [];
  for (const e of entidades) {
    const v = await verificarParceiro(
      { baseUrl: e.shBaseUrl, login: e.shLogin!, senha: e.shSenha! },
      cpf
    );
    if (v.membro && v.ativo && v.adimplente) elegiveis.push(e.id);
  }
  if (elegiveis.length === 0) return 0;

  const existentes = new Set(
    (
      await prisma.vinculoEntidade.findMany({
        where: { usuarioId, entidadeId: { in: elegiveis } },
        select: { entidadeId: true },
      })
    ).map((x) => x.entidadeId)
  );
  const novos = elegiveis.filter((id) => !existentes.has(id));
  if (novos.length === 0) return 0;

  await prisma.vinculoEntidade.createMany({
    data: novos.map((entidadeId) => ({ usuarioId, entidadeId, origem: 'SHOOTING_HOUSE' })),
  });
  return novos.length;
}
