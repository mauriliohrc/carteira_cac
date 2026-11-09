import type { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import { prisma } from '../db/cliente.js';
import { JANELA_ONLINE_MIN } from '../dominio/tipos.js';
import {
  addVinculoSchema,
  editarUsuarioAppSchema,
  enviarPushSchema,
  enviarPushHabitualidadeSchema,
} from '../dominio/validacao.js';
import { enviarPush, enviarPushLote, type ItemPush } from '../push/expo.js';
import { progressoHabitualidade } from '../dominio/habitualidadeProgresso.js';
import { conflito, naoEncontrado } from '../http/erros.js';
import { exigirAdmin } from '../http/guardas.js';
import { buscarArmas } from '../integracoes/shootinghouse.js';

/** Público como filtros combináveis (AND). Ver `publicoPushSchema`. */
type Publico = {
  base: 'CONTAS' | 'TODOS' | 'ANONIMOS' | 'USUARIO';
  usuarioId?: string;
  plataformas?: ('IOS' | 'ANDROID')[];
  entidadeId?: string;
  excluirEntidadeIds?: string[];
  semArma?: boolean;
  semEmail?: boolean;
  inativosDias?: number;
  versaoMenorQue?: string;
};

function estaOnline(ultimoAcessoEm: Date | null): boolean {
  if (!ultimoAcessoEm) return false;
  return Date.now() - ultimoAcessoEm.getTime() < JANELA_ONLINE_MIN * 60_000;
}

/**
 * Compara versões de marketing ("1.8.1" vs "1.8.0") por segmentos numéricos.
 * Retorna <0 se a<b, 0 se iguais, >0 se a>b. Segmentos ausentes contam como 0.
 */
function compararVersao(a: string, b: string): number {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

/** Resumo legível do público, guardado no histórico (coluna alvoTipo). */
function resumoPublico(p: Publico): string {
  const partes: string[] = [
    p.base === 'TODOS'
      ? 'Todos'
      : p.base === 'ANONIMOS'
        ? 'Sem cadastro'
        : p.base === 'USUARIO'
          ? 'Um usuário'
          : 'Contas',
  ];
  if (p.plataformas?.length === 1) partes.push(p.plataformas[0] === 'IOS' ? 'iOS' : 'Android');
  if (p.entidadeId) partes.push('Entidade');
  if (p.excluirEntidadeIds?.length)
    partes.push(`Exceto ${p.excluirEntidadeIds.length} entidade(s)`);
  if (p.semArma) partes.push('Sem arma');
  if (p.semEmail) partes.push('E-mail não validado');
  if (p.inativosDias) partes.push(`Inativos ${p.inativosDias}d`);
  if (p.versaoMenorQue) partes.push(`Desatualizados (< ${p.versaoMenorQue})`);
  return partes.join(' · ');
}

/**
 * Resolve os tokens de aparelho conforme os filtros combinados (AND).
 * `base` decide o ponto de partida; os demais campos restringem. ANONIMOS só
 * aceita o filtro de plataforma; os de conta não se aplicam a quem não tem conta.
 */
async function tokensDoPublico(p: Publico): Promise<{ tokens: string[]; totalUsuarios: number }> {
  const porPlataforma: Prisma.DispositivoPushWhereInput = p.plataformas?.length
    ? { plataforma: { in: p.plataformas } }
    : {};
  const temFiltroConta = !!(p.entidadeId || p.semArma || p.semEmail || p.inativosDias);
  const sel = { token: true, appVersao: true } as const;

  let disp: { token: string; appVersao: string | null }[] = [];
  let totalUsuarios = 0;

  if (p.base === 'ANONIMOS') {
    // Sem cadastro: aparelhos anônimos (sem usuário).
    disp = await prisma.dispositivoPush.findMany({
      where: { ativo: true, usuarioId: null, ...porPlataforma },
      select: sel,
    });
  } else if (p.base === 'TODOS' && !temFiltroConta) {
    // Todos SEM filtro de conta: contas + anônimos (só plataforma restringe).
    disp = await prisma.dispositivoPush.findMany({
      where: { ativo: true, ...porPlataforma },
      select: sel,
    });
    totalUsuarios = await prisma.usuarioApp.count({ where: { ativo: true } });
  } else {
    // Contas / usuário / "todos" COM filtro de conta: resolve os usuários que
    // casam (AND) e pega os aparelhos deles.
    const where: Prisma.UsuarioAppWhereInput = { ativo: true };
    if (p.base === 'USUARIO' && p.usuarioId) where.id = p.usuarioId;
    if (p.entidadeId) where.vinculos = { some: { entidadeId: p.entidadeId } };
    if (p.semArma) where.registrosSync = { none: { tipo: 'armas', removido: false } };
    if (p.semEmail) where.emailVerificado = false;
    if (p.inativosDias) {
      const corte = new Date(Date.now() - p.inativosDias * 86_400_000);
      where.OR = [{ ultimoAcessoEm: null }, { ultimoAcessoEm: { lt: corte } }];
    }
    const usuarios = await prisma.usuarioApp.findMany({ where, select: { id: true } });
    const ids = usuarios.map((u) => u.id);
    totalUsuarios = ids.length;
    disp = ids.length
      ? await prisma.dispositivoPush.findMany({
          where: { usuarioId: { in: ids }, ativo: true, ...porPlataforma },
          select: sel,
        })
      : [];
  }

  // Exclusão por entidade (vale para qualquer base; anônimos nunca têm vínculo).
  if (p.excluirEntidadeIds?.length) {
    const excluidos = await prisma.dispositivoPush.findMany({
      where: {
        ativo: true,
        usuario: { vinculos: { some: { entidadeId: { in: p.excluirEntidadeIds } } } },
      },
      select: { token: true },
    });
    const bloqueados = new Set(excluidos.map((d) => d.token));
    disp = disp.filter((d) => !bloqueados.has(d.token));
  }

  // Desatualizados: só aparelhos com versão MENOR que a pedida (null = app
  // antigo sem versão, o mais desatualizado de todos, também entra).
  const corte = p.versaoMenorQue;
  const tokens = (
    corte
      ? disp.filter((d) => d.appVersao == null || compararVersao(d.appVersao, corte) < 0)
      : disp
  ).map((d) => d.token);

  return { tokens, totalUsuarios };
}

/**
 * `where` de CONTAS a partir do público, para disparos que precisam dos dados
 * de cada usuário (não só dos tokens). Só vale para quem tem conta — ANONIMOS
 * não se aplica. Mesmos filtros combináveis (AND) de `tokensDoPublico`.
 */
function whereUsuariosPublico(p: Publico): Prisma.UsuarioAppWhereInput {
  const where: Prisma.UsuarioAppWhereInput = { ativo: true };
  if (p.base === 'USUARIO' && p.usuarioId) where.id = p.usuarioId;
  if (p.entidadeId) where.vinculos = { some: { entidadeId: p.entidadeId } };
  if (p.excluirEntidadeIds?.length)
    where.NOT = { vinculos: { some: { entidadeId: { in: p.excluirEntidadeIds } } } };
  if (p.semArma) where.registrosSync = { none: { tipo: 'armas', removido: false } };
  if (p.semEmail) where.emailVerificado = false;
  if (p.inativosDias) {
    const corte = new Date(Date.now() - p.inativosDias * 86_400_000);
    where.OR = [{ ultimoAcessoEm: null }, { ultimoAcessoEm: { lt: corte } }];
  }
  return where;
}

/** Substitui as variáveis do modelo pelos valores do usuário. */
function aplicarModelo(
  modelo: string,
  v: { nome: string; feitas: number; faltam: number }
): string {
  return modelo
    .replace(/\{nome\}/g, v.nome)
    .replace(/\{feitas\}/g, String(v.feitas))
    .replace(/\{faltam\}/g, String(v.faltam));
}

export async function rotasPushAdmin(app: FastifyInstance) {
  app.addHook('preHandler', exigirAdmin());

  // ------------------------------------------------- usuários do aplicativo
  app.get('/api/admin/usuarios-app', async (req) => {
    const q = req.query as {
      pagina?: string;
      limite?: string;
      busca?: string;
      ordenar?: string;
      direcao?: string;
    };
    const pagina = Math.max(1, Number(q.pagina) || 1);
    const limite = Math.min(100, Math.max(1, Number(q.limite) || 20));
    const busca = (q.busca ?? '').trim();
    const dir: 'asc' | 'desc' = q.direcao === 'asc' ? 'asc' : 'desc';
    // Colunas ordenáveis no servidor (a lista é paginada, então a ordenação
    // precisa ir ao banco). A contagem de armas da SH é externa e não entra.
    const orderBy: Prisma.UsuarioAppOrderByWithRelationInput = (() => {
      switch (q.ordenar) {
        case 'nome':
          return { nome: dir };
        case 'email':
          return { email: dir };
        case 'celular':
          return { celular: dir };
        case 'premium':
          return { premium: dir };
        case 'emailVerificado':
          return { emailVerificado: dir };
        case 'ultimoAcesso':
          return { ultimoAcessoEm: dir };
        case 'dispositivos':
          return { dispositivos: { _count: dir } };
        case 'entidades':
          // Ordena pela quantidade de vínculos de entidade (contagem no banco).
          return { vinculos: { _count: dir } };
        case 'criadoEm':
        default:
          return { criadoEm: dir };
      }
    })();

    const where: Prisma.UsuarioAppWhereInput = (() => {
      if (!busca) return {};
      const OR: Prisma.UsuarioAppWhereInput[] = [
        { nome: { contains: busca } },
        { email: { contains: busca } },
      ];
      // Só filtra por CPF quando o termo tem dígitos — senão `contains('')`
      // casaria com todo mundo.
      const digitos = busca.replace(/\D/g, '');
      if (digitos) OR.push({ cpf: { contains: digitos } });
      return { OR };
    })();

    const include = {
      vinculos: { include: { entidade: { select: { id: true, nome: true } } } },
      dispositivos: { where: { ativo: true }, select: { plataforma: true, appVersao: true } },
      _count: { select: { registrosSync: { where: { tipo: 'armas', removido: false } } } },
    } satisfies Prisma.UsuarioAppInclude;

    let total: number;
    let lista: Prisma.UsuarioAppGetPayload<{ include: typeof include }>[];

    if (q.ordenar === 'armas') {
      // "Armas" é uma contagem FILTRADA (registrosSync tipo=armas), que o Prisma
      // não ordena no banco. Como a base de usuários é pequena (admin), carrega
      // os que casam com a busca, ordena pela contagem e pagina em memória.
      const todos = await prisma.usuarioApp.findMany({ where, include });
      todos.sort((a, b) =>
        dir === 'asc'
          ? a._count.registrosSync - b._count.registrosSync
          : b._count.registrosSync - a._count.registrosSync
      );
      total = todos.length;
      lista = todos.slice((pagina - 1) * limite, (pagina - 1) * limite + limite);
    } else {
      [total, lista] = await Promise.all([
        prisma.usuarioApp.count({ where }),
        prisma.usuarioApp.findMany({
          where,
          orderBy,
          skip: (pagina - 1) * limite,
          take: limite,
          include,
        }),
      ]);
    }

    return {
      usuarios: lista.map((u) => ({
        id: u.id,
        nome: u.nome,
        email: u.email,
        cpf: u.cpf,
        celular: u.celular,
        ativo: u.ativo,
        emailVerificado: u.emailVerificado,
        premium: u.premium,
        premiumTipo: u.premiumTipo,
        entidades: u.vinculos.map((v) => ({ id: v.entidade.id, nome: v.entidade.nome, origem: v.origem })),
        ultimoAcessoEm: u.ultimoAcessoEm,
        online: estaOnline(u.ultimoAcessoEm),
        dispositivos: u.dispositivos.length,
        // Plataformas dos aparelhos ativos (IOS/ANDROID), distintas.
        plataformas: [...new Set(u.dispositivos.map((d) => d.plataforma))],
        // Versão do app = a mais nova entre os aparelhos ativos (null se nenhum
        // reportou — app antigo). Serve para a coluna e o filtro de desatualizados.
        appVersao:
          u.dispositivos
            .map((d) => d.appVersao)
            .filter((v): v is string => !!v)
            .sort(compararVersao)
            .at(-1) ?? null,
        // Armas cadastradas no app (acervo sincronizado).
        armasSistema: u._count.registrosSync,
        criadoEm: u.criadoEm,
      })),
      total,
      pagina,
      limite,
      totalPaginas: Math.max(1, Math.ceil(total / limite)),
    };
  });

  // Quantas armas o usuário tem na Shooting House (busca sob demanda por linha).
  app.get('/api/admin/usuarios-app/:id/armas-sh', async (req) => {
    const { id } = req.params as { id: string };
    const u = await prisma.usuarioApp.findUnique({ where: { id }, select: { cpf: true } });
    if (!u) throw naoEncontrado('Usuário não encontrado');

    const entidades = await prisma.entidadeTiro.findMany({
      where: { shIntegracaoAtiva: true, shLogin: { not: null }, shSenha: { not: null } },
      select: { shBaseUrl: true, shLogin: true, shSenha: true },
    });
    if (!entidades.length) return { total: 0, status: 'SEM_PARCEIROS' };

    // Deduplica por número de série entre as entidades.
    const series = new Set<string>();
    let algumOk = false;
    for (const e of entidades) {
      const r = await buscarArmas({ baseUrl: e.shBaseUrl, login: e.shLogin!, senha: e.shSenha! }, u.cpf);
      if (r.status === 'OK') algumOk = true;
      for (const a of r.armas) series.add(a.numeroSerie);
    }
    return { total: series.size, status: algumOk ? 'OK' : 'ERRO' };
  });

  // Instalações anônimas (sem conta): aparelhos com push token e sem usuário.
  // Dão uma medida de uso do app por quem ainda não criou conta.
  app.get('/api/admin/anonimos', async (req) => {
    const q = req.query as { limite?: string };
    const limite = Math.min(500, Math.max(1, Number(q.limite) || 100));
    const [total, lista] = await Promise.all([
      prisma.dispositivoPush.count({ where: { usuarioId: null } }),
      prisma.dispositivoPush.findMany({
        where: { usuarioId: null },
        orderBy: { atualizadoEm: 'desc' },
        take: limite,
        select: { id: true, plataforma: true, ativo: true, criadoEm: true, atualizadoEm: true },
      }),
    ]);
    const ativos = await prisma.dispositivoPush.count({ where: { usuarioId: null, ativo: true } });
    return {
      total,
      ativos,
      dispositivos: lista.map((d) => ({
        // Id anônimo estável do aparelho (sem expor o push token).
        id: d.id,
        plataforma: d.plataforma,
        ativo: d.ativo,
        criadoEm: d.criadoEm,
        ultimoEm: d.atualizadoEm,
        online: estaOnline(d.atualizadoEm),
      })),
    };
  });

  // Edita os dados do usuário do app (nome, e-mail, CPF, status).
  app.patch('/api/admin/usuarios-app/:id', async (req) => {
    const { id } = req.params as { id: string };
    const dados = editarUsuarioAppSchema.parse(req.body);
    const usuario = await prisma.usuarioApp.findUnique({ where: { id } });
    if (!usuario) throw naoEncontrado('Usuário não encontrado');
    try {
      await prisma.usuarioApp.update({ where: { id }, data: dados });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const alvo = String(err.meta?.target ?? '');
        throw conflito(alvo.includes('cpf') ? 'CPF já cadastrado' : 'E-mail já cadastrado');
      }
      throw err;
    }
    return { ok: true };
  });

  // Vincula o usuário a uma entidade (manual, pelo backoffice).
  app.post('/api/admin/usuarios-app/:id/vinculos', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { entidadeId } = addVinculoSchema.parse(req.body);
    const usuario = await prisma.usuarioApp.findUnique({ where: { id } });
    if (!usuario) throw naoEncontrado('Usuário não encontrado');
    const ent = await prisma.entidadeTiro.findUnique({ where: { id: entidadeId } });
    if (!ent) throw naoEncontrado('Entidade não encontrada');
    await prisma.vinculoEntidade.upsert({
      where: { usuarioId_entidadeId: { usuarioId: id, entidadeId } },
      create: { usuarioId: id, entidadeId, origem: 'MANUAL' },
      update: {},
    });
    reply.code(201);
    return { ok: true };
  });

  // Remove um vínculo do usuário com uma entidade.
  app.delete('/api/admin/usuarios-app/:id/vinculos/:entidadeId', async (req, reply) => {
    const { id, entidadeId } = req.params as { id: string; entidadeId: string };
    await prisma.vinculoEntidade.deleteMany({ where: { usuarioId: id, entidadeId } });
    reply.code(204);
    return null;
  });

  // ----------------------------------------------- versões do app (cards)
  // Distribuição de versões por USUÁRIO (a versão mais nova entre os aparelhos
  // ativos de cada conta). `latest` = maior versão vista; `desatualizados` =
  // usuários abaixo dela; `desconhecidos` = contas cujos apps não reportam versão.
  app.get('/api/admin/app-versoes', async () => {
    const disp = await prisma.dispositivoPush.findMany({
      where: { ativo: true, usuarioId: { not: null } },
      select: { usuarioId: true, appVersao: true },
    });

    const porUsuario = new Map<string, string | null>();
    for (const d of disp) {
      const atual = porUsuario.get(d.usuarioId!);
      if (atual === undefined) {
        porUsuario.set(d.usuarioId!, d.appVersao);
      } else if (d.appVersao && (!atual || compararVersao(d.appVersao, atual) > 0)) {
        porUsuario.set(d.usuarioId!, d.appVersao);
      }
    }

    const contagem = new Map<string, number>(); // '' = desconhecida
    for (const v of porUsuario.values()) {
      const k = v ?? '';
      contagem.set(k, (contagem.get(k) ?? 0) + 1);
    }

    const conhecidas = [...contagem.keys()].filter((k) => k !== '').sort(compararVersao);
    const latest = conhecidas.at(-1) ?? null;

    const versoes = [...contagem.entries()]
      .map(([versao, usuarios]) => ({ versao: versao || null, usuarios }))
      .sort((a, b) => {
        if (a.versao && b.versao) return compararVersao(b.versao, a.versao);
        return a.versao ? -1 : 1; // desconhecida por último
      });

    const desconhecidos = contagem.get('') ?? 0;
    let desatualizados = 0;
    for (const [k, n] of contagem) {
      if (k !== '' && latest && compararVersao(k, latest) < 0) desatualizados += n;
    }

    return { latest, totalUsuarios: porUsuario.size, versoes, desatualizados, desconhecidos };
  });

  // ---------------------------------------------------------- enviar push
  app.post('/api/admin/push', async (req) => {
    const { titulo, corpo, dados, publico } = enviarPushSchema.parse(req.body);

    // Valida referências cedo, para erro claro.
    if (publico.entidadeId) {
      const ent = await prisma.entidadeTiro.findUnique({ where: { id: publico.entidadeId } });
      if (!ent) throw naoEncontrado('Entidade não encontrada');
    }
    if (publico.base === 'USUARIO') {
      const u = await prisma.usuarioApp.findUnique({ where: { id: publico.usuarioId! } });
      if (!u) throw naoEncontrado('Usuário não encontrado');
    }

    const { tokens, totalUsuarios } = await tokensDoPublico(publico);
    const resultado = await enviarPush(tokens, { titulo, corpo, dados });

    // Desativa tokens que a Expo diz não existirem mais.
    const mortos = resultado.erros
      .filter((e) => /DeviceNotRegistered/i.test(e.motivo))
      .map((e) => e.token);
    if (mortos.length) {
      await prisma.dispositivoPush.updateMany({
        where: { token: { in: mortos } },
        data: { ativo: false },
      });
    }

    await prisma.envioPush.create({
      data: {
        titulo,
        corpo,
        alvoTipo: resumoPublico(publico),
        alvoRef: publico.entidadeId ?? publico.usuarioId ?? null,
        totalUsuarios,
        totalTokens: tokens.length,
        totalAceitos: resultado.aceitos,
        autorId: req.usuario!.id,
      },
    });

    return {
      totalUsuarios,
      totalTokens: tokens.length,
      aceitos: resultado.aceitos,
      falhas: resultado.erros.length,
    };
  });

  // ---------------------------------- lembrete de habitualidade (por usuário)
  // Push PERSONALIZADO: calcula, para cada usuário, quantas habitualidades
  // faltam nos últimos 12 meses (mesma regra do app) e envia o modelo com as
  // variáveis {nome}/{feitas}/{faltam} já substituídas. Quem está em dia recebe
  // o modelo "em dia" (se marcado); quem não é atirador é ignorado.
  app.post('/api/admin/push/habitualidade', async (req) => {
    const dados = enviarPushHabitualidadeSchema.parse(req.body);
    const { publico } = dados;

    if (publico.base === 'ANONIMOS') {
      throw conflito('Sem cadastro não tem dados de habitualidade. Escolha contas.');
    }
    if (publico.entidadeId) {
      const ent = await prisma.entidadeTiro.findUnique({ where: { id: publico.entidadeId } });
      if (!ent) throw naoEncontrado('Entidade não encontrada');
    }
    if (publico.base === 'USUARIO') {
      const u = await prisma.usuarioApp.findUnique({ where: { id: publico.usuarioId! } });
      if (!u) throw naoEncontrado('Usuário não encontrado');
    }

    const porPlataforma = publico.plataformas?.length
      ? { plataforma: { in: publico.plataformas } }
      : {};

    // Carrega os usuários do público com acervo, sessões e aparelhos ativos.
    const usuarios = await prisma.usuarioApp.findMany({
      where: whereUsuariosPublico(publico),
      select: {
        id: true,
        nome: true,
        registrosSync: {
          where: { tipo: { in: ['armas', 'habitualidades'] }, removido: false },
          select: { tipo: true, dados: true },
        },
        dispositivos: {
          where: { ativo: true, ...porPlataforma },
          select: { token: true },
        },
      },
    });

    let usuariosFalta = 0;
    let usuariosEmDia = 0;
    let usuariosSemObrigacao = 0;
    let usuariosSemDispositivo = 0;
    const itens: ItemPush[] = [];

    for (const u of usuarios) {
      const armas: unknown[] = [];
      const sessoes: unknown[] = [];
      for (const r of u.registrosSync) {
        try {
          const obj = JSON.parse(r.dados);
          if (r.tipo === 'armas') armas.push(obj);
          else sessoes.push(obj);
        } catch {
          // Registro corrompido: ignora essa linha, não derruba o lote.
        }
      }

      const prog = progressoHabitualidade(armas as never[], sessoes as never[]);
      if (!prog.exigido) {
        usuariosSemObrigacao += 1;
        continue;
      }

      const emDia = prog.cumprido;
      if (emDia && !dados.incluirEmDia) continue;

      if (emDia) usuariosEmDia += 1;
      else usuariosFalta += 1;

      if (u.dispositivos.length === 0) {
        usuariosSemDispositivo += 1;
        continue;
      }

      const vars = {
        nome: u.nome.trim().split(/\s+/)[0] || u.nome,
        feitas: prog.feitasJanela,
        faltam: prog.faltamTotal,
      };
      const titulo = aplicarModelo(emDia ? dados.tituloOk! : dados.tituloFalta, vars);
      const corpo = aplicarModelo(emDia ? dados.corpoOk! : dados.corpoFalta, vars);
      for (const d of u.dispositivos) {
        itens.push({ token: d.token, titulo, corpo, dados: { tipo: 'habitualidade' } });
      }
    }

    const distribuicao = {
      usuariosAvaliados: usuarios.length,
      usuariosFalta,
      usuariosEmDia,
      usuariosSemObrigacao,
      usuariosSemDispositivo,
      totalTokens: itens.length,
    };

    // Prévia: devolve a distribuição sem enviar nem registrar histórico.
    if (dados.simular) {
      return { simulado: true, ...distribuicao, aceitos: 0, falhas: 0 };
    }

    const resultado = await enviarPushLote(itens);

    // Desativa tokens que a Expo diz não existirem mais.
    const mortos = resultado.erros
      .filter((e) => /DeviceNotRegistered/i.test(e.motivo))
      .map((e) => e.token);
    if (mortos.length) {
      await prisma.dispositivoPush.updateMany({
        where: { token: { in: mortos } },
        data: { ativo: false },
      });
    }

    const alvos = usuariosFalta + usuariosEmDia;
    await prisma.envioPush.create({
      data: {
        titulo: `🎯 Habitualidade · ${usuariosFalta} faltando${
          dados.incluirEmDia ? ` + ${usuariosEmDia} em dia` : ''
        }`,
        corpo: dados.corpoFalta,
        alvoTipo: `Habitualidade · ${resumoPublico(publico)}`,
        alvoRef: publico.entidadeId ?? publico.usuarioId ?? null,
        totalUsuarios: alvos,
        totalTokens: itens.length,
        totalAceitos: resultado.aceitos,
        autorId: req.usuario!.id,
      },
    });

    return {
      simulado: false,
      ...distribuicao,
      aceitos: resultado.aceitos,
      falhas: resultado.erros.length,
    };
  });

  // Histórico dos disparos (mais recentes primeiro).
  app.get('/api/admin/push', async (req) => {
    const q = req.query as { limite?: string };
    const limite = Math.min(100, Math.max(1, Number(q.limite) || 30));
    const envios = await prisma.envioPush.findMany({
      orderBy: { criadoEm: 'desc' },
      take: limite,
    });
    return { envios };
  });
}
