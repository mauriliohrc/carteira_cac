import { CHAVES, gravarConfig, lerConfig } from '@/db/config';
import { filiacaoAtivaLocal } from '@/db/filiacoes';

/**
 * Máquina de reconversão da liga. Decide QUANDO oferecer a filiação de forma
 * proativa (sem ser chato): respeita um cooldown que cresce a cada vez que a
 * oferta é exibida, nunca repete na mesma sessão e nunca aparece para quem já é
 * filiado. O card passivo do Painel NÃO passa por aqui — só as ofertas ativas.
 *
 * Cooldown por nº de exibições anteriores: 7 → 14 → 30 → 60 dias.
 */
const COOLDOWN_DIAS = [7, 14, 30, 60];

let ofertadaNestaSessao = false;

function cooldownDias(exibicoes: number): number {
  return COOLDOWN_DIAS[Math.min(exibicoes, COOLDOWN_DIAS.length - 1)];
}

/** Zera o marcador de sessão (chamado ao voltar do background). */
export function rearmarOfertaSessao(): void {
  ofertadaNestaSessao = false;
}

/**
 * Deve exibir a oferta proativa da liga agora? Verdadeiro quando: não é filiado,
 * o cooldown já passou e ainda não ofertou nesta sessão. O "momento de valor"
 * (ter acervo, ter pendência) é decidido por quem chama.
 */
export async function deveOfertarLiga(): Promise<boolean> {
  if (ofertadaNestaSessao) return false;
  const filiado = await filiacaoAtivaLocal();
  if (filiado) return false;
  const proxima = await lerConfig(CHAVES.ligaProximaOferta);
  if (proxima && new Date(proxima).getTime() > Date.now()) return false;
  return true;
}

/**
 * Marca que a oferta foi exibida (no onboarding ou proativamente) e agenda a
 * próxima com o cooldown crescente. Chame sempre que a liga for APRESENTADA de
 * forma proativa — assim o onboarding conta como a 1ª oferta e a reconversão
 * segue o cooldown a partir dele.
 */
export async function registrarOfertaExibida(): Promise<void> {
  ofertadaNestaSessao = true;
  const exibicoes = Number((await lerConfig(CHAVES.ligaDispensas)) ?? '0') || 0;
  const dias = cooldownDias(exibicoes);
  const proxima = new Date(Date.now() + dias * 86_400_000);
  await gravarConfig(CHAVES.ligaDispensas, String(exibicoes + 1));
  await gravarConfig(CHAVES.ligaProximaOferta, proxima.toISOString());
}
