/**
 * Backfill de assinaturas via App Store Server API.
 *
 * Reconsulta o status atual de cada assinatura conhecida (tabela assinaturas_app)
 * e aplica como evento sintético — útil logo após ligar a integração, para
 * descobrir churn retroativo e re-vincular notificações órfãs. Idempotente.
 *
 * Também aceita um ID avulso para semear uma assinatura que ainda não está no
 * banco — transaction ID (só dígitos) OU Order ID do recibo da Apple:
 *   npx tsx scripts/backfill-assinaturas.ts <transactionId|orderId> [Production|Sandbox]
 *
 * Sem argumentos, varre todas as assinaturas já registradas:
 *   npx tsx scripts/backfill-assinaturas.ts
 *
 * Requer APPLE_* configurado (ambiente.apple.apiAtiva) e o .env/túnel do banco.
 */
import { prisma } from '../src/db/cliente.js';
import { ambiente } from '../src/config/ambiente.js';
import { backfillPorTransacao, backfillPorOrderId } from '../src/dominio/assinaturaServico.js';

async function main() {
  if (!ambiente.apple.apiAtiva) {
    console.error('APPLE_* não configurado (keyId/issuerId/privateKey/bundleId). Abortando.');
    process.exit(1);
  }

  const [arg, envArg] = process.argv.slice(2);

  if (arg) {
    const env = envArg ?? ambiente.apple.ambiente;
    // Só dígitos = transaction ID; senão = Order ID do recibo.
    const ehTransacao = /^\d+$/.test(arg);
    const r = ehTransacao
      ? await backfillPorTransacao(arg, env)
      : await backfillPorOrderId(arg, env);
    console.log(
      r
        ? `✓ sincronizada ${r} (via ${ehTransacao ? 'transactionId' : 'orderId'})`
        : `— nada encontrado para "${arg}"`
    );
    await prisma.$disconnect();
    return;
  }

  const assinaturas = await prisma.assinaturaApp.findMany({
    where: { plataforma: 'IOS' },
    select: { originalTransactionId: true, ambiente: true },
    orderBy: { criadoEm: 'asc' },
  });
  console.log(`Reconsultando ${assinaturas.length} assinatura(s)…`);

  let ok = 0;
  let falhas = 0;
  for (const a of assinaturas) {
    try {
      const r = await backfillPorTransacao(a.originalTransactionId, a.ambiente);
      if (r) ok += 1;
      else falhas += 1;
    } catch (e) {
      falhas += 1;
      console.error(`✗ ${a.originalTransactionId}: ${(e as Error).message}`);
    }
  }
  console.log(`\n${ok} sincronizada(s), ${falhas} sem resultado/erro.`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
