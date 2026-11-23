/**
 * Backfill: sanitiza o HTML de todas as notícias já gravadas.
 *
 * A sanitização passou a rodar na escrita (noticiaBaseSchema), mas o conteúdo
 * antigo no banco ainda pode conter payload de XSS. Este script re-sanitiza
 * tudo uma vez e só grava as linhas que de fato mudaram.
 *
 * Uso (no servidor de produção, com o DATABASE_URL apontando pro MySQL):
 *   node --import tsx scripts/sanitizar-noticias.ts
 */
import { prisma } from '../src/db/cliente.js';
import { sanitizarHtmlNoticia } from '../src/dominio/sanitizarHtml.js';

async function main() {
  const noticias = await prisma.noticia.findMany({ select: { id: true, conteudo: true } });
  console.log(`Analisando ${noticias.length} notícias…`);

  let alteradas = 0;
  for (const n of noticias) {
    if (!n.conteudo) continue;
    const limpo = sanitizarHtmlNoticia(n.conteudo);
    if (limpo !== n.conteudo) {
      await prisma.noticia.update({ where: { id: n.id }, data: { conteudo: limpo } });
      alteradas++;
      console.log(`  • ${n.id}: sanitizada (${n.conteudo.length} → ${limpo.length} chars)`);
    }
  }

  console.log(`Concluído. ${alteradas} notícia(s) alterada(s), ${noticias.length - alteradas} já limpas.`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
