/**
 * Pedido de avaliação na loja — o prompt nativo de 5 estrelas
 * ("Está gostando do Carteira CAC?").
 *
 * Quem controla se o diálogo aparece é a Apple/Google (há um limite de vezes
 * por ano); o app apenas SOLICITA no momento certo. Escolhemos o cadastro da
 * primeira arma: é quando o usuário tirou valor real do app. Pedimos uma única
 * vez — guardamos um marcador em `config` para nunca insistir.
 */
import * as StoreReview from 'expo-store-review';

import { CHAVES, gravarConfig, lerConfig } from '@/db/config';

export async function pedirAvaliacaoUmaVez(): Promise<void> {
  try {
    if ((await lerConfig(CHAVES.avaliacaoPedida)) === '1') return;

    // Sem ação de avaliação disponível (loja ausente, simulador): não queima o
    // marcador — tenta de novo numa próxima ocasião.
    if (!(await StoreReview.hasAction())) return;

    await gravarConfig(CHAVES.avaliacaoPedida, '1');
    await StoreReview.requestReview();
  } catch {
    // A avaliação é um bônus; qualquer falha aqui nunca deve atrapalhar o app.
  }
}
