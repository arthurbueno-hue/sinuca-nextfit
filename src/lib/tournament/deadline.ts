import type { Match, Round } from "./types";

export type DeadlineState = "sem_prazo" | "ok" | "proximo" | "atrasado" | "encerrado";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Prazo do jogo: o ajuste individual vence o prazo da rodada. */
export function effectiveDeadline(match: Pick<Match, "round" | "deadlineOverride">, rounds: readonly Round[]): string | null {
  return match.deadlineOverride ?? rounds.find((r) => r.index === match.round)?.deadline ?? null;
}

export function deadlineState(
  match: Pick<Match, "round" | "deadlineOverride" | "status">,
  rounds: readonly Round[],
  now: Date,
): DeadlineState {
  if (match.status === "finalizada") return "encerrado";
  const deadline = effectiveDeadline(match, rounds);
  if (!deadline) return "sem_prazo";
  const diff = new Date(deadline).getTime() - now.getTime();
  if (diff < 0) return "atrasado";
  if (diff <= DAY_MS) return "proximo";
  return "ok";
}
