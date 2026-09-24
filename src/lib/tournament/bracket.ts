import { TournamentError } from "./errors";
import { finalizeMatch, propagate } from "./match";
import { THIRD_PLACE_ID, matchId, nextPowerOfTwo, roundName, seedOrder } from "./rounds";
import type { Match, Round, Slot } from "./types";

/** Retorna um inteiro uniforme em [0, maxExclusive). */
export type RandomInt = (maxExclusive: number) => number;

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 128;

/** Fisher–Yates. */
export function shuffle<T>(items: readonly T[], randomInt: RandomInt): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export interface DrawResult {
  rounds: Round[];
  matches: Match[];
  /** Ordem sorteada (seed 1 = primeiro). Vai para o histórico por transparência. */
  order: Slot[];
}

/**
 * Sorteia a chave mata-mata. Ninguém escolhe adversário: a ordem é
 * aleatória e os BYEs (quando o nº de inscritos não é potência de 2)
 * ficam espalhados, nunca BYE contra BYE.
 */
export function generateBracket(
  players: readonly Slot[],
  randomInt: RandomInt,
  now: string,
  previousRounds: readonly Round[] = [],
): DrawResult {
  if (players.length < MIN_PLAYERS) {
    throw new TournamentError(`São necessários pelo menos ${MIN_PLAYERS} inscritos para sortear a chave.`);
  }
  if (players.length > MAX_PLAYERS) {
    throw new TournamentError(`Máximo de ${MAX_PLAYERS} inscritos.`);
  }
  if (new Set(players.map((p) => p.pid)).size !== players.length) {
    throw new TournamentError("Há inscritos duplicados.");
  }

  const order = shuffle(players, randomInt).map((p) => ({ pid: p.pid, nickname: p.nickname }));
  const size = nextPowerOfTwo(order.length);
  const totalRounds = Math.log2(size);
  const rounds: Round[] = [];
  const byId = new Map<string, Match>();

  for (let r = 1; r <= totalRounds; r++) {
    const count = size / 2 ** r;
    const isFinal = r === totalRounds;
    rounds.push({
      index: r,
      name: roundName(count),
      deadline: previousRounds.find((x) => x.index === r)?.deadline ?? null,
    });
    for (let p = 0; p < count; p++) {
      const id = matchId(r, p);
      byId.set(id, {
        id,
        round: r,
        position: p,
        slotA: null,
        slotB: null,
        status: "aguardando",
        votes: {},
        winnerPid: null,
        score: null,
        decidedBy: null,
        deadlineOverride: null,
        nextMatchId: isFinal ? null : matchId(r + 1, Math.floor(p / 2)),
        nextSlot: isFinal ? null : p % 2 === 0 ? "A" : "B",
        loserNextMatchId: null,
        loserNextSlot: null,
        isThirdPlace: false,
        finishedAt: null,
        updatedAt: now,
      });
    }
  }

  // Disputa de 3º lugar: perdedores das semifinais (a partir de 4 inscritos,
  // quando as duas semis são jogos de verdade).
  if (order.length >= 4) {
    const semiRound = totalRounds - 1;
    byId.set(THIRD_PLACE_ID, {
      ...byId.get(matchId(totalRounds, 0))!,
      id: THIRD_PLACE_ID,
      position: 1,
      isThirdPlace: true,
    });
    for (let p = 0; p < 2; p++) {
      const semi = byId.get(matchId(semiRound, p))!;
      byId.set(semi.id, { ...semi, loserNextMatchId: THIRD_PLACE_ID, loserNextSlot: p === 0 ? "A" : "B" });
    }
  }

  const seeds = seedOrder(size);
  for (let p = 0; p < size / 2; p++) {
    const id = matchId(1, p);
    const m = byId.get(id)!;
    const slotA = order[seeds[2 * p] - 1] ?? null;
    const slotB = order[seeds[2 * p + 1] - 1] ?? null;
    let match: Match = { ...m, slotA, slotB };

    if (slotA && slotB) {
      match.status = "pendente";
      byId.set(id, match);
      continue;
    }
    const lone = slotA ?? slotB;
    if (!lone) throw new TournamentError("Erro interno no sorteio (BYE contra BYE).");
    match = finalizeMatch(match, lone.pid, null, "bye", now);
    byId.set(id, match);
    const next = match.nextMatchId ? byId.get(match.nextMatchId)! : null;
    const effect = propagate(match, next, null, now);
    if (effect.next) byId.set(effect.next.id, effect.next);
  }

  return { rounds, matches: [...byId.values()], order };
}
