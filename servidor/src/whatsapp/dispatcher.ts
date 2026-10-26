import { prisma } from '../db/cliente.js';
import { enviarTexto, estaConectado, registrarAoConectar } from './cliente.js';

/**
 * Disparo GRADUAL das campanhas de WhatsApp. Um único laço em memória processa
 * um envio por vez: pega a campanha EM_ANDAMENTO mais antiga, manda o próximo
 * destinatário PENDENTE e reagenda o próximo após um intervalo ALEATÓRIO entre
 * `intervaloMin` e `intervaloMax` (reduz o risco de banimento do número).
 *
 * A durabilidade vem do banco: após restart, `retomar()` recoloca o laço em
 * movimento e as campanhas EM_ANDAMENTO continuam de onde pararam.
 */

let timer: ReturnType<typeof setTimeout> | null = null;
let processando = false;

/** Espera quando o WhatsApp está fora do ar (tenta de novo ao reconectar). */
const ESPERA_DESCONECTADO_MS = 15_000;

/** Reagenda após falha inesperada (ex.: hiccup de banco) sem matar o laço. */
const ESPERA_ERRO_MS = 30_000;

function agendar(ms: number) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    rodar().catch(() => {
      processando = false;
      agendar(ESPERA_ERRO_MS);
    });
  }, ms);
}

/** Acorda o laço (chamar após criar/retomar campanha e ao reconectar). */
export function cutucar() {
  if (!timer && !processando) agendar(0);
}

/** Retoma campanhas EM_ANDAMENTO no boot do servidor. */
export function retomar() {
  cutucar();
}

/** Liga o laço ao evento de conexão: ao reconectar, volta a enviar. */
export function registrarRetomada() {
  registrarAoConectar(cutucar);
}

function sortearIntervalo(minSeg: number, maxSeg: number): number {
  const min = Math.max(1, minSeg);
  const max = Math.max(min, maxSeg);
  return Math.floor(min + Math.random() * (max - min + 1)) * 1000;
}

async function rodar(): Promise<void> {
  if (processando) return;
  processando = true;
  try {
    const campanha = await prisma.campanhaWhats.findFirst({
      where: { status: 'EM_ANDAMENTO' },
      orderBy: { criadoEm: 'asc' },
    });
    if (!campanha) return; // nada a fazer: laço dorme até o próximo cutucar()

    const envio = await prisma.envioWhats.findFirst({
      where: { campanhaId: campanha.id, status: 'PENDENTE' },
      orderBy: { criadoEm: 'asc' },
    });

    if (!envio) {
      // Campanha sem pendentes -> concluída. Procura a próxima imediatamente.
      await prisma.campanhaWhats.update({
        where: { id: campanha.id },
        data: { status: 'CONCLUIDA' },
      });
      agendar(0);
      return;
    }

    // Sem conexão: não gasta o envio; espera e tenta de novo (também acordado
    // pelo evento de reconexão via registrarRetomada()).
    if (!estaConectado()) {
      agendar(ESPERA_DESCONECTADO_MS);
      return;
    }

    try {
      await enviarTexto(envio.celular, envio.mensagem);
      await prisma.envioWhats.update({
        where: { id: envio.id },
        data: { status: 'ENVIADO', enviadoEm: new Date() },
      });
      await prisma.campanhaWhats.update({
        where: { id: campanha.id },
        data: { totalEnviados: { increment: 1 } },
      });
    } catch (e) {
      const erro = e instanceof Error ? e.message : String(e);
      await prisma.envioWhats.update({
        where: { id: envio.id },
        data: { status: 'FALHOU', erro },
      });
      await prisma.campanhaWhats.update({
        where: { id: campanha.id },
        data: { totalFalhas: { increment: 1 } },
      });
    }

    agendar(sortearIntervalo(campanha.intervaloMin, campanha.intervaloMax));
  } finally {
    processando = false;
  }
}
