import { createHash, randomInt } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import { ambiente } from '../../config/ambiente.js';
import { conferirSenha, gerarHash } from '../../auth/senha.js';
import { assinarTokenApp } from '../../auth/token.js';
import { prisma } from '../../db/cliente.js';
import {
  alterarSenhaSchema,
  cadastroAppSchema,
  confirmarEmailSchema,
  esqueciSenhaSchema,
  loginSchema,
  redefinirSenhaSchema,
} from '../../dominio/validacao.js';
import { apresentarUsuarioApp } from '../../http/apresentadores.js';
import { conflito, naoAutorizado } from '../../http/erros.js';
import { exigirApp } from '../../http/guardas.js';
import {
  emailCodigoVerificacao,
  emailResetSenha,
  enviarEmail,
} from '../../integracoes/email.js';

const VALIDADE_RESET_MS = 60 * 60 * 1000; // 1 hora
const VALIDADE_EMAIL_MS = 15 * 60 * 1000; // 15 minutos
const MAX_TENTATIVAS = 5;

function hashCodigo(codigo: string): string {
  return createHash('sha256').update(codigo).digest('hex');
}

/** Código numérico de 6 dígitos (criptograficamente seguro). */
function gerarCodigo(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

/**
 * Rotas da API v1 do usuário final do app (Carteira CAC).
 * Registradas sob o prefixo /api/v1 — versionadas para que mudanças futuras
 * (ex.: /api/v2) não quebrem apps já instalados.
 */
export async function rotasAppV1(app: FastifyInstance) {
  // ------------------------------------------------------------- cadastro
  app.post('/app/auth/cadastro', async (req, reply) => {
    const { nome, cpf, email, senha, celular } = cadastroAppSchema.parse(req.body);
    try {
      const usuario = await prisma.usuarioApp.create({
        data: { nome, cpf, email, celular, senhaHash: await gerarHash(senha) },
      });
      const token = assinarTokenApp(usuario.id);
      reply.code(201);
      return { token, usuario: apresentarUsuarioApp(usuario) };
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const alvo = String(err.meta?.target ?? '');
        if (alvo.includes('cpf')) throw conflito('Este CPF já está cadastrado');
        if (alvo.includes('email')) throw conflito('Este e-mail já está cadastrado');
        throw conflito('CPF ou e-mail já cadastrado');
      }
      throw err;
    }
  });

  // ---------------------------------------------------------------- login
  app.post('/app/auth/login', async (req) => {
    const { email, senha } = loginSchema.parse(req.body);
    const usuario = await prisma.usuarioApp.findUnique({ where: { email } });
    if (!usuario || !usuario.ativo || !(await conferirSenha(senha, usuario.senhaHash))) {
      throw naoAutorizado('E-mail ou senha inválidos');
    }
    // Login conta como atividade.
    await prisma.usuarioApp.update({
      where: { id: usuario.id },
      data: { ultimoAcessoEm: new Date() },
    });
    const token = assinarTokenApp(usuario.id);
    return { token, usuario: apresentarUsuarioApp(usuario) };
  });

  // --------------------------------------------------------------- logout
  // JWT é stateless: o logout de fato é o app descartar o token. Mantemos a
  // rota para o cliente ter um ponto único e para evolução futura (denylist).
  app.post('/app/auth/logout', { preHandler: exigirApp() }, async () => ({ ok: true }));

  // ------------------------------------------------------------------- eu
  app.get('/app/auth/eu', { preHandler: exigirApp() }, async (req) => {
    const usuario = await prisma.usuarioApp.findUnique({ where: { id: req.usuario!.id } });
    if (!usuario || !usuario.ativo) throw naoAutorizado();
    return { usuario: apresentarUsuarioApp(usuario) };
  });

  // -------------------------------------------- confirmação de e-mail (envio)
  // Gera um código de 6 dígitos e envia por e-mail. Exige sessão: o usuário
  // confirma o e-mail da própria conta. Invalida códigos pendentes anteriores.
  app.post('/app/auth/email/enviar', { preHandler: exigirApp() }, async (req) => {
    const usuario = await prisma.usuarioApp.findUnique({ where: { id: req.usuario!.id } });
    if (!usuario || !usuario.ativo) throw naoAutorizado();
    if (usuario.emailVerificado) return { ok: true, jaVerificado: true };

    const codigo = gerarCodigo();
    await prisma.$transaction([
      prisma.tokenEmail.updateMany({
        where: { usuarioId: usuario.id, usadoEm: null },
        data: { usadoEm: new Date() },
      }),
      prisma.tokenEmail.create({
        data: {
          usuarioId: usuario.id,
          codigoHash: hashCodigo(codigo),
          expiraEm: new Date(Date.now() + VALIDADE_EMAIL_MS),
        },
      }),
    ]);

    const enviado = await enviarEmail({ para: usuario.email, ...emailCodigoVerificacao(codigo) });
    req.log.info({ email: usuario.email, enviado }, 'Código de verificação de e-mail gerado');
    // Fora de produção, devolve o código para testar sem caixa de e-mail.
    const resposta: { ok: true; enviado: boolean; codigo?: string } = { ok: true, enviado };
    if (!ambiente.producao) resposta.codigo = codigo;
    return resposta;
  });

  // --------------------------------------- confirmação de e-mail (verificação)
  app.post('/app/auth/email/confirmar', { preHandler: exigirApp() }, async (req) => {
    const { codigo } = confirmarEmailSchema.parse(req.body);
    const usuario = await prisma.usuarioApp.findUnique({ where: { id: req.usuario!.id } });
    if (!usuario || !usuario.ativo) throw naoAutorizado();
    if (usuario.emailVerificado) return { ok: true, usuario: apresentarUsuarioApp(usuario) };

    const registro = await prisma.tokenEmail.findFirst({
      where: { usuarioId: usuario.id, usadoEm: null },
      orderBy: { criadoEm: 'desc' },
    });
    if (!registro || registro.expiraEm < new Date() || registro.tentativas >= MAX_TENTATIVAS) {
      throw naoAutorizado('Código inválido ou expirado. Peça um novo.');
    }
    if (registro.codigoHash !== hashCodigo(codigo)) {
      await prisma.tokenEmail.update({
        where: { id: registro.id },
        data: { tentativas: { increment: 1 } },
      });
      throw naoAutorizado('Código incorreto.');
    }

    const [atualizado] = await prisma.$transaction([
      prisma.usuarioApp.update({ where: { id: usuario.id }, data: { emailVerificado: true } }),
      prisma.tokenEmail.update({ where: { id: registro.id }, data: { usadoEm: new Date() } }),
    ]);
    return { ok: true, usuario: apresentarUsuarioApp(atualizado) };
  });

  // ------------------------------------------ troca de senha (usuário logado)
  app.post('/app/auth/senha/alterar', { preHandler: exigirApp() }, async (req) => {
    const { senhaAtual, senhaNova } = alterarSenhaSchema.parse(req.body);
    const usuario = await prisma.usuarioApp.findUnique({ where: { id: req.usuario!.id } });
    if (!usuario || !usuario.ativo) throw naoAutorizado();
    if (!(await conferirSenha(senhaAtual, usuario.senhaHash))) {
      throw naoAutorizado('Senha atual incorreta.');
    }
    await prisma.usuarioApp.update({
      where: { id: usuario.id },
      data: { senhaHash: await gerarHash(senhaNova) },
    });
    return { ok: true };
  });

  // --------------------------------------------------- esqueci minha senha
  app.post('/app/auth/senha/esqueci', async (req) => {
    const { email } = esqueciSenhaSchema.parse(req.body);
    const usuario = await prisma.usuarioApp.findUnique({ where: { email } });

    // Resposta genérica de propósito: não revela se o e-mail existe.
    const resposta: { ok: true; codigo?: string } = { ok: true };

    if (usuario && usuario.ativo) {
      const codigo = gerarCodigo();
      await prisma.$transaction([
        prisma.tokenSenha.updateMany({
          where: { usuarioId: usuario.id, usadoEm: null },
          data: { usadoEm: new Date() },
        }),
        prisma.tokenSenha.create({
          data: {
            usuarioId: usuario.id,
            tokenHash: hashCodigo(codigo),
            expiraEm: new Date(Date.now() + VALIDADE_RESET_MS),
          },
        }),
      ]);
      const enviado = await enviarEmail({ para: usuario.email, ...emailResetSenha(codigo) });
      req.log.info({ email, enviado }, 'Código de reset de senha gerado');
      if (!ambiente.producao) resposta.codigo = codigo;
    }

    return resposta;
  });

  // ----------------------------------------------------- redefinir a senha
  app.post('/app/auth/senha/redefinir', async (req) => {
    const { email, codigo, senha } = redefinirSenhaSchema.parse(req.body);
    const usuario = await prisma.usuarioApp.findUnique({ where: { email } });
    if (!usuario) throw naoAutorizado('Código inválido ou expirado');

    const registro = await prisma.tokenSenha.findFirst({
      where: { usuarioId: usuario.id, usadoEm: null },
      orderBy: { criadoEm: 'desc' },
    });
    if (!registro || registro.expiraEm < new Date() || registro.tentativas >= MAX_TENTATIVAS) {
      throw naoAutorizado('Código inválido ou expirado. Peça um novo.');
    }
    if (registro.tokenHash !== hashCodigo(codigo)) {
      await prisma.tokenSenha.update({
        where: { id: registro.id },
        data: { tentativas: { increment: 1 } },
      });
      throw naoAutorizado('Código incorreto.');
    }

    await prisma.$transaction([
      prisma.usuarioApp.update({
        where: { id: usuario.id },
        data: { senhaHash: await gerarHash(senha) },
      }),
      prisma.tokenSenha.update({ where: { id: registro.id }, data: { usadoEm: new Date() } }),
      // Invalida outros códigos pendentes do mesmo usuário.
      prisma.tokenSenha.updateMany({
        where: { usuarioId: usuario.id, usadoEm: null },
        data: { usadoEm: new Date() },
      }),
    ]);

    return { ok: true };
  });
}
