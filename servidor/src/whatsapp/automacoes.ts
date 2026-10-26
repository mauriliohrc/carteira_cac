import { prisma } from '../db/cliente.js';
import {
  CHAVE_AUTOMACOES,
  CHAVE_MARCO_AUTOMACOES,
  gravarTexto,
  lerBool,
  lerTexto,
} from '../config/configStore.js';
import { enviarPush } from '../push/expo.js';
import { enviarTexto, estaConectado } from './cliente.js';
import { aplicarNome } from './mensagens.js';

/**
 * Mensagens AUTOMÁTICAS de relacionamento ("sempre com aquele toque de contato
 * direto e personalizado, mesmo sendo automático"):
 *   - BOAS_VINDAS  : logo que o usuário cria a conta.
 *   - SEM_ARMA_7D  : passados 7 dias sem cadastrar nenhuma arma/documentação.
 *
 * Cada gatilho tem um modelo por canal (WHATSAPP e PUSH) editável no backoffice
 * (modelos_mensagem). Cada disparo é registrado (disparos_automaticos) para não
 * repetir. O WhatsApp automático é espaçado para não parecer robô / evitar ban.
 */

export type Gatilho = 'BOAS_VINDAS' | 'SEM_ARMA_7D';
export type Canal = 'WHATSAPP' | 'PUSH';

export const GATILHOS: { id: Gatilho; rotulo: string; descricao: string }[] = [
  {
    id: 'BOAS_VINDAS',
    rotulo: 'Boas-vindas (no cadastro)',
    descricao: 'Enviada assim que o usuário cria a conta, abrindo um canal direto.',
  },
  {
    id: 'SEM_ARMA_7D',
    rotulo: '7 dias sem cadastrar arma',
    descricao: 'Lembrete para cadastrar documentação/armas após 7 dias sem acervo.',
  },
];

const DIAS_SEM_ARMA = 7;
/** Espaçamento entre envios automáticos de WhatsApp (anti-ban), em segundos. */
const AUTO_MIN_SEG = 10;
const AUTO_MAX_SEG = 40;
/** Teto de disparos por rodada do agendador (evita rajada). */
const LOTE_AUTO = 20;
/** Intervalo do agendador. */
const INTERVALO_AGENDADOR_MS = 30 * 60_000;

/** Modelos padrão — criados uma vez; edições do admin não são sobrescritas. */
const PADROES: { gatilho: Gatilho; canal: Canal; titulo?: string; corpo: string; ativo: boolean }[] = [
  {
    gatilho: 'BOAS_VINDAS',
    canal: 'WHATSAPP',
    ativo: true,
    corpo:
      'Olá {{nome}}! 👋 Seja muito bem-vindo(a) ao Carteira CAC. ' +
      'Esse é o meu contato direto — qualquer dúvida sobre o app, seus documentos ou suas armas, ' +
      'é só me chamar por aqui. Conte comigo! 🎯',
  },
  {
    gatilho: 'BOAS_VINDAS',
    canal: 'PUSH',
    ativo: false,
    titulo: 'Bem-vindo ao Carteira CAC!',
    corpo: 'Olá {{nome}}, que bom ter você aqui. Qualquer dúvida, fale com a gente. 🎯',
  },
  {
    gatilho: 'SEM_ARMA_7D',
    canal: 'WHATSAPP',
    ativo: true,
    corpo:
      'Oi {{nome}}, tudo bem? Reparei que você ainda não cadastrou sua documentação e armas no Carteira CAC. ' +
      'Posso te ajudar a deixar tudo organizado e na palma da mão — CRAF, guias de tráfego, habitualidade... ' +
      'Quer uma mãozinha? 😉',
  },
  {
    gatilho: 'SEM_ARMA_7D',
    canal: 'PUSH',
    ativo: false,
    titulo: 'Cadastre suas armas e documentos',
    corpo: 'Olá {{nome}}, deixe seu CRAF, guias e habitualidade sempre à mão no Carteira CAC.',
  },
];

/** Garante que existam os modelos padrão (idempotente). */
export async function garantirModelosPadrao(): Promise<void> {
  for (const p of PADROES) {
    await prisma.modeloMensagem.upsert({
      where: { gatilho_canal: { gatilho: p.gatilho, canal: p.canal } },
      create: { gatilho: p.gatilho, canal: p.canal, titulo: p.titulo ?? null, corpo: p.corpo, ativo: p.ativo },
      update: {}, // não sobrescreve edições do admin
    });
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const sorteia = (min: number, max: number) => Math.floor(min + Math.random() * (max - min + 1)) * 1000;

type UsuarioAlvo = { id: string; nome: string; celular: string | null };

/**
 * Dispara um gatilho para um usuário em todos os canais com modelo ativo.
 * Idempotente por (usuário, gatilho, canal). Canais pulados por falta de
 * pré-condição transitória (WhatsApp offline, sem push token) NÃO são travados,
 * para serem reprocessados depois pelo agendador.
 */
export async function dispararGatilho(usuario: UsuarioAlvo, gatilho: Gatilho): Promise<void> {
  // Interruptor-mestre: tudo desligado = nada sai (nem trava disparos).
  if (!(await lerBool(CHAVE_AUTOMACOES, true))) return;

  const modelos = await prisma.modeloMensagem.findMany({ where: { gatilho, ativo: true } });

  for (const modelo of modelos) {
    const canal = modelo.canal as Canal;
    const ja = await prisma.disparoAutomatico.findUnique({
      where: { usuarioId_gatilho_canal: { usuarioId: usuario.id, gatilho, canal } },
    });
    if (ja) continue;

    if (canal === 'WHATSAPP') {
      if (!usuario.celular) continue; // sem telefone: nunca vai por WhatsApp
      if (!estaConectado()) continue; // offline: tenta de novo na próxima rodada
      try {
        await enviarTexto(usuario.celular, aplicarNome(modelo.corpo, usuario.nome), usuario.nome);
        await registrar(usuario.id, gatilho, canal, 'OK');
      } catch (e) {
        // Número sem WhatsApp etc.: trava para não insistir num caso perdido.
        await registrar(usuario.id, gatilho, canal, 'FALHOU', e);
      }
    } else if (canal === 'PUSH') {
      const dispositivos = await prisma.dispositivoPush.findMany({
        where: { usuarioId: usuario.id, ativo: true },
        select: { token: true },
      });
      if (!dispositivos.length) continue; // sem aparelho: reprocessa depois
      const r = await enviarPush(dispositivos.map((d) => d.token), {
        titulo: aplicarNome(modelo.titulo ?? '', usuario.nome),
        corpo: aplicarNome(modelo.corpo, usuario.nome),
      });
      await registrar(usuario.id, gatilho, canal, r.aceitos > 0 ? 'OK' : 'FALHOU');
    }
  }
}

async function registrar(usuarioId: string, gatilho: Gatilho, canal: Canal, status: string, erro?: unknown) {
  const msg = erro instanceof Error ? erro.message : erro ? String(erro) : null;
  await prisma.disparoAutomatico.upsert({
    where: { usuarioId_gatilho_canal: { usuarioId, gatilho, canal } },
    create: { usuarioId, gatilho, canal, status, erro: msg },
    update: { status, erro: msg },
  });
}

/**
 * Chamado SÓ no momento do cadastro (best-effort, imediato). Não bloqueia a
 * resposta. Boas-vindas NÃO tem varredura retroativa de propósito: nunca deve
 * sair para a base histórica, apenas para quem acabou de criar a conta.
 */
export function dispararBoasVindas(usuario: UsuarioAlvo): void {
  void dispararGatilho(usuario, 'BOAS_VINDAS').catch(() => {});
}

/**
 * Marco de ativação das automações de tempo. Fixado na 1ª execução da varredura
 * (lazy). A partir daí, só usuários que cruzam o prazo DEPOIS do marco entram —
 * a base antiga nunca "vence de uma vez".
 */
async function marcoDeAtivacao(): Promise<Date> {
  const txt = await lerTexto(CHAVE_MARCO_AUTOMACOES);
  if (txt) return new Date(txt);
  const agora = new Date();
  await gravarTexto(CHAVE_MARCO_AUTOMACOES, agora.toISOString());
  return agora;
}

/**
 * Busca usuários que casam com `where` e que AINDA não têm disparo registrado
 * para o gatilho. Filtra os já-feitos em código (o lote candidato é limitado),
 * evitando um `notIn` gigante conforme a base cresce.
 */
async function candidatos(
  where: import('@prisma/client').Prisma.UsuarioAppWhereInput,
  gatilho: Gatilho
): Promise<UsuarioAlvo[]> {
  const cand = await prisma.usuarioApp.findMany({
    where,
    select: { id: true, nome: true, celular: true },
    orderBy: { criadoEm: 'desc' },
    take: LOTE_AUTO * 10,
  });
  if (!cand.length) return [];
  const feitos = new Set(
    (
      await prisma.disparoAutomatico.findMany({
        where: { gatilho, usuarioId: { in: cand.map((u) => u.id) } },
        select: { usuarioId: true },
      })
    ).map((d) => d.usuarioId)
  );
  return cand.filter((u) => !feitos.has(u.id)).slice(0, LOTE_AUTO);
}

let rodandoSweep = false;

/**
 * Varredura periódica: APENAS o lembrete de 7 dias sem arma. Boas-vindas não
 * entra aqui (só no cadastro). Para não atingir a base histórica, considera só
 * quem completa os 7 dias DEPOIS do marco de ativação:
 *   criadoEm ∈ [marco - 7d, agora - 7d)   (e sem arma, ativo)
 * No instante do marco a janela é vazia; com o tempo ela inclui, aos poucos, só
 * quem naturalmente cruza o prazo. Espaça os envios para não disparar em rajada.
 */
export async function processarAutomacoes(): Promise<void> {
  if (rodandoSweep) return;
  if (!(await lerBool(CHAVE_AUTOMACOES, true))) return; // mestre desligado
  rodandoSweep = true;
  try {
    await garantirModelosPadrao();
    const marco = await marcoDeAtivacao();

    const agora = Date.now();
    const limiteSuperior = new Date(agora - DIAS_SEM_ARMA * 86_400_000); // completou 7d
    const limiteInferior = new Date(marco.getTime() - DIAS_SEM_ARMA * 86_400_000); // só pós-marco

    const semArma = await candidatos(
      {
        ativo: true,
        criadoEm: { gte: limiteInferior, lt: limiteSuperior },
        registrosSync: { none: { tipo: 'armas', removido: false } },
      },
      'SEM_ARMA_7D'
    );

    let primeiro = true;
    for (const u of semArma) {
      if (!primeiro) await sleep(sorteia(AUTO_MIN_SEG, AUTO_MAX_SEG));
      primeiro = false;
      await dispararGatilho(u, 'SEM_ARMA_7D');
    }
  } finally {
    rodandoSweep = false;
  }
}

/** Liga o agendador: roda uma vez no boot e depois a cada 30 min. */
export function iniciarAgendador(): void {
  // Pequeno atraso no boot para não concorrer com a subida do servidor.
  setTimeout(() => void processarAutomacoes().catch(() => {}), 20_000);
  setInterval(() => void processarAutomacoes().catch(() => {}), INTERVALO_AGENDADOR_MS);
}
