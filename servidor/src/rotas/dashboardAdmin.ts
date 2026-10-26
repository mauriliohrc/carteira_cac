import type { FastifyInstance } from 'fastify';
import type { Prisma } from '@prisma/client';
import { prisma } from '../db/cliente.js';
import { exigirAdmin } from '../http/guardas.js';
import { buscarArmas } from '../integracoes/shootinghouse.js';

const DIAS_ATIVO = 30;
const MIN_ONLINE = 5;

/** DDD → UF. Base para o "mapa de calor" por estado (identificação via celular). */
const DDD_UF: Record<string, string> = {
  '11': 'SP', '12': 'SP', '13': 'SP', '14': 'SP', '15': 'SP', '16': 'SP', '17': 'SP', '18': 'SP', '19': 'SP',
  '21': 'RJ', '22': 'RJ', '24': 'RJ',
  '27': 'ES', '28': 'ES',
  '31': 'MG', '32': 'MG', '33': 'MG', '34': 'MG', '35': 'MG', '37': 'MG', '38': 'MG',
  '41': 'PR', '42': 'PR', '43': 'PR', '44': 'PR', '45': 'PR', '46': 'PR',
  '47': 'SC', '48': 'SC', '49': 'SC',
  '51': 'RS', '53': 'RS', '54': 'RS', '55': 'RS',
  '61': 'DF',
  '62': 'GO', '64': 'GO',
  '63': 'TO',
  '65': 'MT', '66': 'MT',
  '67': 'MS',
  '68': 'AC',
  '69': 'RO',
  '71': 'BA', '73': 'BA', '74': 'BA', '75': 'BA', '77': 'BA',
  '79': 'SE',
  '81': 'PE', '87': 'PE',
  '82': 'AL',
  '83': 'PB',
  '84': 'RN',
  '85': 'CE', '88': 'CE',
  '86': 'PI', '89': 'PI',
  '91': 'PA', '93': 'PA', '94': 'PA',
  '92': 'AM', '97': 'AM',
  '95': 'RR',
  '96': 'AP',
  '98': 'MA', '99': 'MA',
};

/** Extrai o DDD (2 dígitos) de um celular só-dígitos; null se não der. */
function extrairDDD(celular: string): string | null {
  let n = celular.replace(/\D/g, '');
  if (n.length > 11 && n.startsWith('55')) n = n.slice(2); // tira o DDI
  if (n.length < 10) return null;
  return n.slice(0, 2);
}

/** Filtros das métricas que viram listas de usuários (card → lista → CSV). */
const FILTROS: Record<string, () => Prisma.UsuarioAppWhereInput> = {
  todos: () => ({}),
  ativos: () => ({ ultimoAcessoEm: { gte: new Date(Date.now() - DIAS_ATIVO * 86_400_000) } }),
  contasAtivas: () => ({ ativo: true }),
  semAtivar: () => ({ emailVerificado: false }),
  semVinculo: () => ({ vinculos: { none: {} } }),
  comVinculo: () => ({ vinculos: { some: {} } }),
  comDocumento: () => ({ registrosSync: { some: { tipo: 'documentos', removido: false } } }),
  semDocumento: () => ({ registrosSync: { none: { tipo: 'documentos', removido: false } } }),
  planoAnual: () => ({ premium: true, premiumTipo: { in: ['ANUAL', 'ANUAL_PARCEIRO'] } }),
  planoMensal: () => ({ premium: true, premiumTipo: 'MENSAL' }),
  premiumGratis: () => ({ premium: true, premiumTipo: 'CUPOM' }),
};

/** Dashboard do admin do app: números, listas por métrica e crescimento. */
export async function rotasDashboardAdmin(app: FastifyInstance) {
  app.addHook('preHandler', exigirAdmin());

  app.get('/api/admin/dashboard', async () => {
    const corteAtivo = new Date(Date.now() - DIAS_ATIVO * 86_400_000);
    const corteOnline = new Date(Date.now() - MIN_ONLINE * 60_000);
    const [
      total,
      contasAtivas,
      ativos,
      online,
      semAtivar,
      semVinculo,
      comVinculo,
      comDocumento,
      semDocumento,
      planoAnual,
      planoMensal,
      premiumGratis,
      anonimos,
      armasSistema,
    ] = await Promise.all([
      prisma.usuarioApp.count(),
      prisma.usuarioApp.count({ where: { ativo: true } }),
      prisma.usuarioApp.count({ where: { ultimoAcessoEm: { gte: corteAtivo } } }),
      prisma.usuarioApp.count({ where: { ultimoAcessoEm: { gte: corteOnline } } }),
      prisma.usuarioApp.count({ where: { emailVerificado: false } }),
      prisma.usuarioApp.count({ where: { vinculos: { none: {} } } }),
      prisma.usuarioApp.count({ where: { vinculos: { some: {} } } }),
      prisma.usuarioApp.count({ where: { registrosSync: { some: { tipo: 'documentos', removido: false } } } }),
      prisma.usuarioApp.count({ where: { registrosSync: { none: { tipo: 'documentos', removido: false } } } }),
      prisma.usuarioApp.count({ where: { premium: true, premiumTipo: { in: ['ANUAL', 'ANUAL_PARCEIRO'] } } }),
      prisma.usuarioApp.count({ where: { premium: true, premiumTipo: 'MENSAL' } }),
      prisma.usuarioApp.count({ where: { premium: true, premiumTipo: 'CUPOM' } }),
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
      cards: {
        // Total geral = contas (ativas ou não) + instalações anônimas (sem conta).
        totalGeral: total + anonimos,
        comConta: total,
        contasAtivas,
        semConta: anonimos,
        semAtivar,
        comDocumento,
        semDocumento,
        comVinculo,
        planoAnual,
        planoMensal,
        premiumGratis,
        // Mantidos para compatibilidade com telas/drilldowns existentes.
        total,
        ativos,
        semVinculo,
        semCadastro: anonimos,
      },
      online,
      minOnline: MIN_ONLINE,
      armasSistema,
      plataformas,
      diasAtivo: DIAS_ATIVO,
    };
  });

  // Mapa de calor por estado: conta usuários por UF a partir do DDD do celular.
  app.get('/api/admin/dashboard/regioes', async () => {
    const comConta = await prisma.usuarioApp.count();
    const usuarios = await prisma.usuarioApp.findMany({
      where: { celular: { not: null } },
      select: { celular: true },
    });
    const ufs: Record<string, number> = {};
    let semDDD = 0; // tem celular, mas DDD inválido/desconhecido
    for (const u of usuarios) {
      const ddd = u.celular ? extrairDDD(u.celular) : null;
      const uf = ddd ? DDD_UF[ddd] : undefined;
      if (uf) ufs[uf] = (ufs[uf] ?? 0) + 1;
      else semDDD += 1;
    }
    return {
      ufs,
      semDDD,
      semTelefone: comConta - usuarios.length, // sem celular cadastrado
      comTelefone: usuarios.length,
      total: comConta,
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
