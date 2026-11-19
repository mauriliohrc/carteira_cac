/**
 * Testa o webhook da Apple EM PRODUÇÃO ponta-a-ponta, sem compra:
 * pede à App Store Server API que envie uma notificação de TESTE ao nosso
 * endpoint e consulta o resultado da entrega (sendAttemptResult).
 *
 * SUCCESS = a Apple entregou e nosso webhook respondeu 2xx. Prova que a URL
 * está acessível, a assinatura verifica e o código processa.
 *
 * Uso (na raiz de servidor/, com APPLE_* configurado):
 *   npx tsx scripts/testar-webhook.ts
 */
import { ambiente } from '../src/config/ambiente.js';
import {
  solicitarNotificacaoTeste,
  statusNotificacaoTeste,
} from '../src/integracoes/appleAssinatura.js';

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  if (!ambiente.apple.apiAtiva) {
    console.error('APPLE_* não configurado. Abortando.');
    process.exit(1);
  }

  console.log(`Ambiente: ${ambiente.apple.ambiente}`);
  const token = await solicitarNotificacaoTeste();
  if (!token) {
    console.error('Não recebi testNotificationToken da Apple.');
    process.exit(1);
  }
  console.log(`Notificação de teste solicitada. Token: ${token.slice(0, 16)}…`);

  // A Apple entrega em segundos; consulta com algumas tentativas.
  for (let i = 1; i <= 8; i++) {
    await dormir(3000);
    try {
      const st = await statusNotificacaoTeste(token);
      const tentativas = st.sendAttempts ?? [];
      if (tentativas.length) {
        console.log(`\nTentativas de entrega (${tentativas.length}):`);
        for (const t of tentativas) {
          console.log(`  - resultado: ${t.sendAttemptResult}`);
        }
        const ok = tentativas.some((t) => String(t.sendAttemptResult) === 'SUCCESS');
        console.log(ok ? '\n✅ SUCCESS — webhook de produção funcionando.' : '\n⚠️  Entrega sem SUCCESS — ver resultado acima.');
        return;
      }
      console.log(`(${i}/8) ainda sem tentativa registrada…`);
    } catch (e) {
      // 404 = ainda não processado; segue tentando.
      console.log(`(${i}/8) aguardando… ${(e as Error).message}`);
    }
  }
  console.log('\nTempo esgotado sem resultado. Rode de novo em instantes.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
