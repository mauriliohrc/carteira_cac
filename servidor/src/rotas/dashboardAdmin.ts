import type { FastifyInstance } from 'fastify';
import type { Prisma } from '@prisma/client';
import { prisma } from '../db/cliente.js';
import { exigirAdmin } from '../http/guardas.js';
import { buscarArmas } from '../integracoes/shootinghouse.js';

const DIAS_ATIVO = 30;
const MIN_ONLINE = 5;

/** Filtros das métricas que viram listas de usuários (card → lista → CSV). */
const FILTROS: Record<string, () => Prisma.UsuarioAppWhereInput> = {
  todos: () => ({}),
  ativos: () => ({ ultimoAcessoEm: { gte: new Date(Date.now() - DIAS_ATIVO * 86_400_000) } }),
  semAtivar: () => ({ emailVerificado: false }),
  semVinculo: () => ({ vinculos: { none: {} } }),
  semDocumento: () => ({ registrosSync: { none: { tipo: 'documentos', removido: false } } }),
};

/** Dashboard do admin do app: números, listas por métrica e crescimento. */
export async function rotasDashboardAdmin(app: FastifyInstance) {
  app.addHook('preHandler', exigirAdmin());

  app.get('/api/admin/dashboard', async () => {
    const corteAtivo = new Date(Date.now() - DIAS_ATIVO * 86_400_000);
    const corteOnline = new Date(Date.now() - MIN_ONLINE * 60_000);
    const [total, ativos, online, semAtivar, semVinculo, semDocumento, anonimos, armasSistema] =
      await Promise.all([
        prisma.usuarioApp.count(),
        prisma.usuarioApp.count({ where: { ultimoAcessoEm: { gte: corteAtivo } } }),
        prisma.usuarioApp.count({ where: { ultimoAcessoEm: { gte: corteOnline } } }),
        prisma.usuarioApp.count({ where: { emailVerificado: false } }),
        prisma.usuarioApp.count({ where: { vinculos: { none: {} } } }),
        prisma.usuarioApp.count({ where: { registrosSync: { none: { tipo: 'documentos', removido: false } } } }),
        prisma.dispositivoPush.count({ where: { usuarioId: null } }),
        prisma.registroSync.count({ where: { tipo: 'armas', removido: false } }),
      ]);

    // Distribuição de plataformas (aparelhos ativos).
    const porPlataforma = await prisma.dispositivoPush.groupBy({
      by: ['plataforma'],
      where: { ativo: true },
      _count: true,
    });
    const plataformas = {
      ios: porPlataforma.find((p) => p.plataforma === 'IOS')?._count ?? 0,
      android: porPlataforma.find((p) => p.plataforma === 'ANDROID')?._count ?? 0,
    };

    return {
      cards: { total, ativos, semAtivar, semVinculo, semDocumento, semCadastro: anonimos },
      online,
      minOnline: MIN_ONLINE,
      armasSistema,
      plataformas,
      diasAtivo: DIAS_ATIVO,
    };
  });

  // Distribuição de acesso por hora do dia (BRT). Base: último acesso de cada
  // usuário (é o que guardamos) — dá o padrão aproximado de horário de uso.
  app.get('/api/admin/dashboard/acessos-hora', async () => {
    const usuarios = await prisma.usuarioApp.findMany({
      where: { ultimoAcessoEm: { not: null } },
      select: { ultimoAcessoEm: true },
    });
    const horas = Array.from({ length: 24 }, (_, h) => ({ hora: h, total: 0 }));
    for (const u of usuarios) {
      const h = (u.ultimoAcessoEm!.getUTCHours() - 3 + 24) % 24; // UTC -> BRT
      horas[h]!.total += 1;
    }
    return { horas, base: 'ULTIMO_ACESSO', fuso: 'BRT' };
  });

  // Crescimento de usuários por período. `dias` = 7|30|60|90 (bucket diário);
  // acima de 120 dias agrupa por mês. Devolve novos e total acumulado por ponto.
  app.get('/api/admin/dashboard/crescimento', async (req) => {
    const q = req.query as { dias?: string };
    const dias = Math.min(732, Math.max(1, Number(q.dias) || 30));
    const usuarios = await prisma.usuarioApp.findMany({ select: { criadoEm: true } });
    const agora = new Date();

    if (dias > 120) {
      // Agrupa por mês.
      const nMeses = Math.round(dias / 30);
      const pontos: { rotulo: string; novos: number; acumulado: number }[] = [];
      const indice = new Map<string, number>();
      for (let i = nMeses - 1; i >= 0; i--) {
        const d = new Date(agora.getFullYear(), agora.getMonth() - i, 1);
        const chave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        indice.set(chave, pontos.length);
        pontos.push({ rotulo: chave, novos: 0, acumulado: 0 });
      }
      const limite = new Date(agora.getFullYear(), agora.getMonth() - (nMeses - 1), 1);
      let base = 0;
      for (const u of usuarios) {
        const d = u.criadoEm;
        const chave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const idx = indice.get(chave);
        if (idx != null) pontos[idx]!.novos += 1;
        else if (d < limite) base += 1;
      }
      let soma = base;
      return { dias, escala: 'mes', pontos: pontos.map((p) => ({ ...p, acumulado: (soma += p.novos) })) };
    }

    // Bucket diário.
    const inicio = new Date(agora);
    inicio.setHours(0, 0, 0, 0);
    inicio.setDate(inicio.getDate() - (dias - 1));
    const pontos: { rotulo: string; novos: number; acumulado: number }[] = [];
    const indice = new Map<string, number>();
    for (let i = 0; i < dias; i++) {
      const d = new Date(inicio);
      d.setDate(inicio.getDate() + i);
      const chave = d.toISOString().slice(0, 10);
      indice.set(chave, pontos.length);
      pontos.push({ rotulo: chave, novos: 0, acumulado: 0 });
    }
    let base = 0;
    for (const u of usuarios) {
      const chave = new Date(u.criadoEm).toISOString().slice(0, 10);
      const idx = indice.get(chave);
      if (idx != null) pontos[idx]!.novos += 1;
      else if (u.criadoEm < inicio) base += 1;
    }
    let soma = base;
    return { dias, escala: 'dia', pontos: pontos.map((p) => ({ ...p, acumulado: (soma += p.novos) })) };
  });

  // Total de armas na Shooting House (somatório externo; carregado à parte).
  // Varre os usuários vinculados a entidades com SH e soma as armas distintas
  // (por nº de série) de cada um.
  app.get('/api/admin/dashboard/armas-sh', async () => {
    const entidades = await prisma.entidadeTiro.findMany({
      where: { shIntegracaoAtiva: true, shLogin: { not: null }, shSenha: { not: null } },
      select: { shBaseUrl: true, shLogin: true, shSenha: true },
    });
    if (!entidades.length) return { total: 0, usuarios: 0, status: 'SEM_PARCEIROS' };

    const usuarios = await prisma.usuarioApp.findMany({
      where: { vinculos: { some: {} } },
      select: { cpf: true },
    });

    let total = 0;
    for (const u of usuarios) {
      const series = new Set<string>();
      for (const e of entidades) {
        const r = await buscarArmas({ baseUrl: e.shBaseUrl, login: e.shLogin!, senha: e.shSenha! }, u.cpf);
        for (const a of r.armas) series.add(a.numeroSerie);
      }
      total += series.size;
    }
    return { total, usuarios: usuarios.length, status: 'OK' };
  });

  // Lista de usuários de uma métrica (para abrir o card e exportar CSV no cliente).
  app.get('/api/admin/dashboard/usuarios', async (req) => {
    const { metrica } = req.query as { metrica?: string };
    const filtro = FILTROS[metrica ?? 'todos'];
    if (!filtro) return { metrica, usuarios: [] };
    const usuarios = await prisma.usuarioApp.findMany({
      where: filtro(),
      orderBy: { criadoEm: 'desc' },
      take: 5000,
      select: {
        id: true,
        nome: true,
        email: true,
        cpf: true,
        celular: true,
        emailVerificado: true,
        ultimoAcessoEm: true,
        criadoEm: true,
      },
    });
    return { metrica, total: usuarios.length, usuarios };
  });
}
