/** Id fixo da disputa de 3º lugar. */
export const THIRD_PLACE_ID = "terceiro";

export function nextPowerOfTwo(n: number): number {
  let size = 1;
  while (size < n) size *= 2;
  return size;
}

export function matchId(round: number, position: number): string {
  return `r${round}-m${position}`;
}

/** Nome da rodada a partir de quantas partidas ela tem. */
export function roundName(matchesInRound: number): string {
  switch (matchesInRound) {
    case 1:
      return "Final";
    case 2:
      return "Semifinal";
    case 4:
      return "Quartas de final";
    case 8:
      return "Oitavas de final";
    default:
      return `Rodada de ${matchesInRound * 2}`;
  }
}

/**
 * Ordem padrão de seeds de uma chave (ex.: 8 -> [1,8,4,5,2,7,3,6]).
 * Cada par consecutivo é um confronto. Como o seed s sempre enfrenta
 * size+1-s, os seeds "sobrando" (BYEs) nunca se enfrentam.
 */
export function seedOrder(size: number): number[] {
  let order = [1];
  while (order.length < size) {
    const next = order.length * 2;
    order = order.flatMap((s) => [s, next + 1 - s]);
  }
  return order;
}
