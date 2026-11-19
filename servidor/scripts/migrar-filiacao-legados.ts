/**
 * Migração dos legados anual IAP → filiados cortesia da liga.
 *
 * Quem já tem a assinatura ANUAL do app (IAP `premium_anual`) ativa vira filiado
 * por CORTESIA por 12 meses, mantendo o Premium, ficando pendente APENAS do
 * documento de identificação (o app pede ao abrir). Não re-cobra: na renovação
 * é convidado a migrar para a filiação Asaas.
 *
 * Idempotente: usuário que já tem qualquer FiliacaoLiga é pulado.
 *
 *   npx tsx scripts/migrar-filiacao-legados.ts --dry      # só lista
 *   npx tsx scripts/migrar-filiacao-legados.ts            # aplica
 *
 * Requer o .env/túnel do banco de produção.
 */
import { prisma } from '../src/db/cliente.js';
import { ativarFiliacao } from '../src/dominio/filiacao.js';

/** Status de assinatura IAP que ainda garantem acesso pago. */
const STATUS_ATIVOS = ['ATIVA', 'EM_GRACA', 'CANCELADA_RENOVACAO'];

async function main() {
  const dry = process.argv.includes('--dry');

  // Fonte da verdade do pago: assinaturas_app (produto anual, ainda no período).
  const assinaturas = await prisma.assinaturaApp.findMany({
    where: {
      produtoId: 'premium_anual',
      status: { in: STATUS_ATIVOS },
      usuarioId: { not: null },
    },
    include: { usuario: true },
  });

  // Um usuário pode ter mais de uma linha; deduplica pela conta.
  const porUsuario = new Map<string, (typeof assinaturas)[number]['usuario']>();
  for (const a of assinaturas) {
    if (a.usuario && !porUsuario.has(a.usuario.id)) porUsuario.set(a.usuario.id, a.usuario);
  }

  console.log(`Legados anual IAP ativos: ${porUsuario.size} usuário(s).`);
  let criados = 0;
  let pulados = 0;

  for (const usuario of porUsuario.values()) {
    if (!usuario) continue;
    const jaTem = await prisma.filiacaoLiga.findFirst({ where: { usuarioId: usuario.id } });
    if (jaTem) {
      pulados++;
      continue;
    }
    console.log(`  ${dry ? '[dry] ' : ''}filiar cortesia: ${usuario.nome} (${usuario.cpf})`);
    if (dry) continue;

    const pendente = await prisma.filiacaoLiga.create({
      data: {
        usuarioId: usuario.id,
        origem: 'CORTESIA_MIGRACAO',
        nomeCompleto: usuario.nome,
        cpf: usuario.cpf,
        valorCentavos: 0,
        documentacaoCompleta: false,
        vigenteAte: new Date(), // ativarFiliacao estende +12 meses
      },
    });
    await ativarFiliacao(pendente, { origemEvento: 'MIGRACAO' });
    criados++;
  }

  console.log(`\nConcluído. Criados: ${criados} | já tinham filiação: ${pulados}.`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
