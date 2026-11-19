/**
 * Backfill de churn pelo HISTÓRICO de notificações da App Store Server API.
 *
 * Puxa os eventos de assinatura dos últimos N dias (máx. 180) que a Apple já
 * registrou — mesmo que a URL de notificações nunca tenha sido configurada — e
 * os aplica, populando o churn que já aconteceu. Idempotente.
 *
 * Uso (na raiz de servidor/, com APPLE_* e o banco configurados):
 *   npx tsx scripts/backfill-historico.ts            # últimos 180 dias
 *   npx tsx scripts/backfill-historico.ts 30         # últimos 30 dias
 */
import { prisma } from '../src/db/cliente.js';
import { ambiente } from '../src/config/ambiente.js';
import { backfillHistoricoNotificacoes } from '../src/dominio/assinaturaServico.js';

const MAX_DIAS = 180;

async function main() {
  if (!ambiente.apple.apiAtiva) {
    console.error('APPLE_* não configurado (keyId/issuerId/privateKey/bundleId). Abortando.');
    process.exit(1);
  }

  const dias = Math.min(MAX_DIAS, Math.max(1, Number(process.argv[2]) || MAX_DIAS));
  const ate = Date.now();
  const desde = ate - dias * 86_400_000;
  console.log(`Puxando histórico de notificações dos últimos ${dias} dia(s)…`);

  const r = await backfillHistoricoNotificacoes(desde, ate);
  console.log(
    `\n${r.itens} notificação(ões) no histórico · ${r.assinaturasPremium} de assinatura Premium · ${r.processados} aplicada(s).`
  );

  const [ativas, churn] = await Promise.all([
    prisma.assinaturaApp.count({ where: { status: { in: ['ATIVA', 'EM_GRACA', 'CANCELADA_RENOVACAO'] } } }),
    prisma.assinaturaApp.count({ where: { status: { in: ['EXPIRADA', 'REEMBOLSADA', 'REVOGADA'] } } }),
  ]);
  console.log(`Estado atual: ${ativas} com acesso · ${churn} em churn.`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
