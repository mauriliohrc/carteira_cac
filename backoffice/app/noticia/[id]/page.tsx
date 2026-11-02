import { redirect } from 'next/navigation';

/**
 * Rota legada do link de notícia (`backoffice.carteiracac.com/noticia/<id>`).
 * O link oficial agora é `noticias.carteiracac.com/<titulo>-<id>`; aqui só
 * redirecionamos para lá, preservando links já compartilhados (ex.: builds do
 * app anteriores à URL nova). O slug é cosmético — o id no fim é o que vale.
 */
export default async function NoticiaLegada({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`https://noticias.carteiracac.com/noticia-${id}`);
}
