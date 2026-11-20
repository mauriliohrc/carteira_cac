/**
 * Corrige o Premium obsoleto por filiação: quem está com premiumTipo='FILIACAO'
 * mas NÃO tem filiação ativa e vigente é rebaixado (premium=false). Isso limpa o
 * rótulo "Federado" que ficava preso após a filiação vencer/cancelar.
 *
 *   npx tsx scripts/backfill-premium-filiacao.ts --dry   # só lista
 *   npx tsx scripts/backfill-premium-filiacao.ts          # aplica
 */
import { prisma } from '../src/db/cliente.js';

const dry = process.argv.includes('--dry');

async function main() {
  const usuarios = await prisma.usuarioApp.findMany({
    where: { premiumTipo: 'FILIACAO' },
    select: { id: true, email: true },
  });
  let rebaixados = 0;
  for (const u of usuarios) {
    const ativa = await prisma.filiacaoLiga.count({
      where: { usuarioId: u.id, status: 'ativa', vigenteAte: { gt: new Date() } },
    });
    if (ativa > 0) continue;
    rebaixados++;
    console.log(`• rebaixa ${u.email} (sem filiação ativa)`);
    if (!dry) {
      await prisma.usuarioApp.update({ where: { id: u.id }, data: { premium: false, premiumTipo: null } });
    }
  }
  console.log(`${dry ? '[dry] ' : ''}${rebaixados}/${usuarios.length} usuário(s) com premiumTipo=FILIACAO rebaixados.`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
