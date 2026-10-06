import type { FastifyInstance } from 'fastify';
import { conferirSenha } from '../auth/senha.js';
import { assinarTokenAdmin, assinarTokenEntidade } from '../auth/token.js';
import { prisma } from '../db/cliente.js';
import { loginSchema } from '../dominio/validacao.js';
import type { PapelAdmin, PapelEntidade } from '../dominio/tipos.js';
import { apresentarAdmin, apresentarUsuarioEntidade } from '../http/apresentadores.js';
import { naoAutorizado } from '../http/erros.js';
import { exigirAdmin, exigirEntidade } from '../http/guardas.js';

export async function rotasAutenticacao(app: FastifyInstance) {
  // ---------------------------------------------------- Admin do aplicativo
  app.post('/api/admin/auth/login', async (req) => {
    const { email, senha } = loginSchema.parse(req.body);
    const admin = await prisma.usuarioAdmin.findUnique({ where: { email } });
    if (!admin || !admin.ativo || !(await conferirSenha(senha, admin.senhaHash))) {
      throw naoAutorizado('E-mail ou senha inválidos');
    }
    const token = assinarTokenAdmin(admin.id, admin.papel as PapelAdmin);
    return { token, usuario: apresentarAdmin(admin) };
  });

  app.get('/api/admin/auth/eu', { preHandler: exigirAdmin() }, async (req) => {
    const admin = await prisma.usuarioAdmin.findUnique({ where: { id: req.usuario!.id } });
    if (!admin) throw naoAutorizado();
    return { usuario: apresentarAdmin(admin) };
  });

  // -------------------------------------------------- Usuário de entidade
  app.post('/api/entidade/auth/login', async (req) => {
    const { email, senha } = loginSchema.parse(req.body);
    // E-mail pode repetir entre entidades; pega todos e confere a senha.
    const candidatos = await prisma.usuarioEntidade.findMany({ where: { email } });
    for (const u of candidatos) {
      if (u.ativo && (await conferirSenha(senha, u.senhaHash))) {
        const entidade = await prisma.entidadeTiro.findUnique({ where: { id: u.entidadeId } });
        if (!entidade || !entidade.ativo) continue;
        const token = assinarTokenEntidade(u.id, u.papel as PapelEntidade, u.entidadeId);
        return {
          token,
          usuario: apresentarUsuarioEntidade(u),
          entidade: { id: entidade.id, nome: entidade.nome, tipo: entidade.tipo },
        };
      }
    }
    throw naoAutorizado('E-mail ou senha inválidos');
  });

  app.get('/api/entidade/auth/eu', { preHandler: exigirEntidade() }, async (req) => {
    const u = await prisma.usuarioEntidade.findUnique({ where: { id: req.usuario!.id } });
    if (!u) throw naoAutorizado();
    const entidade = await prisma.entidadeTiro.findUnique({ where: { id: u.entidadeId } });
    return {
      usuario: apresentarUsuarioEntidade(u),
      entidade: entidade && { id: entidade.id, nome: entidade.nome, tipo: entidade.tipo },
    };
  });
}
