import type { MatchDTO } from "./dto";
import type { DeadlineState } from "./tournament/deadline";
import type { DecidedBy, MatchStatus, Round } from "./tournament/types";

export const STATUS_LABEL: Record<MatchStatus, string> = {
  aguardando: "Aguardando adversário",
  pendente: "Pendente",
  em_disputa: "Em disputa",
  finalizada: "Finalizada",
};

export const DECIDED_LABEL: Record<DecidedBy, string> = {
  consenso: "Confirmado pelos dois jogadores",
  admin: "Decidido pela organização",
  wo: "Vitória por W.O.",
  bye: "Avançou direto (BYE)",
};

export function statusBadgeClass(status: MatchStatus, late: boolean): string {
  if (late) return "badge badge-late";
  if (status === "finalizada") return "badge badge-ok";
  if (status === "em_disputa") return "badge badge-dispute";
  if (status === "pendente") return "badge badge-pending";
  return "badge";
}

export function matchTitle(m: Pick<MatchDTO, "isThirdPlace" | "round">, rounds: readonly Round[]): string {
  if (m.isThirdPlace) return "Disputa de 3º lugar";
  return rounds.find((r) => r.index === m.round)?.name ?? `Rodada ${m.round}`;
}

/** Mesmo cálculo do servidor, usando o prazo efetivo já resolvido no DTO. */
export function deadlineStateOf(m: Pick<MatchDTO, "deadline" | "status">, now: number): DeadlineState {
  if (m.status === "finalizada") return "encerrado";
  if (!m.deadline) return "sem_prazo";
  const diff = new Date(m.deadline).getTime() - now;
  if (diff < 0) return "atrasado";
  if (diff <= 24 * 60 * 60 * 1000) return "proximo";
  return "ok";
}

/** Partida aberta e com prazo estourado: só o ADM decide. */
export function isLocked(m: Pick<MatchDTO, "deadline" | "status">, now: number): boolean {
  return (m.status === "pendente" || m.status === "em_disputa") && deadlineStateOf(m, now) === "atrasado";
}
