/**
 * Backfill de subdomínios para entidades criadas antes do recurso.
 *
 * Gera o slug do nome e garante unicidade (considerando o que já existe e o que
 * foi atribuído nesta rodada). Idempotente: só mexe em quem está com nulo.
 *
 * Uso (na raiz de servidor/, com o .env/túnel do banco ativo):
 *   npx tsx scripts/backfill-subdominios.ts
 */
import { prisma } from '../src/db/cliente.js';
import { candidatosSubdominio } from '../src/dominio/subdominio.js';

async function main() {
  const usados = new Set(
    (
      await prisma.entidadeTiro.findMany({
        where: { subdominio: { not: null } },
        select: { subdominio: true },
      })
    ).map((e) => e.subdominio as string)
  );

  const pendentes = await prisma.entidadeTiro.findMany({
    where: { subdominio: null },
    select: { id: true, nome: true },
    orderBy: { criadoEm: 'asc' },
  });

  let ok = 0;
  const semSlug: string[] = [];
  for (const e of pendentes) {
    const escolhido = candidatosSubdominio(e.nome).find((c) => !usados.has(c));
    if (!escolhido) {
      semSlug.push(`${e.nome} (${e.id})`);
      continue;
    }
    await prisma.entidadeTiro.update({ where: { id: e.id }, data: { subdominio: escolhido } });
    usados.add(escolhido);
    ok += 1;
    console.log(`✓ ${e.nome} -> ${escolhido}`);
  }

  console.log(`\n${ok} entidade(s) atualizada(s), ${pendentes.length - ok} sem slug possível.`);
  if (semSlug.length) console.log('Defina manualmente: ' + semSlug.join(', '));
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
