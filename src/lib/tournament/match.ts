import { TournamentError } from "./errors";
import type { DecidedBy, Match, Score, Slot, SlotKey, Vote } from "./types";

export interface ResultInput {
  winnerPid: string;
  /** Placar do jogador do slot A (opcional, mas se vier precisa vir junto com scoreB). */
  scoreA?: number | null;
  /** Placar do jogador do slot B. */
  scoreB?: number | null;
}

export type VoteOutcome = "aguardando_adversario" | "em_disputa" | "finalizada" | "sem_mudanca";

const MAX_SCORE = 99;

export const LATE_VOTE_MESSAGE =
  "Prazo encerrado: o resultado desse jogo ficou travado e agora só a organização pode definir.";

export function slotOf(match: Match, pid: string): SlotKey | null {
  if (match.slotA?.pid === pid) return "A";
  if (match.slotB?.pid === pid) return "B";
  return null;
}

export function opponentOf(match: Match, pid: string): Slot | null {
  const key = slotOf(match, pid);
  if (key === "A") return match.slotB;
  if (key === "B") return match.slotA;
  return null;
}

export function winnerSlot(match: Match): Slot | null {
  if (match.status !== "finalizada" || !match.winnerPid) return null;
  return match.slotA?.pid === match.winnerPid ? match.slotA : match.slotB;
}

export function loserSlot(match: Match): Slot | null {
  if (match.status !== "finalizada" || !match.winnerPid) return null;
  return match.slotA?.pid === match.winnerPid ? match.slotB : match.slotA;
}

export function isPastDeadline(deadline: string | null | undefined, now: string): boolean {
  return !!deadline && new Date(now).getTime() > new Date(deadline).getTime();
}

function assertOpenForResult(match: Match): void {
  if (!match.slotA || !match.slotB) {
    throw new TournamentError("Essa partida ainda não tem os dois jogadores definidos.");
  }
  if (match.status !== "pendente" && match.status !== "em_disputa") {
    throw new TournamentError("Essa partida não está aberta para resultado.");
  }
}

/** Valida e normaliza o placar. Placar é opcional, mas precisa ser coerente com o vencedor. */
export function normalizeScore(match: Match, input: ResultInput): Score | null {
  const a = input.scoreA ?? null;
  const b = input.scoreB ?? null;
  if (a === null && b === null) return null;
  if (a === null || b === null) {
    throw new TournamentError("Preencha o placar dos dois jogadores (ou deixe os dois em branco).");
  }
  for (const v of [a, b]) {
    if (!Number.isInteger(v) || v < 0 || v > MAX_SCORE) {
      throw new TournamentError(`O placar precisa ser um número inteiro entre 0 e ${MAX_SCORE}.`);
    }
  }
  if (a === b) throw new TournamentError("Placar empatado não define vencedor.");
  const winnerKey = slotOf(match, input.winnerPid);
  if ((winnerKey === "A" && a < b) || (winnerKey === "B" && b < a)) {
    throw new TournamentError("O placar não bate com o vencedor escolhido.");
  }
  return { a, b };
}

function assertWinnerInMatch(match: Match, winnerPid: string): void {
  if (!slotOf(match, winnerPid)) {
    throw new TournamentError("O vencedor precisa ser um dos jogadores da partida.");
  }
}

function sameScore(x: Score | null, y: Score | null): boolean {
  return x?.a === y?.a && x?.b === y?.b;
}

function voteScore(v: Vote): Score | null {
  return v.scoreA === null || v.scoreB === null ? null : { a: v.scoreA, b: v.scoreB };
}

export function finalizeMatch(
  match: Match,
  winnerPid: string,
  score: Score | null,
  decidedBy: DecidedBy,
  now: string,
): Match {
  return { ...match, status: "finalizada", winnerPid, score, decidedBy, finishedAt: now, updatedAt: now };
}

/**
 * Voto de um jogador da partida. Os dois precisam concordar no vencedor
 * (e no placar, se os dois informarem) para a partida ser finalizada.
 * Depois do prazo, jogadores não votam mais: só a organização decide.
 */
export function castVote(
  match: Match,
  voterPid: string,
  input: ResultInput,
  now: string,
  opts: { deadline?: string | null } = {},
): { match: Match; outcome: VoteOutcome } {
  assertOpenForResult(match);
  if (!slotOf(match, voterPid)) {
    throw new TournamentError("Só os jogadores dessa partida podem informar o resultado.");
  }
  if (isPastDeadline(opts.deadline, now)) throw new TournamentError(LATE_VOTE_MESSAGE);
  assertWinnerInMatch(match, input.winnerPid);
  const score = normalizeScore(match, input);

  const previous = match.votes[voterPid];
  if (previous && previous.winnerPid === input.winnerPid && sameScore(voteScore(previous), score)) {
    return { match, outcome: "sem_mudanca" };
  }

  const vote: Vote = { winnerPid: input.winnerPid, scoreA: score?.a ?? null, scoreB: score?.b ?? null, at: now };
  const votes = { ...match.votes, [voterPid]: vote };
  const opponentPid = opponentOf(match, voterPid)!.pid;
  const other = votes[opponentPid];

  if (!other) {
    return { match: { ...match, votes, status: "pendente", updatedAt: now }, outcome: "aguardando_adversario" };
  }

  const otherScore = voteScore(other);
  const agreeWinner = other.winnerPid === vote.winnerPid;
  const agreeScore = score === null || otherScore === null || sameScore(score, otherScore);
  if (agreeWinner && agreeScore) {
    const finalScore = score ?? otherScore;
    return {
      match: finalizeMatch({ ...match, votes }, vote.winnerPid, finalScore, "consenso", now),
      outcome: "finalizada",
    };
  }
  return { match: { ...match, votes, status: "em_disputa", updatedAt: now }, outcome: "em_disputa" };
}

/** Decisão do ADM (resultado normal ou W.O.). Vale mesmo em disputa ou atrasado. */
export function adminDecide(
  match: Match,
  input: ResultInput,
  kind: "admin" | "wo",
  now: string,
): Match {
  assertOpenForResult(match);
  assertWinnerInMatch(match, input.winnerPid);
  const score = kind === "wo" ? null : normalizeScore(match, input);
  return finalizeMatch(match, input.winnerPid, score, kind, now);
}

function placeInto(target: Match, key: SlotKey, slot: Slot, now: string): Match {
  const updated: Match = {
    ...target,
    slotA: key === "A" ? { ...slot } : target.slotA,
    slotB: key === "B" ? { ...slot } : target.slotB,
    updatedAt: now,
  };
  if (updated.slotA && updated.slotB && updated.status === "aguardando") updated.status = "pendente";
  return updated;
}

/** Coloca o vencedor de `from` no slot certo da próxima partida. */
export function advanceWinner(from: Match, next: Match, now: string): Match {
  const winner = winnerSlot(from);
  if (!winner) throw new TournamentError("A partida ainda não tem vencedor.");
  if (from.nextMatchId !== next.id || !from.nextSlot) {
    throw new TournamentError("Ligação inválida entre partidas.");
  }
  return placeInto(next, from.nextSlot, winner, now);
}

/** Semifinal: o perdedor vai para a disputa de 3º lugar. */
export function advanceLoser(from: Match, loserNext: Match, now: string): Match {
  const loser = loserSlot(from);
  if (!loser) throw new TournamentError("A partida ainda não tem perdedor definido.");
  if (from.loserNextMatchId !== loserNext.id || !from.loserNextSlot) {
    throw new TournamentError("Ligação inválida com a disputa de 3º lugar.");
  }
  return placeInto(loserNext, from.loserNextSlot, loser, now);
}

/** Efeitos de uma partida finalizada: vencedor avança e, na semi, perdedor vai para o 3º lugar. */
export function propagate(
  match: Match,
  next: Match | null,
  loserNext: Match | null,
  now: string,
): { next: Match | null; loserNext: Match | null } {
  if (match.status !== "finalizada") return { next, loserNext };
  if (match.nextMatchId && !next) throw new TournamentError("Próxima partida não encontrada.");
  if (match.loserNextMatchId && !loserNext) throw new TournamentError("Disputa de 3º lugar não encontrada.");
  return {
    next: next ? advanceWinner(match, next, now) : null,
    loserNext: loserNext ? advanceLoser(match, loserNext, now) : null,
  };
}

/**
 * Desfaz o resultado (ADM). Só é possível se as partidas que dependem dele
 * (próxima fase e disputa de 3º) ainda não terminaram; os votos delas são
 * limpos porque o adversário pode mudar.
 */
export function undoResult(
  match: Match,
  next: Match | null,
  loserNext: Match | null,
  now: string,
): { match: Match; next: Match | null; loserNext: Match | null } {
  if (match.status !== "finalizada") throw new TournamentError("Essa partida não tem resultado para desfazer.");
  if (match.decidedBy === "bye") throw new TournamentError("Avanço por BYE não pode ser desfeito.");
  if (match.nextMatchId && !next) throw new TournamentError("Próxima partida não encontrada.");
  if (match.loserNextMatchId && !loserNext) throw new TournamentError("Disputa de 3º lugar não encontrada.");
  if (next?.status === "finalizada") {
    throw new TournamentError("A próxima partida já tem resultado. Desfaça aquela primeiro.");
  }
  if (loserNext?.status === "finalizada") {
    throw new TournamentError("A disputa de 3º lugar já tem resultado. Desfaça aquela primeiro.");
  }

  const clear = (target: Match | null, key: SlotKey | null): Match | null =>
    target && key
      ? {
          ...target,
          slotA: key === "A" ? null : target.slotA,
          slotB: key === "B" ? null : target.slotB,
          status: "aguardando",
          votes: {},
          updatedAt: now,
        }
      : null;

  return {
    match: {
      ...match,
      status: "pendente",
      votes: {},
      winnerPid: null,
      score: null,
      decidedBy: null,
      finishedAt: null,
      updatedAt: now,
    },
    next: clear(next, match.nextSlot),
    loserNext: clear(loserNext, match.loserNextSlot),
  };
}

/** Partida com resultado "de verdade" (não conta avanço por BYE). */
export function hasRealActivity(match: Match): boolean {
  return (match.status === "finalizada" && match.decidedBy !== "bye") || Object.keys(match.votes).length > 0;
}

export interface Podium {
  complete: boolean;
  championPid: string | null;
  runnerUpPid: string | null;
  thirdPid: string | null;
}

/** Pódio do campeonato a partir das partidas. Termina quando TODAS as partidas acabam. */
export function tournamentResult(matches: readonly Match[]): Podium {
  const final = matches.find((m) => !m.nextMatchId && !m.isThirdPlace);
  const third = matches.find((m) => m.isThirdPlace);
  let thirdPid: string | null = null;
  if (third) {
    thirdPid = winnerSlot(third)?.pid ?? null;
  } else if (final) {
    // 3 inscritos: não há disputa de 3º; fica em 3º quem perdeu a única semifinal jogada.
    const realSemis = matches.filter((m) => m.nextMatchId === final.id && m.decidedBy !== "bye");
    if (realSemis.length === 1) thirdPid = loserSlot(realSemis[0])?.pid ?? null;
  }
  return {
    complete: matches.length > 0 && matches.every((m) => m.status === "finalizada"),
    championPid: final ? (winnerSlot(final)?.pid ?? null) : null,
    runnerUpPid: final ? (loserSlot(final)?.pid ?? null) : null,
    thirdPid,
  };
}
