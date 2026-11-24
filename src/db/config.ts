import { abrirBanco } from './index';

export async function lerConfig(chave: string): Promise<string | null> {
  const db = await abrirBanco();
  const r = await db.getFirstAsync<{ valor: string | null }>(
    'SELECT valor FROM config WHERE chave = ?',
    chave
  );
  return r?.valor ?? null;
}

export async function gravarConfig(chave: string, valor: string | null): Promise<void> {
  const db = await abrirBanco();
  await db.runAsync(
    'INSERT INTO config (chave, valor) VALUES (?, ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor',
    chave,
    valor
  );
}

export const CHAVES = {
  premium: 'premium.ativo',
  /** Premium liberado por código promocional (dono): não expira nem depende da loja. */
  premiumCodigo: 'premium.codigo',
  /**
   * Premium liberado por FILIAÇÃO à liga (assinatura anual Asaas). Derivado do
   * registro de sync 'filiacoes': fica '1' enquanto há filiação ativa e vigente.
   * Como o cupom, vence o downgrade da loja — mas, diferente dele, o SERVIDOR
   * pode revogá-lo (o sync traz a filiação vencida/cancelada e a flag cai).
   */
  premiumFiliacao: 'premium.filiacao',
  /** Tipo do premium da loja: 'MENSAL' | 'ANUAL' | 'ANUAL_PARCEIRO' (cupom é derivado do código). */
  premiumTipo: 'premium.tipo',
  /**
   * Quantas consultas à loja seguidas devolveram "sem assinatura" ENQUANTO o
   * aparelho já estava premium. Só rebaixamos após a 2ª (confirmação dupla) —
   * o Google Play devolve lista vazia de forma transitória (conexão fria, erro
   * de billing), e um único resultado não pode derrubar um assinante pago.
   */
  premiumVazioSeguido: 'premium.vazioSeguido',
  onboardingVisto: 'app.onboarding',
  /** Já mostramos o onboarding adicional de acervo (CR/Posse-Porte → armas). */
  onboardingAcervoVisto: 'app.onboardingAcervo',
  /** Já abrimos o fluxo guiado (conta → documento → arma → premium) ao menos uma vez. */
  onboardingFluxo: 'app.onboardingFluxo',
  tema: 'app.tema',
  /**
   * O usuário quer acompanhar habitualidade no app. Ligado por padrão; se
   * desligar, a habitualidade some do app (nem calcula, nem exibe, nem avisa).
   */
  gerenciarHabitualidade: 'habitualidade.gerenciar',
  /** Nível do atirador desportivo (IN 311/2025): define a exigência de habitualidade. */
  nivelAtirador: 'habitualidade.nivel',
  /** Já pedimos a avaliação na loja (uma vez só, no cadastro da primeira arma). */
  avaliacaoPedida: 'app.avaliacao.pedida',
  /** Reconversão da liga: quando pode ofertar de novo (ISO) e quantas já exibiu. */
  ligaProximaOferta: 'liga.proximaOferta',
  ligaDispensas: 'liga.dispensas',
  /** Spotlight de novidade da liga já mostrado (para quem atualizou de versão antiga). */
  ligaSpotlightVisto: 'liga.spotlightVisto',
  /** Caminho (relativo/estável) da foto do usuário na carteira de filiado. */
  carteirinhaFoto: 'carteirinha.foto',
  /**
   * Id anônimo e estável deste aparelho, para métricas de produto (funil de
   * onboarding). Gerado uma vez e nunca muda — mede até quem não criou conta.
   */
  anonId: 'app.anonId',
  /** Cursor (carimbo do servidor) do último pull de sincronização na nuvem. */
  syncCursor: 'sync.cursor',
  /** Séries de armas já importadas da Shooting House (não reimportar/ressuscitar). */
  armasImportadasSH: 'sh.armas.importadas',
  /** Chaves de documentos já importados da Shooting House (ex.: CR). */
  docsImportadosSH: 'sh.docs.importados',
} as const;
