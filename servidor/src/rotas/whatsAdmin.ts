import type { FastifyInstance } from 'fastify';
import { prisma } from '../db/cliente.js';
import { exigirAdmin } from '../http/guardas.js';
import { naoEncontrado, invalido } from '../http/erros.js';
import {
  criarCampanhaWhatsSchema,
  editarModeloMensagemSchema,
  previaWhatsSchema,
} from '../dominio/validacao.js';
import { iniciar, logout, status } from '../whatsapp/cliente.js';
import { resolverDestinatarios } from '../whatsapp/filtros.js';
import { cutucar } from '../whatsapp/dispatcher.js';
import { aplicarNome } from '../whatsapp/mensagens.js';
import { GATILHOS, garantirModelosPadrao } from '../whatsapp/automacoes.js';
import { CHAVE_AUTOMACOES, CHAVE_SALVAR_CONTATO, gravarBool, lerBool } from '../config/configStore.js';
import { z } from 'zod';

/** Esconde o miolo do número no retorno da prévia (privacidade na tela). */
function mascararCelular(celular: string): string {
  const d = celular.replace(/\D/g, '');
  if (d.length < 6) return d;
  return `${d.slice(0, 4)}…${d.slice(-2)}`;
}

export async function rotasWhatsAdmin(app: FastifyInstance) {
  app.addHook('preHandler', exigirAdmin());

  // --------------------------------------------------------------- conexão
  app.get('/api/admin/whatsapp/status', async () => {
    const salvarContato = await lerBool(CHAVE_SALVAR_CONTATO, true);
    return { ...status(), salvarContato };
  });

  // Opções do WhatsApp (ex.: salvar o número como contato antes de enviar).
  app.patch('/api/admin/whatsapp/config', async (req) => {
    const { salvarContato } = z.object({ salvarContato: z.boolean() }).parse(req.body);
    await gravarBool(CHAVE_SALVAR_CONTATO, salvarContato);
    return { ok: true, salvarContato };
  });

  app.post('/api/admin/whatsapp/conectar', async () => {
    await iniciar();
    return status();
  });

  app.post('/api/admin/whatsapp/logout', async () => {
    await logout();
    return { ok: true };
  });

  // ---------------------------------------------------------------- prévia
  app.post('/api/admin/whatsapp/previa', async (req) => {
    const { filtros } = previaWhatsSchema.parse(req.body);
    const destinatarios = await resolverDestinatarios(filtros);
    return {
      total: destinatarios.length,
      amostra: destinatarios.slice(0, 10).map((d) => ({
        nome: d.nome,
        celular: mascararCelular(d.celular),
      })),
    };
  });

  // ------------------------------------------------------------- campanhas
  app.post('/api/admin/whatsapp/campanhas', async (req) => {
    const dados = criarCampanhaWhatsSchema.parse(req.body);
    const destinatarios = await resolverDestinatarios(dados.filtros);
    if (!destinatarios.length) {
      throw invalido('Nenhum destinatário com telefone para esses filtros');
    }

    const campanha = await prisma.campanhaWhats.create({
      data: {
        mensagem: dados.mensagem,
        usarNome: dados.usarNome,
        filtros: JSON.stringify(dados.filtros),
        intervaloMin: dados.intervaloMin,
        intervaloMax: dados.intervaloMax,
        totalAlvos: destinatarios.length,
        autorId: req.usuario!.id,
      },
    });

    // Um EnvioWhats por destinatário, com a mensagem JÁ personalizada (snapshot).
    await prisma.envioWhats.createMany({
      data: destinatarios.map((d) => ({
        campanhaId: campanha.id,
        usuarioId: d.id,
        celular: d.celular,
        nome: d.nome,
        mensagem: aplicarNome(dados.mensagem, d.nome, dados.usarNome),
      })),
    });

    cutucar(); // acorda o disparo gradual
    return apresentarCampanha(campanha);
  });

  app.get('/api/admin/whatsapp/campanhas', async (req) => {
    const q = req.query as { limite?: string };
    const limite = Math.min(100, Math.max(1, Number(q.limite) || 30));
    const campanhas = await prisma.campanhaWhats.findMany({
      orderBy: { criadoEm: 'desc' },
      take: limite,
    });
    return { campanhas: campanhas.map(apresentarCampanha) };
  });

  app.get('/api/admin/whatsapp/campanhas/:id', async (req) => {
    const { id } = req.params as { id: string };
    const q = req.query as { status?: string; limite?: string };
    const campanha = await prisma.campanhaWhats.findUnique({ where: { id } });
    if (!campanha) throw naoEncontrado('Campanha não encontrada');

    const limite = Math.min(500, Math.max(1, Number(q.limite) || 100));
    const statusFiltro =
      q.status && ['PENDENTE', 'ENVIADO', 'FALHOU'].includes(q.status) ? q.status : undefined;

    const envios = await prisma.envioWhats.findMany({
      where: { campanhaId: id, ...(statusFiltro ? { status: statusFiltro } : {}) },
      orderBy: [{ enviadoEm: 'desc' }, { criadoEm: 'asc' }],
      take: limite,
      select: { id: true, nome: true, celular: true, status: true, erro: true, enviadoEm: true },
    });

    return {
      campanha: apresentarCampanha(campanha),
      envios: envios.map((e) => ({ ...e, celular: mascararCelular(e.celular) })),
    };
  });

  // Ações de controle da campanha.
  app.post('/api/admin/whatsapp/campanhas/:id/pausar', async (req) => {
    const { id } = req.params as { id: string };
    await mudarStatus(id, 'PAUSADA', ['EM_ANDAMENTO']);
    return { ok: true };
  });

  app.post('/api/admin/whatsapp/campanhas/:id/retomar', async (req) => {
    const { id } = req.params as { id: string };
    await mudarStatus(id, 'EM_ANDAMENTO', ['PAUSADA']);
    cutucar();
    return { ok: true };
  });

  app.post('/api/admin/whatsapp/campanhas/:id/cancelar', async (req) => {
    const { id } = req.params as { id: string };
    await mudarStatus(id, 'CANCELADA', ['EM_ANDAMENTO', 'PAUSADA']);
    return { ok: true };
  });

  // ------------------------------- mensagens automáticas (push + whatsapp)
  app.get('/api/admin/mensagens-automaticas', async () => {
    await garantirModelosPadrao();
    const [modelos, ativo] = await Promise.all([
      prisma.modeloMensagem.findMany({ orderBy: [{ gatilho: 'asc' }, { canal: 'asc' }] }),
      lerBool(CHAVE_AUTOMACOES, true),
    ]);
    // `ativo` é o interruptor-mestre: com ele desligado, nenhum gatilho dispara.
    return { ativo, gatilhos: GATILHOS, modelos };
  });

  // Liga/desliga TODAS as mensagens automáticas de uma vez.
  app.patch('/api/admin/mensagens-automaticas/config', async (req) => {
    const { ativo } = z.object({ ativo: z.boolean() }).parse(req.body);
    await gravarBool(CHAVE_AUTOMACOES, ativo);
    return { ok: true, ativo };
  });

  app.patch('/api/admin/mensagens-automaticas/:id', async (req) => {
    const { id } = req.params as { id: string };
    const dados = editarModeloMensagemSchema.parse(req.body);
    const modelo = await prisma.modeloMensagem.findUnique({ where: { id } });
    if (!modelo) throw naoEncontrado('Modelo não encontrado');
    await prisma.modeloMensagem.update({ where: { id }, data: dados });
    return { ok: true };
  });
}

type CampanhaRow = Awaited<ReturnType<typeof prisma.campanhaWhats.findUniqueOrThrow>>;

function apresentarCampanha(c: CampanhaRow) {
  return {
    id: c.id,
    mensagem: c.mensagem,
    usarNome: c.usarNome,
    intervaloMin: c.intervaloMin,
    intervaloMax: c.intervaloMax,
    status: c.status,
    totalAlvos: c.totalAlvos,
    totalEnviados: c.totalEnviados,
    totalFalhas: c.totalFalhas,
    criadoEm: c.criadoEm,
    atualizadoEm: c.atualizadoEm,
  };
}

async function mudarStatus(id: string, novo: string, permitidos: string[]) {
  const campanha = await prisma.campanhaWhats.findUnique({ where: { id } });
  if (!campanha) throw naoEncontrado('Campanha não encontrada');
  if (!permitidos.includes(campanha.status)) {
    throw invalido(`Campanha ${campanha.status.toLowerCase()} não permite esta ação`);
  }
  await prisma.campanhaWhats.update({ where: { id }, data: { status: novo } });
}
