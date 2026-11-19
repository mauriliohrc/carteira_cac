// ============================================================================
// Cron de rede de segurança das assinaturas: varre periodicamente as que já
// venceram e não receberam a notificação de expiração, marcando-as EXPIRADA e
// rebaixando o premium. Garante que o churn apareça mesmo se uma notificação da
// Apple se perder.
// ============================================================================
import { ambiente } from '../config/ambiente.js';
import { expirarVencidas } from './assinaturaServico.js';

const INTERVALO_MS = 6 * 60 * 60 * 1000; // varre a cada 6h
const BUFFER_MS = 3 * 24 * 60 * 60 * 1000; // só expira o que venceu há +72h (margem p/ graça + notificação atrasada)

interface Logger {
  info: (obj: unknown, msg?: string) => void;
  error: (obj: unknown, msg?: string) => void;
}

export function iniciarCronAssinaturas(log?: Logger): void {
  // Sem Apple configurada não há assinaturas de loja para varrer.
  if (!ambiente.apple.webhookAtivo) return;

  const rodar = async () => {
    try {
      const n = await expirarVencidas(new Date(), BUFFER_MS);
      if (n) log?.info({ n }, '[cron assinaturas] expiradas pela rede de segurança');
    } catch (e) {
      log?.error({ e }, '[cron assinaturas] falha na varredura');
    }
  };

  // Primeira varredura pouco depois do boot; depois, periódica. `unref` evita
  // segurar o processo vivo só por causa do timer.
  setTimeout(rodar, 60_000).unref();
  setInterval(rodar, INTERVALO_MS).unref();
}
