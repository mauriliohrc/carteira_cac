/**
 * Renumera as filiações existentes para começarem num patamar alto (PISO), em
 * ordem de criação, transmitindo volume. Idempotente: quem já está >= PISO é
 * mantido. Para cada renumerada, reflete no sync (o app recebe a matrícula nova)
 * e regenera o certificado no acervo (PDF/QR com o número novo).
 *
 *   npx tsx scripts/renumerar-filiacoes.ts --dry   # só lista o que faria
 *   npx tsx scripts/renumerar-filiacoes.ts          # aplica
 */
import { prisma } from '../src/db/cliente.js';
import { PISO_NUMERO_FILIACAO, sufixoNumeroFiliacao } from '../src/dominio/filiacao.js';
import { garantirCertificadoNoAcervo, refletirFiliacaoNoSync } from '../src/dominio/filiacaoSync.js';

const dry = process.argv.includes('--dry');

async function main() {
  const numeradas = await prisma.filiacaoLiga.findMany({
    where: { numeroFiliacao: { not: null } },
    orderBy: { criadoEm: 'asc' },
  });

  // Contador começa no PISO, mas pula quem já está no range novo (idempotência).
  let prox = PISO_NUMERO_FILIACAO;
  for (const f of numeradas) {
    const s = sufixoNumeroFiliacao(f.numeroFiliacao);
    if (s >= PISO_NUMERO_FILIACAO) prox = Math.max(prox, s + 1);
  }

  let alteradas = 0;
  for (const f of numeradas) {
    const s = sufixoNumeroFiliacao(f.numeroFiliacao);
    if (s >= PISO_NUMERO_FILIACAO) {
      console.log(`mantém   ${f.numeroFiliacao}  (${f.nomeCompleto})`);
      continue;
    }
    const prefixo = (f.numeroFiliacao ?? '').split('-')[0] || String(new Date().getFullYear());
    const novo = `${prefixo}-${String(prox).padStart(6, '0')}`;
    prox += 1;
    console.log(`${dry ? '[dry] ' : ''}${f.numeroFiliacao} → ${novo}  (${f.nomeCompleto})`);
    if (dry) continue;

    const atual = await prisma.filiacaoLiga.update({
      where: { id: f.id },
      data: { numeroFiliacao: novo },
    });
    await refletirFiliacaoNoSync(atual);
    if (atual.status === 'ativa') {
      try {
        await garantirCertificadoNoAcervo(atual, { regenerar: true });
      } catch (e) {
        console.error(`  ! certificado falhou p/ ${novo}:`, e instanceof Error ? e.message : e);
      }
    }
    alteradas += 1;
  }

  console.log(
    `\n${dry ? '[dry] ' : ''}OK. ${alteradas} renumeradas. Próximo número será ` +
      `${new Date().getFullYear()}-${String(prox).padStart(6, '0')}.`
  );
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
