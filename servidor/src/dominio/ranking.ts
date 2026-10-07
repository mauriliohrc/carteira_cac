/**
 * Ranking de uma categoria. `ordenamento`:
 *   - MAIOR: maior pontuação vence (desc) — pontos, acertos…
 *   - MENOR: menor pontuação vence (asc) — tempo, penalidades…
 * Usa ranking de competição padrão (empates dividem a posição: 1, 2, 2, 4).
 */
export function ranquear<T extends { pontuacao: number }>(
  itens: T[],
  ordenamento: string
): (T & { posicao: number })[] {
  const ordenados = [...itens].sort((a, b) =>
    ordenamento === 'MENOR' ? a.pontuacao - b.pontuacao : b.pontuacao - a.pontuacao
  );
  let posicao = 0;
  let anterior: number | null = null;
  return ordenados.map((it, i) => {
    if (anterior === null || it.pontuacao !== anterior) {
      posicao = i + 1;
      anterior = it.pontuacao;
    }
    return { ...it, posicao };
  });
}
